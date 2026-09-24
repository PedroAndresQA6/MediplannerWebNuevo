// A pedido de Pedro: iniciar sesion en produccion con la cuenta QA y dejar
// la ventana abierta ~40s para que la vea el mismo.
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
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  console.log(`Navegando a https://admin.mediplanner.mx/ ...`);
  await page.goto('https://admin.mediplanner.mx/');
  await page.waitForSelector('input[type="email"], input[name*="email"], input[placeholder*="mail"]', { timeout: 15000, state: 'visible' });

  await page.locator('input[type="email"], input[name*="email"], input[placeholder*="mail"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  console.log(`Iniciando sesión con ${EMAIL} ...`);
  await page.locator('button:has-text("Entrar"), button:has-text("Login")').first().click();
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log(`URL actual: ${page.url()}`);
  console.log('Dejando la sesión abierta 40 segundos para que la revises...');
  await page.waitForTimeout(40000);

  console.log('Cerrando navegador.');
  await browser.close();
})();
