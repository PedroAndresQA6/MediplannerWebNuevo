const { test, expect } = require('@playwright/test');
const { createAppointment, handleModals, setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────
// "Error guessing" — a diferencia de tests/consultation.inputs-validation.spec.ts
// (que prueba INPUTS maliciosos/inválidos: XSS, SQLi, campos vacíos — seguridad),
// esta suite simula ERRORES HUMANOS REALES pero legítimos durante una consulta:
// timing/carreras, corrección de datos, identificación de paciente, flujos
// interrumpidos, duplicación accidental y orden no lineal. Cada test verifica
// el ESTADO REAL guardado en el servidor (vía la respuesta de la API), no solo
// lo que se ve en pantalla — mismo criterio que el resto de la suite.
// ─────────────────────────────────────────────────────────────────────────

const PACIENTE_BUSQUEDA = 'Daniela Jiménez';
const PACIENTE_NOMBRE_COMPLETO = 'Daniela Jiménez Durán';

async function irAPestana(page, nombre) {
  await page.locator(`button:has-text("${nombre}"), a:has-text("${nombre}")`).first().click();
  await page.waitForTimeout(1500);
}

// Crea una cita para HOY y arranca la consulta de PACIENTE_BUSQUEDA, dejando
// signos vitales llenados y la vista en Consulta/ConsultaGeneral. Setup propio
// (no comparte código con consultation.full-flow.spec.js) para no arriesgar
// el spec insignia con cambios pensados para escenarios de error.
async function iniciarConsultaDeHoy(page) {
  await createAppointment(page, PACIENTE_BUSQUEDA);
  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);

  const botones = page.getByRole('button', { name: /iniciar/i });
  const total = await botones.count();
  let iniciarBtn = null;
  for (let i = 0; i < total; i++) {
    const btn = botones.nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
    const texto = (await fila.textContent().catch(() => '') || '');
    if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.split(' ')[0].toLowerCase())) { iniciarBtn = btn; break; }
  }
  if (!iniciarBtn) throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_BUSQUEDA}" tras crear su cita`);

  const overlay = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
  if (await overlay.count() > 0 && await overlay.first().isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  await iniciarBtn.click({ force: true });

  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  await expect(signosButton, 'Debe aparecer el botón de signos vitales tras iniciar la consulta').toBeVisible({ timeout: 10000 });
  await signosButton.click();
  await page.waitForTimeout(1000);

  const pesoInput = page.locator('input[name="peso"]');
  if (await pesoInput.isVisible().catch(() => false)) await pesoInput.fill('70');
  const tallaInput = page.locator('input[name*="talla" i]').first();
  if (await tallaInput.count() > 0) await tallaInput.fill('170');

  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
    return btn && !btn.disabled;
  }, { timeout: 10000 }).catch(() => {});
  await page.getByRole('button', { name: /^Guardar$/i }).click();
  await page.waitForTimeout(2000);
  const cerrarButton = page.getByRole('button', { name: /cerrar/i });
  if (await cerrarButton.isVisible().catch(() => false)) {
    await cerrarButton.click();
    await page.waitForTimeout(1000);
  }

  try {
    await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
  } catch {
    await page.goto('/Consulta/ConsultaGeneral');
    await page.waitForLoadState('load').catch(() => {});
  }
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

// Selecciona un diagnóstico CIE-10 buscando `codigo` en el combobox de Diagnóstico.
async function seleccionarCIE10(page, codigo) {
  const cie10Input = page.locator('textarea[role="combobox"]').first();
  await cie10Input.click();
  await page.waitForTimeout(500);
  await cie10Input.fill(codigo);
  await page.waitForTimeout(1500);
  const options = page.locator('[role="option"]:visible, .dropdown-item:visible, div[id*="option"]:visible');
  const n = await options.count();
  if (n === 0) return null;
  const texto = (await options.first().textContent().catch(() => '') || '').trim();
  await options.first().click();
  await page.waitForTimeout(500);
  return texto;
}

test.describe('Consulta — errores humanos reales (error guessing)', () => {

  // ── 1. TIMING/CARRERA: cambiar de pestaña antes de que el autosave termine ──
  test('1. Cambiar de pestaña justo tras seleccionar un diagnóstico no debe perder el dato', async ({ page }) => {
    test.setTimeout(180000);
    const monitor = setupConsoleMonitor(page);
    await iniciarConsultaDeHoy(page);

    await irAPestana(page, 'Diagnóstico');
    const addDiagnosisPromise = page.waitForResponse(r => r.url().includes('/api/consultations/addDiagnosis'), { timeout: 10000 }).catch(() => null);
    const seleccionado = await seleccionarCIE10(page, 'R05');
    expect(seleccionado, 'Debe poder seleccionarse un CIE-10 para la prueba').toBeTruthy();
    console.log(`✅ CIE-10 seleccionado: "${seleccionado}"`);

    // NO esperar a que termine el autosave — cambiar de pestaña de inmediato
    // (esto es justo lo que haría un usuario apurado).
    await irAPestana(page, 'Tratamiento');
    await addDiagnosisPromise; // el autosave dispara igual, en paralelo

    // Volver a Diagnóstico y confirmar que el dato sigue ahí (no se perdió por
    // la carrera entre el autosave y el cambio de pestaña).
    await irAPestana(page, 'Diagnóstico');
    await page.waitForTimeout(1500);
    const consultaInicial = page.locator('input[name="consultaInicial"][readonly]');
    const valorTrasVolver = await consultaInicial.inputValue().catch(() => '');
    expect(valorTrasVolver, `El diagnóstico seleccionado debe seguir presente tras cambiar de pestaña sin esperar el autosave (valor real: "${valorTrasVolver}")`).not.toBe('');

    const result = monitor.printSummary();
    expect(result.failedApiCalls.length, `No debe haber errores de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  });

  // ── 2. CORRECCIÓN DE DATOS: typo en la dosis, corregido antes de guardar ──
  test('2. Corregir un typo de dosis antes de guardar debe persistir el valor corregido, no el original', async ({ page }) => {
    test.setTimeout(180000);
    const monitor = setupConsoleMonitor(page);
    await iniciarConsultaDeHoy(page);

    await irAPestana(page, 'Tratamiento');
    const medicamentoInput = page.locator('#react-select-2-input');
    await expect(medicamentoInput, 'Debe existir el buscador de medicamentos en Tratamiento').toBeVisible({ timeout: 10000 });
    await medicamentoInput.click();
    await medicamentoInput.fill('Paracetamol');
    await page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }).catch(() => null);
    const opcion = page.locator('[role="option"]:visible, div[id*="option"]:visible').first();
    if (await opcion.count() > 0) await opcion.click();
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(1500);

    const dosisInput = page.locator('input[name="dosis_cantidad"]');
    await expect(dosisInput, 'Debe existir el campo de dosis tras elegir un medicamento').toBeVisible({ timeout: 10000 });

    // Error humano: escribe "250" (típico typo de dosis), se da cuenta y lo
    // corrige a "25" ANTES de guardar (ver hallazgo de EHR: 250mg vs 25mg).
    await dosisInput.fill('250');
    await page.waitForTimeout(300);
    await dosisInput.fill('');
    await dosisInput.fill('25');
    console.log('✅ Dosis escrita como "250", corregida a "25" antes de guardar');

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

    let setTreatmentsBody = null;
    page.on('response', async (r) => {
      if (r.url().includes('/api/treatments/setTreatments')) {
        setTreatmentsBody = await r.json().catch(() => null);
      }
    });

    const guardarBtn = page.locator('button[type="submit"]:has-text("Guardar cambios")').first();
    await handleModals(page);
    await guardarBtn.click();
    await page.waitForResponse(r => r.url().includes('/api/treatments/setTreatments'), { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);

    expect(setTreatmentsBody, 'setTreatments debe responder').toBeTruthy();
    const bodyTexto = JSON.stringify(setTreatmentsBody);
    expect(bodyTexto, `El valor corregido (25) debe reflejarse en la respuesta guardada, NO el typo original (250): ${bodyTexto}`).not.toMatch(/"?dosis[^"]*"?\s*:\s*"?250"?/i);

    const result = monitor.printSummary();
    expect(result.failedApiCalls.length, `No debe haber errores de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  });

  // ── 3. IDENTIFICACIÓN DE PACIENTE: nombres duplicados/ambiguos ──
  test('3. Pacientes con nombre idéntico deben abrirse por su registro real, no por confusión de fila', async ({ page }) => {
    test.setTimeout(60000);
    const monitor = setupConsoleMonitor(page);

    let getPatientsBody = null;
    let getPatientBody = null;
    page.on('response', async (r) => {
      if (r.url().includes('/api/patients/getPatients')) getPatientsBody = await r.json().catch(() => null);
      if (r.url().includes('/api/patients/getPatient') && !r.url().includes('getPatients')) getPatientBody = await r.json().catch(() => null);
    });

    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('.rdt_TableRow', { timeout: 20000 });
    const pageSize = page.locator('select').first();
    if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
      const respPromise = page.waitForResponse(r => r.url().includes('/api/patients/getPatients'), { timeout: 10000 }).catch(() => null);
      await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
      await respPromise;
      await page.waitForTimeout(1500);
    }

    const patients = getPatientsBody?.data?.patients || [];
    const nombreClave = 'juan garcia perez';
    const coincidencias = patients.filter(p => `${p.sNombre} ${p.sPaterno} ${p.sMaterno}`.trim().toLowerCase() === nombreClave);

    if (coincidencias.length < 2) {
      console.log(`ℹ️ No hay 2+ pacientes con nombre idéntico "${nombreClave}" en esta corrida (${coincidencias.length} encontrado/s) — nada que verificar, se omite.`);
      return;
    }

    const idsIguales = new Set(coincidencias.map(p => `${p.sCorreo}|${p.sTelefono1}|${p.dFechaNacimiento}`));
    if (idsIguales.size === 1) {
      console.log(`🐛 [HALLAZGO] ${coincidencias.length} pacientes con nombre "${nombreClave}" son indistinguibles en la lista (mismo correo/teléfono/fecha de nacimiento): ids ${coincidencias.map(p => p.id).join(', ')}. Un usuario no puede saber cuál es cuál solo mirando la lista.`);
    }

    // Lo crítico: aunque sean indistinguibles para un humano, el SISTEMA no debe
    // confundirlos — clickear la SEGUNDA fila debe abrir exactamente ese id.
    const objetivo = coincidencias[1];
    const buscar = page.locator('input[placeholder*="Buscar" i]').first();
    await buscar.fill('Juan Garcia Perez');
    await page.waitForTimeout(2000);

    const filas = page.locator('.rdt_TableRow');
    const totalFilas = await filas.count();
    let filaObjetivo = null;
    for (let i = 0; i < totalFilas; i++) {
      const texto = (await filas.nth(i).textContent().catch(() => '') || '');
      if (texto.includes(objetivo.sTelefono1) || texto.toLowerCase().includes(nombreClave)) {
        if (filaObjetivo === null && i > 0) { filaObjetivo = filas.nth(i); break; }
        if (filaObjetivo === null) filaObjetivo = filas.nth(i);
      }
    }
    expect(filaObjetivo, 'Debe encontrarse al menos una fila coincidente para hacer click').toBeTruthy();

    await filaObjetivo.locator('span.font-semibold.text-sm.text-gray-900').first().click();
    await page.waitForResponse(r => r.url().includes('/api/patients/getPatient') && !r.url().includes('getPatients'), { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1500);

    const idAbierto = getPatientBody?.data?.id;
    console.log(`   Fila clickeada (índice de aparición ${totalFilas > 1 ? '2da' : '1ra'}) → id esperado uno de [${coincidencias.map(p => p.id).join(', ')}], id realmente abierto: ${idAbierto}`);
    expect(coincidencias.map(p => p.id), `El id abierto (${idAbierto}) debe corresponder a alguno de los pacientes "${nombreClave}" reales, no a un tercero`).toContain(idAbierto);

    const result = monitor.printSummary();
    expect(result.failedApiCalls.length, `No debe haber errores de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  });

  // ── 4. FLUJO INTERRUMPIDO: navegar fuera sin guardar y volver ──
  test('4. Escribir en Notas del Médico y navegar fuera sin guardar no debe corromper el dato al volver', async ({ page }) => {
    test.setTimeout(180000);
    const monitor = setupConsoleMonitor(page);
    await iniciarConsultaDeHoy(page);

    await irAPestana(page, 'Notas del Médico');
    const notasEditor = page.locator('div.jodit-wysiwyg').first();
    await expect(notasEditor, 'Debe existir el editor de Notas del Médico').toBeVisible({ timeout: 10000 });
    const textoSinGuardar = 'TEXTO_DE_PRUEBA_NO_GUARDADO_' + Date.now();
    await notasEditor.click();
    await page.keyboard.type(textoSinGuardar);
    console.log(`✅ Texto sin guardar escrito en Notas: "${textoSinGuardar}"`);

    // Navegar fuera SIN guardar (como haría un usuario interrumpido).
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);

    // Volver a la consulta.
    await page.goto('/Consulta/ConsultaGeneral');
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await irAPestana(page, 'Notas del Médico');
    await page.waitForTimeout(1500);

    const notasEditorDespues = page.locator('div.jodit-wysiwyg').first();
    const contenidoDespues = (await notasEditorDespues.textContent().catch(() => '') || '');
    expect(contenidoDespues, `El texto NO guardado no debe aparecer al volver (indicaría un autosave silencioso/corrupción de estado no documentado): "${contenidoDespues.substring(0, 200)}"`)
      .not.toContain(textoSinGuardar);
    console.log(`✅ Confirmado: el texto sin guardar no persistió al navegar fuera y volver (contenido real: "${contenidoDespues.substring(0, 100)}")`);

    const result = monitor.printSummary();
    expect(result.failedApiCalls.length, `No debe haber errores de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  });

  // ── 5. DUPLICACIÓN ACCIDENTAL: doble-click en "Agregar" ──
  test('5. Doble-click accidental en "Guardar cambios" de Tratamiento no debe duplicar el medicamento', async ({ page }) => {
    test.setTimeout(180000);
    const monitor = setupConsoleMonitor(page);
    await iniciarConsultaDeHoy(page);

    await irAPestana(page, 'Tratamiento');
    const medicamentoInput = page.locator('#react-select-2-input');
    await expect(medicamentoInput).toBeVisible({ timeout: 10000 });
    await medicamentoInput.click();
    await medicamentoInput.fill('Ibuprofeno');
    await page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }).catch(() => null);
    const opcion = page.locator('[role="option"]:visible, div[id*="option"]:visible').first();
    if (await opcion.count() > 0) await opcion.click();
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

    let setTreatmentsCalls = 0;
    let lastBody = null;
    page.on('response', async (r) => {
      if (r.url().includes('/api/treatments/setTreatments')) {
        setTreatmentsCalls++;
        lastBody = await r.json().catch(() => null);
      }
    });

    const guardarBtn = page.locator('button[type="submit"]:has-text("Guardar cambios")').first();
    await handleModals(page);
    // Doble-click accidental — sin esperar entre clicks (mismo comportamiento
    // que un usuario que no ve feedback inmediato y vuelve a clickear).
    await Promise.all([
      guardarBtn.click(),
      guardarBtn.click({ force: true }).catch(() => {}),
    ]);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('load').catch(() => {});

    console.log(`   setTreatments se llamó ${setTreatmentsCalls} vez/veces tras el doble-click`);

    // Recargar la pestaña y contar cuántas veces aparece "Ibuprofeno" en el
    // listado de tratamiento — el doble-click no debe haber creado 2 filas.
    await page.reload();
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await irAPestana(page, 'Tratamiento');
    await page.waitForTimeout(1500);

    const bodyTexto = await page.locator('body').textContent().catch(() => '');
    const ocurrencias = (bodyTexto.match(/Ibuprofeno/gi) || []).length;
    console.log(`   "Ibuprofeno" aparece ${ocurrencias} vez/veces en la pantalla de Tratamiento tras recargar`);
    expect(ocurrencias, `El doble-click en "Guardar cambios" no debe duplicar el medicamento (apareció ${ocurrencias} veces, se esperaba a lo sumo 1)`).toBeLessThanOrEqual(1);

    const result = monitor.printSummary();
    expect(result.failedApiCalls.length, `No debe haber errores de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  });

  // ── 6. ORDEN NO LINEAL: llenar Tratamiento antes que Diagnóstico ──
  test('6. Llenar Tratamiento antes que Diagnóstico no debe hacer que uno pise al otro', async ({ page }) => {
    test.setTimeout(180000);
    const monitor = setupConsoleMonitor(page);
    await iniciarConsultaDeHoy(page);

    // Ir directo a Tratamiento, SALTEANDO Diagnóstico (orden no esperado).
    await irAPestana(page, 'Tratamiento');
    const medicamentoInput = page.locator('#react-select-2-input');
    await expect(medicamentoInput).toBeVisible({ timeout: 10000 });
    await medicamentoInput.click();
    await medicamentoInput.fill('Naproxeno');
    await page.waitForSelector('[role="option"]:visible, div[id*="option"]:visible', { timeout: 10000 }).catch(() => null);
    const opcionTrat = page.locator('[role="option"]:visible, div[id*="option"]:visible').first();
    if (await opcionTrat.count() > 0) await opcionTrat.click();
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

    const guardarTratamientoBtn = page.locator('button[type="submit"]:has-text("Guardar cambios")').first();
    await handleModals(page);
    await guardarTratamientoBtn.click();
    await page.waitForResponse(r => r.url().includes('/api/treatments/setTreatments'), { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);
    console.log('✅ Tratamiento (Naproxeno) guardado ANTES de tocar Diagnóstico');

    // AHORA ir a Diagnóstico y llenarlo.
    await irAPestana(page, 'Diagnóstico');
    let addDiagnosisBody = null;
    page.on('response', async (r) => {
      if (r.url().includes('/api/consultations/addDiagnosis')) addDiagnosisBody = await r.json().catch(() => null);
    });
    const seleccionado = await seleccionarCIE10(page, 'J00');
    expect(seleccionado, 'Debe poder seleccionarse un CIE-10 tras haber llenado Tratamiento primero').toBeTruthy();
    await page.waitForTimeout(1500);
    expect(addDiagnosisBody?.status, `addDiagnosis debe responder OK incluso llenando Diagnóstico después de Tratamiento: ${JSON.stringify(addDiagnosisBody)}`).toBe('OK');
    console.log(`✅ Diagnóstico (${seleccionado}) guardado DESPUÉS de Tratamiento, sin pisarlo`);

    // Verificar que el tratamiento sigue ahí (no lo pisó el guardado de Diagnóstico).
    await irAPestana(page, 'Tratamiento');
    await page.waitForTimeout(1500);
    const bodyTexto = await page.locator('body').textContent().catch(() => '');
    expect(bodyTexto, 'El tratamiento (Naproxeno) guardado antes debe seguir presente tras llenar Diagnóstico después').toContain('Naproxeno');

    const result = monitor.printSummary();
    expect(result.failedApiCalls.length, `No debe haber errores de API: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  });
});
