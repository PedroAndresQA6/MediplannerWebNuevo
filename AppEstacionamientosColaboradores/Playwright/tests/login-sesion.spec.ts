import { test, expect } from '@playwright/test';
import { login, logout, assertLoggedIn, EMAIL, PASSWORD } from '../e2e/utils';

// Adaptación al portal admin de los módulos S (Smoke), 3 (Splash/sesión) y 4
// (Login) del checklist de operador. Solo los casos tageados "Ambas"/"API"
// que tienen un equivalente real en este portal (login por email/password,
// sesión por cookie, sin turno/GPS/cámara). Cada test corre en un contexto
// SIN storageState (proyecto `login-sesion`, ver playwright.config.js) para
// poder probar el formulario de login desde cero en cada caso.

test('S1/3.1: arranque en frío sin sesión cae en Login', async ({ page }) => {
  await page.goto('/index.php/usuarios'); // guard de auth: redirige a /login sin sesión
  await expect(page).toHaveURL(/login/i);
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test('4.1: credencial (correo) vacía muestra validación', async ({ page }) => {
  await page.goto('/index.php/login');
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();
  await expect(page.getByText('El correo es obligatorio.')).toBeVisible({ timeout: 5000 });
});

test('4.2: contraseña vacía muestra validación', async ({ page }) => {
  // Recon (2026-07-17): el mensaje real dice "obligatorio" (no "obligatoria")
  // -- pequeña inconsistencia de género gramatical en el copy, no relevante
  // para el test pero anotada por si vale la pena reportarla junto al resto
  // de hallazgos de copy del proyecto.
  await page.goto('/index.php/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();
  await expect(page.getByText('La contraseña es obligatorio.')).toBeVisible({ timeout: 5000 });
});

test('4.3: credenciales incorrectas muestra error y permanece en Login', async ({ page }) => {
  await page.goto('/index.php/login');
  await page.locator('input[type="email"]').fill('no-existe@rym-solutions.com');
  await page.locator('input[type="password"]').fill('claveIncorrectaXYZ');
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();
  await expect(page.getByText('Credenciales incorrectas o cuenta inactiva.')).toBeVisible({ timeout: 8000 });
  await expect(page).toHaveURL(/login/i);
});

test('S2/4.4: login exitoso entra al Dashboard', async ({ page }) => {
  await login(page);
  await assertLoggedIn(page);
  await expect(page.getByText('Panel de control').first()).toBeVisible({ timeout: 10000 });
});

test('4.5: recuperar contraseña con email inválido muestra validación', async ({ page }) => {
  await page.goto('/index.php/recuperar');
  await page.locator('input[type="email"], input[type="text"]').first().fill('no-es-un-email');
  await page.locator('button[type="submit"]').first().click();
  await expect(page.getByText('Captura un correo válido.')).toBeVisible({ timeout: 5000 });
});

test('4.6: recuperar contraseña con email válido muestra confirmación genérica', async ({ page }) => {
  await page.goto('/index.php/recuperar');
  await page.locator('input[type="email"], input[type="text"]').first().fill(EMAIL);
  await page.locator('button[type="submit"]').first().click();
  // Mensaje genérico esperado (no confirma si el correo existe, por seguridad) --
  // se valida que YA NO se quede en el error de formato inválido de 4.5.
  await expect(page.getByText('Captura un correo válido.')).not.toBeVisible({ timeout: 5000 });
});

test('3.2: sesión persiste al recargar (cookie de sesión)', async ({ page }) => {
  await login(page);
  await assertLoggedIn(page);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  // No debe regresar a Login -- misma sesión de cookie persiste igual que
  // "reapertura con turno activo" en la app móvil (adaptado: acá no hay
  // turno, pero el concepto de sesión persistente por cookie es análogo).
  await assertLoggedIn(page);
});

test('3.3: cold start con red caída al cargar Login no crashea', async ({ page, context }) => {
  // Adaptado del "3.3 arranque sin red": bloquear las llamadas a la API tras
  // cargar el login y confirmar que el formulario sigue usable (no queda en
  // blanco/roto) -- equivalente web de "cae en Login si no hay red", ya que
  // acá no hay sesión guardada localmente que permitiría bypass.
  await context.route('**/api/**', route => route.abort());
  await page.goto('/index.php/login');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('S8: sesión inválida (cookie borrada) redirige a Login al navegar', async ({ page, context }) => {
  await login(page);
  await assertLoggedIn(page);
  // Adaptado: en vez de esperar un 401 real del backend, se simula sesión
  // revocada borrando las cookies (mismo resultado observable: el guard de
  // auth debe mandar a Login al intentar navegar a una pantalla protegida).
  await context.clearCookies();
  await page.goto('/index.php/dashboard');
  await expect(page).toHaveURL(/login/i, { timeout: 10000 });
});

test('5.6: menú de usuario permite cerrar sesión (Salir)', async ({ page }) => {
  await login(page);
  await assertLoggedIn(page);
  await logout(page);
  await expect(page).toHaveURL(/login/i, { timeout: 10000 });
});
