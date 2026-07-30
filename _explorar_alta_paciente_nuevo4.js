const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

const SUFIJO = Date.now();

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({
    storageState: 'storageState.json',
    viewport: null,
    baseURL: base,
  });
  const page = await context.newPage();

  try {
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /agregar paciente/i }).first().click();
    await page.waitForTimeout(1500);
    await page.getByText(/crear perfil de paciente nuevo/i).first().click();
    await page.waitForTimeout(1500);

    const nombrePaciente = `QATipo${SUFIJO}`;
    console.log(`\n📝 Creando paciente de prueba "${nombrePaciente}"...`);
    await page.locator('input[name="sNombre"]').fill(nombrePaciente);
    await page.locator('input[name="sPaterno"]').fill('Repro');
    await page.locator('input[name="sMaterno"]').fill('Bug');
    await page.locator('input[name="sTelefono1"]').fill('4421234567');
    await page.locator('input[name="sCorreo"]').fill(`qa.tipo.${SUFIJO}@correofalso.com`);
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await page.waitForTimeout(2500);

    const aceptarBtn = page.getByRole('button', { name: /^aceptar$/i });
    if (await aceptarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ Clickeando "Aceptar" del modal de éxito...');
      await aceptarBtn.click();
      await page.waitForTimeout(2000);
    }

    console.log(`\n=== URL tras "Aceptar": ${page.url()} ===`);
    await page.screenshot({ path: 'test-results/alta-paciente-tras-aceptar.png', fullPage: true }).catch(() => {});
    console.log('\n=== Texto completo tras "Aceptar" ===');
    console.log((await page.locator('body').innerText().catch(() => '')));

    // Ir a /Pacientes, buscar al paciente recién creado, entrar a su perfil,
    // y ver qué opciones de agendar/consultar tiene ahí.
    console.log(`\n🔎 Buscando a "${nombrePaciente}" en /Pacientes para entrar a su perfil...`);
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForSelector('.rdt_TableRow', { timeout: 15000 }).catch(() => {});
    const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
    if (await buscarInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buscarInput.fill(nombrePaciente);
      await page.waitForTimeout(2000);
    }
    const filaPaciente = page.locator(`text=/${nombrePaciente}/i`).first();
    if (await filaPaciente.isVisible({ timeout: 8000 }).catch(() => false)) {
      await filaPaciente.click();
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      console.log(`\n=== URL del perfil del paciente: ${page.url()} ===`);
      await page.screenshot({ path: 'test-results/alta-paciente-perfil.png', fullPage: true }).catch(() => {});
      console.log('\n=== Botones visibles en el perfil del paciente ===');
      const buttons = page.locator('button:visible');
      const bCount = await buttons.count();
      for (let i = 0; i < bCount; i++) {
        const t = (await buttons.nth(i).textContent().catch(() => '') || '').trim();
        if (t) console.log(`  [button ${i}] "${t}"`);
      }
    } else {
      console.log(`⚠️ No se encontró la fila de "${nombrePaciente}" en la lista tras buscar.`);
    }

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/alta-paciente-perfil-error.png', fullPage: true }).catch(() => {});
  }

  console.log('\n\n(Navegador se deja abierto 60s para inspección manual antes de cerrar)');
  await page.waitForTimeout(60000);
  await browser.close();
})();
