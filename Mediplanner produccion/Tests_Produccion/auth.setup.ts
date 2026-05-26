import { test as setup, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://admin.mediplanner.mx/';
const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL || 'pedroandresqa6@gmail.com';
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD || 'Soypedrito2';

setup('authenticate with Google', async ({ page }) => {
  console.log('Iniciando autenticacion con Google OAuth...');
  console.log(`URL base: ${BASE_URL}`);
  console.log(`Email: ${GOOGLE_EMAIL.replace(/(.{3}).*(@.*)/, '$1***$2')}`);

  try {
    await page.goto(BASE_URL);
    console.log('Pagina cargada');

    await page.waitForSelector('button:has-text("Usar Google")', {
      timeout: 15000,
      state: 'visible',
    });
    console.log('Boton de Google detectado');

    await page.click('button:has-text("Usar Google")');
    console.log('Redirigiendo a Google...');

    await page.waitForURL(/accounts\.google\.com/, { timeout: 20000 });
    console.log('Pagina de login de Google cargada');

    await page.waitForURL(/accounts\.google\.com/, { timeout: 20000 });
    await page.waitForTimeout(2000);

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(GOOGLE_EMAIL);
    console.log('Email ingresado');
    await page.click('#identifierNext');
    console.log('Click en Siguiente (email)');

    await page.waitForTimeout(2000);
    const passwordInput = page.locator('#password input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
    await passwordInput.fill(GOOGLE_PASSWORD);
    console.log('Password ingresado');
    await page.click('#passwordNext');
    console.log('Click en Siguiente (password)');

    try {
      await page.waitForURL(/admin\.mediplanner\.mx/, { timeout: 30000 });
      console.log('Redireccion exitosa a MediPlanner');
    } catch {
      console.log('Esperando redireccion...');
    }

    await page.waitForLoadState('networkidle', { timeout: 30000 });
    console.log('Sesion establecida');

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
