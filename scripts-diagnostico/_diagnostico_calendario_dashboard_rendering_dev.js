// Diagnóstico puntual: tras corregir isVisible({timeout}) -> waitFor real en
// asegurarCalendarioDashboard() (e2e/citas/agenda.js), appointments-create
// mostró que td[data-day] no aparece dentro de 3x8s reales, dos corridas
// seguidas. Este script navega a /Dashboard con espera realista (no el
// patrón roto) y vuelca TODO lo relevante para decidir si es un hallazgo
// real de la app o un problema del selector/script.
const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  const t0 = Date.now();
  const log = (msg) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

  log('goto /Dashboard');
  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);

  const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
  if (await configurarMasTardeLink.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    log('Wizard de configuración detectado — clickeando "Configurar más tarde"');
    await configurarMasTardeLink.click({ force: true }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
  }
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await explorarLink.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    log('Onboarding detectado — clickeando "Prefiero explorar por mi cuenta"');
    await explorarLink.click({ force: true }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
  }

  // Ya confirmado en la corrida anterior (25s reales) que el primer
  // td[data-day] nunca se vuelve visible — acortado a 4s acá solo para
  // reconfirmar rápido, el foco de esta corrida es la hipótesis de abajo.
  log('Esperando (real, hasta 4s) a que td[data-day] aparezca...');
  const celda = page.locator('td[data-day]').first();
  let aparecio = false;
  try {
    await celda.waitFor({ state: 'visible', timeout: 4000 });
    aparecio = true;
    log('✅ td[data-day] SÍ apareció dentro de 4s');
  } catch (e) {
    log(`❌ td[data-day] NO apareció en 4s: ${e.message.split('\n')[0]}`);
  }

  // Hipótesis: el primer td[data-day] en orden del DOM es un duplicado
  // oculto (mismo patrón ya documentado para rdp-button_next en este mismo
  // repo). Probar con :visible para confirmar antes de proponer el fix.
  const celdaVisible = page.locator('td[data-day]:visible').first();
  let aparecioVisible = false;
  try {
    await celdaVisible.waitFor({ state: 'visible', timeout: 5000 });
    aparecioVisible = true;
    const dataDay = await celdaVisible.getAttribute('data-day').catch(() => '?');
    log(`✅ td[data-day]:visible SÍ apareció en <5s (data-day="${dataDay}")`);
  } catch (e) {
    log(`❌ td[data-day]:visible tampoco apareció en 5s: ${e.message.split('\n')[0]}`);
  }
  const primerDataDay = await page.locator('td[data-day]').first().getAttribute('data-day').catch(() => '?');
  log(`data-day del primer td[data-day] (el que nunca se vuelve visible): "${primerDataDay}"`);

  // Volcar TODO lo relevante, aparezca o no, para no mirar solo lo esperado.
  const tdDataDayCount = await page.locator('td[data-day]').count();
  const tdTotalCount = await page.locator('td').count();
  const rdpCount = await page.locator('[class*="rdp"]').count();
  const cargandoVisible = await page.locator('text=/cargando/i').first().isVisible().catch(() => false);
  log(`td[data-day] count: ${tdDataDayCount} | td total: ${tdTotalCount} | elementos [class*="rdp"]: ${rdpCount} | texto "Cargando" visible: ${cargandoVisible}`);

  const bodyText = await page.locator('body').innerText().catch(() => 'NO SE PUDO LEER');
  console.log('\n=== body.innerText (primeros 2000 chars) ===');
  console.log(bodyText.substring(0, 2000));

  await page.screenshot({ path: 'test-results/diagnostico-calendario-dashboard.png', fullPage: true }).catch(() => {});
  log(`Screenshot: test-results/diagnostico-calendario-dashboard.png (aparecio=${aparecio})`);

  await page.waitForTimeout(1500);
  await browser.close();
})();
