// Hallazgo 2 (dev): getProfile responde 500 el 100% de las veces (83/83 hoy).
// Pedro pidio confirmar si el mismo problema reproduce en STAGING. Se navega
// al Dashboard y se cuentan status de getProfile en varias pantallas (no solo
// una), igual que se hizo en dev.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-staging.mediplanner.mx/' });
  const page = await context.newPage();

  const resultados = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/profile/getProfile')) {
      const body = await r.text().catch(() => '(no se pudo leer)');
      resultados.push({ status: r.status(), body: body.substring(0, 200) });
      console.log(`getProfile → ${r.status()} ${body.substring(0, 150)}`);
    }
  });

  console.log('Navegando a Dashboard...');
  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);

  console.log('Navegando a Pacientes...');
  await page.goto('/Pacientes');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);

  console.log('Recargando Dashboard...');
  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);

  console.log('Navegando a Ajustes (perfil)...');
  const ajustesLink = page.locator('a:has-text("Ajustes")').first();
  if (await ajustesLink.isVisible().catch(() => false)) {
    await ajustesLink.click();
    await page.waitForTimeout(3000);
  }

  const total = resultados.length;
  const exitosas = resultados.filter(r => r.status === 200).length;
  const fallidas = resultados.filter(r => r.status >= 400).length;
  console.log(`\n=== RESUMEN getProfile en STAGING ===`);
  console.log(`Total llamadas: ${total} | 200 OK: ${exitosas} | error: ${fallidas}`);
  console.log(`URL actual: ${page.url()}`);

  await page.screenshot({ path: 'test-results/recon-getprofile-staging.png', fullPage: true }).catch(() => {});

  await browser.close();
})();
