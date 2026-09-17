const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Reconocimiento: estructura real del formulario de "Registrar pago" en
// Ingresos — ¿el campo "Monto" es editable? Si lo es, es candidato directo
// para probar sobrepago/monto negativo (nunca probado hasta ahora).

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  // Saltar wizard de onboarding/configuración si aparece (no se prueba, solo se evita).
  const saltarOnboarding = async () => {
    const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
    if (await explorarLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await explorarLink.click({ force: true }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
    if (await configurarMasTardeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await configurarMasTardeLink.click({ force: true }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
  };

  let ingresosLink = null;
  for (let intento = 1; intento <= 4 && !ingresosLink; intento++) {
    if (intento === 1) await page.goto('/Dashboard');
    else await page.reload();
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await saltarOnboarding();
    await page.waitForTimeout(1500);
    console.log(`[intento ${intento}] URL actual: ${page.url()}`);
    const candidato = page.locator('a.menu-link').filter({ hasText: /^ingresos$/i }).first();
    if (await candidato.isVisible({ timeout: 4000 }).catch(() => false)) ingresosLink = candidato;
    else console.log(`  ⚠️ link "Ingresos" no visible aún (intento ${intento}/4)`);
  }
  if (!ingresosLink) {
    await page.screenshot({ path: 'test-results/recon-ingresos-sin-link.png', fullPage: true }).catch(() => {});
    throw new Error('No se encontró el link "Ingresos" tras 4 intentos');
  }
  await ingresosLink.click();
  await page.waitForTimeout(2500);
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await saltarOnboarding();
  await page.waitForTimeout(2000);
  console.log(`URL de Ingresos real: ${page.url()}`);
  await page.screenshot({ path: 'test-results/recon-ingresos-lista.png', fullPage: true }).catch(() => {});

  // Buscar filas con estatus "Pendiente"
  const filas = page.locator('.rdt_TableRow');
  const n = await filas.count();
  console.log(`Filas de ingresos visibles: ${n}`);
  let filaPendiente = null;
  for (let i = 0; i < n; i++) {
    const texto = (await filas.nth(i).innerText().catch(() => '')) || '';
    if (/pendiente/i.test(texto)) { filaPendiente = filas.nth(i); console.log(`Fila [${i}] pendiente: ${texto.replace(/\n/g, ' | ').substring(0, 150)}`); break; }
  }

  if (!filaPendiente) {
    console.log('⚠️ No se encontró ninguna fila "Pendiente" visible en la primera página — probando buscar/filtrar por paciente "Percentil"...');
    const buscarInput = page.locator('input[placeholder*="Buscar" i], input[placeholder*="Paciente" i]').first();
    if (await buscarInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await buscarInput.fill('Percentil');
      await page.waitForTimeout(2000);
      const filas2 = page.locator('.rdt_TableRow');
      const n2 = await filas2.count();
      for (let i = 0; i < n2; i++) {
        const texto = (await filas2.nth(i).innerText().catch(() => '')) || '';
        console.log(`  [tras filtro] fila [${i}]: ${texto.replace(/\n/g, ' | ').substring(0, 150)}`);
        if (/pendiente/i.test(texto)) { filaPendiente = filas2.nth(i); break; }
      }
    }
  }

  if (!filaPendiente) {
    console.log('⚠️ No se encontró ningún ingreso pendiente para inspeccionar. Abortando reconocimiento.');
    await browser.close();
    return;
  }

  // Abrir el detalle (ícono de ojo / botón menu-link)
  const verBtn = filaPendiente.locator('button, [role="button"]').first();
  await verBtn.click().catch(async () => {
    await filaPendiente.click();
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/recon-ingresos-detalle.png', fullPage: true }).catch(() => {});

  const registrarPagoBtn = page.getByRole('button', { name: /registrar pago/i }).first();
  if (!(await registrarPagoBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.log('⚠️ No se encontró botón "Registrar pago" en el detalle. Revisar screenshot recon-ingresos-detalle.png');
    await page.waitForTimeout(15000);
    await browser.close();
    return;
  }
  await registrarPagoBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/recon-ingresos-form-pago.png', fullPage: true }).catch(() => {});

  console.log('\n=== Inputs visibles en el formulario de pago ===');
  const inputs = page.locator('input:visible');
  const nInputs = await inputs.count();
  for (let i = 0; i < nInputs; i++) {
    const el = inputs.nth(i);
    const type = await el.getAttribute('type').catch(() => '');
    const name = await el.getAttribute('name').catch(() => '');
    const placeholder = await el.getAttribute('placeholder').catch(() => '');
    const readonly = await el.evaluate(e => e.readOnly || e.disabled).catch(() => null);
    const val = await el.inputValue().catch(() => '');
    console.log(`  [${i}] type="${type}" name="${name}" placeholder="${placeholder}" readonly/disabled=${readonly} valor="${val}"`);
  }

  console.log('\n\n(Navegador se deja abierto 30s para inspección manual)');
  await page.waitForTimeout(30000);
  await browser.close();
})();
