import { test, expect, Page } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────────
// Test del módulo "Reportes" (`/reportes/reporteFacturas`, sidebar nuevo, sin
// cobertura previa). Página de estadísticas del doctor:
//   - KPIs: Número de consultas / Total / Total cobrado.
//   - Filtros: buscar por paciente, consultorio, estatus (Pagado/Pendiente),
//     rango de fechas (Últimos 7/14 días, mes, 3 meses, año) → dispara
//     dashboard/getDashboardPayments con el nuevo rango.
//   - Gráfico "Ingresos", donut "Servicios", Top 10 Diagnósticos, Top 10
//     Medicamentos (todos canvas — se valida contra la respuesta de la API,
//     no contra el dibujo).
//   - "Ingresos recientes" con link "Ver todos" → /reportes/todos
//     (payments/getPaymentList, paginado).
// (Mapeado 2026-07-06 con reportes.explorar.spec.js.)
//
// FAIL DETECTION (severidad MIXTA):
//   HARD-FAIL → getTopDiagnoses/getTopMedications/getTopServices/
//               getDashboardPayments/getPaymentList con status >= 400;
//               el filtro de rango de fechas no dispara una nueva consulta.
//   LOG-CONT. → errores de consola/JS, ruido externo (GA/Zendesk/Clarity).
// ─────────────────────────────────────────────────────────────────────────────

const EXTERNAL_NOISE = /google-analytics|googletagmanager|zendesk|clarity\.ms|doubleclick|hotjar|facebook|sentry/i;
const REPORTES_APIS = /\/api\/dashboard\/(getTopDiagnoses|getTopMedications|getTopServices|getDashboardPayments)|\/api\/payments\/getPaymentList/;

async function goToReportes(page: Page): Promise<void> {
  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await page.locator('a:has-text("Reportes"), button:has-text("Reportes")').first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(2500);
}

test('Reportes: cargar KPIs/Top 10, filtrar por rango de fechas y ver "Ingresos recientes"', async ({ page }) => {
  test.setTimeout(120000);
  const monitor = setupConsoleMonitor(page);

  const reportesApiFailures: string[] = [];
  page.on('response', (res) => {
    if (REPORTES_APIS.test(res.url()) && res.status() >= 400) {
      reportesApiFailures.push(`${res.status()} ${res.url().split('/api/')[1]}`);
    }
  });

  await test.step('Ir a Reportes desde el sidebar (no vía URL directa)', async () => {
    await goToReportes(page);
    await expect(page).toHaveURL(/\/reportes\/reporteFacturas/i);
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible({ timeout: 10000 });
  });

  await test.step('KPIs visibles: Número de consultas / Total / Total cobrado', async () => {
    await expect(page.locator('text=Número de consultas')).toBeVisible();
    await expect(page.locator('text=Total cobrado')).toBeVisible();
    await page.screenshot({ path: 'test-results/reportes-01-kpis.png', fullPage: true });
  });

  await test.step('Top 10 Diagnósticos / Medicamentos / Servicios: la API responde y el título se ve', async () => {
    const [diag, meds, servs] = await Promise.all([
      page.waitForResponse(r => /\/api\/dashboard\/getTopDiagnoses/.test(r.url()), { timeout: 10000 }).catch(() => null),
      page.waitForResponse(r => /\/api\/dashboard\/getTopMedications/.test(r.url()), { timeout: 10000 }).catch(() => null),
      page.waitForResponse(r => /\/api\/dashboard\/getTopServices/.test(r.url()), { timeout: 10000 }).catch(() => null),
    ]);
    // Puede que ya hayan respondido antes del waitFor (cache de navegación); si
    // alguna vino null, no es necesariamente un fallo — lo relevante es que la
    // sección se vea con datos o el estado vacío correcto.
    for (const [name, resp] of [['getTopDiagnoses', diag], ['getTopMedications', meds], ['getTopServices', servs]] as const) {
      if (resp) expect(resp.status(), `${name} debe responder 2xx`).toBeLessThan(400);
    }
    await expect(page.locator('text=Top 10 Diagnósticos Frecuentes')).toBeVisible();
    await expect(page.locator('text=Top 10 Medicamentos Prescritos')).toBeVisible();
    await expect(page.locator('text=Servicios')).toBeVisible();
  });

  await test.step('Filtro de rango de fechas dispara nueva consulta y actualiza "Desde/Hasta"', async () => {
    const rangoSelect = page.locator('select').nth(2);
    await expect(rangoSelect, 'Debe existir el select de rango de fechas').toBeVisible();

    const antesTexto = (await page.locator('text=/Desde:.*Hasta:/i').first().textContent().catch(() => '') || '').trim();

    const respPromise = page.waitForResponse(
      r => /\/api\/dashboard\/getDashboardPayments/.test(r.url()),
      { timeout: 10000 }
    ).catch(() => null);
    await rangoSelect.selectOption({ label: 'Últimos mes' });
    const resp = await respPromise;

    expect(resp, 'Cambiar el rango de fechas debe disparar getDashboardPayments').not.toBeNull();
    if (resp) expect(resp!.status(), 'getDashboardPayments debe responder 2xx').toBeLessThan(400);

    await page.waitForTimeout(1500);
    const despuesTexto = (await page.locator('text=/Desde:.*Hasta:/i').first().textContent().catch(() => '') || '').trim();
    console.log(`📅 Rango: "${antesTexto}" → "${despuesTexto}"`);
    expect(despuesTexto, 'El texto "Desde/Hasta" debe actualizarse al cambiar el rango').not.toBe(antesTexto);
  });

  await test.step('Filtros de consultorio y estatus están disponibles', async () => {
    const consultorioSelect = page.locator('select').nth(0);
    const estatusSelect = page.locator('select').nth(1);
    await expect(consultorioSelect).toBeVisible();
    await expect(estatusSelect).toBeVisible();
    const estatusOptions = await estatusSelect.locator('option').allTextContents();
    expect(estatusOptions.map(o => o.trim())).toEqual(expect.arrayContaining(['Todos los estatus', 'Pagado', 'Pendiente']));
  });

  await test.step('"Ingresos recientes" → "Ver todos" navega a /reportes/todos con datos paginados', async () => {
    await expect(page.locator('text=Ingresos recientes')).toBeVisible();
    const verTodos = page.locator('a:has-text("Ver todos"), button:has-text("Ver todos")').first();
    if (!(await verTodos.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log('   ⚠️ No se encontró el link "Ver todos"');
      return;
    }
    const respPromise = page.waitForResponse(r => /\/api\/payments\/getPaymentList/.test(r.url()), { timeout: 10000 }).catch(() => null);
    await verTodos.click();
    const resp = await respPromise;
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => null);
    await expect(page).toHaveURL(/\/reportes\/todos/i);
    if (resp) {
      expect(resp.status(), 'getPaymentList debe responder 2xx').toBeLessThan(400);
      const body = await resp.json().catch(() => null);
      if (body?.data) {
        expect(body.data, 'La respuesta paginada debe traer "payments" y "total"').toEqual(
          expect.objectContaining({ payments: expect.any(Array), total: expect.any(Number) })
        );
      }
    }
    await page.screenshot({ path: 'test-results/reportes-02-ver-todos.png', fullPage: true });
  });

  // ── RESUMEN FAIL DETECTION ─────────────────────────────────────────────────
  const result = monitor.printSummary();
  const isNoise = (e: any) => EXTERNAL_NOISE.test(`${e.text || ''} ${e.failure || ''} ${e.url || ''}`);
  const realErrors = result.errors.filter((e: any) => !isNoise(e));
  console.log('\n' + '─'.repeat(70));
  console.log('🔎  RESUMEN FAIL DETECTION (Reportes)');
  console.log('─'.repeat(70));
  console.log(`   Errores de consola REALES:     ${realErrors.length}`);
  realErrors.forEach((e: any, i: number) => console.log(`     [${i + 1}] +${e.timestamp}s → ${(e.text || e.failure || '').substring(0, 120)}`));
  console.log(`   APIs de Reportes fallidas:     ${reportesApiFailures.length}`);
  reportesApiFailures.forEach((f, i) => console.log(`     [${i + 1}] ${f}`));
  console.log('─'.repeat(70) + '\n');

  expect(reportesApiFailures, `Alguna API de Reportes falló: ${reportesApiFailures.join(', ')}`).toEqual([]);
});
