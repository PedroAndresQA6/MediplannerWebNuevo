const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin.mediplanner.mx/' });
  const page = await context.newPage();

  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/recon-dashboard-prod.png', fullPage: true }).catch(() => {});
  console.log('Dashboard URL:', page.url());
  console.log('Dashboard texto (primeros 800):', (await page.locator('body').innerText()).substring(0, 800));

  await page.goto('/Citas');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('\nCitas URL:', page.url());
  console.log('Citas texto (primeros 1500):', (await page.locator('body').innerText()).substring(0, 1500));
  await page.screenshot({ path: 'test-results/recon-citas-prod.png', fullPage: true }).catch(() => {});

  await browser.close();
})();
