// Verificación puntual: ¿el <h3> "Exploración segmentaria" trae espacio final
// u otra diferencia que rompa el regex exacto /^Exploración segmentaria$/i?
const { chromium } = require('@playwright/test');
const { createAppointment, buscarBotonIniciarDePaciente } = require('../e2e/utils.js');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx' });
  const page = await context.newPage();

  await createAppointment(page, 'Percentil');
  await page.goto('/Dashboard');
  await page.waitForTimeout(2000);
  const iniciarBtn = await buscarBotonIniciarDePaciente(page, 'Percentil');
  if (!iniciarBtn) { console.log('No se encontró Iniciar'); await browser.close(); return; }
  await iniciarBtn.click({ force: true });
  await page.waitForTimeout(1500);
  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  if (await signosButton.isVisible({ timeout: 8000 }).catch(() => false)) {
    await page.locator('input[name="peso"]').fill('70');
    await page.locator('input[name*="talla" i]').first().fill('170');
    await page.locator('input[placeholder="000/000 mmHg"]').fill('120/080');
    await page.locator('input[name*="temp" i]').first().fill('36.5');
    await page.locator('input[name*="card" i]').first().fill('75');
    await page.locator('input[name="oxigenacion"]').fill('98');
    await page.locator('input[name="frecuencia_respiratoria"]').fill('16');
    await page.locator('input[name="glucosa"]').fill('90');
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await page.waitForTimeout(2000);
  }
  await page.waitForURL(/Consulta\//, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const headings = page.getByRole('heading', { level: 3 });
  const n = await headings.count();
  console.log(`Headings h3 encontrados: ${n}`);
  for (let i = 0; i < n; i++) {
    const txt = await headings.nth(i).textContent();
    console.log(`  [${i}] "${txt}" (len=${txt.length}) JSON=${JSON.stringify(txt)}`);
  }

  await browser.close();
})();
