const { expect } = require('@playwright/test');
const config = require('./config');
const { opcional } = require('./opcional');

const logger = config.logger;

async function handleModals(page) {
  // Manejar modales comunes de SweetAlert2 u otros frameworks
  try {
    // SweetAlert2 modals
    const swalModal = page.locator('.swal2-popup.swal2-modal:visible');
    if (await swalModal.count() > 0) {
      // Si hay un botón de confirmación/aceptar, hacer clic
      const confirmBtn = swalModal.locator('.swal2-confirm:visible, .swal2-button:visible');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.first().click({ timeout: 2000 });
        await page.waitForTimeout(1000);
      } else {
        // Si no hay botón visible, intentar con Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    }
    
    // Otros modales comunes
    const genericModals = page.locator('[role="dialog"]:visible, .modal:visible, .popup:visible');
    for (let i = 0; i < await genericModals.count(); i++) {
      const modal = genericModals.nth(i);
      if (await modal.isVisible()) {
        // Buscar botones de cerrar/aceptar
        const closeButtons = modal.locator('button:visible, [role="button"]:visible');
        if (await closeButtons.count() > 0) {
          await closeButtons.first().click({ timeout: 2000 });
          await page.waitForTimeout(1000);
        }
      }
    }
  } catch (modalError) {
    // Ignorar errores al manejar modales para no interrumpir el flujo principal
    logger.warning(`Error menor al manejar modals: ${modalError.message}`);
  }
}

// Asegura estar en /Dashboard con su calendario (react-day-picker, desde el
// rediseño de dev de 2026-07) realmente renderizado. Ya no existe un
// input[type="date"] ni el FullCalendar viejo (fc-next-button).
async function asegurarCalendarioDashboard(page) {
  if (!page.url().includes('/Dashboard')) {
    await page.goto('/Dashboard');
    await opcional(page.waitForLoadState('load', { timeout: 15000 }), 'asegurarCalendarioDashboard:load-inicial');
  }
  // Esperar a que el calendario esté realmente renderizado antes de tocarlo;
  // sin esto, en dev (flaky, a veces se cuelga en "Cargando...") un loop
  // corre en unos pocos ms y no encuentra ninguna celda porque el widget aún
  // no montó. Reintenta con reload si hace falta.
  for (let intento = 0; intento < 3; intento++) {
    if (await opcional(page.locator('td[data-day]').first().isVisible({ timeout: 8000 }), 'asegurarCalendarioDashboard:celda-visible')) return true;
    logger.warning(`Calendario del Dashboard no renderizó (intento ${intento + 1}/3), recargando...`);
    await page.reload();
    await opcional(page.waitForLoadState('load', { timeout: 15000 }), 'asegurarCalendarioDashboard:load-tras-reload');
    await page.waitForTimeout(1500);
  }
  logger.warning('El calendario del Dashboard no llegó a renderizar (td[data-day])');
  return false;
}

// Clickea la celda del calendario del Dashboard para `dateStr` (YYYY-MM-DD),
// avanzando de mes con el botón "›" (rdp-button_next) si hace falta. Espera
// la respuesta de getFilteredAppointments para esa fecha (filtra "Agenda de
// hoy" in-place, sin navegar). Devuelve true si logró clickear la celda.
async function irADiaEnCalendarioDashboard(page, dateStr) {
  // El botón de día no tiene la clase "rdp-day_button" (verificado contra la
  // app real 2026-07-10) — el <td data-day> existe, pero adentro hay un
  // <button> sin esa clase. Se usa un selector genérico (hay un solo botón
  // por celda) en vez de depender de esa clase.
  let celda = page.locator(`td[data-day="${dateStr}"] button`);
  for (let avance = 0; avance < 2 && !(await opcional(celda.isVisible({ timeout: 1000 }), 'irADia:celda-visible-loop')); avance++) {
    // Hay 2 botones "rdp-button_next" en el DOM: uno dentro de un
    // <nav class="rdp-nav"> decorativo/no funcional (siempre el primero) y el
    // real dentro del header visible del calendario (el segundo). .first()
    // no avanza de mes; .last() sí.
    const nextBtn = page.locator('button.rdp-button_next').last();
    if (!(await opcional(nextBtn.isVisible({ timeout: 1000 }), 'irADia:boton-siguiente-visible'))) break;
    // El header sticky a veces intercepta el click (el botón queda muy cerca
    // del borde superior); force:true evita el reintento de 15s en vano.
    await nextBtn.click({ force: true });
    await page.waitForTimeout(500);
    celda = page.locator(`td[data-day="${dateStr}"] button`);
  }
  if (!(await opcional(celda.isVisible({ timeout: 1000 }), 'irADia:celda-visible-final'))) {
    logger.warning(`No se encontró la celda del calendario para ${dateStr}`);
    return false;
  }
  const respPromise = opcional(page.waitForResponse(
    r => /\/api\/appointments\/getFilteredAppointments/.test(r.url()),
    { timeout: 8000 }
  ), 'irADia:espera-response-getfilteredappointments');
  await celda.click();
  await respPromise;
  await page.waitForTimeout(1000);
  return true;
}

async function checkNextDaysForIniciarButton(page) {
  logger.info('Buscando botón Iniciar en los próximos 5 días...');
  await asegurarCalendarioDashboard(page);

  for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];

    logger.info(`Revisando fecha: ${dateStr}`);

    // dayOffset 0 (hoy) ya viene seleccionado al cargar el Dashboard; para el
    // resto, clickear la celda del calendario correspondiente.
    if (dayOffset > 0 && !(await irADiaEnCalendarioDashboard(page, dateStr))) continue;

    // Buscar botones Iniciar visibles (no ocultos en modales) tras filtrar por esa fecha.
    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    let visibleCount = 0;
    for (let i = 0; i < count; i++) {
      if (await opcional(iniciarButtons.nth(i).isVisible(), 'checkNextDaysForIniciarButton:boton-iniciar-visible')) visibleCount++;
    }
    if (visibleCount > 0) {
      logger.success(`Encontrados ${visibleCount} botones Iniciar visibles en ${dateStr}`);
      await iniciarButtons.first().click();
      return true;
    }
  }

  return false;
}

// Igual que checkNextDaysForIniciarButton, pero filtrando el botón "Iniciar"
// por el nombre del paciente en su fila — necesario cuando el Dashboard
// puede mostrar citas de OTROS pacientes el mismo día (ej. "Carla Perez
// Rojas" ya agendada) y createAppointment cae en un día futuro (no
// necesariamente hoy: agarra el primer día de los próximos 5 con horario
// libre). Agregado 2026-07-31 tras encontrar que 3 specs distintos
// (`consultation.full-flow.spec.js`, `consultation.user-errors.spec.js`,
// `consultation.inputs-validation.spec.ts`) tenían su propia reimplementación
// de "buscar Iniciar tras crear cita" que solo miraba la vista de HOY (o, en
// el caso de inputs-validation, buscaba botones "+N días" que no existen en
// el calendario real) — todas fallaban en cuanto el día con horario libre no
// era hoy, algo que pasa seguido en dev (agenda ya llena los próximos días).
async function buscarBotonIniciarDePaciente(page, patientSearch, { maxDiasOffset = 5 } = {}) {
  logger.info(`Buscando botón Iniciar para "${patientSearch}" en los próximos ${maxDiasOffset} días...`);
  await asegurarCalendarioDashboard(page);

  for (let dayOffset = 0; dayOffset <= maxDiasOffset; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];

    if (dayOffset > 0 && !(await irADiaEnCalendarioDashboard(page, dateStr))) continue;

    const botones = page.getByRole('button', { name: /iniciar/i });
    const total = await botones.count();
    for (let i = 0; i < total; i++) {
      const btn = botones.nth(i);
      if (!(await opcional(btn.isVisible(), 'buscarBotonIniciarDePaciente:boton-visible'))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      // Precondición, no opcional (Etapa 2): esta lectura decide si la fila
      // es la del paciente buscado. Tragarla en silencio puede hacer que la
      // función reporte "no hay cita de hoy" cuando en realidad sí la había,
      // y que asegurarCitaDeHoy() cree una cita duplicada — el bug exacto
      // que la Etapa 5 existe para evitar. Se loguea fuerte en vez de tratar
      // el fallo como "esta fila no es" sin dejar rastro.
      let texto = '';
      try {
        texto = (await fila.textContent()) || '';
      } catch (e) {
        logger.warning(`buscarBotonIniciarDePaciente: no se pudo leer el texto de una fila (${e.message}) — se omite sin poder confirmar si era "${patientSearch}"`);
      }
      if (texto.toLowerCase().includes(patientSearch.toLowerCase())) {
        logger.success(`Botón Iniciar de "${patientSearch}" encontrado en ${dateStr}`);
        return btn;
      }
    }
  }

  return null;
}

async function createAppointment(page, patientSearch = '') {
  logger.info('Explorando próximos 5 días para registrar una cita...');
  if (patientSearch) logger.info(`Paciente objetivo de la cita: "${patientSearch}"`);
  
  // Navegar a la página de citas usando el sidebar "Agendar"
  await page.goto('/Citas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Intentar verificar que estamos en la página correcta
  try {
    await expect(page).toHaveURL(/Citas/);
  } catch (e) {
    // Si falló, intentar click en "Agendar" en la barra lateral
    logger.info('Navegando desde la barra lateral...');
    const sidebarAgendar = page.locator('a:has-text("Agendar"), a[href*="Citas"], a:has-text("Citas")').first();
    if (await opcional(sidebarAgendar.isVisible({ timeout: 5000 }), 'createAppointment:sidebar-agendar-visible')) {
      await sidebarAgendar.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
  }
  
  // Abrir Wizard - botón "Agendar cita" en la parte superior derecha
  logger.info('Buscando botón "Agendar cita"...');
  const agendarButton = page.getByRole('button', { name: /agendar cita/i }).first();
  if (!await opcional(agendarButton.isVisible({ timeout: 5000 }), 'createAppointment:boton-agendar-cita-visible')) {
    // Intentar otros selectores
    const altBtn = page.locator('button:has-text("Agendar cita"), button:has-text("Nueva cita")').first();
    if (await opcional(altBtn.isVisible({ timeout: 3000 }), 'createAppointment:boton-agendar-cita-alt-visible')) {
      await altBtn.click();
    } else {
      throw new Error('No se encontró el botón "Agendar cita"');
    }
  } else {
    await agendarButton.click();
  }
  
  // El contenedor del wizard perdió sus clases Tailwind (bg-white shadow-md
  // rounded p-5 ya no existen en el DOM actual). En vez de fijar otro set de
  // clases que puede volver a romperse con un rediseño, se ubica por el
  // heading "Agendar cita" (estable) y se sube al ancestro más cercano que
  // contenga un input, que es el mismo contenedor que antes.
  const wizardHeading = page.getByRole('heading', { name: 'Agendar cita' });
  await expect(wizardHeading).toBeVisible();
  const wizard = wizardHeading.locator('xpath=ancestor::div[.//input][1]');
  
  async function selectReactOption(inputLoc, searchText = '') {
    await inputLoc.waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    const tagName = await inputLoc.evaluate(el => el.tagName.toLowerCase());

    if (tagName === 'select') {
      const options = await inputLoc.locator('option').all();
      logger.info(`Select nativo con ${options.length} opciones`);
      if (options.length > 0) {
        const firstValue = await options[0].getAttribute('value');
        const firstText = await options[0].textContent();
        if (firstValue && firstValue !== '') {
          await inputLoc.selectOption(firstValue);
          logger.success(`Opción seleccionada: "${firstText}" (${firstValue})`);
        } else if (options.length > 1) {
          const secondValue = await options[1].getAttribute('value');
          const secondText = await options[1].textContent();
          await inputLoc.selectOption(secondValue);
          logger.success(`Opción seleccionada: "${secondText}" (${secondValue})`);
        }
      }
    } else if (searchText) {
      // Búsqueda por texto con reintentos: dev es flaky (los bundles abortan),
      // a veces las opciones del react-select tardan en cargar. Reintentar
      // re-escribiendo hasta que aparezca una opción y se pueda seleccionar.
      const optSel = '[id*="react-select"][id*="option"], [role="option"], [class*="option"], li:visible';
      let seleccionada = false;
      for (let intento = 1; intento <= 5 && !seleccionada; intento++) {
        await inputLoc.click();
        await inputLoc.fill('');
        await inputLoc.fill(searchText);
        logger.info(`Buscando: "${searchText}" (intento ${intento}/5)...`);
        await page.waitForTimeout(2000);
        const opciones = page.locator(optSel);
        const count = await opciones.count();
        logger.info(`Opciones encontradas: ${count}`);
        if (count > 0) {
          // Elegir la opción cuyo texto coincida con la búsqueda (no la primera a
          // ciegas: si el filtro aún no aplicó, la primera sería OTRO paciente).
          let elegido = null;
          for (let k = 0; k < count; k++) {
            const t = (await opcional(opciones.nth(k).textContent(), 'createAppointment:selectReactOption-opcion-textcontent') || '').toLowerCase();
            if (t.includes(searchText.toLowerCase())) { elegido = opciones.nth(k); break; }
          }
          if (elegido) {
            const txt = (await opcional(elegido.textContent(), 'createAppointment:selectReactOption-elegido-textcontent') || '').trim();
            await elegido.click();
            logger.success(`Opción seleccionada (coincide "${searchText}"): "${txt}"`);
            seleccionada = true;
          } else {
            logger.warning(`Las ${count} opciones no coinciden con "${searchText}" todavía, reintentando...`);
          }
        }
      }
      if (!seleccionada) {
        throw new Error(`No se encontró la opción del paciente "${searchText}" tras 5 intentos`);
      }
    } else {
      await inputLoc.click();
      logger.info('Esperando 2s a que carguen opciones...');
      await page.waitForTimeout(2000);
      const opciones = page.locator('[id*="react-select"][id*="option"], [role="option"], [class*="option"], li:visible');
      const count = await opciones.count();
      logger.info(`Opciones encontradas: ${count}`);
      if (count > 0) {
        await opciones.first().click();
        logger.success('Opción seleccionada');
      } else {
        logger.info('Sin opciones, reintentando con búsqueda...');
        try {
          await inputLoc.fill('a');
        } catch {
          logger.info('Elemento no admite fill, usando click');
          await inputLoc.click();
        }
        await page.waitForTimeout(1500);
        const opts2 = page.locator('[id*="react-select"][id*="option"], [role="option"], [class*="option"]');
        const cnt2 = await opts2.count();
        logger.info(`Opciones con búsqueda: ${cnt2}`);
        if (cnt2 > 0) {
          await opts2.first().click();
          logger.success('Opción seleccionada con búsqueda');
        }
      }
    }
    await page.waitForTimeout(500);
  }
  
  // Debug: ver cuántos combobox hay en el wizard
  const combos = wizard.getByRole('combobox');
  const combosCount = await combos.count();
  logger.info(`Comboboxes en wizard: ${combosCount}`);
  
  // Paciente - React-Select. Si se pasó patientSearch, buscar y seleccionar ese
  // paciente; si no, se queda con el comportamiento previo (primera opción).
  await expect(combos.first()).toBeVisible();
  await selectReactOption(combos.nth(0), patientSearch);
  
  const continueBtn = page.getByRole('button', { name: /continuar/i });
  await page.waitForTimeout(1000);
  await expect(continueBtn).toBeEnabled({ timeout: 15000 });
  await continueBtn.click();
  await page.waitForTimeout(1500);
  
  // Paso 2: Tipo de Consulta + Hospital (ambos selects nativos)
  const selectsStep2 = page.locator('select:visible');
  const selCount = await selectsStep2.count();
  logger.info(`Selects en paso 2: ${selCount}`);
  if (selCount > 0) {
    const opts0 = await selectsStep2.nth(0).locator('option').count();
    logger.info(`Opciones tipo consulta: ${opts0}`);
    if (opts0 > 1) await selectsStep2.nth(0).selectOption({ index: 1 });
  }
  // Hospital se habilita tras elegir tipo consulta
  if (selCount > 1) {
    await page.waitForTimeout(1500);
    const opts1 = await selectsStep2.nth(1).locator('option').count();
    logger.info(`Opciones hospital: ${opts1}`);
    if (opts1 > 1) await selectsStep2.nth(1).selectOption({ index: 1 });
  }
  await page.waitForTimeout(1000);
  // Precondición, no opcional (Etapa 2): a diferencia de los otros pasos del
  // wizard (que sí tienen un `throw` de respaldo si fallan todos sus
  // fallbacks), este `if` no tenía ni log ni backstop — si el botón no
  // aparecía, el código seguía de largo asumiendo que el wizard avanzó al
  // paso de fecha, pudiendo seguir clavado en el paso 2 en silencio.
  const continueBtn2 = page.getByRole('button', { name: /continuar/i });
  await expect(continueBtn2, 'createAppointment: no apareció el botón "Continuar" del paso 2 del wizard').toBeVisible({ timeout: 5000 });
  await continueBtn2.click();
  
  // Esperar y buscar el input de fecha de manera más específica
  logger.info('Buscando input de fecha...');
  
  // Esperar un momento para que la interfaz se actualice
  await page.waitForTimeout(2000);
  
  // Intentar múltiples selectores para el input de fecha
  const dateSelectors = [
    'input[type="date"]',
    'input[placeholder*="fecha" i]',
    'input[placeholder*="Fecha" i]',
    '[data-testid="date-input"]',
    '.date-input',
    'input[role="textbox"][aria-label*="fecha" i]',
    'input[role="textbox"][aria-label*="Fecha" i]'
  ];
  
  let dateInput = null;
  for (const selector of dateSelectors) {
    const input = page.locator(selector).first();
    if (await input.count() > 0 && await input.isVisible()) {
      dateInput = input;
      logger.success(`Input de fecha encontrado con selector: ${selector}`);
      break;
    }
  }
  
  // Si no encontramos con selectores específicos, intentar con textbox pero ser más específico
  if (!dateInput) {
    const textboxes = page.getByRole('textbox');
    const count = await textboxes.count();
    logger.info(`Encontrados ${count} textboxes en total`);
    
    for (let i = 0; i < count; i++) {
      const textbox = textboxes.nth(i);
      if (await textbox.isVisible() && await textbox.isEnabled()) {
        // Verificar si podría ser un input de fecha por su valor actual o atributos
        const value = await textbox.inputValue();
        const placeholder = await textbox.getAttribute('placeholder');
        const ariaLabel = await textbox.getAttribute('aria-label');
        
        logger.debug(`Textbox ${i}: value='${value}', placeholder='${placeholder}', aria-label='${ariaLabel}'`);
        
        // Si está vacío o tiene características de fecha, probablemente sea el correcto
        if ((!value || value === '') && 
            (placeholder && (placeholder.toLowerCase().includes('fecha') || 
                           placeholder.toLowerCase().includes('date') ||
                           placeholder.toLowerCase().includes('día'))) ||
            (ariaLabel && (ariaLabel.toLowerCase().includes('fecha') || 
                          ariaLabel.toLowerCase().includes('date') ||
                          ariaLabel.toLowerCase().includes('día')))) {
          dateInput = textbox;
          logger.success(`Seleccionado textbox ${i} como input de fecha`);
          break;
        }
      }
    }
  }
  
  if (!dateInput) {
    // Como último recurso, tomar el primer textbox visible y habilitado
    for (let i = 0; i < await page.getByRole('textbox').count(); i++) {
      const textbox = page.getByRole('textbox').nth(i);
      if (await textbox.isVisible() && await textbox.isEnabled()) {
        dateInput = textbox;
        logger.warning(`Usando textbox ${i} como input de fecha por defecto`);
        break;
      }
    }
  }
  
  if (!dateInput) {
    throw new Error('No se pudo encontrar ningún input de fecha disponible');
  }
  
  await expect(dateInput).toBeVisible({ timeout: 10000 });
  
   for (let dayOffset = 0; dayOffset < 15; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
   
     logger.info(`Intentando registrar cita en: ${dateStr}`);
   
    try {
      await dateInput.fill(dateStr);
      await page.waitForTimeout(2000);
      
      // Manejar posibles modales que puedan aparecer después de ingresar la fecha
      await handleModals(page);
       
      const hours = page.locator('text=/\\d{2}:\\d{2}/');
      const hourCount = await hours.count();
       
      if (hourCount > 0) {
        logger.success(`Horas disponibles en ${dateStr}: ${hourCount}`);
         
        // Manejar modales antes de intentar seleccionar horas
        await handleModals(page);
         
        // Intentar hacer clic en cada hora disponible hasta que una funcione
        let horaSeleccionada = false;
        for (let i = 0; i < Math.min(hourCount, 5); i++) { // Intentar las primeras 5 horas
          try {
            logger.info(`Intentando seleccionar hora: ${await hours.nth(i).textContent()}`);
            await hours.nth(i).click({ timeout: 5000 });
            
            // Esperar un momento y verificar si aparece un modal de error
            await page.waitForTimeout(1000);
            
            // Manejar cualquier modal que aparezca después de seleccionar la hora
            await handleModals(page);
            
            // Verificar si todavía hay un modal de error visible
            const errorModal = page.locator('.swal2-popup, [role="dialog"]:visible');
            if (await errorModal.count() > 0) {
              logger.warning(`Modal detectado al seleccionar hora, intentando siguiente hora...`);
              // Continuar con la siguiente hora en lugar de intentar otra cosa
              continue;
            }
            
            // Si llegamos aquí, la hora fue aceptada
            horaSeleccionada = true;
            logger.success(`Hora seleccionada exitosamente`);
            break;
          } catch (hourError) {
            logger.error(`Error al seleccionar hora: ${hourError.message}`);
            await handleModals(page); // Intentar recuperar de cualquier modal
            continue;
          }
        }
         
        if (!horaSeleccionada) {
          logger.warning(`No se pudo seleccionar ninguna hora disponible en ${dateStr}`);
          continue; // Intentar con el siguiente día
        }
         
        await page.getByRole('button', { name: /continuar/i }).click();
        await page.waitForTimeout(1000);

        // Confirmar: el botón se renombró de "Agendar cita" a "Confirmar cita"
        // y ya no hay modal "OK" después — la app navega directo a la pantalla
        // de éxito "¡Cita agendada!". Verificado contra la app real 2026-07-09.
        const confirmarBtn = page.getByRole('button', { name: /confirmar cita/i });
        await confirmarBtn.scrollIntoViewIfNeeded();
        await confirmarBtn.click();
        await expect(page.getByRole('heading', { name: /cita agendada/i })).toBeVisible({ timeout: 10000 });

        logger.success(`Cita registrada exitosamente en ${dateStr}`);
        return;
      } else {
        logger.warning(`No hay horas disponibles en ${dateStr}`);
      }
    } catch (error) {
      logger.error(`Error al intentar fecha ${dateStr}: ${error.message}`);
      await handleModals(page); // Intentar recuperar de modals en caso de error general
      continue;
    }
  }
  
  throw new Error('No se pudo registrar una cita en los próximos 5 días');
}

// Etapa 5 de docs/tarea-actual.md — problema reportado por Pedro: el flujo de
// consulta creaba una cita nueva aunque el paciente ya tuviera una agendada
// para hoy. Para `consultation.full-flow.spec.js` la cita es una
// PRECONDICIÓN (no el objetivo del test), así que corresponde reutilizar: se
// revisa primero la agenda de HOY en Inicio (Dashboard) y solo si no hay
// ninguna cita programada se crea una. Distinto de `appointments.create.spec.ts`,
// cuyo objetivo ES verificar que crear una cita funciona — ese sigue creando
// siempre, no usa este helper.
// Devuelve { reutilizada, iniciarBtn }.
async function asegurarCitaDeHoy(page, patientSearch) {
  logger.info(`asegurarCitaDeHoy: revisando si "${patientSearch}" ya tiene una cita de hoy en Inicio...`);
  let iniciarBtn = await buscarBotonIniciarDePaciente(page, patientSearch, { maxDiasOffset: 0 });
  if (iniciarBtn) {
    logger.success(`asegurarCitaDeHoy: "${patientSearch}" ya tiene cita de hoy — se reutiliza, no se crea una nueva.`);
    return { reutilizada: true, iniciarBtn };
  }

  logger.info(`asegurarCitaDeHoy: "${patientSearch}" no tiene cita de hoy — creando una nueva.`);
  await createAppointment(page, patientSearch);
  await page.goto('/Dashboard');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);
  iniciarBtn = await buscarBotonIniciarDePaciente(page, patientSearch);
  if (!iniciarBtn) {
    throw new Error(`asegurarCitaDeHoy: no se encontró botón "Iniciar" para "${patientSearch}" tras crear la cita nueva`);
  }
  logger.info('asegurarCitaDeHoy: cita nueva creada y localizada.');
  return { reutilizada: false, iniciarBtn };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSOLE & NETWORK MONITOR — DevTools Protocol integration
// Captura logs de consola y tráfico de red en tiempo real durante el test.
// ─────────────────────────────────────────────────────────────────────────────

function setupConsoleMonitor(page) {
  const session = {
    consoleLogs: [],
    networkEvents: [],
    errors: [],
    warnings: [],
    apiCalls: [],
    startTime: Date.now(),
    // Marca de inicio por request (para calcular latencia request→response).
    reqStart: new Map(),
    // Marcas de fase/pestaña: { label, t } con t en segundos desde startTime.
    marks: [],
  };

  // ── Consola del navegador ──────────────────────────────────────────────────
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);
    const entry = { type, text, timestamp };

    session.consoleLogs.push(entry);

    if (type === 'error') {
      session.errors.push(entry);
      console.log(`🔴 [DEVTOOLS ERROR +${timestamp}s] ${text}`);
    } else if (type === 'warning') {
      session.warnings.push(entry);
      console.log(`🟡 [DEVTOOLS WARN  +${timestamp}s] ${text}`);
    } else if (type === 'log') {
      // Solo imprimir logs de la app que contengan palabras clave útiles
      const keywords = ['error', 'fail', 'success', 'saved', 'guardado', 'api', 'fetch', 'token', 'unauthorized', '401', '403', '500'];
      if (keywords.some(k => text.toLowerCase().includes(k))) {
        console.log(`🔵 [DEVTOOLS LOG   +${timestamp}s] ${text}`);
      }
    }
  });

  // ── Errores de JS no capturados ───────────────────────────────────────────
  page.on('pageerror', (error) => {
    const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);
    const entry = { type: 'pageerror', text: error.message, stack: error.stack, timestamp };
    session.errors.push(entry);
    console.log(`💥 [JS ERROR       +${timestamp}s] ${error.message}`);
  });

  // ── Requests salientes ────────────────────────────────────────────────────
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    const isApi = url.includes('/api/') || url.includes('/v1/') || url.includes('/graphql');

    if (isApi) {
      const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);
      session.reqStart.set(request, Date.now());
      // Capturar el payload de escrituras (POST/PUT/PATCH) para auditar QUÉ se envió,
      // no solo el status. Permite distinguir "falso registro" (payload vacío) de
      // "bug de app" (payload correcto pero no persiste).
      let postData = null;
      if (method !== 'GET') {
        try { postData = request.postData(); } catch (_) {}
      }
      const entry = { direction: 'REQUEST', method, url, timestamp, postData };
      session.apiCalls.push(entry);
      console.log(`📤 [API REQUEST    +${timestamp}s] ${method} ${url}`);
    }
  });

  // ── Responses entrantes ───────────────────────────────────────────────────
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const isApi = url.includes('/api/') || url.includes('/v1/') || url.includes('/graphql');

    if (isApi || status >= 400) {
      const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);

      // Latencia request→response (ms). Usa la marca propia; cae a request.timing() si falta.
      let latencyMs = null;
      const t0 = session.reqStart.get(response.request());
      if (t0) {
        latencyMs = Date.now() - t0;
        session.reqStart.delete(response.request());
      } else {
        try {
          const tm = response.request().timing();
          if (tm && tm.responseEnd >= 0) latencyMs = Math.round(tm.responseEnd);
        } catch (_) {}
      }

      let bodyPreview = '';
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const body = await opcional(response.json(), 'setupConsoleMonitor:response-json-preview');
          if (body) bodyPreview = JSON.stringify(body).substring(0, 120);
        }
      } catch (_) {}

      const entry = { direction: 'RESPONSE', method: response.request().method(), status, url, bodyPreview, timestamp, latencyMs };
      session.networkEvents.push(entry);
      session.apiCalls.push(entry);

      const icon = status >= 500 ? '🔴' : status >= 400 ? '🟠' : '✅';
      const lat = latencyMs != null ? ` (${latencyMs}ms)` : '';
      console.log(`${icon} [API RESPONSE   +${timestamp}s]${lat} ${status} ${url}${bodyPreview ? ` → ${bodyPreview}` : ''}`);
    }
  });

  // ── Requests fallidos (sin respuesta: red caída, CORS, etc.) ─────────────
  page.on('requestfailed', (request) => {
    const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);
    const failure = request.failure()?.errorText || 'unknown';
    const entry = { direction: 'FAILED', url: request.url(), failure, timestamp };
    session.networkEvents.push(entry);
    session.errors.push(entry);
    console.log(`❌ [REQUEST FAILED +${timestamp}s] ${request.url()} — ${failure}`);
  });

  // ── Resumen final ─────────────────────────────────────────────────────────
  session.printSummary = () => {
    const totalTime = ((Date.now() - session.startTime) / 1000).toFixed(1);
    const apiRequests = session.apiCalls.filter(e => e.direction === 'REQUEST').length;
    const apiResponses = session.apiCalls.filter(e => e.direction === 'RESPONSE');
    const successResponses = apiResponses.filter(e => e.status >= 200 && e.status < 300).length;
    const failedResponses = apiResponses.filter(e => e.status >= 400).length;

    console.log('\n' + '═'.repeat(70));
    console.log('📊  RESUMEN DEVTOOLS MONITOR');
    console.log('═'.repeat(70));
    console.log(`⏱️  Duración total:         ${totalTime}s`);
    console.log(`📤  API Requests enviados:  ${apiRequests}`);
    console.log(`✅  Responses exitosas:     ${successResponses}`);
    console.log(`🟠  Responses con error:    ${failedResponses}`);
    console.log(`🔴  Errores de JS/consola:  ${session.errors.length}`);
    console.log(`🟡  Warnings de consola:    ${session.warnings.length}`);

    if (session.errors.length > 0) {
      console.log('\n── Errores detectados ──────────────────────────────────────────────');
      session.errors.forEach((e, i) => {
        console.log(`  [${i + 1}] +${e.timestamp}s → ${e.text || e.failure}`);
      });
    }

    if (failedResponses > 0) {
      console.log('\n── API calls fallidas ──────────────────────────────────────────────');
      apiResponses
        .filter(e => e.status >= 400)
        .forEach((e, i) => {
          console.log(`  [${i + 1}] +${e.timestamp}s → ${e.status} ${e.url}`);
          if (e.bodyPreview) console.log(`       Body: ${e.bodyPreview}`);
        });
    }

    console.log('═'.repeat(70) + '\n');

    return {
      passed: session.errors.length === 0 && failedResponses === 0,
      errors: session.errors,
      failedApiCalls: apiResponses.filter(e => e.status >= 400),
      totalApiCalls: apiRequests,
    };
  };

  // Marca una fase del flujo (p.ej. inicio/fin de pestaña) para medir su duración.
  session.mark = (label) => {
    session.marks.push({ label, t: +((Date.now() - session.startTime) / 1000).toFixed(2) });
  };

  // Normaliza una URL de API a "METHOD /ruta" (sin host ni query) para agrupar.
  const normalize = (method, url) => {
    let path = url;
    try { path = new URL(url).pathname; } catch (_) {}
    return `${method || 'GET'} ${path}`;
  };

  // Agrega métricas de latencia por endpoint y devuelve el objeto de métricas.
  session.getMetrics = (extra = {}) => {
    const totalTime = +((Date.now() - session.startTime) / 1000).toFixed(1);
    const responses = session.apiCalls.filter(e => e.direction === 'RESPONSE');
    const byEndpoint = {};
    for (const r of responses) {
      const key = normalize(r.method, r.url);
      (byEndpoint[key] = byEndpoint[key] || { count: 0, statuses: {}, latencies: [] });
      byEndpoint[key].count++;
      byEndpoint[key].statuses[r.status] = (byEndpoint[key].statuses[r.status] || 0) + 1;
      if (typeof r.latencyMs === 'number') byEndpoint[key].latencies.push(r.latencyMs);
    }
    const stat = (arr) => {
      if (!arr.length) return null;
      const s = [...arr].sort((a, b) => a - b);
      const sum = s.reduce((a, b) => a + b, 0);
      return {
        n: s.length,
        min: s[0],
        max: s[s.length - 1],
        avg: Math.round(sum / s.length),
        p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
      };
    };
    const endpoints = Object.entries(byEndpoint).map(([endpoint, v]) => ({
      endpoint,
      count: v.count,
      statuses: v.statuses,
      latencyMs: stat(v.latencies),
    })).sort((a, b) => (b.latencyMs?.avg || 0) - (a.latencyMs?.avg || 0));

    // Payloads de escritura: qué se envió realmente en cada POST/PUT/PATCH.
    const writePayloads = session.apiCalls
      .filter(e => e.direction === 'REQUEST' && e.method && e.method !== 'GET' && e.postData)
      .map(e => ({ endpoint: normalize(e.method, e.url), t: e.timestamp, postData: String(e.postData).substring(0, 2000) }));

    const allLatencies = responses.map(r => r.latencyMs).filter(x => typeof x === 'number');
    return {
      totalDurationSec: totalTime,
      writePayloads,
      api: {
        requests: session.apiCalls.filter(e => e.direction === 'REQUEST').length,
        responses: responses.length,
        success2xx: responses.filter(r => r.status >= 200 && r.status < 300).length,
        error4xx5xx: responses.filter(r => r.status >= 400).length,
        latencyOverallMs: stat(allLatencies),
      },
      consoleErrors: session.errors.length,
      consoleWarnings: session.warnings.length,
      failedApiCalls: responses.filter(r => r.status >= 400).map(r => ({ status: r.status, url: r.url, body: r.bodyPreview })),
      slowestEndpoints: endpoints.slice(0, 10),
      endpoints,
      marks: session.marks,
      ...extra,
    };
  };

  // Escribe el objeto de métricas a un archivo JSON (baseline para comparar).
  session.dumpMetrics = (filePath, extra = {}) => {
    const fs = require('fs');
    const path = require('path');
    const metrics = session.getMetrics(extra);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
    console.log(`\n📈 Métricas guardadas en: ${filePath}`);
    console.log(`   ⏱️  Duración: ${metrics.totalDurationSec}s | API ok: ${metrics.api.success2xx} | API err: ${metrics.api.error4xx5xx} | latencia media: ${metrics.api.latencyOverallMs?.avg ?? 'n/a'}ms (p95 ${metrics.api.latencyOverallMs?.p95 ?? 'n/a'}ms)`);
    return metrics;
  };

  return session;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDITORÍA GENERAL DE PANTALLA — centinela obligatorio (ver CLAUDE.md §0.2)
//
// Se agregó tras un error real (2026-07-30): una sesión de error guessing vio
// evidencia de un problema (checklists mostrando "Cargando preguntas" sin
// resolver) tres veces y la descartó las tres con una hipótesis benigna sin
// evidencia de esa corrida. Este helper es el chequeo que debería haberse
// corrido cada vez: espera de forma REALISTA (no un timeout corto) a que
// cualquier texto de carga desaparezca, y vuelca un inventario completo de
// los elementos interactivos visibles — para no depender de mirar un
// screenshot buscando solo lo que se estaba probando en ese momento.
//
// Uso recomendado: llamar después de cada guardado/Finalizar, y siempre que
// se entre a una pantalla nueva, sin importar cuál sea el foco puntual de la
// prueba.
// ─────────────────────────────────────────────────────────────────────────────
async function auditarPantalla(page, etiqueta, opts = {}) {
  const maxWaitMs = opts.maxWaitMs ?? 20000;
  const pollMs = opts.pollMs ?? 2000;
  // 2026-09-10: la lista traía solo "cargando"/"loading..." — un repro real
  // (ver CONTEXTO.md, hallazgo de "General" vaciado) encontró un overlay
  // separado con el texto "Recuperando datos del paciente..." que ninguno de
  // los 2 patrones matcheaba, dejando pasar por alto exactamente el tipo de
  // carga en segundo plano que este helper existe para detectar. Se agregan
  // otros verbos de carga usados en la app en vez de perseguir cada string
  // nuevo uno por uno cuando aparezca.
  const patronesCarga = opts.patronesCarga || [/cargando[^"]*/i, /recuperando[^"]*/i, /procesando[^"]*/i, /loading\.\.\./i];

  const reporte = {
    etiqueta,
    cargasPendientes: [],
    tardoEnResolver: false,
    inventario: [],
    textoCompleto: '',
  };

  // 1. Esperar de forma realista (polling, no un solo waitForTimeout corto) a
  // que cualquier texto de "Cargando..."/"Loading..." desaparezca.
  const inicio = Date.now();
  let vueltas = 0;
  while (Date.now() - inicio < maxWaitMs) {
    const texto = (await opcional(page.locator('body').innerText(), 'auditarPantalla:body-innertext-poll')) ?? '';
    const matches = patronesCarga.flatMap(re => (texto.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []));
    if (matches.length === 0) break;
    vueltas++;
    await page.waitForTimeout(pollMs);
  }
  if (vueltas > 0) reporte.tardoEnResolver = true;

  const textoFinal = (await opcional(page.locator('body').innerText(), 'auditarPantalla:body-innertext-final')) ?? '';
  reporte.textoCompleto = textoFinal;
  reporte.cargasPendientes = patronesCarga.flatMap(re => (textoFinal.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []));

  // 2. Inventario completo de elementos interactivos visibles — no una
  // muestra: TODOS, para poder declarar explícitamente qué quedó sin llenar
  // y por qué, en vez de asumir que "ya se probó lo importante".
  const elementos = page.locator('input:visible, select:visible, textarea:visible, button:visible, [role="combobox"]:visible, [contenteditable="true"]:visible');
  const n = (await opcional(elementos.count(), 'auditarPantalla:elementos-count')) ?? 0;
  for (let i = 0; i < n; i++) {
    const el = elementos.nth(i);
    const tag = (await opcional(el.evaluate(e => e.tagName.toLowerCase()), 'auditarPantalla:elemento-tag')) ?? '?';
    const type = await opcional(el.getAttribute('type'), 'auditarPantalla:elemento-type');
    const name = await opcional(el.getAttribute('name'), 'auditarPantalla:elemento-name');
    const placeholder = await opcional(el.getAttribute('placeholder'), 'auditarPantalla:elemento-placeholder');
    const required = await opcional(el.evaluate(e => e.required === true || e.getAttribute('aria-required') === 'true'), 'auditarPantalla:elemento-required');
    let value = null;
    if (tag === 'button' || tag === 'a') {
      value = ((await opcional(el.textContent(), 'auditarPantalla:elemento-textcontent')) || '').trim().substring(0, 50);
    } else {
      value = await opcional(el.inputValue(), 'auditarPantalla:elemento-inputvalue');
    }
    reporte.inventario.push({ i, tag, type, name, placeholder, required, value });
  }

  const estadoCarga = reporte.cargasPendientes.length > 0
    ? `⚠️ ${reporte.cargasPendientes.length} texto(s) de carga SIN resolver tras ${maxWaitMs}ms: ${JSON.stringify(reporte.cargasPendientes)}`
    : (reporte.tardoEnResolver ? `✅ resolvió, pero tardó (${vueltas * pollMs}ms+)` : '✅ sin textos de carga pendientes');
  console.log(`\n🔍 [auditarPantalla: "${etiqueta}"] ${estadoCarga}`);
  console.log(`   ${reporte.inventario.length} elemento(s) interactivo(s) inventariados.`);

  return reporte;
}

module.exports = { checkNextDaysForIniciarButton, createAppointment, handleModals, setupConsoleMonitor, asegurarCalendarioDashboard, irADiaEnCalendarioDashboard, auditarPantalla, buscarBotonIniciarDePaciente, asegurarCitaDeHoy };