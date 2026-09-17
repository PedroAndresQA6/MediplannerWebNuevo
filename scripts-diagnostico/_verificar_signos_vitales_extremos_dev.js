// Investigación puntual: consultation.inputs-validation.spec.ts encontró que
// 6 campos de "Capturar signos vitales" (Peso, Talla, Presión, FC,
// Oxigenación, FR) retienen valores numéricos clínicamente imposibles
// (ej. FC=999, Oxigenación=500%) sin filtrarlos mientras se tipean. Pero ese
// test NO verifica si "Guardar" se habilita ni si el backend los aceptaría —
// solo mide el <input> en sí. Esto verifica el paso siguiente, el que
// realmente importa: ¿se puede GUARDAR una consulta con esos valores?
const { chromium } = require('@playwright/test');
const { createAppointment } = require('../e2e/utils.js');
require('dotenv').config({ path: '.env' });

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx' });
  const page = await context.newPage();
  page.on('response', async (r) => {
    if (r.url().includes('/api/') && r.request().method() !== 'GET') {
      const body = await r.json().catch(() => null);
      console.log(`📤 ${r.status()} ${r.url().split('/api/')[1]} → ${body ? JSON.stringify(body).substring(0,200) : ''}`);
    }
  });

  await page.goto('/Dashboard');
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  let iniciarBtn = page.getByRole('button', { name: /^iniciar$/i }).first();
  if (!(await iniciarBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.log('No hay botón "Iniciar" hoy — creando una cita nueva...');
    await createAppointment(page);
    await page.goto('/Dashboard');
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    iniciarBtn = page.getByRole('button', { name: /^iniciar$/i }).first();
  }
  if (!(await iniciarBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.log('Sigue sin haber botón "Iniciar". Abortando.');
    await browser.close();
    return;
  }
  await iniciarBtn.click();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const capturarBtn = page.getByRole('button', { name: /capturar signos vitales/i }).first();
  if (!(await capturarBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.log('No se encontró botón "Capturar signos vitales". Abortando.');
    await page.screenshot({ path: 'test-results/_diag-signos-vitales-no-boton.png', fullPage: true });
    await browser.close();
    return;
  }
  await capturarBtn.click();
  await page.waitForTimeout(2000);

  const fcInput = page.locator('input[name*="card" i]').first();
  if (await fcInput.count() === 0) {
    console.log('No se encontró el input de Frecuencia Cardiaca en el modal. Abortando.');
    await page.screenshot({ path: 'test-results/_diag-signos-vitales-no-modal.png', fullPage: true });
    await browser.close();
    return;
  }

  console.log('Llenando TODOS los campos con valores válidos primero, luego solo FC con 999...');
  const campos = {
    'input[name="peso"]': '70',
    'input[name*="talla" i]': '170',
    'input[placeholder*="mmHg"]': '120/80',
    'input[name*="temp" i]': '36.5',
    'input[name="oxigenacion"]': '98',
    'input[name="frecuenciaRespiratoria"]': '16',
    'input[name="glucosa"]': '90',
  };
  for (const [sel, val] of Object.entries(campos)) {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
      await loc.click({ clickCount: 3 });
      await loc.type(val, { delay: 20 });
    }
  }
  // FC con valor imposible
  await fcInput.click({ clickCount: 3 });
  await fcInput.type('999', { delay: 20 });
  await page.waitForTimeout(500);
  console.log('Valor final en campo FC:', await fcInput.inputValue());

  const guardarBtn = page.getByRole('button', { name: /guardar/i }).last();
  const habilitado = await guardarBtn.isEnabled({ timeout: 3000 }).catch(() => false);
  console.log('¿Botón "Guardar" habilitado con FC=999?', habilitado);
  await page.screenshot({ path: 'test-results/_diag-signos-vitales-fc999.png', fullPage: true });

  if (habilitado) {
    console.log('Clickeando "Guardar"...');
    await guardarBtn.click();
    await page.waitForTimeout(3000);
    console.log('Resultado tras click en Guardar — ver responses arriba.');
    await page.screenshot({ path: 'test-results/_diag-signos-vitales-fc999-post-guardar.png', fullPage: true });
  }

  await browser.close();
})();
