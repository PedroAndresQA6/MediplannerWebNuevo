const { chromium } = require('@playwright/test');
const { createAppointment, handleModals } = require('./e2e/utils.js');
require('dotenv').config({ path: '.env' });

// Prueba dedicada del Hallazgo 2 en DEV (sin el Hallazgo 1 en medio, que rompe
// la consulta a propósito): ¿un cambio hecho DESPUÉS de "Guardar cambios" se
// pierde si se hace clic en "Finalizar Consulta" sin volver a guardar?

const PACIENTE_BUSQUEDA = 'Daniela Jiménez';

async function sectionContainer(page, headingRegex, maxDepth = 10) {
  const heading = page.getByRole('heading', { level: 3, name: headingRegex }).first();
  await heading.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  for (let depth = 2; depth <= maxDepth; depth++) {
    const container = heading.locator(`xpath=ancestor::*[${depth}]`);
    if (await container.count() === 0) continue;
    const box = await container.boundingBox().catch(() => null);
    if (box && box.height > 100) return container;
  }
  return page;
}

// Maneja los 3 obstáculos posibles entre /Dashboard y el Dashboard real:
// "Cargando..." colgado, onboarding simple ("Prefiero explorar por mi
// cuenta") y el wizard extendido de "Configuración de tu cuenta"
// ("Configurar más tarde"). Reintenta hasta que ninguno esté presente.
async function irADashboard(page, maxIntentos = 6) {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    if (intento === 1) await page.goto('/Dashboard');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    const cargando = await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 15000 }).then(() => false).catch(() => true);
    if (cargando) {
      console.log(`⚠️ Intento ${intento}/${maxIntentos}: seguía en "Cargando..." — reload`);
      await page.reload();
      continue;
    }
    const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
    if (await explorarLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`ℹ️ Intento ${intento}/${maxIntentos}: onboarding simple detectado — clickeando`);
      await explorarLink.click({ force: true }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
      continue;
    }
    const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
    if (await configurarMasTardeLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`ℹ️ Intento ${intento}/${maxIntentos}: wizard de configuración detectado — clickeando "Configurar más tarde"`);
      await configurarMasTardeLink.click({ force: true }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
      continue;
    }
    return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  let capturedToken = null;
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !capturedToken) {
      const h = req.headers();
      if (h['x-rym-token-app']) capturedToken = h['x-rym-token-app'];
    }
  });

  try {
    console.log(`📅 Agendando cita nueva para "${PACIENTE_BUSQUEDA}" en dev...`);
    await createAppointment(page, PACIENTE_BUSQUEDA);

    console.log('\n🏠 Volviendo a Dashboard para iniciar la cita recién creada...');
    const dashboardOk = await irADashboard(page);
    if (!dashboardOk) {
      await page.screenshot({ path: 'test-results/dashboard-no-carga-diagnostico.png', fullPage: true }).catch(() => {});
      throw new Error('El Dashboard no terminó de cargar tras varios intentos. Screenshot: dashboard-no-carga-diagnostico.png');
    }
    await page.waitForTimeout(1500);

    // "Agenda de hoy" depende de otra llamada async, más lenta que el resto
    // del layout — esperar explícitamente a que aparezca al menos una fila
    // con hora antes de buscar el botón "Iniciar" (evita el falso negativo
    // de contarlos 0 justo antes de que terminen de poblarse).
    await page.waitForFunction(() => /\d{1,2}:\d{2}\s*(AM|PM)/i.test(document.body.innerText), { timeout: 20000 }).catch(() => {
      console.log('⚠️ No se detectó ninguna hora en la Agenda tras 20s — puede que no haya citas visibles.');
    });
    await page.waitForTimeout(1000);

    let targetBtn = null;
    for (let reintento = 1; reintento <= 3 && !targetBtn; reintento++) {
      const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
      const count = await iniciarButtons.count();
      for (let i = 0; i < count; i++) {
        const btn = iniciarButtons.nth(i);
        if (!(await btn.isVisible().catch(() => false))) continue;
        const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
        const texto = (await fila.textContent().catch(() => '') || '');
        if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.split(' ')[0].toLowerCase())) { targetBtn = btn; break; }
      }
      if (!targetBtn) {
        console.log(`⚠️ Reintento ${reintento}/3: ${count} botones "Iniciar" visibles, ninguno de "${PACIENTE_BUSQUEDA}" todavía — esperando 2s más...`);
        await page.waitForTimeout(2000);
      }
    }
    if (!targetBtn) throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_BUSQUEDA}"`);
    await targetBtn.click();

    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await signosButton.waitFor({ state: 'visible', timeout: 10000 });
    await signosButton.click();
    await page.waitForTimeout(1000);
    await page.locator('input[name="peso"]').fill('68');
    const tallaInput = page.locator('input[name*="talla" i]').first();
    if (await tallaInput.count() > 0) await tallaInput.fill('165');
    const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
    if (await presionInput.isVisible().catch(() => false)) await presionInput.fill('120/080');
    const tempInput = page.locator('input[name*="temp" i]');
    if (await tempInput.count() > 0) await tempInput.first().fill('36.5');
    const fcInput = page.locator('input[name*="card" i]');
    if (await fcInput.count() > 0) await fcInput.first().fill('75');
    const satInput = page.locator('input[name="oxigenacion"]');
    if (await satInput.count() > 0) await satInput.first().fill('98');
    const frInput = page.locator('input[name="frecuenciaRespiratoria"]');
    if (await frInput.count() > 0) await frInput.first().fill('16');
    await page.waitForTimeout(1000);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
      return btn && !btn.disabled;
    }, { timeout: 10000 }).catch(() => {});
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await page.waitForTimeout(2000);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await cerrarButton.isVisible().catch(() => false)) { await cerrarButton.click(); await page.waitForTimeout(1000); }

    try {
      await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
    } catch {
      await page.goto('/Consulta/ConsultaGeneral');
      await page.waitForLoadState('load').catch(() => {});
    }
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('✅ Consulta iniciada.\n');

    await page.locator('textarea[name="visitaPaciente"]').fill('Paciente acude por dolor de cabeza intenso, 2 días de evolución.').catch(() => {});

    const diagScope = await sectionContainer(page, /^Diagnóstico$/i);
    const cie10Input = diagScope.locator('textarea[role="combobox"]').first();
    if (await cie10Input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cie10Input.click();
      await page.waitForTimeout(500);
      await cie10Input.fill('R51');
      await page.waitForTimeout(1500);
      const opts = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      if (await opts.count() > 0) await opts.first().click();
    }
    const impresionInicial = 'Impresión diagnóstica inicial: cefalea tensional probable.';
    const impresion = diagScope.locator('textarea[placeholder="Impresión diagnóstica"]').first();
    if (await impresion.isVisible({ timeout: 2000 }).catch(() => false)) await impresion.fill(impresionInicial);
    console.log(`✅ Diagnóstico llenado, Impresión diagnóstica = "${impresionInicial}"`);

    console.log('\n💾 Clickeando "Guardar cambios" (global)...');
    const guardarGlobalBtn = page.locator('button:has-text("Guardar cambios")').first();
    await guardarGlobalBtn.waitFor({ state: 'visible', timeout: 10000 });
    await handleModals(page);
    await guardarGlobalBtn.click();
    await page.waitForTimeout(5000);
    await handleModals(page);
    console.log('✅ Guardado global disparado.');

    console.log('\n=== HALLAZGO 2: cambiar Impresión diagnóstica y Finalizar SIN volver a guardar ===');
    const impresionFinal = 'IMPRESION_CAMBIADA_SIN_GUARDAR_' + Date.now();
    const diagScope2 = await sectionContainer(page, /^Diagnóstico$/i);
    const impresion2 = diagScope2.locator('textarea[placeholder="Impresión diagnóstica"]').first();
    await impresion2.fill(impresionFinal);
    console.log(`✅ Impresión diagnóstica cambiada a "${impresionFinal}" — NO se va a volver a clickear "Guardar cambios"`);

    const finalizarBtn = page.getByRole('button', { name: /finalizar consulta/i }).first();
    await finalizarBtn.waitFor({ state: 'visible', timeout: 15000 });
    const finPromise = page.waitForResponse(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 15000 }).catch(() => null);
    await finalizarBtn.click();
    const finResp = await finPromise;
    console.log(`finishConsultation status: ${finResp ? finResp.status() : 'sin respuesta detectada'}`);
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) await confirmBtn.click();

    console.log('\n🔍 Verificando el estado final vía API...');
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('.rdt_TableRow', { timeout: 20000 }).catch(() => {});
    const buscar = page.locator('input[placeholder*="Buscar" i]').first();
    await buscar.fill(PACIENTE_BUSQUEDA);
    await page.waitForTimeout(2000);

    let consultationsBody = null;
    page.on('response', async (r) => {
      if (r.url().includes('/api/consultations/getConsultations')) consultationsBody = await r.json().catch(() => null);
    });
    const fila = page.locator('span.font-semibold.text-sm.text-gray-900', { hasText: PACIENTE_BUSQUEDA }).first();
    await fila.click();
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(2000);
    const pacienteIdMatch = page.url().match(/\/(\d+)(?:\/|$)/);
    const consultasTab = page.locator('button:has-text("Consultas")').first();
    const respPromise2 = page.waitForResponse(r => r.url().includes('/api/consultations/getConsultations'), { timeout: 15000 }).catch(() => null);
    await consultasTab.click();
    await respPromise2;
    await page.waitForTimeout(2000);

    const consultas = consultationsBody?.data?.consultations || [];
    const masReciente = consultas.reduce((max, c) => (!max || c.id > max.id) ? c : max, null);
    if (!masReciente) { console.log('⚠️ No se pudo obtener la consulta recién creada.'); await browser.close(); return; }
    const pacienteId = masReciente.paciente_id || masReciente.iUsuarioId || (pacienteIdMatch ? pacienteIdMatch[1] : null);
    console.log(`Consulta verificada: id=${masReciente.id} paciente_id=${pacienteId} estatus=${masReciente.estatus}`);

    const detalle = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
      const resp = await fetch('/api/consultations/getConsultation', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
        body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }), credentials: 'include',
      });
      return resp.json();
    }, { pacienteId, consultaId: masReciente.id, tok: capturedToken });

    const impresionFinalGuardada = detalle?.data?.impresion_diagnostico;
    console.log(`\nImpresión diagnóstica final guardada: "${impresionFinalGuardada}"`);
    if (impresionFinalGuardada === impresionFinal) {
      console.log('\nℹ️ [Hallazgo2-Repro-Dev] NO se reprodujo en dev: el último cambio SÍ se persistió al finalizar sin re-guardar (distinto a producción).');
    } else if (impresionFinalGuardada === impresionInicial) {
      console.log('\n🐛 [Hallazgo2-Repro-Dev] REPRODUCIDO EN DEV: el último cambio a Impresión diagnóstica SE PERDIÓ al finalizar sin re-guardar — igual que en producción.');
    } else {
      console.log(`\nℹ️ [Hallazgo2-Repro-Dev] Valor final no coincide con ninguno de los 2 esperados — revisar manualmente: "${impresionFinalGuardada}"`);
    }
  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/hallazgo2-dev-error.png', fullPage: true }).catch(() => {});
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
