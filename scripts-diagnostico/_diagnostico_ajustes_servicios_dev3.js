// Diagnóstico 3: ¿el 500 de getProfile pasa siempre al entrar a /perfil/* (cualquier
// subpestaña), o es específico de aterrizar en /perfil/Usuario? Navegar DIRECTO a
// /perfil/Servicios por URL (sin pasar por el tab "Perfil" primero) y ver si carga bien.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  page.on('response', r => { if (r.url().includes('/api/profile/getProfile')) console.log('getProfile ->', r.status()); });
  page.on('console', m => { if (m.type() === 'error' && m.text().includes('roles')) console.log('CONSOLE:', m.text()); });

  console.log('Navegando DIRECTO a /perfil/Servicios...');
  await page.goto('https://admin-dev.mediplanner.mx/perfil/Servicios');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);
  console.log('URL final:', page.url());
  const swalCount = await page.locator('.swal2-popup.swal2-modal:visible').count();
  console.log('Modales de error visibles:', swalCount);
  await page.screenshot({ path: 'test-results/_diag3-directo-servicios.png', fullPage: true });

  await browser.close();
})();
