import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const screenshotsDir = path.join(process.cwd(), 'test-results', 'stress-screenshots');

async function captureScreenshot(page: Page, name: string): Promise<void> {
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotsDir, `${name}-${Date.now()}.png`), fullPage: true }).catch(() => {});
}

async function handlePopup(page: Page, context: string): Promise<void> {
  const popup = page.locator('[role="dialog"], .modal, [class*="swal"], [class*="popup"]').first();
  if (await popup.isVisible({ timeout: 500 }).catch(() => false)) {
    const text = (await popup.textContent().catch(() => ''))?.substring(0, 80) || '';
    console.log(`    🔔 [${context}] Popup: "${text}"`);
    const closeBtn = popup.locator('button:has-text("Aceptar"), button:has-text("OK"), button:has-text("Cerrar"), button:has-text("×")').first();
    if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
}

async function avoidAgendar(page: Page): Promise<void> {
  if (page.url().includes('Citas') || page.url().includes('Agendar')) {
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);
  }
}

async function clickGuardar(page: Page, context: string): Promise<void> {
  const saveBtn = page.locator('button[type="submit"]:has-text("Guardar"), button:has-text("Guardar Respuestas"), button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    console.log(`    📋 Click "Guardar Respuestas"`);
    await page.waitForTimeout(2000);
    await handlePopup(page, context);
    await avoidAgendar(page);
  }
}

test.describe('Antecedentes - Stress Test', () => {
  test('Stress Test Antecedentes', async ({ page }) => {
    test.setTimeout(600000);

    console.log('\n🚀 === STRESS TEST ANTECEDENTES ===\n');

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

    // Click Antecedentes in scrollspy
    await page.locator('a:has-text("Antecedentes")').first().click();
    console.log('📋 Sub-pestaña Antecedentes clickeada');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // ==========================================
    // EXPLORAR SELECTS
    // ==========================================
    console.log('\n📋 === EXPLORAR SELECTS ===\n');

    const allSelects = page.locator('select');
    const selectCount = await allSelects.count();
    console.log(`  📋 Selects encontrados: ${selectCount}`);

    for (let i = 0; i < selectCount; i++) {
      const sel = allSelects.nth(i);
      if (await sel.isVisible().catch(() => false)) {
        const name = await sel.getAttribute('name').catch(() => '');
        const id = await sel.getAttribute('id').catch(() => '');
        const options = await sel.locator('option').allTextContents();
        const currentValue = await sel.inputValue().catch(() => '');
        const currentText = await sel.locator('option:checked').textContent().catch(() => '');
        console.log(`    📝 Select ${i}: name="${name}" id="${id}"`);
        console.log(`       Valor actual: "${currentText?.trim()}" (${currentValue})`);
        console.log(`       Opciones: [${options.join(', ')}]`);
      }
    }

    // ==========================================
    // EXPLORAR BOTONES
    // ==========================================
    console.log('\n📋 === EXPLORAR BOTONES ===\n');

    const allBtns = page.locator('button');
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i++) {
      const btn = allBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        const text = (await btn.textContent().catch(() => ''))?.trim() || '';
        const type = await btn.getAttribute('type').catch(() => '');
        const classes = await btn.getAttribute('class').catch(() => '');
        if (!text.toLowerCase().includes('agendar')) {
          console.log(`    📝 Botón ${i}: "${text.substring(0, 40)}" type="${type}" class="${classes?.substring(0, 40)}"`);
        }
      }
    }

    // ==========================================
    // TESTS: RADIO BUTTONS
    // ==========================================
    console.log('\n📋 === TESTS RADIO BUTTONS ===\n');

    // Find all radio buttons grouped by name
    const radios = page.locator('input[type="radio"]');
    const radioCount = await radios.count();
    console.log(`  📋 Radio buttons encontrados: ${radioCount}`);

    // Group radios by their label parent
    const labels = page.locator('label:has(input[type="radio"])');
    const labelCount = await labels.count();
    console.log(`  📋 Labels con radios: ${labelCount}`);

    // Get unique question names
    const radioNames: string[] = [];
    for (let i = 0; i < radioCount; i++) {
      const name = await radios.nth(i).getAttribute('name').catch(() => '');
      if (name && !radioNames.includes(name)) radioNames.push(name);
    }
    console.log(`  📋 Grupos de radio: ${radioNames.join(', ')}`);

    // TEST 1: Guardar sin seleccionar nada
    console.log('\n  🔹 TEST 1: Guardar sin seleccionar nada');
    await clickGuardar(page, 'Ant - Sin nada');

    // TEST 2: Seleccionar "Sí" en Planificación
    console.log('\n  🔹 TEST 2: Seleccionar "Sí" en Planificación');
    const planSi = page.locator('input[type="radio"][value="1"]').first();
    if (await planSi.isVisible().catch(() => false)) {
      await planSi.click();
      console.log('    ✅ Planificación: Sí');
    }
    await clickGuardar(page, 'Ant - Planificación Sí');

    // TEST 3: Seleccionar "No" en Planificación
    console.log('\n  🔹 TEST 3: Seleccionar "No" en Planificación');
    const planNo = page.locator('input[type="radio"][value="2"]').first();
    if (await planNo.isVisible().catch(() => false)) {
      await planNo.click();
      console.log('    ✅ Planificación: No');
    }
    await clickGuardar(page, 'Ant - Planificación No');

    // TEST 4: Seleccionar "Sí" en Embarazos
    console.log('\n  🔹 TEST 4: Seleccionar "Sí" en Embarazos');
    const embSi = page.locator('input[type="radio"][value="1"]').nth(1);
    if (await embSi.isVisible().catch(() => false)) {
      await embSi.click();
      console.log('    ✅ Embarazos: Sí');
    }
    await clickGuardar(page, 'Ant - Embarazos Sí');

    // TEST 5: Seleccionar "No" en Embarazos
    console.log('\n  🔹 TEST 5: Seleccionar "No" en Embarazos');
    const embNo = page.locator('input[type="radio"][value="2"]').nth(1);
    if (await embNo.isVisible().catch(() => false)) {
      await embNo.click();
      console.log('    ✅ Embarazos: No');
    }
    await clickGuardar(page, 'Ant - Embarazos No');

    // TEST 6: Seleccionar "Sí" en Citologías
    console.log('\n  🔹 TEST 6: Seleccionar "Sí" en Citologías y mamografías');
    const citSi = page.locator('input[type="radio"][value="1"]').nth(2);
    if (await citSi.isVisible().catch(() => false)) {
      await citSi.click();
      console.log('    ✅ Citologías: Sí');
    }
    await clickGuardar(page, 'Ant - Citologías Sí');

    // TEST 7: Seleccionar "No" en Citologías
    console.log('\n  🔹 TEST 7: Seleccionar "No" en Citologías y mamografías');
    const citNo = page.locator('input[type="radio"][value="2"]').nth(2);
    if (await citNo.isVisible().catch(() => false)) {
      await citNo.click();
      console.log('    ✅ Citologías: No');
    }
    await clickGuardar(page, 'Ant - Citologías No');

    // TEST 8: Todos "Sí"
    console.log('\n  🔹 TEST 8: Todos los campos en "Sí"');
    const allSi = page.locator('input[type="radio"][value="1"]');
    const siCount = await allSi.count();
    for (let i = 0; i < siCount; i++) {
      if (await allSi.nth(i).isVisible().catch(() => false)) {
        await allSi.nth(i).click();
      }
    }
    console.log('    ✅ Todos: Sí');
    await clickGuardar(page, 'Ant - Todos Sí');

    // TEST 9: Todos "No"
    console.log('\n  🔹 TEST 9: Todos los campos en "No"');
    const allNo = page.locator('input[type="radio"][value="2"]');
    const noCount = await allNo.count();
    for (let i = 0; i < noCount; i++) {
      if (await allNo.nth(i).isVisible().catch(() => false)) {
        await allNo.nth(i).click();
      }
    }
    console.log('    ✅ Todos: No');
    await clickGuardar(page, 'Ant - Todos No');

    // TEST 10: Combinación mixta
    console.log('\n  🔹 TEST 10: Combinación mixta (Sí, No, Sí)');
    if (await allSi.first().isVisible().catch(() => false)) await allSi.first().click(); // Planificación: Sí
    if (await allNo.nth(1).isVisible().catch(() => false)) await allNo.nth(1).click(); // Embarazos: No
    if (await allSi.nth(2).isVisible().catch(() => false)) await allSi.nth(2).click(); // Citologías: Sí
    console.log('    ✅ Mixto: Plan=Sí, Emb=No, Cit=Sí');
    await clickGuardar(page, 'Ant - Mixto');

    // ==========================================
    // TESTS: SELECTS (si hay)
    // ==========================================
    if (selectCount > 0) {
      console.log('\n📋 === TESTS SELECTS ===\n');

      for (let i = 0; i < selectCount; i++) {
        const sel = allSelects.nth(i);
        if (await sel.isVisible().catch(() => false)) {
          const options = await sel.locator('option').allTextContents();
          const validOpts = options.filter(o => !o.toLowerCase().includes('seleccione') && o.trim() !== '–' && o.trim() !== '');

          // TEST: Seleccionar cada opción
          for (let j = 0; j < Math.min(validOpts.length, 3); j++) {
            const optText = validOpts[j];
            const optValue = await sel.locator('option').nth(options.indexOf(optText)).getAttribute('value').catch(() => '');
            console.log(`  🔹 Select ${i}: Seleccionar "${optText}"`);
            await sel.selectOption({ value: optValue });
            console.log(`    ✅ Seleccionado: "${optText}"`);
            await clickGuardar(page, `Ant - Select ${i}="${optText}"`);
          }

          // TEST: Seleccionar opción vacía
          console.log(`  🔹 Select ${i}: Seleccionar vacío`);
          await sel.selectOption({ index: 0 });
          await clickGuardar(page, `Ant - Select ${i} vacío`);
        }
      }
    }

    // ==========================================
    // TEST: Botón extra (si hay)
    // ==========================================
    console.log('\n📋 === TESTS BOTÓN EXTRA ===\n');

    const extraBtn = page.locator('button').nth(9);
    if (await extraBtn.isVisible().catch(() => false)) {
      const btnText = (await extraBtn.textContent().catch(() => ''))?.trim() || '';
      console.log(`  📋 Botón extra: "${btnText}"`);
      await extraBtn.click();
      await page.waitForTimeout(1500);
      await handlePopup(page, 'Ant - Botón extra');
      await avoidAgendar(page);
    }

    // Reset all to "No" for cleanup
    console.log('\n  🔄 Restaurando valores originales (todos "No")...');
    const allNoFinal = page.locator('input[type="radio"][value="2"]');
    const noFinalCount = await allNoFinal.count();
    for (let i = 0; i < noFinalCount; i++) {
      if (await allNoFinal.nth(i).isVisible().catch(() => false)) {
        await allNoFinal.nth(i).click();
      }
    }
    await clickGuardar(page, 'Ant - Restaurar');
    await captureScreenshot(page, 'antecedentes-final');

    console.log('\n  📋 === FIN STRESS TEST ANTECEDENTES ===\n');
  });
});
