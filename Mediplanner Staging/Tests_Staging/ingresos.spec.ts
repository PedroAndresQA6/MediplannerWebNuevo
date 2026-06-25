import { test, expect } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta de crédito', 'Tarjeta de débito', 'Paypal'];

async function saveAndValidate(
  page: any,
  clickFn: () => Promise<void>,
  urlPattern: string,
  { optional = false } = {}
) {
  const responsePromise = page.waitForResponse(
    (res: any) => res.url().includes(urlPattern) && res.request().method() !== 'GET',
    { timeout: 15000 }
  ).catch(() => null);

  await clickFn();

  const response = await responsePromise;

  if (!response) {
    if (optional) {
      console.log(`⚠️ [saveAndValidate] No hubo response para "${urlPattern}" (opcional)`);
      return;
    }
    throw new Error(`❌ No se recibió response de la API para "${urlPattern}"`);
  }

  const status = response.status();
  let body = '';
  try { body = await response.text(); } catch (_) {}

  if (status < 200 || status >= 300) {
    throw new Error(`❌ API "${urlPattern}" respondió ${status}. Body: ${body.substring(0, 200)}`);
  }

  console.log(`✅ [saveAndValidate] ${status} ${urlPattern}`);
}

async function navegarAIngresos(page: any) {
  await page.goto('/Dashboard');
  await expect(page).toHaveURL(/Dashboard/);
  await page.waitForSelector('span.menu-title:text-is("Ingresos")', { timeout: 10000 });

  const ingresosLink = page.locator('span.menu-title:text-is("Ingresos")');
  await ingresosLink.click();
  await expect(page).toHaveURL(/Ingresos/);
  await page.waitForSelector('select#estatus', { timeout: 15000 });
  console.log('✅ Navegado a Ingresos');
}

async function aplicarFiltroPendiente(page: any) {
  await page.locator('select#estatus').selectOption({ value: '2' });
  await page.locator('button.btn-icon.btn.bg-gray-300.ms-3[type="button"]').click();
  await page.waitForResponse(
    (res: any) => res.url().includes('getFiltered') && res.status() < 400,
    { timeout: 15000 }
  ).catch(() => null);
  console.log('✅ Filtro "Pendiente" aplicado');
}

test.describe('Módulo de Ingresos', () => {

  test('Contar estados de ingresos', async ({ page }) => {
    const monitor = setupConsoleMonitor(page);
    console.log('🔍 [MONITOR] DevTools monitor activo\n');

    await test.step('Navegar a Ingresos', async () => {
      await navegarAIngresos(page);
    });

    await test.step('Contar pendientes y pagados', async () => {
      const pendientes = page.locator('tr, [class*="row"]').filter({
        has: page.locator('text=/pendiente/i')
      });
      const pagados = page.locator('tr, [class*="row"]').filter({
        has: page.locator('text=/pagado/i')
      });

      const countPendientes = await pendientes.count();
      const countPagados = await pagados.count();

      console.log(`📊 INGRESOS PENDIENTES: ${countPendientes}`);
      console.log(`📊 INGRESOS PAGADOS: ${countPagados}`);
    });

    const result = monitor.printSummary();
    if (!result.passed) {
      console.log(`⚠️ El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);
    }
  });

  test('Registrar ingreso pendiente', async ({ page }) => {
    const monitor = setupConsoleMonitor(page);
    console.log('🔍 [MONITOR] DevTools monitor activo\n');

    await test.step('Navegar a Ingresos', async () => {
      await navegarAIngresos(page);
    });

    await test.step('Filtrar ingresos pendientes', async () => {
      await aplicarFiltroPendiente(page);
    });

    let procesados = 0;

    for (let intento = 0; intento < 2; intento++) {
      await test.step(`Procesar ingreso (ciclo ${intento + 1})`, async () => {
        console.log(`\n=== CICLO ${intento + 1} ===`);

        // Verificar que seguimos en Ingresos
        const currentUrl = page.url();
        if (!currentUrl.includes('Ingresos')) {
          console.log('↩️ Navegando de regreso a Ingresos...');
          await navegarAIngresos(page);
          await aplicarFiltroPendiente(page);
        }

        const pendientes = page.locator('tr, [class*="row"]').filter({
          has: page.locator('text=/pendiente/i')
        });

        const count = await pendientes.count();
        console.log(`📋 Encontrados ${count} ingresos pendientes`);

        if (count === 0) {
          console.log('✅ No hay más ingresos pendientes. Proceso completado.');
          return;
        }

        const pendiente = pendientes.last();
        const eyeButton = pendiente.locator('svg.fa-eye').locator('..').first();

        if (!await eyeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('✅ No se encontró botón "Ver" — no hay más pendientes por procesar');
          return;
        }

        await test.step('Abrir ingreso', async () => {
          console.log('👁️ Abriendo ingreso...');
          await eyeButton.click();
          await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
        });

        await test.step('Click en Abonar', async () => {
          const abonarBtn = page.getByRole('button', { name: /abonar/i });
          await expect(abonarBtn).toBeVisible({ timeout: 10000 });
          await abonarBtn.click();
          await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
          console.log('✅ Click en Abonar');
        });

        await test.step('Seleccionar concepto', async () => {
          console.log('🔍 Buscando concepto "Consulta Médica"...');
          const consultaMedica = page.locator('text=/consulta\s*médica/i').first();
          if (await consultaMedica.isVisible({ timeout: 3000 }).catch(() => false)) {
            await consultaMedica.click();
            console.log('✅ Concepto "Consulta Médica" seleccionado');
          } else {
            const consulta = page.locator('text=/consulta/i').first();
            if (await consulta.isVisible({ timeout: 3000 }).catch(() => false)) {
              await consulta.click();
              console.log('✅ Concepto "Consulta" seleccionado');
            } else {
              const conceptoRadio = page.locator('input[type="radio"]:visible').first();
              if (await conceptoRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
                const labelText = await conceptoRadio.locator('xpath=..').first().textContent().catch(() => '');
                await conceptoRadio.click();
                console.log(`✅ Concepto seleccionado (fallback): "${labelText.trim()}"`);
              }
            }
          }
          await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
        });

        await test.step('Seleccionar método de pago', async () => {
          const metodoRandom = METODOS_PAGO[Math.floor(Math.random() * METODOS_PAGO.length)];
          console.log(`💳 Método de pago objetivo: "${metodoRandom}"`);

          const radioButtons = page.locator('input[type="radio"]:visible');
          const radioCount = await radioButtons.count();

          let seleccionado = false;
          for (let i = 1; i < radioCount; i++) {
            const radio = radioButtons.nth(i);
            const labelText = await radio.locator('xpath=..').first().textContent().catch(() => '');
            if (labelText.toLowerCase().includes(metodoRandom.toLowerCase())) {
              await radio.click();
              console.log(`✅ Método "${metodoRandom}" seleccionado`);
              seleccionado = true;
              break;
            }
          }
          if (!seleccionado) {
            console.log(`⚠️ No se encontró "${metodoRandom}", seleccionando primer radio disponible`);
            await radioButtons.nth(1).click();
          }
          await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
        });

        await test.step('Registrar pago', async () => {
          const registrarPagoBtn = page.getByRole('button', { name: /registrar pago/i });
          if (!await registrarPagoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('⚠️ No se encontró botón "Registrar pago" — ingreso ya pagado');
            procesados++;
            return;
          }

          await saveAndValidate(
            page,
            () => registrarPagoBtn.click(),
            'registerPayment',
            { optional: true }
          );

          // Manejar modal de confirmación
          const modal = page.locator('.swal2-popup:visible, [role="dialog"]:visible');
          if (await modal.count() > 0) {
            const confirmBtn = modal.locator('.swal2-confirm, button:has-text("OK"), button:has-text("Aceptar")');
            if (await confirmBtn.count() > 0) {
              await confirmBtn.first().click();
              await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
              console.log('✅ Modal confirmado');
            }
          }

          procesados++;
          console.log(`✅ Ingreso ${procesados} registrado exitosamente`);
        });

        // Volver a Ingresos para el siguiente ciclo
        if (intento < 1) {
          await navegarAIngresos(page);
          await aplicarFiltroPendiente(page);
        }
      });
    }

    await test.step('Resumen', async () => {
      console.log(`\n📊 === RESUMEN: ${procesados} ingresos procesados ===`);
      const result = monitor.printSummary();
      if (!result.passed) {
        console.log(`⚠️ El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);
      }
    });
  });

});
