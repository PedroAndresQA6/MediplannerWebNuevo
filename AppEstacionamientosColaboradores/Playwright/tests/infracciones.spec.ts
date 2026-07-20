import { test, expect } from '@playwright/test';
import { InfraccionesPage, MOTIVOS } from '../pages/InfraccionesPage';

// Adaptación del módulo 10 (Reporte/Infracción) del checklist de operador al
// formulario web "Registrar infracción" (/index.php/infracciones/nueva) --
// el equivalente más directo encontrado en el portal (mismo catálogo de 7
// motivos que la app móvil). Usa una placa distintiva (TESTWEBQA) para no
// mezclarse con datos reales, mismo criterio que TEST-XXX en la suite Appium.
const PLACA_TEST = 'TESTWEBQA';

test('10.1: catálogo de motivos coincide con el de la app móvil (7 opciones)', async ({ page }) => {
  const infracciones = new InfraccionesPage(page);
  await infracciones.ir();
  await infracciones.irANuevaInfraccion();
  await infracciones.assertFormularioCargado();

  const opciones = await infracciones.selectMotivo.locator('option').allTextContents();
  const limpias = opciones.map(o => o.trim()).filter(Boolean).filter(o => o !== '— Selecciona —');
  expect(limpias).toEqual(MOTIVOS);
});

test('extra: motivo "Placa no coincide" revela el campo condicional "Placa correcta"', async ({ page }) => {
  // No es un caso del checklist original -- hallazgo real de recon (el
  // <select name="motivo"> trae `data-placa` listando qué motivos requieren
  // el campo extra). Vale la pena cubrirlo porque es lógica condicional real.
  const infracciones = new InfraccionesPage(page);
  await infracciones.ir();
  await infracciones.irANuevaInfraccion();
  await infracciones.assertFormularioCargado();

  await expect(infracciones.boxPlacaCorrecta).toBeHidden();
  await infracciones.selectMotivo.selectOption('placa_no_coincide');
  await expect(infracciones.boxPlacaCorrecta).toBeVisible({ timeout: 5000 });
  await expect(infracciones.campoPlacaCorrecta).toBeVisible();

  await infracciones.selectMotivo.selectOption('otro');
  await expect(infracciones.boxPlacaCorrecta).toBeHidden({ timeout: 5000 });
});

test('10.6: envío exitoso sin evidencia fotográfica registra la infracción', async ({ page }) => {
  // Hallazgo (2026-07-17): a diferencia de la app móvil (10.2/10.3, exige
  // mínimo 1 foto para habilitar "Enviar"), el formulario web NO marca
  // `evidencia` como `required` -- se confirma acá que el envío SÍ se
  // completa sin adjuntar ninguna foto. Ver HALLAZGOS.md.
  const infracciones = new InfraccionesPage(page);
  await infracciones.ir();
  await infracciones.irANuevaInfraccion();
  await infracciones.llenar({ cajonLabel: undefined, placa: PLACA_TEST, motivoValue: 'otro' });
  await infracciones.selectCajon.selectOption({ index: 1 });

  await infracciones.botonRegistrar.click();
  await page.waitForLoadState('domcontentloaded');

  await expect(page).toHaveURL(/infracciones$/);
  await expect(page.getByText('Infracción registrada.')).toBeVisible({ timeout: 10000 });
  // La fila nueva debe aparecer arriba de la tabla con la placa de prueba.
  await expect(page.locator('td, tr', { hasText: PLACA_TEST }).first()).toBeVisible();
});

test('10.7: un segundo reporte sobre el mismo cajón/placa NO muestra aviso de reporte previo (comportamiento real)', async ({ page }) => {
  // Checklist esperaba "Aviso de reporte previo en la ocupación" (mismo
  // criterio que 10.7 de la app móvil). Recon confirmó que el portal permite
  // registrar la MISMA placa en el MISMO cajón dos veces seguidas sin ningún
  // aviso -- ambos envíos muestran el mismo mensaje genérico "Infracción
  // registrada.", creando dos filas separadas en la tabla. Este test valida
  // el comportamiento REAL (silencioso), no el esperado por el checklist.
  const infracciones = new InfraccionesPage(page);

  await infracciones.ir();
  await infracciones.irANuevaInfraccion();
  await infracciones.selectCajon.selectOption({ index: 1 });
  const cajonElegido = await infracciones.selectCajon.inputValue();
  await infracciones.campoPlaca.fill(PLACA_TEST);
  await infracciones.selectMotivo.selectOption('otro');
  await infracciones.botonRegistrar.click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Infracción registrada.')).toBeVisible({ timeout: 10000 });

  await infracciones.irANuevaInfraccion();
  await infracciones.selectCajon.selectOption(cajonElegido);
  await infracciones.campoPlaca.fill(PLACA_TEST);
  await infracciones.selectMotivo.selectOption('otro');

  // Comportamiento real: NINGÚN aviso de reporte previo antes de enviar.
  await expect(page.getByText(/ya tiene un reporte|reporte previo/i)).not.toBeVisible({ timeout: 2000 });

  await infracciones.botonRegistrar.click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Infracción registrada.')).toBeVisible({ timeout: 10000 });
});

test('10.8/10.9: "Levantar falta" prellena cajón/placa pero NO preselecciona el motivo (comportamiento real)', async ({ page }) => {
  // Checklist esperaba un motivo preseleccionado según el contexto (p.ej.
  // "Fuera de tiempo" al venir de un vehículo vencido). Recon confirmó que
  // "Levantar falta" (desde "Vehículos fuera de tiempo") prellena cajón y
  // placa vía query params (cajon_id/registro_uso_id/placa) pero el select
  // de Motivo queda en "— Selecciona —" -- sin preselección. Documentado
  // como hallazgo real, no se asume el comportamiento ideal del checklist.
  const infracciones = new InfraccionesPage(page);
  await infracciones.ir();

  const filas = infracciones.filasFueraDeTiempo;
  const hay = await filas.count();
  test.skip(hay === 0, 'No hay vehículos "fuera de tiempo" pendientes en este momento para probar Levantar falta');

  await filas.first().click();
  await page.waitForLoadState('domcontentloaded');
  await infracciones.assertFormularioCargado();

  // Cajón y placa SÍ deben venir prellenados desde el contexto.
  await expect(infracciones.selectCajon).not.toHaveValue('');
  await expect(infracciones.campoPlaca).not.toHaveValue('');

  // Motivo NO viene preseleccionado (hallazgo real).
  await expect(infracciones.selectMotivo).toHaveValue('');
});

test('10.10: envío sin red cae en el error nativo del navegador y pierde los datos (comportamiento real)', async ({ page, context }) => {
  // Checklist esperaba "Toast error de conexión" (mismo criterio que 10.10
  // de la app móvil, que sí maneja el caso con un mensaje y conserva el
  // formulario). Recon confirmó que ACÁ es un <form method="post"> clásico
  // (no fetch/AJAX) -- sin red, el navegador intenta la navegación completa
  // y termina en su propia página de error ("chrome-error://chromewebdata/"),
  // perdiendo todos los datos ya ingresados. Es un comportamiento más pobre
  // que el de la app móvil: no hay manejo propio del error de red en este
  // formulario. Ver HALLAZGOS.md.
  const infracciones = new InfraccionesPage(page);
  await infracciones.ir();
  await infracciones.irANuevaInfraccion();
  await infracciones.selectCajon.selectOption({ index: 1 });
  await infracciones.campoPlaca.fill(PLACA_TEST);
  await infracciones.selectMotivo.selectOption('otro');

  await context.setOffline(true);
  try {
    await infracciones.botonRegistrar.click().catch(() => {});
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/^chrome-error:/);
  } finally {
    await context.setOffline(false);
  }
});
