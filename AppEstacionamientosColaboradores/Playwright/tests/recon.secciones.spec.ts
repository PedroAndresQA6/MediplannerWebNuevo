import { test } from '@playwright/test';

const EMAIL = process.env.ESTACIONAMIENTOS_EMAIL || 'fernando@rym-solutions.com';
const PASSWORD = process.env.ESTACIONAMIENTOS_PASSWORD || 'RYM_solutions';

// Recon de las secciones del sidebar que podrían tener un equivalente a los
// módulos del checklist de operador (Home/Mapa/Lista, Check-in, Reporte,
// Cierre de turno). No hace asserts -- solo navega, loguea URL/título y
// vuelca texto visible para decidir qué casos del checklist aplican de
// verdad al portal admin.
const SECCIONES = [
  'Monitoreo en tiempo real',
  'Consultas de placas',
  'Zonas',
  'Cajones (pintar)',
  'Infracciones',
  'Reportes',
  'Estacionamientos',
  'Usuarios',
];

test('recon: navegar cada sección candidata del sidebar', async ({ page }) => {
  await page.goto('/index.php/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await page.waitForTimeout(1000);

  for (const seccion of SECCIONES) {
    console.log(`\n=== ${seccion} ===`);
    try {
      await page.locator('a', { hasText: seccion }).first().click();
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await page.waitForTimeout(1000);
      console.log('URL:', page.url());
      console.log('Title:', await page.title());
      const bodyText = await page.locator('body').innerText();
      console.log(bodyText.slice(0, 1500));
      const safeName = seccion.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      await page.screenshot({ path: `test-results/recon-seccion-${safeName}.png`, fullPage: true });
    } catch (e) {
      console.log(`ERROR navegando a "${seccion}":`, (e as Error).message);
    }
  }
});
