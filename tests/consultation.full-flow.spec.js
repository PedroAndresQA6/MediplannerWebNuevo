const { test, expect } = require('@playwright/test');
const { handleModals, setupConsoleMonitor, auditarPantalla, asegurarCitaDeHoy } = require('../e2e/utils.js');
const { opcional, reporteOpcionales } = require('../e2e/opcional.js');

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
// Mecanismo de guardado confirmado en vivo (recon 2026-07-23, actualizado
// 2026-09-10):
//   - Exploración segmentaria y Aparatos y sistemas: la suposición vieja de
//     que tienen SU PROPIO botón "Guardar Respuestas" está desactualizada —
//     confirmado en vivo que ese botón ya no aparece en ninguna de las 2
//     secciones. En su lugar, cada respuesta (checkbox + Normal/Anormal +
//     Observaciones) se autoguarda apenas se completa, vía
//     `POST /api/patients/registerAnswers` (200 OK confirmado), sin botón.
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

// Textos fijos (no aleatorios) usados al llenar — se extraen a constantes
// para poder reutilizarlos tal cual en la verificación post-Finalizar, sin
// duplicar los literales ni arriesgar que se desincronicen entre llenado y
// verificación.
const TEXTO_MOTIVO = 'Paciente acude a consulta por cefalea persistente de 3 días de evolución, de intensidad moderada, sin respuesta a analgésicos de venta libre.';
const TEXTO_PADECIMIENTO = 'Inicia padecimiento actual hace 3 días con cefalea frontal de tipo opresiva, intensidad 6/10 en escala visual análoga, acompañada de fotofobia leve. Niega fiebre, vómito o alteraciones neurológicas focales.';
const TEXTO_NOTAS_EVOLUCION = 'Evolución favorable sin complicaciones';
const TEXTO_NOMBRE_REFERIDO = 'Dr. Alejandro Torres (Medicina General)';
const TEXTO_APARIENCIA = 'Paciente bien nutrido, hidratado, consciente, orientado, sin facies de dolor, sin dificultad respiratoria.';
const TEXTO_IMPRESION_DIAGNOSTICA = 'Impresión diagnóstica: Condición médica a evaluar. Se solicitan estudios complementarios.';
const TEXTO_OBSERVACIONES_DIAGNOSTICO = 'Observaciones: paciente estable, se indica seguimiento ambulatorio y vigilancia de signos de alarma.';
const TEXTO_INDICACIONES_LAB = 'Solicitar estudios de laboratorio de rutina';
const TEXTO_PROCEDIMIENTO = 'Biometría hemática completa';
const TEXTO_NOTAS_MEDICO = 'Notas del médico: Seguimiento de evolución clínica favorable. Paciente responde adecuadamente al tratamiento.';

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
  if (await perimetroInput.count() > 0 && await opcional(perimetroInput.isVisible(), 'signos-vitales:perimetro-cefalico-visible')) {
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
  await opcional(heading.waitFor({ state: 'visible', timeout: 15000 }), 'sectionContainer:heading-espera-visible');

  // Estrategia principal: subir hasta el ancestro con class="card" (el mismo
  // patrón que ya usa con éxito auditConsultationIndicators()/
  // detectUnsavedSections() en e2e/utils.js para TODOS los apartados de la
  // consulta, "Exploración segmentaria"/"Aparatos y sistemas" incluidos).
  const cardAncestor = heading.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," card ")][1]');
  if (await cardAncestor.count() > 0) {
    const box = await opcional(cardAncestor.boundingBox(), 'sectionContainer:card-ancestor-boundingbox');
    if (box && box.height > 50) return cardAncestor;
  }

  // Fallback: el heurístico viejo de "primer ancestro con altura > 100px".
  // Confirmado en vivo 2026-09-10: para "Exploración segmentaria" este
  // heurístico solo NUNCA encontraba nada (los 10 niveles fallaban), y el
  // fallback de ese entonces (page.locator('body'), scope = página completa)
  // hacía que fillChecklistSection escribiera sus "Observaciones" en los
  // PRIMEROS <textarea> visibles de TODA la página — que resultaron ser los
  // de "General"/"Apariencia general" — pisándolos con texto de checklist
  // ("motivo" terminó con "Cabeza: sin alteraciones..."). Ver CONTEXTO.md.
  // Por eso ahora, si ni el ancestro .card ni este heurístico encuentran un
  // contenedor real, se prefiere TRONAR (el section no se llena y el test lo
  // reporta) antes que arriesgar contaminación cruzada silenciosa.
  for (let depth = 2; depth <= maxDepth; depth++) {
    const container = heading.locator(`xpath=ancestor::*[${depth}]`);
    if (await container.count() === 0) continue;
    const box = await opcional(container.boundingBox(), 'sectionContainer:fallback-ancestor-boundingbox');
    if (box && box.height > 100) return container;
  }
  throw new Error(`sectionContainer: no se pudo acotar "${headingRegex}" ni por .card ni por altura — abortando en vez de arriesgar contaminación cruzada con scope de página completa`);
}

// Dev puede caer en el wizard de "Configuración de tu cuenta" (6 pasos:
// perfil/credenciales/consultorios/horarios/tipos de cita/métodos de pago) o
// en el onboarding simple, en vez del Dashboard directo — ver CONTEXTO.md.
// Salir de cualquiera de los 2 si aparecen.
async function saltarOnboardingYWizardConfig(page) {
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await opcional(explorarLink.isVisible({ timeout: 3000 }), 'onboarding:link-explorar-visible')) {
    console.log('ℹ️ Onboarding detectado — clickeando "Prefiero explorar por mi cuenta"');
    await opcional(explorarLink.click({ force: true }), 'onboarding:link-explorar-click');
    await opcional(page.waitForLoadState('load', { timeout: 20000 }), 'onboarding:load-tras-explorar');
    await page.waitForTimeout(1500);
  }
  const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
  if (await opcional(configurarMasTardeLink.isVisible({ timeout: 3000 }), 'onboarding:link-configurar-mas-tarde-visible')) {
    console.log('ℹ️ Wizard de "Configuración de tu cuenta" detectado — clickeando "Configurar más tarde"');
    await opcional(configurarMasTardeLink.click({ force: true }), 'onboarding:link-configurar-mas-tarde-click');
    await opcional(page.waitForLoadState('load', { timeout: 20000 }), 'onboarding:load-tras-configurar-mas-tarde');
    await page.waitForTimeout(1500);
  }
}

async function iniciarConsultaDelPaciente(page) {
  console.log('🏠 Yendo a Dashboard a revisar si ya hay una cita de hoy...');
  await page.goto('/Dashboard');
  await opcional(page.waitForLoadState('load'), 'iniciar-consulta:load-tras-dashboard');
  await page.waitForTimeout(2000);
  await saltarOnboardingYWizardConfig(page);

  // Etapa 5 de docs/tarea-actual.md: la cita es una PRECONDICIÓN de este test,
  // no su objetivo — se reutiliza la de hoy si ya existe, en vez de crear una
  // nueva cada vez (createAppointment toma el PRIMER día de los próximos 5 con
  // horario libre si hace falta crear, no necesariamente hoy — confirmado en
  // vivo 2026-07-31 que dev puede tener la agenda llena los próximos 2-3 días).
  const { reutilizada, iniciarBtn } = await asegurarCitaDeHoy(page, PACIENTE_BUSQUEDA);
  console.log(reutilizada
    ? `📅 "${PACIENTE_NOMBRE}" ya tenía una cita de hoy — se reutiliza.`
    : `📅 No había cita de hoy para "${PACIENTE_NOMBRE}" — se creó una nueva.`);
  if (!iniciarBtn) {
    throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_NOMBRE}"`);
  }

  const overlay = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
  if (await overlay.count() > 0 && await opcional(overlay.first().isVisible(), 'iniciar-consulta:overlay-modal-visible')) {
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
    if (await opcional(motivoInput.isVisible(), 'general:motivo-visible')) {
      const cur = (await opcional(motivoInput.inputValue(), 'general:motivo-valor-actual')) ?? '';
      if (!cur.trim()) {
        await motivoInput.fill(TEXTO_MOTIVO);
        console.log('✅ Motivo de la consulta llenado');
      }
    } else {
      console.log('⚠️ No se encontró el campo "Motivo de consulta" (textarea[name="visitaPaciente"])');
    }
    const padecimientoTa = page.locator('textarea[placeholder="¿Qué síntomas señala o presenta el paciente?"]').first();
    if (await opcional(padecimientoTa.isVisible(), 'general:padecimiento-visible')) {
      await padecimientoTa.fill(TEXTO_PADECIMIENTO);
      console.log('✅ Padecimiento actual llenado');
    }
    const notasEvolucionTa = page.locator('textarea[placeholder="Notas de evolución"]').first();
    if (await opcional(notasEvolucionTa.isVisible(), 'general:notas-evolucion-visible')) {
      await notasEvolucionTa.fill(TEXTO_NOTAS_EVOLUCION);
      console.log('✅ Notas de evolución llenadas');
    }
    // 4º campo editable de General (antes se saltaba en silencio, dejando la
    // sección incompleta) — confirmado por captura real: input de texto con
    // placeholder "¿Quién refirió al paciente?".
    const nombreReferidoInput = page.locator('input[placeholder="¿Quién refirió al paciente?"], textarea[placeholder="¿Quién refirió al paciente?"]').first();
    if (await opcional(nombreReferidoInput.isVisible(), 'general:nombre-referido-visible')) {
      await nombreReferidoInput.fill(TEXTO_NOMBRE_REFERIDO);
      console.log('✅ Nombre referido llenado');
    } else {
      console.log('⚠️ No se encontró el campo "Nombre referido"');
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
    if (await opcional(ta.isVisible(), 'apariencia-general:textarea-visible')) {
      await ta.fill(TEXTO_APARIENCIA);
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
    // El apartado muestra su propio texto "Cargando..." (ej. "Cargando
    // preguntas") mientras trae el checklist por su cuenta (API aparte),
    // después de que el heading ya es visible. Esperar explícitamente a que
    // ese texto desaparezca — no solo a que el primer checkbox se "attache"
    // — evita leer el total a mitad de carga.
    await opcional(page.waitForFunction(
      (el) => !el || !el.innerText || !el.innerText.toLowerCase().includes('cargando'),
      await scope.elementHandle(),
      { timeout: 15000 }
    ), `${nombreLog}:espera-cargando-checklist`);
    const checkboxes = scope.locator('input[type="checkbox"]:not([disabled])');
    await opcional(checkboxes.first().waitFor({ state: 'attached', timeout: 8000 }), `${nombreLog}:primer-checkbox-attached`);
    const total = await checkboxes.count();
    console.log(`☑️ ${nombreLog}: ${total} checkboxes encontrados`);

    // Marcar TODOS los checkboxes del apartado (no una muestra al azar) para
    // que ningún grupo/apartado quede sin cobertura — antes se marcaban solo
    // 3 al azar de todo el scope, lo que en la práctica dejaba varios
    // apartados (Cabeza/Cuello, Tórax, Abdomen, etc.) sin ningún checkbox
    // marcado la mayoría de las corridas.
    //
    // Cada checkbox, al marcarlo, revela su PROPIO sub-formulario individual
    // (confirmado en vivo 2026-07-28): un par de botones "Normal"/"Anormal"
    // (<label> dentro de div.simpleSelect, radio oculto detrás) + un
    // <textarea> de Observaciones propio. Resolver cada sub-formulario DENTRO
    // del mismo loop que marca los checkboxes resultó frágil bajo la lentitud
    // de dev: usar "los últimos 2 botones / el último textarea renderizados"
    // se desalineó a mitad de lista en varias corridas (quedaban ítems con
    // Observaciones llena pero sin Normal/Anormal seleccionado, o viceversa).
    // Ahora se separa en 2 pasadas: (1) marcar todos los checkboxes y esperar
    // a que TODOS los sub-formularios terminen de renderizar, (2) recorrerlos
    // por índice fijo (par de botones 2i/2i+1, textarea i) — solo confiable
    // una vez que la lista completa ya está montada y estable.
    const etiquetas = await checkboxes.evaluateAll((els) => els.map((el, i) => {
      const lbl = el.parentElement && el.parentElement.querySelector('label');
      const txt = (lbl && lbl.textContent || '').trim();
      return txt || `#${i}`;
    }));
    // Cuando este es el PRIMER apartado en llenarse, el checklist puede seguir
    // "asentándose" justo cuando el heading se vuelve visible — "attached" no
    // garantiza que ya sea interactivo. Se vio en vivo (2026-07-28): un click
    // en tandem con `force:true` sin espera entre ítems dejó los 8 checkboxes
    // de "Exploración segmentaria" sin marcar (todos seguían en su icono "+"),
    // mientras que "Aparatos y sistemas" (2do apartado, ya sin esa carrera) sí
    // funcionó. Se agrega una pequeña espera entre clicks y una verificación +
    // reintento por checkbox para no depender de que el primer click alcance.
    for (let i = 0; i < total; i++) {
      const cb = checkboxes.nth(i);
      await opcional(cb.click({ force: true }), `${nombreLog}:checkbox-click-1er-intento`);
      await page.waitForTimeout(150);
      if (!(await opcional(cb.isChecked(), `${nombreLog}:checkbox-ischecked-tras-1er-click`))) {
        await opcional(cb.click({ force: true }), `${nombreLog}:checkbox-click-reintento`);
        await page.waitForTimeout(200);
      }
    }
    const marcados = await checkboxes.evaluateAll((els) => els.filter(el => el.checked).length);
    console.log(`✅ ${nombreLog}: ${marcados}/${total} checkbox(es) marcados → [${etiquetas.join(', ')}]`);
    if (marcados < total) {
      console.log(`⚠️ ${nombreLog}: ${total - marcados} checkbox(es) NO quedaron marcados tras el reintento`);
    }

    await page.waitForTimeout(1500);
    const botones = scope.locator('div.simpleSelect label');
    const textareas = scope.locator('textarea:visible');
    const botonesCount = (await opcional(botones.count(), `${nombreLog}:botones-normal-anormal-count`)) ?? 0;
    const textareasCount = (await opcional(textareas.count(), `${nombreLog}:textareas-observaciones-count`)) ?? 0;
    console.log(`${nombreLog}: ${botonesCount} botones Normal/Anormal (esperados ${total * 2}) | ${textareasCount} campos de Observaciones (esperados ${total})`);

    const items = [];
    for (let i = 0; i < total; i++) {
      const nombreItem = etiquetas[i];
      const elegirAnormal = i % 2 === 1;
      let botonResuelto = false;
      if (botonesCount >= (i + 1) * 2) {
        await opcional(botones.nth(i * 2 + (elegirAnormal ? 1 : 0)).click({ force: true }), `${nombreLog}:boton-normal-anormal-click`);
        await page.waitForTimeout(250);
        botonResuelto = true;
      } else {
        console.log(`⚠️ ${nombreLog}: "${nombreItem}" (índice ${i}) no tiene botones Normal/Anormal disponibles`);
      }
      // Texto distinto por ítem (incluye su nombre) para poder rastrear en
      // getFilledForm cuál se llenó y no confundir la información al guardar.
      let observacionEsperada = null;
      if (textareasCount > i) {
        observacionEsperada = elegirAnormal
          ? `${nombreItem}: hallazgo anormal detectado en ${nombreItem.toLowerCase()}, se sugiere valoración adicional (ítem #${i} de ${nombreLog}).`
          : `${nombreItem}: sin alteraciones aparentes en ${nombreItem.toLowerCase()} (ítem #${i} de ${nombreLog}).`;
        await opcional(textareas.nth(i).fill(observacionEsperada), `${nombreLog}:textarea-observaciones-fill`);
      } else {
        console.log(`⚠️ ${nombreLog}: "${nombreItem}" (índice ${i}) no tiene campo de Observaciones disponible`);
      }
      items.push({
        nombre: nombreItem,
        valorEsperado: botonResuelto ? (elegirAnormal ? 2 : 1) : null,
        observacionEsperada,
      });
    }
    console.log(`✅ ${nombreLog}: Normal/Anormal y Observaciones resueltos para los ${total} ítems → [${etiquetas.join(', ')}]`);
    await page.waitForTimeout(500);

    const guardarBtn = scope.locator('button:has-text("Guardar Respuestas")').first();
    if (await opcional(guardarBtn.isVisible({ timeout: 3000 }), `${nombreLog}:boton-guardar-respuestas-visible`)) {
      await guardarBtn.click();
      await page.waitForTimeout(1500);
      await handleModals(page);
      console.log(`💾 ${nombreLog}: "Guardar Respuestas" clickeado`);
    } else {
      console.log(`⚠️ ${nombreLog}: no se encontró su botón "Guardar Respuestas"`);
    }
    return { total, marcados, items };
  } catch (error) {
    console.log(`⚠️ Error en ${nombreLog}: ${error.message}`);
    return { total: 0, marcados: 0, items: [] };
  }
}

async function fillDiagnosticoSection(page) {
  console.log('🩺 Llenando sección de Diagnóstico...');
  try {
    const scope = await sectionContainer(page, /^Diagnóstico$/i);
    await page.waitForTimeout(500);

    const cie10Input = scope.locator('textarea[role="combobox"]').first();
    if (await opcional(cie10Input.isVisible({ timeout: 3000 }), 'diagnostico:cie10-combobox-visible')) {
      await cie10Input.click();
      await page.waitForTimeout(500);
      const codigoCIE10 = pick(DATOS_CLINICOS.cie10);
      await cie10Input.fill(codigoCIE10);
      await page.waitForTimeout(1500);
      const options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      const optionCount = await options.count();
      if (optionCount > 0) {
        const optionText = (await opcional(options.first().textContent(), 'diagnostico:cie10-opcion-textcontent') || '').trim();
        await options.first().click();
        console.log(`✅ Diagnóstico CIE-10 seleccionado: "${optionText.substring(0, 40)}..."`);
      } else {
        console.log(`⚠️ Sin opciones de CIE-10 para "${codigoCIE10}"`);
      }
    } else {
      console.log('⚠️ No se encontró el combobox de CIE-10 en Diagnóstico');
    }

    const impresion = scope.locator('textarea[placeholder="Impresión diagnóstica"]').first();
    if (await opcional(impresion.isVisible({ timeout: 2000 }), 'diagnostico:impresion-visible')) {
      const cur = (await opcional(impresion.inputValue(), 'diagnostico:impresion-valor-actual')) ?? '';
      if (!cur.trim()) {
        await impresion.fill(TEXTO_IMPRESION_DIAGNOSTICA);
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
      const ph = (await opcional(ta.getAttribute('placeholder'), 'diagnostico:observaciones-textarea-placeholder')) || '';
      const val = (await opcional(ta.inputValue(), 'diagnostico:observaciones-textarea-valor-actual')) ?? '';
      if (ph === 'Impresión diagnóstica' || val.trim()) continue;
      await opcional(ta.fill(TEXTO_OBSERVACIONES_DIAGNOSTICO), 'diagnostico:observaciones-textarea-fill');
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
    if (await opcional(indicacionesEditor.isVisible(), 'tratamiento:indicaciones-editor-visible')) {
      await indicacionesEditor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(pick(DATOS_CLINICOS.indicacionesGenerales));
      console.log('✅ Indicaciones generales de tratamiento llenadas');
    }

    const medicamentoInput = scope.locator('#react-select-2-input');
    if (await opcional(medicamentoInput.isVisible({ timeout: 3000 }), 'tratamiento:medicamento-input-visible')) {
      const medicamento = pick(DATOS_CLINICOS.medicamentos);
      await medicamentoInput.click();
      await medicamentoInput.fill(medicamento);
      await opcional(page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }), 'tratamiento:medicamento-opciones-espera');
      const options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      const optionCount = await options.count();
      if (optionCount > 0) {
        // El buscador no siempre filtra estricto por lo tipeado — buscar una
        // opción que realmente contenga el término, no asumir que la primera
        // coincide (confirmado en vivo: tomar .first() a ciegas guardó un
        // medicamento distinto al buscado).
        let elegida = null;
        for (let i = 0; i < optionCount; i++) {
          const t = (await opcional(options.nth(i).textContent(), 'tratamiento:medicamento-opcion-textcontent') || '');
          if (t.toLowerCase().includes(medicamento.toLowerCase())) { elegida = options.nth(i); break; }
        }
        const target = elegida || options.first();
        const textoReal = (await opcional(target.textContent(), 'tratamiento:medicamento-elegido-textcontent') || '').trim();
        await target.click();
        if (!elegida) console.log(`⚠️ Ninguna opción contenía "${medicamento}" — se tomó la primera disponible`);
        console.log(`✅ Medicamento seleccionado: "${textoReal.substring(0, 60)}" (buscado: "${medicamento}")`);
      }
      await opcional(page.waitForLoadState('load'), 'tratamiento:load-tras-elegir-medicamento');
      await page.waitForTimeout(1500);

      const dosisInput = page.locator('input[name="dosis_cantidad"]');
      if (await opcional(dosisInput.isVisible(), 'tratamiento:dosis-input-visible')) await dosisInput.fill('1');
      const viaSelect = page.locator('select[name="iViaAdministracionId-0"]');
      if (await opcional(viaSelect.isVisible(), 'tratamiento:via-select-visible')) await viaSelect.selectOption({ index: 1 });
      const unidadSelect = page.locator('select[name="unidad_dosis_id-0"]');
      if (await opcional(unidadSelect.isVisible(), 'tratamiento:unidad-select-visible')) await unidadSelect.selectOption({ index: 1 });
      const frecuenciaInput = page.locator('input[name="frecuencia_cantidad"]');
      if (await opcional(frecuenciaInput.isVisible(), 'tratamiento:frecuencia-input-visible')) await frecuenciaInput.fill('8');
      const duracionInput = page.locator('input[name="tiempo_cantidad"]');
      if (await opcional(duracionInput.isVisible(), 'tratamiento:duracion-input-visible')) await duracionInput.fill('10');
      const tiempoSelect = page.locator('select[name="unidad_tiempo_id-0"]');
      if (await opcional(tiempoSelect.isVisible(), 'tratamiento:tiempo-select-visible')) await tiempoSelect.selectOption({ index: 1 });
      const indicacionesMedInput = page.locator('input[name="indicaciones-0"]');
      if (await opcional(indicacionesMedInput.isVisible(), 'tratamiento:indicaciones-med-input-visible')) await indicacionesMedInput.fill('Indicaciones estándar');
      console.log('✅ Formulario del medicamento llenado');
    } else {
      console.log('⚠️ No se encontró el buscador de medicamentos en Tratamiento');
    }

    // "Otros medicamentos" (junto a "Medicamentos" del catálogo): botón
    // "Agrega tratamiento diferente" que revela una fila libre Medicamento/
    // Indicaciones (2 inputs de texto sin name/placeholder, identificados por
    // su <label> propio) — antes se dejaba sin llenar por completo.
    const agregarDiferenteBtn = scope.locator('button:has-text("Agrega tratamiento diferente"), button:has-text("Agrega tratamiendo diferente")').first();
    if (await opcional(agregarDiferenteBtn.isVisible({ timeout: 3000 }), 'tratamiento:boton-agregar-diferente-visible')) {
      await agregarDiferenteBtn.click();
      await page.waitForTimeout(800);
      const tratamientoDiferente = pick(DATOS_CLINICOS.tratamientosDiferentes);
      const medicamentoDifInput = scope.locator('div.flex:has-text("Medicamento:")').last().locator('input[type="text"]').first();
      if (await opcional(medicamentoDifInput.isVisible({ timeout: 3000 }), 'tratamiento:medicamento-diferente-input-visible')) {
        await medicamentoDifInput.fill(tratamientoDiferente);
      } else {
        console.log('⚠️ No se encontró el input de "Medicamento:" en Otros medicamentos');
      }
      const indicacionesDifInput = scope.locator('div.flex:has-text("Indicaciones:")').last().locator('input[type="text"]').first();
      if (await opcional(indicacionesDifInput.isVisible({ timeout: 3000 }), 'tratamiento:indicaciones-diferente-input-visible')) {
        await indicacionesDifInput.fill('Tomar según indicación médica, con alimentos.');
      } else {
        console.log('⚠️ No se encontró el input de "Indicaciones:" en Otros medicamentos');
      }
      console.log(`✅ "Otros medicamentos" llenado: "${tratamientoDiferente}"`);
    } else {
      console.log('⚠️ No se encontró el botón "Agrega tratamiento diferente"');
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
    if (await opcional(indicacionesEditor.isVisible(), 'laboratorios:indicaciones-editor-visible')) {
      await indicacionesEditor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(TEXTO_INDICACIONES_LAB);
      console.log('✅ Indicaciones de laboratorio llenadas');
    }

    const labSelect = scope.locator('#react-select-3-input');
    if (await opcional(labSelect.isVisible({ timeout: 3000 }), 'laboratorios:lab-select-visible')) {
      const laboratorio = pick(DATOS_CLINICOS.laboratorios);
      await labSelect.click();
      await page.waitForTimeout(300);
      await labSelect.fill(laboratorio);
      await page.waitForTimeout(1500);
      const labOptions = page.locator('[role="option"]:visible, div[id*="option"]:visible');
      const labOptionCount = await labOptions.count();
      if (labOptionCount > 0) {
        // Mismo criterio que Tratamiento: buscar coincidencia real, no
        // asumir que la primera opción corresponde a lo buscado.
        let elegida = null;
        for (let i = 0; i < labOptionCount; i++) {
          const t = (await opcional(labOptions.nth(i).textContent(), 'laboratorios:opcion-textcontent') || '');
          if (t.toLowerCase().includes(laboratorio.toLowerCase())) { elegida = labOptions.nth(i); break; }
        }
        const target = elegida || labOptions.first();
        const text = (await opcional(target.textContent(), 'laboratorios:opcion-elegida-textcontent') || '').trim();
        await target.click();
        if (!elegida) console.log(`⚠️ Ninguna opción de laboratorio contenía "${laboratorio}" — se tomó la primera disponible`);
        console.log(`✅ Laboratorio seleccionado: "${text.substring(0, 60)}" (buscado: "${laboratorio}")`);
      } else {
        console.log('⚠️ Sin opciones de laboratorio');
      }
    }

    const procedimientoInput = scope.locator('textarea[name="procedimiento-0"]');
    if (await opcional(procedimientoInput.isVisible({ timeout: 2000 }), 'laboratorios:procedimiento-input-visible')) {
      await procedimientoInput.fill(TEXTO_PROCEDIMIENTO);
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
    if (await opcional(editor.isVisible({ timeout: 5000 }), 'notas-medico:editor-visible')) {
      await editor.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(TEXTO_NOTAS_MEDICO);
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
        if (await opcional(sinElementos.isVisible({ timeout: 1000 }), 'servicios:sin-elementos-visible')) {
          sinOpcionesDisponibles = true;
          const shot = 'test-results/servicios-sin-opciones.png';
          await opcional(page.screenshot({ path: shot, fullPage: true }), 'servicios:screenshot-sin-opciones');
          console.log(`🐛 BUG: dropdown "Agregar servicios" sin opciones ("No se encontraron elementos") → ${shot}`);
        }
      } else {
        let elegido = false;
        for (let j = 0; j < optionCount; j++) {
          const option = options.nth(j);
          const optionText = (await opcional(option.textContent(), 'servicios:opcion-textcontent') || '').trim();
          if (optionText.toLowerCase().includes('certificado')) {
            await option.click();
            console.log(`✅ Servicio seleccionado: "${optionText.substring(0, 60)}"`);
            elegido = true;
            break;
          }
        }
        if (!elegido) {
          const first = options.first();
          const text = (await opcional(first.textContent(), 'servicios:opcion-primera-textcontent') || '').trim();
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
  const habilitado = await opcional(finalizarBtn.isEnabled(), 'finalizar:boton-isenabled');
  console.log(`✅ Botón de finalizar ${habilitado ? 'encontrado y habilitado' : 'encontrado pero DESHABILITADO'}`);
  return finalizarBtn;
}

// Test principal
test('Start a scheduled consultation from Inicio', async ({ page }) => {
  test.setTimeout(480000); // 8 minutos — margen para los reintentos reales (no rushed) de getFilledForm post-Finalizar (hasta ~130s c/u, 2 secciones)

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
    if (await opcional(presionInput.isVisible(), 'signos-vitales:presion-input-visible')) await presionInput.fill(svPresion);
    const tempInput = page.locator('input[name*="temp" i]');
    if (await tempInput.count() > 0) await tempInput.first().fill(svTemp);
    const fcInput = page.locator('input[name*="card" i]');
    if (await fcInput.count() > 0) await fcInput.first().fill(svFC);
    const satInput = page.locator('input[name="oxigenacion"]');
    if (await satInput.count() > 0) await satInput.first().fill(svSat);
    // OJO: el name real es snake_case ("frecuencia_respiratoria"), no camelCase
    // — confirmado en vivo 2026-09-10 (el selector viejo dejaba este campo
    // vacío en silencio, y como es obligatorio, "Guardar" nunca se habilitaba).
    const frInput = page.locator('input[name="frecuencia_respiratoria"]');
    if (await frInput.count() > 0) await frInput.first().fill(svFR);
    const glucosaInput = page.locator('input[name="glucosa"]');
    if (await glucosaInput.count() > 0) await glucosaInput.first().fill(svGlucosa);

    await page.waitForTimeout(1500);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    const respPromise = opcional(page.waitForResponse(r => r.url().includes('/api/consultations/registerVitalSigns'), { timeout: 15000 }), 'signos-vitales:espera-response-registervitalsigns');
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    const resp = await respPromise;
    expect(resp?.status(), 'registerVitalSigns debe responder 2xx').toBeLessThan(300);
    console.log('✅ Signos vitales guardados');

    await page.waitForTimeout(1000);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await opcional(cerrarButton.isVisible(), 'signos-vitales:boton-cerrar-visible')) {
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
      await opcional(page.waitForLoadState('load'), 'consulta:load-tras-navegacion-manual');
    }

    console.log('⏳ Esperando carga completa de la consulta...');
    // 2026-09-10: este chequeo (solo "Cargando información de consulta" +
    // catch mudo) dejaba pasar un SEGUNDO overlay independiente
    // ("Recuperando datos del paciente...") — confirmado con una repro real
    // que llenaba "General" mientras ese overlay seguía activo: al terminar
    // el fetch de fondo, los campos quedaban vacíos, sin que este wait lo
    // hubiera detectado (ver CONTEXTO.md, hallazgo de "General" vaciado).
    // auditarPantalla() espera de forma realista a que CUALQUIER texto de
    // carga conocido desaparezca (ya generalizado en e2e/utils.js) en vez de
    // perseguir un único string exacto con un catch que traga el timeout.
    await auditarPantalla(page, 'Consulta recién cargada, antes de llenar General', { maxWaitMs: 30000 });
    await page.waitForTimeout(1000);
  });

  let serviciosSinOpciones = false;
  let resultadoExploracion = null;
  let resultadoAparatos = null;

  // Token + doctor_id: necesarios para leer datos guardados vía API en la
  // verificación post-Finalizar (getFilledForm responde 200 con el
  // formulario VACÍO en blanco, sin avisar, si falta doctor_id — ver
  // CONTEXTO.md "riesgo de falso negativo al verificar").
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
      const body = await opcional(r.json(), 'consulta:getprofile-response-json');
      if (body?.data?.id) doctorId = body.data.id;
    }
  });

  await test.step('Llenar todas las secciones (ya visibles, sin pestañas)', async () => {
    await fillGeneralSection(page);
    await fillApenrienciaGeneralSection(page);
    // OJO (2026-09-10): el <h3> real dice "Exploración segmentaría" (con
    // acento en la "í" — typo real de la app, confirmado con un recon que
    // volcó page.getByRole('heading', {level:3}).allTextContents()), no
    // "segmentaria" como asumía este regex. Por eso NUNCA matcheaba (ni con
    // el fix previo del espacio final, que no era la causa real) y
    // sectionContainer caía siempre al fallback de página completa —
    // haciendo que fillChecklistSection escribiera sus "Observaciones" en
    // los primeros <textarea> de TODA la página (los de "General"/
    // "Apariencia general"), pisándolos con texto de checklist. Se usa un
    // regex que matchea el prefijo estable en vez de depender de una vocal
    // acentuada que la propia app podría corregir o volver a cambiar.
    resultadoExploracion = await fillChecklistSection(page, /^Exploración segmentar[ií]a\s*$/i, 'Exploración segmentaria');
    resultadoAparatos = await fillChecklistSection(page, /^Aparatos y sistemas$/i, 'Aparatos y sistemas');
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

  let consultaId = null;
  let pacienteId = null;

  await test.step('Finalizar consulta', async () => {
    console.log('\n🏁 === INICIANDO FINALIZACIÓN DE CONSULTA ===');
    const finalizarBtn = await waitForFinalizarButton(page);
    const reqPromise = opcional(page.waitForRequest(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 15000 }), 'finalizar:espera-request-finishconsultation');
    const respPromise = opcional(page.waitForResponse(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 15000 }), 'finalizar:espera-response-finishconsultation');
    await finalizarBtn.click();
    const [req, resp] = await Promise.all([reqPromise, respPromise]);
    if (req) {
      const body = JSON.parse(req.postData() || '{}');
      consultaId = body.consulta_id ?? body.id ?? null;
      pacienteId = body.paciente_id ?? null;
      console.log(`ℹ️ finishConsultation body → consulta_id=${consultaId} paciente_id=${pacienteId}`);
    }
    if (resp) {
      expect(resp.status(), 'finishConsultation debe responder 2xx').toBeLessThan(300);
      console.log('✅ Consulta finalizada');
    } else {
      console.log('⚠️ No se detectó la llamada finishConsultation (revisar manualmente)');
    }
    await page.waitForTimeout(1000);
    const confirmBtn = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
    if (await opcional(confirmBtn.isVisible({ timeout: 3000 }), 'finalizar:boton-confirmacion-visible')) {
      await confirmBtn.click();
      console.log('✅ Confirmación clickeada');
    }
  });

  const inconsistencias = [];
  const advertenciasNoBloqueantes = [];

  await test.step('Verificar datos guardados (recon post-Finalizar, misma consulta, antes de salir)', async () => {
    console.log('\n🔎 === VERIFICANDO QUE LO LLENADO SIGUE GUARDADO Y ES CORRECTO ===');
    if (!consultaId || !pacienteId || !capturedToken) {
      inconsistencias.push(`No se pudo verificar: faltan datos para llamar a la API (consultaId=${consultaId}, pacienteId=${pacienteId}, token=${capturedToken ? 'OK' : 'FALTA'})`);
      console.log(`⚠️ ${inconsistencias[0]}`);
      return;
    }

    // Justo tras "Finalizar"+"Confirmación" la página dispara su propia
    // ráfaga de refetch (Expediente, historial, etc.) — confirmado en vivo
    // (2026-07-28): llamar a la API en ese mismo instante puede recibir un
    // 404 transitorio en getFilledForm ("No se encontró el formulario
    // asignado al paciente") aunque el dato SÍ esté guardado (una llamada
    // idéntica un instante después responde 200 con el valor correcto). Se
    // espera a que esa ráfaga se asiente y se reintenta una vez ante error.
    await page.waitForTimeout(6000);

    // OJO: usar page.request (HTTP directo, fuera del JS de la página) en vez
    // de page.evaluate(fetch(...)) — confirmado en vivo (2026-07-28): pedir
    // getFilledForm vía fetch() DESDE la misma pestaña que acaba de finalizar
    // devolvía el ítem en 0 (plantilla en blanco) de forma persistente (ni 4
    // reintentos con espera, ni `cache:'no-store'`, lo arreglaban), mientras
    // que la MISMA llamada desde una pestaña nueva sí traía el valor real.
    // Apunta a algo a nivel de la app en esa pestaña (interceptor de fetch,
    // estado en memoria) — no a caché HTTP del navegador. page.request evita
    // ese código de la página por completo.
    const fetchApi = async (endpoint, body, { retries = 2 } = {}) => {
      for (let intento = 0; intento <= retries; intento++) {
        const resp = await page.request.post(`/api/${endpoint}`, {
          headers: { 'Content-Type': 'application/json', 'x-rym-token-app': capturedToken },
          data: body,
        });
        const result = await opcional(resp.json(), `fetchApi:${endpoint}-response-json`);
        if (result?.status === 'OK') return result;
        if (intento < retries) {
          console.log(`⚠️ ${endpoint} respondió "${result?.status}" (${result?.message || ''}) — reintentando...`);
          await page.waitForTimeout(2500);
        } else {
          return result;
        }
      }
    };

    // Comparación de nombres de ítem tolerante a acentos — la API devuelve
    // "Torax" sin tilde mientras la UI muestra "Tórax" con tilde.
    const DIACRITICOS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
    const sinAcentos = (s) => (s || '').normalize('NFD').replace(DIACRITICOS_RE, '').toLowerCase().trim();

    const detalle = await fetchApi('consultations/getConsultation', { paciente_id: pacienteId, consulta_id: consultaId });
    const d = detalle?.data || {};
    console.log(`Estatus de la consulta reabierta: "${d.estatus}"`);

    const chequear = (campo, esperado, real) => {
      const ok = (real || '').trim() === esperado;
      if (!ok) inconsistencias.push(`${campo}: esperado "${esperado}" — real "${real}"`);
      console.log(`  ${ok ? '✅' : '❌'} ${campo}: "${(real || '').substring(0, 60)}"`);
    };
    chequear('motivo', TEXTO_MOTIVO, d.motivo);
    chequear('padecimiento', TEXTO_PADECIMIENTO, d.padecimiento);
    chequear('notas_evolucion', TEXTO_NOTAS_EVOLUCION, d.notas_evolucion);
    chequear('nombre_referido', TEXTO_NOMBRE_REFERIDO, d.nombre_referido);
    chequear('apariencia', TEXTO_APARIENCIA, d.apariencia);
    chequear('impresion_diagnostico', TEXTO_IMPRESION_DIAGNOSTICA, d.impresion_diagnostico);

    // indicaciones_general/indicaciones_procedimiento usan un texto elegido al
    // azar de una lista (no un literal fijo) — se verifica que no quedaron
    // vacías, no el texto exacto.
    if (!(d.indicaciones_general || '').trim()) inconsistencias.push('indicaciones_general (Tratamiento): quedó vacío tras finalizar');
    console.log(`  ${(d.indicaciones_general || '').trim() ? '✅' : '❌'} indicaciones_general: "${(d.indicaciones_general || '').substring(0, 60)}"`);
    if (!(d.indicaciones_procedimiento || '').trim()) inconsistencias.push('indicaciones_procedimiento (Laboratorios): quedó vacío tras finalizar');
    console.log(`  ${(d.indicaciones_procedimiento || '').trim() ? '✅' : '❌'} indicaciones_procedimiento: "${(d.indicaciones_procedimiento || '').substring(0, 60)}"`);

    if (!Array.isArray(d.diagnosticos) || d.diagnosticos.length === 0) inconsistencias.push('diagnosticos: quedó vacío tras finalizar');
    console.log(`  ${Array.isArray(d.diagnosticos) && d.diagnosticos.length > 0 ? '✅' : '❌'} diagnosticos: ${d.diagnosticos?.length ?? 0} elemento(s)`);
    if (!Array.isArray(d.servicios) || d.servicios.length === 0) inconsistencias.push('servicios: quedó vacío tras finalizar');
    console.log(`  ${Array.isArray(d.servicios) && d.servicios.length > 0 ? '✅' : '❌'} servicios: ${d.servicios?.length ?? 0} elemento(s)`);
    if (d.estatus_id !== 4 && !/terminada/i.test(d.estatus || '')) inconsistencias.push(`estatus: esperaba "Terminada" tras Finalizar, quedó "${d.estatus}"`);

    const treatments = await fetchApi('consultations/getTreatments', { paciente_id: pacienteId, consulta_id: consultaId });
    const numMedicamentos = (treatments?.data || []).length;
    if (numMedicamentos === 0) inconsistencias.push('getTreatments: 0 medicamentos guardados');
    console.log(`  ${numMedicamentos > 0 ? '✅' : '❌'} medicamentos guardados: ${numMedicamentos}`);

    // Checklists (Exploración segmentaria / Aparatos y sistemas): comparar
    // Normal/Anormal + Observaciones EXACTOS contra lo que el llenado dejó
    // como esperado por ítem — esto es lo que puntualmente falló antes de
    // agregar esta verificación (quedaban ítems sin Normal/Anormal pese a
    // que la UI mostraba el checkbox marcado).
    const forms = await fetchApi('consultations/getForms', { paciente_id: pacienteId, consulta_id: consultaId });
    for (const [nombreLog, resultado, formNameMatch] of [
      ['Exploración segmentaria', resultadoExploracion, (n) => n.toLowerCase().includes('exploracion')],
      ['Aparatos y sistemas', resultadoAparatos, (n) => n.toLowerCase().includes('aparatos')],
    ]) {
      const formInfo = (forms?.data || []).find(f => formNameMatch(f.nombre.toLowerCase()));
      if (!formInfo || !resultado || resultado.items.length === 0) {
        inconsistencias.push(`${nombreLog}: no se pudo verificar (form no encontrado o sin ítems llenados) — forms.data tenía ${forms?.data?.length ?? 'null'} formularios`);
        continue;
      }
      // getFilledForm justo después de Finalizar puede devolver el formulario
      // con TODOS los valores en 0/vacío (plantilla en blanco) durante un
      // rato — una sesión anterior (2026-07-28) asumió que era "retraso de
      // propagación del backend, no pérdida de datos" SIN esperar lo
      // suficiente para comprobarlo dentro del propio test, y silenció el
      // caso como advertencia no bloqueante. Eso es exactamente la
      // racionalización que CLAUDE.md §0.4 prohíbe: ninguna anomalía se
      // descarta sin evidencia de ESA corrida.
      //
      // Investigado a fondo el 2026-07-30 (`_investigar_getfilledform_blanco_dev.js`,
      // monitoreo real de 5 minutos sobre una consulta real): con 65s de
      // reintentos TODAVÍA estaba en blanco, pero ya había resuelto para
      // cuando se volvió a chequear ~20-40s más tarde (es decir, en algún
      // punto entre 65s y ~100s tras Finalizar) y se mantuvo resuelto de
      // forma estable el resto de los 5 minutos monitoreados. Confirma que
      // SÍ es un retraso de propagación transitorio (no pérdida de datos),
      // pero más largo de lo que se había probado antes — la hipótesis
      // vieja era correcta en el fondo, solo que nunca se había verificado
      // con evidencia real. Se sube el margen de reintentos a ~130s con
      // confianza (holgura sobre el ~100s observado), en vez de asumir un
      // número arbitrario otra vez.
      let filled = await fetchApi('patients/getFilledForm', { paciente_id: pacienteId, relacion_id: formInfo.relacion_id, consulta_id: consultaId, doctor_id: doctorId });
      let elementos = filled?.data?.grupos?.[0]?.elementos || [];
      let siguesEnBlanco = resultado.items[0]?.valorEsperado !== null && elementos[1]?.valor === 0;
      const esperasReintentoMs = [10000, 15000, 20000, 25000, 30000, 30000]; // ~130s total — holgura real sobre el ~100s observado en vivo
      let intentoBlanco = 0;
      while (siguesEnBlanco && intentoBlanco < esperasReintentoMs.length) {
        const espera = esperasReintentoMs[intentoBlanco];
        console.log(`  ⏳ ${nombreLog}: getFilledForm en blanco, esperando ${espera}ms antes de reintentar (intento ${intentoBlanco + 1}/${esperasReintentoMs.length})...`);
        await page.waitForTimeout(espera);
        filled = await fetchApi('patients/getFilledForm', { paciente_id: pacienteId, relacion_id: formInfo.relacion_id, consulta_id: consultaId, doctor_id: doctorId });
        elementos = filled?.data?.grupos?.[0]?.elementos || [];
        siguesEnBlanco = resultado.items[0]?.valorEsperado !== null && elementos[1]?.valor === 0;
        intentoBlanco++;
      }
      if (siguesEnBlanco) {
        inconsistencias.push(`${nombreLog}: getFilledForm siguió devolviendo el formulario en blanco tras ${esperasReintentoMs.reduce((a, b) => a + b, 0)}ms de reintentos — no se pudo confirmar que el retraso sea transitorio en esta corrida.`);
        console.log(`❌ ${inconsistencias[inconsistencias.length - 1]}`);
        continue;
      }
      if (intentoBlanco > 0) {
        advertenciasNoBloqueantes.push(`${nombreLog}: getFilledForm tardó ${intentoBlanco} reintento(s) en dejar de estar en blanco tras Finalizar (confirmado con evidencia real de esta corrida, no asumido).`);
        console.log(`⚠️ ${advertenciasNoBloqueantes[advertenciasNoBloqueantes.length - 1]}`);
      }
      console.log(`  [diag] ${nombreLog}: relacion_id=${formInfo.relacion_id} filled.status=${filled?.status} elementos.length=${elementos.length}`);
      for (const [idx, item] of resultado.items.entries()) {
        // Comparación tolerante a acentos: la API devuelve "Torax" sin tilde
        // mientras la UI muestra "Tórax" con tilde — un match exacto fallaba.
        const elValor = elementos.find(e => sinAcentos(e.sTexto) === sinAcentos(item.nombre) && sinAcentos(e.sDescripcion) === sinAcentos(item.nombre));
        const elObs = elementos[elementos.findIndex(e => e === elValor) + 1];
        const valorReal = elValor?.valor;
        const obsReal = elObs?.sTexto === 'Observaciones' ? elObs.valor : undefined;
        if (idx === 0) {
          console.log(`  [diag] item0 comparación: valorReal=${JSON.stringify(valorReal)} (${typeof valorReal}) vs esperado=${JSON.stringify(item.valorEsperado)} (${typeof item.valorEsperado}) | obsReal=${JSON.stringify(obsReal)} vs esperado=${JSON.stringify(item.observacionEsperada)} | elValorEncontrado=${!!elValor}`);
        }
        if (item.valorEsperado !== null && Number(valorReal) !== Number(item.valorEsperado)) {
          inconsistencias.push(`${nombreLog} → "${item.nombre}": Normal/Anormal esperado=${item.valorEsperado} real=${valorReal}`);
        }
        if (item.observacionEsperada && String(obsReal).trim() !== String(item.observacionEsperada).trim()) {
          inconsistencias.push(`${nombreLog} → "${item.nombre}": Observaciones esperado="${item.observacionEsperada}" real="${obsReal}"`);
        }
      }
      const okItems = resultado.items.length - inconsistencias.filter(i => i.startsWith(nombreLog)).length;
      console.log(`  ${nombreLog}: ${okItems}/${resultado.items.length} ítems verificados correctos`);
    }

    if (inconsistencias.length > 0) {
      console.log(`\n🐛 ${inconsistencias.length} inconsistencia(s) encontradas tras Finalizar:`);
      inconsistencias.forEach(i => console.log(`   - ${i}`));
    } else {
      console.log('\n✅ Todo lo llenado sigue guardado y coincide exactamente tras Finalizar.');
    }
    if (advertenciasNoBloqueantes.length > 0) {
      console.log(`\n⚠️ ${advertenciasNoBloqueantes.length} advertencia(s) no bloqueante(s) (no cuentan como fallo del test):`);
      advertenciasNoBloqueantes.forEach(a => console.log(`   - ${a}`));
    }
  });

  console.log('\n🎉 === CONSULTA COMPLETADA EXITOSAMENTE ===');

  // Etapa 1 de docs/tarea-actual.md: volcar qué catch()es opcionales se
  // dispararon en esta corrida (y cuántas veces), para clasificarlos con
  // datos reales en la Etapa 2 — no a mano ni por intuición.
  const disparosOpcionales = reporteOpcionales();
  console.log(`\n📋 [OPCIONAL] ${disparosOpcionales.length} etiqueta(s) distinta(s) se dispararon en esta corrida:`);
  disparosOpcionales.forEach(([etiqueta, n]) => console.log(`   ${n}x — ${etiqueta}`));

  const result = monitor.printSummary();
  if (!result.passed) console.log(`⚠️ El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);

  expect(serviciosSinOpciones, '🐛 BUG: dropdown "Agregar servicios" sin opciones ("No se encontraron elementos")').toBe(false);
  expect(result.failedApiCalls.length, `No debe haber responses con error de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  expect(inconsistencias, `Datos inconsistentes tras Finalizar:\n${inconsistencias.join('\n')}`).toEqual([]);
});
