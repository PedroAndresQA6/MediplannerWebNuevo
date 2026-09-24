import { test as setup, expect } from '@playwright/test';

// Credenciales: SOLO desde .env (no versionado). Sin valores por defecto --
// si faltan, el setup falla de inmediato con un mensaje claro en vez de
// intentar entrar con una cuenta equivocada o dejar credenciales en el repo.
// Corregido 2026-09-24: este archivo tenia EMAIL/PASSWORD de produccion
// hardcodeados como default desde antes, sin el fix que ya se habia aplicado
// a tests/auth.setup.ts (dev) el 2026-09-17.
const BASE_URL = process.env.BASE_URL || 'https://admin.mediplanner.mx/';
const EMAIL = process.env.MEDIPLANNER_EMAIL;
const PASSWORD = process.env.MEDIPLANNER_PASSWORD;

function requerirCredenciales(): { email: string; password: string } {
  const faltantes: string[] = [];
  if (!EMAIL) faltantes.push('MEDIPLANNER_EMAIL');
  if (!PASSWORD) faltantes.push('MEDIPLANNER_PASSWORD');

  if (faltantes.length > 0) {
    throw new Error(
      `Faltan credenciales en .env: ${faltantes.join(', ')}.\n` +
      `Crea (o completa) el archivo .env en Mediplanner produccion/ con:\n` +
      `  MEDIPLANNER_EMAIL=...\n` +
      `  MEDIPLANNER_PASSWORD=...\n` +
      `El .env no se versiona (ver .gitignore); pidesela a Pedro o copiala de otra maquina.`
    );
  }

  return { email: EMAIL as string, password: PASSWORD as string };
}

setup('authenticate', async ({ page }) => {
  const { email: EMAIL_VAL, password: PASSWORD_VAL } = requerirCredenciales();

  console.log('Iniciando proceso de autenticacion en produccion...');
  console.log(`URL base: ${BASE_URL}`);
  console.log(`Email: ${EMAIL_VAL.replace(/(.{3}).*(@.*)/, '$1***$2')}`);

  try {
    await page.goto(BASE_URL);
    console.log('Pagina cargada');

    await page.waitForSelector('input[type="email"], input[name="user_email"], input[placeholder*="email"]', {
      timeout: 15000,
      state: 'visible',
    });
    console.log('Formulario de login detectado');

    const emailInput = page.locator('input[type="email"], input[name="user_email"], input[placeholder*="email"]').first();
    await emailInput.fill(EMAIL_VAL);
    console.log('Email ingresado');

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(PASSWORD_VAL);
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
