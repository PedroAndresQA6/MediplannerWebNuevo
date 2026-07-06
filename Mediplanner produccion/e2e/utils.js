const { expect } = require('@playwright/test');
const config = require('./config');

const logger = config.logger;

async function fillTabFields(page, tabName) {
  // 'load' en vez de 'networkidle': el entorno mantiene la red activa
  // (GA/Zendesk/Clarity) y networkidle no se cumple, provocando que se leyeran
  // y rellenaran los campos antes de que la app cargara su data.
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);

  logger.info(`Llenando campos en pestaña: ${tabName}`);

  let filled = 0;
  let skippedOptional = 0;

  // Un campo solo se rellena si el formulario lo marca como OBLIGATORIO.
  // Así no inyectamos datos en campos opcionales que deberían quedar vacíos.
  const isRequired = (loc) =>
    loc.evaluate((el) =>
      el.required === true ||
      el.getAttribute('aria-required') === 'true' ||
      el.getAttribute('required') !== null
    ).catch(() => false);

  // Número realista según el campo, en vez de un '70' a ciegas que no tiene
  // sentido médico en glucosa/talla/temperatura/etc.
  const realisticNumberFor = (name, placeholder) => {
    const hay = `${name} ${placeholder}`.toLowerCase();
    if (hay.includes('glucosa')) return '90';
    if (hay.includes('peso')) return '70';
    if (hay.includes('talla') || hay.includes('estatura') || hay.includes('altura')) return '170';
    if (hay.includes('temperatura') || hay.includes('temp')) return '36.5';
    if (hay.includes('saturaci') || hay.includes('spo2') || hay.includes('oxíg') || hay.includes('oxig')) return '98';
    if (hay.includes('imc')) return '24';
    if (hay.includes('edad')) return '30';
    if (hay.includes('frecuencia') && hay.includes('card')) return '75';
    if (hay.includes('frecuencia') && hay.includes('resp')) return '16';
    if (hay.includes('sistólica') || hay.includes('sistolica')) return '120';
    if (hay.includes('diastólica') || hay.includes('diastolica')) return '80';
    if (hay.includes('cintura') || hay.includes('perímetro') || hay.includes('perimetro')) return '85';
    return '1'; // número neutro para un campo numérico desconocido
  };

  // ── Textareas ───────────────────────────────────────────────────────────────
  const textareas = page.locator('textarea, [role="textbox"]');
  const textareaCount = await textareas.count();
  logger.info(`Encontradas ${textareaCount} textareas`);

  for (let i = 0; i < textareaCount; i++) {
    const textarea = textareas.nth(i);
    const isVisible = await textarea.isVisible().catch(() => false);
    const isDisabled = await textarea.isDisabled().catch(() => false);
    if (!isVisible || isDisabled) continue;

    const currentValue = await textarea.inputValue().catch(() => '');
    if (currentValue && currentValue.trim() !== '') continue;

    if (!(await isRequired(textarea))) { skippedOptional++; continue; }

    const placeholder = ((await textarea.getAttribute('placeholder').catch(() => '')) || '').toLowerCase();
    let value;
    if (placeholder.includes('motivo')) {
      value = 'Consulta de control rutinario para evaluación de estado de salud general';
    } else if (placeholder.includes('padecimient') || placeholder.includes('síntomas')) {
      value = 'Paciente refiere sentirse bien, sin molestias agudas. No presenta síntomas de enfermedad actual';
    } else if (placeholder.includes('nota') || placeholder.includes('evolu')) {
      value = 'Evolución favorable. Paciente en buen estado general';
    } else if (placeholder.includes('diagnóstico') || placeholder.includes('dx')) {
      value = 'Diagnóstico: Estado de salud normal';
    } else if (placeholder.includes('tratamiento') || placeholder.includes('rx')) {
      value = 'Tratamiento: Mantener medidas de higiene y alimentación balanceada';
    } else if (placeholder.includes('exploración') || placeholder.includes('física')) {
      value = 'Exploración física: Normal, sin alteraciones';
    } else if (placeholder.includes('observaciones') || placeholder.includes('notas')) {
      value = 'Paciente acude a consulta de seguimiento. Se observa buen estado general, hidratado y con signos vitales dentro de parámetros normales. Refiere cumplimiento del tratamiento indicado en consulta anterior.';
    } else if (tabName && tabName.toLowerCase().includes('notas')) {
      value = 'Paciente acude a consulta de seguimiento. Se observa buen estado general, hidratado y con signos vitales dentro de parámetros normales. Refiere cumplimiento del tratamiento indicado en consulta anterior. No refiere efectos adversos secundarios a la medicación prescrita. Se continúa con el mismo esquema terapéutico y se programan estudios de laboratorio de rutina para valoración en próxima visita. Se recomienda mantener hábitos de higiene, alimentación balanceada y actividad física moderada.';
    } else {
      value = 'Información registrada correctamente en el sistema';
    }
    await textarea.fill(value);
    filled++;
    logger.success(`Llenada textarea ${i + 1} (obligatoria) placeholder: ${placeholder}`);
  }

  // ── Inputs de texto / número / email ──────────────────────────────────────────
  const selectors = [
    'input[type="text"]:not([disabled]):not([readonly])',
    'input[type="number"]:not([disabled]):not([readonly])',
    'input[type="email"]:not([disabled]):not([readonly])',
    'input:not([type]):not([disabled]):not([readonly])',
  ];

  for (const selector of selectors) {
    const fields = page.locator(selector);
    const count = await fields.count();
    logger.info(`Encontrados ${count} inputs para selector: ${selector}`);

    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      const isVisible = await field.isVisible().catch(() => false);
      const isEnabled = await field.isEnabled().catch(() => false);
      if (!isVisible || !isEnabled) continue;

      const currentValue = await field.inputValue().catch(() => '');
      if (currentValue) continue;

      if (!(await isRequired(field))) { skippedOptional++; continue; }

      const type = await field.getAttribute('type');
      const name = (await field.getAttribute('name')) || '';
      const placeholder = (await field.getAttribute('placeholder')) || '';
      const hay = `${name} ${placeholder}`.toLowerCase();

      let value;
      if (type === 'email' || hay.includes('correo') || hay.includes('email')) {
        value = 'paciente.prueba@example.com';
      } else if (hay.includes('mmhg') || hay.includes('presion') || hay.includes('presión')) {
        value = '120/80';
      } else if (type === 'number' || hay.includes('glucosa') || hay.includes('peso') ||
                 hay.includes('talla') || hay.includes('temperatura')) {
        value = realisticNumberFor(name, placeholder);
      } else if (hay.includes('referido')) {
        value = 'Pedro Quijada';
      } else {
        value = 'N/A';
      }
      await field.fill(value);
      filled++;
      logger.success(`Llenado input ${i + 1} (obligatorio) ${name || placeholder} = ${value}`);
    }
  }

  // ── Selects nativos ───────────────────────────────────────────────────────────
  const selects = page.locator('select:not([disabled])');
  const selectCount = await selects.count();
  logger.info(`Encontrados ${selectCount} selects`);
  for (let i = 0; i < selectCount; i++) {
    const select = selects.nth(i);
    const isVisible = await select.isVisible().catch(() => false);
    if (!isVisible) continue;

    const options = await select.locator('option').count();
    if (options <= 1) continue;

    const currentValue = await select.inputValue().catch(() => '');
    const isEmpty = !currentValue || currentValue === '' || currentValue === 'Selecciona...' || currentValue.includes('Seleccione');
    if (!isEmpty) continue;

    if (!(await isRequired(select))) { skippedOptional++; continue; }

    await select.selectOption({ index: 1 });
    filled++;
    logger.success(`Seleccionado en select ${i + 1} (obligatorio)`);
  }

  logger.info(`fillTabFields(${tabName}): ${filled} campos obligatorios rellenados, ${skippedOptional} opcionales omitidos`);
}

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

async function checkNextDaysForIniciarButton(page) {
  logger.info('Buscando botón Iniciar en los próximos 5 días...');
  
  // Primero asegurarnos de estar en la página correcta de citas/agenda
  const currentUrl = page.url();
  if (!currentUrl.includes('/Citas') && !currentUrl.includes('/Dashboard')) {
    await page.goto('/Citas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }
  
  // Intentar cambiar a vista de Agenda si existe
  try {
    const agendaLink = page.getByRole('link', { name: /agenda/i });
    if (await agendaLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await agendaLink.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    // Continuar sin vista agenda
  }
  
  for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    logger.info(`Revisando fecha: ${dateStr}`);
    
    // Buscar botones Iniciar en la página actual
    let iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    let count = await iniciarButtons.count();
    
    if (count > 0) {
      // Verificar que sean botones visibles (no ocultos en modales)
      let visibleCount = 0;
      for (let i = 0; i < count; i++) {
        if (await iniciarButtons.nth(i).isVisible().catch(() => false)) {
          visibleCount++;
        }
      }
      if (visibleCount > 0) {
        logger.success(`Encontrados ${visibleCount} botones Iniciar visibles en ${dateStr}`);
        await iniciarButtons.first().click();
        return true;
      }
    }
    
    // Si no hay botones, intentar cambiar la fecha del datepicker
    try {
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateInput.fill(dateStr);
        await page.waitForTimeout(2000);
        continue;
      }
    } catch (error) {
      logger.warning(`No se pudo cambiar fecha: ${error.message}`);
    }
    
    // Si no hay input de fecha, navegar a la fecha usando botones de siguiente día
    try {
      const nextDayBtn = page.locator('button.fc-next-button, button[title*="siguiente"], button:has-text("Siguiente")').first();
      if (await nextDayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextDayBtn.click();
        await page.waitForTimeout(1500);
      } else {
        logger.warning(`No hay botón para avanzar fecha, recargando página...`);
        await page.reload();
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      logger.error(`Error al cambiar fecha: ${error.message}`);
    }
  }
  
  return false;
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
    if (await sidebarAgendar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sidebarAgendar.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
  }
  
  // Abrir Wizard - botón "Agendar cita" en la parte superior derecha
  logger.info('Buscando botón "Agendar cita"...');
  const agendarButton = page.getByRole('button', { name: /agendar cita/i }).first();
  if (!await agendarButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    // Intentar otros selectores
    const altBtn = page.locator('button:has-text("Agendar cita"), button:has-text("Nueva cita")').first();
    if (await altBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await altBtn.click();
    } else {
      throw new Error('No se encontró el botón "Agendar cita"');
    }
  } else {
    await agendarButton.click();
  }
  
  const wizard = page.locator('div.bg-white.shadow-md.rounded.p-5');
  await expect(wizard).toBeVisible();
  
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
            const t = (await opciones.nth(k).textContent().catch(() => '') || '').toLowerCase();
            if (t.includes(searchText.toLowerCase())) { elegido = opciones.nth(k); break; }
          }
          if (elegido) {
            const txt = (await elegido.textContent().catch(() => '') || '').trim();
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
  const continueBtn2 = page.getByRole('button', { name: /continuar/i });
  if (await continueBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await continueBtn2.click();
  }
  
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
         
        // Confirmar
        await page.getByRole('button', { name: /agendar cita/i }).click();
        await page.getByRole('button', { name: 'OK' }).click();
         
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
          const body = await response.json().catch(() => null);
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
// DETECTOR DE SECCIONES SIN GUARDAR
// La app muestra un triángulo de advertencia (FontAwesome triangle-exclamation,
// naranja) en el card-header de una sección cuando se escribió/modificó pero el
// dato NO se guardó. No genera error HTTP ni de consola, por lo que el monitor de
// red/consola no lo ve: hay que detectarlo en el DOM.
//
// Markup de referencia:
//   <div class="card-header ..."><h3 class="card-title">Aparatos y sistemas</h3>
//     <svg data-icon="triangle-exclamation" class="...text-orange-500 ...">
//
// Devuelve un array con los nombres de las secciones marcadas (vacío = todo OK).
// ─────────────────────────────────────────────────────────────────────────────
async function detectUnsavedSections(page, opts = {}) {
  const icons = page.locator('svg[data-icon="triangle-exclamation"]');
  const total = await icons.count();
  const flagged = [];

  for (let i = 0; i < total; i++) {
    const icon = icons.nth(i);
    if (!(await icon.isVisible().catch(() => false))) continue;

    // El color naranja/amarillo es lo que marca "sin guardar"; un triángulo de
    // otro color (o sin color de alerta) podría ser otra cosa.
    const cls = (await icon.getAttribute('class').catch(() => '')) || '';
    if (!/text-(orange|yellow|amber|warning)/i.test(cls)) continue;

    // El título de la sección vive en el .card-header que contiene al ícono.
    let section = '(sección desconocida)';
    const header = icon.locator('xpath=ancestor::*[contains(@class,"card-header")][1]');
    if (await header.count() > 0) {
      const title = await header.locator('.card-title, h1, h2, h3, h4').first().textContent().catch(() => '');
      if (title && title.trim()) section = title.trim();
    }
    flagged.push(section);
  }

  if (flagged.length > 0) {
    logger.warning(`⚠️  ${flagged.length} sección(es) con indicador de NO guardado: ${flagged.join(', ')}`);
    if (opts.screenshot !== false) {
      const path = opts.screenshotPath || 'test-results/unsaved-indicator.png';
      await page.screenshot({ path, fullPage: true }).catch(() => {});
      logger.info(`📸 Evidencia del indicador guardada en: ${path}`);
    }
  } else if (total > 0) {
    logger.success('✅ Sin indicadores de no-guardado (triángulos presentes pero no de alerta)');
  } else {
    logger.success('✅ Sin indicadores de no-guardado en pantalla');
  }

  return flagged;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDITORÍA DEL INDICADOR "SIN GUARDAR" POR APARTADO
// Recorre dinámicamente cada apartado (card con título + botón Guardar propio) de
// la consulta y valida el ciclo del triángulo de advertencia:
//   • Tras editar, ANTES de guardar  → el triángulo DEBE aparecer.
//       Si no aparece = 🐛 el cambio no se registró.
//   • Tras hacer clic en Guardar     → el triángulo DEBE desaparecer.
//       Si sigue = 🐛 no se guardó, o se clickeó el botón de guardar equivocado.
// No tumba el test: registra cada apartado (✅/🐛) + screenshot del fallo y sigue.
// Descubre apartados y pestañas en runtime (no usa lista fija).
// ─────────────────────────────────────────────────────────────────────────────
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ¿Hay un triángulo de advertencia (naranja/amarillo) visible dentro de `scope`?
async function hasWarningTriangle(scope) {
  const icons = scope.locator('svg[data-icon="triangle-exclamation"]');
  const n = await icons.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const icon = icons.nth(i);
    if (!(await icon.isVisible().catch(() => false))) continue;
    const cls = (await icon.getAttribute('class').catch(() => '')) || '';
    if (/text-(orange|yellow|amber|warning)/i.test(cls)) return true;
  }
  return false;
}

// Hace una modificación en el apartado para disparar el indicador.
// Devuelve true si logró editar algo.
async function triggerEdit(card) {
  // 1) textarea / contenteditable
  const ta = card.locator('textarea:visible, [role="textbox"]:visible').first();
  if ((await ta.count().catch(() => 0)) > 0 && await ta.isEnabled().catch(() => false)) {
    const cur = await ta.inputValue().catch(() => null);
    if (cur !== null) {
      await ta.fill(((cur || '') + ' [audit]').trim()).catch(() => {});
    } else {
      await ta.click().catch(() => {});
      await ta.type(' [audit]').catch(() => {});
    }
    return 'textarea';
  }
  // 2) input de texto / número
  const inp = card.locator('input[type="text"]:visible, input[type="number"]:visible, input:not([type]):visible').first();
  if ((await inp.count().catch(() => 0)) > 0 && await inp.isEnabled().catch(() => false)) {
    const type = await inp.getAttribute('type').catch(() => '');
    await inp.fill(type === 'number' ? '1' : 'audit').catch(() => {});
    return 'input';
  }
  // 3) checkbox
  const cb = card.locator('input[type="checkbox"]:visible').first();
  if ((await cb.count().catch(() => 0)) > 0 && await cb.isEnabled().catch(() => false)) {
    await cb.click().catch(() => {});
    return 'checkbox';
  }
  return null;
}

// ¿El cuerpo del card tiene contenido visible (campo o botón Guardar)?
async function cardBodyVisible(card) {
  const save = await card.getByRole('button', { name: /guardar/i }).first().isVisible().catch(() => false);
  if (save) return true;
  return await card.locator('textarea:visible, input:visible, [role="textbox"]:visible').first().isVisible().catch(() => false);
}

// Expande el apartado si está colapsado (clic en el chevron del header).
async function ensureExpanded(page, card) {
  if (await cardBodyVisible(card)) return true;
  const chevron = card.locator('.card-header button:has(svg[data-icon*="chevron"])').first();
  if ((await chevron.count().catch(() => 0)) > 0) {
    await chevron.click().catch(() => {});
    await page.waitForTimeout(700);
  }
  return await cardBodyVisible(card);
}

// Devuelve el botón de guardar PROPIO del apartado (dentro de su card-body),
// priorizando etiquetas específicas. Devuelve { btn, label } o null.
async function findOwnSaveButton(card) {
  const candidates = [
    /^\s*guardar respuestas\s*$/i,
    /^\s*guardar cambios\s*$/i,
    /^\s*guardar\b.*/i,
  ];
  for (const re of candidates) {
    const btn = card.getByRole('button', { name: re }).first();
    if ((await btn.count().catch(() => 0)) > 0 && await btn.isVisible().catch(() => false)) {
      const label = ((await btn.textContent().catch(() => '')) || '').trim();
      return { btn, label };
    }
  }
  return null;
}

async function auditConsultationIndicators(page, opts = {}) {
  const results = [];
  console.log('\n' + '═'.repeat(70));
  console.log('🔎  AUDITORÍA DEL INDICADOR "SIN GUARDAR" POR APARTADO');
  console.log('═'.repeat(70));

  // Descubrir pestañas en runtime; fallback a lista conocida si no hay role=tab.
  let tabNames = opts.tabs;
  if (!tabNames) {
    const tabEls = page.getByRole('tab');
    const n = await tabEls.count().catch(() => 0);
    tabNames = [];
    for (let i = 0; i < n; i++) {
      const t = ((await tabEls.nth(i).textContent().catch(() => '')) || '').trim();
      if (t) tabNames.push(t);
    }
    if (tabNames.length === 0) {
      tabNames = ['General', 'Exploración', 'Diagnóstico', 'Tratamiento', 'Notas del Médico', 'Servicios'];
    }
  }
  logger.info(`Pestañas a recorrer: ${tabNames.join(' | ')}`);

  for (const tabName of tabNames) {
    // Activar la pestaña
    const reTab = new RegExp(`^\\s*${escapeRegExp(tabName)}\\s*$`, 'i');
    let tab = page.getByRole('tab', { name: reTab }).first();
    if (!((await tab.count().catch(() => 0)) > 0 && await tab.isVisible().catch(() => false))) {
      tab = page.locator(`button:has-text("${tabName}"), a:has-text("${tabName}"), li:has-text("${tabName}")`).first();
    }
    if ((await tab.count().catch(() => 0)) > 0 && await tab.isVisible().catch(() => false)) {
      await handleModals(page);
      await tab.click().catch(() => {});
      await page.waitForLoadState('load').catch(() => {});
      await page.waitForTimeout(1500);
    } else {
      logger.warning(`Pestaña "${tabName}" no encontrada, saltando`);
      continue;
    }

    // DIAGNÓSTICO: listar todos los títulos de card visibles en esta pestaña.
    const titles = page.locator('.card-title');
    const titleCount = await titles.count().catch(() => 0);
    const visibleNames = [];
    for (let i = 0; i < titleCount; i++) {
      if (await titles.nth(i).isVisible().catch(() => false)) {
        visibleNames.push(((await titles.nth(i).textContent().catch(() => '')) || '').trim());
      }
    }
    logger.info(`📑 [${tabName}] apartados visibles (${visibleNames.length}): ${visibleNames.join(' / ') || '—'}`);

    for (let i = 0; i < titleCount; i++) {
      const titleEl = titles.nth(i);
      if (!(await titleEl.isVisible().catch(() => false))) continue;

      const name = ((await titleEl.textContent().catch(() => '')) || '').trim() || `(apartado ${i + 1})`;

      // Card contenedora del apartado (la más cercana) y su header.
      const card = titleEl.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," card ")][1]');
      const header = titleEl.locator('xpath=ancestor::*[contains(@class,"card-header")][1]');
      if ((await card.count().catch(() => 0)) === 0) continue;

      let entry = { tab: tabName, apartado: name, status: 'skip', detail: '' };
      try {
        // Expandir si está colapsado.
        await ensureExpanded(page, card);

        // Botón de guardar propio del apartado.
        const save = await findOwnSaveButton(card);
        if (!save) {
          entry.detail = 'Sin botón "Guardar" propio (probablemente guarda con "Continuar" a nivel página)';
          logger.info(`⏭️  [${tabName} › ${name}] ${entry.detail}`);
          results.push(entry);
          continue;
        }

        const edited = await triggerEdit(card);
        if (!edited) {
          entry.detail = 'No se pudo editar ningún campo del apartado (sin campo editable visible)';
          logger.warning(`⏭️  [${tabName} › ${name}] ${entry.detail}`);
          results.push(entry);
          continue;
        }

        await page.waitForTimeout(800);
        const triangleScope = (await header.count().catch(() => 0)) > 0 ? header : card;
        const before = await hasWarningTriangle(triangleScope);

        await save.btn.click().catch(() => {});
        await page.waitForTimeout(1500);
        await handleModals(page);
        await page.waitForTimeout(500);
        const after = await hasWarningTriangle(triangleScope);

        if (!before) {
          entry.status = 'bug';
          entry.detail = `El triángulo NO apareció tras editar (${edited}), antes de guardar (el cambio no se registró)`;
        } else if (after) {
          entry.status = 'bug';
          entry.detail = `El triángulo SIGUE tras clic en "${save.label}" (no se guardó, o el botón es el incorrecto)`;
        } else {
          entry.status = 'ok';
          entry.detail = `Apareció tras editar (${edited}) y desapareció tras "${save.label}"`;
        }
        entry.saveLabel = save.label;

        if (entry.status === 'bug' && opts.screenshot !== false) {
          const safe = `${tabName}-${name}`.replace(/[^\w]+/g, '-').slice(0, 60);
          entry.screenshot = `test-results/indicador-${safe}.png`;
          await page.screenshot({ path: entry.screenshot, fullPage: true }).catch(() => {});
        }

        const icon = entry.status === 'ok' ? '✅' : '🐛';
        logger.info(`${icon} [${tabName} › ${name}] ${entry.detail}${entry.screenshot ? ` → ${entry.screenshot}` : ''}`);
      } catch (e) {
        entry.status = 'error';
        entry.detail = `Excepción durante la auditoría: ${e.message}`;
        logger.error(`💥 [${tabName} › ${name}] ${entry.detail}`);
      }
      results.push(entry);
    }
  }

  // ── Resumen ──
  const ok = results.filter(r => r.status === 'ok').length;
  const bugs = results.filter(r => r.status === 'bug');
  const skipped = results.filter(r => r.status === 'skip').length;
  const errored = results.filter(r => r.status === 'error').length;

  console.log('\n' + '─'.repeat(70));
  console.log('📋  RESUMEN AUDITORÍA INDICADOR');
  console.log('─'.repeat(70));
  console.log(`   Apartados auditados: ${results.length}`);
  console.log(`   ✅ Correctos:        ${ok}`);
  console.log(`   🐛 Con bug:          ${bugs.length}`);
  console.log(`   ⏭️  Omitidos:         ${skipped}`);
  console.log(`   💥 Errores:          ${errored}`);
  if (bugs.length > 0) {
    console.log('\n   Apartados con problema:');
    bugs.forEach((b, i) => console.log(`     [${i + 1}] ${b.tab} › ${b.apartado} — ${b.detail}`));
  }
  console.log('─'.repeat(70) + '\n');

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCANEO RESIDUAL DEL INDICADOR (instrumentación del flujo real)
// Se llama JUSTO DESPUÉS de que un handler real terminó de editar y guardar los
// apartados de la pestaña actual, SIN salir de la pestaña (el triángulo es un
// indicador client-side: navegar fuera lo descarta).
// Devuelve los apartados visibles que CONSERVAN el triángulo de advertencia, es
// decir, cuyo dato no quedó persistido pese al guardado real → bug real.
// ─────────────────────────────────────────────────────────────────────────────
async function collectFlaggedApartados(page) {
  const titles = page.locator('.card-title');
  const n = await titles.count().catch(() => 0);
  const flagged = [];
  for (let i = 0; i < n; i++) {
    const t = titles.nth(i);
    if (!(await t.isVisible().catch(() => false))) continue;
    const header = t.locator('xpath=ancestor::*[contains(@class,"card-header")][1]');
    const scope = (await header.count().catch(() => 0)) > 0
      ? header
      : t.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," card ")][1]');
    if (await hasWarningTriangle(scope)) {
      flagged.push(((await t.textContent().catch(() => '')) || '').trim());
    }
  }
  return flagged;
}

async function scanResidualIndicators(page, tabName, opts = {}) {
  const settle = opts.settleMs != null ? opts.settleMs : 1500;
  // Dejar asentar el re-render posterior al guardado antes de mirar.
  await page.waitForTimeout(settle);
  const firstPass = await collectFlaggedApartados(page);
  if (firstPass.length === 0) return [];

  // Re-verificar: el triángulo puede estar limpiándose de forma asíncrona. Solo
  // reportamos los apartados cuyo triángulo PERSISTE en ambas pasadas (descarta
  // falsos positivos por timing).
  await page.waitForTimeout(1500);
  const secondPass = await collectFlaggedApartados(page);
  return firstPass.filter(name => secondPass.includes(name));
}

module.exports = { fillTabFields, checkNextDaysForIniciarButton, createAppointment, handleModals, setupConsoleMonitor, detectUnsavedSections, auditConsultationIndicators, scanResidualIndicators };