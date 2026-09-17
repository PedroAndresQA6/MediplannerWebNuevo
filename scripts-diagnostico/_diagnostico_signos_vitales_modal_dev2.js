// Diagnóstico 2: crear una cita nueva (paciente Percentil) y abrir el modal
// "Capturar signos vitales" para leer los name/id reales de cada input —
// el spec de full-flow usa input[name="frecuenciaRespiratoria"] y quedó
// vacío en la corrida real (ver test-failed-1.png), sospecha de que el
// name cambió con el rediseño que agregó "Rango permitido: X-Y".
const { chromium } = require('@playwright/test');
const { createAppointment, buscarBotonIniciarDePaciente } = require('../e2e/utils.js');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx' });
  const page = await context.newPage();

  await createAppointment(page, 'Percentil');
  await page.goto('https://admin-dev.mediplanner.mx/Dashboard');
  await page.waitForTimeout(2000);

  const iniciarBtn = await buscarBotonIniciarDePaciente(page, 'Percentil');
  if (!iniciarBtn) {
    console.log('No se encontró botón Iniciar tras crear la cita.');
    await browser.close();
    return;
  }
  await iniciarBtn.click({ force: true });
  await page.waitForTimeout(1500);

  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  if (await signosButton.isVisible({ timeout: 8000 }).catch(() => false)) {
    await signosButton.click();
    await page.waitForTimeout(1200);
  }

  const inputs = page.locator('input:visible');
  const n = await inputs.count();
  console.log(`Inputs visibles: ${n}`);
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const name = await el.getAttribute('name').catch(() => null);
    const id = await el.getAttribute('id').catch(() => null);
    const placeholder = await el.getAttribute('placeholder').catch(() => null);
    console.log(`  [${i}] name="${name}" id="${id}" placeholder="${placeholder}"`);
  }

  await browser.close();
})();
