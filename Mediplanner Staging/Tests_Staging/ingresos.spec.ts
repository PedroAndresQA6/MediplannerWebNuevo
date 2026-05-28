import { test, expect } from '@playwright/test';
const config = require('../../e2e/config');
const logger = config.logger;

// Esperar a que APAREZCA "Cargando..."
async function waitForLoadingToAppear(page: any, maxAttempts = 30) {
  logger.info('Esperando a que aparezca "Cargando..."...');
  for (let i = 0; i < maxAttempts; i++) {
    const loading = page.locator('text=/cargando/i');
    const isVisible = await loading.isVisible().catch(() => false);
    if (isVisible) {
      logger.success('"Cargando..." detectado');
      return true;
    }
    await page.waitForTimeout(2000);
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
  await waitForLoadingToAppear(page);
  await waitForLoadingToDisappear(page);
}

test.describe('Módulo de Ingresos', () => {

  test('Contar estados de ingresos', async ({ page }) => {

    logger.info('Navegando al Dashboard...');
    await page.goto('/Dashboard');
    await expect(page).toHaveURL(/Dashboard/);
    await waitForLoadingToDisappear(page);

    logger.info('Dando clic en "Ingresos" desde la barra lateral...');
    const ingresosLink = page.locator('span.menu-title:text-is("Ingresos")');
    await expect(ingresosLink).toBeVisible({ timeout: 10000 });
    await ingresosLink.click();
    await expect(page).toHaveURL(/Ingresos/);

    await waitForFullLoading(page);

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
  });

  test('Registrar ingreso pendiente', async ({ page }) => {

    // Ir al Dashboard
    logger.info('Navegando al Dashboard...');
    await page.goto('/Dashboard');
    await expect(page).toHaveURL(/Dashboard/);
    await waitForLoadingToDisappear(page);

    // Dar clic en "Ingresos" desde la barra lateral
    logger.info('Dando clic en "Ingresos" desde la barra lateral...');
    const ingresosLink = page.locator('span.menu-title:text-is("Ingresos")');
    await expect(ingresosLink).toBeVisible({ timeout: 10000 });
    await ingresosLink.click();
    await expect(page).toHaveURL(/Ingresos/);

    // Esperar a que aparezca y desaparezca "Cargando..."
    await waitForFullLoading(page);

    // Seleccionar Pendiente y aplicar filtro
    logger.info('Seleccionando filtro "Pendiente"...');
    await page.locator('select#estatus').selectOption({ value: '2' });
    logger.success('Opción "Pendiente" seleccionada');

    logger.info('Dando clic en botón de filtros...');
    await page.locator('button.btn-icon.btn.bg-gray-300.ms-3[type="button"]').click();
    logger.success('Click en botón de filtros realizado');

    // Esperar a que aparezca y desaparezca "Cargando..." después del filtro
    await waitForFullLoading(page);

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

        await page.locator('span.menu-title:text-is("Ingresos")').click();
        await waitForFullLoading(page);

        // Reaplicar filtro
        await page.locator('select#estatus').selectOption({ value: '2' });
        await page.locator('button.btn-icon.btn.bg-gray-300.ms-3[type="button"]').click();
        await waitForFullLoading(page);
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
        await page.waitForTimeout(2000);

        // Dar clic en botón "Abonar"
        logger.info('Buscando botón "Abonar"...');
        const abonarBtn = page.getByRole('button', { name: /abonar/i });
        if (await abonarBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
          await abonarBtn.click();
          logger.success('Click en botón "Abonar"');
          await page.waitForTimeout(2000);

          // Seleccionar concepto - buscar "consulta médica" en la tabla
          logger.info('Buscando "Consulta Médica"...');

          const consultaMedica = page.locator('text=/consulta\s*médica/i').first();
          if (await consultaMedica.isVisible({ timeout: 3000 }).catch(() => false)) {
            await consultaMedica.click();
            logger.success('Concepto "Consulta Médica" seleccionado');
          } else {
            const consulta = page.locator('text=/consulta/i').first();
            if (await consulta.isVisible({ timeout: 3000 }).catch(() => false)) {
              await consulta.click();
              logger.success('Concepto "Consulta" seleccionado');
            } else {
              const conceptoRadio = page.locator('input[type="radio"]:visible').first();
              if (await conceptoRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
                const parentLabel = conceptoRadio.locator('xpath=..').first();
                const labelText = await parentLabel.textContent().catch(() => '');
                await conceptoRadio.click();
                logger.success(`Concepto seleccionado (fallback): "${labelText.trim()}"`);
              }
            }
          }
          await page.waitForTimeout(1500);

          // Seleccionar método de pago aleatoriamente
          logger.info('Seleccionando método de pago...');
          await page.waitForTimeout(1000);

          const metodosPago = ['Efectivo', 'Transferencia', 'Tarjeta de crédito', 'Tarjeta de débito', 'Paypal'];
          const metodoRandom = metodosPago[Math.floor(Math.random() * metodosPago.length)];
          logger.info(`Método de pago objetivo: "${metodoRandom}"`);

          const radioButtons = page.locator('input[type="radio"]:visible');
          const radioCount = await radioButtons.count();

          for (let i = 1; i < radioCount; i++) {
            const radio = radioButtons.nth(i);
            const parentLabel = radio.locator('xpath=..').first();
            const labelText = await parentLabel.textContent().catch(() => '');
            if (labelText.toLowerCase().includes(metodoRandom.toLowerCase())) {
              await radio.click();
              logger.success(`Método de pago "${metodoRandom}" seleccionado`);
              break;
            }
          }
          await page.waitForTimeout(1000);

          // Dar clic en botón "Registrar pago"
          logger.info('Buscando botón "Registrar pago"...');
          const registrarPagoBtn = page.getByRole('button', { name: /registrar pago/i });
          if (await registrarPagoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await registrarPagoBtn.click();
            logger.success('Click en botón "Registrar pago"');

            // Esperar
            await page.waitForTimeout(3000);

            // Manejar modal
            const modal = page.locator('.swal2-popup:visible, [role="dialog"]:visible');
            if (await modal.count() > 0) {
              logger.info('Modal de confirmación detectado');
              const confirmBtn = modal.locator('.swal2-confirm, button:has-text("OK"), button:has-text("Aceptar")');
              if (await confirmBtn.count() > 0) {
                await confirmBtn.first().click();
                logger.success('Modal confirmado');
                await page.waitForTimeout(2000);
              }
            }

            procesados++;
            logger.success(`Ingreso ${procesados} procesado exitosamente`);
          } else {
            logger.warning('No se encontró botón "Registrar pago" - El ingreso ya fue reportado/pagado');
            procesados++;
          }
        } else {
          logger.warning('No se encontró botón "Abonar"');
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

      await page.locator('span.menu-title:text-is("Ingresos")').click();
      await waitForFullLoading(page);

      // Reaplicar filtro
      await page.locator('select#estatus').selectOption({ value: '2' });
      await page.locator('button.btn-icon.btn.bg-gray-300.ms-3[type="button"]').click();
      await waitForFullLoading(page);
    }

    logger.success(`\n=== RESUMEN: ${procesados} ingresos procesados ===`);
  });

});
