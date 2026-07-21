const { test, expect } = require('@playwright/test');
const { setupConsoleMonitor } = require('../e2e/utils.js');

// Busca, subiendo ancestros desde un label (case-insensitive: el label visual
// suele ser mayúsculas por CSS text-transform, pero el texto real en el DOM
// no necesariamente lo es), el contenedor más chico que además del label
// tenga OTRO contenido (el valor/número de la tarjeta). Evita depender de una
// profundidad fija de DOM que puede romperse con cualquier rediseño (mismo
// criterio que otros selectores defensivos de este repo).
async function getCardText(page, label, maxDepth = 8) {
  // Acotado a <main>: el sidebar tiene un link "Pacientes" que también matchea
  // el label de la tarjeta KPI "Pacientes" por texto exacto.
  const labelEl = page.locator('main').getByText(new RegExp(`^\\s*${label}\\s*$`, 'i')).first();
  if (!(await labelEl.count().catch(() => 0))) return '';
  for (let depth = 1; depth <= maxDepth; depth++) {
    const container = labelEl.locator(`xpath=ancestor::*[${depth}]`);
    if (!(await container.count().catch(() => 0))) continue;
    const txt = (await container.textContent().catch(() => '') || '').replace(/\s+/g, ' ').trim();
    if (txt && txt.toLowerCase() !== label.toLowerCase()) return txt;
  }
  return '';
}

test.describe('Dashboard', () => {
  test('KPIs, calendario y paneles muestran datos reales (no solo mapeo)', async ({ page }) => {
    test.setTimeout(60000);
    const monitor = setupConsoleMonitor(page);

    let dashboardData = null;
    let dashboardPayments = null;
    let filteredAppointments = null;
    let recentProcedures = null;
    page.on('response', async (r) => {
      const url = r.url();
      if (url.includes('/api/dashboard/getDashboardData')) {
        dashboardData = await r.json().catch(() => null);
      } else if (url.includes('/api/dashboard/getDashboardPayments')) {
        dashboardPayments = await r.json().catch(() => null);
      } else if (url.includes('/api/appointments/getFilteredAppointments')) {
        filteredAppointments = await r.json().catch(() => null);
      } else if (url.includes('/api/procedures/getLastProceduresFilesByDoctorId')) {
        recentProcedures = await r.json().catch(() => null);
      }
    });

    await page.goto('/Dashboard');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForResponse(r => r.url().includes('/api/dashboard/getDashboardData'), { timeout: 15000 }).catch(() => null);
    await page.waitForResponse(r => r.url().includes('/api/dashboard/getDashboardPayments'), { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(1500);

    expect(dashboardData, 'getDashboardData debe responder').toBeTruthy();
    expect(dashboardPayments, 'getDashboardPayments debe responder').toBeTruthy();

    const d = dashboardData.data;
    console.log(`📊 getDashboardData: consultas=${d.monthConsultations.count} recurrentes=${d.recurring.count} nuevas=${d.patientsMonth.count} pacientes=${d.patientsTotal.count}`);

    // 1. Las 4 tarjetas KPI deben mostrar el número real que devuelve la API
    // (no un placeholder ni un valor desfasado).
    const kpis = [
      { label: 'CONSULTAS', count: d.monthConsultations.count },
      { label: 'RECURRENTES', count: d.recurring.count },
      { label: 'NUEVAS', count: d.patientsMonth.count },
      { label: 'PACIENTES', count: d.patientsTotal.count },
    ];
    for (const kpi of kpis) {
      const txt = await getCardText(page, kpi.label);
      expect(txt, `Tarjeta "${kpi.label}" debe mostrar contenido además del título`).not.toBe('');
      expect(txt, `Tarjeta "${kpi.label}" debe mostrar el valor ${kpi.count} (texto real: "${txt}")`)
        .toMatch(new RegExp(`(^|\\D)${kpi.count}(\\D|$)`));
      console.log(`✅ KPI "${kpi.label}": "${txt}"`);
    }

    // 2. El calendario (react-day-picker: table[role=grid] con aria-label
    // "<mes> <año>" en minúsculas) debe reflejar el mes/año real de hoy.
    const grid = page.locator('table[role="grid"], [role="grid"]').first();
    await expect(grid, 'El calendario del Dashboard debe estar visible').toBeVisible();
    const ariaLabel = ((await grid.getAttribute('aria-label').catch(() => '')) || '').toLowerCase();
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const hoy = new Date();
    const mesEsperado = meses[hoy.getMonth()];
    const anioEsperado = String(hoy.getFullYear());
    expect(ariaLabel, `El calendario debe mostrar "${mesEsperado}" (real: "${ariaLabel}")`).toContain(mesEsperado);
    expect(ariaLabel, `El calendario debe mostrar el año ${anioEsperado} (real: "${ariaLabel}")`).toContain(anioEsperado);
    console.log(`✅ Calendario: aria-label="${ariaLabel}"`);

    // 3. La celda de hoy debe existir en el grid y no estar deshabilitada/fuera de mes.
    const hoyISO = hoy.toISOString().slice(0, 10);
    const celdaHoy = page.locator(`[data-day="${hoyISO}"]`).first();
    await expect(celdaHoy, `Debe existir la celda del calendario para hoy (${hoyISO})`).toBeVisible();
    const disabledHoy = await celdaHoy.getAttribute('data-disabled').catch(() => null);
    expect(disabledHoy, 'La celda de hoy no debe estar marcada como deshabilitada/fuera de mes').not.toBe('true');
    console.log(`✅ Celda de hoy (${hoyISO}) presente y habilitada`);

    // 4. "Corte de hoy" debe reflejar encabezado_actual de getDashboardPayments
    // (total recaudado + número de consultas del día).
    const p = dashboardPayments.data.encabezado_actual;
    const corteTxt = await getCardText(page, 'Corte de hoy');
    expect(corteTxt, 'Panel "Corte de hoy" debe tener contenido').not.toBe('');
    expect(corteTxt, `"Corte de hoy" debe mostrar las ${p.numero_consultas} consultas del día (texto real: "${corteTxt}")`)
      .toMatch(new RegExp(`(^|\\D)${p.numero_consultas}(\\D|$)`));
    const totalFormateado = p.total_pagado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(corteTxt, `"Corte de hoy" debe mostrar el total recaudado $${totalFormateado} (texto real: "${corteTxt}")`)
      .toContain(totalFormateado);
    console.log(`✅ Corte de hoy: "${corteTxt}"`);

    // 5. "Agenda de hoy": el estado (vacío vs. con citas) debe ser consistente
    // con lo que devolvió getFilteredAppointments para hoy.
    const agendaTxt = await getCardText(page, 'Agenda de hoy');
    expect(agendaTxt, 'Panel "Agenda de hoy" debe tener contenido').not.toBe('');
    const citasHoy = Array.isArray(filteredAppointments?.data) ? filteredAppointments.data.length : null;
    if (citasHoy === 0) {
      expect(agendaTxt, `Sin citas hoy según la API — el panel debe mostrar el estado vacío (texto real: "${agendaTxt}")`)
        .toMatch(/sin citas para hoy/i);
    } else if (citasHoy && citasHoy > 0) {
      expect(agendaTxt, `Hay ${citasHoy} cita(s) hoy según la API — el panel NO debe mostrar el estado vacío (texto real: "${agendaTxt}")`)
        .not.toMatch(/sin citas para hoy/i);
    } else {
      console.log('   ⚠️ No se pudo capturar getFilteredAppointments para correlacionar "Agenda de hoy" con datos reales');
    }
    console.log(`✅ Agenda de hoy: "${agendaTxt.substring(0, 120)}" (citas API: ${citasHoy})`);

    // 6. "Nuevos estudios": si la API trae procedimientos recientes, el panel
    // no debe mostrar un estado vacío — y viceversa.
    const estudiosTxt = await getCardText(page, 'Nuevos estudios');
    expect(estudiosTxt, 'Panel "Nuevos estudios" debe tener contenido').not.toBe('');
    const totalEstudios = recentProcedures?.data?.procedimientos?.length ?? null;
    if (totalEstudios !== null) {
      if (totalEstudios > 0) {
        expect(estudiosTxt.length, `Hay ${totalEstudios} estudio(s) recientes — el panel debe listarlos (texto real: "${estudiosTxt}")`)
          .toBeGreaterThan('Nuevos estudios'.length);
      }
      console.log(`✅ Nuevos estudios: ${totalEstudios} en la API, panel muestra: "${estudiosTxt.substring(0, 120)}"`);
    }

    // 7. Sin errores de API durante toda la carga del Dashboard.
    const result = monitor.printSummary();
    expect(result.failedApiCalls.length, `No debe haber responses con error de API en el Dashboard: ${JSON.stringify(result.failedApiCalls)}`).toBe(0);
  });
});
