// Diagnóstico: reproducir el flujo de irAServicios() de ajustes.servicios.spec.ts
// para ver por qué termina en /perfil/Usuario en vez de /perfil/Servicios.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  await page.goto('https://admin-dev.mediplanner.mx/Dashboard');
  await page.waitForTimeout(2000);

  await page.locator('a:has-text("Ajustes")').first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log('URL tras click en Ajustes (sidebar):', page.url());

  // Contar todos los elementos con texto exacto "Servicios"
  const matches = await page.getByText('Servicios', { exact: true }).all();
  console.log(`Elementos con texto exacto "Servicios": ${matches.length}`);
  for (let i = 0; i < matches.length; i++) {
    const el = matches[i];
    const visible = await el.isVisible().catch(() => false);
    const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '?');
    const cls = await el.getAttribute('class').catch(() => '');
    const box = await el.boundingBox().catch(() => null);
    console.log(`  [${i}] tag=${tag} visible=${visible} class="${cls}" box=${JSON.stringify(box)}`);
  }

  console.log('\nClickeando el primero (force)...');
  await page.getByText('Servicios', { exact: true }).first().click({ force: true, timeout: 20000 });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL tras click en "Servicios":', page.url());

  await page.screenshot({ path: 'test-results/_diag-ajustes-servicios-tras-click.png', fullPage: true });

  await browser.close();
})();
