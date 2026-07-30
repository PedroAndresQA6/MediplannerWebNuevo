const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Error guessing NUEVO (2026-07-30): patrón "Hallazgo 1" (navegar fuera sin
// guardar y volver) probado en una pantalla DISTINTA de Consulta: la pestaña
// "Antecedentes" del perfil del paciente. Objetivo: ¿se pierde el texto en
// silencio (esperado) o queda algo raro (dato de otro apartado, texto a
// medias, o la pantalla se cuelga como en Consulta)?

const PACIENTE_BUSQUEDA = process.argv[2] || 'QARepro2';
const MARCA_UNICA = 'QA_NO_DEBE_QUEDAR_' + Date.now();

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
  await page.waitForSelector('.rdt_TableRow', { timeout: 15000 }).catch(() => {});
  const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
  await buscarInput.fill(PACIENTE_BUSQUEDA);
  await page.waitForTimeout(2000);
  const fila = page.locator(`text=/${PACIENTE_BUSQUEDA}/i`).first();
  await fila.waitFor({ state: 'visible', timeout: 10000 });
  await fila.click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`📍 En perfil de paciente: ${page.url()}`);

  // Ir a la pestaña "Antecedentes" (menú lateral izquierdo del perfil).
  const antecedentesTab = page.getByText(/^antecedentes$/i).first();
  await antecedentesTab.click();
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/eg-antecedentes-0-inicial.png', fullPage: true }).catch(() => {});

  console.log('\n=== Textareas/inputs de texto visibles en Antecedentes ===');
  const campos = page.locator('textarea:visible, input[type="text"]:visible');
  const nCampos = await campos.count();
  for (let i = 0; i < nCampos; i++) {
    const el = campos.nth(i);
    const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '?');
    const name = await el.getAttribute('name').catch(() => '');
    const val = (await el.inputValue().catch(() => '') || '').substring(0, 40);
    console.log(`  [${i}] <${tag}> name="${name}" valorActual="${val}"`);
  }

  if (nCampos === 0) {
    console.log('⚠️ No se encontraron campos de texto en Antecedentes — revisar screenshot, puede que la UI sea distinta (checkboxes/formulario dinámico).');
  } else {
    // Escribir un marcador único en el primer campo SIN guardar.
    console.log(`\n✍️ Escribiendo marcador único "${MARCA_UNICA}" en el campo [0], SIN guardar...`);
    await campos.first().fill(MARCA_UNICA);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/eg-antecedentes-1-escrito-sin-guardar.png', fullPage: true }).catch(() => {});

    // Navegar a otra pestaña del perfil (Diagnósticos) sin guardar.
    console.log('🚶 Navegando a "Diagnósticos" sin guardar...');
    const diagnosticosTab = page.getByText(/^diagnósticos$/i).first();
    await diagnosticosTab.click();
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/eg-antecedentes-2-en-diagnosticos.png', fullPage: true }).catch(() => {});

    // Volver a Antecedentes.
    console.log('↩️ Volviendo a "Antecedentes"...');
    await antecedentesTab.click();
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const valorTrasVolver = await campos.first().inputValue().catch(() => '');
    console.log(`Valor del campo [0] tras volver: "${valorTrasVolver.substring(0, 60)}"`);
    await page.screenshot({ path: 'test-results/eg-antecedentes-3-tras-volver.png', fullPage: true }).catch(() => {});

    if (valorTrasVolver.includes(MARCA_UNICA)) {
      console.log('⚠️⚠️ POSIBLE HALLAZGO: el texto sin guardar SÍ reapareció al volver (¿autosave silencioso no documentado, o el campo nunca se limpió?).');
    } else {
      console.log('✅ El texto sin guardar se perdió al navegar y volver, como se esperaría (no hay autosave). Sin bug de persistencia.');
    }

    // Ahora, misma prueba pero navegando por URL directa (más parecido al
    // "Hallazgo 1" de Consulta: goto a otra sección de la app y volver).
    console.log(`\n✍️ Repitiendo, esta vez navegando por goto() a /Pacientes y volviendo por URL directa...`);
    await campos.first().fill(MARCA_UNICA + '_v2');
    await page.waitForTimeout(1000);
    const urlPerfilActual = page.url();
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.goto(urlPerfilActual);
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const textoTrasVolverPorUrl = await page.locator('body').innerText().catch(() => '');
    const seColgo = /cargando/i.test(textoTrasVolverPorUrl) && textoTrasVolverPorUrl.length < 500;
    console.log(`¿La pantalla quedó colgada en "Cargando..." tras volver por URL directa (patrón Hallazgo 1)? ${seColgo}`);
    await page.screenshot({ path: 'test-results/eg-antecedentes-4-tras-goto-directo.png', fullPage: true }).catch(() => {});
    if (seColgo) {
      console.log('⚠️⚠️ POSIBLE HALLAZGO NUEVO: el mismo patrón de "Consulta colgada al volver por URL" también afecta el perfil del paciente / Antecedentes.');
    } else {
      console.log('✅ El perfil del paciente recarga bien tras navegar fuera y volver por URL directa — el patrón "Hallazgo 1" NO se repite aquí.');
    }
  }

  console.log('\n\n=== FIN ===');
  await page.waitForTimeout(15000);
  await browser.close();
})();
