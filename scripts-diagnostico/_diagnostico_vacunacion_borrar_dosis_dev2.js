// Diagnóstico 2: identificar el ícono/atributos del botón de borrar dosis
// (clase real: "btn btn-icon btn-sm btn-clear text-danger") para armar un
// selector nuevo que lo distinga del botón "Editar" (btn-light, ícono pencil).
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
  const info = await table.evaluate(t => {
    const rows = Array.from(t.querySelectorAll('tr'));
    const row = rows.find(r => r.querySelector('input[type="date"]')?.value);
    if (!row) return null;
    return Array.from(row.querySelectorAll('button.btn-clear.text-danger')).map(b => b.outerHTML);
  });
  console.log('Botones btn-clear.text-danger en la fila:', JSON.stringify(info, null, 2));

  const newSelectorCount = await page.locator('table.table-compact button.btn-clear.text-danger').count();
  console.log('\nConteo con selector nuevo (table.table-compact button.btn-clear.text-danger):', newSelectorCount);
  const totalFilled = await table.evaluate(t => Array.from(t.querySelectorAll('input[type="date"]')).filter(d => d.value).length);
  console.log('Dosis registradas (con fecha):', totalFilled);

  await browser.close();
})();
