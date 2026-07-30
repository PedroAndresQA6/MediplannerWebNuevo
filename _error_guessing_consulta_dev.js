const { chromium } = require('@playwright/test');
const { createAppointment, handleModals } = require('./e2e/utils.js');
require('dotenv').config({ path: '.env' });

// Misma investigación de "error guessing" que _error_guessing_consulta_produccion.js,
// corrida ahora contra DEV para comprobar si los 2 hallazgos confirmados en
// producción (2026-07-27) se reproducen también aquí: (1) navegar fuera de la
// consulta y volver la deja colgada en "Cargando información de consulta";
// (2) editar un campo después de "Guardar cambios" y Finalizar sin re-guardar
// pierde ese cambio en silencio. Usa el createAppointment REAL de e2e/utils.js
// (dev ya tiene el fix del wizard aplicado, a diferencia de producción).

const PACIENTE_BUSQUEDA = 'Daniela Jiménez';

const hallazgos = [];
function reportar(escenario, severidad, descripcion) {
  hallazgos.push({ escenario, severidad, descripcion });
  console.log(`\n${severidad === 'BUG' ? '🐛' : 'ℹ️'} [${escenario}] ${descripcion}`);
}

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

// Dev es conocido por ser flaky (bundles que abortan) — reintenta con reload
// hasta 3 veces en vez de fallar directo a la primera vez que se cuelga.
async function irADashboard(page) {
  for (let intento = 1; intento <= 3; intento++) {
    if (intento === 1) await page.goto('/Dashboard');
    else await page.reload();
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    const cargando = await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).then(() => false).catch(() => true);
    if (!cargando) return true;
    console.log(`⚠️ Dashboard seguía en "Cargando..." (intento ${intento}/3)`);
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
  const context = await browser.newContext({
    storageState: 'storageState.json',
    viewport: null,
    baseURL: base,
  });
  const page = await context.newPage();

  let capturedToken = null;
  let doctorId = null;
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !capturedToken) {
      const h = req.headers();
      if (h['x-rym-token-app']) capturedToken = h['x-rym-token-app'];
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/profile/getProfile')) {
      const body = await r.json().catch(() => null);
      if (body?.data?.id) doctorId = body.data.id;
    }
  });
  const erroresApi = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`);
  });

  try {
    console.log(`📅 Agendando cita nueva para "${PACIENTE_BUSQUEDA}" en dev...`);
    await createAppointment(page, PACIENTE_BUSQUEDA);

    console.log('\n🏠 Volviendo a Dashboard para iniciar la cita recién creada...');
    let dashboardOk = await irADashboard(page);
    if (!dashboardOk) {
      await page.screenshot({ path: 'test-results/dashboard-no-carga-diagnostico.png', fullPage: true }).catch(() => {});
      throw new Error('El Dashboard no terminó de cargar tras 3 intentos (con reload). Screenshot: dashboard-no-carga-diagnostico.png');
    }
    await page.waitForTimeout(1500);

    const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
    if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('ℹ️ Pantalla de onboarding detectada — clickeando "Prefiero explorar por mi cuenta"');
      await explorarLink.click({ force: true }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
      await page.waitForTimeout(1500);
    }

    // Esta cuenta de dev puede caer en un wizard de "Configuración de tu
    // cuenta" (6 pasos: perfil/credenciales/consultorios/horarios/tipos de
    // cita/métodos de pago) en vez del Dashboard directo — distinto del
    // onboarding simple visto en producción. Buscar su salida ("Configurar
    // más tarde" u opción equivalente) antes de seguir insistiendo en /Dashboard.
    const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
    if (await configurarMasTardeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('ℹ️ Wizard de "Configuración de tu cuenta" detectado — clickeando "Configurar más tarde"');
      await configurarMasTardeLink.click({ force: true }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
      await page.waitForTimeout(1500);
    }

    dashboardOk = await irADashboard(page);
    if (!dashboardOk) {
      await page.screenshot({ path: 'test-results/dashboard-no-carga-diagnostico.png', fullPage: true }).catch(() => {});
      throw new Error('El Dashboard no terminó de cargar tras el onboarding (3 intentos con reload). Screenshot: dashboard-no-carga-diagnostico.png');
    }
    await page.waitForTimeout(1500);

    // Por si el wizard de configuración vuelve a aparecer tras ir a Dashboard.
    if (await configurarMasTardeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('ℹ️ Wizard de configuración reapareció — clickeando "Configurar más tarde" de nuevo');
      await configurarMasTardeLink.click({ force: true }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
      dashboardOk = await irADashboard(page);
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'test-results/dashboard-pre-iniciar-diagnostico.png', fullPage: true }).catch(() => {});

    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    let targetBtn = null;
    for (let i = 0; i < count; i++) {
      const btn = iniciarButtons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      const texto = (await fila.textContent().catch(() => '') || '');
      if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.split(' ')[0].toLowerCase())) { targetBtn = btn; break; }
    }
    if (!targetBtn) throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_BUSQUEDA}" tras crear su cita`);
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
    console.log('✅ Consulta iniciada, lista para los escenarios de error.\n');

    // ═══════════════════════════════════════════════════════════════════
    // HALLAZGO 1 (repro): navegar a /Pacientes y volver a /Consulta/ConsultaGeneral
    // ═══════════════════════════════════════════════════════════════════
    console.log('=== HALLAZGO 1: navegar a Pacientes y volver por URL directa ===');
    const notasScope = await sectionContainer(page, /^Notas del Médico/i);
    const notasEditor = notasScope.locator('div.jodit-wysiwyg').first();
    const textoSinGuardar = 'TEXTO_NO_GUARDADO_' + Date.now();
    await notasEditor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(textoSinGuardar);
    console.log(`✅ Texto sin guardar escrito en Notas: "${textoSinGuardar}"`);

    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);
    await page.goto('/Consulta/ConsultaGeneral');
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const siguioColgada = await page.locator('body').innerText().then(t => t.includes('Cargando información de consulta')).catch(() => false);
    if (siguioColgada) {
      reportar('Hallazgo1-Repro', 'BUG', 'REPRODUCIDO EN DEV: navegar a /Pacientes y volver a /Consulta/ConsultaGeneral por URL directa dejó la página colgada en "Cargando información de consulta".');
      await page.reload();
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
      await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const siguioColgadaTrasReload = await page.locator('body').innerText().then(t => t.includes('Cargando información de consulta')).catch(() => false);
      reportar('Hallazgo1-Repro-Reload', siguioColgadaTrasReload ? 'BUG' : 'INFO', `Tras F5 de recuperación: ${siguioColgadaTrasReload ? 'SIGUE colgada (igual que en producción)' : 'se recuperó (distinto a producción, donde el reload tampoco funcionó)'}`);
    } else {
      reportar('Hallazgo1-Repro', 'NO-REPRO', 'NO se reprodujo en dev: navegar a Pacientes y volver cargó la consulta con normalidad.');
    }

    const notasEditorDespues = (await sectionContainer(page, /^Notas del Médico/i)).locator('div.jodit-wysiwyg').first();
    const contenidoNotasDespues = (await notasEditorDespues.textContent().catch(() => '') || '');
    if (contenidoNotasDespues.includes(textoSinGuardar)) {
      reportar('Notas-Autosave', 'BUG', `El texto NO guardado de Notas persistió: "${contenidoNotasDespues.substring(0, 150)}"`);
    } else {
      reportar('Notas-Autosave', 'OK', 'Confirmado: sin autosave fantasma en Notas.');
    }

    // Si quedó colgada sin recuperar, no tiene sentido seguir con el resto en
    // esta misma consulta — cortar aquí y reportar lo ya confirmado.
    const motivoVisibleParaContinuar = await page.locator('textarea[name="visitaPaciente"]').isVisible().catch(() => false);
    if (!motivoVisibleParaContinuar) {
      console.log('\n⚠️ La consulta no se recuperó — no se puede continuar con el resto de los escenarios en esta misma sesión. Se corta aquí (el Hallazgo 1 ya quedó confirmado/descartado arriba).');
      console.log('\n\n════════════════ RESUMEN DE HALLAZGOS (parcial) ════════════════');
      hallazgos.forEach(h => console.log(`[${h.severidad}] ${h.escenario}: ${h.descripcion}`));
      await page.waitForTimeout(2000);
      await browser.close();
      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Llenar el resto de la consulta para poder probar el Hallazgo 2
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== Llenando el resto de secciones para llegar a Finalizar ===');
    await page.locator('textarea[name="visitaPaciente"]').fill('Paciente acude por dolor de cabeza intenso, 2 días de evolución.').catch(() => {});

    const aparatosScope = await sectionContainer(page, /^Aparatos y sistemas$/i);
    const cbAparatos = aparatosScope.locator('input[type="checkbox"]:not([disabled])');
    const totalAp = await cbAparatos.count();
    for (let i = 0; i < Math.min(3, totalAp); i++) await cbAparatos.nth(i).click({ force: true }).catch(() => {});
    const guardarApBtn = aparatosScope.locator('button:has-text("Guardar Respuestas")').first();
    if (await guardarApBtn.isVisible({ timeout: 3000 }).catch(() => false)) { await guardarApBtn.click(); await page.waitForTimeout(1500); await handleModals(page); }

    const expScope = await sectionContainer(page, /^Exploración segmentaria$/i);
    const cbExp = expScope.locator('input[type="checkbox"]:not([disabled])');
    const totalExp = await cbExp.count();
    for (let i = 0; i < Math.min(3, totalExp); i++) await cbExp.nth(i).click({ force: true }).catch(() => {});
    const guardarExpBtn = expScope.locator('button:has-text("Guardar Respuestas")').first();
    if (await guardarExpBtn.isVisible({ timeout: 3000 }).catch(() => false)) { await guardarExpBtn.click(); await page.waitForTimeout(1500); await handleModals(page); }

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

    const tratScope = await sectionContainer(page, /^Tratamiento$/i);
    const medInput = tratScope.locator('#react-select-2-input');
    if (await medInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await medInput.click();
      await medInput.fill('Ibuprofeno');
      await page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }).catch(() => null);
      const opts = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      if (await opts.count() > 0) await opts.first().click();
      await page.waitForLoadState('load').catch(() => {});
      await page.waitForTimeout(1500);
      const dosisInput = page.locator('input[name="dosis_cantidad"]');
      if (await dosisInput.isVisible().catch(() => false)) await dosisInput.fill('1');
      const viaSelect = page.locator('select[name="iViaAdministracionId-0"]');
      if (await viaSelect.isVisible().catch(() => false)) await viaSelect.selectOption({ index: 1 });
      const unidadSelect = page.locator('select[name="unidad_dosis_id-0"]');
      if (await unidadSelect.isVisible().catch(() => false)) await unidadSelect.selectOption({ index: 1 });
      const frecuenciaInput = page.locator('input[name="frecuencia_cantidad"]');
      if (await frecuenciaInput.isVisible().catch(() => false)) await frecuenciaInput.fill('8');
      const duracionInput = page.locator('input[name="tiempo_cantidad"]');
      if (await duracionInput.isVisible().catch(() => false)) await duracionInput.fill('10');
      const tiempoSelect = page.locator('select[name="unidad_tiempo_id-0"]');
      if (await tiempoSelect.isVisible().catch(() => false)) await tiempoSelect.selectOption({ index: 1 });
    }

    const servScope = await sectionContainer(page, /^Servicios$/i);
    const servDropdown = servScope.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible').first();
    if (await servDropdown.count() > 0) {
      await servDropdown.click();
      await page.waitForTimeout(1500);
      const servMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
      const servOpts = servMenu.locator('[class*="option"], [role="option"]');
      if (await servOpts.count() > 0) await servOpts.first().click();
    }
    console.log('✅ Resto de secciones llenadas.');

    console.log('\n💾 Clickeando "Guardar cambios" (global)...');
    const guardarGlobalBtn = page.locator('button:has-text("Guardar cambios")').first();
    await guardarGlobalBtn.waitFor({ state: 'visible', timeout: 10000 });
    await handleModals(page);
    await guardarGlobalBtn.click();
    await page.waitForTimeout(5000);
    await handleModals(page);
    console.log('✅ Guardado global disparado.');

    // ═══════════════════════════════════════════════════════════════════
    // HALLAZGO 2 (repro): Finalizar sin re-guardar el último cambio
    // ═══════════════════════════════════════════════════════════════════
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

    if (erroresApi.length > 0) {
      console.log(`\n🔴 ${erroresApi.length} respuesta(s) de API con error durante todo el flujo:`);
      erroresApi.forEach(e => console.log('   ' + e));
    } else {
      console.log('\n✅ 0 respuestas de API con error durante todo el flujo.');
    }

    // ═══════════════════════════════════════════════════════════════════
    // VERIFICACIÓN FINAL vía API
    // ═══════════════════════════════════════════════════════════════════
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
      reportar('Hallazgo2-Repro', 'NO-REPRO', 'NO se reprodujo en dev: el último cambio SÍ se persistió al finalizar sin re-guardar — "Finalizar Consulta" guarda cambios pendientes en dev (distinto a producción).');
    } else if (impresionFinalGuardada === impresionInicial) {
      reportar('Hallazgo2-Repro', 'BUG', `REPRODUCIDO EN DEV: el último cambio a Impresión diagnóstica SE PERDIÓ al finalizar sin re-guardar (quedó "${impresionFinalGuardada}").`);
    } else {
      reportar('Hallazgo2-Repro', 'INFO', `Valor final no coincide con ninguno de los 2 esperados — revisar manualmente: "${impresionFinalGuardada}"`);
    }

    console.log('\n\n════════════════ RESUMEN DE HALLAZGOS ════════════════');
    hallazgos.forEach(h => console.log(`[${h.severidad}] ${h.escenario}: ${h.descripcion}`));

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/error-guessing-dev-error.png', fullPage: true }).catch(() => {});
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
