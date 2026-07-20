import { test } from '@playwright/test';

const EMAIL = process.env.ESTACIONAMIENTOS_EMAIL || 'fernando@rym-solutions.com';
const PASSWORD = process.env.ESTACIONAMIENTOS_PASSWORD || 'RYM_solutions';

test('recon: login y mapeo de la pantalla post-login', async ({ page }) => {
  await page.goto('/index.php/usuarios');
  console.log('URL login:', page.url());
  console.log('Title login:', await page.title());

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();

  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('URL post-login:', page.url());
  console.log('Title post-login:', await page.title());

  await page.screenshot({ path: 'test-results/recon-post-login.png', fullPage: true });

  const navLinks = await page.locator('a').allTextContents();
  console.log('Links visibles:', JSON.stringify(navLinks.map(t => t.trim()).filter(Boolean)));

  const bodyText = await page.locator('body').innerText();
  console.log('--- BODY TEXT (primeros 2000 chars) ---');
  console.log(bodyText.slice(0, 2000));
});
