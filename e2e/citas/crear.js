const { expect } = require('@playwright/test');
const config = require('../config');
const { opcional } = require('../opcional');
const { handleModals } = require('../modales');

const logger = config.logger;

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
    if (await opcional(sidebarAgendar.isVisible(), 'createAppointment:sidebar-agendar-visible')) {
      await sidebarAgendar.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }
  }

  // Abrir Wizard - botón "Agendar cita" en la parte superior derecha
  logger.info('Buscando botón "Agendar cita"...');
  const agendarButton = page.getByRole('button', { name: /agendar cita/i }).first();
  // isVisible({timeout}) no espera de verdad en esta versión de Playwright
  // (confirmado en vivo, Etapa 5 de docs/tarea-actual.md) — este botón puede
  // tardar en montar tras la navegación, por eso se usa un waitFor real.
  if (!await opcional(agendarButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true), 'createAppointment:boton-agendar-cita-visible')) {
    // Intentar otros selectores
    const altBtn = page.locator('button:has-text("Agendar cita"), button:has-text("Nueva cita")').first();
    if (await opcional(altBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true), 'createAppointment:boton-agendar-cita-alt-visible')) {
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

module.exports = { createAppointment };
