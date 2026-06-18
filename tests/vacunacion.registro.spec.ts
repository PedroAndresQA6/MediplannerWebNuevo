import { test, expect, Page, Locator } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// Test funcional: registrar una dosis en la cartilla de Vacunación de un paciente
// y verificar que se guarda (API 200) y que PERSISTE (la fecha queda en la celda
// y sobrevive a recargar la página).

// Navega: Pacientes (sidebar) → primer paciente → Información (activa por defecto)
// → submenú lateral "Vacunación".
async function goToVacunacion(page: Page): Promise<string> {
  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(3000);

  const links = page.locator('a.font-semibold.text-sm.text-gray-900');
  await expect(links.first()).toBeVisible({ timeout: 15000 });
  const name = ((await links.first().textContent().catch(() => '')) || '').trim();
  await links.first().click();
  await page.waitForTimeout(3000);

  await page.getByText(/^\s*Vacunación\s*$/i).first().click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  return name;
}

async function selectCalendarDate(page: Page, targetDay: number): Promise<boolean> {
  const calendar = page.locator('.react-calendar:visible').first();
  if (!await calendar.isVisible({ timeout: 5000 }).catch(() => false)) return false;
  const dayBtns = calendar.locator('button.react-calendar__tile:not(.react-calendar__month-view__days__day--neighboringMonth)');
  const n = await dayBtns.count();
  for (let d = 0; d < n; d++) {
    const t = ((await dayBtns.nth(d).textContent().catch(() => '')) || '').trim();
    if (t === String(targetDay)) { await dayBtns.nth(d).click(); return true; }
  }
  return false;
}

// Devuelve la fila <tr> de la vacuna indicada.
async function vaccineRow(page: Page, vaccine: string): Promise<Locator | null> {
  const rows = page.locator('table.table-compact tbody tr');
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const v = ((await rows.nth(i).locator('td').first().textContent().catch(() => '')) || '').trim();
    if (v === vaccine) return rows.nth(i);
  }
  return null;
}

test('Vacunación: registrar una dosis y verificar que persiste', async ({ page }) => {
  test.setTimeout(180000);
  const monitor = setupConsoleMonitor(page);
  console.log('🔍 [MONITOR] activo\n');

  const VACCINE = 'BCG';
  const DIA = 15;
  const FOLIO = '12345';
  const NOTAS = 'Dosis registrada por prueba automatizada (funcional)';
  const now = new Date();
  const expectedDate = `${String(DIA).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  await test.step('Ir a Vacunación del paciente', async () => {
    const patient = await goToVacunacion(page);
    console.log(`👤 Paciente: ${patient}`);
  });

  await test.step(`Abrir editor de ${VACCINE} y registrar dosis`, async () => {
    const row = await vaccineRow(page, VACCINE);
    expect(row, `No se encontró la fila de ${VACCINE}`).not.toBeNull();

    // La celda de dosis es clickeable tanto si está vacía ("Única") como si ya
    // tiene fecha registrada (en ese caso re-abre el editor para editarla).
    // Probamos varios selectores hasta que aparezca el calendario.
    const candidates = [
      row!.locator('div.cursor-pointer'),
      row!.locator('span[data-info]'),
      row!.locator('td').nth(1),
    ];
    let opened = false;
    for (const c of candidates) {
      const el = c.first();
      if (await el.count().catch(() => 0) === 0) continue;
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
      if (await page.locator('.react-calendar:visible').isVisible({ timeout: 1500 }).catch(() => false)) { opened = true; break; }
    }
    expect(opened, 'No se pudo abrir el editor de dosis').toBe(true);
    await page.waitForTimeout(800);

    await expect(page.locator('.react-calendar:visible'), 'Debe abrirse el popover "Registrar Vacuna"').toBeVisible({ timeout: 5000 });

    expect(await selectCalendarDate(page, DIA), `No se pudo seleccionar el día ${DIA}`).toBe(true);
    await page.waitForTimeout(500);

    const folio = page.locator('input[placeholder="Opcional"]:visible').first();
    if (await folio.isVisible({ timeout: 2000 }).catch(() => false)) await folio.fill(FOLIO);
    const notas = page.locator('textarea[placeholder="Notas..."]:visible').first();
    if (await notas.isVisible({ timeout: 2000 }).catch(() => false)) await notas.fill(NOTAS);
    console.log(`📝 Fecha=${expectedDate}, Folio=${FOLIO}`);
  });

  await test.step('Guardar Cambios y verificar API', async () => {
    const saveBtn = page.locator('button:has-text("Guardar Cambios"):visible').first();
    const [resp] = await Promise.all([
      page.waitForResponse(r => /\/api\/vaccines\/saveVaccinesUser/.test(r.url()), { timeout: 15000 }).catch(() => null),
      saveBtn.click(),
    ]);
    expect(resp, 'No se recibió respuesta de saveVaccinesUser').not.toBeNull();
    expect(resp!.status(), 'saveVaccinesUser debe responder 200').toBe(200);
    const body = await resp!.text().catch(() => '');
    console.log(`📡 saveVaccinesUser: ${resp!.status()} → ${body.substring(0, 120)}`);
    expect(body).toContain('OK');

    await page.waitForTimeout(1500);
    const okBtn = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
    if (await okBtn.isVisible({ timeout: 1500 }).catch(() => false)) await okBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
  });

  await test.step('Verificar que la fecha aparece en la celda (sin recargar)', async () => {
    const row = await vaccineRow(page, VACCINE);
    expect(row).not.toBeNull();
    await expect(row!, `La fila de ${VACCINE} debe mostrar la fecha ${expectedDate}`).toContainText(expectedDate, { timeout: 8000 });
    console.log(`✅ Fecha ${expectedDate} visible en ${VACCINE} tras guardar`);
    await page.screenshot({ path: 'test-results/vacunacion-registro-after.png', fullPage: true });
  });

  await test.step('Verificar PERSISTENCIA tras recargar', async () => {
    await goToVacunacion(page);
    const row = await vaccineRow(page, VACCINE);
    expect(row, `Tras recargar no se encontró la fila de ${VACCINE}`).not.toBeNull();
    await expect(row!, `Tras recargar, ${VACCINE} debe seguir mostrando ${expectedDate}`).toContainText(expectedDate, { timeout: 8000 });
    console.log(`✅ PERSISTE: ${VACCINE} mantiene ${expectedDate} tras recargar`);
    await page.screenshot({ path: 'test-results/vacunacion-registro-reload.png', fullPage: true });
  });

  const result = monitor.printSummary();
  if (!result.passed) console.log(`⚠️ ${result.errors.length} error(es) de consola/JS, ${result.failedApiCalls.length} API fallida(s) (revisar: bundle vacunacion 'vacunas'/'map')`);
});
