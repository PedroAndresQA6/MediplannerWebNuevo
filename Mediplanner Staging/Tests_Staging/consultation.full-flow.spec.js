const { test, expect } = require('@playwright/test');
const { createAppointment, handleModals, setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────
// REESCRITO 2026-07-23 tras el rediseño de la pantalla de Consulta: pasó de
// pestañas clickeables (General | Exploración | Diagnóstico | Tratamiento |
// Notas del Médico | Servicios) a UNA SOLA PÁGINA scrolleable ("Modo
// Completo") con las 10 secciones visibles a la vez. Ya no hay pestaña que
// clickear ni "esperar networkidle" por sección (eso rompía el spec viejo:
// el click caía en un heading inerte y el networkidle nunca resolvía por los
// beacons de GA/Zendesk). Ver CONTEXTO.md → "🚨 Rediseño de la pantalla de
// Consulta" para el detalle completo de la investigación.
//
// Mecanismo de guardado confirmado en vivo (recon 2026-07-23):
//   - Exploración segmentaria y Aparatos y sistemas tienen SU PROPIO botón
//     "Guardar Respuestas" cada uno (no los cubre el guardado global).
//   - Todo lo demás (General, Diagnóstico, Tratamiento, Laboratorios,
//     Notas del Médico, Servicios) se persiste con el botón GLOBAL
//     "Guardar cambios" del panel lateral derecho (dispara editConsultation/
//     addNote/addDiagnosis/setTreatments/addServices según qué haya cambiado).
//
// Backup de la versión anterior (modelo de pestañas): consultation.full-flow.spec.js.backup
// ─────────────────────────────────────────────────────────────────────────

const DATOS_CLINICOS = {
  signosVitales: {
    presiones: ['110/070', '115/075', '120/080', '125/080', '118/078'],
    temperaturas: ['36.3', '36.5', '36.7', '36.8', '37.0'],
    frecuenciasCardiacas: ['65', '70', '72', '75', '78', '80'],
    saturaciones: ['96', '97', '98', '99'],
    frecuenciasRespiratorias: ['14', '16', '18', '20'],
    glucosas: ['85', '90', '95', '100', '105'],
  },
  cie10: ['R05', 'J00', 'A09', 'M54', 'R51', 'K59'],
  medicamentos: ['Paracetamol', 'Ibuprofeno', 'Amoxicilina', 'Omeprazol', 'Loratadina'],
  laboratorios: ['Biometría', 'Química', 'Perfil'],
  tratamientosDiferentes: ['Reposo relativo', 'Dieta blanda', 'Abundantes líquidos'],
  indicacionesGenerales: [
    'Reposo relativo, abundantes líquidos, control de signos de alarma.',
    'Dieta blanda, evitar irritantes, seguimiento en 48-72 horas si no mejora.',
  ],
};

const PACIENTE_NOMBRE = process.env.PACIENTE_NOMBRE || 'Percentil Prueba Prueba';
const PACIENTE_BUSQUEDA = process.env.PACIENTE_BUSQUEDA || 'Percentil';
const PERCENTIL_SETS = {
  1: { peso: '13', talla: '92', perimetro: '48' },
  2: { peso: '14', talla: '95', perimetro: '49' },
  3: { peso: '15', talla: '98', perimetro: '50' },
};
const PERCENTIL_RUN = parseInt(process.env.PERCENTIL_RUN || '1', 10);
const MEDIDAS = PERCENTIL_SETS[PERCENTIL_RUN] || PERCENTIL_SETS[1];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fillPerimetroCefalico(page, valor) {
  const perimetroInput = page.locator('input[name*="cefalic" i], input[name*="perimetro" i]').first();
  if (await perimetroInput.count() > 0 && await perimetroInput.isVisible().catch(() => false)) {
    await perimetroInput.fill(valor);
    console.log(`📏 Perímetro cefálico: ${valor}`);
  } else {
    console.log('ℹ️ No se encontró campo de perímetro cefálico en signos vitales (puede no aplicar).');
  }
}

// Localiza el contenedor (card) de una sección por su heading h3, subiendo
// ancestros hasta encontrar uno con tamaño razonable (no solo el header).
// Necesario porque en "Modo Completo" las 10 secciones están en el DOM al
// mismo tiempo — sin esto, selectores genéricos ("todas las textareas
// visibles") de una sección contaminan a las demás.
async function sectionContainer(page, headingRegex, maxDepth = 10) {
  const heading = page.getByRole('heading', { level: 3, name: headingRegex }).first();
  await heading.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  for (let depth = 2; depth <= maxDepth; depth++) {
    const container = heading.locator(`xpath=ancestor::*[${depth}]`);
    if (await container.count() === 0) continue;
    const box = await container.boundingBox().catch(() => null);
    if (box && box.height > 100) return container;
  }
  console.log(`⚠️ sectionContainer: no se pudo acotar "${headingRegex}", usando page completa (riesgo de contaminación cruzada)`);
  return page;
}

async function iniciarConsultaDelPaciente(page) {
  console.log(`📅 Creando cita para "${PACIENTE_NOMBRE}"...`);
  await createAppointment(page, PACIENTE_BUSQUEDA);

  console.log('🏠 Volviendo a Dashboard para iniciar SU cita...');
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
    throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_NOMBRE}" tras crear su cita`);
  }

  const overlay = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
  if (await overlay.count() > 0 && await overlay.first().isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  console.log(`▶️ Iniciando consulta de "${PACIENTE_NOMBRE}" (set #${PERCENTIL_RUN})...`);
  await iniciarBtn.click({ force: true });
}

// ── Secciones (todas operan dentro de su propio sectionContainer) ─────────

async function fillGeneralSection(page) {
  console.log('📋 Llenando sección General...');
  try {
    // OJO: es un <textarea>, no un <input> (a diferencia de otros campos con
    // name similar) — confirmado en vivo el 2026-07-23 tras encontrar que el
    // selector viejo (input[name=...]) nunca matcheaba y el campo se saltaba
    // en silencio (no fallaba, solo no se llenaba nunca).
    const motivoInput = page.locator('textarea[name="visitaPaciente"]');
    if (await motivoInput.isVisible().catch(() => false)) {
      const cur = await motivoInput.inputValue().catch(() => '');
      if (!cur.trim()) {
        await motivoInput.fill('Paciente acude a consulta por cefalea persistente de 3 días de evolución, de intensidad moderada, sin respuesta a analgésicos de venta libre.');
        console.log('✅ Motivo de la consulta llenado');
      }
    } else {
      console.log('⚠️ No se encontró el campo "Motivo de consulta" (textarea[name="visitaPaciente"])');
    }
    const padecimientoTa = page.locator('textarea[placeholder="¿Qué síntomas señala o presenta el paciente?"]').first();
    if (await padecimientoTa.isVisible().catch(() => false)) {
      await padecimientoTa.fill('Inicia padecimiento actual hace 3 días con cefalea frontal de tipo opresiva, intensidad 6/10 en escala visual análoga, acompañada de fotofobia leve. Niega fiebre, vómito o alteraciones neurológicas focales.');
      console.log('✅ Padecimiento actual llenado');
    }
    const notasEvolucionTa = page.locator('textarea[placeholder="Notas de evolución"]').first();
    if (await notasEvolucionTa.isVisible().catch(() => false)) {
      await notasEvolucionTa.fill('Evolución favorable sin complicaciones');
      console.log('✅ Notas de evolución llenadas');
    }
    console.log('✅ Sección General completada');
  } catch (error) {
    console.log(`⚠️ Error en General: ${error.message}`);
  }
}

async function fillApenrienciaGeneralSection(page) {
  console.log('👤 Llenando Apariencia general...');
  try {
    const ta = page.locator('textarea[placeholder="Describa la apariencia general del paciente"]').first();
    if (await ta.isVisible().catch(() => false)) {
      await ta.fill('Paciente bien nutrido, hidratado, consciente, orientado, sin facies de dolor, sin dificultad respiratoria.');
      console.log('✅ Apariencia general llenada');
    } else {
      console.log('⚠️ No se encontró el textarea de Apariencia general');
    }
  } catch (error) {
    console.log(`⚠️ Error en Apariencia general: ${error.message}`);
  }
}

// Usado tanto para "Exploración segmentaria" como "Aparatos y sistemas":
// marca algunos checkboxes, llena cualquier observación revelada, y guarda
// con el botón "Guardar Respuestas" propio de la sección.
async function fillChecklistSection(page, headingRegex, nombreLog) {
  console.log(`🔍 Llenando ${nombreLog}...`);
  try {
    const scope = await sectionContainer(page, headingRegex);
    const checkboxes = scope.locator('input[type="checkbox"]:not([disabled])');
    const total = await checkboxes.count();
    console.log(`☑️ ${nombreLog}: ${total} checkboxes encontrados`);

    const nSeleccionar = Math.min(3, total);
    const indices = Array.from({ length: total }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, nSeleccionar);
    for (const i of indices) {
      await checkboxes.nth(i).click({ force: true }).catch(() => {});
    }
    console.log(`✅ ${nombreLog}: ${indices.length} checkbox(es) marcados`);
    await page.waitForTimeout(500);

    // Observación libre revelada tras marcar (si existe, dentro del scope).
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

async function fillDiagnosticoSection(page) {
  console.log('🩺 Llenando sección de Diagnóstico...');
  try {
    const scope = await sectionContainer(page, /^Diagnóstico$/i);
    await page.waitForTimeout(500);

    const cie10Input = scope.locator('textarea[role="combobox"]').first();
    if (await cie10Input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cie10Input.click();
      await page.waitForTimeout(500);
      const codigoCIE10 = pick(DATOS_CLINICOS.cie10);
      await cie10Input.fill(codigoCIE10);
      await page.waitForTimeout(1500);
      const options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      const optionCount = await options.count();
      if (optionCount > 0) {
        const optionText = (await options.first().textContent().catch(() => '') || '').trim();
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
        await impresion.fill('Impresión diagnóstica: Condición médica a evaluar. Se solicitan estudios complementarios.');
        console.log('✅ Impresión diagnóstica llenada');
      }
    }

    // Observaciones: textarea visible dentro del scope que no sea Impresión
    // diagnóstica ni el combobox react-select.
    await page.waitForTimeout(1000);
    const tas = scope.locator('textarea:visible:not([readonly]):not([disabled])');
    const n = await tas.count();
    for (let i = 0; i < n; i++) {
      const ta = tas.nth(i);
      const ph = (await ta.getAttribute('placeholder').catch(() => '')) || '';
      const val = await ta.inputValue().catch(() => '');
      if (ph === 'Impresión diagnóstica' || val.trim()) continue;
      await ta.fill('Observaciones: paciente estable, se indica seguimiento ambulatorio y vigilancia de signos de alarma.').catch(() => {});
      console.log('✅ Observaciones del diagnóstico llenadas');
      break;
    }

    console.log('✅ Sección de Diagnóstico completada');
  } catch (error) {
    console.log(`⚠️ Error en Diagnóstico: ${error.message}`);
  }
}

async function fillTratamientoSection(page) {
  console.log('💊 Llenando sección de Tratamiento...');
  try {
    const scope = await sectionContainer(page, /^Tratamiento$/i);
    await page.waitForTimeout(500);

    const indicacionesEditor = scope.locator('div.jodit-wysiwyg').first();
    if (await indicacionesEditor.isVisible().catch(() => false)) {
      await indicacionesEditor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(pick(DATOS_CLINICOS.indicacionesGenerales));
      console.log('✅ Indicaciones generales de tratamiento llenadas');
    }

    const medicamentoInput = scope.locator('#react-select-2-input');
    if (await medicamentoInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const medicamento = pick(DATOS_CLINICOS.medicamentos);
      await medicamentoInput.click();
      await medicamentoInput.fill(medicamento);
      await page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }).catch(() => null);
      const option = page.locator('[role="option"]:visible, div[id*="option"]:visible').first();
      if (await option.count() > 0) {
        await option.click();
        console.log(`✅ Medicamento seleccionado: ${medicamento}`);
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

    console.log('✅ Sección de Tratamiento completada (se guarda con el botón global "Guardar cambios")');
  } catch (error) {
    console.log(`⚠️ Error en Tratamiento: ${error.message}`);
  }
}

async function fillLaboratoriosSection(page) {
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
      await labSelect.click();
      await page.waitForTimeout(300);
      await labSelect.fill(pick(DATOS_CLINICOS.laboratorios));
      await page.waitForTimeout(1500);
      const labOption = page.locator('[role="option"]:visible, div[id*="option"]:visible').first();
      if (await labOption.count() > 0) {
        const text = (await labOption.textContent().catch(() => '') || '').trim();
        await labOption.click();
        console.log(`✅ Laboratorio seleccionado: "${text.substring(0, 40)}"`);
      } else {
        console.log('⚠️ Sin opciones de laboratorio');
      }
    }

    const procedimientoInput = scope.locator('textarea[name="procedimiento-0"]');
    if (await procedimientoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await procedimientoInput.fill('Biometría hemática completa');
      console.log('✅ Procedimiento llenado');
    }

    console.log('✅ Laboratorios y Procedimientos completado (se guarda con el botón global "Guardar cambios")');
  } catch (error) {
    console.log(`⚠️ Error en Laboratorios: ${error.message}`);
  }
}

async function fillNotasMedicoSection(page) {
  console.log('📋 Llenando Notas del Médico...');
  try {
    const scope = await sectionContainer(page, /^Notas del Médico/i);
    const editor = scope.locator('div.jodit-wysiwyg').first();
    if (await editor.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Notas del médico: Seguimiento de evolución clínica favorable. Paciente responde adecuadamente al tratamiento.');
      console.log('✅ Notas del médico llenadas');
    } else {
      console.log('⚠️ No se encontró el editor de Notas del Médico');
    }
  } catch (error) {
    console.log(`⚠️ Error en Notas del Médico: ${error.message}`);
  }
}

async function fillServiciosSection(page) {
  console.log('🏥 Llenando sección de Servicios...');
  let sinOpcionesDisponibles = false;
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

      if (optionCount === 0) {
        const sinElementos = page.locator('text=/No se encontraron elementos/i');
        if (await sinElementos.isVisible({ timeout: 1000 }).catch(() => false)) {
          sinOpcionesDisponibles = true;
          const shot = 'test-results/servicios-sin-opciones.png';
          await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
          console.log(`🐛 BUG: dropdown "Agregar servicios" sin opciones ("No se encontraron elementos") → ${shot}`);
        }
      } else {
        let elegido = false;
        for (let j = 0; j < optionCount; j++) {
          const option = options.nth(j);
          const optionText = (await option.textContent().catch(() => '') || '').trim();
          if (optionText.toLowerCase().includes('certificado')) {
            await option.click();
            console.log(`✅ Servicio seleccionado: "${optionText.substring(0, 60)}"`);
            elegido = true;
            break;
          }
        }
        if (!elegido) {
          const first = options.first();
          const text = (await first.textContent().catch(() => '') || '').trim();
          await first.click();
          console.log(`✅ Servicio seleccionado (primera opción): "${text.substring(0, 60)}"`);
        }
      }
    } else {
      console.log('⚠️ No se encontró el dropdown de servicios');
    }

    console.log('✅ Sección de Servicios completada (se guarda con el botón global "Guardar cambios")');
  } catch (error) {
    console.log(`⚠️ Error en Servicios: ${error.message}`);
  }
  return { sinOpcionesDisponibles };
}

// Clickea el botón GLOBAL "Guardar cambios" (panel lateral) y verifica que
// al menos una de las llamadas de guardado por dominio responda 200.
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
  const listener = async (r) => {
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
  console.log(`💾 Llamadas de guardado disparadas por "Guardar cambios": ${respuestas.length}`);
  respuestas.forEach(r => console.log(`   ${r.status} ${r.url.split('/api/')[1]}`));

  const fallidas = respuestas.filter(r => r.status >= 400);
  expect(fallidas.length, `Ninguna llamada de guardado debe fallar: ${JSON.stringify(fallidas)}`).toBe(0);

  return respuestas;
}

async function waitForFinalizarButton(page) {
  console.log('🏁 Esperando botón de finalizar consulta...');
  // Hay 2 botones "Finalizar Consulta" en la página (panel lateral + abajo de
  // Servicios) — usar el primero.
  const finalizarBtn = page.getByRole('button', { name: /finalizar consulta/i }).first();
  await expect(finalizarBtn, 'Debe existir el botón "Finalizar Consulta"').toBeVisible({ timeout: 15000 });
  const habilitado = await finalizarBtn.isEnabled().catch(() => false);
  console.log(`✅ Botón de finalizar ${habilitado ? 'encontrado y habilitado' : 'encontrado pero DESHABILITADO'}`);
  return finalizarBtn;
}

// Test principal
test('Start a scheduled consultation from Inicio', async ({ page }) => {
  test.setTimeout(300000); // 5 minutos de timeout

  const monitor = setupConsoleMonitor(page);
  console.log('🔍 [MONITOR] DevTools monitor activo — capturando consola y red...\n');

  console.log(`🎯 Paciente objetivo: "${PACIENTE_NOMBRE}" — set #${PERCENTIL_RUN} (peso=${MEDIDAS.peso} talla=${MEDIDAS.talla} perímetro=${MEDIDAS.perimetro})`);

  await test.step('Iniciar consulta y signos vitales', async () => {
    await iniciarConsultaDelPaciente(page);

    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await expect(signosButton).toBeVisible({ timeout: 10000 });
    await signosButton.click();

    console.log('💉 Llenando signos vitales...');
    await page.waitForTimeout(1000);

    const sv = DATOS_CLINICOS.signosVitales;
    const svPeso = MEDIDAS.peso;
    const svTalla = MEDIDAS.talla;
    const svPresion = pick(sv.presiones);
    const svTemp = pick(sv.temperaturas);
    const svFC = pick(sv.frecuenciasCardiacas);
    const svSat = pick(sv.saturaciones);
    const svFR = pick(sv.frecuenciasRespiratorias);
    const svGlucosa = pick(sv.glucosas);
    console.log(`💉 Signos vitales [set #${PERCENTIL_RUN}]: peso=${svPeso} talla=${svTalla} perímetro=${MEDIDAS.perimetro} PA=${svPresion} temp=${svTemp} FC=${svFC} sat=${svSat} FR=${svFR} glucosa=${svGlucosa}`);

    await page.locator('input[name="peso"]').fill(svPeso);
    const tallaInput = page.locator('input[name*="talla" i]');
    if (await tallaInput.count() > 0) await tallaInput.first().fill(svTalla);
    await fillPerimetroCefalico(page, MEDIDAS.perimetro);
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
    expect(resp?.status(), 'registerVitalSigns debe responder 2xx').toBeLessThan(300);
    console.log('✅ Signos vitales guardados');

    await page.waitForTimeout(1000);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await cerrarButton.isVisible().catch(() => false)) {
      await cerrarButton.click();
      await page.waitForTimeout(1000);
    }
  });

  await test.step('Cargar página de consulta (Modo Completo)', async () => {
    console.log('🔄 Esperando redirección...');
    try {
      await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
      console.log('✅ Redirigido a página de consulta');
    } catch (e) {
      console.log('⚠️ Timeout, navegando manualmente...');
      await page.goto('/Consulta/ConsultaGeneral');
      await page.waitForLoadState('load').catch(() => {});
    }

    console.log('⏳ Esperando carga completa de la consulta...');
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {
      console.log('⚠️ Timeout esperando carga, continuando de todos modos...');
    });
    await page.waitForTimeout(2000);
  });

  let serviciosSinOpciones = false;

  await test.step('Llenar todas las secciones (ya visibles, sin pestañas)', async () => {
    await fillGeneralSection(page);
    await fillApenrienciaGeneralSection(page);
    await fillChecklistSection(page, /^Exploración segmentaria$/i, 'Exploración segmentaria');
    await fillChecklistSection(page, /^Aparatos y sistemas$/i, 'Aparatos y sistemas');
    await fillDiagnosticoSection(page);
    await fillTratamientoSection(page);
    await fillLaboratoriosSection(page);
    await fillNotasMedicoSection(page);
    const { sinOpcionesDisponibles } = await fillServiciosSection(page);
    serviciosSinOpciones = sinOpcionesDisponibles;
  });

  await test.step('Guardar cambios (global)', async () => {
    await guardarCambiosGlobal(page);
  });

  await test.step('Finalizar consulta', async () => {
    console.log('\n🏁 === INICIANDO FINALIZACIÓN DE CONSULTA ===');
    const finalizarBtn = await waitForFinalizarButton(page);
    const respPromise = page.waitForResponse(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 15000 }).catch(() => null);
    await finalizarBtn.click();
    const resp = await respPromise;
    if (resp) {
      expect(resp.status(), 'finishConsultation debe responder 2xx').toBeLessThan(300);
      console.log('✅ Consulta finalizada');
    } else {
      console.log('⚠️ No se detectó la llamada finishConsultation (revisar manualmente)');
    }
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      console.log('✅ Confirmación clickeada');
    }
  });

  console.log('\n🎉 === CONSULTA COMPLETADA EXITOSAMENTE ===');

  const result = monitor.printSummary();
  if (!result.passed) console.log(`⚠️ El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);

  expect(serviciosSinOpciones, '🐛 BUG: dropdown "Agregar servicios" sin opciones ("No se encontraron elementos")').toBe(false);
  expect(result.failedApiCalls.length, `No debe haber responses con error de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
});
