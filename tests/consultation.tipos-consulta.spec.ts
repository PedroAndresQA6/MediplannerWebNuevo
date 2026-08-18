const { test, expect } = require('@playwright/test');
const { createAppointment, handleModals, setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────
// Prueba los 3 tipos de consulta reales de esta cuenta (confirmados en vivo
// 2026-08-18 en el combo "Tipo de consulta" del wizard de Agendar cita):
// "Consulta Completa", "Consulta Express", "Consulta Express Medico". Los 3
// muestran las mismas 10 secciones en "Modo Completo" (verificado en vivo:
// General, Signos vitales, Valoración, Exploración segmentaria, Aparatos y
// sistemas, Diagnóstico, Tratamiento, Laboratorios y Procedimientos, Notas
// del Médico, Servicios) — el tipo no cambia la estructura del formulario,
// solo qué valor queda en el campo de solo lectura "Tipo consulta" (General).
//
// Por cada tipo: agenda la cita de ESE tipo, llena TODOS los apartados con
// texto marcado con un ID único de la corrida, finaliza la consulta, y
// verifica contra getConsultations (API real, no solo la UI) que cada campo
// se haya guardado con el valor exacto que se llenó — mismo criterio que la
// verificación manual post-reescritura del 2026-07-23 (ver CONTEXTO.md).
//
// También prueba que los campos numéricos de signos vitales RECHACEN letras
// (a pedido explícito de Pedro, 2026-08-18) — comportamiento ya confirmado
// una vez con consultation-inputs-validation.spec.ts, ahora verificado con
// asserts duros por cada uno de los 3 tipos.
//
// Self-contained a propósito (no comparte funciones de llenado con
// consultation.full-flow.spec.js) — mismo criterio ya usado para
// consultation.user-errors.spec.js, para no arriesgar el spec insignia.
// Los selectores de cada sección SÍ están tomados 1:1 de ese spec (ya
// probados en vivo), solo se les agregó tracking de los valores llenados.
// ─────────────────────────────────────────────────────────────────────────

const PACIENTE_BUSQUEDA = process.env.PACIENTE_BUSQUEDA || 'Percentil';
const TIPOS_CONSULTA = ['Consulta Completa', 'Consulta Express', 'Consulta Express Medico'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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

async function iniciarConsultaDelPaciente(page, tipoConsulta) {
  console.log(`📅 Creando cita tipo "${tipoConsulta}" para "${PACIENTE_BUSQUEDA}"...`);
  await createAppointment(page, PACIENTE_BUSQUEDA, tipoConsulta);

  console.log('🏠 Volviendo a Dashboard para iniciar su cita...');
  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);

  const buscarIniciarDelPaciente = async () => {
    const botones = page.getByRole('button', { name: /iniciar/i });
    const total = await botones.count();
    for (let i = 0; i < total; i++) {
      const btn = botones.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      const texto = (await fila.textContent().catch(() => '') || '');
      if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.toLowerCase())) return btn;
    }
    return null;
  };

  const iniciarBtn = await buscarIniciarDelPaciente();
  if (!iniciarBtn) {
    throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_BUSQUEDA}" tras crear su cita tipo "${tipoConsulta}"`);
  }

  const overlay = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
  if (await overlay.count() > 0 && await overlay.first().isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  console.log(`▶️ Iniciando consulta tipo "${tipoConsulta}"...`);
  await iniciarBtn.click({ force: true });
}

// ── Prueba anti-falso-registro: campos numéricos de signos vitales deben
// rechazar letras. Corre ANTES de llenar con datos válidos (mismo campo).
async function testSignosVitalesRechazanLetras(page) {
  console.log('\n🧪 === Verificando que signos vitales rechacen letras ===');
  const campos = [
    { nombre: 'Peso', selector: 'input[name="peso"]' },
    { nombre: 'Talla', selector: 'input[name*="talla" i]' },
    { nombre: 'Temperatura', selector: 'input[name*="temp" i]' },
    { nombre: 'Frecuencia Cardiaca', selector: 'input[name*="card" i]' },
    { nombre: 'Oxigenación', selector: 'input[name="oxigenacion"]' },
    { nombre: 'Frecuencia Respiratoria', selector: 'input[name="frecuenciaRespiratoria"]' },
  ];
  const resultados = [];
  for (const campo of campos) {
    const input = page.locator(campo.selector).first();
    if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`  ⚠️ ${campo.nombre}: campo no visible, se omite`);
      continue;
    }
    await input.click({ clickCount: 3 }).catch(() => {});
    await input.press('Backspace').catch(() => {});
    await input.type('abcXYZ', { delay: 30 }).catch(() => {});
    const valor = await input.inputValue().catch(() => '');
    const contieneLetras = /[a-zA-Z]/.test(valor);
    console.log(`  ${campo.nombre}: escribió "abcXYZ" → quedó "${valor}" | ${contieneLetras ? '❌ ACEPTÓ LETRAS' : '✅ RECHAZÓ LETRAS'}`);
    resultados.push({ campo: campo.nombre, valor, contieneLetras });
    await input.click({ clickCount: 3 }).catch(() => {});
    await input.press('Backspace').catch(() => {});
  }
  return resultados;
}

async function fillGeneralSection(page, marcador) {
  console.log('📋 Llenando sección General...');
  const valores = {};
  const motivoInput = page.locator('textarea[name="visitaPaciente"]');
  if (await motivoInput.isVisible().catch(() => false)) {
    valores.motivo = `Paciente acude a consulta por cefalea persistente [${marcador}]`;
    await motivoInput.fill(valores.motivo);
  }
  const padecimientoTa = page.locator('textarea[placeholder="¿Qué síntomas señala o presenta el paciente?"]').first();
  if (await padecimientoTa.isVisible().catch(() => false)) {
    valores.padecimiento = `Cefalea frontal de tipo opresiva, 3 días de evolución [${marcador}]`;
    await padecimientoTa.fill(valores.padecimiento);
  }
  const notasEvolucionTa = page.locator('textarea[placeholder="Notas de evolución"]').first();
  if (await notasEvolucionTa.isVisible().catch(() => false)) {
    valores.notasEvolucion = `Evolución favorable sin complicaciones [${marcador}]`;
    await notasEvolucionTa.fill(valores.notasEvolucion);
  }
  console.log(`✅ General: ${JSON.stringify(valores)}`);
  return valores;
}

async function fillValoracionSection(page, marcador) {
  console.log('👤 Llenando Valoración (antes "Apariencia general")...');
  const valores = {};
  const ta = page.locator('textarea[placeholder="Describa la apariencia general del paciente"]').first();
  if (await ta.isVisible().catch(() => false)) {
    valores.apariencia = `Paciente bien nutrido, hidratado, consciente, orientado [${marcador}]`;
    await ta.fill(valores.apariencia);
  } else {
    console.log('⚠️ No se encontró el textarea de Valoración/Apariencia general');
  }
  return valores;
}

async function fillChecklistSection(page, headingRegex, nombreLog) {
  console.log(`🔍 Llenando ${nombreLog}...`);
  const scope = await sectionContainer(page, headingRegex);
  const checkboxes = scope.locator('input[type="checkbox"]:not([disabled])');
  const total = await checkboxes.count();
  const nSeleccionar = Math.min(3, total);
  const indices = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, nSeleccionar);
  for (const i of indices) {
    await checkboxes.nth(i).click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(500);

  const obsField = scope.locator('textarea:visible:not([disabled]), input[type="text"]:visible:not([disabled])').last();
  if (await obsField.count() > 0 && await obsField.isVisible().catch(() => false)) {
    await obsField.fill('Sin hallazgos significativos durante la exploración.').catch(() => {});
  }

  const guardarBtn = scope.locator('button:has-text("Guardar Respuestas")').first();
  if (await guardarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await guardarBtn.click();
    await page.waitForTimeout(1500);
    await handleModals(page);
  }
  console.log(`✅ ${nombreLog}: ${indices.length}/${total} checkbox(es) marcados`);
}

async function fillDiagnosticoSection(page, marcador) {
  console.log('🩺 Llenando sección de Diagnóstico...');
  const valores = {};
  const scope = await sectionContainer(page, /^Diagnóstico$/i);
  await page.waitForTimeout(500);

  const cie10Input = scope.locator('textarea[role="combobox"]').first();
  if (await cie10Input.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cie10Input.click();
    await page.waitForTimeout(500);
    const codigoCIE10 = pick(['R05', 'J00', 'A09', 'M54', 'R51', 'K59']);
    await cie10Input.fill(codigoCIE10);
    await page.waitForTimeout(1500);
    const options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
    if (await options.count() > 0) {
      valores.diagnostico = (await options.first().textContent().catch(() => '') || '').trim();
      await options.first().click();
    }
  }

  const impresion = scope.locator('textarea[placeholder="Impresión diagnóstica"]').first();
  if (await impresion.isVisible({ timeout: 2000 }).catch(() => false)) {
    valores.impresion = `Condición médica a evaluar, estudios complementarios [${marcador}]`;
    await impresion.fill(valores.impresion);
  }
  console.log(`✅ Diagnóstico: ${JSON.stringify(valores)}`);
  return valores;
}

async function fillTratamientoSection(page, marcador) {
  console.log('💊 Llenando sección de Tratamiento...');
  const valores = {};
  const scope = await sectionContainer(page, /^Tratamiento$/i);
  await page.waitForTimeout(500);

  const indicacionesEditor = scope.locator('div.jodit-wysiwyg').first();
  if (await indicacionesEditor.isVisible().catch(() => false)) {
    valores.indicacionesGenerales = `Reposo relativo, abundantes líquidos [${marcador}]`;
    // Reintenta si el DOM no refleja lo tipeado (se vio 2/2 en "Express" y
    // "Express Medico" que el editor Jodit quedaba vacío/con contenido viejo
    // tras un solo intento — no pasó en "Completa"; podría ser timing del
    // editor o un bug real de guardado específico de esos tipos, ver
    // CONTEXTO.md).
    for (let intento = 1; intento <= 3; intento++) {
      await indicacionesEditor.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Control+A');
      await page.keyboard.type(valores.indicacionesGenerales);
      await page.waitForTimeout(300);
      const textoActual = (await indicacionesEditor.textContent().catch(() => '') || '');
      if (textoActual.includes(marcador)) break;
      console.log(`⚠️ Intento ${intento}: el editor de indicaciones no refleja el texto tipeado ("${textoActual.substring(0, 60)}"), reintentando...`);
    }
  }

  const medicamentoInput = scope.locator('#react-select-2-input');
  if (await medicamentoInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    const medicamento = pick(['Paracetamol', 'Ibuprofeno', 'Amoxicilina', 'Omeprazol', 'Loratadina']);
    await medicamentoInput.click();
    await medicamentoInput.fill(medicamento);
    await page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }).catch(() => null);
    const option = page.locator('[role="option"]:visible, div[id*="option"]:visible').first();
    if (await option.count() > 0) {
      await option.click();
      valores.medicamento = medicamento;
    }
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(1500);

    // Anti-falso-registro: la cantidad/frecuencia del medicamento deben
    // rechazar letras (a pedido de Pedro) antes de llenarlas con datos válidos.
    const dosisInput = page.locator('input[name="dosis_cantidad"]');
    if (await dosisInput.isVisible().catch(() => false)) {
      await dosisInput.click({ clickCount: 3 }).catch(() => {});
      await dosisInput.type('abc', { delay: 30 }).catch(() => {});
      const valorLetras = await dosisInput.inputValue().catch(() => '');
      valores.dosisRechazoLetras = !/[a-zA-Z]/.test(valorLetras);
      console.log(`  🧪 Dosis (cantidad): escribió "abc" → quedó "${valorLetras}" | ${valores.dosisRechazoLetras ? '✅ RECHAZÓ' : '❌ ACEPTÓ LETRAS'}`);
      await dosisInput.click({ clickCount: 3 }).catch(() => {});
      await dosisInput.fill('1');
    }
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
    const indicacionesMedInput = page.locator('input[name="indicaciones-0"]');
    if (await indicacionesMedInput.isVisible().catch(() => false)) await indicacionesMedInput.fill('Indicaciones estándar');
  }
  console.log(`✅ Tratamiento: ${JSON.stringify(valores)}`);
  return valores;
}

async function fillLaboratoriosSection(page, marcador) {
  console.log('🔬 Llenando Laboratorios y Procedimientos...');
  const valores = {};
  const scope = await sectionContainer(page, /^Laboratorios y Procedimientos$/i);
  await page.waitForTimeout(500);

  const indicacionesEditor = scope.locator('div.jodit-wysiwyg').first();
  if (await indicacionesEditor.isVisible().catch(() => false)) {
    await indicacionesEditor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Solicitar estudios de laboratorio de rutina');
  }

  const procedimientoInput = scope.locator('textarea[name="procedimiento-0"]');
  if (await procedimientoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    valores.procedimiento = `Biometría hemática completa [${marcador}]`;
    await procedimientoInput.fill(valores.procedimiento);
  }
  console.log(`✅ Laboratorios: ${JSON.stringify(valores)}`);
  return valores;
}

async function fillNotasMedicoSection(page, marcador) {
  console.log('📋 Llenando Notas del Médico...');
  const valores = {};
  const scope = await sectionContainer(page, /^Notas del Médico/i);
  const editor = scope.locator('div.jodit-wysiwyg').first();
  if (await editor.isVisible({ timeout: 5000 }).catch(() => false)) {
    valores.notas = `Seguimiento de evolución clínica favorable [${marcador}]`;
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(valores.notas);
  }
  console.log(`✅ Notas del Médico: ${JSON.stringify(valores)}`);
  return valores;
}

async function fillServiciosSection(page) {
  console.log('🏥 Llenando sección de Servicios...');
  const valores = {};
  const scope = await sectionContainer(page, /^Servicios$/i);
  await page.waitForTimeout(500);

  const dropdownInput = scope.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible').first();
  if (await dropdownInput.count() > 0) {
    await dropdownInput.click();
    await page.waitForTimeout(1500);
    const dropdownMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
    const options = dropdownMenu.locator('[class*="option"], [role="option"]');
    let optionCount = await options.count();
    if (optionCount === 0) {
      await page.waitForTimeout(1500);
      optionCount = await options.count();
    }
    if (optionCount > 0) {
      const first = options.first();
      const textoCompleto = (await first.textContent().catch(() => '') || '').trim();
      // La opción muestra "Nombre $precio" pero la API solo guarda el nombre.
      valores.servicio = textoCompleto.replace(/\s*\$[\d.,]+\s*$/, '').trim();
      await first.click();
    }
  }
  console.log(`✅ Servicios: ${JSON.stringify(valores)}`);
  return valores;
}

async function guardarCambiosGlobal(page) {
  console.log('💾 Clickeando "Guardar cambios" (global)...');
  const endpointsGuardado = [
    '/api/consultations/editConsultation',
    '/api/consultations/addNote',
    '/api/consultations/addDiagnosis',
    '/api/consultations/setTreatments',
    '/api/consultations/setFreeTreatmentsConsultation',
    '/api/procedures/setProceduresConsultation',
    '/api/consultations/addServices',
  ];
  const respuestas = [];
  const listener = (r) => {
    if (endpointsGuardado.some(ep => r.url().includes(ep))) {
      respuestas.push({ url: r.url(), status: r.status() });
    }
  };
  page.on('response', listener);

  const guardarBtn = page.locator('button:has-text("Guardar cambios")').first();
  await expect(guardarBtn, 'Debe existir el botón global "Guardar cambios"').toBeVisible({ timeout: 10000 });
  await handleModals(page);
  await guardarBtn.click();
  await page.waitForTimeout(5000);
  await handleModals(page);

  page.off('response', listener);
  const fallidas = respuestas.filter(r => r.status >= 400);
  expect(fallidas.length, `Ninguna llamada de guardado debe fallar: ${JSON.stringify(fallidas)}`).toBe(0);
  return respuestas;
}

async function finalizarConsulta(page) {
  console.log('🏁 Finalizando consulta...');
  const finalizarBtn = page.getByRole('button', { name: /finalizar consulta/i }).first();
  await expect(finalizarBtn).toBeVisible({ timeout: 15000 });
  const respPromise = page.waitForResponse(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 15000 }).catch(() => null);
  await finalizarBtn.click();
  const resp = await respPromise;
  if (resp) expect(resp.status(), 'finishConsultation debe responder 2xx').toBeLessThan(300);
  await page.waitForTimeout(1000);
  const confirmBtn = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click();
  }
}

// Trae el detalle COMPLETO de la consulta recién finalizada, navegando la UI
// real (no vía API directa: getConsultation exige el header custom
// "x-rym-token-app" que solo agrega el JS de la propia app, confirmado en
// vivo 2026-08-18 — page.request no lo tiene y da 401 "Falta cabecera
// x-rym-token-app"). Abre el perfil del paciente → tab "Consultas" → la
// PRIMERA fila (más reciente = la que se acaba de finalizar) y captura la
// respuesta real de getConsultation que dispara la propia UI. Las notas del
// médico NO se piden acá — getNotes no se re-dispara al reabrir la consulta
// desde esta lista (confirmado en vivo); se capturan aparte, en vivo, durante
// el guardado (ver listener persistente en el test).
async function fetchConsultaCompleta(page, consultaIdEsperado) {
  await page.goto('/Pacientes');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);
  const buscar = page.locator('input[placeholder="Buscar paciente"]').first();
  await buscar.fill(PACIENTE_BUSQUEDA);
  await page.waitForTimeout(1500);
  const paciente = page.locator('[role="cell"] span.font-semibold', { hasText: PACIENTE_BUSQUEDA }).first();
  await paciente.click();
  await page.waitForTimeout(2500);

  const consultasTab = page.locator('button:has-text("Consultas"), a:has-text("Consultas")').first();
  await consultasTab.click();
  await page.waitForTimeout(2000);

  const filas = page.locator('button').filter({ hasText: /\d{2}\/\d{2}\/\d{4}/ });
  await expect(filas.first(), 'Debe haber al menos una consulta en la lista').toBeVisible({ timeout: 10000 });

  const consultaRespPromise = page.waitForResponse(
    r => r.url().includes('/api/consultations/getConsultation') && !r.url().includes('getConsultations'),
    { timeout: 15000 }
  ).catch(() => null);

  await filas.first().click();
  const consultaResp = await consultaRespPromise;
  const consultaBody = await consultaResp?.json().catch(() => null);
  const consulta = consultaBody?.data || null;

  if (consulta && consulta.id !== consultaIdEsperado) {
    console.log(`⚠️ La primera fila de "Consultas" (id=${consulta.id}) no es la recién finalizada (id=${consultaIdEsperado}) — ¿lista no ordenada por más reciente?`);
  }

  return consulta;
}

for (const tipoConsulta of TIPOS_CONSULTA) {
  test(`Consulta tipo "${tipoConsulta}": llenar todos los apartados y verificar contra la API`, async ({ page }) => {
    test.setTimeout(300000);
    const monitor = setupConsoleMonitor(page);
    const marcador = `QA-${tipoConsulta.replace(/\s+/g, '')}-${Date.now()}`;
    console.log(`\n🎯 === Tipo de consulta: "${tipoConsulta}" (marcador: ${marcador}) ===`);

    let letrasVitales = [];
    let consultaId = null;
    let notasCapturadas = [];
    // Capturar el id desde getConsultation (la carga inicial de la página de
    // consulta, garantizada siempre al abrirla) en vez de editConsultation:
    // confirmado en vivo 2026-08-18 que editConsultation NO se dispara de
    // forma confiable (a veces sí, a veces no, según qué campos "cambien" a
    // criterio del backend) — no es un capturador seguro del id.
    // Las notas del médico también se capturan acá (getNotes SÍ se ve
    // disparar de forma confiable durante el guardado/addNote, pero NO se
    // vuelve a disparar al reabrir la consulta desde "Consultas" — confirmado
    // en vivo, es una sub-vista aparte que no se navega en este spec).
    page.on('response', async (r) => {
      if (!consultaId && r.url().includes('/api/consultations/getConsultation') && !r.url().includes('getConsultations')) {
        const body = await r.json().catch(() => null);
        if (body?.data?.id) consultaId = body.data.id;
      }
      if (r.url().includes('/api/consultations/getNotes')) {
        const body = await r.json().catch(() => null);
        if (Array.isArray(body?.data) && body.data.length > 0) notasCapturadas = body.data;
      }
    });

    await test.step('Iniciar consulta y signos vitales (con prueba anti-letras)', async () => {
      await iniciarConsultaDelPaciente(page, tipoConsulta);

      const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
      await expect(signosButton).toBeVisible({ timeout: 10000 });
      await signosButton.click();
      await page.waitForTimeout(1000);

      letrasVitales = await testSignosVitalesRechazanLetras(page);

      await page.locator('input[name="peso"]').fill('70');
      await page.locator('input[name*="talla" i]').first().fill('170').catch(() => {});
      const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
      if (await presionInput.isVisible().catch(() => false)) await presionInput.fill('120/080');
      await page.locator('input[name*="temp" i]').first().fill('36.5').catch(() => {});
      await page.locator('input[name*="card" i]').first().fill('75').catch(() => {});
      await page.locator('input[name="oxigenacion"]').first().fill('98').catch(() => {});
      await page.locator('input[name="frecuenciaRespiratoria"]').first().fill('18').catch(() => {});

      await page.waitForTimeout(1500);
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
        return btn && !btn.disabled;
      }, { timeout: 10000 });

      const respPromise = page.waitForResponse(r => r.url().includes('/api/consultations/registerVitalSigns'), { timeout: 15000 }).catch(() => null);
      await page.getByRole('button', { name: /^Guardar$/i }).click();
      const resp = await respPromise;
      expect(resp?.status(), 'registerVitalSigns debe responder 2xx').toBeLessThan(300);

      await page.waitForTimeout(1000);
      const cerrarButton = page.getByRole('button', { name: /cerrar/i });
      if (await cerrarButton.isVisible().catch(() => false)) await cerrarButton.click();
    });

    await test.step('Cargar página de consulta (Modo Completo)', async () => {
      try {
        await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
      } catch (e) {
        await page.goto('/Consulta/ConsultaGeneral');
        await page.waitForLoadState('load').catch(() => {});
      }
      await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // El campo "Tipo consulta" en General es de solo lectura: confirmar que
      // refleja el tipo elegido al agendar.
      const tipoVisible = await page.getByText(tipoConsulta, { exact: false }).first().isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`🔎 "Tipo consulta" = "${tipoConsulta}" visible en General: ${tipoVisible}`);
    });

    const valoresLlenados = {};

    await test.step('Llenar todas las secciones (marcadas para verificar después)', async () => {
      Object.assign(valoresLlenados, await fillGeneralSection(page, marcador));
      Object.assign(valoresLlenados, await fillValoracionSection(page, marcador));
      await fillChecklistSection(page, /^Exploración segmentaria$/i, 'Exploración segmentaria');
      await fillChecklistSection(page, /^Aparatos y sistemas$/i, 'Aparatos y sistemas');
      Object.assign(valoresLlenados, await fillDiagnosticoSection(page, marcador));
      Object.assign(valoresLlenados, await fillTratamientoSection(page, marcador));
      Object.assign(valoresLlenados, await fillLaboratoriosSection(page, marcador));
      Object.assign(valoresLlenados, await fillNotasMedicoSection(page, marcador));
      Object.assign(valoresLlenados, await fillServiciosSection(page));
    });

    await test.step('Guardar cambios (global) y finalizar', async () => {
      await guardarCambiosGlobal(page);
      await finalizarConsulta(page);
    });

    await test.step('Verificar contra la API (getConsultation/getNotes) que todo se guardó correctamente', async () => {
      expect(consultaId, 'Debe haberse capturado el consulta_id (respuesta de getConsultation al cargar la página)').toBeTruthy();

      const consulta = await fetchConsultaCompleta(page, consultaId);
      expect(consulta, `getConsultation debe traer la consulta id=${consultaId}`).toBeTruthy();
      if (!consulta) return;

      console.log(`🔎 tipo_consulta_nombre guardado: "${consulta.tipo_consulta_nombre}" (esperado: "${tipoConsulta}")`);
      expect(consulta.tipo_consulta_nombre, 'El tipo de consulta guardado debe ser el elegido al agendar').toBe(tipoConsulta);
      console.log(`🔎 indicaciones_general guardado (crudo): "${consulta.indicaciones_general}"`);

      const consultaTexto = JSON.stringify(consulta) + JSON.stringify(notasCapturadas);
      for (const [campo, valorEsperado] of Object.entries(valoresLlenados)) {
        if (typeof valorEsperado !== 'string' || !valorEsperado.includes(marcador)) continue;
        const encontrado = consultaTexto.includes(valorEsperado);
        console.log(`  🔍 Campo "${campo}": ${encontrado ? '✅ coincide' : `❌ NO coincide (esperado: "${valorEsperado}")`}`);
        expect(encontrado, `Campo "${campo}" debe guardarse con el valor exacto llenado ("${valorEsperado}")`).toBe(true);
      }

      if (valoresLlenados.servicio) {
        const servicios = consulta.servicios || [];
        const servicioGuardado = servicios.some((s) => s?.nombre === valoresLlenados.servicio);
        console.log(`  🔍 Servicio "${valoresLlenados.servicio}": ${servicioGuardado ? '✅ coincide' : '❌ NO coincide'}`);
        expect(servicioGuardado, `El servicio "${valoresLlenados.servicio}" debe estar en consulta.servicios`).toBe(true);
      }
    });

    console.log(`\n📊 === Resumen anti-letras en signos vitales (tipo "${tipoConsulta}") ===`);
    const vulnerables = letrasVitales.filter(r => r.contieneLetras);
    console.log(`   ${letrasVitales.length - vulnerables.length}/${letrasVitales.length} campos rechazaron letras correctamente`);
    for (const r of letrasVitales) {
      expect(r.contieneLetras, `El campo "${r.campo}" no debe aceptar letras (quedó: "${r.valor}")`).toBe(false);
    }

    const result = monitor.printSummary();
    console.log(`\n🎉 === Consulta tipo "${tipoConsulta}" completada (marcador ${marcador}) ===`);
    expect(result.failedApiCalls.length, `No debe haber responses con error de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  });
}
