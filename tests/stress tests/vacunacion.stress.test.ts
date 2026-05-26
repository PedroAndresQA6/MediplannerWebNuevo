import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotsDir = path.join(process.cwd(), 'test-results', 'stress-screenshots');

async function captureScreenshot(page: Page, name: string): Promise<void> {
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotsDir, `${name}-${Date.now()}.png`), fullPage: true }).catch(() => {});
}

async function handlePopup(page: Page, context: string): Promise<boolean> {
  const popup = page.locator('[role="dialog"], .modal, [class*="swal"], [class*="popup"]').first();
  if (await popup.isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = (await popup.textContent().catch(() => ''))?.substring(0, 60) || '';
    console.log(`    🔔 [${context}] Popup: "${text}"`);
    const closeBtn = popup.locator('button:has-text("Aceptar"), button:has-text("OK"), button:has-text("Cerrar"), button:has-text("×")').first();
    if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      return true;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

async function selectCalendarDate(page: Page, targetDay: number): Promise<boolean> {
  const calendar = page.locator('.react-calendar:visible').first();
  if (!await calendar.isVisible({ timeout: 5000 }).catch(() => false)) return false;
  const dayBtns = calendar.locator('button.react-calendar__tile:not(.react-calendar__month-view__days__day--neighboringMonth)');
  const dayCount = await dayBtns.count();
  for (let d = 0; d < dayCount; d++) {
    const text = (await dayBtns.nth(d).textContent().catch(() => ''))?.trim();
    if (text === String(targetDay)) {
      await dayBtns.nth(d).click();
      return true;
    }
  }
  return false;
}

async function fillDoseDate(page: Page, doseDiv: any, vaccineName: string, doseName: string, doseIndex: number): Promise<void> {
  console.log(`\n  💉 [${doseIndex + 1}] ${vaccineName} - "${doseName}"`);

  await doseDiv.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await doseDiv.click({ force: true });
  await page.waitForTimeout(2000);

  if (!await selectCalendarDate(page, 15)) {
    console.log(`    ⚠️ No se pudo seleccionar día en calendario`);
    await captureScreenshot(page, `vacuna-cal-error-${doseIndex}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    return;
  }
  const folioNum = 20000 + doseIndex;
  console.log(`    ✅ Fecha: 15, Folio: ${folioNum}`);
  await page.waitForTimeout(1000);

  const folioInput = page.locator('input[placeholder="Folio"]:visible').first();
  if (await folioInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await folioInput.fill(String(folioNum));
  }
  const ta = page.locator('textarea[placeholder="Comentarios"]:visible').first();
  if (await ta.isVisible({ timeout: 1000 }).catch(() => false)) {
    await ta.fill(`Vacuna aplicada. ${vaccineName} - ${doseName}`);
  }

  const saveBtn = page.locator('button:has-text("Guardar Cambios"):visible').first();
  if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    await handlePopup(page, `Dosis ${doseIndex}`);
    console.log(`    ✅ Guardado`);
  } else {
    console.log(`    ⚠️ Sin botón Guardar Cambios`);
    await page.keyboard.press('Escape');
  }
}

async function fillVacunaDiferente(page: Page): Promise<void> {
  console.log(`\n  📝 === VACUNA DIFERENTE ===`);

  // Click en "Vacuna diferente"
  const difBtn = page.locator('button:has-text("Vacuna diferente"):visible').first();
  if (!await difBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`    ⚠️ Botón "Vacuna diferente" no encontrado`);
    return;
  }
  await difBtn.click();
  await page.waitForTimeout(2000);

  // Select de vacuna (primer select válido)
  const selects = page.locator('select.select:visible');
  const selCount = await selects.count();
  console.log(`    📋 Selects visibles: ${selCount}`);
  for (let s = 0; s < selCount; s++) {
    const sel = selects.nth(s);
    const opts = await sel.locator('option').evaluateAll(o =>
      o.map((e: any) => ({ value: e.value, text: e.textContent?.trim() || '' }))
    );
    const valid = opts.filter((o: any) => !o.text.toLowerCase().includes('seleccione'));
    if (valid.length > 0) {
      const idx = Math.floor(Math.random() * valid.length);
      await sel.selectOption({ value: valid[idx].value });
      console.log(`    ✅ Select ${s + 1}: "${valid[idx].text}"`);
      await page.waitForTimeout(500);
    }
  }

  // Fecha en calendario
  if (await selectCalendarDate(page, 10)) {
    console.log(`    ✅ Fecha seleccionada: 10`);
  }
  await page.waitForTimeout(500);

  // Folio
  const folioInput = page.locator('input[placeholder="Folio"]:visible').first();
  if (await folioInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await folioInput.fill('99999');
    console.log(`    ✅ Folio: 99999`);
  }

  // Comentarios
  const ta = page.locator('textarea[placeholder="Comentarios"]:visible').first();
  if (await ta.isVisible({ timeout: 1000 }).catch(() => false)) {
    await ta.fill('Vacuna diferente aplicada - prueba automatizada');
    console.log(`    ✅ Comentarios`);
  }

  // Guardar Cambios
  const saveBtn = page.locator('button:has-text("Guardar Cambios"):visible').first();
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    await handlePopup(page, 'Vacuna diferente');
    console.log(`    ✅ Vacuna diferente guardada`);
  }
}

test.describe('Vacunación - Stress Test', () => {
  test('Stress Test Vacunación - 5 aleatorias + Vacuna diferente', async ({ page }) => {
    test.setTimeout(600000);

    console.log('\n🚀 === STRESS TEST VACUNACIÓN ===\n');

    // Login
    await page.goto('/');
    await page.waitForTimeout(3000);
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(process.env.USER_EMAIL || '');
      await page.locator('input[type="password"]').first().fill(process.env.USER_PASSWORD || '');
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(5000);
    }

    // Navigate to patients
    await page.goto('/Pacientes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Select Daniela
    const patientLinks = page.locator('a.font-semibold, a[class*="patient"], tr td a, a[href*="Paciente"]');
    const count = await patientLinks.count();
    for (let i = 0; i < count; i++) {
      const text = (await patientLinks.nth(i).textContent().catch(() => ''))?.trim() || '';
      if (text.includes('Daniela') && text.includes('Jiménez')) {
        await patientLinks.nth(i).click();
        console.log(`✅ Paciente: "${text}"`);
        break;
      }
    }
    await page.waitForTimeout(3000);

    // Info → Vacunación
    await page.locator('a:has-text("Información")').first().click();
    await page.waitForTimeout(2000);
    await page.locator('a:has-text("Vacunación")').first().click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // Encontrar todas las dosis
    const doseDivs = page.locator('table.table-compact span.w-full[data-info] div.cursor-pointer');
    let totalDoses = await doseDivs.count();
    console.log(`\n📊 Total dosis en tabla: ${totalDoses}`);

    if (totalDoses === 0) {
      const fallback = page.locator('span[data-info] div.cursor-pointer');
      totalDoses = await fallback.count();
      console.log(`📊 Fallback: ${totalDoses}`);
    }

    // Elegir 5 aleatorias
    const indices = Array.from({ length: totalDoses }, (_, i) => i);
    const shuffled = indices.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(5, totalDoses)).sort((a, b) => a - b);

    console.log(`\n📋 5 dosis aleatorias seleccionadas: ${selected.map(i => i + 1).join(', ')}\n`);

    let assigned = 0;
    for (const idx of selected) {
      const div = doseDivs.nth(idx);
      const parentSpan = div.locator('xpath=ancestor::span[contains(@class,"w-full")]');
      const dataInfo = await parentSpan.getAttribute('data-info').catch(() => '?') || '?';
      const text = (await div.textContent().catch(() => ''))?.trim() || '?';
      const row = div.locator('xpath=ancestor::tr[1]');
      const vaccineName = (await row.locator('td').first().textContent().catch(() => ''))?.trim() || '?';
      try {
        await fillDoseDate(page, div, vaccineName, text, idx);
        assigned++;
      } catch (e: any) {
        console.log(`    ❌ Error: ${e.message?.substring(0, 60)}`);
      }
    }
    console.log(`\n✅ ${assigned}/5 dosis completadas`);

    // Vacuna diferente al final
    console.log(`\n📋 Agregando vacuna diferente...`);
    await fillVacunaDiferente(page);

    await captureScreenshot(page, 'vacunacion-final');
    console.log('\n  📋 === FIN STRESS TEST VACUNACIÓN ===\n');
  });
});
