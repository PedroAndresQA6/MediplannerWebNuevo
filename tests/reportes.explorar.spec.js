const { test, expect } = require('@playwright/test');
const { setupConsoleMonitor } = require('../e2e/utils.js');

// Exploratorio: mapear a fondo /reportes/reporteFacturas (nuevo, sin cobertura)
// para poder escribir reportes.spec.ts con selectores reales.
test('MAPEAR Reportes a fondo (filtros, selects, Top 10, Ver todos)', async ({ page }) => {
  test.setTimeout(120000);
  const monitor = setupConsoleMonitor(page);

  await page.goto('/Dashboard');
  await page.waitForTimeout(2000);
  await page.locator('a:has-text("Reportes"), button:has-text("Reportes")').first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(3000);
  console.log(`URL: ${page.url()}`);
  await page.screenshot({ path: 'test-results/reportes-01-inicial.png', fullPage: true });

  console.log('\n===== SELECTS (consultorio, estatus, rango de fechas) =====');
  const selects = page.locator('select');
  const sc = await selects.count();
  for (let i = 0; i < sc; i++) {
    const sel = selects.nth(i);
    if (!(await sel.isVisible().catch(() => false))) continue;
    const options = await sel.locator('option').allTextContents();
    console.log(`  select[${i}] opciones: ${JSON.stringify(options)}`);
  }

  console.log('\n===== INPUT DE BÚSQUEDA POR PACIENTE =====');
  const search = page.locator('input[placeholder*="paciente" i], input[placeholder*="Busca" i]').first();
  console.log(`  Encontrado: ${await search.count() > 0}`);
  if (await search.count() > 0) {
    console.log(`  placeholder="${await search.getAttribute('placeholder').catch(() => '')}"`);
  }

  console.log('\n===== TOP 10 DIAGNÓSTICOS: filas =====');
  const diagCard = page.locator(':text("Top 10 Diagnósticos")').first().locator('xpath=ancestor::*[self::div][2]');
  const diagText = (await diagCard.textContent().catch(() => '') || '').trim();
  console.log(`  Contenido: "${diagText.substring(0, 300)}"`);

  console.log('\n===== TOP 10 MEDICAMENTOS: filas =====');
  const medCard = page.locator(':text("Top 10 Medicamentos")').first().locator('xpath=ancestor::*[self::div][2]');
  const medText = (await medCard.textContent().catch(() => '') || '').trim();
  console.log(`  Contenido: "${medText.substring(0, 300)}"`);

  console.log('\n===== INGRESOS RECIENTES: tabla/lista =====');
  const ingresosCard = page.locator(':text("Ingresos recientes")').first().locator('xpath=ancestor::*[self::div][2]');
  const ingresosText = (await ingresosCard.textContent().catch(() => '') || '').trim();
  console.log(`  Contenido: "${ingresosText.substring(0, 400)}"`);
  const verTodos = page.locator('a:has-text("Ver todos"), button:has-text("Ver todos")').first();
  console.log(`  "Ver todos" presente: ${await verTodos.count() > 0}`);

  console.log('\n===== SERVICIOS (card) =====');
  const serviciosCard = page.locator(':text("Servicios")').last().locator('xpath=ancestor::*[self::div][2]');
  const serviciosText = (await serviciosCard.textContent().catch(() => '') || '').trim();
  console.log(`  Contenido: "${serviciosText.substring(0, 300)}"`);

  // Probar cambiar el filtro de rango de fechas y ver si dispara una llamada nueva
  console.log('\n===== INTERACCIÓN: cambiar rango de fechas =====');
  const rangoSelect = page.locator('select', { hasText: /días|mes/i }).first();
  const rangoSelectAlt = selects.filter({ hasText: /Últimos/i }).first();
  const target = (await rangoSelectAlt.count()) > 0 ? rangoSelectAlt : rangoSelect;
  if (await target.count() > 0) {
    const respPromise = page.waitForResponse(r => r.url().includes('/api/') && r.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
    await target.selectOption({ index: 1 }).catch(() => {});
    const resp = await respPromise;
    console.log(`  Tras cambiar rango: nueva llamada API = ${resp ? resp.url() : 'ninguna detectada'}`);
    await page.waitForTimeout(1500);
  } else {
    console.log('  No se encontró el select de rango de fechas');
  }
  await page.screenshot({ path: 'test-results/reportes-02-tras-filtro.png', fullPage: true });

  console.log('\n===== "Ver todos" → click y ver a dónde lleva =====');
  if (await verTodos.count() > 0) {
    await verTodos.click().catch(() => {});
    await page.waitForTimeout(2000);
    console.log(`  URL tras click: ${page.url()}`);
    await page.screenshot({ path: 'test-results/reportes-03-ver-todos.png', fullPage: true });
  }

  const result = monitor.printSummary ? monitor.printSummary() : null;
  console.log('\n✅ Exploración de Reportes completada.');
});
