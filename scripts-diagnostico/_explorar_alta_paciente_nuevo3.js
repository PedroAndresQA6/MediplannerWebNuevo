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

  const erroresApi = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`);
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/') && (r.url().toLowerCase().includes('patient') || r.url().toLowerCase().includes('appointment'))) {
      const body = await r.json().catch(() => null);
      console.log(`📥 ${r.status()} ${r.url().split('/api/')[1]} → ${JSON.stringify(body).substring(0, 300)}`);
    }
  });

  try {
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /agregar paciente/i }).first().click();
    await page.waitForTimeout(1500);
    await page.getByText(/crear perfil de paciente nuevo/i).first().click();
    await page.waitForTimeout(1500);

    console.log(`\n📝 Llenando datos de paciente de prueba QA_TipoConsulta_${SUFIJO}...`);
    await page.locator('input[name="sNombre"]').fill('QA_TipoConsulta');
    await page.locator('input[name="sPaterno"]').fill(`Repro${SUFIJO}`);
    await page.locator('input[name="sMaterno"]').fill('Bug');
    await page.locator('input[name="sTelefono1"]').fill('4421234567');
    await page.locator('input[name="sCorreo"]').fill(`qa.tipoconsulta.${SUFIJO}@correofalso.com`);

    await page.screenshot({ path: 'test-results/alta-paciente-antes-guardar.png', fullPage: true }).catch(() => {});

    console.log('\n💾 Clickeando "Guardar cambios"...');
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await page.waitForTimeout(3000);

    console.log(`\n=== URL tras guardar: ${page.url()} ===`);
    console.log('\n=== Texto completo tras guardar ===');
    console.log((await page.locator('body').innerText().catch(() => '')));

    await page.screenshot({ path: 'test-results/alta-paciente-despues-guardar.png', fullPage: true }).catch(() => {});

    // Si quedó en algún wizard, dump de botones/inputs visibles.
    console.log('\n=== Botones visibles tras guardar ===');
    const buttons = page.locator('button:visible');
    const bCount = await buttons.count();
    for (let i = 0; i < bCount; i++) {
      const t = (await buttons.nth(i).textContent().catch(() => '') || '').trim();
      if (t) console.log(`  [button ${i}] "${t}"`);
    }
    console.log('\n=== Selects visibles tras guardar ===');
    const selects = page.locator('select:visible');
    const sCount = await selects.count();
    for (let i = 0; i < sCount; i++) {
      const val = await selects.nth(i).inputValue().catch(() => null);
      const opts = await selects.nth(i).locator('option').count();
      console.log(`  [select ${i}] valor="${val}" opciones totales=${opts}`);
    }

    if (erroresApi.length > 0) {
      console.log(`\n🔴 ${erroresApi.length} respuesta(s) de API con error:`);
      erroresApi.forEach(e => console.log('   ' + e));
    }

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/alta-paciente-error.png', fullPage: true }).catch(() => {});
  }

  console.log('\n\n(Navegador se deja abierto 45s para inspección manual antes de cerrar)');
  await page.waitForTimeout(45000);
  await browser.close();
})();
