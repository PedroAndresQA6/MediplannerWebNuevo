import { test as setup, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://admin.mediplanner.mx/';
const EMAIL = process.env.MEDIPLANNER_EMAIL || 'dr@rym-solutions.com';
const PASSWORD = process.env.MEDIPLANNER_PASSWORD || '@RyM2025';

setup('authenticate', async ({ page }) => {
  console.log('Iniciando proceso de autenticacion en produccion...');
  console.log(`URL base: ${BASE_URL}`);
  console.log(`Email: ${EMAIL.replace(/(.{3}).*(@.*)/, '$1***$2')}`);

  try {
    await page.goto(BASE_URL);
    console.log('Pagina cargada');

    await page.waitForSelector('input[type="email"], input[name="user_email"], input[placeholder*="email"]', {
      timeout: 15000,
      state: 'visible',
    });
    console.log('Formulario de login detectado');

    const emailInput = page.locator('input[type="email"], input[name="user_email"], input[placeholder*="email"]').first();
    await emailInput.fill(EMAIL);
    console.log('Email ingresado');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(PASSWORD);
    console.log('Password ingresado');

    const loginButton = page.locator('button:has-text("Entrar"), button:has-text("Login")').first();
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    await loginButton.click();
    console.log('Boton de login clickeado');

    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    console.log('Pagina principal cargada');

    await page.waitForTimeout(3000);

    await expect(page).not.toHaveURL(/login/i, { timeout: 10000 });
    console.log('Autenticacion exitosa');

    await page.context().storageState({ path: 'storageState.json' });
    console.log('Sesion guardada en storageState.json');
  } catch (error) {
    console.error('Error durante la autenticacion:', error.message);
    await page.screenshot({ path: 'test-results/auth-error.png', fullPage: true });
    console.log('Screenshot guardado: test-results/auth-error.png');
    throw error;
  }
});
