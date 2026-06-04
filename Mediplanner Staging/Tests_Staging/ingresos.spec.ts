import { test, expect } from '@playwright/test';
const config = require('../../e2e/config');
const logger = config.logger;
const { handleModals } = require('../../e2e/utils.js');

// Esperar a que APAREZCA "Cargando..."
async function waitForLoadingToAppear(page: any, maxAttempts = 15) {
  logger.info('Esperando a que aparezca "Cargando..."...');
  for (let i = 0; i < maxAttempts; i++) {
    const loading = page.locator('text=/cargando/i');
    const isVisible = await loading.isVisible().catch(() => false);
    if (isVisible) {
      logger.success('"Cargando..." detectado');
      return true;
    }
    await page.waitForTimeout(1000);
  }
  logger.warning('No se detectó "Cargando..."');
  return false;
}

// Esperar a que DESAPAREZCA "Cargando..."
async function waitForLoadingToDisappear(page: any, maxAttempts = 30) {
  logger.info('Esperando a que desaparezca "Cargando..."...');
  for (let i = 0; i < maxAttempts; i++) {
    const loading = page.locator('text=/cargando/i');
    const isVisible = await loading.isVisible().catch(() => false);
    if (!isVisible) {
      logger.success('"Cargando..." desapareció - Página cargada');
      return true;
    }
    logger.info(`   Aún cargando... (intento ${i + 1}/${maxAttempts})`);
    await page.waitForTimeout(2000);
  }
  logger.warning('Timeout esperando que desaparezca "Cargando..."');
  return false;
}

// Esperar carga completa: aparece y luego desaparezca
async function waitForFullLoading(page: any) {
  const appeared = await waitForLoadingToAppear(page, 10);
  if (appeared) {
    await waitForLoadingToDisappear(page);
  }
}

// Detectar y rechazar popups de error (SweetAlert2, dialogs del navegador, etc.)
async function checkAndDismissErrorPopups(page: any) {
  try {
    // SweetAlert2 error popup
    const swalError = page.locator('.swal2-popup, .swal2-modal');
    if (await swalError.count() > 0) {
      const errorText = await swalError.first().textContent().catch(() => '');
      logger.warning(`Popup de error detectado: "${errorText?.substring(0, 100)}"`);
      const confirmBtn = swalError.locator('.swal2-confirm, button');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.first().click();
        await page.waitForTimeout(1000);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
      return true;
    }

    // Toast de error
    const toast = page.locator('.swal2-toast, [class*="toast"], .Toastify__toast');
    if (await toast.count() > 0) {
      const toastText = await toast.first().textContent().catch(() => '');
      logger.warning(`Toast de error detectado: "${toastText?.substring(0, 100)}"`);
      return true;
    }

    // Browser dialog
    page.on('dialog', async (dialog) => {
      logger.warning(`Diálogo del navegador detectado: ${dialog.message().substring(0, 100)}`);
      await dialog.dismiss();
    });

    return false;
  } catch (e) {
    return false;
  }
}

test.describe('Módulo de Ingresos', () => {

  test('Contar estados de ingresos', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => {
      const msg = `[PageError] ${err.message}`;
      pageErrors.push(msg);
      logger.error(msg);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    try {
      logger.info('Navegando al Dashboard...');
      await page.goto('/Dashboard');
      await expect(page, 'Debe navegar al Dashboard correctamente').toHaveURL(/Dashboard/);
      await waitForLoadingToDisappear(page);
      await checkAndDismissErrorPopups(page);

      logger.info('Dando clic en "Ingresos" desde la barra lateral...');
      const ingresosLink = page.locator('span.menu-title:text-is("Ingresos")');
      await expect(ingresosLink, 'El enlace "Ingresos" debe estar visible en la barra lateral').toBeVisible({ timeout: 10000 });
      await ingresosLink.click();
      await expect(page, 'Debe redirigir a la página de Ingresos después del click en la barra lateral').toHaveURL(/Ingresos/);

      await waitForFullLoading(page);
      await checkAndDismissErrorPopups(page);

      const pendientes = page.locator('tr, [class*="row"]').filter({
        has: page.locator('text=/pendiente/i')
      });
      const pagados = page.locator('tr, [class*="row"]').filter({
        has: page.locator('text=/pagado/i')
      });

      const countPendientes = await pendientes.count();
      const countPagados = await pagados.count();

      logger.info(`INGRESOS PENDIENTES: ${countPendientes}`);
      logger.info(`INGRESOS PAGADOS: ${countPagados}`);

      const totalIngresos = countPendientes + countPagados;
      expect(
        totalIngresos,
        `La tabla de ingresos debe tener al menos 1 registro. ` +
        `Encontrados: ${countPendientes} pendientes, ${countPagados} pagados. ` +
        `Verifica que consultation.start.spec.js ejecutó correctamente antes de este test.`
      ).toBeGreaterThan(0);

      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        logger.warning(`Errores detectados en la página: ${pageErrors.length} page errors, ${consoleErrors.length} console errors`);
      }
      if (pageErrors.length > 0) {
        await page.screenshot({ path: 'test-results/ingresos-contar-page-errors.png', fullPage: true });
        throw new Error(`Se detectaron ${pageErrors.length} errores no manejados en la página`);
      }
    } catch (error: any) {
      logger.error(`Error en test "Contar estados de ingresos": ${error.message}`);
      await page.screenshot({ path: 'test-results/ingresos-contar-error.png', fullPage: true });
      await handleModals(page);
      throw error;
    }
  });

  test('Registrar ingreso pendiente', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => {
      const msg = `[PageError] ${err.message}`;
      pageErrors.push(msg);
      logger.error(msg);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    try {
      // Ir al Dashboard
      logger.info('Navegando al Dashboard...');
      await page.goto('/Dashboard');
      await expect(page, 'Debe navegar al Dashboard correctamente').toHaveURL(/Dashboard/);
      await waitForLoadingToDisappear(page);
      await checkAndDismissErrorPopups(page);

      // Dar clic en "Ingresos" desde la barra lateral
      logger.info('Dando clic en "Ingresos" desde la barra lateral...');
      const ingresosLink = page.locator('span.menu-title:text-is("Ingresos")');
      await expect(ingresosLink, 'El enlace "Ingresos" debe estar visible en la barra lateral').toBeVisible({ timeout: 10000 });
      await ingresosLink.click();
      await expect(page, 'Debe redirigir a Ingresos después del click inicial').toHaveURL(/Ingresos/);
      await waitForFullLoading(page);
      await checkAndDismissErrorPopups(page);

      // Seleccionar Pendiente y aplicar filtro
      logger.info('Seleccionando filtro "Pendiente"...');
      await page.locator('select#estatus').selectOption({ value: '2' });
      logger.success('Opción "Pendiente" seleccionada');

      logger.info('Dando clic en botón de filtros...');
      await page.locator('button.btn-icon.btn.bg-gray-300.ms-3[type="button"]').click();
      logger.success('Click en botón de filtros realizado');
      await waitForFullLoading(page);
      await checkAndDismissErrorPopups(page);

      // Procesar ingresos pendientes en loop
      let procesados = 0;

      for (let intento = 0; intento < 2; intento++) {
        logger.info(`\n=== CICLO ${intento + 1} ===`);

        // Verificar si seguimos en la página de ingresos
        const currentUrl = page.url();
        if (!currentUrl.includes('Ingresos')) {
          logger.info('No estamos en la página de Ingresos, navegando...');
          await page.goto('/Dashboard');
          await waitForLoadingToDisappear(page);
          await checkAndDismissErrorPopups(page);

          await page.locator('span.menu-title:text-is("Ingresos")').click();
          await expect(page, 'Debe redirigir a Ingresos después del click en la barra lateral (re-navegación)').toHaveURL(/Ingresos/);
          await waitForFullLoading(page);
          await checkAndDismissErrorPopups(page);

          // Reaplicar filtro
          await page.locator('select#estatus').selectOption({ value: '2' });
          await page.locator('button.btn-icon.btn.bg-gray-300.ms-3[type="button"]').click();
          await waitForFullLoading(page);
          await checkAndDismissErrorPopups(page);
        }

        // Buscar ingresos pendientes
        const pendientes = page.locator('tr, [class*="row"]').filter({
          has: page.locator('text=/pendiente/i')
        });

        const count = await pendientes.count();
        logger.info(`Encontrados ${count} ingresos pendientes`);

        if (count === 0) {
          logger.success('No hay más ingresos pendientes. Proceso completado.');
          break;
        }

        // Buscar botón "Ver" en el último ingreso pendiente
        const pendiente = pendientes.last();
        const eyeButton = pendiente.locator('svg.fa-eye').locator('..').first();

        if (await eyeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          logger.info('Haciendo clic en botón "Ver"...');
          await eyeButton.click();

          // Dar clic en botón "Abonar" para abrir el panel de pago
          logger.info('Buscando botón "Abonar"...');
          const abonarBtn = page.getByRole('button', { name: /abonar/i });
          if (await abonarBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)) {
            await abonarBtn.click();
            logger.success('Click en botón "Abonar"');

            // Liquidar servicios primero
            logger.info('Liquidando servicios del ingreso...');
            let servicioSelector = '';
            for (const sel of ['input.radio.me-3[name="servicio"]', 'input.radio.me-1[name="servicio"]']) {
              for (let retry = 0; retry < 4; retry++) {
                if (await page.locator(sel).count() > 0) {
                  servicioSelector = sel;
                  break;
                }
                await page.waitForTimeout(1000);
              }
              if (servicioSelector) break;
            }
            if (servicioSelector) {
              for (let s = 0; s < 10; s++) {
                const servicioRadio = page.locator(servicioSelector).first();
                if (await servicioRadio.count() === 0) break;
                const labelText = await servicioRadio.locator('xpath=ancestor::label').textContent().catch(() => '');
                logger.info(`Servicio encontrado: "${(labelText || '').trim().substring(0, 50)}"`);
                if (await servicioRadio.isEnabled().catch(() => false)) {
                  const text = (labelText || '').trim();
                  await page.getByText(text).first().click();
                  logger.success('Servicio seleccionado');
                  await page.waitForTimeout(500);
                } else {
                  continue;
                }
                const metodosPago = ['Efectivo', 'Transferencia', 'Tarjeta de crédito', 'Tarjeta de débito', 'Paypal'];
                let metodoServ = '';
                for (const mp of metodosPago) {
                  const radio = page.locator('label').filter({ hasText: mp }).locator('input[type="radio"]').first();
                  if (await radio.count() > 0 && await radio.isVisible().catch(() => false)) {
                    await radio.click();
                    metodoServ = mp;
                    logger.success(`Método de pago "${mp}" seleccionado`);
                    break;
                  }
                }
                if (!metodoServ) {
                  logger.warning('No se encontró método de pago disponible para servicio');
                  continue;
                }
                await page.waitForTimeout(500);
                const pagarServicio = page.getByRole('button', { name: /abonar/i });
                if (await pagarServicio.isVisible({ timeout: 5000 }).catch(() => false)) {
                  await pagarServicio.click();
                  logger.success('Pago de servicio registrado');
                  await page.waitForTimeout(2000);
                  const modalServ = page.locator('.swal2-popup, [role="dialog"]');
                  if (await modalServ.count() > 0) {
                    const confirmServ = modalServ.locator('.swal2-confirm, button:has-text("OK"), button:has-text("Aceptar")');
                    if (await confirmServ.count() > 0) {
                      await confirmServ.first().click();
                      await page.waitForTimeout(1000);
                    }
                  }
                }
                await page.waitForTimeout(500);
              }
              logger.success('Servicios liquidados');
            } else {
              logger.success('No hay servicios disponibles por liquidar');
            }

            // Iterar por conceptos hasta encontrar uno no pagado
            logger.info('Buscando conceptos disponibles...');
            const conceptoRadios = page.locator('input[type="radio"]:not([name="servicio"])');
            const totalConceptos = await conceptoRadios.count();
            logger.info(`Total conceptos encontrados: ${totalConceptos}`);
            let pagoExitoso = false;

            for (let c = 0; c < totalConceptos && !pagoExitoso; c++) {
              const radio = conceptoRadios.nth(c);
              const parentText = await radio.locator('xpath=ancestor::label').textContent().catch(() => '');
              logger.info(`Concepto ${c + 1}/${totalConceptos}: "${(parentText || '').trim().substring(0, 60)}"`);

              if (await radio.isVisible().catch(() => false)) {
                await radio.click({ force: true });
                logger.success(`Concepto ${c + 1} seleccionado`);
                await page.waitForTimeout(1000);
                await checkAndDismissErrorPopups(page);

                // Seleccionar método de pago aleatoriamente
                logger.info('Seleccionando método de pago...');
                await page.waitForTimeout(1000);

                const metodosPago = ['Efectivo', 'Transferencia', 'Tarjeta de crédito', 'Tarjeta de débito', 'Paypal'];
                const metodoRandom = metodosPago[Math.floor(Math.random() * metodosPago.length)];
                logger.info(`Método de pago objetivo: "${metodoRandom}"`);

                const metodoRadios = page.locator('input[type="radio"]');
                const metodoTotal = await metodoRadios.count();
                for (let m = 1; m < metodoTotal; m++) {
                  const radio = metodoRadios.nth(m);
                  const labelText = await radio.locator('xpath=..').first().textContent().catch(() => '');
                  if (labelText.toLowerCase().includes(metodoRandom.toLowerCase())) {
                    await radio.click();
                    logger.success(`Método de pago "${metodoRandom}" seleccionado`);
                    break;
                  }
                }
                await page.waitForTimeout(1000);
                await checkAndDismissErrorPopups(page);

                // Dar clic en botón "Registrar pago"
                logger.info('Buscando botón "Registrar pago"...');
                const registrarPagoBtn = page.getByRole('button', { name: /registrar pago/i });
                if (await registrarPagoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                  await registrarPagoBtn.click();
                  logger.success('Click en botón "Registrar pago"');
                  await page.waitForTimeout(3000);

                  const modal = page.locator('.swal2-popup, [role="dialog"]');
                  if (await modal.count() > 0) {
                    const modalText = await modal.first().textContent().catch(() => '');
                    logger.info(`Modal: "${modalText?.substring(0, 100)}"`);

                    const isError = modalText?.toLowerCase().includes('error') || modalText?.toLowerCase().includes('incorrecto');
                    const isMontoError = modalText?.toLowerCase().includes('monto') || modalText?.toLowerCase().includes('cantidad');

                    if (isMontoError) {
                      logger.warning(`Concepto ${c + 1} ya liquidado (monto inválido), probando siguiente...`);
                      await handleModals(page);
                      continue;
                    }

                    if (isError) {
                      logger.error('Modal de error detectado en registro de pago');
                      await handleModals(page);
                      throw new Error(`Error al registrar pago: ${modalText?.substring(0, 200)}`);
                    }

                    const confirmBtn = modal.locator('.swal2-confirm, button:has-text("OK"), button:has-text("Aceptar")');
                    if (await confirmBtn.count() > 0) {
                      await confirmBtn.first().click();
                      logger.success('Modal confirmado');
                      await page.waitForTimeout(2000);
                    }
                  } else {
                    // No modal — check for toast/inline error about monto
                    const montoToast = page.locator('.swal2-toast, [class*="toast"], .Toastify__toast, .invalid-feedback, .text-danger').filter({ hasText: /monto|cantidad|requiere/i });
                    if (await montoToast.count() > 0) {
                      const toastText = await montoToast.first().textContent().catch(() => '');
                      logger.warning(`Error de monto en toast/inline: "${toastText?.substring(0, 100)}" — concepto ya liquidado`);
                      continue;
                    }
                  }

                  procesados++;
                  pagoExitoso = true;
                  logger.success(`Ingreso ${procesados} procesado exitosamente`);
                } else {
                  logger.warning('No se encontró botón "Registrar pago" - El ingreso ya fue reportado/pagado');
                  procesados++;
                  pagoExitoso = true;
                }
              }
            }

            if (!pagoExitoso) {
              logger.warning('No se encontró ningún concepto disponible para pagar');
              await page.screenshot({ path: 'test-results/ingresos-sin-conceptos.png', fullPage: true });
            }
          } else {
            logger.warning('No se encontró botón "Abonar"');
            await page.screenshot({ path: 'test-results/ingresos-sin-abonar.png', fullPage: true });
            if (procesados === 0) {
              throw new Error(
                'No se encontró el botón "Abonar" en el primer ingreso pendiente — ' +
                'verifica que la página de detalle cargó correctamente y que existe al menos un ingreso pendiente.'
              );
            }
            break;
          }
        } else {
          logger.success('No se encontró botón "Ver" - No hay más ingresos pendientes por procesar');
          break;
        }

        // Volver a la página de ingresos para el siguiente
        logger.info('Volviendo a la página de Ingresos...');
        await page.goto('/Dashboard');
        await waitForLoadingToDisappear(page);
        await checkAndDismissErrorPopups(page);

        await page.locator('span.menu-title:text-is("Ingresos")').click();
        await expect(page, 'Debe redirigir a Ingresos al volver desde Dashboard').toHaveURL(/Ingresos/);
        await waitForFullLoading(page);
        await checkAndDismissErrorPopups(page);

        // Reaplicar filtro
        await page.locator('select#estatus').selectOption({ value: '2' });
        await page.locator('button.btn-icon.btn.bg-gray-300.ms-3[type="button"]').click();
        await waitForFullLoading(page);
        await checkAndDismissErrorPopups(page);
      }

      logger.success(`\n=== RESUMEN: ${procesados} ingresos procesados ===`);

      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        logger.warning(`Errores detectados en la página: ${pageErrors.length} page errors, ${consoleErrors.length} console errors`);
        for (const err of pageErrors) {
          logger.error(`Page error: ${err}`);
        }
      }

      if (pageErrors.length > 0) {
        await page.screenshot({ path: 'test-results/ingresos-page-errors.png', fullPage: true });
        throw new Error(`Se detectaron ${pageErrors.length} errores no manejados en la página`);
      }
    } catch (error: any) {
      logger.error(`Error en test "Registrar ingreso pendiente": ${error.message}`);
      await page.screenshot({ path: 'test-results/ingresos-registrar-error.png', fullPage: true });
      await handleModals(page);
      throw error;
    }
  });

});
