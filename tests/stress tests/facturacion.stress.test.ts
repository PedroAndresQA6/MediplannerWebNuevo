import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
const { setupConsoleMonitor } = require('../../e2e/utils.js');

const screenshotsDir = path.join(process.cwd(), 'test-results', 'stress-screenshots');

async function captureScreenshot(page: Page, name: string): Promise<void> {
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotsDir, `${name}-${Date.now()}.png`), fullPage: true }).catch(() => {});
}

async function handlePopup(page: Page, context: string): Promise<boolean> {
  const popup = page.locator('[role="dialog"], .modal, [class*="swal"], [class*="popup"]').first();
  if (await popup.isVisible({ timeout: 500 }).catch(() => false)) {
    const text = (await popup.textContent().catch(() => ''))?.substring(0, 80) || '';
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

async function clickGuardar(page: Page, context: string): Promise<{ popup: boolean; error: string; success: string }> {
  // Close any lingering SweetAlert first
  const swal = page.locator('.swal2-container, [class*="swal2"]').first();
  if (await swal.isVisible({ timeout: 500 }).catch(() => false)) {
    const swalBtn = swal.locator('button:has-text("OK"), button:has-text("Aceptar"), button:has-text("Cerrar")').first();
    if (await swalBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await swalBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  const saveBtn = page.locator('button[type="submit"]:has-text("Guardar"), button:has-text("Guardar cambios")').first();
  if (!(await saveBtn.isVisible().catch(() => false))) return { popup: false, error: 'Sin botón', success: '' };
  await saveBtn.click();
  await page.waitForTimeout(2000);
  await avoidAgendar(page);

  // Handle SweetAlert specifically
  const swalAfter = page.locator('.swal2-container, [class*="swal2"]').first();
  let closed = false;
  if (await swalAfter.isVisible({ timeout: 1000 }).catch(() => false)) {
    const text = (await swalAfter.textContent().catch(() => ''))?.substring(0, 80) || '';
    console.log(`    🔔 [${context}] SweetAlert: "${text}"`);
    const swalOkBtn = swalAfter.locator('button:has-text("OK"), button:has-text("Aceptar"), button:has-text("Cerrar")').first();
    if (await swalOkBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      await swalOkBtn.click();
      await page.waitForTimeout(500);
      closed = true;
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      closed = true;
    }
  }

  // Also handle toast
  const toast = page.locator('[class*="toast"]').first();
  if (await toast.isVisible({ timeout: 500 }).catch(() => false)) {
    const text = (await toast.textContent().catch(() => ''))?.substring(0, 50) || '';
    console.log(`    🔔 [${context}] Toast: "${text}"`);
    closed = true;
  }

  await avoidAgendar(page);

  const errorSel = page.locator('.text-red-500, .text-danger, [class*="error"], [role="alert"]').first();
  const error = (await errorSel.isVisible({ timeout: 500 }).catch(() => false))
    ? (await errorSel.textContent().catch(() => ''))?.trim() || '' : '';

  const successSel = page.locator('.text-green-500, .text-success, [class*="success"]').first();
  const success = (await successSel.isVisible({ timeout: 500 }).catch(() => false))
    ? (await successSel.textContent().catch(() => ''))?.trim() || '' : '';

  return { popup: closed, error, success };
}

async function fillFacturacion(
  page: Page,
  opts: {
    tipoPersona?: string;
    nombre?: string;
    rfc?: string;
    regimen?: string;
    direccionIgual?: boolean;
    calle?: string;
    numero?: string;
    cp?: string;
    colonia?: string;
  }
): Promise<void> {
  const nombreInput = page.locator('input#nombre, input[name="nombre"]').first();
  const rfcInput = page.locator('input#rfc, input[name="rfc"]').first();
  const tipoPersonaSel = page.locator('select#tipo_persona_id, select[name="tipo_persona_id"]').first();
  const regimenSel = page.locator('select#regimen_id, select[name="regimen_id"]').first();
  const checkbox = page.locator('input#bActivo, input[name="bActivo"]').first();
  const calleInput = page.locator('input[name="calle"]').first();
  const numeroInput = page.locator('input[name="numero_exterior"]').first();
  const cpInput = page.locator('input[name="cp"]').first();

  if (opts.tipoPersona && await tipoPersonaSel.isVisible().catch(() => false)) {
    try {
      await tipoPersonaSel.selectOption({ label: opts.tipoPersona }, { timeout: 5000 });
      console.log(`    ✅ Tipo persona: ${opts.tipoPersona}`);
    } catch {
      throw new Error(
        `🐛 No se pudo seleccionar tipo de persona "${opts.tipoPersona}": el select 'tipo_persona_id' ` +
        `no quedó habilitado de forma estable. El formulario de facturación es inestable: se re-renderiza ` +
        `por el fallo de getFilledForm (422 "El campo relacion_id es requerido"), alternando habilitado/deshabilitado.`
      );
    }
    await page.waitForTimeout(500);
  }

  if (opts.nombre !== undefined && await nombreInput.isVisible().catch(() => false)) {
    await nombreInput.fill(opts.nombre);
    console.log(`    ✅ Nombre: "${opts.nombre}"`);
  }

  if (opts.rfc !== undefined && await rfcInput.isVisible().catch(() => false)) {
    await rfcInput.fill(opts.rfc);
    console.log(`    ✅ RFC: "${opts.rfc}"`);
  }

  if (opts.regimen && await regimenSel.isVisible().catch(() => false)) {
    try {
      await regimenSel.selectOption({ label: opts.regimen }, { timeout: 5000 });
      console.log(`    ✅ Régimen: ${opts.regimen}`);
    } catch {
      throw new Error(
        `🐛 No se pudo seleccionar régimen "${opts.regimen}": el select 'regimen_id' ` +
        `no quedó habilitado de forma estable (formulario de facturación inestable).`
      );
    }
    await page.waitForTimeout(500);
  }

  if (opts.direccionIgual !== undefined && await checkbox.isVisible().catch(() => false)) {
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (opts.direccionIgual && !isChecked) await checkbox.check();
    if (!opts.direccionIgual && isChecked) await checkbox.uncheck();
    console.log(`    ✅ Dirección igual: ${opts.direccionIgual}`);
    await page.waitForTimeout(500);
  }

  if (!opts.direccionIgual) {
    if (opts.calle !== undefined && await calleInput.isVisible().catch(() => false)) {
      await calleInput.fill(opts.calle);
      console.log(`    ✅ Calle: "${opts.calle}"`);
    }
    if (opts.numero !== undefined && await numeroInput.isVisible().catch(() => false)) {
      await numeroInput.fill(opts.numero);
      console.log(`    ✅ Número: "${opts.numero}"`);
    }
    if (opts.cp !== undefined && await cpInput.isVisible().catch(() => false)) {
      await cpInput.fill(opts.cp);
      console.log(`    ✅ CP: "${opts.cp}"`);
      await page.waitForTimeout(2000);

      // Select colonia after CP loads
      const coloniaSel = page.locator('select#colonia_id, select[name="colonia_id"]').first();
      if (await coloniaSel.isVisible().catch(() => false)) {
        const coloniaOpts = await coloniaSel.locator('option').evaluateAll(o =>
          o.map(e => ({ value: (e as HTMLOptionElement).value, text: e.textContent?.trim() || '' }))
        );
        const validColonias = coloniaOpts.filter(o => !o.text.toLowerCase().includes('selecciona') && !o.text.toLowerCase().includes('cargando'));
        if (validColonias.length > 0) {
          const randomIdx = Math.floor(Math.random() * validColonias.length);
          await coloniaSel.selectOption({ value: validColonias[randomIdx].value });
          console.log(`    ✅ Colonia: "${validColonias[randomIdx].text}" (${validColonias.length} opciones)`);
          await page.waitForTimeout(500);
        }
      }
    }
  }
}

test.describe('Facturación - Stress Test', () => {
  test('Stress Test Facturación', async ({ page }) => {
    test.setTimeout(600000);

    const monitor = setupConsoleMonitor(page);
    console.log('🔍 [MONITOR] DevTools monitor activo\n');

    console.log('\n🚀 === STRESS TEST FACTURACIÓN ===\n');

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
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
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

    // Click Facturación
    await page.locator('a:has-text("Facturación")').first().click();
    console.log('📋 Sub-pestaña Facturación clickeada');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    // ==========================================
    // TEST 1: Guardar sin llenar nada
    // ==========================================
    console.log('\n  🔹 TEST 1: Guardar sin llenar nada');
    let res = await clickGuardar(page, 'Fact - Sin nada');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // ==========================================
    // TEST 2: Solo nombre fiscal, sin RFC
    // ==========================================
    console.log('\n  🔹 TEST 2: Solo nombre, sin RFC');
    await fillFacturacion(page, { nombre: 'Daniela Jiménez Durán' });
    res = await clickGuardar(page, 'Fact - Solo nombre');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // Limpiar nombre
    const nombreInput = page.locator('input#nombre').first();
    if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('');

    // ==========================================
    // TEST 3: Solo RFC, sin nombre
    // ==========================================
    console.log('\n  🔹 TEST 3: Solo RFC, sin nombre');
    await fillFacturacion(page, { rfc: 'JIDD230803MQT' });
    res = await clickGuardar(page, 'Fact - Solo RFC');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    const rfcInput = page.locator('input#rfc').first();
    if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('');

    // ==========================================
    // TEST 4: Nombre + RFC inválido (3 caracteres)
    // ==========================================
    console.log('\n  🔹 TEST 4: Nombre + RFC inválido (3 chars)');
    await fillFacturacion(page, { nombre: 'Daniela Jiménez Durán', rfc: 'ABC' });
    res = await clickGuardar(page, 'Fact - RFC 3 chars');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);
    if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('');
    if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('');

    // ==========================================
    // TEST 5: Nombre + RFC con caracteres especiales
    // ==========================================
    console.log('\n  🔹 TEST 5: Nombre + RFC con caracteres especiales');
    await fillFacturacion(page, { nombre: 'Daniela Jiménez Durán', rfc: '!@#$%^&*()' });
    res = await clickGuardar(page, 'Fact - RFC especial');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);
    if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('');
    if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('');

    // ==========================================
    // TEST 6: Nombre + RFC + Tipo persona Física
    // ==========================================
    console.log('\n  🔹 TEST 6: Nombre + RFC + Tipo Persona Física');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: 'Daniela Jiménez Durán',
      rfc: 'JIDD230803MQT'
    });
    res = await clickGuardar(page, 'Fact - Persona Física');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // ==========================================
    // TEST 7: Nombre + RFC + Tipo persona Moral
    // ==========================================
    console.log('\n  🔹 TEST 7: Nombre + RFC + Tipo Persona Moral');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Moral',
      nombre: 'Daniela Jiménez Durán',
      rfc: 'JIDD230803MQT'
    });
    res = await clickGuardar(page, 'Fact - Persona Moral');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // ==========================================
    // TEST 8: Seleccionar régimen fiscal
    // ==========================================
    console.log('\n  🔹 TEST 8: Nombre + RFC + Régimen fiscal');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: 'Daniela Jiménez Durán',
      rfc: 'JIDD230803MQT',
      regimen: 'Sueldos y Salarios e Ingresos Asimilados a Salarios'
    });
    res = await clickGuardar(page, 'Fact - Con régimen');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // ==========================================
    // TEST 9: Con dirección igual a contacto (Sí)
    // ==========================================
    console.log('\n  🔹 TEST 9: Dirección igual a contacto = Sí');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: 'Daniela Jiménez Durán',
      rfc: 'JIDD230803MQT',
      regimen: 'Personas Físicas con Actividades Empresariales y Profesionales',
      direccionIgual: true
    });
    res = await clickGuardar(page, 'Fact - Dir igual Sí');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // ==========================================
    // TEST 10: Con dirección NO igual (llenar dirección)
    // ==========================================
    console.log('\n  🔹 TEST 10: Dirección igual = No (llenar dirección)');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: 'Daniela Jiménez Durán',
      rfc: 'JIDD230803MQT',
      regimen: 'Régimen Simplificado de Confianza',
      direccionIgual: false,
      calle: 'Avenida de la Luz',
      numero: 'S/N',
      cp: '76118'
    });
    await page.waitForTimeout(1500);
    res = await clickGuardar(page, 'Fact - Con dirección');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // ==========================================
    // STRESS TEST: DATOS INVÁLIDOS
    // ==========================================
    console.log('\n📋 === STRESS TEST: DATOS INVÁLIDOS ===\n');

    // TEST 11: Nombre con caracteres especiales
    console.log('  🔹 TEST 11: Nombre con caracteres especiales');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: '<script>alert("XSS")</script>',
      rfc: 'JIDD230803MQT'
    });
    res = await clickGuardar(page, 'Fact - Nombre XSS');
    console.log(`    Resultado: popup=${res.popup}`);

    // TEST 12: RFC muy largo (20 caracteres)
    console.log('  🔹 TEST 12: RFC muy largo (20 chars)');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: 'Daniela Jiménez Durán',
      rfc: 'ABCDEFGHIJKLMNOPQRST'
    });
    const rfcVal = await page.locator('input#rfc').first().inputValue().catch(() => '');
    console.log(`    📏 RFC ingresado: "${rfcVal}" (${rfcVal.length} chars)`);
    res = await clickGuardar(page, 'Fact - RFC largo');
    console.log(`    Resultado: popup=${res.popup}`);

    // TEST 13: RFC vacío
    console.log('  🔹 TEST 13: RFC vacío');
    if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('');
    res = await clickGuardar(page, 'Fact - RFC vacío');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // TEST 14: Nombre vacío
    console.log('  🔹 TEST 14: Nombre vacío');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: '',
      rfc: 'JIDD230803MQT'
    });
    res = await clickGuardar(page, 'Fact - Nombre vacío');
    console.log(`    Resultado: popup=${res.popup} error="${res.error}"`);

    // TEST 15: CP con letras
    console.log('  🔹 TEST 15: CP con letras');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: 'Daniela Jiménez Durán',
      rfc: 'JIDD230803MQT',
      direccionIgual: false,
      calle: 'Avenida de la Luz',
      numero: 'S/N',
      cp: 'ABCDE'
    });
    res = await clickGuardar(page, 'Fact - CP letras');
    console.log(`    Resultado: popup=${res.popup}`);

    // TEST 16: CP con 2 dígitos
    console.log('  🔹 TEST 16: CP con 2 dígitos');
    await fillFacturacion(page, { cp: '12' });
    res = await clickGuardar(page, 'Fact - CP 2 dígitos');
    console.log(`    Resultado: popup=${res.popup}`);

    // TEST 17: Calle con caracteres especiales
    console.log('  🔹 TEST 17: Calle con caracteres especiales');
    await fillFacturacion(page, { calle: '!@#$%^&*()', numero: '123', cp: '76118' });
    res = await clickGuardar(page, 'Fact - Calle especial');
    console.log(`    Resultado: popup=${res.popup}`);

    // TEST 18: Número exterior con letras
    console.log('  🔹 TEST 18: Número exterior con letras');
    await fillFacturacion(page, { numero: 'ABC123XYZ', cp: '76118' });
    res = await clickGuardar(page, 'Fact - Número letras');
    console.log(`    Resultado: popup=${res.popup}`);

    // Restaurar datos válidos
    console.log('\n  🔄 Restaurando datos válidos...');
    await fillFacturacion(page, {
      tipoPersona: 'Persona Física',
      nombre: 'Daniela Jiménez Durán',
      rfc: 'JIDD230803MQT',
      regimen: 'Régimen Simplificado de Confianza',
      direccionIgual: true
    });
    res = await clickGuardar(page, 'Fact - Restaurar');
    console.log(`    Resultado: popup=${res.popup}`);

    await captureScreenshot(page, 'facturacion-final');
    console.log('\n  📋 === FIN STRESS TEST FACTURACIÓN ===\n');

    const result = monitor.printSummary();
    if (!result.passed) console.log(`⚠️ El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);
  });
});
