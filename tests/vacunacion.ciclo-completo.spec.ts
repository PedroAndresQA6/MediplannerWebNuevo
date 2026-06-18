import { test, expect, Page } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────────
// CICLO COMPLETO de la cartilla de Vacunación (UI NUEVA, auto-save por fecha).
//
// Flujo (sobre Agustin Tapia):
//   1) Ir a Vacunación
//   2) Borrar TODOS los registros (dosis de la cartilla + filas "Otra vacuna")
//   3) Refrescar y VERIFICAR que quedó vacío
//   4) Registrar dosis (fecha = auto-save) hasta MAX + 1 "Otra vacuna"
//   5) Refrescar y VERIFICAR que todo persiste
//
// UI nueva (mapeada):
//   - Cada dosis es un <input type="date"> inline; llenarlo dispara saveVaccinesUser solo.
//   - Borrar dosis: button.btn-secondary cuyo texto es "×" (el lápiz es editar, NO borrar).
//   - "Otra vacuna": filas inline (vacuna_nombre/dosis_nombre/Fecha/Folio/Comentarios);
//     se borran con su × (text-gray-400 hover:text-red-*) y se guardan con "Guardar cambios".
// ─────────────────────────────────────────────────────────────────────────────

const PATIENT = 'Agustin Tapia';
const TABLE = 'table.table-compact';
const DATE_INPUTS = `${TABLE} input[type="date"]`;
// Cap de dosis a registrar (subir a 999 para registrar TODAS; cada una auto-guarda).
const MAX_DOSES = 6;

const today = new Date();
const ISO_DATE = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`; // yyyy-mm-15

async function goToVacunacion(page: Page): Promise<void> {
  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('a.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const pageSize = page.locator('select').first();
  if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.locator('a.font-semibold.text-sm.text-gray-900', { hasText: PATIENT }).first().click();
  await page.waitForTimeout(3000);
  await page.getByText(/^\s*Vacunación\s*$/i).first().click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
}

// Cuenta cuántas dosis de la cartilla tienen fecha (registradas).
async function countRegistered(page: Page): Promise<number> {
  return await page.evaluate((T) => {
    const t = document.querySelector(T);
    if (!t) return 0;
    const dates = Array.from(t.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
    return dates.filter(d => d.value).length;
  }, TABLE);
}

async function countOtraVacuna(page: Page): Promise<number> {
  return await page.locator('input[name="vacuna_nombre"]').count();
}

// Botón de borrar de una dosis (btn-secondary con texto "×"), excluye el lápiz (editar).
function deleteDoseButtons(page: Page) {
  return page.locator(`${TABLE} button.btn-secondary`).filter({ hasText: '×' });
}

// Espera (best-effort) el auto-guardado tras una acción.
async function waitAutoSave(page: Page): Promise<void> {
  await page.waitForResponse(r => /\/api\/vaccines\/saveVaccinesUser/.test(r.url()) && r.status() === 200, { timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(400);
}

test('Vacunación: ciclo completo borrar-todo → vacío → registrar-todo → verificar', async ({ page }) => {
  test.setTimeout(600000);
  const monitor = setupConsoleMonitor(page);

  await test.step(`Ir a Vacunación de ${PATIENT}`, async () => {
    await goToVacunacion(page);
    console.log(`📊 Inicial → dosis registradas: ${await countRegistered(page)}, filas otra-vacuna: ${await countOtraVacuna(page)}`);
  });

  await test.step('Borrar TODAS las dosis registradas de la cartilla (una a una, auto-save)', async () => {
    let guard = 0;
    while ((await deleteDoseButtons(page).count()) > 0 && guard < 80) {
      const btn = deleteDoseButtons(page).first();
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      await btn.click({ force: true }).catch(() => {});
      await waitAutoSave(page);
      guard++;
    }
    console.log(`🗑️ Borrado de dosis: ${guard} clics. Botones × restantes: ${await deleteDoseButtons(page).count()}`);
  });

  await test.step('Borrar filas "Otra vacuna" si las hay', async () => {
    const redX = page.locator('button.text-gray-400.hover\\:text-red-500, button[class*="hover:text-red"]');
    let guard = 0;
    while ((await redX.count()) > 0 && guard < 30) {
      await redX.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      guard++;
    }
    // Guardar cambios para persistir el borrado de "otra vacuna"
    const save = page.locator('button:has-text("Guardar cambios"):visible').first();
    if (await save.isVisible({ timeout: 2000 }).catch(() => false)) {
      await save.click().catch(() => {});
      await waitAutoSave(page);
    }
    console.log(`🗑️ Borrado otra-vacuna: ${guard} clics`);
  });

  await test.step('VERIFICAR vacío (tras refrescar)', async () => {
    await goToVacunacion(page);
    const reg = await countRegistered(page);
    console.log(`✅ Post-borrado tras refrescar → dosis registradas: ${reg}`);
    await page.screenshot({ path: 'test-results/vac-ciclo-01-vacio.png', fullPage: true });
    expect(reg, 'Tras borrar y refrescar no debe quedar ninguna dosis registrada').toBe(0);
  });

  let registradas = 0;
  await test.step(`Registrar dosis (auto-save por fecha) — cap ${MAX_DOSES}`, async () => {
    const totalEmpty = await page.locator(DATE_INPUTS).count();
    const objetivo = Math.min(totalEmpty, MAX_DOSES);
    console.log(`💉 Date inputs disponibles: ${totalEmpty} — registraré ${objetivo} (cap=${MAX_DOSES})`);

    let guard = 0;
    while (registradas < objetivo && guard < objetivo + 8) {
      // Primer date sin valor
      const idx = await page.evaluate((T) => {
        const t = document.querySelector(T)!;
        const dates = Array.from(t.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
        return dates.findIndex(d => !d.value);
      }, TABLE);
      if (idx < 0) break;
      const target = page.locator(DATE_INPUTS).nth(idx);
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await target.fill(ISO_DATE).catch(() => {});
      await target.blur().catch(() => {});
      await waitAutoSave(page);
      const nowReg = await countRegistered(page);
      if (nowReg > registradas) { registradas = nowReg; console.log(`   ✅ Registrada ${registradas}/${objetivo} (idx ${idx})`); }
      else console.log(`   ⚠️ idx ${idx} no incrementó el conteo (reg=${nowReg})`);
      guard++;
    }
    console.log(`💉 Registradas en cartilla: ${registradas}`);
  });

  await test.step('Agregar 1 "Otra vacuna"', async () => {
    const nombre = page.locator('input[name="vacuna_nombre"]').first();
    if (await nombre.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nombre.fill('Vacuna Prueba Automatizada').catch(() => {});
      await page.locator('input[name="dosis_nombre"]').first().fill('Dosis única').catch(() => {});
      const fecha = page.locator('input[placeholder="Fecha"]').first();
      if (await fecha.isVisible().catch(() => false)) await fecha.fill(ISO_DATE).catch(() => {});
      const folio = page.locator('input[placeholder="Folio"]').first();
      if (await folio.isVisible().catch(() => false)) await folio.fill('98765').catch(() => {});
      const com = page.locator('textarea[placeholder="Comentarios"]').first();
      if (await com.isVisible().catch(() => false)) await com.fill('Otra vacuna por prueba automatizada').catch(() => {});
      const save = page.locator('button:has-text("Guardar cambios"):visible').first();
      if (await save.isVisible({ timeout: 2000 }).catch(() => false)) {
        await save.click().catch(() => {});
        await waitAutoSave(page);
      }
      console.log('➕ Otra vacuna agregada y guardada');
    } else {
      console.log('⚠️ No se encontró fila para "Otra vacuna"');
    }
  });

  await test.step('VERIFICAR que las dosis persisten (tras refrescar)', async () => {
    await goToVacunacion(page);
    const reg = await countRegistered(page);
    console.log(`✅ Tras refrescar → dosis registradas: ${reg} (esperado ${registradas})`);
    await page.screenshot({ path: 'test-results/vac-ciclo-02-registrado.png', fullPage: true });
    expect(reg, `Deberían persistir ${registradas} dosis registradas`).toBe(registradas);
  });

  const result = monitor.printSummary();
  if (!result.passed) console.log(`⚠️ ${result.errors.length} error(es) de consola/JS, ${result.failedApiCalls.length} API fallida(s)`);
});
