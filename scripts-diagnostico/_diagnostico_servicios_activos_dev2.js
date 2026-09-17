// Diagnóstico read-only v2: navegar directo a /perfil/Servicios (como ya se
// confirmó que evita el modal de getProfile 500) y leer la respuesta REAL de
// getServices que dispara la propia página, para ver cuántos servicios están
// activos. Objetivo: decidir si "0 opciones" en el dropdown de la Consulta es
// dato de entorno (0 servicios activos) o un bug real de esa integración.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  const respPromise = page.waitForResponse(r => /\/api\/services\/getServices/.test(r.url()), { timeout: 15000 }).catch(() => null);
  await page.goto('https://admin-dev.mediplanner.mx/perfil/Servicios');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  const resp = await respPromise;
  if (!resp) {
    console.log('No se observó getServices');
  } else {
    const body = await resp.json().catch(() => null);
    const lista = body?.data || [];
    console.log('status:', resp.status(), 'total servicios:', lista.length);
    console.log('Muestra del primer servicio (campos disponibles):', JSON.stringify(lista[0]));
    const posiblesCamposActivo = ['activo', 'bActivo', 'iActivo', 'estatus', 'iEstatusId'];
    for (const campo of posiblesCamposActivo) {
      if (lista[0] && campo in lista[0]) {
        const activos = lista.filter(s => s[campo] === true || s[campo] === 1 || s[campo] === '1');
        console.log(`  usando campo "${campo}": ${activos.length}/${lista.length} activos`);
      }
    }
  }

  await browser.close();
})();
