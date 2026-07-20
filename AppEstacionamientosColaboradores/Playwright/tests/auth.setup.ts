import { test as setup, expect } from '@playwright/test';

const EMAIL = process.env.ESTACIONAMIENTOS_EMAIL || 'fernando@rym-solutions.com';
const PASSWORD = process.env.ESTACIONAMIENTOS_PASSWORD || 'RYM_solutions';

setup('authenticate', async ({ page }) => {
  console.log('Iniciando proceso de autenticación en el portal de Estacionamientos Colaboradores...');
  console.log(`Email: ${EMAIL.replace(/(.{3}).*(@.*)/, '$1***$2')}`);

  // Recon (2026-07-17): /index.php/usuarios redirige a /index.php/login si no
  // hay sesión (es el guard de auth, no la pantalla de "Usuarios" del menú
  // ADMINISTRACIÓN). Tras un login exitoso, redirige a /index.php/dashboard
  // ("Panel de control").
  await page.goto('/index.php/login');

  await page.waitForSelector('input[type="email"]', { timeout: 15000, state: 'visible' });
  console.log('Formulario de login detectado');

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);

  const loginButton = page.locator('button[type="submit"]:has-text("Iniciar sesión")');
  await expect(loginButton).toBeVisible({ timeout: 5000 });
  await loginButton.click();
  console.log('Botón de login clickeado');

  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await expect(page).toHaveURL(/dashboard/i, { timeout: 15000 });
  console.log('Autenticación exitosa, URL actual:', page.url());

  await page.context().storageState({ path: 'storageState.json' });
  console.log('Sesión guardada en storageState.json');
});
