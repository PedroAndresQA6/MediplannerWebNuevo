import { test } from '@playwright/test';

const EMAIL = process.env.ESTACIONAMIENTOS_EMAIL || 'fernando@rym-solutions.com';
const PASSWORD = process.env.ESTACIONAMIENTOS_PASSWORD || 'RYM_solutions';

test('recon: toggle Mapa de Estacionamientos + formulario Registrar infracción', async ({ page }) => {
  await page.goto('/index.php/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await page.waitForTimeout(1000);

  console.log('\n=== Estacionamientos > tab Mapa ===');
  await page.locator('a', { hasText: 'Estacionamientos' }).first().click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await page.locator('button, a', { hasText: 'Mapa' }).first().click();
  await page.waitForTimeout(2000);
  console.log('URL:', page.url());
  console.log((await page.locator('body').innerText()).slice(0, 1500));
  await page.screenshot({ path: 'test-results/recon-estacionamientos-mapa.png', fullPage: true });

  console.log('\n=== Infracciones > Registrar infracción ===');
  // El toggle "Mapa" de Estacionamientos navega a /disponibilidad, una vista
  // PÚBLICA sin el shell de admin (sin sidebar) -- volver por URL directa en
  // vez de asumir que el link "Infracciones" del sidebar sigue presente.
  await page.goto('/index.php/infracciones');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await page.locator('button, a', { hasText: 'Registrar infracción' }).first().click();
  await page.waitForTimeout(1500);
  console.log('URL:', page.url());
  console.log((await page.locator('body').innerText()).slice(0, 2000));
  await page.screenshot({ path: 'test-results/recon-registrar-infraccion.png', fullPage: true });

  // Cerrar el modal/form si sigue abierto, sin enviar nada.
  await page.keyboard.press('Escape').catch(() => {});

  console.log('\n=== Infracciones > Levantar falta (desde Vehículos fuera de tiempo) ===');
  await page.goto('/index.php/infracciones');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  const levantarFalta = page.locator('button, a', { hasText: 'Levantar falta' }).first();
  if (await levantarFalta.count()) {
    await levantarFalta.click();
    await page.waitForTimeout(1500);
    console.log('URL:', page.url());
    console.log((await page.locator('body').innerText()).slice(0, 2000));
    await page.screenshot({ path: 'test-results/recon-levantar-falta.png', fullPage: true });
  } else {
    console.log('No se encontró el botón "Levantar falta"');
  }
});
