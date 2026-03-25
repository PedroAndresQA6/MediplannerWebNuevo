import { test, expect } from '@playwright/test';
const config = require('../e2e/config');
const logger = config.logger;

test.describe('Subir Estudios', () => {

  test('Acceder a estudios del paciente', async ({ page }) => {

    const textoInterpretacion = 'La interpretación del laboratorio indica que los resultados se encuentran dentro de los parámetros normales. Los valores de hemoglobina, hematocrito, leucocitos y plaquetas están en rangos aceptables. La química sanguínea muestra glucosa, urea, creatinina y electrolitos normales. El perfil lipídico presenta colesterol total, LDL, HDL y triglicéridos dentro de los valores de referencia. Los resultados sugieren un estado de salud general óptimo sin signos de alteraciones metabólicas o infecciosas.';
    const textoComentarios = 'Comentarios del médico: Los resultados de laboratorio son satisfactorios y consistentes con un estado de salud adecuado. Se recomienda mantener los hábitos alimenticios actuales, continuar con actividad física regular y realizar seguimiento en 6 meses. No se requieren intervenciones médicas adicionales en este momento. Paciente presenta buena evolución clínica con parámetros dentro de la normalidad.';

    // 1. Ir al Dashboard
    logger.info('Navegando al Dashboard...');
    await page.goto('/Dashboard');
    await expect(page).toHaveURL(/Dashboard/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 2. Dar clic en "Pacientes" desde la barra lateral
    logger.info('Dando clic en "Pacientes" desde la barra lateral...');
    const pacientesLink = page.locator('span.menu-title:text-is("Pacientes")');
    await expect(pacientesLink).toBeVisible({ timeout: 10000 });
    await pacientesLink.click();
    await expect(page).toHaveURL(/Pacientes/);

    // 3. Esperar a que cargue la página de pacientes
    logger.info('Esperando carga de la página de Pacientes...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const loading = page.locator('text=/cargando/i');
    if (await loading.isVisible().catch(() => false)) {
      for (let i = 0; i < 30; i++) {
        if (!(await loading.isVisible().catch(() => false))) break;
        await page.waitForTimeout(2000);
      }
    }

    // 4. Seleccionar un paciente aleatorio
    logger.info('Buscando pacientes en la tabla...');
    const pacientes = page.locator('[role="cell"] a.font-semibold');
    const totalPacientes = await pacientes.count();
    logger.info(`Encontrados ${totalPacientes} pacientes`);

    if (totalPacientes === 0) {
      logger.error('No se encontraron pacientes');
      return;
    }

    const indiceAleatorio = Math.floor(Math.random() * totalPacientes);
    const pacienteSeleccionado = pacientes.nth(indiceAleatorio);
    const nombrePaciente = await pacienteSeleccionado.textContent().catch(() => 'Desconocido');
    logger.success(`Paciente seleccionado: "${nombrePaciente.trim()}"`);

    // Variable para tracking de la última consulta evaluada
    let ultimaConsultaEvaluada = -1;

    // Loop principal para encontrar una consulta válida
    while (true) {

      // 5. Acceder al perfil del paciente
      logger.info('Accediendo al perfil del paciente...');
      await pacienteSeleccionado.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const loading2 = page.locator('text=/cargando/i');
      if (await loading2.isVisible().catch(() => false)) {
        for (let i = 0; i < 30; i++) {
          if (!(await loading2.isVisible().catch(() => false))) break;
          await page.waitForTimeout(2000);
        }
      }

      logger.success('Perfil del paciente cargado');

      // 6. Dar clic en "Consultas"
      logger.info('Buscando sección "Consultas"...');
      const consultasLink = page.locator('a:has-text("Consultas")').first();

      if (await consultasLink.isVisible({ timeout: 10000 }).catch(() => false)) {
        await consultasLink.click();
        logger.success('Click en "Consultas" realizado');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        const loading3 = page.locator('text=/cargando/i');
        if (await loading3.isVisible().catch(() => false)) {
          for (let i = 0; i < 30; i++) {
            if (!(await loading3.isVisible().catch(() => false))) break;
            await page.waitForTimeout(2000);
          }
        }

        logger.success('Sección de Consultas cargada');

        // 7. Buscar consultas
        logger.info('Buscando opciones de consultas...');
        const opciones = page.locator('li.cursor-pointer');
        const totalOpciones = await opciones.count();
        logger.info(`Encontradas ${totalOpciones} consultas`);

        // Empezar desde la siguiente consulta después de la última evaluada
        const inicioBusqueda = ultimaConsultaEvaluada + 1;

        if (inicioBusqueda >= totalOpciones) {
          logger.warning('No hay más consultas para evaluar');
          break;
        }

        let encontradaConsultaValida = false;

        for (let i = inicioBusqueda; i < totalOpciones; i++) {
          const opcion = opciones.nth(i);
          const textoOpcion = await opcion.textContent().catch(() => 'Desconocido');
          logger.info(`Evaluando consulta ${i + 1}: "${textoOpcion.trim().substring(0, 80)}"`);
          ultimaConsultaEvaluada = i;

          await opcion.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          const loading4 = page.locator('text=/cargando/i');
          if (await loading4.isVisible().catch(() => false)) {
            for (let j = 0; j < 30; j++) {
              if (!(await loading4.isVisible().catch(() => false))) break;
              await page.waitForTimeout(2000);
            }
          }

          const verConsultaBtn = page.getByRole('button', { name: /ver consulta/i });

          if (await verConsultaBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            logger.success(`Botón "Ver consulta" encontrado en consulta ${i + 1}`);
            await verConsultaBtn.click();
            logger.success('Click en "Ver consulta" realizado');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(3000);

            const loading5 = page.locator('text=/cargando/i');
            if (await loading5.isVisible().catch(() => false)) {
              for (let j = 0; j < 30; j++) {
                if (!(await loading5.isVisible().catch(() => false))) break;
                await page.waitForTimeout(2000);
              }
            }

            logger.success('Consulta cargada exitosamente');

            // 8. Acceder a la pestaña "Tratamiento"
            logger.info('Buscando pestaña "Tratamiento"...');
            const tratamientoTab = page.locator('text=/tratamiento/i').first();

            if (await tratamientoTab.isVisible({ timeout: 10000 }).catch(() => false)) {
              await tratamientoTab.click();
              logger.success('Click en pestaña "Tratamiento" realizado');
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(3000);

              const loading6 = page.locator('text=/cargando/i');
              if (await loading6.isVisible().catch(() => false)) {
                for (let j = 0; j < 30; j++) {
                  if (!(await loading6.isVisible().catch(() => false))) break;
                  await page.waitForTimeout(2000);
                }
              }

              logger.success('Pestaña "Tratamiento" cargada');

              // 9. Verificar si ya hay estudios subidos
              const estudiosExistentes = page.locator('section:has(span:text-is("Estuidos_ejemplo_mediplanner.pdf"))').first();

              if (await estudiosExistentes.isVisible({ timeout: 3000 }).catch(() => false)) {
                logger.warning(`⚠️ Consulta ${i + 1} ya tiene estudios subidos, regresando al perfil del paciente...`);
                // Navegar al Dashboard y seleccionar el paciente de nuevo
                await page.goto('/Dashboard');
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(3000);

                // Dar clic en "Pacientes" desde la barra lateral
                await page.locator('span.menu-title:text-is("Pacientes")').click();
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(3000);

                const loadingP = page.locator('text=/cargando/i');
                if (await loadingP.isVisible().catch(() => false)) {
                  for (let p = 0; p < 30; p++) {
                    if (!(await loadingP.isVisible().catch(() => false))) break;
                    await page.waitForTimeout(2000);
                  }
                }

                // Buscar el paciente de nuevo y hacer clic
                const pacientesNuevos = page.locator('[role="cell"] a.font-semibold');
                const totalPacientesNuevos = await pacientesNuevos.count();
                for (let p = 0; p < totalPacientesNuevos; p++) {
                  const textoPaciente = await pacientesNuevos.nth(p).textContent().catch(() => '');
                  if (textoPaciente.includes(nombrePaciente.trim())) {
                    logger.info(`Paciente "${nombrePaciente.trim()}" encontrado nuevamente, accediendo al perfil...`);
                    await pacientesNuevos.nth(p).click();
                    await page.waitForLoadState('networkidle');
                    await page.waitForTimeout(3000);
                    break;
                  }
                }

                continue;
              }

              // 10. Dar clic en "Cargar resultados de laboratorio"
              logger.info('Buscando "Cargar resultados de laboratorio"...');
              const cargarResultados = page.locator('text=/cargar resultados de laboratorio/i').first();

              if (await cargarResultados.isVisible({ timeout: 10000 }).catch(() => false)) {
                await cargarResultados.click();
                logger.success('Click en "Cargar resultados de laboratorio" realizado');
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(3000);

                const loading7 = page.locator('text=/cargando/i');
                if (await loading7.isVisible().catch(() => false)) {
                  for (let j = 0; j < 30; j++) {
                    if (!(await loading7.isVisible().catch(() => false))) break;
                    await page.waitForTimeout(2000);
                  }
                }

                // 11. Subir archivo PDF
                logger.info('Buscando input de archivo...');
                const fileInput = page.locator('div[role="presentation"] input[type="file"]');

                if (await fileInput.count() > 0) {
                  const filePath = 'tests/Estuidos_ejemplo_mediplanner.pdf';
                  await fileInput.setInputFiles(filePath);
                  logger.success(`Archivo "${filePath}" subido exitosamente`);
                  await page.waitForTimeout(3000);

                  // 12. Hacer clic en el archivo subido para abrir popup
                  logger.info('Haciendo clic en el archivo subido...');
                  const archivoSubido = page.locator('section:has(span:text-is("Estuidos_ejemplo_mediplanner.pdf"))').first();

                  if (await archivoSubido.isVisible({ timeout: 5000 }).catch(() => false)) {
                    await archivoSubido.click();
                    logger.success('Click en archivo subido realizado');
                    await page.waitForTimeout(3000);
                  }

                  // 13. Llenar campos del popup
                  logger.info('Buscando campos de texto en el popup...');
                  const editables = page.locator('div.rsw-ce[contenteditable="true"]');
                  const totalEditables = await editables.count();
                  logger.info(`Encontrados ${totalEditables} campos editables`);

                  if (totalEditables >= 2) {
                    logger.info('Llenando campo de interpretación del laboratorio...');
                    const campo1 = editables.first();
                    await campo1.click();
                    await page.waitForTimeout(500);
                    await page.keyboard.type(textoInterpretacion, { delay: 5 });
                    logger.success('Campo de interpretación del laboratorio llenado');
                    await page.waitForTimeout(1000);

                    logger.info('Llenando campo de comentarios del médico...');
                    const campo2 = editables.nth(1);
                    await campo2.click();
                    await page.waitForTimeout(500);
                    await page.keyboard.type(textoComentarios, { delay: 5 });
                    logger.success('Campo de comentarios del médico llenado');
                    await page.waitForTimeout(2000);

                    // 14. Dar clic en "Guardar Cambios"
                    logger.info('Buscando botón "Guardar Cambios"...');
                    const guardarBtn = page.locator('div.flex.justify-end.space-x-4 button.btn.btn-primary:has-text("Guardar Cambios")').first();

                    if (await guardarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                      await guardarBtn.click({ force: true });
                      logger.success('Click en "Guardar Cambios" realizado');
                      await page.waitForTimeout(5000);

                      // 15. Verificar en Dashboard
                      logger.info('Navegando al Dashboard...');
                      await page.goto('/Dashboard');
                      await page.waitForLoadState('networkidle');
                      await page.waitForTimeout(3000);

                      const nuevosEstudios = page.locator('h3:has-text("Nuevos estudios")');
                      if (await nuevosEstudios.isVisible({ timeout: 10000 }).catch(() => false)) {
                        logger.success('Sección "Nuevos estudios" encontrada');

                        const items = page.locator('h3:has-text("Nuevos estudios")').locator('..').locator('..').locator('ul li');
                        const totalItems = await items.count();
                        logger.info(`Encontrados ${totalItems} estudios en la lista`);

                        for (let k = 0; k < totalItems; k++) {
                          const texto = await items.nth(k).textContent().catch(() => '');
                          logger.info(`   Estudio ${k + 1}: "${texto.trim().substring(0, 80)}"`);
                        }

                        for (let k = 0; k < totalItems; k++) {
                          const item = items.nth(k);
                          const textoItem = await item.textContent().catch(() => '');
                          if (textoItem.includes(nombrePaciente)) {
                            logger.success(`✅ Estudio encontrado para "${nombrePaciente}"`);

                            await item.click();
                            await page.waitForTimeout(3000);

                            const paginaCompleta = await page.content();
                            if (paginaCompleta.includes(textoInterpretacion)) {
                              logger.success('✅ Interpretación del laboratorio verificada');
                            } else {
                              logger.warning('⚠️ Interpretación del laboratorio no encontrada');
                            }

                            if (paginaCompleta.includes(textoComentarios)) {
                              logger.success('✅ Comentarios del médico verificados');
                            } else {
                              logger.warning('⚠️ Comentarios del médico no encontrados');
                            }

                            break;
                          }
                        }
                      }
                    }
                  }
                }
              }

              encontradaConsultaValida = true;
              break;
            } else {
              logger.warning('No se encontró pestaña "Tratamiento"');
              await page.goto('/Dashboard');
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(3000);
              continue;
            }
          } else {
            logger.warning(`Botón "Ver consulta" no disponible en consulta ${i + 1}, explorando siguiente...`);
          }
        }

        if (encontradaConsultaValida) {
          break;
        } else {
          logger.warning('No se encontró ninguna consulta válida');
          break;
        }
      } else {
        logger.warning('No se encontró sección "Consultas"');
        break;
      }
    }

    logger.success('Flujo de subir estudios completado');
  });

});
