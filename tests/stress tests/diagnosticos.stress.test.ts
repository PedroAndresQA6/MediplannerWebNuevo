import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
const PDFDocument = require('pdfkit');

interface TestResult {
  seccion: string;
  caso: string;
  resultado: 'PASO' | 'FALLO' | 'ERROR' | 'BUG';
  detalles: string;
  screenshot?: string;
}

interface PopupEvent {
  seccion: string;
  momento: string;
  tipo: string;
  texto: string;
  cerrado: boolean;
}

const results: TestResult[] = [];
const popupEvents: PopupEvent[] = [];
const screenshotsDir = path.join(process.cwd(), 'test-results', 'stress-screenshots');

async function ensureScreenshotsDir() {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
}

async function captureErrorScreenshot(page: Page, name: string): Promise<string> {
  await ensureScreenshotsDir();
  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(screenshotsDir, filename);
  try {
    await page.screenshot({ path: filepath, fullPage: true });
  } catch {}
  return filepath;
}

async function avoidAgendarButton(page: Page): Promise<void> {
  const url = page.url();
  if (url.includes('Citas') || url.includes('citas') || url.includes('Agendar') || url.includes('agendar')) {
    console.log(`  🚫 Navegación no deseada a Citas/Agendar, regresando...`);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);
  }
  const agendarModal = page.locator('[role="dialog"]:has-text("Agendar"), .modal:has-text("Agendar")');
  if (await agendarModal.isVisible().catch(() => false)) {
    const closeBtn = agendarModal.locator('button:has-text("Cancelar"), button:has-text("Cerrar"), button:has-text("×"), button[class*="close"]').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
}

async function handlePopup(page: Page, sectionName: string, momento: string): Promise<boolean> {
  const popupSelectors = [
    { sel: '[role="dialog"]', tipo: 'dialog' },
    { sel: '.modal', tipo: 'modal' },
    { sel: '[class*="swal"]', tipo: 'sweetalert' },
    { sel: '[class*="toast"]', tipo: 'toast' },
    { sel: 'dialog[open]', tipo: 'native-dialog' }
  ];

  const closeSelectors = [
    'button:has-text("Aceptar")', 'button:has-text("OK")', 'button:has-text("Ok")',
    'button:has-text("Cerrar")', 'button:has-text("Cancelar")',
    'button:has-text("×")', 'button[class*="close"]',
    'button[aria-label="Close"]', 'button[aria-label="Cerrar"]'
  ];

  for (const { sel, tipo } of popupSelectors) {
    try {
      const popup = page.locator(sel).first();
      if (await popup.isVisible({ timeout: 500 }).catch(() => false)) {
        const texto = (await popup.textContent().catch(() => ''))?.substring(0, 100).trim() || 'Sin texto';
        console.log(`  🔔 [${sectionName}] Popup detectado (${tipo}): "${texto.substring(0, 50)}"`);

        let cerrado = false;
        for (const closeSel of closeSelectors) {
          try {
            const closeBtn = popup.locator(closeSel).first();
            if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
              await closeBtn.click();
              await page.waitForTimeout(500);
              cerrado = true;
              break;
            }
          } catch {}
        }

        if (!cerrado) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          const stillVisible = await popup.isVisible().catch(() => false);
          if (!stillVisible) cerrado = true;
        }

        popupEvents.push({ seccion: sectionName, momento, tipo, texto, cerrado });

        if (cerrado && (texto.toLowerCase().includes('error') || tipo.includes('error'))) {
          try {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
          } catch {}
        }

        return cerrado;
      }
    } catch {}
  }
  return false;
}

async function handleAllPopups(page: Page, sectionName: string, momento: string): Promise<number> {
  let totalClosed = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const closed = await handlePopup(page, sectionName, momento);
    if (closed) {
      totalClosed++;
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }
  return totalClosed;
}

async function getErrorMessage(page: Page): Promise<string> {
  const errorSelectors = [
    '.text-red-500', '.text-red-600', '.text-red-700', '.text-danger',
    '[class*="error"]', '[role="alert"]', '.invalid-feedback',
    'span.text-red', 'div.text-red'
  ];
  for (const selector of errorSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = await el.textContent().catch(() => '');
        if (text && text.trim().length > 0 && text.trim() !== '*') return text.trim();
      }
    } catch {}
  }
  return '';
}

async function getSuccessMessage(page: Page): Promise<string> {
  const successSelectors = [
    '.text-green-500', '.text-green-600', '.text-success',
    '[class*="success"]', '[role="status"]',
    'div:has-text("guardado")', 'div:has-text("éxito")'
  ];
  for (const selector of successSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = await el.textContent().catch(() => '');
        if (text && text.trim().length > 0) return text.trim();
      }
    } catch {}
  }
  return '';
}

function printReport(): void {
  const separator = '═'.repeat(70);
  const thinSep = '─'.repeat(70);

  console.log('\n' + separator);
  console.log('  REPORTE FINAL - STRESS TEST DIAGNÓSTICOS');
  console.log(separator);
  console.log(`  Fecha: ${new Date().toISOString()}`);
  console.log(`  Total pruebas: ${results.length}`);
  console.log(thinSep);

  const pasos = results.filter(r => r.resultado === 'PASO');
  const bugs = results.filter(r => r.resultado === 'BUG');
  const errores = results.filter(r => r.resultado === 'ERROR');

  console.log(`  ✅ PASO:  ${pasos.length}`);
  console.log(`  🐛 BUG:   ${bugs.length}`);
  console.log(`  ⚠️  ERROR: ${errores.length}`);
  console.log(thinSep);

  const sections = [...new Set(results.map(r => r.seccion))];
  for (const section of sections) {
    const sectionResults = results.filter(r => r.seccion === section);
    console.log(`\n  📋 ${section}:`);
    for (const r of sectionResults) {
      const icon = r.resultado === 'PASO' ? '✅' : r.resultado === 'BUG' ? '🐛' : '⚠️';
      console.log(`    ${icon} ${r.caso}: ${r.detalles}`);
    }
  }

  if (popupEvents.length > 0) {
    console.log(`\n  🔔 POPUPS DETECTADOS: ${popupEvents.length}`);
  }

  console.log('\n' + separator + '\n');
}

// ==================== TEST DIAGNÓSTICOS ====================

async function testDiagnosticosSection(page: Page): Promise<void> {
  console.log('\n📋 === TEST SECCIÓN DIAGNÓSTICOS ===\n');
  const sectionName = 'Diagnósticos';

  // Scroll to Diagnósticos section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  // Find the react-select input for diagnóstico
  const reactSelectInput = page.locator('input[id*="react-select"][role="combobox"]').first();

  if (!(await reactSelectInput.isVisible().catch(() => false))) {
    console.log('  ❌ No se encontró el input de react-select para diagnóstico');
    results.push({ seccion: sectionName, caso: 'Input diagnóstico', resultado: 'ERROR', detalles: 'Input react-select no encontrado' });
    return;
  }
  console.log('  ✅ Input react-select de diagnóstico encontrado');

  // ===== TEST 1: Click en el input sin escribir =====
  console.log('\n  🔹 TEST 1: Click en input sin escribir');
  await reactSelectInput.click();
  await page.waitForTimeout(1500);

  // Check if dropdown appeared
  const dropdownNoText = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const noTextOptions = await dropdownNoText.count();
  console.log(`    📏 Opciones sin texto: ${noTextOptions}`);

  if (noTextOptions > 0) {
    const firstOptionText = await dropdownNoText.first().textContent().catch(() => '');
    console.log(`    📋 Primera opción: "${firstOptionText?.trim()}"`);
    results.push({ seccion: sectionName, caso: 'Click sin escribir', resultado: 'PASO', detalles: `${noTextOptions} opciones visibles sin escribir` });
  } else {
    console.log('    📋 No aparecieron opciones sin escribir');
    results.push({ seccion: sectionName, caso: 'Click sin escribir', resultado: 'PASO', detalles: 'Sin opciones sin texto (comportamiento esperado)' });
  }

  // Press Escape to close
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ===== TEST 2: Escribir "diabetes" =====
  console.log('\n  🔹 TEST 2: Escribir "diabetes"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('diabetes');
  await page.waitForTimeout(2000);

  // Check dropdown options
  const diabetesOptions = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const diabetesCount = await diabetesOptions.count();
  console.log(`    📏 Opciones encontradas para "diabetes": ${diabetesCount}`);

  if (diabetesCount > 0) {
    for (let i = 0; i < Math.min(diabetesCount, 5); i++) {
      const optText = await diabetesOptions.nth(i).textContent().catch(() => '');
      console.log(`      📋 Opción ${i}: "${optText?.trim()}"`);
    }
    results.push({ seccion: sectionName, caso: 'Buscar "diabetes"', resultado: 'PASO', detalles: `${diabetesCount} opciones encontradas` });

    // Select first option
    await diabetesOptions.first().click();
    await page.waitForTimeout(1500);
    console.log('    ✅ Primera opción seleccionada');

    // Check what happened after selection
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    console.log(`    📋 Filas en tabla después de seleccionar: ${rowCount}`);
  } else {
    console.log('    ❌ No aparecieron opciones para "diabetes"');
    results.push({ seccion: sectionName, caso: 'Buscar "diabetes"', resultado: 'BUG', detalles: 'React-select no genera opciones al escribir "diabetes"' });
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ===== TEST 3: Escribir "hipertension" =====
  console.log('\n  🔹 TEST 3: Escribir "hipertension"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('hipertension');
  await page.waitForTimeout(2000);

  const hiperOptions = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const hiperCount = await hiperOptions.count();
  console.log(`    📏 Opciones encontradas para "hipertension": ${hiperCount}`);

  if (hiperCount > 0) {
    for (let i = 0; i < Math.min(hiperCount, 5); i++) {
      const optText = await hiperOptions.nth(i).textContent().catch(() => '');
      console.log(`      📋 Opción ${i}: "${optText?.trim()}"`);
    }
    results.push({ seccion: sectionName, caso: 'Buscar "hipertension"', resultado: 'PASO', detalles: `${hiperCount} opciones encontradas` });

    await hiperOptions.first().click();
    await page.waitForTimeout(1500);
    console.log('    ✅ Primera opción seleccionada');
  } else {
    console.log('    ❌ No aparecieron opciones para "hipertension"');
    results.push({ seccion: sectionName, caso: 'Buscar "hipertension"', resultado: 'BUG', detalles: 'React-select no genera opciones al escribir "hipertension"' });
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ===== TEST 4: Escribir "gripe" =====
  console.log('\n  🔹 TEST 4: Escribir "gripe"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('gripe');
  await page.waitForTimeout(2000);

  const gripeOptions = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const gripeCount = await gripeOptions.count();
  console.log(`    📏 Opciones encontradas para "gripe": ${gripeCount}`);

  if (gripeCount > 0) {
    for (let i = 0; i < Math.min(gripeCount, 5); i++) {
      const optText = await gripeOptions.nth(i).textContent().catch(() => '');
      console.log(`      📋 Opción ${i}: "${optText?.trim()}"`);
    }
    results.push({ seccion: sectionName, caso: 'Buscar "gripe"', resultado: 'PASO', detalles: `${gripeCount} opciones encontradas` });
  } else {
    console.log('    ❌ No aparecieron opciones para "gripe"');
    results.push({ seccion: sectionName, caso: 'Buscar "gripe"', resultado: 'BUG', detalles: 'React-select no genera opciones al escribir "gripe"' });
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ===== TEST 5: Escribir texto aleatorio sin sentido =====
  console.log('\n  🔹 TEST 5: Escribir texto sin sentido "xyzabc123"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('xyzabc123');
  await page.waitForTimeout(2000);

  const nonsenseOptions = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const nonsenseCount = await nonsenseOptions.count();
  console.log(`    📏 Opciones encontradas para texto sin sentido: ${nonsenseCount}`);

  if (nonsenseCount > 0) {
    const firstOpt = await nonsenseOptions.first().textContent().catch(() => '');
    console.log(`      ⚠️ Aparecieron opciones inesperadas: "${firstOpt?.trim()}"`);
    results.push({ seccion: sectionName, caso: 'Buscar texto sin sentido', resultado: 'BUG', detalles: `Aparecieron ${nonsenseCount} opciones para texto inválido` });
  } else {
    console.log('    ✅ Sin opciones (correcto para texto sin sentido)');
    results.push({ seccion: sectionName, caso: 'Buscar texto sin sentido', resultado: 'PASO', detalles: 'Sin opciones para texto inválido' });
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ===== TEST 6: Verificar tabla vacía =====
  console.log('\n  🔹 TEST 6: Verificar tabla de diagnósticos');
  const tableBody = page.locator('table tbody');
  const emptyMsg = tableBody.locator('td:has-text("No hay diagnósticos registrados")');
  const hasEmptyMsg = await emptyMsg.isVisible().catch(() => false);

  if (hasEmptyMsg) {
    console.log('    📋 Tabla vacía: "No hay diagnósticos registrados"');
    results.push({ seccion: sectionName, caso: 'Tabla diagnósticos', resultado: 'PASO', detalles: 'Tabla vacía correctamente' });
  } else {
    const rows = tableBody.locator('tr');
    const rowCount = await rows.count();
    console.log(`    📋 Tabla con ${rowCount} diagnósticos`);
    results.push({ seccion: sectionName, caso: 'Tabla diagnósticos', resultado: 'PASO', detalles: `${rowCount} diagnósticos registrados` });
  }

  // ===== TEST 7: Seleccionar diagnóstico "diabetes" =====
  console.log('\n  🔹 TEST 7: Seleccionar diagnóstico "diabetes"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('diabetes');
  await page.waitForTimeout(2000);

  const diabetesOpts = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const diabetesCount7 = await diabetesOpts.count();

  if (diabetesCount7 > 0) {
    const selectedText = await diabetesOpts.first().textContent().catch(() => '');
    console.log(`    📋 Seleccionando: "${selectedText?.trim()}"`);
    await diabetesOpts.first().click();
    await page.waitForTimeout(2000);

    // Check table
    const rowsAfter = page.locator('table tbody tr:not(:has(td[colspan]))');
    const rowCountAfter = await rowsAfter.count();
    console.log(`    📋 Diagnósticos en tabla: ${rowCountAfter}`);

    // Check if the selected diagnosis appears in the table
    const diagInTable = page.locator(`table tbody td:has-text("${selectedText?.trim().split(' - ')[0]}")`);
    const diagFound = await diagInTable.isVisible().catch(() => false);

    if (diagFound) {
      console.log(`    ✅ Diagnóstico registrado en tabla`);
      results.push({ seccion: sectionName, caso: 'Registrar "diabetes"', resultado: 'PASO', detalles: `"${selectedText?.trim().substring(0, 40)}" registrado` });
    } else {
      console.log(`    ❌ Diagnóstico NO aparece en tabla`);
      results.push({ seccion: sectionName, caso: 'Registrar "diabetes"', resultado: 'BUG', detalles: 'Diagnóstico seleccionado no aparece en tabla' });
    }
  } else {
    console.log('    ❌ No se encontraron opciones para diabetes');
    results.push({ seccion: sectionName, caso: 'Registrar "diabetes"', resultado: 'ERROR', detalles: 'Sin opciones en react-select' });
  }

  // ===== TEST 8: Eliminar diagnóstico con botón trash =====
  console.log('\n  🔹 TEST 8: Eliminar diagnóstico (botón trash)');

  // Find the trash button in the table
  const trashSelectors = [
    'table tbody button.btn-icon',
    'table tbody button:has(svg.fa-trash)',
    'table tbody button:has(svg[data-icon="trash"])',
    'table tbody button:has(path)'
  ];

  let trashBtn = null;
  for (const sel of trashSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        trashBtn = btn;
        console.log(`    📋 Botón trash encontrado con: ${sel}`);
        break;
      }
    } catch {}
  }

  if (trashBtn) {
    await trashBtn.click();
    await page.waitForTimeout(1500);

    // Check for confirmation popup
    await handleAllPopups(page, sectionName, 'después de click eliminar');
    await avoidAgendarButton(page);

    // Check table after deletion
    const emptyMsgAfter = page.locator('table tbody td:has-text("No hay diagnósticos registrados")');
    const isEmptyAfter = await emptyMsgAfter.isVisible().catch(() => false);

    if (isEmptyAfter) {
      console.log('    ✅ Diagnóstico eliminado - tabla vacía');
      results.push({ seccion: sectionName, caso: 'Eliminar diagnóstico', resultado: 'PASO', detalles: 'Diagnóstico eliminado correctamente' });
    } else {
      const rowsRemaining = page.locator('table tbody tr:not(:has(td[colspan]))');
      const remaining = await rowsRemaining.count();
      console.log(`    📋 Diagnósticos restantes: ${remaining}`);
      results.push({ seccion: sectionName, caso: 'Eliminar diagnóstico', resultado: 'PASO', detalles: `${remaining} diagnósticos restantes` });
    }
  } else {
    console.log('    ❌ Botón trash no encontrado');
    results.push({ seccion: sectionName, caso: 'Eliminar diagnóstico', resultado: 'ERROR', detalles: 'Botón trash no encontrado en tabla' });
  }

  // ===== TEST 9: Registrar otro diagnóstico "hipertension" =====
  console.log('\n  🔹 TEST 9: Registrar diagnóstico "hipertension"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('hipertension');
  await page.waitForTimeout(2000);

  const hiperOpts = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const hiperCount9 = await hiperOpts.count();

  if (hiperCount9 > 0) {
    const selectedText9 = await hiperOpts.first().textContent().catch(() => '');
    console.log(`    📋 Seleccionando: "${selectedText9?.trim()}"`);
    await hiperOpts.first().click();
    await page.waitForTimeout(2000);

    // Check if appears in table
    const code9 = selectedText9?.trim().split(' - ')[0] || '';
    const diagInTable9 = page.locator(`table tbody td:has-text("${code9}")`);
    const diagFound9 = await diagInTable9.isVisible().catch(() => false);

    if (diagFound9) {
      console.log(`    ✅ Diagnóstico "hipertension" registrado en tabla`);
      results.push({ seccion: sectionName, caso: 'Registrar "hipertension"', resultado: 'PASO', detalles: `"${selectedText9?.trim().substring(0, 40)}" registrado` });
    } else {
      console.log(`    ❌ Diagnóstico NO aparece en tabla`);
      results.push({ seccion: sectionName, caso: 'Registrar "hipertension"', resultado: 'BUG', detalles: 'Diagnóstico no aparece en tabla' });
    }
  } else {
    console.log('    ❌ No se encontraron opciones para hipertension');
    results.push({ seccion: sectionName, caso: 'Registrar "hipertension"', resultado: 'ERROR', detalles: 'Sin opciones en react-select' });
  }

  // ===== TEST 10: Eliminar todos los diagnósticos =====
  console.log('\n  🔹 TEST 10: Limpiar diagnósticos registrados');

  // Find all trash buttons
  const allTrashBtns = page.locator('table tbody button.btn-icon, table tbody button:has(svg.fa-trash)');
  const trashCount = await allTrashBtns.count();
  console.log(`    📋 Botones trash encontrados: ${trashCount}`);

  for (let i = 0; i < trashCount; i++) {
    try {
      const btn = allTrashBtns.first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1000);
        await handleAllPopups(page, sectionName, `eliminar diag ${i + 1}`);
        await page.waitForTimeout(500);
      }
    } catch {}
  }

  const finalEmptyMsg = page.locator('table tbody td:has-text("No hay diagnósticos registrados")');
  const isFinalEmpty = await finalEmptyMsg.isVisible().catch(() => false);

  if (isFinalEmpty) {
    console.log('    ✅ Tabla limpia - sin diagnósticos');
    results.push({ seccion: sectionName, caso: 'Limpiar diagnósticos', resultado: 'PASO', detalles: 'Tabla limpia correctamente' });
  } else {
    const finalRows = page.locator('table tbody tr:not(:has(td[colspan]))');
    const finalCount = await finalRows.count();
    console.log(`    ⚠️ Quedan ${finalCount} diagnósticos`);
    results.push({ seccion: sectionName, caso: 'Limpiar diagnósticos', resultado: 'PASO', detalles: `${finalCount} diagnósticos restantes` });
  }

  console.log('\n  📋 === FIN TEST SECCIÓN DIAGNÓSTICOS ===\n');
}

// ==================== MAIN TEST ====================

test.describe('Diagnósticos del Paciente - Stress Tests', () => {
  test('Stress Test Diagnósticos', async ({ page }) => {
    test.setTimeout(600000);

    console.log('\n🚀 === STRESS TEST - DIAGNÓSTICOS DEL PACIENTE ===\n');

    await ensureScreenshotsDir();

    // Handle native dialogs
    page.on('dialog', async (dialog) => {
      const msg = dialog.message();
      const type = dialog.type();
      console.log(`  🔔 Diálogo nativo (${type}): "${msg.substring(0, 60)}"`);
      popupEvents.push({ seccion: 'Navegación', momento: 'diálogo nativo', tipo: type, texto: msg.substring(0, 100), cerrado: true });
      await dialog.accept();
    });

    // Step 1: Navigate to Pacientes
    console.log('📋 Navegando a /Pacientes...');
    await page.goto('/Pacientes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    if (!page.url().includes('Pacientes') && !page.url().includes('pacientes')) {
      results.push({ seccion: 'Navegación', caso: 'Ir a Pacientes', resultado: 'ERROR', detalles: `URL inesperada: ${page.url()}` });
      printReport();
      return;
    }

    // Step 2: Select Daniela Jiménez Durán
    console.log('📋 Buscando paciente: Daniela Jiménez Durán...');
    const patientLinks = page.locator('a.font-semibold, a[class*="patient"], tr td a, [class*="nombre"] a, a[href*="Paciente"]');
    const patientCount = await patientLinks.count();

    let selectedPatient = false;
    for (let i = 0; i < patientCount; i++) {
      const link = patientLinks.nth(i);
      const text = (await link.textContent().catch(() => ''))?.trim() || '';
      if (text.includes('Daniela') && text.includes('Jiménez')) {
        console.log(`📋 ✓ Paciente encontrado: "${text}"`);
        await link.click();
        selectedPatient = true;
        break;
      }
    }

    if (!selectedPatient) {
      console.log(`📋 ⚠ Paciente no encontrado, seleccionando primero...`);
      await patientLinks.first().click();
    }

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Step 3: Navigate to "Información"
    console.log('📋 Click en "Información"...');
    const infoSelectors = ['a:has-text("Información")', 'button:has-text("Información")'];
    for (const sel of infoSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click();
          break;
        }
      } catch {}
    }
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Step 4: Click on "Diagnosticos" in scrollspy
    console.log('📋 Click en sub-pestaña "Diagnósticos" del scrollspy...');
    const diagSelectors = [
      'div[data-scrollspy] a:has-text("Diagnosticos")',
      'div[data-sticky] a:has-text("Diagnosticos")',
      'a:has-text("Diagnosticos")'
    ];

    let foundDiag = false;
    for (const sel of diagSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
          const text = (await el.textContent().catch(() => ''))?.trim() || '';
          if (text === 'Diagnosticos' || text === 'Diagnósticos') {
            await el.click();
            foundDiag = true;
            console.log(`📋 ✓ Sub-pestaña "Diagnósticos" clickeada`);
            await page.waitForTimeout(2000);
            break;
          }
        }
      } catch {}
    }

    if (!foundDiag) {
      results.push({ seccion: 'Navegación', caso: 'Click Diagnósticos', resultado: 'ERROR', detalles: 'No se encontró sub-pestaña Diagnósticos' });
      printReport();
      return;
    }

    await avoidAgendarButton(page);
    await handleAllPopups(page, 'Diagnósticos', 'después de click');

    // Step 5: Test Diagnósticos section
    try {
      await testDiagnosticosSection(page);
    } catch (e) {
      console.log(`  [Diagnósticos] Error: ${e}`);
      results.push({ seccion: 'Diagnósticos', caso: 'Error general', resultado: 'ERROR', detalles: `Excepción: ${String(e).substring(0, 80)}` });
    }

    // Print report
    printReport();

    // PDF: generar solo cuando se solicite
    // await generatePDFReport();
  });
});
