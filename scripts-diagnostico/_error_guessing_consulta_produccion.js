const { chromium } = require('@playwright/test');

// "Error guessing" contra PRODUCCIÓN: agenda una cita NUEVA para "Prueba DE
// Codigo" y, dentro de esa misma consulta (Modo Completo), intenta provocar
// varios errores humanos reales que un médico podría cometer usando la
// plataforma: typos corregidos, flujos interrumpidos sin guardar, carreras
// al cambiar de opción rápido, doble-clicks accidentales en botones de
// guardado, y finalizar sin guardar el último cambio. Cada escenario se
// verifica contra el estado REAL devuelto por la API, no solo la UI.
// Adaptado de tests/consultation.user-errors.spec.js (dev, modelo de
// pestañas viejo, nunca corrido) al "Modo Completo" ya confirmado en
// producción el 2026-07-27.

const BASE = 'https://admin.mediplanner.mx/';
const PACIENTE_BUSQUEDA = 'Prueba DE Codigo';

const hallazgos = []; // { escenario, severidad, descripcion }
function reportar(escenario, severidad, descripcion) {
  hallazgos.push({ escenario, severidad, descripcion });
  console.log(`\n${severidad === 'BUG' ? '🐛' : 'ℹ️'} [${escenario}] ${descripcion}`);
}

async function handleModals(page) {
  try {
    const swalModal = page.locator('.swal2-popup.swal2-modal:visible');
    if (await swalModal.count() > 0) {
      const confirmBtn = swalModal.locator('.swal2-confirm:visible, .swal2-button:visible');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.first().click({ timeout: 2000 });
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    }
  } catch (e) { /* no bloquear */ }
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

// ── Agendar cita (fix del wizard ya confirmado en dev 2026-07-09) ──────────
async function crearCitaProduccion(page, patientSearch) {
  console.log(`📅 Agendando cita nueva para "${patientSearch}"...`);
  await page.goto('/Citas');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const agendarButton = page.getByRole('button', { name: /agendar cita/i }).first();
  await agendarButton.waitFor({ state: 'visible', timeout: 10000 });
  await agendarButton.click();

  const wizardHeading = page.getByRole('heading', { name: 'Agendar cita' });
  await wizardHeading.waitFor({ state: 'visible', timeout: 10000 });
  const wizard = wizardHeading.locator('xpath=ancestor::div[.//input][1]');

  const combos = wizard.getByRole('combobox');
  await combos.first().waitFor({ state: 'visible', timeout: 10000 });
  await combos.first().click();
  await page.waitForTimeout(500);
  await combos.first().fill(patientSearch);
  await page.waitForTimeout(2000);
  const optSel = '[id*="react-select"][id*="option"], [role="option"], [class*="option"]';
  let elegido = null;
  for (let intento = 1; intento <= 5 && !elegido; intento++) {
    const opciones = page.locator(optSel);
    const count = await opciones.count();
    for (let k = 0; k < count; k++) {
      const t = (await opciones.nth(k).textContent().catch(() => '') || '').toLowerCase();
      if (t.includes(patientSearch.toLowerCase()) || t.includes('prueba')) { elegido = opciones.nth(k); break; }
    }
    if (!elegido) { await page.waitForTimeout(1000); }
  }
  if (!elegido) throw new Error(`No se encontró la opción del paciente "${patientSearch}" en el wizard`);
  await elegido.click();

  const continueBtn = page.getByRole('button', { name: /continuar/i });
  await page.waitForTimeout(1000);
  await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
  await continueBtn.click();
  await page.waitForTimeout(1500);

  const selectsStep2 = page.locator('select:visible');
  const selCount = await selectsStep2.count();
  if (selCount > 0) {
    const opts0 = await selectsStep2.nth(0).locator('option').count();
    if (opts0 > 1) await selectsStep2.nth(0).selectOption({ index: 1 });
  }
  if (selCount > 1) {
    await page.waitForTimeout(1500);
    const opts1 = await selectsStep2.nth(1).locator('option').count();
    if (opts1 > 1) await selectsStep2.nth(1).selectOption({ index: 1 });
  }
  await page.waitForTimeout(1000);
  const continueBtn2 = page.getByRole('button', { name: /continuar/i });
  if (await continueBtn2.isVisible({ timeout: 5000 }).catch(() => false)) await continueBtn2.click();

  await page.waitForTimeout(2000);
  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.waitFor({ state: 'visible', timeout: 10000 });

  for (let dayOffset = 0; dayOffset < 15; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
    try {
      await dateInput.fill(dateStr);
      await page.waitForTimeout(2000);
      await handleModals(page);
      const hours = page.locator('text=/\\d{2}:\\d{2}/');
      const hourCount = await hours.count();
      if (hourCount === 0) continue;

      let horaSeleccionada = false;
      for (let i = 0; i < Math.min(hourCount, 5); i++) {
        try {
          await hours.nth(i).click({ timeout: 5000 });
          await page.waitForTimeout(1000);
          await handleModals(page);
          const errorModal = page.locator('.swal2-popup, [role="dialog"]:visible');
          if (await errorModal.count() > 0) continue;
          horaSeleccionada = true;
          break;
        } catch { continue; }
      }
      if (!horaSeleccionada) continue;

      await page.getByRole('button', { name: /continuar/i }).click();
      await page.waitForTimeout(1000);
      const confirmarBtn = page.getByRole('button', { name: /confirmar cita/i });
      await confirmarBtn.scrollIntoViewIfNeeded();
      await confirmarBtn.click();
      await page.getByRole('heading', { name: /cita agendada/i }).waitFor({ state: 'visible', timeout: 10000 });
      console.log(`✅ Cita agendada exitosamente en ${dateStr}`);
      return;
    } catch (error) {
      console.log(`⚠️ Error en fecha ${dateStr}: ${error.message}`);
      await handleModals(page);
      continue;
    }
  }
  throw new Error('No se pudo registrar una cita en los próximos 15 días');
}

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({
    storageState: 'Mediplanner produccion/storageState.json',
    viewport: null,
    baseURL: BASE,
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
    // ── Setup: Dashboard + onboarding + agendar cita + iniciar consulta ────
    await page.goto('/Dashboard');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
    if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await explorarLink.click();
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
      await page.waitForTimeout(1500);
    }

    await crearCitaProduccion(page, PACIENTE_BUSQUEDA);

    console.log('\n🏠 Volviendo a Dashboard para iniciar la cita recién creada...');
    await page.goto('/Dashboard');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    let targetBtn = null;
    for (let i = 0; i < count; i++) {
      const btn = iniciarButtons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      const texto = (await fila.textContent().catch(() => '') || '');
      if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.toLowerCase())) { targetBtn = btn; break; }
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
    // ESCENARIO A: typo en Motivo, corregido ANTES de guardar
    // ═══════════════════════════════════════════════════════════════════
    console.log('=== ESCENARIO A: typo en Motivo corregido antes de guardar ===');
    const motivoInput = page.locator('textarea[name="visitaPaciente"]');
    const motivoConTypo = 'Paceinte acude por dolro de cabeza';
    const motivoCorregido = 'Paciente acude por dolor de cabeza intenso, 2 días de evolución.';
    await motivoInput.fill(motivoConTypo);
    await page.waitForTimeout(300);
    await motivoInput.fill('');
    await motivoInput.fill(motivoCorregido);
    console.log(`✅ Motivo escrito con typo ("${motivoConTypo}"), corregido a "${motivoCorregido}" (aún sin guardar)`);

    // NOTA: el escenario D (Notas sin guardar + navegar a /Pacientes + volver)
    // se corrió y confirmó por separado (2 corridas independientes, mismo
    // resultado ambas veces): navegar fuera de la consulta y volver por URL
    // directa deja la página colgada PERMANENTEMENTE en "Cargando información
    // de consulta" — ni un F5/reload posterior la recupera. Se saca del medio
    // de este flujo porque "rompe" el resto de la sesión (B/C/E/F no podrían
    // continuar en la misma consulta) — ver hallazgo D-NavegarFueraYVolver en
    // CONTEXTO.md para el detalle completo, ya documentado con evidencia.

    // ═══════════════════════════════════════════════════════════════════
    // ESCENARIO B: carrera al cambiar de medicamento buscado (Paracetamol → Ibuprofeno)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== ESCENARIO B: cambio rápido de medicamento buscado (carrera) ===');
    const tratScope = await sectionContainer(page, /^Tratamiento$/i);
    const medInput = tratScope.locator('#react-select-2-input');
    await medInput.waitFor({ state: 'visible', timeout: 10000 });
    await medInput.click();
    await medInput.fill('Paracetamol');
    await page.waitForTimeout(200); // NO esperar a que carguen opciones — cambiar de opinión ya
    await medInput.fill('');
    await medInput.fill('Ibuprofeno');
    console.log('✅ Buscado "Paracetamol" y cambiado a "Ibuprofeno" casi de inmediato (sin esperar carga)');
    await page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }).catch(() => null);
    const medOptions = page.locator('[role="option"]:visible, div[id*="option"]:visible');
    const medCount = await medOptions.count();
    let medElegido = null;
    for (let i = 0; i < medCount; i++) {
      const t = (await medOptions.nth(i).textContent().catch(() => '') || '');
      if (t.toLowerCase().includes('ibuprofeno')) { medElegido = medOptions.nth(i); break; }
    }
    const medTarget = medElegido || medOptions.first();
    const medTextoReal = (await medTarget.textContent().catch(() => '') || '').trim();
    await medTarget.click();
    console.log(`✅ Medicamento finalmente clickeado: "${medTextoReal}" (¿coincide con Ibuprofeno? ${!!medElegido})`);
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

    // ═══════════════════════════════════════════════════════════════════
    // ESCENARIO C: doble-click en "Guardar Respuestas" (Exploración segmentaria)
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== ESCENARIO C: doble-click en "Guardar Respuestas" de Exploración segmentaria ===');
    const expScope = await sectionContainer(page, /^Exploración segmentaria$/i);
    const checkboxes = expScope.locator('input[type="checkbox"]:not([disabled])');
    const totalCb = await checkboxes.count();
    const nMarcar = Math.min(3, totalCb);
    for (let i = 0; i < nMarcar; i++) await checkboxes.nth(i).click({ force: true }).catch(() => {});
    console.log(`✅ ${nMarcar} checkboxes marcados en Exploración segmentaria`);
    await page.waitForTimeout(500);

    let registerAnswersCalls = 0;
    page.on('response', (r) => { if (r.url().toLowerCase().includes('answer')) registerAnswersCalls++; });

    const guardarRespuestasBtn = expScope.locator('button:has-text("Guardar Respuestas")').first();
    await guardarRespuestasBtn.waitFor({ state: 'visible', timeout: 5000 });
    await Promise.all([
      guardarRespuestasBtn.click(),
      guardarRespuestasBtn.click({ force: true }).catch(() => {}),
    ]);
    await page.waitForTimeout(2500);
    await handleModals(page);
    console.log(`✅ Doble-click ejecutado en "Guardar Respuestas" (respuestas de guardado observadas: ${registerAnswersCalls})`);

    // ═══════════════════════════════════════════════════════════════════
    // Llenar el resto para tener una consulta realista y completa
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== Llenando el resto de secciones (Diagnóstico, Aparatos y sistemas, Laboratorios, Servicios) ===');
    const aparatosScope = await sectionContainer(page, /^Aparatos y sistemas$/i);
    const cbAparatos = aparatosScope.locator('input[type="checkbox"]:not([disabled])');
    const totalAp = await cbAparatos.count();
    for (let i = 0; i < Math.min(3, totalAp); i++) await cbAparatos.nth(i).click({ force: true }).catch(() => {});
    const guardarApBtn = aparatosScope.locator('button:has-text("Guardar Respuestas")').first();
    if (await guardarApBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guardarApBtn.click();
      await page.waitForTimeout(1500);
      await handleModals(page);
    }

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

    const labScope = await sectionContainer(page, /^Laboratorios y Procedimientos$/i);
    const labSelect = labScope.locator('#react-select-3-input');
    if (await labSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labSelect.click();
      await page.waitForTimeout(300);
      await labSelect.fill('Biometría');
      await page.waitForTimeout(1500);
      const labOpts = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      if (await labOpts.count() > 0) await labOpts.first().click();
    }

    const servScope = await sectionContainer(page, /^Servicios$/i);
    const servDropdown = servScope.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible').first();
    let servicioTexto = null;
    if (await servDropdown.count() > 0) {
      await servDropdown.click();
      await page.waitForTimeout(1500);
      const servMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
      const servOpts = servMenu.locator('[class*="option"], [role="option"]');
      if (await servOpts.count() > 0) {
        servicioTexto = (await servOpts.first().textContent().catch(() => '') || '').trim();
        await servOpts.first().click();
      }
    }
    console.log('✅ Resto de secciones llenadas.');

    // ═══════════════════════════════════════════════════════════════════
    // ESCENARIO E: doble-click en "Guardar cambios" GLOBAL
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== ESCENARIO E: doble-click en "Guardar cambios" (global) ===');
    const endpointsGuardado = [
      '/api/consultations/editConsultation', '/api/consultations/addNote',
      '/api/consultations/addDiagnosis', '/api/consultations/setTreatments',
      '/api/consultations/setFreeTreatmentsConsultation', '/api/procedures/setProceduresConsultation',
      '/api/consultations/addServices',
    ];
    const respuestasGuardado = [];
    const listenerGuardado = (r) => {
      if (endpointsGuardado.some(ep => r.url().includes(ep))) respuestasGuardado.push({ url: r.url().split('/api/')[1], status: r.status() });
    };
    page.on('response', listenerGuardado);

    const guardarGlobalBtn = page.locator('button:has-text("Guardar cambios")').first();
    await guardarGlobalBtn.waitFor({ state: 'visible', timeout: 10000 });
    await handleModals(page);
    await Promise.all([
      guardarGlobalBtn.click(),
      guardarGlobalBtn.click({ force: true }).catch(() => {}),
    ]);
    await page.waitForTimeout(5000);
    await handleModals(page);
    page.off('response', listenerGuardado);

    console.log(`💾 Llamadas de guardado tras el doble-click: ${respuestasGuardado.length}`);
    const conteoPorEndpoint = {};
    respuestasGuardado.forEach(r => { conteoPorEndpoint[r.url] = (conteoPorEndpoint[r.url] || 0) + 1; console.log(`   ${r.status} ${r.url}`); });
    reportar('E-DobleClickGlobal', 'INFO', `Endpoints disparados por el doble-click: ${JSON.stringify(conteoPorEndpoint)} (se verificará duplicación real vía API más abajo)`);

    // ═══════════════════════════════════════════════════════════════════
    // ESCENARIO F: Finalizar sin guardar el último cambio
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n=== ESCENARIO F: cambiar Impresión diagnóstica y Finalizar SIN volver a guardar ===');
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

    const treatments = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
      const resp = await fetch('/api/consultations/getTreatments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
        body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }), credentials: 'include',
      });
      return resp.json();
    }, { pacienteId, consultaId: masReciente.id, tok: capturedToken });

    const forms = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
      const resp = await fetch('/api/consultations/getForms', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
        body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }), credentials: 'include',
      });
      return resp.json();
    }, { pacienteId, consultaId: masReciente.id, tok: capturedToken });
    const formExploracion = (forms?.data || []).find(f => f.nombre.toLowerCase().includes('exploracion'));

    let filledFormExploracion = null;
    if (formExploracion) {
      filledFormExploracion = await page.evaluate(async ({ pacienteId, consultaId, relacionId, tok, doctorId }) => {
        const resp = await fetch('/api/patients/getFilledForm', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
          body: JSON.stringify({ paciente_id: pacienteId, relacion_id: relacionId, consulta_id: consultaId, doctor_id: doctorId }), credentials: 'include',
        });
        return resp.json();
      }, { pacienteId, consultaId: masReciente.id, relacionId: formExploracion.relacion_id, tok: capturedToken, doctorId });
    }

    console.log('\n=== VERIFICACIÓN DE CADA ESCENARIO ===');

    // A: Motivo final = corregido
    const motivoFinal = detalle?.data?.motivo;
    console.log(`\n[A] Motivo final guardado: "${motivoFinal}"`);
    if (motivoFinal === motivoCorregido) {
      reportar('A-Motivo-Final', 'OK', 'El motivo final guardado es el corregido, no el typo original.');
    } else if (motivoFinal && motivoFinal.includes('dolro')) {
      reportar('A-Motivo-Final', 'BUG', `¡El motivo guardado contiene el TYPO original, no la corrección!: "${motivoFinal}"`);
    } else {
      reportar('A-Motivo-Final', 'INFO', `El motivo final no coincide exactamente con lo esperado — revisar: "${motivoFinal}"`);
    }

    // B: medicamento final
    const medicamentosGuardados = (treatments?.data || []).map(t => t.medicamento_nombre);
    console.log(`[B] Medicamento(s) guardado(s): ${JSON.stringify(medicamentosGuardados)}`);
    const tieneIbuprofeno = medicamentosGuardados.some(m => (m || '').toLowerCase().includes('ibuprofeno') || (m || '').toLowerCase().includes('brufen') || (m || '').toLowerCase().includes('actron'));
    const tieneParacetamol = medicamentosGuardados.some(m => (m || '').toLowerCase().includes('paracetamol'));
    if (tieneParacetamol && !tieneIbuprofeno) {
      reportar('B-Medicamento', 'BUG', `Se buscó cambiar a "Ibuprofeno" pero quedó guardado un medicamento de Paracetamol — la carrera del buscador causó una selección no intencionada: ${JSON.stringify(medicamentosGuardados)}`);
    } else {
      reportar('B-Medicamento', 'OK', `El medicamento guardado (${JSON.stringify(medicamentosGuardados)}) es consistente con el último buscado ("Ibuprofeno"), no quedó mezclado con el primero.`);
    }
    if (medicamentosGuardados.length > 1) {
      reportar('B-Medicamento-Duplicado', 'BUG', `Se guardó MÁS DE UN medicamento (${medicamentosGuardados.length}) cuando solo se completó el formulario una vez: ${JSON.stringify(medicamentosGuardados)}`);
    }

    // C: checkboxes de Exploración segmentaria — cantidad guardada
    const elementoExp = filledFormExploracion?.data?.grupos?.[0]?.elementos?.[0];
    const valorExp = elementoExp?.valor;
    console.log(`[C] Valor guardado en Exploración segmentaria: ${JSON.stringify(valorExp)}`);
    if (Array.isArray(valorExp)) {
      if (valorExp.length > nMarcar) {
        reportar('C-DobleClickChecklist', 'BUG', `Se marcaron ${nMarcar} checkboxes pero quedaron ${valorExp.length} valores guardados — el doble-click en "Guardar Respuestas" duplicó la selección: ${JSON.stringify(valorExp)}`);
      } else {
        reportar('C-DobleClickChecklist', 'OK', `Cantidad de valores guardados (${valorExp.length}) coincide con lo marcado (${nMarcar}) — el doble-click no duplicó nada.`);
      }
    } else {
      reportar('C-DobleClickChecklist', 'INFO', `No se pudo leer el valor guardado de Exploración segmentaria para comparar (relacion_id usado: ${formExploracion?.relacion_id}).`);
    }

    // E: duplicación tras doble-click en Guardar cambios global
    const diagnosticosFinal = detalle?.data?.diagnosticos || [];
    const serviciosFinal = detalle?.data?.servicios || [];
    console.log(`[E] Diagnósticos guardados: ${diagnosticosFinal.length} | Servicios guardados: ${serviciosFinal.length} | Medicamentos: ${medicamentosGuardados.length}`);
    if (diagnosticosFinal.length > 1) {
      reportar('E-DiagnosticoDuplicado', 'BUG', `El doble-click en "Guardar cambios" duplicó el diagnóstico: ${JSON.stringify(diagnosticosFinal)}`);
    } else {
      reportar('E-DiagnosticoDuplicado', 'OK', 'El diagnóstico no se duplicó tras el doble-click en "Guardar cambios".');
    }
    if (serviciosFinal.length > 1) {
      reportar('E-ServicioDuplicado', 'BUG', `El doble-click en "Guardar cambios" duplicó el servicio: ${JSON.stringify(serviciosFinal)}`);
    } else {
      reportar('E-ServicioDuplicado', 'OK', 'El servicio no se duplicó tras el doble-click en "Guardar cambios".');
    }

    // F: impresión diagnóstica tras Finalizar sin re-guardar
    const impresionFinalGuardada = detalle?.data?.impresion_diagnostico;
    console.log(`[F] Impresión diagnóstica final: "${impresionFinalGuardada}"`);
    if (impresionFinalGuardada === impresionFinal) {
      reportar('F-FinalizarSinGuardar', 'INFO', 'El último cambio (hecho después de "Guardar cambios", antes de "Finalizar Consulta") SÍ se persistió — "Finalizar Consulta" guarda cambios pendientes automáticamente.');
    } else if (impresionFinalGuardada === impresionInicial) {
      reportar('F-FinalizarSinGuardar', 'BUG-O-ESPERADO', `El último cambio a Impresión diagnóstica SE PERDIÓ al finalizar sin volver a clickear "Guardar cambios" (quedó "${impresionFinalGuardada}", se esperaba "${impresionFinal}"). Puede ser un bug si el médico esperaba que se guardara, o comportamiento esperado si "Finalizar" no re-guarda — vale la pena confirmar cuál es el comportamiento intencional con devs.`);
    } else {
      reportar('F-FinalizarSinGuardar', 'INFO', `Valor final no coincide con ninguno de los 2 esperados — revisar manualmente: "${impresionFinalGuardada}"`);
    }

    console.log('\n\n════════════════ RESUMEN DE HALLAZGOS ════════════════');
    hallazgos.forEach(h => console.log(`[${h.severidad}] ${h.escenario}: ${h.descripcion}`));

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'Mediplanner produccion/test-results/error-guessing-error.png', fullPage: true }).catch(() => {});
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
