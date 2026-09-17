// Investigación puntual: ingresos.spec.ts reportó "No se encontró botón
// 'Registrar pago'" en Detalle de ingreso tras 12s, y la captura final muestra
// TODA la pantalla en estado skeleton (nada cargó: resúmenes, Cargos, Pagos).
// getFiscalData se vio con net::ERR_ABORTED. Antes de decidir si es el bug ya
// "resuelto" de DetallePagos reapareciendo o solo lentitud del entorno, hay
// que esperar de forma realista (CLAUDE.md §0.4) y ver la respuesta real de
// las APIs involucradas (getConsultation, verifyPlan, getCatalogs,
// getFiscalData x2), no solo si el botón aparece.
const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx' });
  const page = await context.newPage();

  const apiLog = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/')) {
      const t = Date.now();
      let body = null;
      try { body = await r.json(); } catch (_) {}
      apiLog.push({ t, status: r.status(), url: r.url(), body: body ? JSON.stringify(body).substring(0, 300) : null });
    }
  });
  page.on('requestfailed', (req) => {
    if (req.url().includes('/api/')) apiLog.push({ t: Date.now(), status: 'FAILED', url: req.url(), body: req.failure()?.errorText });
  });
  page.on('pageerror', (err) => console.log('💥 PAGEERROR:', err.message));

  await page.goto('/Ingresos');
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Filtrar Pendiente
  const estatusSelect = page.locator('select[name="estatus"]');
  await estatusSelect.selectOption({ label: 'Pendiente' }).catch(() => estatusSelect.selectOption('Pendiente').catch(()=>{}));
  await page.getByRole('button', { name: 'Buscar' }).click().catch(() => {});
  await page.waitForTimeout(3000);

  const pendientes = page.locator('.rdt_TableRow');
  const count = await pendientes.count();
  console.log(`Filas pendientes encontradas: ${count}`);
  if (count === 0) { console.log('No hay pendientes para investigar ahora mismo.'); await browser.close(); return; }

  const eyeButton = pendientes.last().locator('svg.fa-eye').locator('xpath=ancestor::button[1]').first();
  console.log('Abriendo el detalle del último ingreso pendiente...');
  const t0 = Date.now();
  await eyeButton.click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});

  // Poll realista hasta 60s por el botón "Registrar pago" O por confirmar que
  // el skeleton nunca se va.
  let apareció = false;
  for (let i = 0; i < 30; i++) {
    const btn = page.getByRole('button', { name: /registrar pago/i }).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      apareció = true;
      console.log(`✅ Botón "Registrar pago" apareció a los ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      break;
    }
    await page.waitForTimeout(2000);
  }
  if (!apareció) {
    console.log(`⚠️ El botón "Registrar pago" NO apareció tras ${((Date.now() - t0) / 1000).toFixed(1)}s de espera real.`);
  }

  const bodyText = await page.locator('body').innerText().catch(() => '');
  console.log('¿Contiene "Pagado"?', bodyText.includes('Pagado'));
  console.log('¿Contiene "Pendiente"?', bodyText.includes('Pendiente'));
  await page.screenshot({ path: 'test-results/_diag-detalle-ingreso-final.png', fullPage: true });

  console.log('\n=== Llamadas API relevantes (getConsultation/verifyPlan/getCatalogs/getFiscalData) ===');
  apiLog.filter(e => /getConsultation|verifyPlan|getCatalogs|getFiscalData/.test(e.url)).forEach(e => {
    console.log(`[+${((e.t - t0) / 1000).toFixed(2)}s] ${e.status} ${e.url.split('/api/')[1]} ${e.body ? '→ ' + e.body : ''}`);
  });

  await browser.close();
})();
