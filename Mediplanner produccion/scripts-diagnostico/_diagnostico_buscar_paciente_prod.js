const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin.mediplanner.mx/' });
  const page = await context.newPage();
  await page.goto('/Pacientes');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);
  const buscar = page.getByPlaceholder(/buscar/i).first();
  await buscar.fill('Quijada');
  await page.waitForTimeout(2000);
  const texto = await page.locator('body').innerText();
  console.log(texto.substring(0, 2000));
  await page.screenshot({ path: 'test-results/recon-buscar-paciente-prod.png', fullPage: true }).catch(() => {});
  await browser.close();
})();
