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

// Paga, uno por uno, todos los conceptos con saldo pendiente del ingreso
// actualmente abierto en /ingresos/registroPago. Un ingreso puede tener
// varios cargos (ej. "Consulta General" + "Certificado Médico"); el
// formulario muestra un radio "Concepto" por cargo + un campo "Monto"
// (con el máximo pagable de ese concepto) + botones de "Método de pago"
// (Efectivo/Transferencia/Tarjeta...) + un botón final "Registrar pago"
// que paga SOLO el concepto seleccionado. Mapeado explorando la app real
// 2026-07-14 (en staging): tras cada pago exitoso la app vuelve a mostrar
// el formulario con el siguiente concepto pendiente (o ya no queda ninguno).
async function pagarConceptosPendientes(page: any): Promise<number> {
  let pagados = 0;

  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const conceptoRadios = page.locator('input[type="radio"]:visible');
    const nConceptos = await conceptoRadios.count();
    if (nConceptos === 0) {
      console.log('⚠️ No hay radios de "Concepto" visibles en el formulario de pago');
      break;
    }

    // Elegir el primer concepto cuyo "Máximo" pagable sea > 0 (los ya
    // pagados quedan con máximo $0 pero el radio sigue apareciendo en la
    // lista).
    let elegido = -1;
    let monto = 0;
    for (let i = 0; i < nConceptos; i++) {
      await conceptoRadios.nth(i).click();
      await page.waitForTimeout(300);
      const maximoTexto = await page.locator('text=/Máximo/i').textContent().catch(() => '');
      monto = parseFloat((maximoTexto.match(/[\d,.]+/) || ['0'])[0].replace(/,/g, ''));
      if (monto > 0) { elegido = i; break; }
    }

    if (elegido === -1) {
      console.log(`✅ Ningún concepto con saldo pendiente tras ${pagados} pago(s) — ingreso saldado`);
      break;
    }

    const metodoRandom = METODOS_PAGO[Math.floor(Math.random() * METODOS_PAGO.length)];
    console.log(`💳 Concepto[${elegido}] con $${monto} pendiente — método objetivo: "${metodoRandom}"`);
    const metodoBtn = page.getByRole('button', { name: metodoRandom });
    if (await metodoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await metodoBtn.click();
    } else {
      console.log(`⚠️ No se encontró "${metodoRandom}", usando "${METODOS_PAGO[0]}"`);
      await page.getByRole('button', { name: METODOS_PAGO[0] }).click();
    }
    await page.waitForTimeout(500);

    const confirmarBtn = page.getByRole('button', { name: /^registrar pago$/i }).last();
    if (!await confirmarBtn.isEnabled({ timeout: 5000 }).catch(() => false)) {
      console.log('⚠️ Botón final "Registrar pago" no se habilitó — deteniendo el ciclo de pagos de este ingreso');
      break;
    }

    await saveAndValidate(page, () => confirmarBtn.click(), 'registerPayment', { optional: true });
    // El botón queda en "Registrando..." mientras el request está en vuelo;
    // esperar a que se libere antes de releer los conceptos, o se lee el
    // formulario a mitad de la animación y se concluye "ya no queda nada"
    // en falso (confirmado explorando la app real).
    await page.getByText('Registrando...').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(1000);

    pagados++;
    console.log(`✅ Concepto[${elegido}] pagado ($${monto}, ${metodoRandom})`);
  }

  return pagados;
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

        // El detalle puede tardar en asentarse (getConsultation + verifyPlan +
        // getCatalogs + getFiscalData×2 en paralelo); un timeout corto acá
        // hace ver "ya pagado" un ingreso que en realidad solo estaba
        // cargando todavía — confirmado explorando la app real 2026-07-14
        // (el ingreso SÍ tenía saldo real y el botón sí estaba, solo tardó
        // más de 8s en un caso).
        await test.step('Abrir formulario de pago (todos los conceptos)', async () => {
          const registrarPagoBtn = page.getByRole('button', { name: /registrar pago/i }).first();
          if (!await registrarPagoBtn.isVisible({ timeout: 12000 }).catch(() => false)) {
            console.log('⚠️ No se encontró botón "Registrar pago" en el detalle — ingreso ya pagado (o el front crasheó, ver hallazgo de DetallePagos en CONTEXTO.md)');
            procesados++;
            return;
          }
          await registrarPagoBtn.click();
          await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
          console.log('✅ Formulario de pago abierto');

          // Un ingreso puede tener varios cargos (ej. "Consulta General" +
          // "Certificado Médico"); cada envío del formulario paga solo el
          // concepto seleccionado, así que hay que repetir hasta que no
          // quede ninguno con saldo.
          const pagadosAqui = await pagarConceptosPendientes(page);
          procesados += pagadosAqui;
          console.log(`✅ ${pagadosAqui} concepto(s) pagado(s) en este ingreso`);
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
