const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Exploración pura (sin crear nada) del paso 1 del wizard "Agendar cita":
// ¿cómo se agrega un paciente NUEVO ahí? Pedro confirmó que el bug real
// ("Se necesita asignar el tipo de la consulta") aparece justo al usar esa
// opción, no al buscar un paciente existente. Antes de reintentar la
// reproducción hay que mapear ese flujo, que no está automatizado todavía.

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
    await page.goto('/Citas');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const agendarButton = page.getByRole('button', { name: /agendar cita/i }).first();
    await agendarButton.waitFor({ state: 'visible', timeout: 10000 });
    await agendarButton.click();

    const wizardHeading = page.getByRole('heading', { name: 'Agendar cita' });
    await wizardHeading.waitFor({ state: 'visible', timeout: 10000 });
    const wizard = wizardHeading.locator('xpath=ancestor::div[.//input][1]');
    await page.waitForTimeout(1000);

    console.log('=== TEXTO COMPLETO DEL WIZARD (paso 1) ===');
    console.log((await wizard.innerText().catch(() => '')));

    console.log('\n=== BOTONES visibles dentro del wizard ===');
    const buttons = wizard.locator('button:visible');
    const bCount = await buttons.count();
    for (let i = 0; i < bCount; i++) {
      const t = (await buttons.nth(i).textContent().catch(() => '') || '').trim();
      console.log(`  [button ${i}] "${t}"`);
    }

    console.log('\n=== LINKS/otros clicables (a, [role=link]) visibles dentro del wizard ===');
    const links = wizard.locator('a:visible, [role="link"]:visible');
    const lCount = await links.count();
    for (let i = 0; i < lCount; i++) {
      const t = (await links.nth(i).textContent().catch(() => '') || '').trim();
      console.log(`  [link ${i}] "${t}"`);
    }

    await page.screenshot({ path: 'test-results/explorar-wizard-paso1.png', fullPage: true }).catch(() => {});

    // Escribir un nombre que casi seguro no existe, para ver si el
    // react-select ofrece una opción de "crear paciente nuevo".
    const nombreInexistente = 'ZZZ_Paciente_Inexistente_QA';
    const combos = wizard.getByRole('combobox');
    await combos.first().waitFor({ state: 'visible', timeout: 10000 });
    await combos.first().click();
    await page.waitForTimeout(300);
    await combos.first().fill(nombreInexistente);
    console.log(`\n=== Escrito "${nombreInexistente}" en el buscador de paciente — esperando opciones... ===`);
    await page.waitForTimeout(2500);

    const optSel = '[id*="react-select"][id*="option"], [role="option"], [class*="option"]:visible';
    const opciones = page.locator(optSel);
    const oCount = await opciones.count();
    console.log(`Opciones/menú tras buscar nombre inexistente: ${oCount}`);
    for (let i = 0; i < oCount; i++) {
      const t = (await opciones.nth(i).textContent().catch(() => '') || '').trim();
      console.log(`  [opcion ${i}] "${t}"`);
    }

    await page.screenshot({ path: 'test-results/explorar-wizard-buscar-inexistente.png', fullPage: true }).catch(() => {});

    // También dejar constancia de todo el texto visible en pantalla en este punto
    console.log('\n=== Texto completo de <body> en este punto ===');
    console.log((await page.locator('body').innerText().catch(() => '')));

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/explorar-wizard-error.png', fullPage: true }).catch(() => {});
  }

  console.log('\n\n(Navegador se deja abierto 20s para inspección manual antes de cerrar)');
  await page.waitForTimeout(20000);
  await browser.close();
})();
