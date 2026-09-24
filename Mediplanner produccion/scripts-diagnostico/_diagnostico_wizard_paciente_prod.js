const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin.mediplanner.mx/' });
  const page = await context.newPage();

  page.on('response', async (r) => {
    if (/patient|paciente/i.test(r.url()) && r.url().includes('/api/')) {
      console.log(`${r.status()} ${r.url()}`);
    }
  });

  await page.goto('/Citas');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /agendar cita/i }).first().click();
  await page.waitForTimeout(1500);

  const wizardHeading = page.getByRole('heading', { name: 'Agendar cita' });
  await wizardHeading.waitFor({ state: 'visible', timeout: 10000 });
  const combo = page.getByRole('combobox').first();
  await combo.click();
  await page.waitForTimeout(1000);
  console.log('--- Sin escribir nada, opciones visibles ---');
  const opts0 = page.locator('[role="option"], [class*="option"]:visible');
  console.log('count:', await opts0.count());
  for (let i = 0; i < Math.min(await opts0.count(), 15); i++) {
    console.log('  ', (await opts0.nth(i).textContent().catch(() => '') || '').trim());
  }

  await page.screenshot({ path: 'test-results/recon-wizard-sin-buscar.png', fullPage: true }).catch(() => {});

  console.log('\n--- Escribiendo "codigo" ---');
  await combo.fill('codigo');
  await page.waitForTimeout(2500);
  const opts1 = page.locator('[role="option"], [class*="option"]:visible');
  console.log('count:', await opts1.count());
  for (let i = 0; i < Math.min(await opts1.count(), 15); i++) {
    console.log('  ', (await opts1.nth(i).textContent().catch(() => '') || '').trim());
  }
  const bodyText = await page.locator('body').innerText();
  const idx = bodyText.toLowerCase().indexOf('no se enc');
  if (idx >= 0) console.log('Texto "no se encontraron" presente:', bodyText.substring(idx, idx + 60));

  await page.screenshot({ path: 'test-results/recon-wizard-buscando-codigo.png', fullPage: true }).catch(() => {});

  await browser.close();
})();
