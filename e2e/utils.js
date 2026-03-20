const { expect } = require('@playwright/test');
const config = require('./config');

const logger = config.logger;

async function fillTabFields(page, tabName) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  logger.info(`Llenando campos en pestaña: ${tabName}`);
  
  const textareas = page.locator('textarea, [role="textbox"]');
  const textareaCount = await textareas.count();
  logger.info(`Encontradas ${textareaCount} textareas`);
  
  for (let i = 0; i < textareaCount; i++) {
    const textarea = textareas.nth(i);
    const isVisible = await textarea.isVisible().catch(() => false);
    const isDisabled = await textarea.isDisabled().catch(() => false);
    
    if (isVisible && !isDisabled) {
      const currentValue = await textarea.inputValue().catch(() => '');
      if (!currentValue || currentValue.trim() === '') {
        const placeholder = await textarea.getAttribute('placeholder').catch(() => '');
        
        if (placeholder.toLowerCase().includes('motivo')) {
          await textarea.fill('Consulta de control rutinario para evaluación de estado de salud general');
        } else if (placeholder.toLowerCase().includes('padecimient') || placeholder.toLowerCase().includes('síntomas')) {
          await textarea.fill('Paciente refiere sentirse bien, sin molestias agudas. No presenta síntomas de enfermedad actual');
        } else if (placeholder.toLowerCase().includes('nota') || placeholder.toLowerCase().includes('evolu')) {
          await textarea.fill('Evolución favorable. Paciente en buen estado general');
        } else if (placeholder.toLowerCase().includes('diagnóstico') || placeholder.toLowerCase().includes('dx')) {
          await textarea.fill('Diagnóstico: Estado de salud normal');
        } else if (placeholder.toLowerCase().includes('tratamiento') || placeholder.toLowerCase().includes('rx')) {
          await textarea.fill('Tratamiento: Mantener medidas de higiene y alimentación balanceada');
        } else if (placeholder.toLowerCase().includes('exploración') || placeholder.toLowerCase().includes('física')) {
          await textarea.fill('Exploración física: Normal, sin alteraciones');
        } else if (placeholder.toLowerCase().includes('observaciones') || placeholder.toLowerCase().includes('notas')) {
          await textarea.fill('Paciente acude a consulta de seguimiento. Se observa buen estado general,hidratado y con signos vitales dentro de parámetros normales. Refiere cumplimiento del tratamiento indicado en consulta anterior.');
        } else {
          // Si no hay placeholder específico, verificar si estamos en Notas del Médico
          if (tabName && tabName.toLowerCase().includes('notas')) {
            await textarea.fill('Paciente acude a consulta de seguimiento. Se observa buen estado general, hidratado y con signos vitales dentro de parámetros normales. Refiere cumplimiento del tratamiento indicado en consulta anterior. No refiere efectos adversos secundarios a la medicación prescrita. Se continúa con el mismo esquema terapéutico y se programan estudios de laboratorio de rutina para valoración en próxima visita. Se recomienda mantener hábitos de higiene, alimentación balanceada y actividad física moderada.');
          } else {
            await textarea.fill('Información registrada correctamente en el sistema');
          }
        }
        logger.success(`Llenada textarea ${i + 1} con placeholder: ${placeholder}`);
      }
    }
  }
  
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
      
      if (isVisible && isEnabled) {
        const tagName = await field.evaluate((el) => el.tagName.toLowerCase());
        
        if (tagName === 'input') {
          const currentValue = await field.inputValue().catch(() => '');
          if (!currentValue) {
            const type = await field.getAttribute('type');
            const name = await field.getAttribute('name') || '';
            const placeholder = await field.getAttribute('placeholder') || '';
            
            if (type === 'number' || name.toLowerCase().includes('glucosa') || name.toLowerCase().includes('peso')) {
              await field.fill('70');
            } else if (placeholder.toLowerCase().includes('mmhg') || placeholder.toLowerCase().includes('presion')) {
              await field.fill('120/80');
            } else if (placeholder.toLowerCase().includes('temperatura')) {
              await field.fill('36.5');
            } else if (name.toLowerCase().includes('referido') || placeholder.toLowerCase().includes('referido')) {
              await field.fill('Pedro Quijada');
            } else {
              await field.fill('N/A');
            }
            logger.success(`Llenado input ${i + 1} (${name || placeholder})`);
          }
        }
      }
    }
  }
  
  const selects = page.locator('select:not([disabled])');
  const selectCount = await selects.count();
  logger.info(`Encontrados ${selectCount} selects`);
  for (let i = 0; i < selectCount; i++) {
    const select = selects.nth(i);
    const isVisible = await select.isVisible().catch(() => false);
    if (isVisible) {
      const options = await select.locator('option').count();
      
      if (options > 1) {
        const currentValue = await select.inputValue().catch(() => '');
        if (!currentValue || currentValue === '' || currentValue === 'Selecciona...' || currentValue.includes('Seleccione')) {
          await select.selectOption({ index: 1 });
          logger.success(`Seleccionado en select ${i + 1}`);
        }
      }
    }
  }
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
  
  for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
    
    logger.info(`Revisando fecha: ${dateStr}`);
    
    // Intentar navegar a la fecha
    try {
      const dateInput = page.locator('input[type="date"]');
      if (await dateInput.isVisible()) {
        await dateInput.fill(dateStr);
        await page.waitForTimeout(2000);
      } else {
        logger.warning('No se encontró input de fecha');
        continue;
      }
    } catch (error) {
      logger.error(`Error al cambiar fecha: ${error.message}`);
      continue;
    }
    
    // Buscar botones Iniciar
    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    
    if (count > 0) {
      logger.success(`Encontrados ${count} botones Iniciar en ${dateStr}`);
      await iniciarButtons.first().click();
      return true;
    } else {
      logger.warning(`No hay botones Iniciar en ${dateStr}`);
    }
  }
  
  return false;
}

async function createAppointment(page) {
  logger.info('Explorando próximos 5 días para registrar una cita...');
  
  await page.goto('/Citas');
  await expect(page).toHaveURL(/Citas/);
  
  // Abrir Wizard
  await page.getByRole('button', { name: /agendar cita/i }).click();
  
  const wizard = page.locator('div.bg-white.shadow-md.rounded.p-5');
  await expect(wizard).toBeVisible();
  
  // Paciente
  const combosA1 = wizard.getByRole('combobox');
  await expect(combosA1.first()).toBeVisible();
  
  const patientCombo = combosA1.nth(0);
  await page.waitForFunction(
    (el) => el && el.options.length > 1,
    await patientCombo.elementHandle()
  );
  
  const patientOptions = await patientCombo.locator('option').count();
  const randomPatient = Math.floor(Math.random() * (patientOptions - 1)) + 1;
  await patientCombo.selectOption({ index: randomPatient });
  
  const continueA1 = page.getByRole('button', { name: /continuar/i });
  await expect(continueA1).toBeEnabled({ timeout: 10000 });
  await continueA1.click();
  
  // Tipo + Hospital
  const combosA2 = page.getByRole('combobox');
  await expect(combosA2.first()).toBeVisible({ timeout: 10000 });
  
  const typeCombo = combosA2.nth(0);
  await page.waitForFunction(
    (el) => el && el.options.length > 1,
    await typeCombo.elementHandle()
  );
  
  const typeOptions = await typeCombo.locator('option').count();
  const randomType = Math.floor(Math.random() * (typeOptions - 1)) + 1;
  await typeCombo.selectOption({ index: randomType });
  
  const hospitalCombo = combosA2.nth(1);
  await page.waitForFunction(
    (el) => el && el.options.length > 1,
    await hospitalCombo.elementHandle()
  );
  
  const hospitalOptions = await hospitalCombo.locator('option').count();
  const randomHospital = Math.floor(Math.random() * (hospitalOptions - 1)) + 1;
  await hospitalCombo.selectOption({ index: randomHospital });
  
  await page.getByRole('button', { name: /continuar/i }).click();
  
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

module.exports = { fillTabFields, checkNextDaysForIniciarButton, createAppointment, handleModals };