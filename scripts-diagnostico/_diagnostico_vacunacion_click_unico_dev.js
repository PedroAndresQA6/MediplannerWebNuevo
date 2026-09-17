// Diagnóstico: la reauditoría de vacunacion.ciclo-completo, incluso DESPUÉS
// de corregir 2 selectores muertos (deleteDoseButtons y su waitForFunction),
// mostró 0 borrados reales tras 100 clics reales con espera de hasta 2s cada
// uno (el conteo de botones "Quitar fecha" nunca bajó de 32). Antes de
// reportarlo como bug de la app, confirmar en vivo, con UN solo clic
// observado paso a paso, qué pasa realmente: ¿aparece un diálogo de
// confirmación (nativo o SweetAlert2) que el test no está manejando?
// ¿dispara alguna request? ¿el <input type=date> se vacía?
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    console.log(`>>> DIALOG NATIVO detectado: type=${dialog.type()} message="${dialog.message()}"`);
    await dialog.dismiss().catch(() => {});
  });
  page.on('response', (r) => {
    if (r.url().includes('/api/vaccines/')) console.log(`>>> RESPONSE /api/vaccines/: ${r.status()} ${r.url()}`);
  });
  page.on('console', (m) => { if (m.type() === 'error') console.log('>>> CONSOLE ERROR:', m.text()); });

  await page.goto('https://admin-dev.mediplanner.mx/Pacientes');
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
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  const antes = await page.locator('table.table-compact button.btn-clear.text-danger').count();
  console.log('Botones "Quitar fecha" ANTES del clic:', antes);

  // Tomar el primero, ver su fila / input de fecha asociado ANTES.
  const btn = page.locator('table.table-compact button.btn-clear.text-danger').first();
  const fila = btn.locator('xpath=ancestor::tr[1]');
  const inputAntes = await fila.locator('input[type="date"]').first().inputValue().catch(() => '(no encontrado)');
  console.log('Valor del input de fecha de esa fila ANTES:', inputAntes);

  console.log('--- Clickeando UNA vez (sin force, para ver si Playwright detecta algo raro) ---');
  try {
    await btn.click({ timeout: 5000 });
    console.log('Click normal OK (sin timeout ni excepción)');
  } catch (e) {
    console.log('Click normal FALLÓ:', e.message.split('\n')[0]);
  }
  await page.waitForTimeout(2000);

  // Revisar si apareció algún modal SweetAlert2
  const swal = page.locator('.swal2-popup.swal2-show');
  const swalVisible = await swal.count().catch(() => 0);
  console.log('Modales SweetAlert2 visibles tras el clic:', swalVisible);
  if (swalVisible > 0) {
    const txt = await swal.first().textContent().catch(() => '');
    console.log('Texto del modal:', (txt || '').replace(/\s+/g, ' ').trim().substring(0, 200));
    await page.screenshot({ path: 'test-results/_diag-vacuna-modal-tras-click.png', fullPage: true });
  }

  const despues = await page.locator('table.table-compact button.btn-clear.text-danger').count();
  console.log('Botones "Quitar fecha" DESPUÉS del clic:', despues);
  const inputDespues = await fila.locator('input[type="date"]').first().inputValue().catch(() => '(fila ya no existe / no encontrado)');
  console.log('Valor del input de fecha de esa fila DESPUÉS:', inputDespues);

  await page.screenshot({ path: 'test-results/_diag-vacuna-tras-click-unico.png', fullPage: true });

  await browser.close();
})();
