// Diagnóstico: clickear UNA vez el botón trash ("Quitar fecha") de una dosis
// y ver qué pasa exactamente (¿aparece un modal de confirmación? ¿se limpia
// la fecha? ¿el botón desaparece?).
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx' });
  const page = await context.newPage();

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('span.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const pageSize = page.locator('select').first();
  if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.locator('span.font-semibold.text-sm.text-gray-900', { hasText: 'Agustin Tapia' }).first().click();
  await page.waitForTimeout(3000);
  await page.getByText(/^\s*Vacunación\s*$/i).first().click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  const table = page.locator('table.table-compact');
  const trashBtns = table.locator('button.btn-clear.text-danger');
  const before = await trashBtns.count();
  console.log('Trash buttons antes:', before);

  const first = trashBtns.first();
  await first.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/_diag-trash-before-click.png' });
  console.log('Clickeando el primer botón trash...');
  await first.click();
  await page.waitForTimeout(1500);

  const swal = page.locator('.swal2-popup:visible');
  const hasSwal = await swal.count();
  console.log('Modal SweetAlert2 visible tras click:', hasSwal);
  if (hasSwal > 0) {
    const txt = await swal.first().textContent();
    console.log('Texto del modal:', txt?.replace(/\s+/g, ' ').trim().substring(0, 300));
  }
  await page.screenshot({ path: 'test-results/_diag-trash-after-click.png', fullPage: false });

  const after = await trashBtns.count();
  console.log('Trash buttons después del click (sin confirmar nada más):', after);

  await browser.close();
})();
