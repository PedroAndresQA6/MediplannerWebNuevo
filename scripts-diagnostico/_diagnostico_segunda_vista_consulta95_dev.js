// Diagnóstico read-only, per CLAUDE.md §0.3: revisar la MISMA información
// (consulta_id=95, paciente "Percentil Prueba Prueba", recién finalizada en
// el run3 de la reauditoría de doctor-consultation) desde la SEGUNDA vista:
// perfil del paciente → pestaña "Consultas" → seleccionar la consulta → ver
// consulta completa. Objetivo: (a) ver si motivo/padecimiento/notas_evolucion/
// nombre_referido/apariencia (que getConsultation devolvió en blanco) se ven
// distinto acá, (b) inspeccionar el heading real de "Exploración segmentaria"
// (nivel/rol) para confirmar si el selector `getByRole('heading', {level:3})`
// de sectionContainer() sigue siendo válido.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  await page.goto('https://admin-dev.mediplanner.mx/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('span.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);
  await page.locator('span.font-semibold.text-sm.text-gray-900', { hasText: 'Percentil' }).first().click();
  await page.waitForTimeout(3000);

  await page.getByText(/^\s*Consultas\s*$/i).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/_diag-consultas-tab.png', fullPage: true });

  // Buscar la fila/tarjeta de la consulta 95 (la más reciente debería ser esta).
  const filas = page.locator('text=/Terminada/i');
  const n = await filas.count();
  console.log('Filas con estatus "Terminada" visibles:', n);
  if (n > 0) {
    await filas.first().click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'test-results/_diag-consulta-preliminar.png', fullPage: true });

  // Buscar botón "Ver consulta completa" (o similar)
  const verCompleta = page.locator('button:has-text("Ver consulta"), a:has-text("Ver consulta")').first();
  if (await verCompleta.isVisible({ timeout: 4000 }).catch(() => false)) {
    await verCompleta.click();
    await page.waitForTimeout(3000);
    console.log('Click en "Ver consulta completa" hecho.');
  } else {
    console.log('No se encontró botón "Ver consulta completa" — puede que ya se esté viendo completa, o el nombre del botón es otro.');
  }
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/_diag-consulta-completa-vista2.png', fullPage: true });

  // Texto completo de la página, para revisar manualmente motivo/padecimiento/etc.
  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log('\n--- BODY TEXT (primeros 3000 chars) ---');
  console.log(bodyText.substring(0, 3000));

  // Inspección de headings nivel 3 (para sectionContainer)
  const h3s = await page.locator('h3').allTextContents().catch(() => []);
  console.log('\n--- <h3> encontrados en la página ---');
  console.log(JSON.stringify(h3s));
  // Roles heading en general vía accesibilidad
  const headingsRole = await page.getByRole('heading').allTextContents().catch(() => []);
  console.log('\n--- role=heading (cualquier nivel) ---');
  console.log(JSON.stringify(headingsRole));

  await browser.close();
})();
