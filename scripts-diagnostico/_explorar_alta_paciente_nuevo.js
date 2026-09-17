const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Exploración pura (sin guardar nada real si es posible evitarlo) del flujo
// de "agregar paciente nuevo" en /Pacientes — Pedro confirmó que el bug real
// ("Se necesita asignar el tipo de la consulta") aparece justo ahí, no en el
// wizard estándar de "Agendar cita" (que SÍ exige tipo/hospital, confirmado
// en la exploración anterior).

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

    console.log('=== Botones visibles en /Pacientes ===');
    const buttons = page.locator('button:visible');
    const bCount = await buttons.count();
    for (let i = 0; i < bCount; i++) {
      const t = (await buttons.nth(i).textContent().catch(() => '') || '').trim();
      if (t) console.log(`  [button ${i}] "${t}"`);
    }

    const altaButton = page.getByRole('button', { name: /agregar paciente|nuevo paciente|añadir paciente|registrar paciente/i }).first();
    if (!(await altaButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('\n⚠️ No se encontró un botón obvio de alta de paciente por texto. Revisar screenshot.');
      await page.screenshot({ path: 'test-results/explorar-pacientes-lista.png', fullPage: true }).catch(() => {});
    } else {
      const textoBoton = (await altaButton.textContent().catch(() => '') || '').trim();
      console.log(`\n✅ Botón de alta encontrado: "${textoBoton}" — clickeando...`);
      await altaButton.click();
      await page.waitForTimeout(2000);

      console.log('\n=== Texto completo tras abrir alta de paciente ===');
      console.log((await page.locator('body').innerText().catch(() => '')));

      await page.screenshot({ path: 'test-results/explorar-alta-paciente-paso1.png', fullPage: true }).catch(() => {});

      console.log('\n=== Botones visibles en el formulario/wizard de alta ===');
      const buttons2 = page.locator('button:visible');
      const bCount2 = await buttons2.count();
      for (let i = 0; i < bCount2; i++) {
        const t = (await buttons2.nth(i).textContent().catch(() => '') || '').trim();
        if (t) console.log(`  [button ${i}] "${t}"`);
      }
    }

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/explorar-alta-paciente-error.png', fullPage: true }).catch(() => {});
  }

  console.log('\n\n(Navegador se deja abierto 30s para inspección manual antes de cerrar)');
  await page.waitForTimeout(30000);
  await browser.close();
})();
