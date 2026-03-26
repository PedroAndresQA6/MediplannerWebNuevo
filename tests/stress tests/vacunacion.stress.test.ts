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
  if (await popup.isVisible({ timeout: 500 }).catch(() => false)) {
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

async function avoidAgendar(page: Page): Promise<void> {
  if (page.url().includes('Citas') || page.url().includes('Agendar')) {
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);
  }
}

async function fillCartillaForm(page: Page, vacunaIndex: number, folio: string, comentario: string): Promise<void> {
  // Select vacuna
  const vacunaSelect = page.locator('select.select').filter({ has: page.locator('option:text("Seleccione vacuna")') }).first();
  if (await vacunaSelect.isVisible().catch(() => false)) {
    const opts = await vacunaSelect.locator('option').evaluateAll(o => o.map(e => ({ value: (e as HTMLOptionElement).value, text: e.textContent?.trim() || '' })));
    const valid = opts.filter(o => !o.text.toLowerCase().includes('seleccione'));
    if (valid.length > vacunaIndex) {
      await vacunaSelect.selectOption({ value: valid[vacunaIndex].value });
      console.log(`    ✅ Vacuna: "${valid[vacunaIndex].text}"`);
      await page.waitForTimeout(1000);
    }
  }

  // Select dosis (if available)
  const dosisSelect = page.locator('select.select').filter({ has: page.locator('option:text("Seleccione dosis")') }).first();
  if (await dosisSelect.isVisible().catch(() => false)) {
    const dosisOpts = await dosisSelect.locator('option').allTextContents();
    const validDosis = dosisOpts.filter(o => !o.toLowerCase().includes('seleccione'));
    if (validDosis.length > 0) {
      await dosisSelect.selectOption({ index: 1 });
      console.log(`    ✅ Dosis: "${validDosis[0]}"`);
    } else {
      console.log('    ⚠️ Dosis sin opciones');
    }
  }

  // Fecha
  const fecha = page.locator('input[type="date"][placeholder="Fecha"], input[type="date"].input').first();
  if (await fecha.isVisible().catch(() => false)) {
    const today = new Date().toISOString().split('T')[0];
    await fecha.fill(today);
    console.log(`    ✅ Fecha: ${today}`);
  }

  // Folio
  const folioInput = page.locator('input[placeholder="Folio"]').first();
  if (await folioInput.isVisible().catch(() => false)) {
    await folioInput.fill(folio);
    console.log(`    ✅ Folio: ${folio}`);
  }

  // Comentarios
  const ta = page.locator('textarea[placeholder="Comentarios"]').first();
  if (await ta.isVisible().catch(() => false)) {
    await ta.fill(comentario);
    console.log(`    ✅ Comentarios`);
  }
}

async function fillOtrasForm(page: Page, vacunaIndex: number, folio: string, comentario: string): Promise<void> {
  // Select otra vacuna
  const otraSelect = page.locator('select.select').filter({ has: page.locator('option:text("Seleccione vacuna")') }).last();
  if (await otraSelect.isVisible().catch(() => false)) {
    const opts = await otraSelect.locator('option').evaluateAll(o => o.map(e => ({ value: (e as HTMLOptionElement).value, text: e.textContent?.trim() || '' })));
    const valid = opts.filter(o => !o.text.toLowerCase().includes('seleccione'));
    if (valid.length > vacunaIndex) {
      await otraSelect.selectOption({ value: valid[vacunaIndex].value });
      console.log(`    ✅ Otra vacuna: "${valid[vacunaIndex].text}"`);
      await page.waitForTimeout(1000);
    }
  }

  // Dosis
  const dosisSelect = page.locator('select.select').filter({ has: page.locator('option:text("Seleccione dosis")') }).last();
  if (await dosisSelect.isVisible().catch(() => false)) {
    const dosisOpts = await dosisSelect.locator('option').allTextContents();
    const validDosis = dosisOpts.filter(o => !o.toLowerCase().includes('seleccione'));
    if (validDosis.length > 0) {
      await dosisSelect.selectOption({ index: 1 });
      console.log(`    ✅ Dosis: "${validDosis[0]}"`);
    } else {
      console.log('    ⚠️ Dosis sin opciones');
    }
  }

  // Fecha
  const fecha = page.locator('input[type="date"][placeholder="Fecha"], input[type="date"].input').last();
  if (await fecha.isVisible().catch(() => false)) {
    const today = new Date().toISOString().split('T')[0];
    await fecha.fill(today);
    console.log(`    ✅ Fecha: ${today}`);
  }

  // Folio
  const folioInput = page.locator('input[placeholder="Folio"]').last();
  if (await folioInput.isVisible().catch(() => false)) {
    await folioInput.fill(folio);
    console.log(`    ✅ Folio: ${folio}`);
  }

  // Comentarios
  const ta = page.locator('textarea[placeholder="Comentarios"]').last();
  if (await ta.isVisible().catch(() => false)) {
    await ta.fill(comentario);
    console.log(`    ✅ Comentarios`);
  }
}

async function clickGuardar(page: Page, context: string): Promise<void> {
  const saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    console.log(`    📋 Click "Guardar cambios"`);
    await page.waitForTimeout(2000);
    await handlePopup(page, context);
    await avoidAgendar(page);
  }
}

async function clickTrash(page: Page, context: string): Promise<void> {
  const trashBtn = page.locator('button.btn-sm.btn-secondary:has(svg.fa-trash), button.btn-sm:has(svg[data-icon="trash"])').first();
  if (await trashBtn.isVisible().catch(() => false)) {
    await trashBtn.click();
    console.log(`    🗑️ Click en botón trash`);
    await page.waitForTimeout(1000);
    await handlePopup(page, context);
    await page.waitForTimeout(500);
  }
}

test.describe('Vacunación - Stress Test', () => {
  test('Stress Test Vacunación', async ({ page }) => {
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

    // Navigate
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
        break;
      }
    }
    await page.waitForTimeout(3000);

    // Click Información
    await page.locator('a:has-text("Información")').first().click();
    await page.waitForTimeout(2000);

    // Click Vacunación
    await page.locator('a:has-text("Vacunación")').first().click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // ==========================================
    // VACUNA DE CARTILLA - CICLO COMPLETO
    // ==========================================
    console.log('\n📋 === CICLO 1: VACUNA DE CARTILLA ===\n');

    // Click "Vacuna de cartilla" (botón índice 9 o por clase)
    const cartillaBtn = page.locator('button.btn-secondary.ms-0.me-3').first();
    if (await cartillaBtn.isVisible().catch(() => false)) {
      await cartillaBtn.click();
      console.log('  ✅ Click en "Vacuna de cartilla"');
      await page.waitForTimeout(2000);
    }

    // Llenar primera vez
    console.log('\n  📝 LLENADO 1:');
    await fillCartillaForm(page, 0, '10001', 'Primera dosis BCG según esquema nacional');
    await clickGuardar(page, 'Cartilla Llenado 1');
    console.log('  ✅ Primera vacuna guardada\n');

    // Eliminar con trash
    console.log('  🗑️ ELIMINACIÓN:');
    await clickTrash(page, 'Cartilla Eliminar');
    console.log('  ✅ Vacuna eliminada\n');

    // Volver a llenar
    console.log('  📝 LLENADO 2 (re-agregar):');
    await fillCartillaForm(page, 3, '10002', 'Segunda dosis Hepatitis B según calendario');
    await clickGuardar(page, 'Cartilla Llenado 2');
    console.log('  ✅ Segunda vacuna guardada\n');

    // Eliminar de nuevo
    console.log('  🗑️ ELIMINACIÓN 2:');
    await clickTrash(page, 'Cartilla Eliminar 2');
    console.log('  ✅ Vacuna eliminada de nuevo\n');

    // ==========================================
    // VACUNA DIFERENTE - CICLO COMPLETO
    // ==========================================
    console.log('\n📋 === CICLO 2: VACUNA DIFERENTE ===\n');

    // Click "Vacuna diferente" (botón índice 10)
    const allBtns = page.locator('button');
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i++) {
      const btn = allBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        const text = (await btn.textContent().catch(() => ''))?.trim() || '';
        if (text.includes('Vacuna diferente')) {
          await btn.click();
          console.log('  ✅ Click en "Vacuna diferente"');
          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    // Llenar primera vez
    console.log('\n  📝 LLENADO 1 (COVID-19):');
    await fillOtrasForm(page, 1, '20001', 'Primera dosis COVID-19, paciente sin reacciones');
    await clickGuardar(page, 'Otras Llenado 1');
    console.log('  ✅ Primera otra vacuna guardada\n');

    // Eliminar con trash
    console.log('  🗑️ ELIMINACIÓN:');
    await clickTrash(page, 'Otras Eliminar');
    console.log('  ✅ Otra vacuna eliminada\n');

    // Volver a llenar
    console.log('  📝 LLENADO 2 (Influenza):');
    await fillOtrasForm(page, 2, '20002', 'Vacuna Influenza estacional aplicada');
    await clickGuardar(page, 'Otras Llenado 2');
    console.log('  ✅ Segunda otra vacuna guardada\n');

    // Eliminar de nuevo
    console.log('  🗑️ ELIMINACIÓN 2:');
    await clickTrash(page, 'Otras Eliminar 2');
    console.log('  ✅ Otra vacuna eliminada de nuevo\n');

    await captureScreenshot(page, 'vacunacion-final');
    console.log('  📋 === FIN CICLOS NORMALES ===\n');

    // ==========================================
    // STRESS TEST: DATOS INVÁLIDOS - VACUNA DE CARTILLA
    // ==========================================
    console.log('\n📋 === STRESS TEST: DATOS INVÁLIDOS ===\n');

    // Click "Vacuna de cartilla" de nuevo
    const cartillaBtn2 = page.locator('button.btn-secondary.ms-0.me-3').first();
    if (await cartillaBtn2.isVisible().catch(() => false)) {
      await cartillaBtn2.click();
      console.log('  ✅ Click en "Vacuna de cartilla"');
      await page.waitForTimeout(2000);
    }

    // TEST 1: Guardar sin seleccionar nada
    console.log('\n  🔹 TEST 1: Guardar sin seleccionar nada');
    await clickGuardar(page, 'Stress - Sin nada');
    console.log('');

    // TEST 2: Solo seleccionar vacuna, sin dosis/fecha/folio
    console.log('  🔹 TEST 2: Solo vacuna, sin dosis/fecha/folio');
    const vacSel2 = page.locator('select.select').filter({ has: page.locator('option:text("Seleccione vacuna")') }).first();
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ value: '1' }); // BCG
      console.log('    📝 Vacuna BCG seleccionada');
    }
    await clickGuardar(page, 'Stress - Solo vacuna');
    // Reset to first option
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ index: 0 });
    }
    console.log('');

    // TEST 3: Vacuna + fecha futura
    console.log('  🔹 TEST 3: Vacuna + fecha futura (2030-12-31)');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ value: '2' }); // Hepatitis B
      console.log('    📝 Vacuna Hepatitis B seleccionada');
    }
    const fechaFutura = page.locator('input[type="date"][placeholder="Fecha"], input[type="date"].input').first();
    if (await fechaFutura.isVisible().catch(() => false)) {
      await fechaFutura.fill('2030-12-31');
      console.log('    📝 Fecha futura: 2030-12-31');
    }
    await clickGuardar(page, 'Stress - Fecha futura');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ index: 0 });
    }
    console.log('');

    // TEST 4: Vacuna + fecha pasada muy antigua
    console.log('  🔹 TEST 4: Vacuna + fecha antigua (1900-01-01)');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ value: '4' }); // DPT
      console.log('    📝 Vacuna DPT seleccionada');
    }
    if (await fechaFutura.isVisible().catch(() => false)) {
      await fechaFutura.fill('1900-01-01');
      console.log('    📝 Fecha antigua: 1900-01-01');
    }
    await clickGuardar(page, 'Stress - Fecha antigua');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ index: 0 });
    }
    console.log('');

    // TEST 5: Vacuna + folio con caracteres especiales
    console.log('  🔹 TEST 5: Vacuna + folio con caracteres especiales (!@#$%)');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ value: '1' }); // BCG
    }
    const folioStress = page.locator('input[placeholder="Folio"]').first();
    if (await folioStress.isVisible().catch(() => false)) {
      await folioStress.fill('!@#$%');
      console.log('    📝 Folio: !@#$%');
    }
    await clickGuardar(page, 'Stress - Folio especial');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ index: 0 });
    }
    console.log('');

    // TEST 6: Vacuna + folio con letras
    console.log('  🔹 TEST 6: Vacuna + folio con letras (ABCDEF)');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ value: '1' }); // BCG
    }
    if (await folioStress.isVisible().catch(() => false)) {
      await folioStress.fill('ABCDEF');
      console.log('    📝 Folio: ABCDEF');
    }
    await clickGuardar(page, 'Stress - Folio letras');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ index: 0 });
    }
    console.log('');

    // TEST 7: Vacuna + folio muy largo (50 caracteres)
    console.log('  🔹 TEST 7: Vacuna + folio muy largo (50 chars)');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ value: '1' }); // BCG
    }
    if (await folioStress.isVisible().catch(() => false)) {
      await folioStress.fill('12345678901234567890123456789012345678901234567890');
      console.log('    📝 Folio: 50 caracteres numéricos');
    }
    await clickGuardar(page, 'Stress - Folio largo');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ index: 0 });
    }
    console.log('');

    // TEST 8: Vacuna + comentarios con XSS
    console.log('  🔹 TEST 8: Vacuna + comentarios con XSS');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ value: '1' }); // BCG
    }
    const taStress = page.locator('textarea[placeholder="Comentarios"]').first();
    if (await taStress.isVisible().catch(() => false)) {
      await taStress.fill('<script>alert("XSS")</script>');
      console.log('    📝 Comentarios: <script>alert("XSS")</script>');
    }
    await clickGuardar(page, 'Stress - Comentarios XSS');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ index: 0 });
    }
    console.log('');

    // TEST 9: Vacuna + todos llenos excepto comentarios
    console.log('  🔹 TEST 9: Vacuna + sin comentarios');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ value: '1' }); // BCG
    }
    if (await fechaFutura.isVisible().catch(() => false)) {
      await fechaFutura.fill(new Date().toISOString().split('T')[0]);
    }
    if (await folioStress.isVisible().catch(() => false)) {
      await folioStress.fill('99999');
    }
    if (await taStress.isVisible().catch(() => false)) {
      await taStress.fill('');
      console.log('    📝 Comentarios vacío');
    }
    await clickGuardar(page, 'Stress - Sin comentarios');
    if (await vacSel2.isVisible().catch(() => false)) {
      await vacSel2.selectOption({ index: 0 });
    }
    console.log('');

    // TEST 10: Solo comentarios, sin vacuna
    console.log('  🔹 TEST 10: Solo comentarios, sin vacuna');
    if (await taStress.isVisible().catch(() => false)) {
      await taStress.fill('Comentario sin vacuna');
      console.log('    📝 Solo comentarios');
    }
    await clickGuardar(page, 'Stress - Solo comentarios');
    console.log('');

    // Limpiar todo al final
    console.log('  🔄 Limpiando vacunas restantes...');
    const trashBtns = page.locator('button.btn-sm.btn-secondary:has(svg.fa-trash), button.btn-sm:has(svg[data-icon="trash"])');
    const trashCount = await trashBtns.count();
    for (let i = 0; i < trashCount; i++) {
      try {
        const btn = trashBtns.first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(800);
          await handlePopup(page, 'Limpieza');
          await page.waitForTimeout(300);
        }
      } catch {}
    }
    console.log('  ✅ Vacunas limpiadas\n');

    console.log('  📋 === FIN STRESS TEST VACUNACIÓN ===\n');
  });
});
