import { test, Page } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────────
// MAPEADOR v2 de la cartilla de Vacunación (UI NUEVA).
// La UI cambió: cada dosis es un <input type="date"> nativo inline (no react-calendar),
// hay íconos lápiz (editar) por dosis, y una sección "Otra vacuna" con filas inline.
// Este test mapea: (a) si llenar el date dispara saveVaccinesUser solo (auto-save),
// (b) qué íconos/botones hay por dosis (editar/borrar), (c) la sección "Otra vacuna".
// NO asserta: vuelca info + screenshots.
// ─────────────────────────────────────────────────────────────────────────────

const PATIENT = 'Agustin Tapia';
const TABLE = 'table.table-compact';

function log(...a: any[]) { console.log(...a); }
function section(t: string) { console.log(`\n${'═'.repeat(70)}\n🗺️  ${t}\n${'═'.repeat(70)}`); }

async function goToVacunacion(page: Page): Promise<void> {
  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('a.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const pageSize = page.locator('select').first();
  if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.locator('a.font-semibold.text-sm.text-gray-900', { hasText: PATIENT }).first().click();
  await page.waitForTimeout(3000);
  await page.getByText(/^\s*Vacunación\s*$/i).first().click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
}

test('MAPEAR v2 Vacunación (date nativo, iconos, otra vacuna)', async ({ page }) => {
  test.setTimeout(240000);
  const monitor = setupConsoleMonitor(page);
  const vaccineApiCalls: string[] = [];
  page.on('response', async (res) => {
    if (/\/api\/vaccines\//.test(res.url())) {
      let body = '';
      try { body = (await res.text()).substring(0, 100); } catch {}
      const line = `${res.request().method()} ${res.status()} ${res.url().split('/api/')[1]} → ${body}`;
      vaccineApiCalls.push(line);
      log(`   📡 [VACCINES] ${line}`);
    }
  });

  section(`Ir a Vacunación de ${PATIENT}`);
  await goToVacunacion(page);

  section('Date inputs en la cartilla (registrados vs vacíos)');
  const dateInfo = await page.evaluate((TABLE) => {
    const t = document.querySelector(TABLE);
    if (!t) return { total: 0, conValor: 0, vacios: 0 };
    const dates = Array.from(t.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    return { total: dates.length, conValor: dates.filter(d => d.value).length, vacios: dates.filter(d => !d.value).length };
  }, TABLE);
  log(`  Date inputs: total=${dateInfo.total}, con valor=${dateInfo.conValor}, vacíos=${dateInfo.vacios}`);

  section('Íconos/botones por dosis en la tabla (data-icon)');
  const icons = await page.evaluate((TABLE) => {
    const t = document.querySelector(TABLE);
    if (!t) return [];
    const btns = Array.from(t.querySelectorAll('button')).slice(0, 12);
    return btns.map(b => {
      const svg = b.querySelector('svg');
      return {
        cls: (b.getAttribute('class') || '').substring(0, 35),
        icon: svg?.getAttribute('data-icon') || '',
        txt: (b.textContent || '').trim().substring(0, 12),
      };
    });
  }, TABLE);
  log(JSON.stringify(icons, null, 2));

  section('AUTO-SAVE: llenar un date vacío y ver si dispara saveVaccinesUser SIN "Guardar cambios"');
  const callsBefore = vaccineApiCalls.length;
  const emptyDate = page.locator(`${TABLE} input[type="date"]`).filter({ hasNot: page.locator('[value]') }).first();
  // Tomar el primer date sin valor por evaluación directa (más fiable que el filtro)
  const filledIdx = await page.evaluate((TABLE) => {
    const t = document.querySelector(TABLE)!;
    const dates = Array.from(t.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    const idx = dates.findIndex(d => !d.value);
    return idx;
  }, TABLE);
  log(`  Primer date vacío en índice: ${filledIdx}`);
  if (filledIdx >= 0) {
    const target = page.locator(`${TABLE} input[type="date"]`).nth(filledIdx);
    await target.scrollIntoViewIfNeeded().catch(() => {});
    await target.fill('2026-06-15').catch((e) => log(`  ⚠️ fill falló: ${e.message}`));
    await target.blur().catch(() => {});
    await page.waitForTimeout(3000); // esperar posible auto-guardado
    const callsAfter = vaccineApiCalls.length;
    log(`  Llamadas a /vaccines/ tras llenar la fecha (sin tocar Guardar): ${callsAfter - callsBefore}`);
    log(`  ¿Auto-save? ${callsAfter > callsBefore ? 'SÍ — la fecha dispara API sola' : 'NO — requiere Guardar cambios'}`);
  }
  await page.screenshot({ path: 'test-results/vac-map2-01-fecha-llenada.png', fullPage: true });

  section('Tras poner fecha: ¿aparecen folio/obs o cambian los íconos de esa dosis?');
  await dumpVisibleFolioObs(page);

  section('Click en ícono lápiz (editar) de una dosis — mapear editor de folio/obs');
  const pencil = page.locator(`${TABLE} button.btn-secondary`).first();
  if (await pencil.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pencil.scrollIntoViewIfNeeded().catch(() => {});
    await pencil.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/vac-map2-02-editar.png', fullPage: true });
    await dumpVisibleFolioObs(page);
  } else {
    log('  ⚠️ No hay botón lápiz visible');
  }

  section('Sección "Otra vacuna" — ESTADO ACTUAL (sin filas registradas)');
  // La sección tiene 2 presentaciones: (a) estado vacío = CTA para agregar la
  // primera, (b) estado con 1+ = filas inline con inputs. Mapeamos ambos.
  const otraVacio = await page.evaluate(() => {
    const campos = ['input[name="vacuna_nombre"]', 'input[name="dosis_nombre"]', 'input[placeholder="Fecha"]', 'input[placeholder="Folio"]', 'textarea[placeholder="Comentarios"]']
      .map(s => ({ sel: s, count: document.querySelectorAll(s).length }));
    // Buscar el bloque/heading "Otra vacuna" y los botones cercanos (CTA agregar)
    const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div,label'))
      .filter(e => /otra\s+vacuna/i.test((e.textContent || '').trim()) && (e.textContent || '').trim().length < 40)
      .slice(0, 5)
      .map(e => ({ tag: e.tagName.toLowerCase(), txt: (e.textContent || '').trim().substring(0, 40), cls: (e.getAttribute('class') || '').substring(0, 40) }));
    return { filasOtraVacuna: document.querySelectorAll('input[name="vacuna_nombre"]').length, campos, headings: heads };
  });
  log(`ESTADO VACÍO:\n${JSON.stringify(otraVacio, null, 2)}`);

  section('Botones candidatos para AGREGAR "otra vacuna" (texto + clase)');
  const addCandidates = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .map(b => ({ txt: (b.textContent || '').trim(), cls: (b.getAttribute('class') || '').substring(0, 50), tag: b.tagName.toLowerCase() }))
      .filter(b => /vacuna|agregar|añadir|nuevo|nueva|\+/i.test(b.txt) && b.txt.length > 0 && b.txt.length < 50);
  });
  log(JSON.stringify(addCandidates, null, 2));
  await page.screenshot({ path: 'test-results/vac-map2-otra-vacia.png', fullPage: true });

  section('Hacer CLICK en el botón para agregar "otra vacuna" y mapear ESTADO CON FILA');
  // Probar varios textos posibles del CTA, en orden de probabilidad.
  const ctaSelectors = [
    'button:has-text("Vacuna diferente")',
    'button:has-text("Otra vacuna")',
    'button:has-text("Agregar vacuna")',
    'button:has-text("Agregar otra")',
    'button:has-text("Añadir vacuna")',
    'button:has-text("Nueva vacuna")',
  ];
  let ctaClicked = false;
  for (const sel of ctaSelectors) {
    const btn = page.locator(sel).filter({ hasNotText: 'cambios' }).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      log(`  ✅ CTA encontrado con selector: ${sel}`);
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true }).catch((e) => log(`  ⚠️ click falló: ${e.message}`));
      await page.waitForTimeout(2000);
      ctaClicked = true;
      break;
    }
  }
  if (!ctaClicked) log('  ⚠️ Ningún CTA de "agregar otra vacuna" encontrado con los textos probados');

  const otraConFila = await page.evaluate(() => {
    const campos = ['input[name="vacuna_nombre"]', 'input[name="dosis_nombre"]', 'input[placeholder="Fecha"]', 'input[placeholder="Folio"]', 'input[placeholder="Comentarios"]', 'textarea[placeholder="Comentarios"]']
      .map(s => ({ sel: s, count: document.querySelectorAll(s).length }));
    // Volcar TODOS los inputs/textarea recién visibles con sus atributos clave
    const inputs = Array.from(document.querySelectorAll('input, textarea'))
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(e => ({ tag: e.tagName.toLowerCase(), type: e.getAttribute('type') || '', name: e.getAttribute('name') || '', ph: e.getAttribute('placeholder') || '', cls: (e.getAttribute('class') || '').substring(0, 30) }))
      .filter(e => e.name || e.ph)
      .slice(0, 40);
    return { campos, inputsVisibles: inputs };
  });
  log(`ESTADO CON FILA (tras click):\n${JSON.stringify(otraConFila, null, 2)}`);
  await page.screenshot({ path: 'test-results/vac-map2-otra-con-fila.png', fullPage: true });

  section('Volcado COMPLETO de la fila "Vacuna diferente" (incluye selects + nombre)');
  const filaCompleta = await page.evaluate(() => {
    // Localizar la fila nueva por su input de placeholder "Fecha" y subir al contenedor.
    const fecha = document.querySelector('input[placeholder="Fecha"]') as HTMLElement | null;
    let cont: HTMLElement | null = fecha;
    for (let i = 0; i < 5 && cont; i++) cont = cont.parentElement;
    const scope = cont || document.body;
    const els = Array.from(scope.querySelectorAll('input, textarea, select, button'))
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(e => ({
        tag: e.tagName.toLowerCase(),
        type: e.getAttribute('type') || '',
        name: e.getAttribute('name') || '',
        ph: e.getAttribute('placeholder') || '',
        role: e.getAttribute('role') || '',
        txt: (e.textContent || '').trim().substring(0, 20),
        cls: (e.getAttribute('class') || '').substring(0, 40),
        opciones: e.tagName === 'SELECT' ? (e as HTMLSelectElement).options.length : undefined,
      }));
    return { contenedorTag: scope.tagName.toLowerCase(), contenedorCls: (scope.getAttribute('class') || '').substring(0, 60), elementos: els };
  });
  log(JSON.stringify(filaCompleta, null, 2));

  section('Botones de la fila "otra vacuna" — DETALLE para identificar el de BORRAR');
  const botonesFila = await page.evaluate(() => {
    const ancla = (document.querySelector('input[placeholder="Fecha"]')
      || Array.from(document.querySelectorAll('select')).find(s => /Seleccione vacuna/i.test(s.textContent || ''))) as HTMLElement | null;
    let cont: HTMLElement | null = ancla;
    for (let i = 0; i < 6 && cont; i++) cont = cont.parentElement;
    const scope = cont || document.body;
    return Array.from(scope.querySelectorAll('button')).map((b, i) => {
      const svg = b.querySelector('svg');
      return {
        idx: i,
        txt: (b.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 16),
        icon: svg?.getAttribute('data-icon') || '',
        title: b.getAttribute('title') || '',
        aria: b.getAttribute('aria-label') || '',
        cls: (b.getAttribute('class') || '').substring(0, 55),
      };
    });
  });
  log(JSON.stringify(botonesFila, null, 2));

  section('Mapear BORRADO de una dosis registrada');
  // Buscar elementos clickeables tipo "borrar" cerca de una fecha con valor.
  const delMap = await page.evaluate((TABLE) => {
    const t = document.querySelector(TABLE)!;
    const candidates: any[] = [];
    // Botones con icono trash/xmark/times, o spans/texto "×"
    t.querySelectorAll('button, span, a, i').forEach((el) => {
      const svg = el.querySelector?.('svg');
      const icon = svg?.getAttribute('data-icon') || '';
      const txt = (el.textContent || '').trim();
      if (/trash|xmark|times|delete|circle-x/i.test(icon) || txt === '×') {
        candidates.push({ tag: el.tagName.toLowerCase(), icon, txt: txt.substring(0, 8), cls: (el.getAttribute('class') || '').substring(0, 30) });
      }
    });
    return candidates.slice(0, 10);
  }, TABLE);
  log(`  Candidatos a "borrar": ${JSON.stringify(delMap, null, 2)}`);

  await page.screenshot({ path: 'test-results/vac-map2-03-final.png', fullPage: true });

  section('RESUMEN');
  log(`  Llamadas /vaccines/ totales: ${vaccineApiCalls.length}`);
  vaccineApiCalls.forEach((c, i) => log(`    [${i + 1}] ${c}`));
  const result = monitor.printSummary();
  log(`  Errores consola/JS: ${result.errors.length}`);
});

async function dumpVisibleFolioObs(page: Page): Promise<void> {
  const data = await page.evaluate(() => {
    const sels = ['input[placeholder="Folio"]', 'input[placeholder="Opcional"]', 'textarea[placeholder="Comentarios"]', 'textarea[placeholder="Notas..."]'];
    return sels.map(s => {
      const els = Array.from(document.querySelectorAll(s)) as HTMLInputElement[];
      const visibles = els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      return { sel: s, visibles: visibles.length, disabled: visibles.map(v => v.disabled) };
    });
  });
  for (const d of data) log(`    ${d.sel}: visibles=${d.visibles} disabled=${JSON.stringify(d.disabled)}`);
}
