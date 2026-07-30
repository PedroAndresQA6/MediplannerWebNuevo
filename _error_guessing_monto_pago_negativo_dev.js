const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Continuación: probar monto NEGATIVO y monto CERO en el saldo restante del
// mismo ingreso de "Carla Perez Rojas" (ya se pagaron $500 de $700, quedan
// $200 pendientes en el otro concepto). El escenario de sobrepago (999999)
// NO fue un bug: el backend recibió el monto REAL ($500), el input visible
// no se refleja tal cual — hay que revisar el BODY real de cada request, no
// solo si el status fue 2xx.

const PACIENTE_BUSQUEDA = 'Carla Perez';

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
    if (await explorarLink.isVisible({ timeout: 2000 }).catch(() => false)) { await explorarLink.click({ force: true }).catch(() => {}); await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); }
    const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
    if (await configurarMasTardeLink.isVisible({ timeout: 2000 }).catch(() => false)) { await configurarMasTardeLink.click({ force: true }).catch(() => {}); await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); }
  };

  let ingresosLink = null;
  for (let intento = 1; intento <= 4 && !ingresosLink; intento++) {
    if (intento === 1) await page.goto('/Dashboard'); else await page.reload();
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

  const buscarInput = page.locator('input[placeholder*="Buscar" i], input[placeholder*="Paciente" i]').first();
  if (await buscarInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await buscarInput.fill(PACIENTE_BUSQUEDA);
    await page.waitForTimeout(2000);
  }

  const filas = page.locator('.rdt_TableRow');
  const n = await filas.count();
  let filaPendiente = null;
  let datosFila = '';
  for (let i = 0; i < n; i++) {
    const texto = (await filas.nth(i).innerText().catch(() => '')) || '';
    if (/pendiente/i.test(texto) && new RegExp(PACIENTE_BUSQUEDA, 'i').test(texto)) { filaPendiente = filas.nth(i); datosFila = texto; break; }
  }
  if (!filaPendiente) throw new Error(`No se encontró ingreso "Pendiente" para "${PACIENTE_BUSQUEDA}"`);
  console.log(`💰 Ingreso: ${datosFila.replace(/\n/g, ' | ')}`);

  await filaPendiente.locator('button').first().click();
  await page.waitForTimeout(2500);
  const registrarPagoBtn = page.getByRole('button', { name: /registrar pago/i }).first();
  if (!(await registrarPagoBtn.isVisible({ timeout: 8000 }).catch(() => false))) throw new Error('No se encontró "Registrar pago"');
  await registrarPagoBtn.click();
  await page.waitForTimeout(2000);

  const radios = page.locator('input[name="servicio"]');
  const nRadios = await radios.count();
  console.log(`Conceptos disponibles: ${nRadios}`);
  // Elegir el concepto con saldo > 0 (puede que el índice 0 ya esté pagado).
  let elegido = -1;
  for (let i = 0; i < nRadios; i++) {
    await radios.nth(i).click();
    await page.waitForTimeout(400);
    const montoActual = await page.locator('input[name="subtotal"]').inputValue().catch(() => '0');
    console.log(`  concepto[${i}] monto prellenado = ${montoActual}`);
    if (parseFloat(montoActual) > 0) { elegido = i; break; }
  }
  if (elegido === -1) {
    console.log('✅ Ningún concepto con saldo pendiente — el ingreso ya quedó saldado con el pago anterior.');
    await browser.close();
    return;
  }

  const montoInput = page.locator('input[name="subtotal"]');

  // ── Escenario B: monto negativo ──
  console.log('\n########## ESCENARIO B: monto = -100 ##########');
  await montoInput.fill('-100');
  await page.waitForTimeout(500);
  const metodoBtnB = page.getByRole('button', { name: /efectivo/i }).first();
  if (await metodoBtnB.isVisible({ timeout: 3000 }).catch(() => false)) await metodoBtnB.click();
  await page.waitForTimeout(500);
  const confirmarBtnB = page.getByRole('button', { name: /^registrar pago$/i }).last();
  const habilitadoB = await confirmarBtnB.isEnabled().catch(() => false);
  console.log(`¿Botón habilitado con monto=-100? ${habilitadoB}`);
  const marcaB = llamadas.length;
  if (habilitadoB) { await confirmarBtnB.click(); await page.waitForTimeout(2500); }
  const nuevasB = llamadas.slice(marcaB);
  nuevasB.forEach(l => console.log(`  → ${l.url} | body=${l.body} | status=${l.status} | resp=${l.respBody}`));
  const registerPaymentB = nuevasB.find(l => /registerPayment/i.test(l.url));
  if (registerPaymentB && registerPaymentB.status && registerPaymentB.status < 300) {
    const bodyParsed = JSON.parse(registerPaymentB.body || '{}');
    if (bodyParsed.monto < 0) {
      console.log(`⚠️⚠️ HALLAZGO CONFIRMADO: el backend registró un pago con monto NEGATIVO (${bodyParsed.monto}) sin rechazarlo.`);
    } else {
      console.log(`✅ El backend ignoró/corrigió el monto negativo (envió monto=${bodyParsed.monto} en vez de -100) — sin hallazgo.`);
    }
  } else if (registerPaymentB) {
    console.log(`✅ El backend rechazó el monto negativo: status=${registerPaymentB.status} resp=${registerPaymentB.respBody}`);
  } else {
    console.log('✅ El front bloqueó el guardado antes de llegar al backend con monto negativo.');
  }
  await page.screenshot({ path: 'test-results/eg-monto-B-negativo.png', fullPage: true }).catch(() => {});

  console.log('\n\n=== FIN ===');
  await page.waitForTimeout(20000);
  await browser.close();
})();
