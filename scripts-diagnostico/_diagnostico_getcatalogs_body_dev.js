const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', baseURL: 'https://admin-dev.mediplanner.mx/' });
  const page = await context.newPage();
  const bodies = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/catalogs/getCatalogs')) {
      bodies.push(await r.text().catch(() => null));
    }
  });
  await page.goto('/Dashboard');
  await page.waitForTimeout(4000);
  bodies.forEach((b, i) => {
    console.log(`\n=== getCatalogs response #${i + 1} ===`);
    console.log(b);
  });
  if (bodies.length === 0) console.log('NO SE CAPTURO ninguna getCatalogs');
  await browser.close();
})();
