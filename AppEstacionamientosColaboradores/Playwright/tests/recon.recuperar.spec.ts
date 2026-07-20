import { test } from '@playwright/test';

test('recon: pantalla recuperar contraseña + validaciones de login', async ({ page }) => {
  await page.goto('/index.php/login');

  console.log('\n=== Login: enviar vacío ===');
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();
  await page.waitForTimeout(800);
  console.log((await page.locator('body').innerText()).slice(0, 1200));

  console.log('\n=== Login: credenciales incorrectas ===');
  await page.locator('input[type="email"]').fill('no-existe@rym-solutions.com');
  await page.locator('input[type="password"]').fill('claveIncorrecta123');
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();
  await page.waitForTimeout(1500);
  console.log('URL:', page.url());
  console.log((await page.locator('body').innerText()).slice(0, 1200));

  console.log('\n=== Recuperar contraseña ===');
  await page.goto('/index.php/recuperar');
  console.log('URL:', page.url());
  console.log('Title:', await page.title());
  console.log((await page.locator('body').innerText()).slice(0, 1200));

  console.log('\n=== Recuperar: email inválido ===');
  const emailField = page.locator('input[type="email"], input[type="text"]').first();
  if (await emailField.count()) {
    await emailField.fill('no-es-un-email');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(800);
    console.log((await page.locator('body').innerText()).slice(0, 800));
  }
});
