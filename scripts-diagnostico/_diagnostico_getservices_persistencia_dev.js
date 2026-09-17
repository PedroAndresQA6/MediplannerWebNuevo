// Diagnóstico: ¿sigue vigente el bug de agosto (saveService 200 pero el servicio
// nunca aparece en getServices)? Navega DIRECTO a /perfil/Servicios (evita el
// modal bloqueante de getProfile 500 que aparece si se pasa por /perfil/Usuario)
// y repite el flujo de creación de servicio.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  const NOMBRE = `QA_REPRO3_REAUDIT_${Date.now()}`;

  await page.goto('https://admin-dev.mediplanner.mx/perfil/Servicios');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());

  await page.locator('button:has-text("Nuevo Tipo"), a:has-text("Nuevo Tipo")').first().click();
  await page.waitForTimeout(1000);
  await page.locator('input[name="nombre_servicio"]').fill(NOMBRE);
  const duracionSelect = page.locator('select[name="duracion_servicio"]');
  if (await duracionSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await duracionSelect.selectOption({ index: 1 }).catch(() => {});
  }
  const activoCheckbox = page.locator('input[name="activo"]');
  if (await activoCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
    if (await activoCheckbox.isChecked()) await activoCheckbox.click();
  }

  const respPromise = page.waitForResponse(r => /\/api\/services\//.test(r.url()) && r.request().method() !== 'GET', { timeout: 10000 }).catch(() => null);
  await page.locator('button:has-text("Guardar")').first().click();
  const resp = await respPromise;
  if (resp) {
    const body = await resp.json().catch(() => null);
    console.log('saveService status:', resp.status(), 'body:', JSON.stringify(body));
  } else {
    console.log('No se observó respuesta de guardado');
  }
  await page.waitForTimeout(1500);

  // Releer la lista fresca
  const respList = page.waitForResponse(r => /\/api\/services\/getServices/.test(r.url()), { timeout: 15000 }).catch(() => null);
  await page.goto('https://admin-dev.mediplanner.mx/perfil/Servicios');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  const listResp = await respList;
  if (listResp) {
    const body = await listResp.json().catch(() => null);
    const lista = body?.data || [];
    const encontrado = lista.some(s => s?.nombre === NOMBRE);
    console.log(`Servicio "${NOMBRE}" encontrado en getServices tras recargar: ${encontrado}`);
    console.log('Total servicios en la lista:', lista.length);
    console.log('Nombres:', lista.map(s => s.nombre).join(' | '));
  } else {
    console.log('No se observó respuesta de getServices al recargar');
  }

  await browser.close();
})();
