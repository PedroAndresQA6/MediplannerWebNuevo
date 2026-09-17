// Verifica con evidencia de LA UI REAL (no solo con page.request crudo) si el
// 404 de getFilledForm tras Finalizar (ver docs/hallazgos-abiertos.md —
// reproducido 3/3 veces limpias en la Etapa 1 de docs/tarea-actual.md, el
// 2026-09-17) se traduce en una sección de checklist vacía/rota cuando se la
// reabre por el segundo camino que describe el punto 3 de CLAUDE.md: perfil
// del paciente → pestaña "Consultas" → seleccionar la consulta → sub-pestañas
// → "Ver consulta" (vista completa).
//
// Llena "Exploración segmentaria" y "Aparatos y sistemas" con un tag único
// (para poder confirmar a simple vista si lo que se ve en pantalla es el dato
// real o quedó vacío/con otra cosa) y revisa esa vista repetidas veces
// (t+0s, 30s, 60s, 130s, 260s desde Finalizar) para ver EN PANTALLA en qué
// momento, si acaso, se resuelve — no asumir por el status de la API.
//
// Reutiliza los helpers ya exportados de e2e/utils.js (asegurarCitaDeHoy,
// auditarPantalla, handleModals) en vez de reimplementar sus esperas.
// Auditado contra el punto 7 de CLAUDE.md antes de
// correr: los waits de precondición (heading visible, checkboxes attached,
// lista de consultas cargada, navegación) NO tienen catch mudo — si fallan,
// el script debe tronar, no seguir con un estado a medias. Solo se usa
// catch(() => false) en elementos genuinamente opcionales de la UI (botón
// "Cerrar" del modal de signos vitales, modal de confirmación, botón "Ver
// consulta" que puede no existir si la vista ya muestra el detalle completo).

const { chromium } = require('@playwright/test');
const { auditarPantalla, handleModals, asegurarCitaDeHoy } = require('../e2e/utils.js');

const PACIENTE_BUSQUEDA = 'Percentil';
const TAG = `UIREPRO-${Date.now()}`;

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx/' });
  const page = await context.newPage();

  const erroresApi = [];
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`); });
  const erroresConsola = [];
  page.on('console', (msg) => { if (msg.type() === 'error') erroresConsola.push(msg.text()); });
  page.on('pageerror', (err) => erroresConsola.push(`[pageerror] ${err.message}`));

  console.log(`\n=== Repro UI real: getFilledForm tras Finalizar — tag "${TAG}" ===\n`);

  console.log('1) Revisando si ya hay cita de hoy / arrancando consulta...');
  await page.goto('/Dashboard');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);
  const { reutilizada, iniciarBtn } = await asegurarCitaDeHoy(page, PACIENTE_BUSQUEDA);
  console.log(reutilizada ? '   Ya había cita de hoy — se reutiliza.' : '   No había cita de hoy — se creó una nueva.');
  if (!iniciarBtn) throw new Error('No se encontró botón "Iniciar"');
  await iniciarBtn.click({ force: true });

  console.log('2) Signos vitales...');
  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  await signosButton.waitFor({ state: 'visible', timeout: 10000 });
  await signosButton.click();
  await page.waitForTimeout(1000);
  await page.locator('input[name="peso"]').fill('70');
  const tallaInput = page.locator('input[name*="talla" i]');
  if (await tallaInput.count() > 0) await tallaInput.first().fill('170');
  const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
  if (await presionInput.isVisible()) await presionInput.fill('120/080');
  const tempInput = page.locator('input[name*="temp" i]');
  if (await tempInput.count() > 0) await tempInput.first().fill('36.5');
  const fcInput = page.locator('input[name*="card" i]');
  if (await fcInput.count() > 0) await fcInput.first().fill('75');
  const satInput = page.locator('input[name="oxigenacion"]');
  if (await satInput.count() > 0) await satInput.first().fill('98');
  const frInput = page.locator('input[name="frecuencia_respiratoria"]');
  if (await frInput.count() > 0) await frInput.first().fill('16');
  const glucosaInput = page.locator('input[name="glucosa"]');
  if (await glucosaInput.count() > 0) await glucosaInput.first().fill('90');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
    return btn && !btn.disabled;
  }, { timeout: 10000 });
  await page.getByRole('button', { name: /^Guardar$/i }).click();
  await page.waitForTimeout(1500);
  const cerrarButton = page.getByRole('button', { name: /cerrar/i });
  if (await cerrarButton.isVisible({ timeout: 3000 }).catch(() => false)) await cerrarButton.click();

  console.log('3) Esperando pantalla de consulta...');
  try {
    await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
  } catch {
    await page.goto('/Consulta/ConsultaGeneral');
  }
  await auditarPantalla(page, 'Consulta recién cargada', { maxWaitMs: 30000 });

  async function sectionContainer(headingRegex) {
    const heading = page.getByRole('heading', { level: 3, name: headingRegex }).first();
    await heading.waitFor({ state: 'visible', timeout: 15000 });
    const cardAncestor = heading.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," card ")][1]');
    if (await cardAncestor.count() > 0) return cardAncestor;
    for (let depth = 2; depth <= 10; depth++) {
      const container = heading.locator(`xpath=ancestor::*[${depth}]`);
      if (await container.count() === 0) continue;
      const box = await container.boundingBox();
      if (box && box.height > 100) return container;
    }
    throw new Error(`No se pudo acotar "${headingRegex}"`);
  }

  const registro = {};

  async function llenarChecklist(headingRegex, nombreLog) {
    console.log(`4) Llenando ${nombreLog}...`);
    const scope = await sectionContainer(headingRegex);
    await page.waitForFunction(
      (el) => !el || !el.innerText || !el.innerText.toLowerCase().includes('cargando'),
      await scope.elementHandle(),
      { timeout: 15000 }
    );
    const checkboxes = scope.locator('input[type="checkbox"]:not([disabled])');
    await checkboxes.first().waitFor({ state: 'attached', timeout: 8000 });
    const total = await checkboxes.count();
    const etiquetas = await checkboxes.evaluateAll((els) => els.map((el, i) => {
      const lbl = el.parentElement && el.parentElement.querySelector('label');
      return (lbl && lbl.textContent || '').trim() || `#${i}`;
    }));
    for (let i = 0; i < total; i++) {
      await checkboxes.nth(i).click({ force: true });
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1500);
    const botones = scope.locator('div.simpleSelect label');
    const textareas = scope.locator('textarea:visible');
    const botonesCount = await botones.count();
    const textareasCount = await textareas.count();
    const items = [];
    for (let i = 0; i < total; i++) {
      const elegirAnormal = i % 2 === 1;
      if (botonesCount >= (i + 1) * 2) {
        await botones.nth(i * 2 + (elegirAnormal ? 1 : 0)).click({ force: true });
        await page.waitForTimeout(250);
      }
      let observacionEsperada = null;
      if (textareasCount > i) {
        observacionEsperada = `${TAG}-${etiquetas[i]}-${i}`;
        await textareas.nth(i).fill(observacionEsperada);
      }
      items.push({ nombre: etiquetas[i], valorEsperado: elegirAnormal ? 2 : 1, observacionEsperada });
    }
    registro[nombreLog] = items;
    console.log(`   ${nombreLog}: ${total} ítems llenados con tag "${TAG}"`);
    await page.waitForTimeout(500);
  }

  await llenarChecklist(/^Exploración segmentar[ií]a\s*$/i, 'Exploración segmentaria');
  await llenarChecklist(/^Aparatos y sistemas$/i, 'Aparatos y sistemas');

  console.log('5) Llenando el resto de secciones (todas — para que Finalizar funcione de verdad, igual que en el flujo real)...');
  const motivoInput = page.locator('textarea[name="visitaPaciente"]');
  if (await motivoInput.isVisible().catch(() => false)) await motivoInput.fill(`${TAG}-motivo`);
  const apenrienciaTa = page.locator('textarea[placeholder="Describa la apariencia general del paciente"]').first();
  if (await apenrienciaTa.isVisible().catch(() => false)) await apenrienciaTa.fill(`${TAG}-apariencia`);

  const diagnosticoScope = await sectionContainer(/^Diagnóstico$/i);
  const cie10Input = diagnosticoScope.locator('textarea[role="combobox"]').first();
  if (await cie10Input.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cie10Input.click();
    await page.waitForTimeout(500);
    await cie10Input.fill('R05');
    // Espera realista al resultado de la búsqueda (no un waitForTimeout fijo
    // que puede ganarle a la carga): reintenta hasta 10s, chequeando cada 1s.
    const cie10Options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
    let cie10OptionCount = 0;
    for (let i = 0; i < 10; i++) {
      cie10OptionCount = await cie10Options.count();
      if (cie10OptionCount > 0) break;
      await page.waitForTimeout(1000);
    }
    if (cie10OptionCount > 0) {
      const cie10Elegido = (await cie10Options.first().textContent()) || '';
      await cie10Options.first().click();
      console.log(`   CIE-10 seleccionado: "${cie10Elegido.trim().substring(0, 60)}"`);
    } else {
      console.log('   ⚠️ Sin opciones de CIE-10 para "R05" tras 10s de espera.');
    }
  }
  const impresionTa = diagnosticoScope.locator('textarea[placeholder="Impresión diagnóstica"]').first();
  if (await impresionTa.isVisible({ timeout: 2000 }).catch(() => false)) await impresionTa.fill(`${TAG}-impresion`);

  const tratamientoScope = await sectionContainer(/^Tratamiento$/i);
  const indicacionesTratamiento = tratamientoScope.locator('div.jodit-wysiwyg').first();
  if (await indicacionesTratamiento.isVisible().catch(() => false)) {
    await indicacionesTratamiento.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`${TAG}-indicaciones-tratamiento`);
  }

  const laboratoriosScope = await sectionContainer(/^Laboratorios y Procedimientos$/i);
  const indicacionesLab = laboratoriosScope.locator('div.jodit-wysiwyg').first();
  if (await indicacionesLab.isVisible().catch(() => false)) {
    await indicacionesLab.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`${TAG}-indicaciones-lab`);
  }

  const notasMedicoScope = await sectionContainer(/^Notas del Médico/i);
  const editorNotasMedico = notasMedicoScope.locator('div.jodit-wysiwyg').first();
  if (await editorNotasMedico.isVisible({ timeout: 5000 }).catch(() => false)) {
    await editorNotasMedico.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`${TAG}-notas-medico`);
  }

  const serviciosScope = await sectionContainer(/^Servicios$/i);
  const dropdownInput = serviciosScope.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible').first();
  if (await dropdownInput.count() > 0) {
    await dropdownInput.click();
    const dropdownMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
    const servicioOptions = dropdownMenu.locator('[class*="option"], [role="option"]');
    // Espera realista a que carguen las opciones (no un waitForTimeout fijo).
    let servicioOptionCount = 0;
    for (let i = 0; i < 10; i++) {
      servicioOptionCount = await servicioOptions.count();
      if (servicioOptionCount > 0) break;
      await page.waitForTimeout(1000);
    }
    if (servicioOptionCount > 0) {
      const servicioElegido = (await servicioOptions.first().textContent()) || '';
      await servicioOptions.first().click();
      console.log(`   Servicio seleccionado: "${servicioElegido.trim().substring(0, 60)}"`);
    } else {
      console.log('   ⚠️ Sin opciones de servicio tras 10s de espera.');
    }
  }

  console.log('6) Guardando cambios (global)...');
  const guardarBtn = page.locator('button:has-text("Guardar cambios")').first();
  await guardarBtn.waitFor({ state: 'visible', timeout: 10000 });
  await handleModals(page);
  await guardarBtn.click();
  await page.waitForTimeout(5000);
  await handleModals(page);

  console.log('7) Finalizando consulta...');
  const finalizarBtns = page.getByRole('button', { name: /finalizar consulta/i });
  const nFinalizarBtns = await finalizarBtns.count();
  console.log(`   Botones "Finalizar Consulta" encontrados: ${nFinalizarBtns}`);
  const finalizarBtn = finalizarBtns.first();
  await finalizarBtn.waitFor({ state: 'visible', timeout: 15000 });
  const habilitado = await finalizarBtn.isEnabled();
  console.log(`   Botón "Finalizar Consulta" [0] ${habilitado ? 'habilitado' : '⚠️ DESHABILITADO'}`);
  await page.screenshot({ path: 'logs/getfilledform-uireal-screenshots/getfilledform-uireal-antes-de-finalizar.png', fullPage: true });
  erroresConsola.length = 0; // solo interesan los errores desde acá en adelante
  const respPromise = page.waitForResponse(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 20000 });
  await finalizarBtn.click();
  let tFinalizar;
  try {
    await respPromise;
    tFinalizar = Date.now();
  } catch (e) {
    await page.screenshot({ path: 'logs/getfilledform-uireal-screenshots/getfilledform-uireal-finalizar-no-disparo.png', fullPage: true });
    console.log(`   Texto de la página tras clic en Finalizar (sin respuesta finishConsultation en 20s):`);
    console.log('   ' + (await page.locator('body').innerText()).split('\n').filter(Boolean).slice(0, 30).join(' | '));
    console.log(`   Errores de consola/JS desde el clic (${erroresConsola.length}):`);
    erroresConsola.forEach(m => console.log('     ' + m));
    throw e;
  }
  await page.waitForTimeout(1000);
  const confirmBtn = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) await confirmBtn.click();
  console.log(`✅ Consulta finalizada. Tag de esta corrida: "${TAG}"`);
  console.log('Registro de lo llenado (para comparar contra lo que se vea en pantalla):');
  console.log(JSON.stringify(registro, null, 2));

  const hallazgos = [];

  async function revisarVistaConsultas(etiquetaMomento) {
    const segundos = Math.round((Date.now() - tFinalizar) / 1000);
    console.log(`\n=== Revisión "${etiquetaMomento}" (t+${segundos}s desde Finalizar) ===`);
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 20000 });
    await page.waitForSelector('.rdt_TableRow', { timeout: 15000 });
    const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
    await buscarInput.fill(PACIENTE_BUSQUEDA);
    await page.waitForTimeout(2000);
    const fila = page.locator(`text=/${PACIENTE_BUSQUEDA}/i`).first();
    await fila.waitFor({ state: 'visible', timeout: 10000 });
    await fila.click();
    await page.waitForLoadState('load', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const consultasTab = page.getByRole('tab', { name: /^consultas$/i }).or(page.getByText(/^consultas$/i)).first();
    await consultasTab.click();
    await page.waitForTimeout(1500);
    await auditarPantalla(page, `Lista de consultas — ${etiquetaMomento}`, { maxWaitMs: 15000 });

    // No asumir un texto fijo tipo "Consulta inicial" (eso resultó falso —
    // la etiqueta real es "Consulta Completa", igual para todas las filas).
    // En cambio, buscar por el TAG único de esta corrida (aparece como
    // vista previa del motivo de "General"), que garantiza además que se
    // abre la consulta correcta y no cualquier otra del historial (este
    // paciente tiene 120+ consultas acumuladas).
    const filaTag = page.getByText(TAG, { exact: false }).first();
    const clickeado = (await filaTag.count()) > 0 && await filaTag.isVisible({ timeout: 5000 }).catch(() => false);
    if (clickeado) {
      await filaTag.click();
    } else {
      console.log(`⚠️ No se encontró la fila con el tag "${TAG}" en la lista — reviso igual y sigo.`);
    }
    await page.waitForTimeout(2000);
    await auditarPantalla(page, `Consulta seleccionada — ${etiquetaMomento}`, { maxWaitMs: 15000 });

    const verConsultaBtn = page.getByRole('button', { name: /ver consulta/i }).first();
    if (await verConsultaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await verConsultaBtn.click();
      await page.waitForLoadState('load', { timeout: 15000 });
      await auditarPantalla(page, `Vista completa — ${etiquetaMomento}`, { maxWaitMs: 20000 });
    } else {
      console.log('⚠️ No se encontró el botón "Ver consulta" — reviso la sub-pestaña directo.');
    }

    const textoCompleto = await page.locator('body').innerText();
    const safe = etiquetaMomento.replace(/[^\w]+/g, '-');
    await page.screenshot({ path: `logs/getfilledform-uireal-screenshots/getfilledform-uireal-${safe}.png`, fullPage: true });

    for (const seccion of ['Exploración segmentaria', 'Aparatos y sistemas']) {
      const idx = textoCompleto.indexOf(seccion);
      let estado;
      if (idx === -1) {
        estado = `⚠️ "${seccion}" no aparece en el texto de la página`;
      } else {
        const fragmento = textoCompleto.substring(idx, idx + 400);
        if (fragmento.includes(TAG)) estado = `✅ "${seccion}": CON el dato real (tag encontrado)`;
        else if (/cargando/i.test(fragmento)) estado = `⏳ "${seccion}": aún muestra "Cargando..."`;
        else estado = `❌ "${seccion}": SIN el tag — vacío o con otro dato`;
      }
      console.log(`  ${estado}`);
      hallazgos.push(`t+${segundos}s — ${estado}`);
    }
  }

  await revisarVistaConsultas('t+0s');
  await page.waitForTimeout(30000);
  await revisarVistaConsultas('t+30s');
  await page.waitForTimeout(30000);
  await revisarVistaConsultas('t+60s');
  await page.waitForTimeout(70000);
  await revisarVistaConsultas('t+130s');
  await page.waitForTimeout(130000);
  await revisarVistaConsultas('t+260s');

  console.log('\n=== RESUMEN CRONOLÓGICO ===');
  hallazgos.forEach(h => console.log('  ' + h));

  if (erroresApi.length > 0) {
    console.log(`\n🔴 ${erroresApi.length} error(es) de API durante toda la corrida:`);
    erroresApi.forEach(e => console.log('   ' + e));
  } else {
    console.log('\n✅ 0 errores de API durante toda la corrida.');
  }

  await browser.close();
})();
