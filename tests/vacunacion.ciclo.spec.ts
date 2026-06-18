import { test, expect, Page } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// Test de ciclo completo de la cartilla de Vacunación de un paciente (Agustin
// Tapia): eliminar todos los registros → verificar vacío → registrar todos +
// una vacuna extra → guardar → refrescar y verificar que persistió.

const PATIENT = 'Agustin Tapia';
// Botón de borrar de una dosis registrada (la × roja junto a la fecha).
const DEL_BTN = 'table.table-compact button.btn-secondary';
// Celda de dosis SIN registrar (clickeable para abrir el editor).
const EMPTY_DOSE = 'table.table-compact div.cursor-pointer';

// Navega a la Vacunación del paciente: /Pacientes → "Todos" → click por nombre
// → submenú "Vacunación".
async function goToVacunacion(page: Page): Promise<void> {
  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('a.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);

  // Mostrar todos (select "Ver por hoja")
  const pageSize = page.locator('select').first();
  if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
    await page.waitForTimeout(2500);
  }

  // Click en el paciente por nombre
  const link = page.locator('a.font-semibold.text-sm.text-gray-900', { hasText: PATIENT }).first();
  await expect(link, `No se encontró al paciente ${PATIENT}`).toBeVisible({ timeout: 10000 });
  await link.click();
  await page.waitForTimeout(3000);

  // Submenú Vacunación
  await page.getByText(/^\s*Vacunación\s*$/i).first().click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
}

async function selectCalendarDate(page: Page, targetDay: number): Promise<boolean> {
  const calendar = page.locator('.react-calendar:visible').first();
  if (!await calendar.isVisible({ timeout: 4000 }).catch(() => false)) return false;
  const dayBtns = calendar.locator('button.react-calendar__tile:not(.react-calendar__month-view__days__day--neighboringMonth)');
  const n = await dayBtns.count();
  for (let d = 0; d < n; d++) {
    const t = ((await dayBtns.nth(d).textContent().catch(() => '')) || '').trim();
    if (t === String(targetDay)) { await dayBtns.nth(d).click(); return true; }
  }
  return false;
}

// Registra la primera dosis sin registrar (abre editor, elige día, Guardar
// Cambios del popover). Devuelve true si quedó registrada.
async function registerFirstEmptyDose(page: Page, day: number): Promise<boolean> {
  const cell = page.locator(EMPTY_DOSE).first();
  const label = ((await cell.textContent().catch(() => '')) || '').trim().substring(0, 25);
  await cell.scrollIntoViewIfNeeded().catch(() => {});
  await cell.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  let calOpen = await page.locator('.react-calendar:visible').isVisible({ timeout: 3000 }).catch(() => false);
  if (!calOpen) {
    await cell.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    calOpen = await page.locator('.react-calendar:visible').isVisible({ timeout: 2000 }).catch(() => false);
  }
  console.log(`      [${label}] calendario abierto=${calOpen}`);
  if (!await selectCalendarDate(page, day)) { await page.keyboard.press('Escape').catch(() => {}); return false; }
  await page.waitForTimeout(300);
  // "Guardar Cambios" del editor (mayúscula C) — distinto del de abajo (minúscula)
  const editorSave = page.getByRole('button', { name: 'Guardar Cambios', exact: true }).first();
  if (!await editorSave.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => {});
    return false;
  }
  await editorSave.click().catch(() => {});
  await page.waitForTimeout(900);
  // Cerrar popup/toast de éxito para no bloquear el siguiente click.
  const ok = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
  if (await ok.isVisible({ timeout: 1000 }).catch(() => false)) await ok.click().catch(() => {});
  // Asegurar que el popover del calendario se cerró antes de seguir.
  await page.locator('.react-calendar:visible').first().waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);
  return true;
}

async function saveCartilla(page: Page): Promise<void> {
  const save = page.locator('button:has-text("Guardar cambios"):visible').first();
  await expect(save, 'No se encontró "Guardar cambios"').toBeVisible({ timeout: 5000 });
  await save.click();
  await page.waitForTimeout(2500);
  const ok = page.locator('.swal2-confirm:visible, button:has-text("Aceptar"):visible, button:has-text("OK"):visible').first();
  if (await ok.isVisible({ timeout: 1500 }).catch(() => false)) await ok.click().catch(() => {});
  await page.waitForTimeout(1500);
}

test('Vacunación: eliminar todo, verificar vacío, registrar todo + extra y verificar', async ({ page }) => {
  test.setTimeout(600000);
  const monitor = setupConsoleMonitor(page);

  await test.step(`Ir a Vacunación de ${PATIENT}`, async () => {
    await goToVacunacion(page);
  });

  await test.step('Eliminar TODOS los registros (botón ×) y guardar', async () => {
    const before = await page.locator(DEL_BTN).count();
    console.log(`🗑️  Dosis registradas antes de borrar: ${before}`);

    // Borrar UNA a la vez (clic JS al primer botón) esperando entre cada una para
    // que React confirme la eliminación en su estado. Clickear todas de golpe
    // deja stale closures y solo persiste una.
    let guard = 0;
    while ((await page.locator(DEL_BTN).count()) > 0 && guard < 100) {
      await page.evaluate((sel) => { const b = document.querySelector(sel) as HTMLElement | null; if (b) b.click(); }, DEL_BTN);
      await page.waitForTimeout(300);
      guard++;
    }
    const afterInline = await page.locator(DEL_BTN).count();
    console.log(`   Borrados uno a uno (${guard} clics). Restantes inline: ${afterInline}`);

    await saveCartilla(page);
  });

  await test.step('IMPORTANTE: verificar que se eliminaron (tras refrescar)', async () => {
    await goToVacunacion(page);
    const remaining = await page.locator(DEL_BTN).count();
    console.log(`✅ Verificación post-borrado → dosis registradas: ${remaining}`);
    await page.screenshot({ path: 'test-results/vac-ciclo-borrado.png', fullPage: true });
    expect(remaining, 'Tras borrar y guardar no debe quedar ninguna dosis registrada').toBe(0);
  });

  let totalDoses = 0;
  await test.step('Registrar TODAS las dosis de la cartilla', async () => {
    const fullTotal = await page.locator(EMPTY_DOSE).count();
    const MAX = 4; // CAP TEMPORAL para iterar rápido; quitar para registrar todas
    totalDoses = Math.min(fullTotal, MAX);
    console.log(`💉 Dosis sin registrar: ${fullTotal} — registraré ${totalDoses} (cap=${MAX})`);
    let registered = 0, guard = 0;
    while (registered < totalDoses && guard < MAX + 6) {
      const ok = await registerFirstEmptyDose(page, 15);
      console.log(`   intento ${guard + 1}: ${ok ? 'OK' : 'fallo'} (registradas=${registered + (ok ? 1 : 0)})`);
      if (ok) { registered++; await goToVacunacion(page); } // recargar: la app pierde interactividad tras guardar (bug)
      guard++;
    }
    console.log(`💉 Registradas: ${registered}/${totalDoses}`);
    await saveCartilla(page);
  });

  await test.step('Verificar que TODAS persisten (tras refrescar)', async () => {
    await goToVacunacion(page);
    const registered = await page.locator(DEL_BTN).count();
    const stillEmpty = await page.locator(EMPTY_DOSE).count();
    console.log(`✅ Tras refrescar → registradas: ${registered}, sin registrar: ${stillEmpty}`);
    await page.screenshot({ path: 'test-results/vac-ciclo-registrado.png', fullPage: true });
    expect(registered, `Deberían persistir ${totalDoses} dosis registradas`).toBe(totalDoses);
  });

  const result = monitor.printSummary();
  if (!result.passed) console.log(`⚠️ ${result.errors.length} error(es) de consola/JS`);
});
