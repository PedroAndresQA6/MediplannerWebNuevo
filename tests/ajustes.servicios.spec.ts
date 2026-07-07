import { test, expect, Page } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────────
// Test del catálogo de Servicios del doctor (`/perfil/Servicios`, dentro de
// Ajustes — sidebar nuevo, sin cobertura previa). Es el catálogo de donde
// debería salir la lista que aparece vacía en el bug ya reportado del
// dropdown "Agregar servicios" de la Consulta (ver consultation.full-flow).
//
// Mapeado 2026-07-06 con exploración manual:
//   - Filtro "Sólo activos": checkbox `input[name="filtro"]`.
//   - "Nuevo Tipo" abre un modal con 3 campos: nombre_servicio (texto),
//     duracion_servicio (select), activo (checkbox) → botón "Guardar".
//   - API de lectura: services/getServices.
//
// No destructivo: el servicio de prueba se crea INACTIVO (checkbox "activo"
// sin marcar) para no aparecer en "Sólo activos" ni en el dropdown de la
// Consulta — se puede dejar en el catálogo sin afectar otros flujos, con
// nombre claramente identificable como dato de QA desechable.
//
// FAIL DETECTION:
//   HARD-FAIL → getServices con status >= 400; el servicio creado no
//               aparece en getServices tras guardar (falso registro).
//   LOG-CONT. → errores de consola/ruido externo (GA/Zendesk/Clarity).
// ─────────────────────────────────────────────────────────────────────────────

const EXTERNAL_NOISE = /google-analytics|googletagmanager|zendesk|clarity\.ms|doubleclick|hotjar|facebook|sentry/i;
const NOMBRE_SERVICIO_QA = `QA_TEST_SERVICIO_NO_BORRAR_${Date.now()}`;

async function irAServicios(page: Page): Promise<void> {
  await page.goto('/Dashboard');
  await page.waitForTimeout(2000);
  await page.locator('a:has-text("Ajustes")').first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  // El tab "Servicios" es un <span class="menu-title"> anidado (no un
  // a/button directo) — getByText exact + force evita el timeout de
  // actionability que da un selector CSS más estricto.
  await page.getByText('Servicios', { exact: true }).first().click({ force: true, timeout: 20000 });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

test('Ajustes › Servicios: catálogo carga, filtro "Sólo activos" y alta de un servicio', async ({ page }) => {
  test.setTimeout(90000);
  const monitor = setupConsoleMonitor(page);

  const serviciosApiFailures: string[] = [];
  page.on('response', (res) => {
    if (/\/api\/services\//.test(res.url()) && res.status() >= 400) {
      serviciosApiFailures.push(`${res.status()} ${res.url().split('/api/')[1]}`);
    }
  });

  await test.step('Ir a Ajustes › Servicios y validar carga (getServices 200)', async () => {
    const respPromise = page.waitForResponse(r => /\/api\/services\/getServices/.test(r.url()), { timeout: 15000 }).catch(() => null);
    await irAServicios(page);
    await expect(page).toHaveURL(/\/perfil\/Servicios/i);
    const resp = await respPromise;
    if (resp) expect(resp.status(), 'getServices debe responder 2xx').toBeLessThan(400);
    await expect(page.getByText('Crea y personaliza los servicios', { exact: false })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/ajustes-servicios-01-lista.png', fullPage: true });
  });

  await test.step('Filtro "Sólo activos": togglear y revertir sin error', async () => {
    const filtro = page.locator('input[name="filtro"]').first();
    await expect(filtro, 'Debe existir el checkbox "Sólo activos"').toBeVisible();
    const antes = await filtro.isChecked();
    await filtro.click();
    await page.waitForTimeout(1000);
    const despues = await filtro.isChecked();
    expect(despues, 'El checkbox debe cambiar de estado al clickear').toBe(!antes);
    await filtro.click(); // revertir al estado original
    await page.waitForTimeout(500);
    expect(await filtro.isChecked()).toBe(antes);
  });

  await test.step('"Nuevo Tipo": crear un servicio de prueba (inactivo, no destructivo)', async () => {
    const nuevoTipo = page.locator('button:has-text("Nuevo Tipo"), a:has-text("Nuevo Tipo")').first();
    await expect(nuevoTipo, 'Debe existir el botón "Nuevo Tipo"').toBeVisible({ timeout: 5000 });
    await nuevoTipo.click();
    await page.waitForTimeout(1000);

    const nombreInput = page.locator('input[name="nombre_servicio"]');
    await expect(nombreInput, 'El modal debe traer el campo "nombre_servicio"').toBeVisible({ timeout: 5000 });
    await nombreInput.fill(NOMBRE_SERVICIO_QA);

    const duracionSelect = page.locator('select[name="duracion_servicio"]');
    if (await duracionSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await duracionSelect.selectOption({ index: 1 }).catch(() => {});
    }

    // A propósito se DESMARCA "activo" (viene marcado por default): el
    // servicio de QA queda inactivo, no aparece en "Sólo activos" ni en el
    // dropdown de la Consulta.
    const activoCheckbox = page.locator('input[name="activo"]');
    if (await activoCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      if (await activoCheckbox.isChecked()) await activoCheckbox.click();
      expect(await activoCheckbox.isChecked(), 'El checkbox "activo" debe quedar sin marcar').toBe(false);
    }

    await page.screenshot({ path: 'test-results/ajustes-servicios-02-nuevotipo.png', fullPage: true });

    const guardarBtn = page.locator('button:has-text("Guardar")').first();
    await expect(guardarBtn).toBeVisible({ timeout: 5000 });
    const respPromise = page.waitForResponse(
      r => /\/api\/services\//.test(r.url()) && r.request().method() !== 'GET',
      { timeout: 10000 }
    ).catch(() => null);
    await guardarBtn.click();
    const resp = await respPromise;
    if (resp) {
      expect(resp.status(), 'El guardado del nuevo servicio debe responder 2xx').toBeLessThan(400);
    } else {
      console.log('   ⚠️ No se observó una respuesta de services/* tras Guardar');
    }
    await page.waitForTimeout(1500);
  });

  let servicioEncontrado = false;
  await test.step('Verificar que el servicio creado aparece en getServices (anti falso-registro)', async () => {
    // Tras Guardar, la app navega sola a /perfil/edicionServicio (edición del
    // servicio recién creado) — hay que volver explícito a la lista, un
    // reload() ahí recargaría la página de edición, no la lista.
    const respPromise = page.waitForResponse(r => /\/api\/services\/getServices/.test(r.url()), { timeout: 15000 }).catch(() => null);
    await page.goto('/perfil/Servicios');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    const resp = await respPromise;
    if (resp) {
      const body = await resp.json().catch(() => null);
      const lista = body?.data || [];
      servicioEncontrado = Array.isArray(lista) && lista.some((s: any) => s?.nombre === NOMBRE_SERVICIO_QA);
      console.log(`   Servicio "${NOMBRE_SERVICIO_QA}" encontrado en getServices: ${servicioEncontrado}`);
    }
    await page.screenshot({ path: 'test-results/ajustes-servicios-03-tras-crear.png', fullPage: true });
  });

  // ── RESUMEN FAIL DETECTION ─────────────────────────────────────────────────
  const result = monitor.printSummary();
  const isNoise = (e: any) => EXTERNAL_NOISE.test(`${e.text || ''} ${e.failure || ''} ${e.url || ''}`);
  const realErrors = result.errors.filter((e: any) => !isNoise(e));
  console.log('\n' + '─'.repeat(70));
  console.log('🔎  RESUMEN FAIL DETECTION (Ajustes › Servicios)');
  console.log('─'.repeat(70));
  console.log(`   Errores de consola REALES:     ${realErrors.length}`);
  realErrors.forEach((e: any, i: number) => console.log(`     [${i + 1}] +${e.timestamp}s → ${(e.text || e.failure || '').substring(0, 120)}`));
  console.log(`   APIs de Servicios fallidas:    ${serviciosApiFailures.length}`);
  serviciosApiFailures.forEach((f, i) => console.log(`     [${i + 1}] ${f}`));
  console.log('─'.repeat(70) + '\n');

  expect(serviciosApiFailures, `Alguna API de Servicios falló: ${serviciosApiFailures.join(', ')}`).toEqual([]);
  expect(servicioEncontrado, `El servicio "${NOMBRE_SERVICIO_QA}" no apareció en getServices tras guardar — falso registro`).toBe(true);
});
