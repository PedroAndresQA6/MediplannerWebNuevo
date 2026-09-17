// Diagnóstico puntual: system-health.spec.ts falla por 2 console errors de CSP
// bloqueando Microsoft Clarity. Este script no se detiene en el primer assert
// (a diferencia del spec oficial) para ver el panorama completo: TODOS los
// console errors y TODOS los requests con status >=400 en una carga normal
// de /dashboard, para saber si el CSP roto es lo único raro o hay más.
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

  const consoleErrors = [];
  const consoleWarnings = [];
  const failedRequests = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) failedRequests.push(`${response.status()} - ${response.url()}`);
  });
  page.on('requestfailed', request => {
    failedRequests.push(`FAILED(${request.failure()?.errorText}) - ${request.url()}`);
  });
  page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`));

  console.log('→ Navegando a /dashboard (lowercase, tal cual usa tests/system-health.spec.ts)...');
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => console.log('  (networkidle no se cumplió en 20s, sigo igual)'));
  await page.waitForTimeout(2000);

  const content = await page.content();
  console.log('\n=== RESULTADO /dashboard ===');
  console.log('URL final:', page.url());
  console.log('consoleErrors:', consoleErrors.length);
  consoleErrors.forEach((e, i) => console.log(`  [${i}] ${e.substring(0, 300)}`));
  console.log('consoleWarnings:', consoleWarnings.length);
  consoleWarnings.forEach((w, i) => console.log(`  [${i}] ${w.substring(0, 200)}`));
  console.log('failedRequests:', failedRequests.length);
  failedRequests.forEach((f, i) => console.log(`  [${i}] ${f}`));
  console.log('content contiene "undefined":', content.includes('undefined'));
  console.log('content contiene "NaN":', content.includes('NaN'));
  console.log('content contiene "null":', content.includes('null'));

  await browser.close();
})();
