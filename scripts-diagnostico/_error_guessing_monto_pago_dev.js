const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Error guessing NUEVO (2026-07-30): el campo "Monto" (input[name="subtotal"])
// del formulario "Registrar pago" en Ingresos es un <input type="text">
// editable (confirmado por reconocimiento previo, NO deshabilitado). ¿Permite
// sobrepago (monto > adeudo del concepto) o montos negativos/cero? Esto
// afectaría directamente el saldo financiero del paciente si el backend lo
// acepta tal cual.

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  const llamadas = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/') && r.method() === 'POST') {
      llamadas.push({ url: r.url().split('/api/')[1], body: r.postData(), status: null, respBody: null });
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/') && r.request().method() === 'POST') {
      const entry = llamadas.slice().reverse().find(e => e.url === r.url().split('/api/')[1] && e.status === null);
      if (entry) { entry.status = r.status(); entry.respBody = (await r.text().catch(() => '')).substring(0, 400); }
    }
  });

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
    const candidato = page.locator('a.menu-link').filter({ hasText: /^ingresos$/i }).first();
    if (await candidato.isVisible({ timeout: 4000 }).catch(() => false)) ingresosLink = candidato;
  }
  if (!ingresosLink) throw new Error('No se encontró el link "Ingresos"');
  await ingresosLink.click();
  await page.waitForTimeout(2500);
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`📍 URL de Ingresos: ${page.url()}`);

  const filas = page.locator('.rdt_TableRow');
  const n = await filas.count();
  let filaPendiente = null;
  let datosFila = '';
  for (let i = 0; i < n; i++) {
    const texto = (await filas.nth(i).innerText().catch(() => '')) || '';
    if (/pendiente/i.test(texto)) { filaPendiente = filas.nth(i); datosFila = texto; break; }
  }
  if (!filaPendiente) throw new Error('No se encontró ningún ingreso "Pendiente" para probar');
  console.log(`💰 Ingreso pendiente elegido: ${datosFila.replace(/\n/g, ' | ')}`);

  const verBtn = filaPendiente.locator('button').first();
  await verBtn.click();
  await page.waitForTimeout(2500);

  const registrarPagoBtn = page.getByRole('button', { name: /registrar pago/i }).first();
  if (!(await registrarPagoBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
    throw new Error('No se encontró botón "Registrar pago" en el detalle');
  }
  await registrarPagoBtn.click();
  await page.waitForTimeout(2000);

  // Elegir el primer concepto (radio "servicio") con saldo > 0.
  const radios = page.locator('input[name="servicio"]');
  const nRadios = await radios.count();
  console.log(`Conceptos (radios "servicio") disponibles: ${nRadios}`);
  await radios.first().click();
  await page.waitForTimeout(500);

  const montoInput = page.locator('input[name="subtotal"]');
  const montoOriginal = await montoInput.inputValue().catch(() => '');
  console.log(`Monto original prellenado (adeudo del concepto): "${montoOriginal}"`);
  await page.screenshot({ path: 'test-results/eg-monto-0-original.png', fullPage: true }).catch(() => {});

  // ── Escenario A: SOBREPAGO (monto muy superior al adeudo real) ──
  console.log('\n########## ESCENARIO A: monto = 999999 (muy superior al adeudo real) ##########');
  await montoInput.fill('999999');
  await page.waitForTimeout(500);
  const metodoBtn = page.getByRole('button', { name: /efectivo/i }).first();
  if (await metodoBtn.isVisible({ timeout: 3000 }).catch(() => false)) await metodoBtn.click();
  await page.waitForTimeout(500);
  const confirmarBtnA = page.getByRole('button', { name: /^registrar pago$/i }).last();
  const habilitadoA = await confirmarBtnA.isEnabled().catch(() => false);
  console.log(`¿Botón final "Registrar pago" habilitado con monto=999999? ${habilitadoA}`);
  await page.screenshot({ path: 'test-results/eg-monto-A-sobrepago-form.png', fullPage: true }).catch(() => {});

  const marcaA = llamadas.length;
  if (habilitadoA) {
    await confirmarBtnA.click();
    await page.waitForTimeout(2500);
  }
  const nuevasA = llamadas.slice(marcaA);
  console.log(`Llamadas POST (${nuevasA.length}):`);
  nuevasA.forEach(l => console.log(`  → ${l.url} | body=${l.body} | status=${l.status} | resp=${l.respBody}`));
  const pagoRegistradoA = nuevasA.some(l => /registerPayment/i.test(l.url) && l.status && l.status < 300);
  if (pagoRegistradoA) {
    console.log('⚠️⚠️ POSIBLE HALLAZGO: el backend aceptó un pago de $999,999 sobre un adeudo mucho menor (sobrepago sin validar).');
  } else {
    console.log('✅ El sobrepago fue bloqueado (front o backend).');
  }
  await page.screenshot({ path: 'test-results/eg-monto-A-sobrepago-despues.png', fullPage: true }).catch(() => {});

  console.log('\n\n=== FIN (dejando navegador abierto 25s para revisar manualmente el escenario B/C si hace falta) ===');
  await page.waitForTimeout(25000);
  await browser.close();
})();
