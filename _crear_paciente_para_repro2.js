const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

const SUFIJO = Date.now();
const NOMBRE = `QARepro2_${SUFIJO}`;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /agregar paciente/i }).first().click();
  await page.waitForTimeout(1500);
  await page.getByText(/crear perfil de paciente nuevo/i).first().click();
  await page.waitForTimeout(1500);

  await page.locator('input[name="sNombre"]').fill(NOMBRE);
  await page.locator('input[name="sPaterno"]').fill('Repro2');
  await page.locator('input[name="sMaterno"]').fill('BotonConsulta');
  await page.locator('input[name="sTelefono1"]').fill('4421234567');
  await page.locator('input[name="sCorreo"]').fill(`qa.repro2.${SUFIJO}@correofalso.com`);
  await page.getByRole('button', { name: /guardar cambios/i }).click();
  await page.waitForTimeout(2500);
  const aceptarBtn = page.getByRole('button', { name: /^aceptar$/i });
  if (await aceptarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await aceptarBtn.click();
  }
  await page.waitForTimeout(1000);
  console.log(`PACIENTE_CREADO=${NOMBRE}`);
  await browser.close();
})();
