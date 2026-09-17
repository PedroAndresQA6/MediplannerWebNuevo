// Diagnóstico: ¿getProfile devuelve 500 de forma persistente o intermitente?
// Y: ¿qué dice exactamente el modal de error SweetAlert2 que tapa "Servicios"?
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  await page.goto('https://admin-dev.mediplanner.mx/Dashboard');
  await page.waitForTimeout(2000);

  console.log('── Golpeando getProfile directamente 5 veces ──');
  for (let i = 0; i < 5; i++) {
    const resp = await page.request.get('https://admin-dev.mediplanner.mx/api/profile/getProfile');
    const body = await resp.text().catch(() => '');
    console.log(`  intento ${i + 1}: status=${resp.status()} body=${body.substring(0, 150)}`);
    await page.waitForTimeout(1000);
  }

  console.log('\n── Navegando a Ajustes y capturando el texto del modal de error ──');
  await page.locator('a:has-text("Ajustes")').first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const swal = page.locator('.swal2-popup.swal2-modal:visible').first();
  if (await swal.count() > 0) {
    const title = await swal.locator('#swal2-title, .swal2-title').textContent().catch(() => '');
    const body = await swal.locator('#swal2-html-container, .swal2-html-container').textContent().catch(() => '');
    console.log('Modal título:', title?.trim());
    console.log('Modal body:', body?.trim());
    await page.screenshot({ path: 'test-results/_diag-swal-error-ajustes.png', fullPage: true });
  } else {
    console.log('No apareció ningún modal swal2 esta vez.');
  }
  console.log('URL final:', page.url());

  await browser.close();
})();
