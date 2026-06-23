import { test, expect, Page } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────────
// CICLO COMPLETO de la cartilla de Vacunación (UI NUEVA, auto-save por fecha).
//
// Flujo (sobre Agustin Tapia):
//   1) Ir a Vacunación
//   2) Borrar TODOS los registros (dosis de la cartilla + filas "Otra vacuna")
//   3) Refrescar y VERIFICAR que quedó vacío
//   4) Registrar TODAS las dosis disponibles (fecha = auto-save) + 1 "Otra vacuna"
//   5) Refrescar y VERIFICAR que todo persiste
//
// UI nueva (mapeada 2026-06-23):
//   - Cada dosis es un <input type="date"> inline; llenarlo dispara saveVaccinesUser solo.
//   - Borrar dosis: button.btn-secondary cuyo texto es "×" (el lápiz es editar, NO borrar).
//   - "Otra vacuna": NO hay filas-plantilla. Se agrega con el botón "Vacuna diferente",
//     que despliega una fila con: select vacuna + select dosis + input[placeholder="Fecha"]
//     + input[placeholder="Folio"] + textarea[placeholder="Comentarios"], y se guarda con
//     "Guardar cambios". (Los viejos input[name="vacuna_nombre"] YA NO existen.)
//
// FAIL DETECTION (severidad MIXTA):
//   HARD-FAIL  → API de /vaccines/ con status >= 400; saveVaccinesUser con body no-OK;
//                conteo de persistencia distinto al esperado; una dosis que no incrementa.
//   LOG-CONT.  → errores de consola/JS, ruido externo (GA/Zendesk/Clarity), modales de
//                error SweetAlert2 (se cierran), toasts de error. Se reportan en el resumen.
// ─────────────────────────────────────────────────────────────────────────────

const PATIENT = 'Agustin Tapia';
const TABLE = 'table.table-compact';
const DATE_INPUTS = `${TABLE} input[type="date"]`;
// Cap de dosis a registrar. 999 = registrar TODAS las disponibles (cada una auto-guarda).
const MAX_DOSES = 999;

const today = new Date();
const ISO_DATE = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`; // yyyy-mm-15

// Patrones de ruido externo (no son fallas de la plataforma): analytics, soporte, etc.
const EXTERNAL_NOISE = /google-analytics|googletagmanager|zendesk|clarity\.ms|doubleclick|hotjar|facebook|sentry/i;

// ── Helpers de navegación / conteo ───────────────────────────────────────────
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

// Cuenta cuántas dosis de la cartilla tienen fecha (registradas).
async function countRegistered(page: Page): Promise<number> {
  return await page.evaluate((T) => {
    const t = document.querySelector(T);
    if (!t) return 0;
    const dates = Array.from(t.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    return dates.filter(d => d.value).length;
  }, TABLE);
}

async function countOtraVacuna(page: Page): Promise<number> {
  // Cada fila de "otra vacuna" (guardada o nueva) tiene un botón de borrar (icono trash).
  return await page.locator('button:has(svg[data-icon="trash"])').count();
}

// Botón de borrar de una dosis (btn-secondary con texto "×"), excluye el lápiz (editar).
function deleteDoseButtons(page: Page) {
  return page.locator(`${TABLE} button.btn-secondary`).filter({ hasText: '×' });
}

// Botón de borrar de una fila "otra vacuna" (icono trash, mapeado 2026-06-23).
function deleteOtraVacunaButtons(page: Page) {
  return page.locator('button:has(svg[data-icon="trash"])');
}

// ── Tácticas de FAIL DETECTION ───────────────────────────────────────────────

// Acumulador de hallazgos "blandos" (log-and-continue) para el resumen final.
const softFindings: string[] = [];
function note(msg: string) { softFindings.push(msg); console.log(`   📝 [HALLAZGO] ${msg}`); }

// LOG-AND-CONTINUE: detecta un modal SweetAlert2 visible y lo cierra. Solo REPORTA
// (note) si es un modal de ERROR; los de éxito ("guardado correctamente") se cierran
// en silencio porque son esperados. Devuelve true solo si era de error.
// Nota: usa .swal2-popup.swal2-show (el popup realmente mostrándose), no .swal2-container
// (que SweetAlert2 deja persistente en el DOM con sus botones OK/No/Cancel ocultos).
async function detectAndCloseErrorModal(page: Page, contexto: string): Promise<boolean> {
  const popup = page.locator('.swal2-popup.swal2-show');
  if (await popup.count().catch(() => 0) === 0) return false;
  const isError = await page.locator('.swal2-icon-error').count().catch(() => 0) > 0;
  if (isError) {
    const txt = (await popup.first().textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim().substring(0, 100);
    note(`Modal de ERROR en "${contexto}": "${txt}"`);
  }
  // Cerrar el modal (éxito o error) para no bloquear los siguientes pasos.
  const confirm = page.locator('.swal2-confirm:visible, .swal2-close:visible').first();
  if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) await confirm.click().catch(() => {});
  else await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  return isError;
}

// LOG-AND-CONTINUE: detecta toasts/banners de error visibles en la UI. Filtra falsos
// positivos: ignora <style> y cualquier contenido que parezca CSS (":root", "{", "--fa").
async function detectErrorToast(page: Page, contexto: string): Promise<void> {
  const toast = page.locator('.toast:visible, [class*="alert-danger"]:visible, [class*="Toastify"]:visible');
  const n = await toast.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const t = (await toast.nth(i).textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim();
    // Descartar contenido CSS/estilos (falsos positivos) y textos demasiado largos.
    if (/[{}]|:root|--fa-|@font|@media/.test(t) || t.length > 160) continue;
    if (t && /error|falló|fallo|incorrecto|inválid|no se pudo/i.test(t)) note(`Toast de error en "${contexto}": "${t.substring(0, 100)}"`);
  }
}

// HARD-FAIL wrapper: ejecuta una acción que debe disparar saveVaccinesUser y valida
// status 200 + body { status: "OK" }. Lanza si la API falla (bug de plataforma real).
async function expectVaccineSaveOk(page: Page, action: () => Promise<void>, label: string): Promise<void> {
  const respPromise = page.waitForResponse(
    r => /\/api\/vaccines\/saveVaccinesUser/.test(r.url()) && r.request().method() !== 'GET',
    { timeout: 10000 }
  ).catch(() => null);
  await action();
  const resp = await respPromise;
  await detectAndCloseErrorModal(page, label);
  await detectErrorToast(page, label);
  if (!resp) { note(`"${label}": no se observó respuesta de saveVaccinesUser (puede ser no-op de UI)`); return; }
  const status = resp.status();
  let body: any = null;
  try { body = await resp.json(); } catch { /* body no JSON */ }
  // HARD-FAIL: status de error o body marca fallo → bug de plataforma.
  expect(status, `saveVaccinesUser respondió ${status} en "${label}" (esperado 2xx)`).toBeLessThan(400);
  if (body && body.status && String(body.status).toUpperCase() !== 'OK') {
    throw new Error(`saveVaccinesUser body no-OK en "${label}": ${JSON.stringify(body).substring(0, 150)}`);
  }
}

// Espera (best-effort) el auto-guardado tras una acción (sin asserts).
async function waitAutoSave(page: Page): Promise<void> {
  await page.waitForResponse(r => /\/api\/vaccines\/saveVaccinesUser/.test(r.url()) && r.status() === 200, { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(400);
}

test('Vacunación: ciclo completo borrar-todo → vacío → registrar-todo → verificar', async ({ page }) => {
  test.setTimeout(900000);
  const monitor = setupConsoleMonitor(page);

  // FAIL DETECTION (HARD): registro de toda respuesta de /vaccines/ con status >= 400.
  const vaccineApiFailures: string[] = [];
  // Contador de respuestas de saveVaccinesUser (para correlacionar clics de borrado con
  // guardados reales en DevTools). Cada borrado de dosis dispara un saveVaccinesUser.
  const saveResponses: { status: number; ts: number }[] = [];
  page.on('response', (res) => {
    const url = res.url();
    if (/\/api\/vaccines\//.test(url) && res.status() >= 400) {
      vaccineApiFailures.push(`${res.status()} ${res.request().method()} ${url.split('/api/')[1]}`);
    }
    if (/\/api\/vaccines\/saveVaccinesUser/.test(url) && res.request().method() !== 'GET') {
      saveResponses.push({ status: res.status(), ts: Date.now() });
    }
  });

  await test.step(`Ir a Vacunación de ${PATIENT}`, async () => {
    await goToVacunacion(page);
    console.log(`📊 Inicial → dosis registradas: ${await countRegistered(page)}, filas otra-vacuna: ${await countOtraVacuna(page)}`);
  });

  await test.step('Borrar TODAS las dosis (clic rápido en cada × + verificar vs DevTools)', async () => {
    const dosisIniciales = await deleteDoseButtons(page).count();
    const saveBase = saveResponses.length; // marca: guardados previos a esta fase
    let clicks = 0;
    let guard = 0;

    // Clic rápido: NO se espera la respuesta de la API en cada clic. Solo se espera (corto)
    // a que el DOM reduzca el número de botones × (la fila borrada desaparece), lo que evita
    // re-clickear el mismo botón sin pagar los ~hasta 8s de esperar la API en serie.
    while ((await deleteDoseButtons(page).count()) > 0 && guard < 100) {
      const antes = await deleteDoseButtons(page).count();
      const btn = deleteDoseButtons(page).first();
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true }).catch(() => {});
      clicks++;
      // Esperar (máx 2s) a que baje el conteo de × en la tabla = borrado reflejado en UI.
      await page.waitForFunction(
        (n) => Array.from(document.querySelectorAll('table.table-compact button.btn-secondary'))
          .filter(b => (b.textContent || '').trim() === '×').length < n,
        antes, { timeout: 2000 }
      ).catch(() => {});
      guard++;
    }

    // El borrado con × es UI optimista (quita la fila del DOM) y NO auto-guarda como sí
    // lo hace registrar una fecha. La persistencia ocurre en BATCH con "Guardar cambios".
    const savesPorClic = saveResponses.slice(saveBase).filter(s => s.status >= 200 && s.status < 300).length;

    // Persistir el borrado: un solo "Guardar cambios" debe disparar un saveVaccinesUser 200.
    const saveBeforeGuardar = saveResponses.length;
    const guardar = page.locator('button:has-text("Guardar cambios"):visible').first();
    let guardarSave200 = 0;
    if (await guardar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expectVaccineSaveOk(page, async () => { await guardar.click().catch(() => {}); }, 'guardar borrado de dosis');
      guardarSave200 = saveResponses.slice(saveBeforeGuardar).filter(s => s.status >= 200 && s.status < 300).length;
    } else {
      note('No apareció "Guardar cambios" tras borrar dosis (¿la cartilla persiste de otro modo?)');
    }

    await page.waitForTimeout(1000);
    const restantes = await deleteDoseButtons(page).count();

    console.log(`🗑️ Borrado de dosis (clic rápido + guardado batch):`);
    console.log(`     Dosis iniciales:                 ${dosisIniciales}`);
    console.log(`     Clics dados en ×:                ${clicks}`);
    console.log(`     saveVaccinesUser por-clic (200): ${savesPorClic}  (esperado 0: el borrado no auto-guarda)`);
    console.log(`     saveVaccinesUser de "Guardar":   ${guardarSave200}`);
    console.log(`     Botones × restantes:             ${restantes}`);

    // HARD-FAIL: no debe quedar ninguna × en la UI (todo borrado).
    expect(restantes, 'Tras los clics no debe quedar ninguna × de borrar en la cartilla').toBe(0);
    // El gate DURO de persistencia real es el step "VERIFICAR vacío (tras refrescar)".
    // Aquí solo registramos la correspondencia clic↔guardado observada en DevTools.
  });

  await test.step('Borrar filas "Otra vacuna" (botón trash) + guardar batch', async () => {
    const filasIniciales = await deleteOtraVacunaButtons(page).count();
    let clicks = 0;
    let guard = 0;
    // Clic en cada botón trash; esperar (corto) a que baje el conteo de filas (UI optimista).
    while ((await deleteOtraVacunaButtons(page).count()) > 0 && guard < 30) {
      const antes = await deleteOtraVacunaButtons(page).count();
      const btn = deleteOtraVacunaButtons(page).first();
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true }).catch(() => {});
      clicks++;
      await page.waitForFunction(
        (n) => document.querySelectorAll('button svg[data-icon="trash"]').length < n,
        antes, { timeout: 2000 }
      ).catch(() => {});
      await detectAndCloseErrorModal(page, 'borrar otra-vacuna');
      guard++;
    }
    // Guardar cambios para persistir el borrado (batch, igual que la cartilla).
    const save = page.locator('button:has-text("Guardar cambios"):visible').first();
    if (clicks > 0 && await save.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expectVaccineSaveOk(page, async () => { await save.click().catch(() => {}); }, 'guardar borrado otra-vacuna');
    }
    const restantes = await deleteOtraVacunaButtons(page).count();
    console.log(`🗑️ Borrado otra-vacuna: filas iniciales=${filasIniciales}, clics=${clicks}, restantes=${restantes}`);
  });

  await test.step('VERIFICAR vacío (tras refrescar)', async () => {
    await goToVacunacion(page);
    const reg = await countRegistered(page);
    const otras = await countOtraVacuna(page);
    console.log(`✅ Post-borrado tras refrescar → dosis registradas: ${reg}, filas otra-vacuna: ${otras}`);
    await page.screenshot({ path: 'test-results/vac-ciclo-01-vacio.png', fullPage: true });
    expect(reg, 'Tras borrar y refrescar no debe quedar ninguna dosis registrada').toBe(0);
    if (otras > 0) note(`Tras borrar y refrescar quedaron ${otras} fila(s) de "otra vacuna" (el borrado no persistió)`);
  });

  let registradas = 0;
  let objetivo = 0;
  await test.step(`Registrar TODAS las dosis disponibles (auto-save por fecha, cap ${MAX_DOSES})`, async () => {
    const totalEmpty = await page.locator(DATE_INPUTS).count();
    objetivo = Math.min(totalEmpty, MAX_DOSES);
    console.log(`💉 Date inputs disponibles: ${totalEmpty} — registraré ${objetivo} (cap=${MAX_DOSES})`);

    let guard = 0;
    let sinProgreso = 0;
    while (registradas < objetivo && guard < objetivo + 12) {
      // Primer date sin valor
      const idx = await page.evaluate((T) => {
        const t = document.querySelector(T)!;
        const dates = Array.from(t.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
        return dates.findIndex(d => !d.value);
      }, TABLE);
      if (idx < 0) break;
      const target = page.locator(DATE_INPUTS).nth(idx);
      await target.scrollIntoViewIfNeeded().catch(() => {});
      // HARD-FAIL si el guardado de la API falla en esta dosis.
      await expectVaccineSaveOk(page, async () => {
        await target.fill(ISO_DATE).catch(() => {});
        await target.blur().catch(() => {});
      }, `registrar dosis idx ${idx}`);
      const nowReg = await countRegistered(page);
      if (nowReg > registradas) {
        registradas = nowReg;
        sinProgreso = 0;
        console.log(`   ✅ Registrada ${registradas}/${objetivo} (idx ${idx})`);
      } else {
        sinProgreso++;
        console.log(`   ⚠️ idx ${idx} no incrementó el conteo (reg=${nowReg})`);
        // HARD-FAIL: si 3 intentos seguidos no incrementan, la UI no está persistiendo.
        expect(sinProgreso, `3 dosis seguidas no incrementaron el conteo (idx ${idx}) — la UI no registra`).toBeLessThan(3);
      }
      guard++;
    }
    console.log(`💉 Registradas en cartilla: ${registradas} / objetivo ${objetivo}`);
    // HARD-FAIL: deben registrarse todas las disponibles.
    expect(registradas, `Deberían registrarse las ${objetivo} dosis disponibles`).toBe(objetivo);
  });

  await test.step('Agregar/llenar 1 "Otra vacuna" (maneja estado vacío y con fila)', async () => {
    // La sección "Otra vacuna" tiene 2 presentaciones:
    //   (a) ESTADO VACÍO  → muestra el botón "Vacuna diferente" para crear la primera fila.
    //   (b) ESTADO CON 1+ → la fila ya está desplegada inline (sin botón "Vacuna diferente").
    // Se manejan ambos: si está el CTA lo clickeamos; si no, llenamos la fila ya presente.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(800);
    const cta = page.locator('button:has-text("Vacuna diferente")').first();
    if (await cta.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('   Estado VACÍO → click en "Vacuna diferente" para crear la fila');
      await cta.scrollIntoViewIfNeeded().catch(() => {});
      await cta.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
    } else {
      console.log('   Estado CON FILA → se llena la fila de "otra vacuna" ya presente');
    }

    // A partir de aquí la fila debe existir (creada por el CTA o ya presente). Si no hay
    // ni siquiera el input de fecha de la fila, no hay nada que llenar.
    const fechaProbe = page.locator('input[placeholder="Fecha"]').first();
    if (!(await fechaProbe.isVisible({ timeout: 3000 }).catch(() => false))) {
      note('No hay fila de "otra vacuna" para llenar (ni CTA "Vacuna diferente" ni fila inline)');
      await page.screenshot({ path: 'test-results/vac-ciclo-otra-vacuna-sin-fila.png', fullPage: true });
      return;
    }

    // select de vacuna (placeholder "Seleccione vacuna...") → primera opción real (índice 1)
    const selVacuna = page.locator('select').filter({ hasText: 'Seleccione vacuna' }).first();
    if (await selVacuna.isVisible({ timeout: 3000 }).catch(() => false)) {
      const opciones = await selVacuna.locator('option').count();
      if (opciones > 1) {
        await selVacuna.selectOption({ index: 1 }).catch(() => {});
        await page.waitForTimeout(1000);
      } else {
        note('El select de vacuna en "Otra vacuna" no tiene opciones reales (solo placeholder)');
      }
    } else {
      note('No apareció el select de vacuna tras "Vacuna diferente"');
    }

    // select de dosis (placeholder "Seleccione dosis") → primera opción real si existe
    const selDosis = page.locator('select').filter({ hasText: 'Seleccione dosis' }).first();
    if (await selDosis.isVisible({ timeout: 2000 }).catch(() => false)) {
      const opcionesDosis = await selDosis.locator('option').count();
      if (opcionesDosis > 1) await selDosis.selectOption({ index: 1 }).catch(() => {});
      else note('El select de dosis no tiene opciones reales (solo placeholder)');
    }

    const fecha = page.locator('input[placeholder="Fecha"]').first();
    if (await fecha.isVisible().catch(() => false)) await fecha.fill(ISO_DATE).catch(() => {});
    const folio = page.locator('input[placeholder="Folio"]').first();
    if (await folio.isVisible().catch(() => false)) await folio.fill('98765').catch(() => {});
    const com = page.locator('textarea[placeholder="Comentarios"]').first();
    if (await com.isVisible().catch(() => false)) await com.fill('Otra vacuna por prueba automatizada').catch(() => {});

    const save = page.locator('button:has-text("Guardar cambios"):visible').first();
    if (await save.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expectVaccineSaveOk(page, async () => { await save.click().catch(() => {}); }, 'guardar otra vacuna');
      console.log('➕ Otra vacuna agregada y guardada');
    } else {
      note('No se encontró botón "Guardar cambios" para la fila de otra vacuna');
    }
  });

  await test.step('VERIFICAR que las dosis persisten (tras refrescar)', async () => {
    await goToVacunacion(page);
    const reg = await countRegistered(page);
    console.log(`✅ Tras refrescar → dosis registradas: ${reg} (esperado ${registradas})`);
    await page.screenshot({ path: 'test-results/vac-ciclo-02-registrado.png', fullPage: true });
    expect(reg, `Deberían persistir ${registradas} dosis registradas`).toBe(registradas);
  });

  // ── RESUMEN DE FAIL DETECTION ──────────────────────────────────────────────
  const result = monitor.printSummary();

  // Separar errores de consola reales vs. ruido externo (analytics/soporte).
  // Para requestfailed el texto útil está en e.url (failure solo dice "net::ERR_ABORTED").
  const isNoise = (e: any) => EXTERNAL_NOISE.test(`${e.text || ''} ${e.failure || ''} ${e.url || ''}`);
  const realErrors = result.errors.filter((e: any) => !isNoise(e));
  const noiseErrors = result.errors.filter((e: any) => isNoise(e));

  console.log('\n' + '─'.repeat(70));
  console.log('🔎  RESUMEN FAIL DETECTION (test de vacunación)');
  console.log('─'.repeat(70));
  console.log(`   Hallazgos blandos (log-and-continue): ${softFindings.length}`);
  softFindings.forEach((f, i) => console.log(`     [${i + 1}] ${f}`));
  console.log(`   Errores de consola REALES (no ruido):  ${realErrors.length}`);
  realErrors.forEach((e: any, i: number) => console.log(`     [${i + 1}] +${e.timestamp}s → ${(e.text || e.failure || '').substring(0, 120)}`));
  console.log(`   Ruido externo ignorado (GA/Zendesk/…): ${noiseErrors.length}`);
  console.log(`   API /vaccines/ fallidas (HARD):        ${vaccineApiFailures.length}`);
  vaccineApiFailures.forEach((f, i) => console.log(`     [${i + 1}] ${f}`));
  console.log('─'.repeat(70) + '\n');

  // HARD-FAIL final: ninguna API de vacunas debió fallar.
  expect(vaccineApiFailures, `Hubo ${vaccineApiFailures.length} llamada(s) a /vaccines/ con status >= 400 — bug de plataforma`).toEqual([]);
});
