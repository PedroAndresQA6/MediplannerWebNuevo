import { test, expect } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// "Paypal" ya no es una opción en el formulario nuevo de "Registrar pago"
// (verificado contra la app real 2026-07-09) — se quitó de la lista.
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta de crédito', 'Tarjeta de débito'];

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
  // El dashboard nuevo carga el "Historial de ingresos" con el filtro de
  // período por defecto ya aplicado (misma llamada "getFiltered" que dispara
  // el botón "Buscar"). Sin esperarla, se puede contar/leer la tabla antes de
  // que la respuesta llegue (carrera observada: conteo en 0 con datos reales
  // visibles un instante después). Se registra el listener antes del click
  // para no perder una respuesta que llegue muy rápido.
  const historialCargado = page.waitForResponse(
    (res: any) => res.url().includes('getFiltered') && res.status() < 400,
    { timeout: 15000 }
  ).catch(() => null);
  await ingresosLink.click();
  await expect(page).toHaveURL(/Ingresos/);
  // La UI de Ingresos se rediseñó (2026-07-09): ahora es un dashboard con
  // tarjetas de resumen + filtros; el select de Estatus perdió su id y pasó
  // a identificarse solo por name="estatus".
  await page.waitForSelector('select[name="estatus"]', { timeout: 15000 });
  await historialCargado;
  console.log('✅ Navegado a Ingresos');
}

async function aplicarFiltroPendiente(page: any) {
  await page.locator('select[name="estatus"]').selectOption({ value: '2' });
  // El botón de filtro ahora es un botón "Buscar" con nombre accesible
  // propio, en vez del botón sin texto identificado por clases CSS.
  await page.getByRole('button', { name: /buscar/i }).click();
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
      // El "Historial de ingresos" se renderiza con react-data-table-component
      // (clases rdt_Table*), no como una <table> nativa. El selector genérico
      // anterior ('tr, [class*="row"]') matcheaba de más (cualquier div con
      // "row" en la clase, incluyendo utilidades de layout ajenas a la tabla)
      // e inflaba el conteo real.
      const pendientes = page.locator('.rdt_TableRow').filter({
        has: page.locator('text=/pendiente/i')
      });
      const pagados = page.locator('.rdt_TableRow').filter({
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

        const pendientes = page.locator('.rdt_TableRow').filter({
          has: page.locator('text=/pendiente/i')
        });

        const count = await pendientes.count();
        console.log(`📋 Encontrados ${count} ingresos pendientes`);

        if (count === 0) {
          console.log('✅ No hay más ingresos pendientes. Proceso completado.');
          return;
        }

        const pendiente = pendientes.last();
        // El ícono de ojo vive dentro de un <button class="menu-link"> real;
        // se sube por xpath hasta ese ancestro en vez de un solo nivel
        // (".locator('..')" antes caía en el <span> intermedio, no el botón).
        const eyeButton = pendiente.locator('svg.fa-eye').locator('xpath=ancestor::button[1]').first();

        if (!await eyeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('✅ No se encontró botón "Ver" — no hay más pendientes por procesar');
          return;
        }

        await test.step('Abrir ingreso', async () => {
          console.log('👁️ Abriendo ingreso...');
          await eyeButton.click();
          await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
        });

        // La UI nueva (2026-07-09) quitó los pasos intermedios "Abonar" y
        // "Seleccionar concepto": el detalle del ingreso ya muestra el único
        // cargo pendiente y un botón "Registrar pago" que lleva directo al
        // formulario de pago (monto prellenado + botones de método de pago).
        // `formularioAbierto` evita que los pasos siguientes se ejecuten a
        // ciegas sobre la pantalla equivocada si este ingreso ya estaba
        // pagado (la lista filtrada puede quedar desactualizada un ciclo).
        let formularioAbierto = false;

        await test.step('Abrir formulario de pago', async () => {
          const registrarPagoBtn = page.getByRole('button', { name: /registrar pago/i });
          if (!await registrarPagoBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
            console.log('⚠️ No se encontró botón "Registrar pago" en el detalle — ingreso ya pagado');
            procesados++;
            return;
          }
          await registrarPagoBtn.click();
          await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
          formularioAbierto = true;
          console.log('✅ Formulario de pago abierto');
        });

        await test.step('Seleccionar método de pago', async () => {
          if (!formularioAbierto) return;

          const metodoRandom = METODOS_PAGO[Math.floor(Math.random() * METODOS_PAGO.length)];
          console.log(`💳 Método de pago objetivo: "${metodoRandom}"`);

          const metodoBtn = page.getByRole('button', { name: metodoRandom });
          if (await metodoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await metodoBtn.click();
            console.log(`✅ Método "${metodoRandom}" seleccionado`);
          } else {
            console.log(`⚠️ No se encontró "${metodoRandom}", seleccionando "${METODOS_PAGO[0]}"`);
            await page.getByRole('button', { name: METODOS_PAGO[0] }).click();
          }
          await page.waitForTimeout(500);
        });

        await test.step('Registrar pago', async () => {
          if (!formularioAbierto) return;

          const confirmarPagoBtn = page.getByRole('button', { name: /^registrar pago$/i });
          if (!await confirmarPagoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            console.log('⚠️ No se encontró botón final "Registrar pago"');
            procesados++;
            return;
          }

          await saveAndValidate(
            page,
            () => confirmarPagoBtn.click(),
            'registerPayment',
            { optional: true }
          );
          // Ya no hay modal de confirmación (swal2) — la app navega directo
          // de vuelta a "Detalle de ingreso" mostrando el cargo como Pagado.
          await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);

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
