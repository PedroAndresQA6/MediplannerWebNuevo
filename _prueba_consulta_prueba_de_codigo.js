const { chromium } = require('@playwright/test');

// Prueba de consulta completa en PRODUCCIÓN para el paciente "Prueba DE Codigo"
// (cita ya existente, visible en Dashboard con botón "Iniciar"). Llena todas
// las secciones, guarda, finaliza, y verifica vía API que todo persistió.
// Basado en tests/consultation.full-flow.spec.js (dev, reescrito 2026-07-23
// para el "Modo Completo") + Mediplanner produccion/e2e/utils.js.

const BASE = 'https://admin.mediplanner.mx/';
const PACIENTE_BUSQUEDA = 'Prueba DE Codigo';

const DATOS_CLINICOS = {
  signosVitales: {
    presiones: ['110/070', '115/075', '120/080', '125/080', '118/078'],
    temperaturas: ['36.3', '36.5', '36.7', '36.8', '37.0'],
    frecuenciasCardiacas: ['65', '70', '72', '75', '78', '80'],
    saturaciones: ['96', '97', '98', '99'],
    frecuenciasRespiratorias: ['14', '16', '18', '20'],
    glucosas: ['85', '90', '95', '100', '105'],
    peso: '70', talla: '170',
  },
  cie10: ['R05', 'J00', 'A09', 'M54', 'R51', 'K59'],
  medicamentos: ['Paracetamol', 'Ibuprofeno', 'Amoxicilina', 'Omeprazol', 'Loratadina'],
  laboratorios: ['Biometría', 'Química', 'Perfil'],
  indicacionesGenerales: [
    'Reposo relativo, abundantes líquidos, control de signos de alarma.',
    'Dieta blanda, evitar irritantes, seguimiento en 48-72 horas si no mejora.',
  ],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

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
  } catch (e) { /* no bloquear el flujo principal */ }
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
  console.log(`⚠️ sectionContainer: no se pudo acotar "${headingRegex}", usando page completa`);
  return page;
}

async function fillGeneralSection(page, datos) {
  console.log('📋 Llenando sección General...');
  try {
    const motivoInput = page.locator('textarea[name="visitaPaciente"]');
    if (await motivoInput.isVisible().catch(() => false)) {
      const cur = await motivoInput.inputValue().catch(() => '');
      if (!cur.trim()) {
        datos.motivo = 'Paciente acude a consulta por cefalea persistente de 3 días de evolución, de intensidad moderada, sin respuesta a analgésicos de venta libre.';
        await motivoInput.fill(datos.motivo);
        console.log('✅ Motivo de la consulta llenado');
      }
    } else {
      console.log('⚠️ No se encontró el campo "Motivo de consulta" (textarea[name="visitaPaciente"])');
    }
    const padecimientoTa = page.locator('textarea[placeholder="¿Qué síntomas señala o presenta el paciente?"]').first();
    if (await padecimientoTa.isVisible().catch(() => false)) {
      datos.padecimiento = 'Inicia padecimiento actual hace 3 días con cefalea frontal de tipo opresiva, intensidad 6/10 en escala visual análoga, acompañada de fotofobia leve. Niega fiebre, vómito o alteraciones neurológicas focales.';
      await padecimientoTa.fill(datos.padecimiento);
      console.log('✅ Padecimiento actual llenado');
    }
    const notasEvolucionTa = page.locator('textarea[placeholder="Notas de evolución"]').first();
    if (await notasEvolucionTa.isVisible().catch(() => false)) {
      datos.notasEvolucion = 'Evolución favorable sin complicaciones';
      await notasEvolucionTa.fill(datos.notasEvolucion);
      console.log('✅ Notas de evolución llenadas');
    }
  } catch (error) {
    console.log(`⚠️ Error en General: ${error.message}`);
  }
}

async function fillApenrienciaGeneralSection(page, datos) {
  console.log('👤 Llenando Apariencia general...');
  try {
    const ta = page.locator('textarea[placeholder="Describa la apariencia general del paciente"]').first();
    if (await ta.isVisible().catch(() => false)) {
      datos.apariencia = 'Paciente bien nutrido, hidratado, consciente, orientado, sin facies de dolor, sin dificultad respiratoria.';
      await ta.fill(datos.apariencia);
      console.log('✅ Apariencia general llenada');
    } else {
      console.log('⚠️ No se encontró el textarea de Apariencia general');
    }
  } catch (error) {
    console.log(`⚠️ Error en Apariencia general: ${error.message}`);
  }
}

async function fillChecklistSection(page, headingRegex, nombreLog, datosArr) {
  console.log(`🔍 Llenando ${nombreLog}...`);
  try {
    const scope = await sectionContainer(page, headingRegex);
    const checkboxes = scope.locator('input[type="checkbox"]:not([disabled])');
    const total = await checkboxes.count();
    console.log(`☑️ ${nombreLog}: ${total} checkboxes encontrados`);

    const nSeleccionar = Math.min(3, total);
    const indices = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, nSeleccionar);
    for (const i of indices) {
      const cb = checkboxes.nth(i);
      const label = await cb.locator('xpath=../label | xpath=following-sibling::label | xpath=preceding-sibling::label').first().textContent().catch(() => '');
      datosArr.push((label || `#${i}`).trim());
      await cb.click({ force: true }).catch(() => {});
    }
    console.log(`✅ ${nombreLog}: ${indices.length} checkbox(es) marcados → [${datosArr.join(', ')}]`);
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
      console.log(`💾 ${nombreLog}: "Guardar Respuestas" clickeado`);
    } else {
      console.log(`⚠️ ${nombreLog}: no se encontró su botón "Guardar Respuestas"`);
    }
  } catch (error) {
    console.log(`⚠️ Error en ${nombreLog}: ${error.message}`);
  }
}

async function fillDiagnosticoSection(page, datos) {
  console.log('🩺 Llenando sección de Diagnóstico...');
  try {
    const scope = await sectionContainer(page, /^Diagnóstico$/i);
    await page.waitForTimeout(500);

    const cie10Input = scope.locator('textarea[role="combobox"]').first();
    if (await cie10Input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cie10Input.click();
      await page.waitForTimeout(500);
      const codigoCIE10 = pick(DATOS_CLINICOS.cie10);
      datos.cie10Buscado = codigoCIE10;
      await cie10Input.fill(codigoCIE10);
      await page.waitForTimeout(1500);
      const options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      const optionCount = await options.count();
      if (optionCount > 0) {
        const optionText = (await options.first().textContent().catch(() => '') || '').trim();
        datos.cie10Real = optionText;
        await options.first().click();
        console.log(`✅ Diagnóstico CIE-10 seleccionado: "${optionText.substring(0, 40)}..."`);
      } else {
        console.log(`⚠️ Sin opciones de CIE-10 para "${codigoCIE10}"`);
      }
    } else {
      console.log('⚠️ No se encontró el combobox de CIE-10 en Diagnóstico');
    }

    const impresion = scope.locator('textarea[placeholder="Impresión diagnóstica"]').first();
    if (await impresion.isVisible({ timeout: 2000 }).catch(() => false)) {
      const cur = await impresion.inputValue().catch(() => '');
      if (!cur.trim()) {
        datos.impresionDiagnostica = 'Impresión diagnóstica: Condición médica a evaluar. Se solicitan estudios complementarios.';
        await impresion.fill(datos.impresionDiagnostica);
        console.log('✅ Impresión diagnóstica llenada');
      }
    }
  } catch (error) {
    console.log(`⚠️ Error en Diagnóstico: ${error.message}`);
  }
}

async function fillTratamientoSection(page, datos) {
  console.log('💊 Llenando sección de Tratamiento...');
  try {
    const scope = await sectionContainer(page, /^Tratamiento$/i);
    await page.waitForTimeout(500);

    const indicacionesEditor = scope.locator('div.jodit-wysiwyg').first();
    if (await indicacionesEditor.isVisible().catch(() => false)) {
      datos.indicacionesGenerales = pick(DATOS_CLINICOS.indicacionesGenerales);
      await indicacionesEditor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(datos.indicacionesGenerales);
      console.log('✅ Indicaciones generales de tratamiento llenadas');
    }

    const medicamentoInput = scope.locator('#react-select-2-input');
    if (await medicamentoInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const medicamento = pick(DATOS_CLINICOS.medicamentos);
      datos.medicamentoBuscado = medicamento;
      await medicamentoInput.click();
      await medicamentoInput.fill(medicamento);
      await page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }).catch(() => null);
      const options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      const optionCount = await options.count();
      if (optionCount > 0) {
        let elegida = null;
        for (let i = 0; i < optionCount; i++) {
          const t = (await options.nth(i).textContent().catch(() => '') || '');
          if (t.toLowerCase().includes(medicamento.toLowerCase())) { elegida = options.nth(i); break; }
        }
        const target = elegida || options.first();
        const textoReal = (await target.textContent().catch(() => '') || '').trim();
        datos.medicamentoReal = textoReal;
        await target.click();
        if (!elegida) console.log(`⚠️ Ninguna opción contenía "${medicamento}" — se tomó la primera disponible`);
        console.log(`✅ Medicamento seleccionado: "${textoReal.substring(0, 60)}" (buscado: "${medicamento}")`);
      }
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
      const indicacionesMedInput = page.locator('input[name="indicaciones-0"]');
      if (await indicacionesMedInput.isVisible().catch(() => false)) await indicacionesMedInput.fill('Indicaciones estándar');
      console.log('✅ Formulario del medicamento llenado');
    } else {
      console.log('⚠️ No se encontró el buscador de medicamentos en Tratamiento');
    }
  } catch (error) {
    console.log(`⚠️ Error en Tratamiento: ${error.message}`);
  }
}

async function fillLaboratoriosSection(page, datos) {
  console.log('🔬 Llenando Laboratorios y Procedimientos...');
  try {
    const scope = await sectionContainer(page, /^Laboratorios y Procedimientos$/i);
    await page.waitForTimeout(500);

    const indicacionesEditor = scope.locator('div.jodit-wysiwyg').first();
    if (await indicacionesEditor.isVisible().catch(() => false)) {
      await indicacionesEditor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Solicitar estudios de laboratorio de rutina');
      console.log('✅ Indicaciones de laboratorio llenadas');
    }

    const labSelect = scope.locator('#react-select-3-input');
    if (await labSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const laboratorio = pick(DATOS_CLINICOS.laboratorios);
      datos.laboratorioBuscado = laboratorio;
      await labSelect.click();
      await page.waitForTimeout(300);
      await labSelect.fill(laboratorio);
      await page.waitForTimeout(1500);
      const labOptions = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      const labOptionCount = await labOptions.count();
      if (labOptionCount > 0) {
        let elegida = null;
        for (let i = 0; i < labOptionCount; i++) {
          const t = (await labOptions.nth(i).textContent().catch(() => '') || '');
          if (t.toLowerCase().includes(laboratorio.toLowerCase())) { elegida = labOptions.nth(i); break; }
        }
        const target = elegida || labOptions.first();
        const text = (await target.textContent().catch(() => '') || '').trim();
        datos.laboratorioReal = text;
        await target.click();
        if (!elegida) console.log(`⚠️ Ninguna opción de laboratorio contenía "${laboratorio}" — se tomó la primera disponible`);
        console.log(`✅ Laboratorio seleccionado: "${text.substring(0, 60)}" (buscado: "${laboratorio}")`);
      } else {
        console.log('⚠️ Sin opciones de laboratorio');
      }
    }

    const procedimientoInput = scope.locator('textarea[name="procedimiento-0"]');
    if (await procedimientoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await procedimientoInput.fill('Biometría hemática completa');
      console.log('✅ Procedimiento llenado');
    }
  } catch (error) {
    console.log(`⚠️ Error en Laboratorios: ${error.message}`);
  }
}

async function fillNotasMedicoSection(page, datos) {
  console.log('📋 Llenando Notas del Médico...');
  try {
    const scope = await sectionContainer(page, /^Notas del Médico/i);
    const editor = scope.locator('div.jodit-wysiwyg').first();
    if (await editor.isVisible({ timeout: 5000 }).catch(() => false)) {
      datos.notasMedico = 'Notas del médico: Seguimiento de evolución clínica favorable. Paciente responde adecuadamente al tratamiento.';
      await editor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(datos.notasMedico);
      console.log('✅ Notas del médico llenadas');
    } else {
      console.log('⚠️ No se encontró el editor de Notas del Médico');
    }
  } catch (error) {
    console.log(`⚠️ Error en Notas del Médico: ${error.message}`);
  }
}

async function fillServiciosSection(page, datos) {
  console.log('🏥 Llenando sección de Servicios...');
  try {
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
      console.log(`📋 ${optionCount} opciones de servicio disponibles`);

      if (optionCount > 0) {
        const first = options.first();
        const text = (await first.textContent().catch(() => '') || '').trim();
        datos.servicio = text;
        await first.click();
        console.log(`✅ Servicio seleccionado: "${text.substring(0, 60)}"`);
      } else {
        console.log('⚠️ Sin opciones de servicio disponibles');
      }
    } else {
      console.log('⚠️ No se encontró el dropdown de servicios');
    }
  } catch (error) {
    console.log(`⚠️ Error en Servicios: ${error.message}`);
  }
}

async function guardarCambiosGlobal(page) {
  console.log('💾 Clickeando "Guardar cambios" (global)...');
  const endpointsGuardado = [
    '/api/consultations/editConsultation', '/api/consultations/addNote',
    '/api/consultations/addDiagnosis', '/api/consultations/setTreatments',
    '/api/consultations/setFreeTreatmentsConsultation', '/api/procedures/setProceduresConsultation',
    '/api/consultations/addServices',
  ];
  const respuestas = [];
  const listener = async (r) => {
    if (endpointsGuardado.some(ep => r.url().includes(ep))) respuestas.push({ url: r.url(), status: r.status() });
  };
  page.on('response', listener);

  const guardarBtn = page.locator('button:has-text("Guardar cambios")').first();
  await guardarBtn.waitFor({ state: 'visible', timeout: 10000 });
  await handleModals(page);
  await guardarBtn.click();
  await page.waitForTimeout(5000);
  await handleModals(page);

  page.off('response', listener);
  console.log(`💾 Llamadas de guardado disparadas: ${respuestas.length}`);
  respuestas.forEach(r => console.log(`   ${r.status} ${r.url.split('/api/')[1]}`));
  return respuestas;
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
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !capturedToken) {
      const h = req.headers();
      if (h['x-rym-token-app']) capturedToken = h['x-rym-token-app'];
    }
  });
  const erroresApi = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`);
  });

  const datos = {
    motivo: null, padecimiento: null, notasEvolucion: null, apariencia: null,
    exploracionSegmentaria: [], aparatosSistemas: [],
    cie10Buscado: null, cie10Real: null, impresionDiagnostica: null,
    indicacionesGenerales: null, medicamentoBuscado: null, medicamentoReal: null,
    laboratorioBuscado: null, laboratorioReal: null, notasMedico: null, servicio: null,
  };

  try {
    console.log('🏠 Navegando al Dashboard de producción...');
    await page.goto('/Dashboard');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => console.log('⚠️ Seguía en "Cargando..." tras 20s'));
    await page.waitForTimeout(2000);

    const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
    if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('ℹ️ Saltando pantalla de onboarding...');
      await explorarLink.click();
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
      await page.goto('/Dashboard');
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
      await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

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
    if (!targetBtn) throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_BUSQUEDA}"`);
    console.log(`▶️ Iniciando consulta de "${PACIENTE_BUSQUEDA}"...`);
    await targetBtn.click();

    console.log('💉 Esperando modal "Capturar signos vitales"...');
    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await signosButton.waitFor({ state: 'visible', timeout: 10000 });
    await signosButton.click();
    await page.waitForTimeout(1000);

    console.log('💉 Llenando signos vitales...');
    const sv = DATOS_CLINICOS.signosVitales;
    const svPresion = pick(sv.presiones);
    const svTemp = pick(sv.temperaturas);
    const svFC = pick(sv.frecuenciasCardiacas);
    const svSat = pick(sv.saturaciones);
    const svFR = pick(sv.frecuenciasRespiratorias);
    const svGlucosa = pick(sv.glucosas);

    await page.locator('input[name="peso"]').fill(sv.peso);
    const tallaInput = page.locator('input[name*="talla" i]');
    if (await tallaInput.count() > 0) await tallaInput.first().fill(sv.talla);
    const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
    if (await presionInput.isVisible().catch(() => false)) await presionInput.fill(svPresion);
    const tempInput = page.locator('input[name*="temp" i]');
    if (await tempInput.count() > 0) await tempInput.first().fill(svTemp);
    const fcInput = page.locator('input[name*="card" i]');
    if (await fcInput.count() > 0) await fcInput.first().fill(svFC);
    const satInput = page.locator('input[name="oxigenacion"]');
    if (await satInput.count() > 0) await satInput.first().fill(svSat);
    const frInput = page.locator('input[name="frecuenciaRespiratoria"]');
    if (await frInput.count() > 0) await frInput.first().fill(svFR);
    const glucosaInput = page.locator('input[name="glucosa"]');
    if (await glucosaInput.count() > 0) await glucosaInput.first().fill(svGlucosa);

    await page.waitForTimeout(1500);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    const respPromise = page.waitForResponse(r => r.url().includes('/api/consultations/registerVitalSigns'), { timeout: 15000 }).catch(() => null);
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    const resp = await respPromise;
    console.log(`✅ Signos vitales guardados (status ${resp ? resp.status() : 'sin respuesta detectada'})`);

    await page.waitForTimeout(1000);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await cerrarButton.isVisible().catch(() => false)) {
      await cerrarButton.click();
      await page.waitForTimeout(1000);
    }

    console.log('🔄 Esperando redirección a pantalla de consulta...');
    try {
      await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
      console.log('✅ Redirigido a página de consulta:', page.url());
    } catch (e) {
      console.log('⚠️ No redirigió solo, navegando manualmente a /Consulta/ConsultaGeneral...');
      await page.goto('/Consulta/ConsultaGeneral');
      await page.waitForLoadState('load').catch(() => {});
    }
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {
      console.log('⚠️ Timeout esperando carga de la consulta, continuando de todos modos...');
    });
    await page.waitForTimeout(2000);

    // ── Detección de diseño ──────────────────────────────────────────────
    const headingsNuevos = ['Signos vitales', 'Apariencia general', 'Exploración segmentaria', 'Aparatos y sistemas', 'Laboratorios y Procedimientos'];
    let headingsEncontrados = 0;
    for (const h of headingsNuevos) {
      if (await page.locator(`h3:has-text("${h}")`).first().isVisible({ timeout: 1000 }).catch(() => false)) headingsEncontrados++;
    }
    const esModoCompleto = headingsEncontrados >= 3;
    console.log(`\n=== DISEÑO DETECTADO: ${esModoCompleto ? 'MODO COMPLETO (nuevo)' : 'PESTAÑAS (viejo) o no concluyente'} (${headingsEncontrados}/${headingsNuevos.length} headings) ===\n`);
    await page.screenshot({ path: 'Mediplanner produccion/test-results/prueba-00-consulta-cargada.png', fullPage: true });

    if (!esModoCompleto) {
      console.log('🛑 Producción parece tener el diseño VIEJO de pestañas — deteniendo aquí para decidir el siguiente paso con Pedro (no implementado en este script).');
      await browser.close();
      return;
    }

    // ── Llenado completo (Modo Completo) ─────────────────────────────────
    await fillGeneralSection(page, datos);
    await fillApenrienciaGeneralSection(page, datos);
    await fillChecklistSection(page, /^Exploración segmentaria$/i, 'Exploración segmentaria', datos.exploracionSegmentaria);
    await fillChecklistSection(page, /^Aparatos y sistemas$/i, 'Aparatos y sistemas', datos.aparatosSistemas);
    await fillDiagnosticoSection(page, datos);
    await fillTratamientoSection(page, datos);
    await fillLaboratoriosSection(page, datos);
    await fillNotasMedicoSection(page, datos);
    await fillServiciosSection(page, datos);

    await guardarCambiosGlobal(page);

    console.log('\n🏁 Finalizando consulta...');
    const finalizarBtn = page.getByRole('button', { name: /finalizar consulta/i }).first();
    await finalizarBtn.waitFor({ state: 'visible', timeout: 15000 });
    const finPromise = page.waitForResponse(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 15000 }).catch(() => null);
    await finalizarBtn.click();
    const finResp = await finPromise;
    console.log(`✅ finishConsultation status: ${finResp ? finResp.status() : 'sin respuesta detectada'}`);
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) await confirmBtn.click();

    console.log('\n📝 DATOS LLENADOS (para comparar con la verificación):');
    console.log(JSON.stringify(datos, null, 2));

    if (erroresApi.length > 0) {
      console.log(`\n🔴 ${erroresApi.length} respuesta(s) de API con error durante todo el flujo:`);
      erroresApi.forEach(e => console.log('   ' + e));
    } else {
      console.log('\n✅ 0 respuestas de API con error durante todo el flujo.');
    }

    // ── Verificación vía API ──────────────────────────────────────────────
    console.log('\n🔍 Verificando lo guardado vía API...');
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('.rdt_TableRow', { timeout: 20000 }).catch(() => {});
    const buscar = page.locator('input[placeholder*="Buscar" i]').first();
    await buscar.fill(PACIENTE_BUSQUEDA);
    await page.waitForTimeout(2000);

    let consultationsBody = null;
    page.on('response', async (r) => {
      if (r.url().includes('/api/consultations/getConsultations')) {
        consultationsBody = await r.json().catch(() => null);
      }
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
    if (!masReciente) {
      console.log('⚠️ No se pudo obtener la consulta recién creada vía getConsultations.');
      await browser.close();
      return;
    }
    const pacienteId = masReciente.paciente_id || masReciente.iUsuarioId || (pacienteIdMatch ? pacienteIdMatch[1] : null);
    console.log(`Consulta más reciente: id=${masReciente.id} paciente_id=${pacienteId} appointment_id=${masReciente.cita?.appointment_id} estatus=${masReciente.estatus}`);

    const detalle = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
      const resp = await fetch('/api/consultations/getConsultation', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
        body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }), credentials: 'include',
      });
      return resp.json();
    }, { pacienteId, consultaId: masReciente.id, tok: capturedToken });
    console.log('\n=== getConsultation ===');
    console.log(JSON.stringify(detalle?.data ? {
      motivo: detalle.data.motivo, padecimiento: detalle.data.padecimiento,
      notas_evolucion: detalle.data.notas_evolucion, apariencia: detalle.data.apariencia,
      diagnosticos: detalle.data.diagnosticos, impresion_diagnostico: detalle.data.impresion_diagnostico,
      servicios: detalle.data.servicios,
    } : detalle, null, 2));

    const treatments = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
      const resp = await fetch('/api/consultations/getTreatments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
        body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }), credentials: 'include',
      });
      return resp.json();
    }, { pacienteId, consultaId: masReciente.id, tok: capturedToken });
    console.log('\n=== getTreatments ===');
    console.log(JSON.stringify(treatments, null, 2).substring(0, 1500));

    const procedures = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
      const resp = await fetch('/api/procedures/getProceduresList', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
        body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }), credentials: 'include',
      });
      return resp.json();
    }, { pacienteId, consultaId: masReciente.id, tok: capturedToken });
    console.log('\n=== getProceduresList ===');
    console.log(JSON.stringify(procedures, null, 2).substring(0, 1500));

    console.log('\n✅ Verificación completa.');
  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'Mediplanner produccion/test-results/prueba-error.png', fullPage: true }).catch(() => {});
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
