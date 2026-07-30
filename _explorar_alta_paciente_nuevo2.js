const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

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

    const crearPerfilBtn = page.getByText(/crear perfil de paciente nuevo/i).first();
    await crearPerfilBtn.waitFor({ state: 'visible', timeout: 8000 });
    console.log('✅ Clickeando "Crear perfil de paciente nuevo"...');
    await crearPerfilBtn.click();
    await page.waitForTimeout(2000);

    console.log('\n=== Texto completo tras "Crear perfil de paciente nuevo" ===');
    console.log((await page.locator('body').innerText().catch(() => '')));

    await page.screenshot({ path: 'test-results/explorar-alta-paciente-form.png', fullPage: true }).catch(() => {});

    console.log('\n=== Botones visibles ===');
    const buttons = page.locator('button:visible');
    const bCount = await buttons.count();
    for (let i = 0; i < bCount; i++) {
      const t = (await buttons.nth(i).textContent().catch(() => '') || '').trim();
      if (t) console.log(`  [button ${i}] "${t}"`);
    }

    console.log('\n=== Inputs/selects visibles (name/placeholder/type) ===');
    const inputs = page.locator('input:visible, select:visible, textarea:visible');
    const iCount = await inputs.count();
    for (let i = 0; i < iCount; i++) {
      const el = inputs.nth(i);
      const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '?');
      const name = await el.getAttribute('name').catch(() => '');
      const placeholder = await el.getAttribute('placeholder').catch(() => '');
      const type = await el.getAttribute('type').catch(() => '');
      console.log(`  [${i}] <${tag}> name="${name}" type="${type}" placeholder="${placeholder}"`);
    }

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/explorar-alta-paciente-form-error.png', fullPage: true }).catch(() => {});
  }

  console.log('\n\n(Navegador se deja abierto 45s para inspección manual antes de cerrar)');
  await page.waitForTimeout(45000);
  await browser.close();
})();
