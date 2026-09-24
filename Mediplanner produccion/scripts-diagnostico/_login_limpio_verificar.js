// A pedido de Pedro: login completamente limpio (sin storageState previo,
// contexto nuevo) para confirmar a que cuenta/perfil corresponden estas
// credenciales -- sin asumir que es "Stephen Strange".
const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Credenciales solo desde .env (no versionado) -- mismo criterio que
// auth.setup.ts desde 2026-09-17: nunca hardcodear ni tener default.
const EMAIL = process.env.MEDIPLANNER_EMAIL;
const PASSWORD = process.env.MEDIPLANNER_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Faltan MEDIPLANNER_EMAIL / MEDIPLANNER_PASSWORD en .env');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null }); // SIN storageState -- contexto 100% limpio
  const page = await context.newPage();

  let profileBody = null;
  page.on('response', async (r) => {
    if (r.url().includes('/api/profile/getProfile')) {
      profileBody = await r.text().catch(() => null);
    }
  });

  console.log(`Navegando a https://admin.mediplanner.mx/ (contexto limpio, sin cookies previas)...`);
  await page.goto('https://admin.mediplanner.mx/');
  await page.waitForSelector('input[type="email"], input[name*="email"], input[placeholder*="mail"]', { timeout: 15000, state: 'visible' });

  const emailInput = page.locator('input[type="email"], input[name*="email"], input[placeholder*="mail"]').first();
  await emailInput.click();
  await emailInput.fill('');
  await emailInput.fill(EMAIL);
  const valorRealEmail = await emailInput.inputValue();
  console.log(`Valor REAL tipeado en el campo Email: "${valorRealEmail}"`);

  const passInput = page.locator('input[type="password"]').first();
  await passInput.click();
  await passInput.fill('');
  await passInput.fill(PASSWORD);
  const valorRealPass = await passInput.inputValue();
  console.log(`Longitud REAL de la contraseña tipeada: ${valorRealPass.length} caracteres`);

  await page.screenshot({ path: 'test-results/recon-login-antes-de-entrar.png', fullPage: true }).catch(() => {});

  console.log('Clickeando "Entrar"...');
  await page.locator('button:has-text("Entrar"), button:has-text("Login")').first().click();
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);

  console.log(`\nURL tras login: ${page.url()}`);
  console.log(`getProfile body: ${profileBody ? profileBody.substring(0, 400) : '(no se capturó)'}`);

  const bienvenida = await page.locator('body').innerText();
  const idx = bienvenida.indexOf('Bienvenido');
  console.log(`Texto "Bienvenido...": ${idx >= 0 ? bienvenida.substring(idx, idx + 60) : '(no encontrado)'}`);

  await page.screenshot({ path: 'test-results/recon-login-despues-de-entrar.png', fullPage: true }).catch(() => {});

  await context.storageState({ path: 'storageState.json' });
  console.log('\nstorageState.json guardado.');

  await browser.close();
})();
