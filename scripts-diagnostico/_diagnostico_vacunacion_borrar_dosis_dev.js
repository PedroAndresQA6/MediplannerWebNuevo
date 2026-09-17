// Diagnóstico: vacunacion.ciclo-completo.spec.ts reportó "Dosis iniciales: 0"
// para deleteDoseButtons (TABLE button.btn-secondary con texto "×"), pese a
// que 33 dosis tenían fecha. ¿El selector del botón de borrar sigue siendo
// correcto, o cambió el markup?
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
  console.log('table.table-compact count:', await table.count());
  const dateInputs = table.locator('input[type="date"]');
  console.log('input[type=date] dentro de la tabla:', await dateInputs.count());
  const filledDates = await table.evaluate(t => Array.from(t.querySelectorAll('input[type="date"]')).filter(d => d.value).length);
  console.log('con valor (registradas):', filledDates);

  // Inspeccionar la fila de la primera dosis con fecha para ver sus botones reales.
  const firstFilled = await table.evaluateHandle(t => Array.from(t.querySelectorAll('input[type="date"]')).find(d => d.value));
  if (firstFilled) {
    const rowHtml = await firstFilled.evaluate(el => {
      const row = el.closest('tr');
      return row ? row.outerHTML.substring(0, 1500) : '(sin <tr> ancestro)';
    });
    console.log('\nHTML de la fila de la primera dosis registrada:\n', rowHtml);
  }

  // Contar botones btn-secondary con texto '×' en toda la tabla
  const xButtons = table.locator('button.btn-secondary').filter({ hasText: '×' });
  console.log('\nbutton.btn-secondary con texto "×":', await xButtons.count());

  // Contar TODOS los botones dentro de la tabla, con su texto/clase, para la primer fila con fecha.
  const allButtonsInfo = await table.evaluate(t => {
    const rows = Array.from(t.querySelectorAll('tr'));
    const row = rows.find(r => r.querySelector('input[type="date"]')?.value);
    if (!row) return null;
    return Array.from(row.querySelectorAll('button')).map(b => ({ text: b.textContent.trim(), cls: b.className }));
  });
  console.log('\nBotones en la fila con fecha:', JSON.stringify(allButtonsInfo, null, 2));

  await page.screenshot({ path: 'test-results/_diag-vacunacion-fila.png', fullPage: true });
  await browser.close();
})();
