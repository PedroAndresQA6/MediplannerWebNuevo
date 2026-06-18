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

  section('Sección "Otra vacuna" (filas inline custom)');
  const otra = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[name="vacuna_nombre"]'));
    return {
      filasOtraVacuna: inputs.length,
      camposPorFila: ['input[name="vacuna_nombre"]', 'input[name="dosis_nombre"]', 'input[placeholder="Fecha"]', 'input[placeholder="Folio"]', 'textarea[placeholder="Comentarios"]']
        .map(s => ({ sel: s, count: document.querySelectorAll(s).length })),
    };
  });
  log(JSON.stringify(otra, null, 2));

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
