import { test, expect, Page } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────────
// Test del módulo "Recetas" del paciente (tab del perfil). UI master-detail:
//   - IZQUIERDA: lista paginada de medicamentos recetados (nombre + fecha), con
//     "← Anterior / Siguiente →" y un contador "1-N de TOTAL".
//   - DERECHA:   panel de detalle; muestra "Sin receta seleccionada" hasta que se
//     hace clic en un medicamento de la lista.
//   - API: treatments/getTreatmentsList carga la lista.
// (Mapeado 2026-06-23 con recetas.explorar.spec.ts, paciente Agustin Tapia.)
//
// FAIL DETECTION (severidad MIXTA):
//   HARD-FAIL → tab no abre; getTreatmentsList con status >= 400; al seleccionar un
//               medicamento el detalle no cambia (sigue "Sin receta seleccionada").
//   LOG-CONT. → errores de consola/JS, ruido externo (GA/Zendesk/Clarity).
// ─────────────────────────────────────────────────────────────────────────────

const PATIENT = 'Agustin Tapia';
const EXTERNAL_NOISE = /google-analytics|googletagmanager|zendesk|clarity\.ms|doubleclick|hotjar|facebook|sentry/i;

async function goToPaciente(page: Page): Promise<void> {
  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  // Esperar la respuesta de getPatients (el dev a veces tarda) y luego el render de la lista.
  await page.waitForResponse(r => /\/api\/patients\/getPatients/.test(r.url()) && r.status() === 200, { timeout: 40000 }).catch(() => null);
  await page.waitForSelector('span.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const pageSize = page.locator('select').first();
  if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.locator('span.font-semibold.text-sm.text-gray-900', { hasText: PATIENT }).first().click();
  await page.waitForTimeout(3000);
}

test('Recetas: abrir tab, cargar lista, paginar y ver detalle de un medicamento', async ({ page }) => {
  test.setTimeout(180000);
  const monitor = setupConsoleMonitor(page);

  // HARD: registrar fallos de la API que sostiene Recetas.
  const recetasApiFailures: string[] = [];
  page.on('response', (res) => {
    if (/\/api\/treatments\/getTreatmentsList/.test(res.url()) && res.status() >= 400) {
      recetasApiFailures.push(`${res.status()} ${res.url().split('/api/')[1]}`);
    }
  });

  await test.step(`Ir al perfil de ${PATIENT}`, async () => {
    await goToPaciente(page);
  });

  await test.step('Abrir tab "Recetas" y validar carga (getTreatmentsList 200)', async () => {
    const tab = page.locator('button:has-text("Recetas"), a:has-text("Recetas")').first();
    expect(await tab.isVisible({ timeout: 5000 }).catch(() => false), 'El tab "Recetas" debe estar visible').toBe(true);
    // HARD: el tab debe disparar getTreatmentsList con 200.
    const respPromise = page.waitForResponse(
      r => /\/api\/treatments\/getTreatmentsList/.test(r.url()) && r.request().method() !== 'GET',
      { timeout: 15000 }
    ).catch(() => null);
    await tab.click();
    await page.waitForTimeout(2500);
    const resp = await respPromise;
    if (resp) {
      expect(resp.status(), 'getTreatmentsList debe responder 2xx').toBeLessThan(400);
    } else {
      console.log('   ⚠️ No se observó getTreatmentsList (puede venir cacheado del perfil)');
    }
    await page.screenshot({ path: 'test-results/recetas-01-lista.png', fullPage: true });
  });

  // La lista de recetas: cada item es un medicamento con su fecha. El panel de detalle
  // arranca en "Sin receta seleccionada".
  let totalRecetas = 0;
  await test.step('Verificar lista de recetas + contador "N de TOTAL"', async () => {
    // El contador de paginación tiene forma "1-10 de 70".
    const contador = page.locator('text=/\\d+\\s*-\\s*\\d+\\s+de\\s+\\d+/').first();
    if (await contador.isVisible({ timeout: 3000 }).catch(() => false)) {
      const txt = (await contador.textContent().catch(() => '') || '').trim();
      const m = txt.match(/de\s+(\d+)/i);
      totalRecetas = m ? parseInt(m[1], 10) : 0;
      console.log(`💊 Contador de recetas: "${txt}" → total=${totalRecetas}`);
    } else {
      console.log('   ⚠️ No se encontró contador de paginación (¿paciente sin recetas?)');
    }

    // Detalle inicial: debe indicar que no hay receta seleccionada.
    const detalleVacio = page.locator('text=/Sin receta seleccionada|Seleccione un medicamento/i').first();
    const hayDetalleVacio = await detalleVacio.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`📄 Panel de detalle inicial muestra estado vacío: ${hayDetalleVacio}`);
  });

  await test.step('Seleccionar un medicamento → el detalle deja de estar vacío', async () => {
    // Cada receta de la lista es un item con nombre + fecha (dd/mm/yyyy). Tomamos el primero.
    const items = page.locator('div', { hasText: /\d{2}\/\d{2}\/\d{4}/ });
    // Más robusto: localizar items clicables de la columna izquierda por su fecha.
    const fechaItems = page.locator(':is(div,li,tr):has(text=/\\d{2}\\/\\d{2}\\/\\d{4}/)');
    const candidato = page.locator('text=/\\d{2}\\/\\d{2}\\/\\d{4}/').first();

    if (!(await candidato.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log('   ⚠️ Paciente sin recetas en la lista — no hay medicamento que seleccionar');
      return;
    }

    // Clic en el contenedor de la primera receta (subimos del texto de fecha a su fila clicable).
    const primeraReceta = candidato.locator('xpath=ancestor::*[self::div or self::li or self::tr][1]');
    await primeraReceta.scrollIntoViewIfNeeded().catch(() => {});
    await primeraReceta.click().catch(async () => { await candidato.click().catch(() => {}); });
    await page.waitForTimeout(2000);

    // HARD: tras seleccionar, el panel ya no debe decir "Sin receta seleccionada".
    const sigueVacio = await page.locator('text=/Sin receta seleccionada/i').first().isVisible({ timeout: 1500 }).catch(() => false);
    await page.screenshot({ path: 'test-results/recetas-02-detalle.png', fullPage: true });
    expect(sigueVacio, 'Tras seleccionar un medicamento, el detalle no debe seguir en "Sin receta seleccionada"').toBe(false);
    console.log('✅ Detalle de la receta se cargó tras seleccionar el medicamento');
  });

  await test.step('Paginación: "Siguiente →" avanza la lista (si hay >1 página)', async () => {
    const siguiente = page.locator('button:has-text("Siguiente")').first();
    if (!(await siguiente.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log('   ⚠️ Sin botón "Siguiente" (lista de una sola página)');
      return;
    }
    const disabled = await siguiente.isDisabled().catch(() => true);
    if (disabled) {
      console.log('   "Siguiente" deshabilitado (única página)');
      return;
    }
    const antes = (await page.locator('text=/\\d+\\s*-\\s*\\d+\\s+de\\s+\\d+/').first().textContent().catch(() => '') || '').trim();
    await siguiente.click().catch(() => {});
    await page.waitForTimeout(2000);
    const despues = (await page.locator('text=/\\d+\\s*-\\s*\\d+\\s+de\\s+\\d+/').first().textContent().catch(() => '') || '').trim();
    console.log(`📃 Paginación: "${antes}" → "${despues}"`);
    // HARD: el rango mostrado debe cambiar al avanzar de página.
    expect(despues, 'El contador de paginación debe cambiar al pulsar "Siguiente"').not.toBe(antes);
  });

  // ── RESUMEN FAIL DETECTION ─────────────────────────────────────────────────
  const result = monitor.printSummary();
  const isNoise = (e: any) => EXTERNAL_NOISE.test(`${e.text || ''} ${e.failure || ''} ${e.url || ''}`);
  const realErrors = result.errors.filter((e: any) => !isNoise(e));
  console.log('\n' + '─'.repeat(70));
  console.log('🔎  RESUMEN FAIL DETECTION (Recetas)');
  console.log('─'.repeat(70));
  console.log(`   Total recetas del paciente:       ${totalRecetas}`);
  console.log(`   Errores de consola REALES:        ${realErrors.length}`);
  realErrors.forEach((e: any, i: number) => console.log(`     [${i + 1}] +${e.timestamp}s → ${(e.text || e.failure || '').substring(0, 120)}`));
  console.log(`   API getTreatmentsList fallidas:   ${recetasApiFailures.length}`);
  recetasApiFailures.forEach((f, i) => console.log(`     [${i + 1}] ${f}`));
  console.log('─'.repeat(70) + '\n');

  expect(recetasApiFailures, `getTreatmentsList falló ${recetasApiFailures.length} vez(es) — bug de plataforma`).toEqual([]);
});
