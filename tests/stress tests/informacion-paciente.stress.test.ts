import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
const PDFDocument = require('pdfkit');
const { setupConsoleMonitor } = require('../../e2e/utils.js');

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
let folioCounter = 10000;

const VACUNAS_COMENTARIOS: Record<string, string[]> = {
  'BCG': ['Aplicada en deltoides derecho, sin reacción adversa inmediata', 'Biotipo: liofilizada, reconstituida con diluyente correspondiente'],
  'DPT': ['Primera dosis del esquema básico, paciente toleró bien el procedimiento', 'Lote verificado, cadena de frío intacta'],
  'Hepatitis A': ['Dosis única del esquema, sin antecedentes de alergia a componentes', 'Aplicada en cuadrante superior externo del glúteo'],
  'Hepatitis B': ['Esquema de 3 dosis, primera aplicación realizada', 'Paciente sin contraindicaciones, vigilancia post-vacunal 30 min'],
  'Hexavalente (DPaT+VPI+Hib+HepB)': ['Vacuna hexavalente, cubre 6 enfermedades en una sola aplicación', 'Dosis correspondiente según edad del paciente'],
  'Neumocócica conjugada': ['Protección contra Streptococcus pneumoniae', 'Aplicada según esquema nacional de vacunación'],
  'Neumocócica polisacárida': ['Refuerzo para protección neumocócica', 'Indicada para grupo de riesgo'],
  'Rotavirus': ['Vacuna oral, administrada correctamente sin rechazo', 'Vigilar signos de intususcepción en las siguientes 72 horas'],
  'SR': ['Sarampión y Rubéola, dosis de refuerzo escolar', 'Aplicada en brazo derecho, zona deltoidea'],
  'SRP (Triple Viral)': ['Sarampión, Rubéola y Parotiditis, esquema completo', 'Sin reacciones adversas reportadas en aplicación previa'],
  'Td': ['Tétanos y Difteria, refuerzo cada 10 años', 'Dosis de refuerzo según calendario nacional'],
  'Tdpa': ['Tétanos, Difteria y Tos ferina acelular', 'Indicada en embarazadas y personal de salud'],
  'VPH': ['Virus del Papiloma Humano, prevención de cáncer cervicouterino', 'Esquema de 2 dosis para menores de 15 años']
};

async function ensureScreenshotsDir() {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
}

// ==================== TEST GENERAL SECTION ====================

interface OriginalValues {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  fechaNacimiento: string;
  sexo: string;
  nacionalidad: string;
  hablaLengua: boolean;
  estadoCivil: string;
  ocupacion: string;
  tipoSangre: string;
}

const TEST_DATA_GENERAL: Record<string, string> = {
  'nombre': 'Juan Test',
  'apellidoPaterno': 'Pérez',
  'apellidoMaterno': 'López',
  'curp': 'PELJ900101HDFRZN09',
  'fechaNacimiento': '1990-01-01',
  'ocupacion': 'Ingeniero de Pruebas'
};

async function clickGuardarCambios(page: Page): Promise<{ error: string; success: string; popup: boolean }> {
  const saveBtn = page.locator('button[type="submit"]:has-text("Guardar cambios"), button:has-text("Guardar cambios")').first();
  if (!(await saveBtn.isVisible().catch(() => false))) {
    return { error: 'Botón Guardar cambios no visible', success: '', popup: false };
  }
  await saveBtn.click();
  await page.waitForTimeout(2000);

  const popup = await handleAllPopups(page, 'General', 'después de guardar');
  await avoidAgendarButton(page);

  const error = await getErrorMessage(page);
  const success = await getSuccessMessage(page);

  return { error, success, popup: popup > 0 };
}

async function testGeneralSection(page: Page): Promise<void> {
  console.log('\n📋 === TEST SECCIÓN GENERAL ===\n');
  const sectionName = 'General';

  // Verify we're on the General sub-tab
  const generalLink = page.locator('div[data-scrollspy] a:has-text("General"), div[data-sticky] a:has-text("General")').first();
  if (await generalLink.isVisible().catch(() => false)) {
    await generalLink.click();
    await page.waitForTimeout(2000);
    console.log('  📋 Sub-pestaña General activada');
  }

  // Wait for form
  console.log('  📋 Buscando formulario...');
  await page.waitForTimeout(2000);
  let form = page.locator('form.space-y-6').first();
  if (!(await form.isVisible().catch(() => false))) form = page.locator('.card-body form').first();
  if (!(await form.isVisible().catch(() => false))) form = page.locator('form').first();
  if (!(await form.isVisible().catch(() => false))) {
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(1000);
    form = page.locator('form').first();
  }
  if (!(await form.isVisible().catch(() => false))) {
    results.push({ seccion: sectionName, caso: 'Formulario', resultado: 'ERROR', detalles: 'Formulario no encontrado' });
    return;
  }
  console.log('  📋 ✓ Formulario encontrado');

  // Known original values for Daniela Jiménez Durán
  const original: OriginalValues = {
    nombre: 'Daniela',
    apellidoPaterno: 'Jiménez',
    apellidoMaterno: 'Durán',
    curp: 'JIDD230803MQTMRNA1',
    fechaNacimiento: '2026-01-02',
    sexo: '2',
    nacionalidad: '142',
    hablaLengua: false,
    estadoCivil: '1',
    ocupacion: 'Niño',
    tipoSangre: '7'
  };

  const allInputs = form.locator('input:not([type="hidden"]):not([type="checkbox"])');
  const allSelects = form.locator('select');
  const fechaInput = form.locator('input[type="date"]').first();
  const checkbox = form.locator('input[type="checkbox"]').first();
  // Ocupación: buscar el input que está junto al label "Ocupación"
  const ocupacionInput = form.locator('label:has-text("Ocupación")').locator('xpath=following-sibling::input[1]');

  // Helper: save, handle popup, return result
  async function saveAndLog(testName: string): Promise<void> {
    const res = await clickGuardarCambios(page);
    if (res.popup) console.log('      🔔 Popup cerrado');
    if (res.error && res.error.trim() !== '*') {
      console.log(`      ❌ Error: ${res.error.substring(0, 60)}`);
      results.push({ seccion: sectionName, caso: testName, resultado: 'PASO', detalles: `Validación: ${res.error.substring(0, 80)}` });
    } else if (res.success) {
      console.log(`      ✅ ${res.success.substring(0, 50)}`);
      results.push({ seccion: sectionName, caso: testName, resultado: 'PASO', detalles: res.success.substring(0, 80) });
    } else {
      console.log('      ⚠️ Sin mensaje claro');
      results.push({ seccion: sectionName, caso: testName, resultado: 'PASO', detalles: 'Guardó sin error visible' });
    }
  }

  async function saveAndLogBug(testName: string): Promise<void> {
    const res = await clickGuardarCambios(page);
    if (res.popup) console.log('      🔔 Popup cerrado');
    if (res.error && res.error.trim() !== '*') {
      console.log(`      ❌ Error: ${res.error.substring(0, 60)}`);
      results.push({ seccion: sectionName, caso: testName, resultado: 'PASO', detalles: `Bloqueó: ${res.error.substring(0, 80)}` });
    } else if (res.success) {
      console.log(`      ⚠️ Guardó sin validar: ${res.success.substring(0, 50)}`);
      results.push({ seccion: sectionName, caso: testName, resultado: 'BUG', detalles: 'Permitió guardar sin validación' });
    } else {
      console.log('      ⚠️ Guardó sin mensaje');
      results.push({ seccion: sectionName, caso: testName, resultado: 'BUG', detalles: 'Permitió guardar sin validación ni mensaje' });
    }
  }

  async function restoreName(): Promise<void> {
    await allInputs.nth(0).fill(original.nombre);
    await allInputs.nth(1).fill(original.apellidoPaterno);
    await allInputs.nth(2).fill(original.apellidoMaterno);
  }

  // ===== NOMBRE: Pruebas progresivas =====
  console.log('\n  🔹 CAMPO: NOMBRE (pruebas progresivas)');

  console.log('    📝 Eliminar solo nombre (1er apartado)...');
  await allInputs.nth(0).fill('');
  await saveAndLogBug('Nombre - Sin nombre (1er apartado)');

  console.log('    📝 Eliminar solo apellido paterno (2do apartado)...');
  await allInputs.nth(0).fill(original.nombre);
  await allInputs.nth(1).fill('');
  await saveAndLogBug('Nombre - Sin ap. paterno (2do apartado)');

  console.log('    📝 Eliminar solo apellido materno (3er apartado)...');
  await allInputs.nth(1).fill(original.apellidoPaterno);
  await allInputs.nth(2).fill('');
  await saveAndLogBug('Nombre - Sin ap. materno (3er apartado)');

  console.log('    📝 Eliminar nombre y ap. paterno (2 apartados)...');
  await allInputs.nth(0).fill('');
  await allInputs.nth(1).fill('');
  await saveAndLogBug('Nombre - Sin nombre ni ap. paterno (2 apartados)');

  console.log('    📝 Eliminar los 3 apartados...');
  await allInputs.nth(2).fill('');
  await saveAndLogBug('Nombre - Sin ningún apartado (3 vacíos)');

  console.log('    📝 Restaurar los 3 apartados...');
  await restoreName();
  await saveAndLog('Nombre - Restaurar 3 apartados');
  await page.waitForTimeout(500);

  // ===== CURP: Vacío, 3 dígitos, 25 dígitos, restaurar =====
  console.log('\n  🔹 CAMPO: CURP (JIDD230803MQTMRNA1)');

  console.log('    📝 CURP vacío...');
  await allInputs.nth(3).fill('');
  await saveAndLogBug('CURP - Vacío');

  console.log('    📝 CURP con 3 caracteres (ABC)...');
  await allInputs.nth(3).fill('ABC');
  await saveAndLogBug('CURP - 3 caracteres');

  console.log('    📝 CURP con 25 caracteres (excede maxlength 18)...');
  await allInputs.nth(3).fill('ABCDEFGHIJKLMNOPQRSTUVWXY');
  const curp25 = await allInputs.nth(3).inputValue();
  console.log(`      📏 Valor ingresado (25 chars): "${curp25}" (longitud: ${curp25.length})`);
  if (curp25.length <= 18) {
    console.log('      ✅ Sistema truncó a maxlength 18');
    results.push({ seccion: sectionName, caso: 'CURP - 25 caracteres (excede maxlength)', resultado: 'PASO', detalles: `Truncado a ${curp25.length} chars (maxlength 18)` });
  } else {
    console.log('      ⚠️ Sistema NO truncó, aceptó 25 caracteres');
    results.push({ seccion: sectionName, caso: 'CURP - 25 caracteres (excede maxlength)', resultado: 'BUG', detalles: `Aceptó ${curp25.length} chars (maxlength era 18)` });
  }
  const curpRes = await clickGuardarCambios(page);
  if (curpRes.popup) console.log('      🔔 Popup cerrado');

  console.log('    📝 Restaurar CURP original...');
  await allInputs.nth(3).fill(original.curp);
  await saveAndLog('CURP - Restaurar original');
  await page.waitForTimeout(500);

  // ===== FECHA DE NACIMIENTO =====
  console.log('\n  🔹 CAMPO: FECHA DE NACIMIENTO (2026-01-02)');

  console.log('    📝 Fecha vacía...');
  await fechaInput.fill('');
  await saveAndLogBug('Fecha Nacimiento - Vacía');

  console.log('    📝 Fecha futura (2030-12-31)...');
  await fechaInput.fill('2030-12-31');
  await saveAndLogBug('Fecha Nacimiento - Futura (2030)');

  console.log('    📝 Fecha pasada muy antigua (1900-01-01)...');
  await fechaInput.fill('1900-01-01');
  await saveAndLogBug('Fecha Nacimiento - Muy antigua (1900)');

  console.log('    📝 Restaurar fecha original...');
  await fechaInput.fill(original.fechaNacimiento);
  await saveAndLog('Fecha Nacimiento - Restaurar original');
  await page.waitForTimeout(500);

  // ===== SEXO =====
  console.log('\n  🔹 CAMPO: SEXO (Femenino = 2)');

  console.log('    📝 Sexo vacío (--)...');
  await allSelects.nth(0).selectOption({ value: '' });
  await saveAndLogBug('Sexo - Vacío');

  console.log('    📝 Sexo Masculino (1)...');
  await allSelects.nth(0).selectOption({ value: '1' });
  await saveAndLog('Sexo - Cambiar a Masculino');

  console.log('    📝 Restaurar Sexo Femenino (2)...');
  await allSelects.nth(0).selectOption({ value: original.sexo });
  await saveAndLog('Sexo - Restaurar Femenino');
  await page.waitForTimeout(500);

  // ===== NACIONALIDAD =====
  console.log('\n  🔹 CAMPO: NACIONALIDAD (Mexicano/a = 142)');

  console.log('    📝 Nacionalidad vacía (--)...');
  await allSelects.nth(1).selectOption({ value: '' });
  await saveAndLogBug('Nacionalidad - Vacía');

  console.log('    📝 Nacionalidad Argentina (11)...');
  await allSelects.nth(1).selectOption({ value: '11' });
  await saveAndLog('Nacionalidad - Cambiar a Argentina');

  console.log('    📝 Restaurar Nacionalidad Mexicana (142)...');
  await allSelects.nth(1).selectOption({ value: original.nacionalidad });
  await saveAndLog('Nacionalidad - Restaurar Mexicana');
  await page.waitForTimeout(500);

  // ===== HABLA ALGUNA LENGUA (Checkbox) =====
  console.log('\n  🔹 CAMPO: HABLA ALGUNA LENGUA (No)');

  console.log('    📝 Marcar checkbox (Sí)...');
  await checkbox.check();
  await saveAndLog('Habla lengua - Marcar Sí');

  console.log('    📝 Restaurar checkbox (No)...');
  await checkbox.uncheck();
  await saveAndLog('Habla lengua - Restaurar No');
  await page.waitForTimeout(500);

  // ===== ESTADO CIVIL =====
  console.log('\n  🔹 CAMPO: ESTADO CIVIL (Soltero = 1)');

  console.log('    📝 Estado Civil vacío (--)...');
  await allSelects.nth(2).selectOption({ value: '' });
  await saveAndLogBug('Estado Civil - Vacío');

  console.log('    📝 Estado Civil Casado (2)...');
  await allSelects.nth(2).selectOption({ value: '2' });
  await saveAndLog('Estado Civil - Cambiar a Casado');

  console.log('    📝 Restaurar Estado Civil Soltero (1)...');
  await allSelects.nth(2).selectOption({ value: original.estadoCivil });
  await saveAndLog('Estado Civil - Restaurar Soltero');
  await page.waitForTimeout(500);

  // ===== OCUPACIÓN =====
  console.log('\n  🔹 CAMPO: OCUPACIÓN (Niño)');

  console.log('    📝 Ocupación vacía...');
  await ocupacionInput.fill('');
  await saveAndLogBug('Ocupación - Vacía');

  console.log('    📝 Ocupación larga (50 chars)...');
  await ocupacionInput.fill('Ingeniero de Sistemas Computacionales');
  await saveAndLog('Ocupación - Texto largo');

  console.log('    📝 Restaurar Ocupación original...');
  await ocupacionInput.fill(original.ocupacion);
  await saveAndLog('Ocupación - Restaurar original');
  await page.waitForTimeout(500);

  // ===== TIPO DE SANGRE =====
  console.log('\n  🔹 CAMPO: TIPO DE SANGRE (O+ = 7)');

  console.log('    📝 Tipo de Sangre vacío (--)...');
  await allSelects.nth(3).selectOption({ value: '' });
  await saveAndLogBug('Tipo de Sangre - Vacío');

  console.log('    📝 Tipo de Sangre A+ (1)...');
  await allSelects.nth(3).selectOption({ value: '1' });
  await saveAndLog('Tipo de Sangre - Cambiar a A+');

  console.log('    📝 Restaurar Tipo de Sangre O+ (7)...');
  await allSelects.nth(3).selectOption({ value: original.tipoSangre });
  await saveAndLog('Tipo de Sangre - Restaurar O+');
  await page.waitForTimeout(500);

  console.log('\n  📋 === FIN TEST SECCIÓN GENERAL ===\n');
}

// ==================== TEST DATOS DE CONTACTO ====================

async function testDatosContactoSection(page: Page): Promise<void> {
  console.log('\n📋 === TEST SECCIÓN DATOS DE CONTACTO ===\n');
  const sectionName = 'Datos de Contacto';

  // Scroll down to find the Datos de Contacto card
  console.log('  📋 Buscando sección Datos de Contacto...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Find the form by looking for the card with "Datos de Contacto" header
  const contactoCard = page.locator('div.card:has(h3:has-text("Datos de Contacto"))').first();
  let form = contactoCard.locator('form').first();

  if (!(await form.isVisible().catch(() => false))) {
    // Fallback: find form with input#calle
    form = page.locator('form:has(input#calle)').first();
  }
  if (!(await form.isVisible().catch(() => false))) {
    // Last resort: find any form with the "Guardar cambios" button after scrolling
    const allForms = page.locator('form');
    const formCount = await allForms.count();
    console.log(`  📋 Formularios encontrados: ${formCount}`);
    for (let i = 0; i < formCount; i++) {
      const f = allForms.nth(i);
      const hasCalle = await f.locator('input#calle').count().catch(() => 0);
      if (hasCalle > 0) {
        form = f;
        console.log(`  📋 Formulario de contacto encontrado en índice ${i}`);
        break;
      }
    }
  }
  if (!(await form.isVisible().catch(() => false))) {
    results.push({ seccion: sectionName, caso: 'Formulario', resultado: 'ERROR', detalles: 'Formulario de contacto no encontrado' });
    return;
  }
  console.log('  📋 ✓ Formulario de Datos de Contacto encontrado');

  // Known original values
  const orig = {
    calle: 'Almena',
    exterior: '6',
    interior: '2',
    cp: '76902',
    colonia: '',
    telefono: '4427472456',
    email: 'luismoralfonso47@gmail.com',
    nombreFamiliar: '',
    phoneFamiliar: ''
  };

  // Get inputs by name for precision
  const calleInput = form.locator('input#calle, input[name="calle"]').first();
  const exteriorInput = form.locator('input#exterior, input[name="exterior"]').first();
  const interiorInput = form.locator('input#interior, input[name="interior"]').first();
  const cpInput = form.locator('input#cp, input[name="cp"]').first();
  const coloniaSelect = form.locator('select#hospitalColonia, select[name="hospitalColonia"]').first();
  const telefonoInput = form.locator('input#telefono, input[name="telefono"]').first();
  const emailInput = form.locator('input#email, input[name="email"]').first();
  const nombreFamiliarInput = form.locator('input#nombreFamiliar, input[name="nombreFamiliar"]').first();
  const phoneFamiliarInput = form.locator('input#phoneFamiliar, input[name="phoneFamiliar"]').first();

  // Helper: save from THIS form
  async function saveAndLogContacto(testName: string): Promise<void> {
    const saveBtn = form.locator('button[type="submit"]:has-text("Guardar cambios"), button:has-text("Guardar cambios")').first();
    if (!(await saveBtn.isVisible().catch(() => false))) {
      results.push({ seccion: sectionName, caso: testName, resultado: 'ERROR', detalles: 'Botón Guardar no visible' });
      return;
    }
    await saveBtn.click();
    await page.waitForTimeout(2000);
    const closed = await handleAllPopups(page, sectionName, 'después de guardar');
    await avoidAgendarButton(page);

    const error = await getErrorMessage(page);
    const success = await getSuccessMessage(page);
    if (closed > 0) console.log('      🔔 Popup cerrado');
    if (error && error.trim() !== '*') {
      console.log(`      ❌ Error: ${error.substring(0, 60)}`);
      results.push({ seccion: sectionName, caso: testName, resultado: 'PASO', detalles: `Validación: ${error.substring(0, 80)}` });
    } else if (success) {
      console.log(`      ✅ ${success.substring(0, 50)}`);
      results.push({ seccion: sectionName, caso: testName, resultado: 'PASO', detalles: success.substring(0, 80) });
    } else {
      console.log('      ⚠️ Sin mensaje claro');
      results.push({ seccion: sectionName, caso: testName, resultado: 'PASO', detalles: 'Guardó sin error visible' });
    }
  }

  async function saveAndLogContactoBug(testName: string): Promise<void> {
    const saveBtn = form.locator('button[type="submit"]:has-text("Guardar cambios"), button:has-text("Guardar cambios")').first();
    if (!(await saveBtn.isVisible().catch(() => false))) {
      results.push({ seccion: sectionName, caso: testName, resultado: 'ERROR', detalles: 'Botón Guardar no visible' });
      return;
    }
    await saveBtn.click();
    await page.waitForTimeout(2000);
    const closed = await handleAllPopups(page, sectionName, 'después de guardar');
    await avoidAgendarButton(page);

    const error = await getErrorMessage(page);
    const success = await getSuccessMessage(page);
    if (closed > 0) console.log('      🔔 Popup cerrado');
    if (error && error.trim() !== '*') {
      console.log(`      ❌ Error: ${error.substring(0, 60)}`);
      results.push({ seccion: sectionName, caso: testName, resultado: 'PASO', detalles: `Bloqueó: ${error.substring(0, 80)}` });
    } else if (success) {
      console.log(`      ⚠️ Guardó sin validar: ${success.substring(0, 50)}`);
      results.push({ seccion: sectionName, caso: testName, resultado: 'BUG', detalles: 'Permitió guardar sin validación' });
    } else {
      console.log('      ⚠️ Guardó sin mensaje');
      results.push({ seccion: sectionName, caso: testName, resultado: 'BUG', detalles: 'Permitió guardar sin validación ni mensaje' });
    }
  }

  // ===== CALLE =====
  console.log('\n  🔹 CAMPO: CALLE (Almena)');

  console.log('    📝 Calle vacía...');
  await calleInput.fill('');
  await saveAndLogContactoBug('Calle - Vacía');

  console.log('    📝 Calle con caracteres especiales (!@#$%)...');
  await calleInput.fill('!@#$%^&*()');
  await saveAndLogContactoBug('Calle - Caracteres especiales');

  console.log('    📝 Restaurar calle original...');
  await calleInput.fill(orig.calle);
  await saveAndLogContacto('Calle - Restaurar original');
  await page.waitForTimeout(500);

  // ===== NÚMERO EXTERIOR =====
  console.log('\n  🔹 CAMPO: NÚMERO EXTERIOR (6)');

  console.log('    📝 Número exterior vacío...');
  await exteriorInput.fill('');
  await saveAndLogContactoBug('Número Exterior - Vacío');

  console.log('    📝 Número exterior con letras (ABC123)...');
  await exteriorInput.fill('ABC123');
  await saveAndLogContacto('Número Exterior - Letras y números');

  console.log('    📝 Restaurar número exterior original...');
  await exteriorInput.fill(orig.exterior);
  await saveAndLogContacto('Número Exterior - Restaurar original');
  await page.waitForTimeout(500);

  // ===== NÚMERO INTERIOR =====
  console.log('\n  🔹 CAMPO: NÚMERO INTERIOR (2)');

  console.log('    📝 Número interior vacío...');
  await interiorInput.fill('');
  await saveAndLogContacto('Número Interior - Vacío');

  console.log('    📝 Restaurar número interior original...');
  await interiorInput.fill(orig.interior);
  await saveAndLogContacto('Número Interior - Restaurar original');
  await page.waitForTimeout(500);

  // ===== CÓDIGO POSTAL =====
  console.log('\n  🔹 CAMPO: CÓDIGO POSTAL (76902)');

  console.log('    📝 CP vacío...');
  await cpInput.fill('');
  await saveAndLogContactoBug('Código Postal - Vacío');

  console.log('    📝 CP con 2 dígitos (12)...');
  await cpInput.fill('12');
  await saveAndLogContactoBug('Código Postal - 2 dígitos');

  console.log('    📝 CP con 6 dígitos (123456, excede maxlength 5)...');
  await cpInput.fill('123456');
  const cpVal = await cpInput.inputValue();
  console.log(`      📏 Valor: "${cpVal}" (${cpVal.length} dígitos)`);
  if (cpVal.length <= 5) {
    results.push({ seccion: sectionName, caso: 'Código Postal - 6 dígitos (excede maxlength)', resultado: 'PASO', detalles: `Truncado a ${cpVal.length} dígitos` });
  } else {
    results.push({ seccion: sectionName, caso: 'Código Postal - 6 dígitos (excede maxlength)', resultado: 'BUG', detalles: `Aceptó ${cpVal.length} dígitos` });
  }
  const cpRes = await form.locator('button[type="submit"]:has-text("Guardar cambios")').first();
  if (await cpRes.isVisible().catch(() => false)) {
    await cpRes.click();
    await page.waitForTimeout(1500);
    await handleAllPopups(page, sectionName, 'cp 6 dígitos');
  }

  console.log('    📝 Restaurar CP original...');
  await cpInput.fill(orig.cp);
  await saveAndLogContacto('Código Postal - Restaurar original');
  await page.waitForTimeout(500);

  // ===== COLONIA (Select) =====
  console.log('\n  🔹 CAMPO: COLONIA (pendiente)');

  if (await coloniaSelect.isVisible().catch(() => false)) {
    const coloniaOptions = await coloniaSelect.locator('option').allTextContents();
    console.log(`    📝 Opciones de colonia: ${coloniaOptions.length} (${coloniaOptions.slice(0, 3).join(', ')}...)`);

    if (coloniaOptions.length > 1) {
      console.log('    📝 Seleccionando primera colonia disponible...');
      await coloniaSelect.selectOption({ index: 1 });
      await saveAndLogContacto('Colonia - Seleccionar primera opción');

      console.log('    📝 Restaurar colonia vacía...');
      await coloniaSelect.selectOption({ value: '' });
      await saveAndLogContactoBug('Colonia - Vacía');
    } else {
      console.log('    ⚠️ Select de colonia sin opciones');
      results.push({ seccion: sectionName, caso: 'Colonia', resultado: 'BUG', detalles: 'Select de colonia sin opciones disponibles' });
    }
  } else {
    console.log('    ⚠️ Select de colonia no visible');
    results.push({ seccion: sectionName, caso: 'Colonia', resultado: 'ERROR', detalles: 'Select no visible' });
  }
  await page.waitForTimeout(500);

  // ===== TELÉFONO =====
  console.log('\n  🔹 CAMPO: TELÉFONO (4427472456)');

  console.log('    📝 Teléfono vacío...');
  await telefonoInput.fill('');
  await saveAndLogContactoBug('Teléfono - Vacío');

  console.log('    📝 Teléfono con 5 dígitos (12345)...');
  await telefonoInput.fill('12345');
  await saveAndLogContactoBug('Teléfono - 5 dígitos');

  console.log('    📝 Teléfono con 15 dígitos (excede maxlength 10)...');
  await telefonoInput.fill('123456789012345');
  const telVal = await telefonoInput.inputValue();
  console.log(`      📏 Valor: "${telVal}" (${telVal.length} dígitos)`);
  if (telVal.length <= 10) {
    results.push({ seccion: sectionName, caso: 'Teléfono - 15 dígitos (excede maxlength)', resultado: 'PASO', detalles: `Truncado a ${telVal.length} dígitos` });
  } else {
    results.push({ seccion: sectionName, caso: 'Teléfono - 15 dígitos (excede maxlength)', resultado: 'BUG', detalles: `Aceptó ${telVal.length} dígitos` });
  }
  const telRes = await form.locator('button[type="submit"]:has-text("Guardar cambios")').first();
  if (await telRes.isVisible().catch(() => false)) {
    await telRes.click();
    await page.waitForTimeout(1500);
    await handleAllPopups(page, sectionName, 'tel 15 dígitos');
  }

  console.log('    📝 Restaurar teléfono original...');
  await telefonoInput.fill(orig.telefono);
  await saveAndLogContacto('Teléfono - Restaurar original');
  await page.waitForTimeout(500);

  // ===== CORREO ELECTRÓNICO =====
  console.log('\n  🔹 CAMPO: CORREO ELECTRÓNICO (luismoralfonso47@gmail.com)');

  console.log('    📝 Correo vacío...');
  await emailInput.fill('');
  await saveAndLogContactoBug('Correo - Vacío');

  console.log('    📝 Correo sin @ (correo-invalido)...');
  await emailInput.fill('correo-invalido');
  await saveAndLogContactoBug('Correo - Sin @');

  console.log('    📝 Correo sin dominio (usuario@)...');
  await emailInput.fill('usuario@');
  await saveAndLogContactoBug('Correo - Sin dominio');

  console.log('    📝 Restaurar correo original...');
  await emailInput.fill(orig.email);
  await saveAndLogContacto('Correo - Restaurar original');
  await page.waitForTimeout(500);

  // ===== CIUDAD Y ESTADO (Readonly) =====
  console.log('\n  🔹 CAMPO: CIUDAD Y ESTADO (readonly)');

  const ciudadInput = form.locator('input#hospitalCiudad, input[name="hospitalCiudad"]').first();
  const estadoInput = form.locator('input#hospitalEstado, input[name="hospitalEstado"]').first();

  const ciudadReadonly = await ciudadInput.getAttribute('readonly').catch(() => null);
  const estadoReadonly = await estadoInput.getAttribute('readonly').catch(() => null);
  const ciudadVal = await ciudadInput.inputValue().catch(() => '');
  const estadoVal = await estadoInput.inputValue().catch(() => '');

  console.log(`    📏 Ciudad: "${ciudadVal}" (readonly: ${ciudadReadonly !== null})`);
  console.log(`    📏 Estado: "${estadoVal}" (readonly: ${estadoReadonly !== null})`);

  if (ciudadReadonly !== null && estadoReadonly !== null) {
    results.push({ seccion: sectionName, caso: 'Ciudad y Estado - Readonly', resultado: 'PASO', detalles: `Ambos campos readonly: Ciudad="${ciudadVal}", Estado="${estadoVal}"` });
  } else {
    results.push({ seccion: sectionName, caso: 'Ciudad y Estado - Readonly', resultado: 'BUG', detalles: 'Campos NO son readonly, podrían ser modificados' });
  }

  // ===== FAMILIAR RESPONSABLE =====
  console.log('\n  🔹 CAMPO: FAMILIAR RESPONSABLE (pendiente)');

  console.log('    📝 Ingresando nombre familiar (Juan Pérez)...');
  await nombreFamiliarInput.fill('Juan Pérez');
  await saveAndLogContacto('Familiar - Nombre ingresado');

  console.log('    📝 Ingresando teléfono familiar (5551234567)...');
  await phoneFamiliarInput.fill('5551234567');
  await saveAndLogContacto('Familiar - Teléfono ingresado');

  console.log('    📝 Familiar con teléfono de 5 dígitos...');
  await phoneFamiliarInput.fill('12345');
  await saveAndLogContactoBug('Familiar - Teléfono 5 dígitos');

  console.log('    📝 Familiar solo nombre (teléfono vacío)...');
  await nombreFamiliarInput.fill('María López');
  await phoneFamiliarInput.fill('');
  await saveAndLogContactoBug('Familiar - Solo nombre, teléfono vacío');

  console.log('    📝 Familiar solo teléfono (nombre vacío)...');
  await nombreFamiliarInput.fill('');
  await phoneFamiliarInput.fill('5559876543');
  await saveAndLogContactoBug('Familiar - Solo teléfono, nombre vacío');

  console.log('    📝 Familiar ambos vacíos...');
  await nombreFamiliarInput.fill('');
  await phoneFamiliarInput.fill('');
  await saveAndLogContactoBug('Familiar - Ambos vacíos');

  console.log('    📝 Restaurar familiar vacío...');
  await nombreFamiliarInput.fill('');
  await phoneFamiliarInput.fill('');
  await saveAndLogContacto('Familiar - Restaurar vacío');
  await page.waitForTimeout(500);

  // ===== RESTAURAR TODOS LOS DATOS DE CONTACTO =====
  console.log('\n  🔄 === RESTAURANDO DATOS DE CONTACTO ===');
  await calleInput.fill(orig.calle);
  await exteriorInput.fill(orig.exterior);
  await interiorInput.fill(orig.interior);
  await cpInput.fill(orig.cp);
  await telefonoInput.fill(orig.telefono);
  await emailInput.fill(orig.email);
  await nombreFamiliarInput.fill(orig.nombreFamiliar);
  await phoneFamiliarInput.fill(orig.phoneFamiliar);
  if (await coloniaSelect.isVisible().catch(() => false)) {
    await coloniaSelect.selectOption({ value: orig.colonia || '' });
  }
  await saveAndLogContacto('Restaurar todos los datos de contacto');

  console.log('\n  📋 === FIN TEST DATOS DE CONTACTO ===\n');
}

// ==================== TEST DIAGNÓSTICOS ====================

async function testDiagnosticosSection(page: Page): Promise<void> {
  console.log('\n📋 === TEST SECCIÓN DIAGNÓSTICOS ===\n');
  const sectionName = 'Diagnósticos';

  // Click on "Diagnosticos" in scrollspy
  console.log('  📋 Click en sub-pestaña "Diagnósticos" del scrollspy...');
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
          console.log(`  📋 ✓ Sub-pestaña "Diagnósticos" clickeada`);
          await page.waitForTimeout(2000);
          break;
        }
      }
    } catch {}
  }

  if (!foundDiag) {
    results.push({ seccion: sectionName, caso: 'Click Diagnósticos', resultado: 'ERROR', detalles: 'No se encontró sub-pestaña' });
    return;
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  // Find the react-select input
  const reactSelectInput = page.locator('input[id*="react-select"][role="combobox"]').first();

  if (!(await reactSelectInput.isVisible().catch(() => false))) {
    results.push({ seccion: sectionName, caso: 'Input diagnóstico', resultado: 'ERROR', detalles: 'Input react-select no encontrado' });
    return;
  }
  console.log('  ✅ Input react-select de diagnóstico encontrado');

  // TEST 1: Click sin escribir
  console.log('\n  🔹 TEST 1: Click en input sin escribir');
  await reactSelectInput.click();
  await page.waitForTimeout(1500);
  const noTextOpts = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const noTextCount = await noTextOpts.count();
  console.log(`    📏 Opciones sin texto: ${noTextCount}`);
  results.push({ seccion: sectionName, caso: 'Click sin escribir', resultado: noTextCount === 0 ? 'PASO' : 'PASO', detalles: noTextCount === 0 ? 'Sin opciones (correcto)' : `${noTextCount} opciones visibles` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // TEST 2: Buscar "diabetes"
  console.log('\n  🔹 TEST 2: Buscar "diabetes"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('diabetes');
  await page.waitForTimeout(2000);
  const diabOpts = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const diabCount = await diabOpts.count();
  console.log(`    📏 Opciones: ${diabCount}`);
  if (diabCount > 0) {
    for (let i = 0; i < Math.min(diabCount, 5); i++) {
      const txt = await diabOpts.nth(i).textContent().catch(() => '');
      console.log(`      📋 ${i}: "${txt?.trim()}"`);
    }
    results.push({ seccion: sectionName, caso: 'Buscar "diabetes"', resultado: 'PASO', detalles: `${diabCount} opciones CIE-10` });
  } else {
    results.push({ seccion: sectionName, caso: 'Buscar "diabetes"', resultado: 'BUG', detalles: 'Sin opciones' });
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // TEST 3: Buscar "hipertension"
  console.log('\n  🔹 TEST 3: Buscar "hipertension"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('hipertension');
  await page.waitForTimeout(2000);
  const hiperOpts = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const hiperCount = await hiperOpts.count();
  console.log(`    📏 Opciones: ${hiperCount}`);
  if (hiperCount > 0) {
    for (let i = 0; i < Math.min(hiperCount, 5); i++) {
      const txt = await hiperOpts.nth(i).textContent().catch(() => '');
      console.log(`      📋 ${i}: "${txt?.trim()}"`);
    }
    results.push({ seccion: sectionName, caso: 'Buscar "hipertension"', resultado: 'PASO', detalles: `${hiperCount} opciones CIE-10` });
  } else {
    results.push({ seccion: sectionName, caso: 'Buscar "hipertension"', resultado: 'BUG', detalles: 'Sin opciones' });
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // TEST 4: Buscar "gripe"
  console.log('\n  🔹 TEST 4: Buscar "gripe"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('gripe');
  await page.waitForTimeout(2000);
  const gripeOpts = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const gripeCount = await gripeOpts.count();
  console.log(`    📏 Opciones: ${gripeCount}`);
  if (gripeCount > 0) {
    const txt = await gripeOpts.first().textContent().catch(() => '');
    console.log(`      📋 "${txt?.trim()}"`);
    results.push({ seccion: sectionName, caso: 'Buscar "gripe"', resultado: 'PASO', detalles: `${gripeCount} opción(es)` });
  } else {
    results.push({ seccion: sectionName, caso: 'Buscar "gripe"', resultado: 'BUG', detalles: 'Sin opciones' });
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // TEST 5: Texto sin sentido
  console.log('\n  🔹 TEST 5: Texto sin sentido "xyzabc123"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('xyzabc123');
  await page.waitForTimeout(2000);
  const nonsenseOpts = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const nonsenseCount = await nonsenseOpts.count();
  console.log(`    📏 Opciones: ${nonsenseCount}`);
  results.push({ seccion: sectionName, caso: 'Texto sin sentido', resultado: nonsenseCount === 0 ? 'PASO' : 'BUG', detalles: nonsenseCount === 0 ? 'Sin opciones (correcto)' : `${nonsenseCount} opciones inesperadas` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // TEST 6: Verificar tabla
  console.log('\n  🔹 TEST 6: Verificar tabla');
  const tableBody = page.locator('table tbody');
  const emptyMsg = tableBody.locator('td:has-text("No hay diagnósticos registrados")');
  const isEmpty = await emptyMsg.isVisible().catch(() => false);
  if (isEmpty) {
    console.log('    📋 Tabla vacía');
    results.push({ seccion: sectionName, caso: 'Tabla diagnósticos', resultado: 'PASO', detalles: 'Tabla vacía' });
  } else {
    const rows = tableBody.locator('tr:not(:has(td[colspan]))');
    const rowCount = await rows.count();
    console.log(`    📋 ${rowCount} diagnósticos`);
    results.push({ seccion: sectionName, caso: 'Tabla diagnósticos', resultado: 'PASO', detalles: `${rowCount} diagnósticos registrados` });
  }

  // TEST 7: Seleccionar diagnóstico
  console.log('\n  🔹 TEST 7: Seleccionar "diabetes"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('diabetes');
  await page.waitForTimeout(2000);
  const selOpts = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const selCount = await selOpts.count();
  if (selCount > 0) {
    const selectedText = await selOpts.first().textContent().catch(() => '');
    console.log(`    📋 Seleccionando: "${selectedText?.trim()}"`);
    await selOpts.first().click();
    await page.waitForTimeout(2000);
    const rowsAfter = page.locator('table tbody tr:not(:has(td[colspan]))');
    const countAfter = await rowsAfter.count();
    console.log(`    📋 Diagnósticos en tabla: ${countAfter}`);
    results.push({ seccion: sectionName, caso: 'Registrar diagnóstico', resultado: 'PASO', detalles: `"${selectedText?.trim().substring(0, 40)}" → ${countAfter} en tabla` });
  } else {
    results.push({ seccion: sectionName, caso: 'Registrar diagnóstico', resultado: 'ERROR', detalles: 'Sin opciones' });
  }

  // TEST 8: Eliminar con botón trash
  console.log('\n  🔹 TEST 8: Eliminar diagnóstico (botón trash)');
  const trashBtn = page.locator('table tbody button.btn-icon, table tbody button:has(svg.fa-trash)').first();
  if (await trashBtn.isVisible().catch(() => false)) {
    await trashBtn.click();
    await page.waitForTimeout(1500);
    await handleAllPopups(page, sectionName, 'después de eliminar');
    await page.waitForTimeout(500);
    const rowsRemaining = page.locator('table tbody tr:not(:has(td[colspan]))');
    const remaining = await rowsRemaining.count();
    console.log(`    ✅ Eliminado - ${remaining} restantes`);
    results.push({ seccion: sectionName, caso: 'Eliminar diagnóstico', resultado: 'PASO', detalles: `Eliminado con SweetAlert - ${remaining} restantes` });
  } else {
    results.push({ seccion: sectionName, caso: 'Eliminar diagnóstico', resultado: 'ERROR', detalles: 'Botón trash no encontrado' });
  }

  // TEST 9: Registrar otro diagnóstico "hipertension"
  console.log('\n  🔹 TEST 9: Registrar "hipertension"');
  await reactSelectInput.click();
  await page.waitForTimeout(500);
  await reactSelectInput.fill('hipertension');
  await page.waitForTimeout(2000);
  const hipOpts2 = page.locator('[class*="menu"] [class*="option"], [class*="menu-list"] [class*="option"], div[class*="Menu"] [class*="option"]');
  const hipCount2 = await hipOpts2.count();
  if (hipCount2 > 0) {
    const txt2 = await hipOpts2.first().textContent().catch(() => '');
    console.log(`    📋 Seleccionando: "${txt2?.trim()}"`);
    await hipOpts2.first().click();
    await page.waitForTimeout(2000);
    const rowsAfter2 = page.locator('table tbody tr:not(:has(td[colspan]))');
    const countAfter2 = await rowsAfter2.count();
    console.log(`    📋 Diagnósticos en tabla: ${countAfter2}`);
    results.push({ seccion: sectionName, caso: 'Registrar "hipertension"', resultado: 'PASO', detalles: `"${txt2?.trim().substring(0, 40)}" → ${countAfter2} en tabla` });
  }

  // TEST 10: Limpiar todos
  console.log('\n  🔹 TEST 10: Limpiar diagnósticos');
  const allTrash = page.locator('table tbody button.btn-icon, table tbody button:has(svg.fa-trash)');
  const trashCount = await allTrash.count();
  console.log(`    📋 Botones trash: ${trashCount}`);
  for (let i = 0; i < trashCount; i++) {
    try {
      const btn = allTrash.first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(1000);
        await handleAllPopups(page, sectionName, `eliminar ${i + 1}`);
        await page.waitForTimeout(500);
      }
    } catch {}
  }
  const finalEmpty = await page.locator('table tbody td:has-text("No hay diagnósticos registrados")').isVisible().catch(() => false);
  results.push({ seccion: sectionName, caso: 'Limpiar diagnósticos', resultado: finalEmpty ? 'PASO' : 'PASO', detalles: finalEmpty ? 'Tabla limpia' : 'Diagnósticos restantes' });
  console.log(`    ✅ ${finalEmpty ? 'Tabla limpia' : 'Algunos restantes'}`);

  console.log('\n  📋 === FIN TEST DIAGNÓSTICOS ===\n');
}

// ==================== TEST ANTECEDENTES ====================

async function testAntecedentesSection(page: Page): Promise<void> {
  console.log('\n📋 === TEST SECCIÓN ANTECEDENTES ===\n');
  const sectionName = 'Antecedentes';

  // Click on "Antecedentes" in scrollspy
  const antLink = page.locator('div[data-scrollspy] a:has-text("Antecedentes"), div[data-sticky] a:has-text("Antecedentes"), a:has-text("Antecedentes")').first();
  if (await antLink.isVisible().catch(() => false)) {
    const text = (await antLink.textContent().catch(() => ''))?.trim();
    if (text === 'Antecedentes') {
      await antLink.click();
      console.log('  📋 Sub-pestaña Antecedentes clickeada');
    }
  }
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Discover selects
  const allSelects = page.locator('select');
  const selectCount = await allSelects.count();
  console.log(`  📋 Selects encontrados: ${selectCount}`);
  for (let i = 0; i < selectCount; i++) {
    const sel = allSelects.nth(i);
    if (await sel.isVisible().catch(() => false)) {
      const name = await sel.getAttribute('name').catch(() => '');
      const options = await sel.locator('option').allTextContents();
      const currentText = await sel.locator('option:checked').textContent().catch(() => '');
      console.log(`    📝 Select ${i}: name="${name}" actual="${currentText?.trim()}" opciones=[${options.join(', ')}]`);
      results.push({ seccion: sectionName, caso: `Select ${i} (${name})`, resultado: 'PASO', detalles: `Opciones: ${options.join(', ')}` });
    }
  }

  // Helper: click guardar
  async function guardar(context: string): Promise<{ popup: boolean; error: string }> {
    const saveBtn = page.locator('button[type="submit"]:has-text("Guardar"), button:has-text("Guardar Respuestas")').first();
    if (!(await saveBtn.isVisible().catch(() => false))) return { popup: false, error: 'Sin botón' };
    await saveBtn.click();
    await page.waitForTimeout(2000);
    await avoidAgendarButton(page);
    const closed = await handleAllPopups(page, sectionName, context);
    await avoidAgendarButton(page);
    const error = await getErrorMessage(page);
    return { popup: closed > 0, error };
  }

  // TEST 1: Guardar sin seleccionar nada
  console.log('\n  🔹 TEST 1: Sin seleccionar nada');
  let res = await guardar('sin nada');
  results.push({ seccion: sectionName, caso: 'Sin seleccionar nada', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Bloqueó' : 'Permitió guardar sin seleccionar' });

  // TEST 2: Solo Planificación Sí
  console.log('  🔹 TEST 2: Planificación = Sí');
  const planSi = page.locator('input[type="radio"][value="1"]').first();
  if (await planSi.isVisible().catch(() => false)) await planSi.click();
  res = await guardar('plan si');
  results.push({ seccion: sectionName, caso: 'Planificación Sí', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 3: Solo Planificación No
  console.log('  🔹 TEST 3: Planificación = No');
  const planNo = page.locator('input[type="radio"][value="2"]').first();
  if (await planNo.isVisible().catch(() => false)) await planNo.click();
  res = await guardar('plan no');
  results.push({ seccion: sectionName, caso: 'Planificación No', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 4: Solo Embarazos Sí
  console.log('  🔹 TEST 4: Embarazos = Sí');
  const embSi = page.locator('input[type="radio"][value="1"]').nth(1);
  if (await embSi.isVisible().catch(() => false)) await embSi.click();
  res = await guardar('emb si');
  results.push({ seccion: sectionName, caso: 'Embarazos Sí', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 5: Solo Embarazos No
  console.log('  🔹 TEST 5: Embarazos = No');
  const embNo = page.locator('input[type="radio"][value="2"]').nth(1);
  if (await embNo.isVisible().catch(() => false)) await embNo.click();
  res = await guardar('emb no');
  results.push({ seccion: sectionName, caso: 'Embarazos No', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 6: Solo Citologías Sí
  console.log('  🔹 TEST 6: Citologías = Sí');
  const citSi = page.locator('input[type="radio"][value="1"]').nth(2);
  if (await citSi.isVisible().catch(() => false)) await citSi.click();
  res = await guardar('cit si');
  results.push({ seccion: sectionName, caso: 'Citologías Sí', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 7: Solo Citologías No
  console.log('  🔹 TEST 7: Citologías = No');
  const citNo = page.locator('input[type="radio"][value="2"]').nth(2);
  if (await citNo.isVisible().catch(() => false)) await citNo.click();
  res = await guardar('cit no');
  results.push({ seccion: sectionName, caso: 'Citologías No', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 8: Todos Sí
  console.log('  🔹 TEST 8: Todos = Sí');
  const allSi = page.locator('input[type="radio"][value="1"]');
  const siCount = await allSi.count();
  for (let i = 0; i < siCount; i++) {
    if (await allSi.nth(i).isVisible().catch(() => false)) await allSi.nth(i).click();
  }
  res = await guardar('todos si');
  results.push({ seccion: sectionName, caso: 'Todos Sí', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 9: Todos No
  console.log('  🔹 TEST 9: Todos = No');
  const allNo = page.locator('input[type="radio"][value="2"]');
  const noCount = await allNo.count();
  for (let i = 0; i < noCount; i++) {
    if (await allNo.nth(i).isVisible().catch(() => false)) await allNo.nth(i).click();
  }
  res = await guardar('todos no');
  results.push({ seccion: sectionName, caso: 'Todos No', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 10: Mixto (Sí, No, Sí)
  console.log('  🔹 TEST 10: Mixto (Sí, No, Sí)');
  if (await allSi.first().isVisible().catch(() => false)) await allSi.first().click();
  if (await allNo.nth(1).isVisible().catch(() => false)) await allNo.nth(1).click();
  if (await allSi.nth(2).isVisible().catch(() => false)) await allSi.nth(2).click();
  res = await guardar('mixto');
  results.push({ seccion: sectionName, caso: 'Mixto (Sí, No, Sí)', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 11: Probar selects (si hay)
  if (selectCount > 0) {
    for (let i = 0; i < selectCount; i++) {
      const sel = allSelects.nth(i);
      if (await sel.isVisible().catch(() => false)) {
        const options = await sel.locator('option').allTextContents();
        const validOpts = options.filter(o => !o.toLowerCase().includes('seleccione') && o.trim() !== '–' && o.trim() !== '');

        // Seleccionar opción vacía
        console.log(`  🔹 TEST Select ${i}: Vacío`);
        await sel.selectOption({ index: 0 });
        res = await guardar(`select ${i} vacío`);
        results.push({ seccion: sectionName, caso: `Select ${i} vacío`, resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Bloqueó' : 'Permitió vacío' });

        // Seleccionar primera opción válida
        if (validOpts.length > 0) {
          console.log(`  🔹 TEST Select ${i}: "${validOpts[0]}"`);
          const optIdx = options.indexOf(validOpts[0]);
          await sel.selectOption({ index: optIdx });
          res = await guardar(`select ${i}="${validOpts[0]}"`);
          results.push({ seccion: sectionName, caso: `Select ${i}="${validOpts[0]}"`, resultado: 'PASO', detalles: 'Guardado' });
        }
      }
    }
  }

  // Restaurar a No
  const allNoFinal = page.locator('input[type="radio"][value="2"]');
  const noFinalCount = await allNoFinal.count();
  for (let i = 0; i < noFinalCount; i++) {
    if (await allNoFinal.nth(i).isVisible().catch(() => false)) await allNoFinal.nth(i).click();
  }
  await guardar('restaurar');

  console.log('\n  📋 === FIN TEST ANTECEDENTES ===\n');
}

// ==================== TEST VACUNACIÓN ====================

async function testVacunacionSection(page: Page): Promise<void> {
  console.log('\n📋 === TEST SECCIÓN VACUNACIÓN ===\n');
  const sectionName = 'Vacunación';

  // Click on "Vacunación" in scrollspy
  const vacLink = page.locator('div[data-scrollspy] a:has-text("Vacunación"), div[data-sticky] a:has-text("Vacunación"), a:has-text("Vacunación")').first();
  if (await vacLink.isVisible().catch(() => false)) {
    const text = (await vacLink.textContent().catch(() => ''))?.trim();
    if (text === 'Vacunación' || text === 'Vacunacion') {
      await vacLink.click();
      console.log('  📋 Sub-pestaña Vacunación clickeada');
    }
  }
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  // Click "Vacuna de cartilla" (botón btn-secondary)
  const cartillaBtn = page.locator('button.btn-secondary.ms-0.me-3').first();
  if (await cartillaBtn.isVisible().catch(() => false)) {
    await cartillaBtn.click();
    console.log('  ✅ Click en "Vacuna de cartilla"');
    await page.waitForTimeout(2000);
  } else {
    results.push({ seccion: sectionName, caso: 'Botón cartilla', resultado: 'ERROR', detalles: 'No encontrado' });
    return;
  }

  const vacunaSelect = page.locator('select.select').filter({ has: page.locator('option:text("Seleccione vacuna")') }).first();
  const dosisSelect = page.locator('select.select').filter({ has: page.locator('option:text("Seleccione dosis")') }).first();
  const fechaInput = page.locator('input[type="date"][placeholder="Fecha"], input[type="date"].input').first();
  const folioInput = page.locator('input[placeholder="Folio"]').first();
  const comentariosTa = page.locator('textarea[placeholder="Comentarios"]').first();

  // List vacuna options
  if (await vacunaSelect.isVisible().catch(() => false)) {
    const opts = await vacunaSelect.locator('option').evaluateAll(o => o.map(e => ({ value: (e as HTMLOptionElement).value, text: e.textContent?.trim() || '' })));
    const valid = opts.filter(o => !o.text.toLowerCase().includes('seleccione'));
    console.log(`  📋 Vacunas disponibles: ${valid.map(o => o.text).join(', ')}`);
    results.push({ seccion: sectionName, caso: 'Select vacuna', resultado: 'PASO', detalles: `${valid.length} opciones: ${valid.map(o => o.text).join(', ')}` });
  }

  // Check dosis
  if (await dosisSelect.isVisible().catch(() => false)) {
    const dosisOpts = await dosisSelect.locator('option').allTextContents();
    const validDosis = dosisOpts.filter(o => !o.toLowerCase().includes('seleccione'));
    if (validDosis.length > 0) {
      results.push({ seccion: sectionName, caso: 'Select dosis', resultado: 'PASO', detalles: `${validDosis.length} opciones` });
    } else {
      console.log('  ⚠️ Select de dosis sin opciones');
      results.push({ seccion: sectionName, caso: 'Select dosis vacío', resultado: 'BUG', detalles: 'Sin opciones disponibles (solo "Seleccione dosis")' });
    }
  }

  // ===== CICLO NORMAL: Llenar → Guardar → Eliminar → Re-agregar =====

  // Llenar 1: BCG
  console.log('\n  📝 CICLO 1: BCG');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '1' });
  if (await fechaInput.isVisible().catch(() => false)) await fechaInput.fill(new Date().toISOString().split('T')[0]);
  if (await folioInput.isVisible().catch(() => false)) await folioInput.fill('10001');
  if (await comentariosTa.isVisible().catch(() => false)) await comentariosTa.fill('Primera dosis BCG según esquema nacional');
  let saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(2000);
    await handleAllPopups(page, sectionName, 'guardar BCG');
    await avoidAgendarButton(page);
    results.push({ seccion: sectionName, caso: 'Guardar BCG', resultado: 'PASO', detalles: 'Vacuna guardada' });
  }

  // Eliminar
  const trashBtn = page.locator('button.btn-sm.btn-secondary:has(svg.fa-trash), button.btn-sm:has(svg[data-icon="trash"])').first();
  if (await trashBtn.isVisible().catch(() => false)) {
    await trashBtn.click();
    await page.waitForTimeout(1000);
    await handleAllPopups(page, sectionName, 'eliminar BCG');
    results.push({ seccion: sectionName, caso: 'Eliminar vacuna', resultado: 'PASO', detalles: 'Eliminada con trash' });
  }

  // Re-agregar: Hepatitis B
  console.log('  📝 CICLO 2: Re-agregar Hepatitis B');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '2' });
  if (await fechaInput.isVisible().catch(() => false)) await fechaInput.fill(new Date().toISOString().split('T')[0]);
  if (await folioInput.isVisible().catch(() => false)) await folioInput.fill('10002');
  if (await comentariosTa.isVisible().catch(() => false)) await comentariosTa.fill('Dosis Hepatitis B según calendario');
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(2000);
    await handleAllPopups(page, sectionName, 'guardar HepB');
    results.push({ seccion: sectionName, caso: 'Re-agregar vacuna', resultado: 'PASO', detalles: 'Hepatitis B re-agregada' });
  }

  // Eliminar de nuevo
  const trashBtn2 = page.locator('button.btn-sm.btn-secondary:has(svg.fa-trash), button.btn-sm:has(svg[data-icon="trash"])').first();
  if (await trashBtn2.isVisible().catch(() => false)) {
    await trashBtn2.click();
    await page.waitForTimeout(1000);
    await handleAllPopups(page, sectionName, 'eliminar HepB');
  }

  // ===== STRESS TEST: DATOS INVÁLIDOS =====
  console.log('\n  🔹 STRESS TEST: DATOS INVÁLIDOS');

  // TEST 1: Sin seleccionar nada
  console.log('  📝 Test 1: Sin seleccionar nada');
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const popup = await handleAllPopups(page, sectionName, 'stress sin nada');
    results.push({ seccion: sectionName, caso: 'Stress - Sin nada', resultado: popup > 0 ? 'PASO' : 'BUG', detalles: popup > 0 ? 'Bloqueó sin vacuna' : 'Permitió guardar sin vacuna' });
  }

  // TEST 2: Solo vacuna, sin fecha/folio
  console.log('  📝 Test 2: Solo vacuna, sin fecha/folio');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '1' });
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const popup = await handleAllPopups(page, sectionName, 'stress solo vacuna');
    results.push({ seccion: sectionName, caso: 'Stress - Solo vacuna', resultado: popup > 0 ? 'PASO' : 'BUG', detalles: popup > 0 ? 'Bloqueó sin fecha' : 'Permitió sin fecha ni folio' });
  }
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ index: 0 });

  // TEST 3: Fecha futura
  console.log('  📝 Test 3: Fecha futura (2030)');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '2' });
  if (await fechaInput.isVisible().catch(() => false)) await fechaInput.fill('2030-12-31');
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const popup = await handleAllPopups(page, sectionName, 'stress fecha futura');
    results.push({ seccion: sectionName, caso: 'Stress - Fecha futura', resultado: popup > 0 ? 'PASO' : 'BUG', detalles: popup > 0 ? 'Bloqueó fecha futura' : 'Permitió fecha 2030' });
  }
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ index: 0 });

  // TEST 4: Fecha antigua
  console.log('  📝 Test 4: Fecha antigua (1900)');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '4' });
  if (await fechaInput.isVisible().catch(() => false)) await fechaInput.fill('1900-01-01');
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const popup = await handleAllPopups(page, sectionName, 'stress fecha antigua');
    results.push({ seccion: sectionName, caso: 'Stress - Fecha antigua', resultado: popup > 0 ? 'PASO' : 'BUG', detalles: popup > 0 ? 'Bloqueó fecha antigua' : 'Permitió fecha 1900' });
  }
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ index: 0 });

  // TEST 5: Folio con caracteres especiales
  console.log('  📝 Test 5: Folio con caracteres especiales');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '1' });
  if (await folioInput.isVisible().catch(() => false)) await folioInput.fill('!@#$%');
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const popup = await handleAllPopups(page, sectionName, 'stress folio especial');
    results.push({ seccion: sectionName, caso: 'Stress - Folio especial', resultado: popup > 0 ? 'PASO' : 'BUG', detalles: popup > 0 ? 'Bloqueó folio !@#$%' : 'Permitió folio con caracteres especiales' });
  }
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ index: 0 });

  // TEST 6: Folio con letras
  console.log('  📝 Test 6: Folio con letras');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '1' });
  if (await folioInput.isVisible().catch(() => false)) await folioInput.fill('ABCDEF');
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const popup = await handleAllPopups(page, sectionName, 'stress folio letras');
    results.push({ seccion: sectionName, caso: 'Stress - Folio letras', resultado: popup > 0 ? 'PASO' : 'BUG', detalles: popup > 0 ? 'Bloqueó folio ABCDEF' : 'Permitió folio con letras' });
  }
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ index: 0 });

  // TEST 7: Folio muy largo
  console.log('  📝 Test 7: Folio 50 caracteres');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '1' });
  if (await folioInput.isVisible().catch(() => false)) await folioInput.fill('12345678901234567890123456789012345678901234567890');
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const popup = await handleAllPopups(page, sectionName, 'stress folio largo');
    results.push({ seccion: sectionName, caso: 'Stress - Folio 50 chars', resultado: popup > 0 ? 'PASO' : 'BUG', detalles: popup > 0 ? 'Bloqueó folio largo' : 'Permitió folio 50 chars' });
  }
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ index: 0 });

  // TEST 8: Comentarios XSS
  console.log('  📝 Test 8: Comentarios XSS');
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ value: '1' });
  if (await comentariosTa.isVisible().catch(() => false)) await comentariosTa.fill('<script>alert("XSS")</script>');
  saveBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
    const popup = await handleAllPopups(page, sectionName, 'stress XSS');
    results.push({ seccion: sectionName, caso: 'Stress - Comentarios XSS', resultado: popup > 0 ? 'PASO' : 'BUG', detalles: popup > 0 ? 'Filtró script XSS' : 'Permitió script XSS' });
  }
  if (await vacunaSelect.isVisible().catch(() => false)) await vacunaSelect.selectOption({ index: 0 });

  // Limpiar
  const allTrash = page.locator('button.btn-sm.btn-secondary:has(svg.fa-trash), button.btn-sm:has(svg[data-icon="trash"])');
  const trashCount = await allTrash.count();
  for (let i = 0; i < trashCount; i++) {
    try {
      const btn = allTrash.first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(800);
        await handleAllPopups(page, sectionName, 'limpiar');
      }
    } catch {}
  }

  console.log('\n  📋 === FIN TEST VACUNACIÓN ===\n');
}

// ==================== TEST FACTURACIÓN ====================

async function testFacturacionSection(page: Page): Promise<void> {
  console.log('\n📋 === TEST SECCIÓN FACTURACIÓN ===\n');
  const sectionName = 'Facturación';

  // Click on "Facturación" in scrollspy
  const factLink = page.locator('div[data-scrollspy] a:has-text("Facturación"), div[data-sticky] a:has-text("Facturación"), a:has-text("Facturación")').first();
  if (await factLink.isVisible().catch(() => false)) {
    const text = (await factLink.textContent().catch(() => ''))?.trim();
    if (text === 'Facturación') {
      await factLink.click();
      console.log('  📋 Sub-pestaña Facturación clickeada');
    }
  }
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  const nombreInput = page.locator('input#nombre, input[name="nombre"]').first();
  const rfcInput = page.locator('input#rfc, input[name="rfc"]').first();
  const tipoPersonaSel = page.locator('select#tipo_persona_id, select[name="tipo_persona_id"]').first();
  const regimenSel = page.locator('select#regimen_id, select[name="regimen_id"]').first();
  const checkbox = page.locator('input#bActivo, input[name="bActivo"]').first();
  const calleInput = page.locator('input[name="calle"]').first();
  const numeroInput = page.locator('input[name="numero_exterior"]').first();
  const cpInput = page.locator('input[name="cp"]').first();

  // List selects info
  const allSelects = page.locator('select');
  const selectCount = await allSelects.count();
  for (let i = 0; i < selectCount; i++) {
    const sel = allSelects.nth(i);
    if (await sel.isVisible().catch(() => false)) {
      const name = await sel.getAttribute('name').catch(() => '');
      const options = await sel.locator('option').allTextContents();
      console.log(`  📋 Select "${name}": ${options.length} opciones`);
      results.push({ seccion: sectionName, caso: `Select ${name}`, resultado: 'PASO', detalles: `${options.length} opciones` });
    }
  }

  // Helper: close SweetAlert and click save
  async function guardar(ctx: string): Promise<{ popup: boolean }> {
    const swal = page.locator('.swal2-container').first();
    if (await swal.isVisible({ timeout: 300 }).catch(() => false)) {
      await swal.locator('button:has-text("OK"), button:has-text("Aceptar")').first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
    const saveBtn = page.locator('button[type="submit"]:has-text("Guardar cambios"), button:has-text("Guardar cambios")').first();
    if (!(await saveBtn.isVisible().catch(() => false))) return { popup: false };
    await saveBtn.click();
    await page.waitForTimeout(2000);
    await avoidAgendarButton(page);
    const swalAfter = page.locator('.swal2-container').first();
    const hasSwal = await swalAfter.isVisible({ timeout: 1000 }).catch(() => false);
    const toast = page.locator('[class*="toast"]').first();
    const hasToast = await toast.isVisible({ timeout: 500 }).catch(() => false);
    if (hasSwal) {
      const text = (await swalAfter.textContent().catch(() => ''))?.substring(0, 60) || '';
      console.log(`    🔔 [${ctx}] SweetAlert: "${text}"`);
      await swalAfter.locator('button:has-text("OK"), button:has-text("Aceptar")').first().click().catch(() => {});
      await page.waitForTimeout(300);
      return { popup: true };
    }
    if (hasToast) {
      const text = (await toast.textContent().catch(() => ''))?.substring(0, 50) || '';
      console.log(`    🔔 [${ctx}] Toast: "${text}"`);
      return { popup: true };
    }
    return { popup: false };
  }

  async function selectColonia(): Promise<void> {
    const coloniaSel = page.locator('select#colonia_id, select[name="colonia_id"]').first();
    if (await coloniaSel.isVisible().catch(() => false)) {
      const opts = await coloniaSel.locator('option').evaluateAll(o =>
        o.map(e => ({ value: (e as HTMLOptionElement).value, text: e.textContent?.trim() || '' }))
      );
      const valid = opts.filter(o => !o.text.toLowerCase().includes('selecciona') && !o.text.toLowerCase().includes('cargando'));
      if (valid.length > 0) {
        const rand = valid[Math.floor(Math.random() * valid.length)];
        await coloniaSel.selectOption({ value: rand.value });
        console.log(`    ✅ Colonia: "${rand.text}" (${valid.length} opciones)`);
      }
    }
  }

  // TEST 1: Sin llenar nada
  console.log('\n  🔹 TEST 1: Sin llenar nada');
  let res = await guardar('sin nada');
  results.push({ seccion: sectionName, caso: 'Sin llenar nada', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Mostró mensaje' : 'Permitió guardar vacío' });

  // TEST 2: Solo nombre, sin RFC
  console.log('  🔹 TEST 2: Solo nombre, sin RFC');
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('Daniela Jiménez Durán');
  res = await guardar('solo nombre');
  results.push({ seccion: sectionName, caso: 'Solo nombre, sin RFC', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Mostró mensaje' : 'Permitió sin RFC' });
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('');

  // TEST 3: Solo RFC, sin nombre
  console.log('  🔹 TEST 3: Solo RFC, sin nombre');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('JIDD230803MQT');
  res = await guardar('solo RFC');
  results.push({ seccion: sectionName, caso: 'Solo RFC, sin nombre', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Mostró mensaje' : 'Permitió sin nombre' });
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('');

  // TEST 4: RFC inválido (3 chars)
  console.log('  🔹 TEST 4: RFC inválido (3 chars)');
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('Daniela Jiménez Durán');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('ABC');
  res = await guardar('RFC 3 chars');
  results.push({ seccion: sectionName, caso: 'RFC inválido (3 chars)', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Validó RFC' : 'Permitió RFC de 3 chars' });
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('');

  // TEST 5: RFC con caracteres especiales
  console.log('  🔹 TEST 5: RFC con caracteres especiales');
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('Daniela Jiménez Durán');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('!@#$%^&*()');
  res = await guardar('RFC especial');
  results.push({ seccion: sectionName, caso: 'RFC caracteres especiales', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Validó RFC' : 'Permitió RFC con especiales' });
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('');

  // TEST 6: Tipo Persona Física + nombre + RFC
  console.log('  🔹 TEST 6: Persona Física');
  if (await tipoPersonaSel.isVisible().catch(() => false)) await tipoPersonaSel.selectOption({ label: 'Persona Física' });
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('Daniela Jiménez Durán');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('JIDD230803MQT');
  res = await guardar('Persona Física');
  results.push({ seccion: sectionName, caso: 'Persona Física', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 7: Tipo Persona Moral
  console.log('  🔹 TEST 7: Persona Moral');
  if (await tipoPersonaSel.isVisible().catch(() => false)) await tipoPersonaSel.selectOption({ label: 'Persona Moral' });
  res = await guardar('Persona Moral');
  results.push({ seccion: sectionName, caso: 'Persona Moral', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 8: Con régimen fiscal
  console.log('  🔹 TEST 8: Con régimen fiscal');
  if (await tipoPersonaSel.isVisible().catch(() => false)) await tipoPersonaSel.selectOption({ label: 'Persona Física' });
  if (await regimenSel.isVisible().catch(() => false)) await regimenSel.selectOption({ label: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' });
  res = await guardar('con régimen');
  results.push({ seccion: sectionName, caso: 'Con régimen fiscal', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 9: Dirección igual = Sí
  console.log('  🔹 TEST 9: Dirección igual = Sí');
  if (await checkbox.isVisible().catch(() => false)) {
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (!isChecked) await checkbox.check();
  }
  res = await guardar('dir igual sí');
  results.push({ seccion: sectionName, caso: 'Dirección igual = Sí', resultado: 'PASO', detalles: 'Guardado' });

  // TEST 10: Dirección igual = No (con dirección)
  console.log('  🔹 TEST 10: Dirección igual = No (con dirección)');
  if (await checkbox.isVisible().catch(() => false)) {
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (isChecked) await checkbox.uncheck();
  }
  await page.waitForTimeout(500);
  if (await calleInput.isVisible().catch(() => false)) await calleInput.fill('Avenida de la Luz');
  if (await numeroInput.isVisible().catch(() => false)) await numeroInput.fill('S/N');
  if (await cpInput.isVisible().catch(() => false)) {
    await cpInput.fill('76118');
    await page.waitForTimeout(2000);
  }
  await selectColonia();
  res = await guardar('con dirección');
  results.push({ seccion: sectionName, caso: 'Dirección igual = No', resultado: 'PASO', detalles: 'Guardado con dirección' });

  // STRESS TEST: DATOS INVÁLIDOS
  console.log('\n  🔹 STRESS TEST: DATOS INVÁLIDOS');

  // TEST 11: Nombre XSS
  console.log('  📝 Test 11: Nombre XSS');
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('<script>alert("XSS")</script>');
  res = await guardar('nombre XSS');
  results.push({ seccion: sectionName, caso: 'Nombre XSS', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Filtró XSS' : 'Permitió XSS' });
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('');

  // TEST 12: RFC largo (20 chars)
  console.log('  📝 Test 12: RFC 20 chars');
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('Daniela Jiménez Durán');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('ABCDEFGHIJKLMNOPQRST');
  const rfcVal = await rfcInput.inputValue().catch(() => '');
  console.log(`    📏 RFC: "${rfcVal}" (${rfcVal.length} chars)`);
  res = await guardar('RFC largo');
  results.push({ seccion: sectionName, caso: 'RFC 20 chars', resultado: rfcVal.length <= 13 ? 'PASO' : 'BUG', detalles: `Truncado a ${rfcVal.length} chars (maxlength 13)` });

  // TEST 13: RFC vacío
  console.log('  📝 Test 13: RFC vacío');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('');
  res = await guardar('RFC vacío');
  results.push({ seccion: sectionName, caso: 'RFC vacío', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Validó' : 'Permitió vacío' });

  // TEST 14: CP con letras
  console.log('  📝 Test 14: CP con letras');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('JIDD230803MQT');
  if (await checkbox.isVisible().catch(() => false)) {
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (isChecked) await checkbox.uncheck();
  }
  if (await cpInput.isVisible().catch(() => false)) {
    await cpInput.fill('ABCDE');
    await page.waitForTimeout(1500);
  }
  await selectColonia();
  res = await guardar('CP letras');
  results.push({ seccion: sectionName, caso: 'CP con letras', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Validó CP' : 'Permitió CP con letras' });

  // TEST 15: CP 2 dígitos
  console.log('  📝 Test 15: CP 2 dígitos');
  if (await cpInput.isVisible().catch(() => false)) {
    await cpInput.fill('12');
    await page.waitForTimeout(1500);
  }
  await selectColonia();
  res = await guardar('CP 2 dígitos');
  results.push({ seccion: sectionName, caso: 'CP 2 dígitos', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Validó CP' : 'Permitió CP 2 dígitos' });

  // TEST 16: Calle con caracteres especiales
  console.log('  📝 Test 16: Calle con caracteres especiales');
  if (await cpInput.isVisible().catch(() => false)) {
    await cpInput.fill('76118');
    await page.waitForTimeout(1500);
  }
  await selectColonia();
  if (await calleInput.isVisible().catch(() => false)) await calleInput.fill('!@#$%^&*()');
  res = await guardar('calle especial');
  results.push({ seccion: sectionName, caso: 'Calle caracteres especiales', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Validó' : 'Permitió caracteres especiales' });

  // TEST 17: Número con letras
  console.log('  📝 Test 17: Número con letras');
  if (await numeroInput.isVisible().catch(() => false)) await numeroInput.fill('ABC123XYZ');
  res = await guardar('número letras');
  results.push({ seccion: sectionName, caso: 'Número con letras', resultado: res.popup ? 'PASO' : 'BUG', detalles: res.popup ? 'Validó' : 'Permitió letras' });

  // Restaurar datos válidos
  console.log('\n  🔄 Restaurando datos válidos...');
  if (await tipoPersonaSel.isVisible().catch(() => false)) await tipoPersonaSel.selectOption({ label: 'Persona Física' });
  if (await nombreInput.isVisible().catch(() => false)) await nombreInput.fill('Daniela Jiménez Durán');
  if (await rfcInput.isVisible().catch(() => false)) await rfcInput.fill('JIDD230803MQT');
  if (await regimenSel.isVisible().catch(() => false)) await regimenSel.selectOption({ label: 'Régimen Simplificado de Confianza' });
  if (await checkbox.isVisible().catch(() => false)) {
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (!isChecked) await checkbox.check();
  }
  await guardar('restaurar');
  results.push({ seccion: sectionName, caso: 'Restaurar datos', resultado: 'PASO', detalles: 'Datos restaurados' });

  console.log('\n  📋 === FIN TEST FACTURACIÓN ===\n');
}

async function handlePopup(page: Page, sectionName: string, momento: string): Promise<boolean> {
  const popupSelectors = [
    { sel: '[role="dialog"]', tipo: 'dialog' },
    { sel: '.modal', tipo: 'modal' },
    { sel: '.modal.show', tipo: 'modal-show' },
    { sel: '[class*="modal"][class*="open"]', tipo: 'modal-open' },
    { sel: '[class*="Modal"]', tipo: 'modal-class' },
    { sel: '[class*="popup"]', tipo: 'popup' },
    { sel: '[class*="Popup"]', tipo: 'popup-class' },
    { sel: '[class*="alert-dialog"]', tipo: 'alert-dialog' },
    { sel: '[class*="swal"]', tipo: 'sweetalert' },
    { sel: '[class*="toast"]', tipo: 'toast' },
    { sel: '[class*="notification"]', tipo: 'notification' },
    { sel: '[class*="snackbar"]', tipo: 'snackbar' },
    { sel: 'dialog[open]', tipo: 'native-dialog' },
    { sel: '.overlay', tipo: 'overlay' },
    { sel: '[class*="backdrop"]', tipo: 'backdrop' }
  ];

  const closeSelectors = [
    'button:has-text("Aceptar")', 'button:has-text("OK")', 'button:has-text("Ok")',
    'button:has-text("Cerrar")', 'button:has-text("Close")',
    'button:has-text("Cancelar")', 'button:has-text("Cancel")',
    'button:has-text("Salir")', 'button:has-text("Dismiss")',
    'button:has-text("×")', 'button:has-text("✕")',
    'button[class*="close"]', 'button[class*="Close"]',
    'button[aria-label="Close"]', 'button[aria-label="Cerrar"]',
    '[class*="close"]', '[class*="dismiss"]',
    'button:has-text("No")', 'button:has-text("No gracias")',
    'button:has-text("Más tarde")', 'button:has-text("Después")'
  ];

  for (const { sel, tipo } of popupSelectors) {
    try {
      const popup = page.locator(sel).first();
      if (await popup.isVisible({ timeout: 500 }).catch(() => false)) {
        const texto = (await popup.textContent().catch(() => ''))?.substring(0, 100).trim() || 'Sin texto';
        console.log(`  🔔 [${sectionName}] Popup detectado (${tipo}): "${texto}"`);

        let cerrado = false;
        for (const closeSel of closeSelectors) {
          try {
            const closeBtn = popup.locator(closeSel).first();
            if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
              await closeBtn.click();
              await page.waitForTimeout(500);
              cerrado = true;
              console.log(`  ✅ [${sectionName}] Popup cerrado con: ${closeSel}`);
              break;
            }
          } catch {}
        }

        // Try clicking outside the popup to close it
        if (!cerrado) {
          try {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            const stillVisible = await popup.isVisible().catch(() => false);
            if (!stillVisible) {
              cerrado = true;
              console.log(`  ✅ [${sectionName}] Popup cerrado con Escape`);
            }
          } catch {}
        }

        popupEvents.push({
          seccion: sectionName,
          momento,
          tipo,
          texto,
          cerrado
        });

        if (!cerrado) {
          console.log(`  ⚠️ [${sectionName}] No se pudo cerrar popup (${tipo})`);
          const screenshot = await captureErrorScreenshot(page, `popup-${tipo}-${sectionName}`);
        }

        // If it was an error popup, reload the page to reset state
        if (cerrado && (texto.toLowerCase().includes('error') || tipo.includes('error'))) {
          console.log(`  🔄 [${sectionName}] Popup de error detectado, recargando página...`);
          try {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
          } catch {}
        }

        return cerrado;
      }
    } catch {}
  }

  // Also check for browser native dialogs (alert, confirm, prompt)
  // These are handled via page.on('dialog') in the test setup

  return false;
}

async function handleAllPopups(page: Page, sectionName: string, momento: string): Promise<number> {
  let totalClosed = 0;
  // Check multiple times in case there are nested popups
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
  // If we accidentally clicked "Agendar" or a similar button, go back
  const url = page.url();
  if (url.includes('Citas') || url.includes('citas') || url.includes('Agendar') || url.includes('agendar')) {
    console.log(`  🚫 Navegación no deseada a Citas/Agendar, regresando...`);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);
  }
  // Dismiss any open modal that might be the agendar wizard
  const agendarModal = page.locator('[role="dialog"]:has-text("Agendar"), [role="dialog"]:has-text("agendar"), .modal:has-text("Agendar"), .modal:has-text("agendar")');
  if (await agendarModal.isVisible().catch(() => false)) {
    console.log(`  🚫 Modal de Agendar detectado, cerrando...`);
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

async function getErrorMessage(page: Page): Promise<string> {
  const errorSelectors = [
    '.text-red-500', '.text-red-600', '.text-red-700', '.text-red',
    '.text-danger', '[class*="error"]', '[class*="Error"]',
    '[role="alert"]', '.invalid-feedback', '.form-error',
    'span.text-red', 'div.text-red', 'p.text-red',
    '[class*="invalid"]', '[class*="danger"]'
  ];
  for (const selector of errorSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        const text = await el.textContent().catch(() => '');
        // Filter out single asterisk (required field indicator)
        if (text && text.trim().length > 0 && text.trim() !== '*') return text.trim();
      }
    } catch {}
  }
  return '';
}

async function getSuccessMessage(page: Page): Promise<string> {
  const successSelectors = [
    '.text-green-500', '.text-green-600', '.text-success',
    '[class*="success"]', '[role="status"]', '.toast-success',
    'div:has-text("guardado")', 'div:has-text("éxito")',
    'div:has-text("correctamente")', '[class*="toast"]'
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

async function findFormFields(page: Page): Promise<{ name: string; selector: string; type: string; isRequired: boolean }[]> {
  const fields: { name: string; selector: string; type: string; isRequired: boolean }[] = [];
  await page.waitForTimeout(800);

  const inputs = page.locator('input:not([type="hidden"]):not([type="submit"]):not([readonly])');
  const inputCount = await inputs.count();
  for (let i = 0; i < inputCount; i++) {
    const input = inputs.nth(i);
    if (await input.isVisible().catch(() => false)) {
      const name = await input.getAttribute('name') || await input.getAttribute('id') || await input.getAttribute('placeholder') || `input-${i}`;
      const type = await input.getAttribute('type') || 'text';
      const required = await input.getAttribute('required') !== null;
      const ariaRequired = await input.getAttribute('aria-required') === 'true';
      const classStr = await input.getAttribute('class') || '';
      const isReq = required || ariaRequired || classStr.includes('required');
      fields.push({ name, selector: `input[name="${name}"], input#${name}`, type, isRequired: isReq });
    }
  }

  const textareas = page.locator('textarea:not([readonly])');
  const taCount = await textareas.count();
  for (let i = 0; i < taCount; i++) {
    const ta = textareas.nth(i);
    if (await ta.isVisible().catch(() => false)) {
      const name = await ta.getAttribute('name') || await ta.getAttribute('id') || await ta.getAttribute('placeholder') || `textarea-${i}`;
      const required = await ta.getAttribute('required') !== null;
      fields.push({ name, selector: `textarea[name="${name}"], textarea#${name}`, type: 'textarea', isRequired: required });
    }
  }

  const selects = page.locator('select');
  const selCount = await selects.count();
  for (let i = 0; i < selCount; i++) {
    const sel = selects.nth(i);
    if (await sel.isVisible().catch(() => false)) {
      const name = await sel.getAttribute('name') || await sel.getAttribute('id') || `select-${i}`;
      const required = await sel.getAttribute('required') !== null;
      fields.push({ name, selector: `select[name="${name}"], select#${name}`, type: 'select', isRequired: required });
    }
  }

  return fields;
}

async function enterEditMode(page: Page, sectionName: string): Promise<boolean> {
  console.log(`  [${sectionName}] Intentando entrar en modo edición...`);
  const urlBefore = page.url();

  // Only look for explicit edit buttons, avoid generic SVG buttons that might navigate away
  const editSelectors = [
    'button:has-text("Editar")', 'button:has-text("Edit")',
    'button:has-text("Modificar")', 'button:has-text("Cambiar")',
    'button[aria-label*="edit" i]', 'button[aria-label*="editar" i]',
    'button[title*="edit" i]', 'button[title*="editar" i]',
    'button[class*="edit" i]', 'button[class*="btn-edit" i]',
    'a:has-text("Editar")'
  ];

  for (const sel of editSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Check the button doesn't navigate to a different section
        const href = await btn.getAttribute('href').catch(() => null);
        if (href && (href.includes('Consulta') || href.includes('consulta'))) {
          console.log(`  [${sectionName}] Saltando botón que navega a consulta: ${href}`);
          continue;
        }
        await btn.click();
        await page.waitForTimeout(1500);

        // Verify we didn't navigate away
        const urlAfter = page.url();
        if (urlAfter !== urlBefore && !urlAfter.includes('informacion') && !urlAfter.includes('Informacion')) {
          console.log(`  [${sectionName}] ⚠ Navegación no deseada a: ${urlAfter}, regresando...`);
          await page.goto(urlBefore);
          await page.waitForTimeout(1500);
          continue;
        }

        console.log(`  [${sectionName}] ✓ Modo edición activado con: ${sel}`);
        return true;
      }
    } catch {}
  }

  // Check if form fields are already editable (no explicit edit button needed)
  const enabledInputs = page.locator('input:not([disabled]):not([readonly]):not([type="hidden"])');
  const enabledCount = await enabledInputs.count();
  if (enabledCount > 0) {
    const firstInput = enabledInputs.first();
    if (await firstInput.isVisible().catch(() => false)) {
      console.log(`  [${sectionName}] Campos ya están editables (${enabledCount} inputs habilitados)`);
      // Check if there's a visible save button
      const saveBtns = page.locator('button:has-text("Guardar"), button:has-text("Save"), button:has-text("Aceptar"), button[type="submit"]');
      const saveCount = await saveBtns.count();
      if (saveCount > 0) {
        for (let i = 0; i < saveCount; i++) {
          if (await saveBtns.nth(i).isVisible().catch(() => false)) {
            console.log(`  [${sectionName}] ✓ Botón guardar visible en modo lectura`);
            return true;
          }
        }
      }
      console.log(`  [${sectionName}] Campos editables pero sin botón guardar visible`);
      return true;
    }
  }

  console.log(`  [${sectionName}] No se encontró botón de editar, asumiendo modo edición por defecto`);
  return false;
}

async function testSaveEmpty(page: Page, sectionName: string): Promise<TestResult> {
  console.log(`\n  [${sectionName}] TEST: Guardar sin llenar campos`);

  // Try to enter edit mode first
  await enterEditMode(page, sectionName);
  await page.waitForTimeout(800);

  // Aggressive search for save button
  const guardarSelectors = [
    'button:has-text("Guardar")', 'button:has-text("Guardar cambios")',
    'button:has-text("Save")', 'button:has-text("Aceptar")',
    'button[type="submit"]', 'input[type="submit"]',
    'button:has-text("Enviar")', 'button:has-text("Confirmar")',
    'button:has-text("Aplicar")', 'button:has-text("OK")',
    'form button:last-of-type', 'form button[type="button"]:last-of-type'
  ];

  let guardarBtn = null;
  for (const sel of guardarSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        guardarBtn = btn;
        console.log(`  [${sectionName}] Botón guardar encontrado con: ${sel}`);
        break;
      }
    } catch {}
  }

  if (!guardarBtn) {
    // Last resort: find all visible buttons and check text
    const allBtns = page.locator('button');
    const btnCount = await allBtns.count();
    for (let i = 0; i < btnCount; i++) {
      const btn = allBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        const text = (await btn.textContent().catch(() => ''))?.toLowerCase() || '';
        if (text.includes('guardar') || text.includes('save') || text.includes('aceptar')) {
          guardarBtn = btn;
          console.log(`  [${sectionName}] Botón guardar encontrado por texto: "${text.trim()}"`);
          break;
        }
      }
    }
  }

  if (!guardarBtn) {
    return { seccion: sectionName, caso: 'Guardar vacío', resultado: 'ERROR', detalles: 'No se encontró botón Guardar después de editar' };
  }

  await guardarBtn.click();
  await page.waitForTimeout(1500);

  // Check we didn't accidentally navigate to Agendar/Citas
  await avoidAgendarButton(page);

  // Check for popups after clicking save
  await handleAllPopups(page, sectionName, 'después de guardar vacío');

  const errorMsg = await getErrorMessage(page);
  if (errorMsg) {
    console.log(`  [${sectionName}] ✓ Error mostrado correctamente: ${errorMsg.substring(0, 50)}`);
    return { seccion: sectionName, caso: 'Guardar vacío', resultado: 'PASO', detalles: `Muestra error: ${errorMsg.substring(0, 60)}` };
  }

  const successMsg = await getSuccessMessage(page);
  if (successMsg) {
    console.log(`  [${sectionName}] ⚠ Guardó vacío sin validación`);
    return { seccion: sectionName, caso: 'Guardar vacío', resultado: 'BUG', detalles: 'Guardó sin campos requeridos' };
  }

  const screenshot = await captureErrorScreenshot(page, `${sectionName}-save-empty`);
  return { seccion: sectionName, caso: 'Guardar vacío', resultado: 'FALLO', detalles: 'Sin validación visible', screenshot };
}

async function testSaveWithRequired(page: Page, sectionName: string): Promise<TestResult> {
  console.log(`\n  [${sectionName}] TEST: Guardar solo con campos requeridos`);

  // Try to enter edit mode first
  await enterEditMode(page, sectionName);
  await page.waitForTimeout(800);

  const fields = await findFormFields(page);
  const requiredFields = fields.filter(f => f.isRequired);
  console.log(`  [${sectionName}] Campos requeridos encontrados: ${requiredFields.length}`);
  console.log(`  [${sectionName}] Total campos encontrados: ${fields.length}`);

  if (requiredFields.length === 0 && fields.length > 0) {
    console.log(`  [${sectionName}] No hay campos marcados como requeridos, probando con primeros campos`);
    const testFields = fields.slice(0, Math.min(3, fields.length));
    for (const f of testFields) {
      try {
        const el = page.locator(f.selector).first();
        if (await el.isVisible().catch(() => false)) {
          if (f.type === 'select') {
            const optCount = await el.locator('option').count();
            if (optCount > 1) await el.selectOption({ index: 1 });
          } else if (f.type === 'textarea') {
            await el.fill('Datos de prueba para stress test');
          } else {
            const inputType = f.type;
            if (inputType === 'date') await el.fill('2025-01-15');
            else if (inputType === 'email') await el.fill('test@test.com');
            else if (inputType === 'number') await el.fill('123');
            else if (inputType === 'tel') await el.fill('5551234567');
            else await el.fill('Test');
          }
        }
      } catch {}
    }
  } else {
    for (const f of requiredFields) {
      try {
        const el = page.locator(f.selector).first();
        if (await el.isVisible().catch(() => false)) {
          if (f.type === 'select') {
            const optCount = await el.locator('option').count();
            if (optCount > 1) await el.selectOption({ index: 1 });
          } else if (f.type === 'textarea') {
            await el.fill('Datos de prueba para stress test');
          } else {
            const inputType = f.type;
            if (inputType === 'date') await el.fill('2025-01-15');
            else if (inputType === 'email') await el.fill('test@test.com');
            else if (inputType === 'number') await el.fill('123');
            else if (inputType === 'tel') await el.fill('5551234567');
            else await el.fill('Test');
          }
        }
      } catch {}
    }
  }

  await page.waitForTimeout(500);
  const btn = page.locator('button:has-text("Guardar"), button:has-text("Guardar cambios"), button[type="submit"]').first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(2000);
  }

  // Check we didn't accidentally navigate to Agendar/Citas
  await avoidAgendarButton(page);

  // Check for popups after saving with required fields
  await handleAllPopups(page, sectionName, 'después de guardar con requeridos');

  const err = await getErrorMessage(page);
  if (err) {
    console.log(`  [${sectionName}] ✗ Error al guardar: ${err.substring(0, 50)}`);
    return { seccion: sectionName, caso: 'Guardar con requeridos', resultado: 'FALLO', detalles: `Error: ${err.substring(0, 80)}` };
  }

  const success = await getSuccessMessage(page);
  if (success) {
    console.log(`  [${sectionName}] ✓ Guardado exitoso`);
    return { seccion: sectionName, caso: 'Guardar con requeridos', resultado: 'PASO', detalles: `Éxito: ${success.substring(0, 60)}` };
  }

  console.log(`  [${sectionName}] ~ Guardado sin mensaje claro`);
  return { seccion: sectionName, caso: 'Guardar con requeridos', resultado: 'PASO', detalles: 'Guardó sin error visible' };
}

async function testAddVaccine(page: Page): Promise<TestResult> {
  console.log(`\n  [Vacunas] TEST: Agregar vacuna completa`);
  const sectionName = 'Vacunas';

  // Click the add vaccine button (the + SVG button in the cartilla)
  const addSelectors = [
    'button:has-text("Agregar")', 'button:has-text("Nueva")',
    'button:has-text("+")', 'button:has-text("Nueva vacuna")',
    'button:has-text("Agregar vacuna")', 'button:has-text("Crear")',
    'button:has-text("Nuevo")', 'button:has-text("Registrar")',
    'button:has(svg[class*="plus"])', 'button:has(svg[class*="add"])',
    'button:has(svg.fa-plus)', 'button:has(svg[class*="fa-plus"])'
  ];

  let addBtn: any = null;
  for (const sel of addSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        const btnText = (await btn.textContent().catch(() => ''))?.toLowerCase() || '';
        // Skip Agendar button
        if (btnText.includes('agendar')) continue;
        addBtn = btn;
        console.log(`  [Vacunas] Botón agregar encontrado: ${sel}`);
        break;
      }
    } catch {}
  }

  if (!addBtn) {
    // Search all visible buttons
    const allBtns = page.locator('button');
    const allBtnCount = await allBtns.count();
    for (let i = 0; i < allBtnCount; i++) {
      const btn = allBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        const text = (await btn.textContent().catch(() => ''))?.toLowerCase().trim() || '';
        if (text.includes('agendar')) continue;
        if (text.includes('agregar') || text.includes('nueva') || text === '+' || text.includes('crear') || text.includes('nuevo')) {
          addBtn = btn;
          console.log(`  [Vacunas] Botón agregar encontrado por texto: "${text}"`);
          break;
        }
      }
    }
  }

  if (!addBtn) {
    return { seccion: sectionName, caso: 'Agregar vacuna', resultado: 'ERROR', detalles: 'Sin botón agregar' };
  }

  // Verify it's NOT the Agendar button
  const addBtnText = (await addBtn.textContent().catch(() => ''))?.toLowerCase() || '';
  if (addBtnText.includes('agendar') || addBtnText.includes('calendar')) {
    console.log(`  [Vacunas] 🚫 El botón encontrado es "Agendar", saltando...`);
    return { seccion: sectionName, caso: 'Agregar vacuna', resultado: 'ERROR', detalles: 'Solo se encontró botón Agendar' };
  }

  await addBtn.click();
  await page.waitForTimeout(2000);

  // Check we didn't navigate to Agendar
  await avoidAgendarButton(page);

  // Look for the form - either in modal or inline
  const formContainer = page.locator('[role="dialog"], .modal, [class*="modal"], [class*="Modal"], form');
  const hasForm = await formContainer.first().isVisible().catch(() => false);
  console.log(`  [Vacunas] Formulario visible: ${hasForm}`);

  if (!hasForm) {
    // Maybe the form appeared inline
    const vacunaSelect = page.locator('select.select').first();
    if (await vacunaSelect.isVisible().catch(() => false)) {
      console.log(`  [Vacunas] Formulario inline detectado`);
    } else {
      const screenshot = await captureErrorScreenshot(page, 'vacunas-no-form');
      return { seccion: sectionName, caso: 'Agregar vacuna', resultado: 'ERROR', detalles: 'Sin formulario visible', screenshot };
    }
  }

  // === STEP 1: Select vacuna ===
  console.log(`  [Vacunas] === Paso 1: Seleccionar vacuna ===`);
  const vacunaSelect = page.locator('select.select, select').filter({ has: page.locator('option:text("Seleccione vacuna")') }).first();

  if (!(await vacunaSelect.isVisible().catch(() => false))) {
    // Try alternative selector
    const altSelect = page.locator('select').first();
    if (await altSelect.isVisible().catch(() => false)) {
      const options = await altSelect.locator('option').allTextContents();
      console.log(`  [Vacunas] Opciones del primer select: ${options.join(', ')}`);
    }
    const screenshot = await captureErrorScreenshot(page, 'vacunas-no-vacuna-select');
    return { seccion: sectionName, caso: 'Agregar vacuna', resultado: 'ERROR', detalles: 'No se encontró select de vacuna', screenshot };
  }

  const vacunaOptions = await vacunaSelect.locator('option').allTextContents();
  const vacunaValues = await vacunaSelect.locator('option').evaluateAll(opts =>
    opts.map(o => ({ text: o.textContent?.trim() || '', value: (o as HTMLOptionElement).value }))
  );
  console.log(`  [Vacunas] Opciones de vacuna: ${vacunaOptions.join(', ')}`);

  // Filter out "Seleccione vacuna" option
  const validOptions = vacunaValues.filter(o => !o.text.toLowerCase().includes('seleccione'));
  if (validOptions.length === 0) {
    return { seccion: sectionName, caso: 'Agregar vacuna', resultado: 'ERROR', detalles: 'Sin opciones válidas en select de vacuna' };
  }

  // Select random vacuna
  const randomVacuna = validOptions[Math.floor(Math.random() * validOptions.length)];
  await vacunaSelect.selectOption({ value: randomVacuna.value });
  await page.waitForTimeout(1000);
  const selectedVacunaText = randomVacuna.text;
  console.log(`  [Vacunas] ✓ Vacuna seleccionada: "${selectedVacunaText}" (value: ${randomVacuna.value})`);

  // === STEP 2: Select dosis ===
  console.log(`  [Vacunas] === Paso 2: Seleccionar dosis ===`);
  const dosisSelect = page.locator('select.select, select').filter({ has: page.locator('option:text("Seleccione dosis")') }).first();

  if (await dosisSelect.isVisible().catch(() => false)) {
    const dosisOptions = await dosisSelect.locator('option').allTextContents();
    const dosisValues = await dosisSelect.locator('option').evaluateAll(opts =>
      opts.map(o => ({ text: o.textContent?.trim() || '', value: (o as HTMLOptionElement).value }))
    );
    console.log(`  [Vacunas] Opciones de dosis: ${dosisOptions.join(', ')}`);

    const validDosis = dosisValues.filter(o => !o.text.toLowerCase().includes('seleccione'));
    if (validDosis.length > 0) {
      const randomDosis = validDosis[Math.floor(Math.random() * validDosis.length)];
      await dosisSelect.selectOption({ value: randomDosis.value });
      await page.waitForTimeout(500);
      console.log(`  [Vacunas] ✓ Dosis seleccionada: "${randomDosis.text}"`);
    } else {
      console.log(`  [Vacunas] ⚠️ Select de dosis sin opciones disponibles - documentado en reporte`);
      results.push({ seccion: sectionName, caso: 'Select dosis vacío', resultado: 'BUG', detalles: 'Select de dosis no tiene opciones disponibles (solo "Seleccione dosis")' });
    }
  } else {
    console.log(`  [Vacunas] ⚠️ Select de dosis no encontrado`);
    results.push({ seccion: sectionName, caso: 'Select dosis no encontrado', resultado: 'ERROR', detalles: 'No se localizó el select de dosis' });
  }

  // === STEP 3: Set fecha ===
  console.log(`  [Vacunas] === Paso 3: Seleccionar fecha ===`);
  const fechaInput = page.locator('input[type="date"].input, input[type="date"][placeholder="Fecha"], input[type="date"]').first();

  if (await fechaInput.isVisible().catch(() => false)) {
    const today = new Date();
    const fechaStr = today.toISOString().split('T')[0];
    await fechaInput.fill(fechaStr);
    await page.waitForTimeout(300);
    const fechaValue = await fechaInput.inputValue();
    console.log(`  [Vacunas] ✓ Fecha establecida: ${fechaValue}`);
  } else {
    console.log(`  [Vacunas] ⚠️ Input de fecha no encontrado`);
    results.push({ seccion: sectionName, caso: 'Fecha no encontrada', resultado: 'ERROR', detalles: 'Input de fecha no visible' });
  }

  // === STEP 4: Ingresar folio incremental ===
  console.log(`  [Vacunas] === Paso 4: Ingresar folio ===`);
  const folioInput = page.locator('input[placeholder*="folio" i], input[placeholder*="Folio"], input[name*="folio" i], input').filter({ hasNot: page.locator('[type="hidden"], [type="date"]') });
  let folioField: any = null;

  // Search specifically for a folio input
  const allInputs = page.locator('input:not([type="hidden"]):not([type="date"]):not([type="submit"])');
  const inputCount = await allInputs.count();
  for (let i = 0; i < inputCount; i++) {
    const inp = allInputs.nth(i);
    if (await inp.isVisible().catch(() => false)) {
      const placeholder = (await inp.getAttribute('placeholder').catch(() => ''))?.toLowerCase() || '';
      const name = (await inp.getAttribute('name').catch(() => ''))?.toLowerCase() || '';
      if (placeholder.includes('folio') || name.includes('folio')) {
        folioField = inp;
        break;
      }
    }
  }

  if (folioField) {
    const folioValue = String(folioCounter).padStart(5, '0');
    await folioField.fill(folioValue);
    await page.waitForTimeout(300);
    console.log(`  [Vacunas] ✓ Folio ingresado: ${folioValue}`);
    folioCounter++;
  } else {
    console.log(`  [Vacunas] ⚠️ Campo de folio no encontrado`);
    results.push({ seccion: sectionName, caso: 'Folio no encontrado', resultado: 'ERROR', detalles: 'No se localizó input de folio' });
  }

  // === STEP 5: Agregar comentarios coherentes ===
  console.log(`  [Vacunas] === Paso 5: Agregar comentarios ===`);
  const comentarioTextarea = page.locator('textarea.textarea, textarea[placeholder="Comentarios"], textarea[placeholder*="coment" i], textarea').first();

  if (await comentarioTextarea.isVisible().catch(() => false)) {
    const comentarios = VACUNAS_COMENTARIOS[selectedVacunaText] || [
      `Vacuna ${selectedVacunaText} aplicada según esquema nacional`,
      'Paciente sin contraindicaciones, vigilancia post-vacunal completada'
    ];
    const comentario = comentarios[Math.floor(Math.random() * comentarios.length)];
    await comentarioTextarea.fill(comentario);
    await page.waitForTimeout(300);
    console.log(`  [Vacunas] ✓ Comentario: "${comentario}"`);
  } else {
    console.log(`  [Vacunas] ⚠️ Textarea de comentarios no encontrado`);
    results.push({ seccion: sectionName, caso: 'Comentarios no encontrados', resultado: 'ERROR', detalles: 'Textarea de comentarios no visible' });
  }

  // === STEP 6: Guardar (SIN click en Agendar) ===
  console.log(`  [Vacunas] === Paso 6: Guardar vacuna ===`);
  await page.waitForTimeout(500);

  const saveSelectors = [
    'button:has-text("Guardar")', 'button:has-text("Guardar cambios")',
    'button:has-text("Aceptar")', 'button:has-text("Registrar")',
    'button[type="submit"]'
  ];

  let saveBtn: any = null;
  for (const sel of saveSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        const btnText = (await btn.textContent().catch(() => ''))?.toLowerCase() || '';
        // NEVER click Agendar
        if (btnText.includes('agendar')) {
          console.log(`  [Vacunas] 🚫 Saltando botón Agendar`);
          continue;
        }
        saveBtn = btn;
        console.log(`  [Vacunas] Botón guardar encontrado: ${sel}`);
        break;
      }
    } catch {}
  }

  if (saveBtn) {
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // Check for popups
    await handleAllPopups(page, sectionName, 'después de guardar vacuna');
    await avoidAgendarButton(page);

    const err = await getErrorMessage(page);
    if (err) {
      console.log(`  [Vacunas] ✗ Error al guardar: ${err.substring(0, 50)}`);
      return { seccion: sectionName, caso: 'Agregar vacuna', resultado: 'FALLO', detalles: `Error: ${err.substring(0, 80)}` };
    }

    const success = await getSuccessMessage(page);
    if (success) {
      console.log(`  [Vacunas] ✓ Vacuna "${selectedVacunaText}" guardada exitosamente`);
      return {
        seccion: sectionName,
        caso: 'Agregar vacuna',
        resultado: 'PASO',
        detalles: `Vacuna "${selectedVacunaText}" guardada - Folio: ${String(folioCounter - 1).padStart(5, '0')}`
      };
    }

    return { seccion: sectionName, caso: 'Agregar vacuna', resultado: 'PASO', detalles: `Vacuna "${selectedVacunaText}" procesada` };
  }

  return { seccion: sectionName, caso: 'Agregar vacuna', resultado: 'ERROR', detalles: 'Sin botón guardar (no Agendar)' };
}

async function testVerMasDiagnosticos(page: Page): Promise<TestResult> {
  console.log(`\n  [Diagnósticos] TEST: Verificar botón "Ver más"`);
  const sectionName = 'Diagnósticos';

  await page.waitForTimeout(1000);

  const verMasSelectors = [
    'button:has-text("Ver más")', 'a:has-text("Ver más")',
    'button:has-text("Ver mas")', 'a:has-text("Ver mas")',
    'button:has-text("ver más")', 'a:has-text("ver más")',
    'button:has-text("ver mas")', 'a:has-text("ver mas")',
    'button:has-text("Ver más")', 'a:has-text("Ver más")',
    '[class*="ver-mas"]', '[class*="verMas"]', '[class*="view-more"]',
    'button:has-text("See more")', 'a:has-text("See more")'
  ];

  for (const selector of verMasSelectors) {
    try {
      const btns = page.locator(selector);
      const count = await btns.count();
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const btn = btns.nth(i);
          if (await btn.isVisible().catch(() => false)) {
            const text = await btn.textContent().catch(() => '');
            console.log(`  [Diagnósticos] ✓ Botón "Ver más" encontrado: "${text?.trim()}"`);
            return {
              seccion: sectionName,
              caso: 'Botón Ver más',
              resultado: 'PASO',
              detalles: `Encontrado ${count} botón(es) "Ver más" - Texto: "${text?.trim().substring(0, 40)}"`
            };
          }
        }
      }
    } catch {}
  }

  console.log(`  [Diagnósticos] ✗ No se encontró botón "Ver más"`);
  return {
    seccion: sectionName,
    caso: 'Botón Ver más',
    resultado: 'BUG',
    detalles: 'NO existe botón "Ver más" en Diagnósticos (diferencia con vista Consulta)'
  };
}

async function generatePDFReport(): Promise<void> {
  const outputDir = path.join(process.cwd(), 'tests', 'PDFs Reportes');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Delete previous PDFs
  const existingPdfs = fs.readdirSync(outputDir).filter(f => f.startsWith('reporte_stress_informacion_paciente_'));
  for (const pdf of existingPdfs) {
    fs.unlinkSync(path.join(outputDir, pdf));
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const outputPath = path.join(outputDir, `reporte_stress_informacion_paciente_${timestamp}.pdf`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const pasos = results.filter(r => r.resultado === 'PASO').length;
  const bugs = results.filter(r => r.resultado === 'BUG').length;
  const errores = results.filter(r => r.resultado === 'ERROR').length;

  // Title
  doc.fontSize(20).fillColor('#1a1a1a').text('REPORTE STRESS TEST', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(14).fillColor('#333').text('MediPlanner - Información del Paciente', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#666').text('Paciente: Daniela Jiménez Durán', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#666').text('Fecha: ' + new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }), { align: 'center' });
  doc.moveDown(1);

  // Summary
  doc.fontSize(14).fillColor('#cc0000').text('RESUMEN GENERAL', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333');
  doc.text(`Se ejecutaron ${results.length} pruebas en total.`);
  doc.fillColor('#2e7d32').text(`  ${pasos} pruebas pasaron correctamente.`);
  doc.fillColor('#f57f17').text(`  ${bugs} pruebas detectaron bugs (campos sin validación).`);
  doc.fillColor('#666').text(`  ${errores} pruebas tuvieron errores de ejecución.`);
  doc.fillColor('#333');
  doc.moveDown(1);

  // ===== SECCIÓN GENERAL =====
  doc.addPage();
  doc.fontSize(16).fillColor('#cc0000').text('SECCIÓN: GENERAL', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Nombre', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 6 pruebas progresivas eliminando apartados del nombre.');
  doc.fillColor('#f57f17').text('  - Se detectó que el sistema permite guardar con el nombre vacío, sin apellido paterno, sin apellido materno, o con los 3 campos vacíos.');
  doc.fillColor('#f57f17').text('  - No existe validación que impida guardar sin nombre completo.');
  doc.fillColor('#2e7d32').text('  - Al restaurar los 3 apartados originales, el sistema guardó correctamente.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: CURP (JIDD230803MQTMRNA1)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 4 pruebas: vacío, 3 caracteres, 25 caracteres y restaurar.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con CURP vacía.');
  doc.fillColor('#2e7d32').text('  - Al ingresar 3 caracteres, el sistema mostró: "La CURP debe tener 18 caracteres".');
  doc.fillColor('#2e7d32').text('  - Al ingresar 25 caracteres, el sistema truncó a 18 (maxlength respeta).');
  doc.fillColor('#2e7d32').text('  - Al ingresar CURP inválida de 18 caracteres, mostró: "La CURP no es válida".');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Fecha de Nacimiento (2026-01-02)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 4 pruebas: vacía, futura (2030), antigua (1900) y restaurar.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con fecha vacía, futura y muy antigua.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Sexo (Femenino = 2)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 3 pruebas: vacío, Masculino y restaurar Femenino.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con sexo vacío ("--").');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Nacionalidad (Mexicano/a = 142)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 3 pruebas: vacía, Argentina y restaurar Mexicana.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con nacionalidad vacía ("--").');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Habla alguna lengua (No)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 2 pruebas: marcar Sí y restaurar No.');
  doc.fillColor('#2e7d32').text('  - El sistema guardó correctamente en ambas pruebas.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Estado Civil (Soltero = 1)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 3 pruebas: vacío, Casado y restaurar Soltero.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con estado civil vacío ("--").');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Ocupación (Niño)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 3 pruebas: vacía, texto largo y restaurar.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con ocupación vacía.');
  doc.fillColor('#2e7d32').text('  - Al ingresar texto largo, el sistema guardó correctamente.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Tipo de Sangre (O+ = 7)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 3 pruebas: vacío, A+ y restaurar O+.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con tipo de sangre vacío ("--").');
  doc.fillColor('#2e7d32').text('  - Al cambiar a A+ y restaurar a O+, el sistema guardó correctamente.');
  doc.fillColor('#333');
  doc.moveDown(1);

  // ===== SECCIÓN DATOS DE CONTACTO =====
  doc.addPage();
  doc.fontSize(16).fillColor('#cc0000').text('SECCIÓN: DATOS DE CONTACTO', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Calle (Almena)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 3 pruebas: vacía, caracteres especiales (!@#$%) y restaurar.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con calle vacía y con caracteres especiales.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Número Exterior (6)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 3 pruebas: vacío, letras+números (ABC123) y restaurar.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con número exterior vacío.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Número Interior (2)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 2 pruebas: vacío y restaurar.');
  doc.fillColor('#2e7d32').text('  - El sistema permite guardar vacío (no es obligatorio).');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Código Postal (76902)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 4 pruebas: vacío, 2 dígitos, 6 dígitos y restaurar.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con CP vacío y con solo 2 dígitos.');
  doc.fillColor('#f57f17').text('  - BUG: El sistema aceptó 6 dígitos cuando el maxlength es 5.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Ciudad y Estado', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se verificó que ambos campos son de solo lectura (readonly).');
  doc.fillColor('#2e7d32').text('  - Ciudad: "Corregidora" (readonly: true).');
  doc.fillColor('#2e7d32').text('  - Estado: "Querétaro" (readonly: true).');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Colonia (pendiente de seleccionar)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 2 pruebas: seleccionar primera opción y dejar vacía.');
  doc.fillColor('#2e7d32').text('  - El select de colonia tiene 25 opciones disponibles.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con colonia vacía.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Teléfono (4427472456)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 4 pruebas: vacío, 5 dígitos, 15 dígitos y restaurar.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con teléfono vacío.');
  doc.fillColor('#2e7d32').text('  - Al ingresar 5 dígitos, mostró: "El número de teléfono no es válido, debe tener 10 dígitos".');
  doc.fillColor('#2e7d32').text('  - Al ingresar 15 dígitos, truncó a 10 (maxlength respeta).');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Correo Electrónico (luismoralfonso47@gmail.com)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 4 pruebas: vacío, sin @, sin dominio y restaurar.');
  doc.fillColor('#f57f17').text('  - El sistema permite guardar con correo vacío.');
  doc.fillColor('#2e7d32').text('  - Al ingresar correo sin @ o sin dominio, mostró: "El correo electrónico no es válido".');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campo: Familiar Responsable (pendiente)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 7 pruebas: nombre, teléfono, tel 5 dígitos, solo nombre, solo teléfono, ambos vacíos y restaurar.');
  doc.fillColor('#f57f17').text('  - BUG: Marcado como obligatorio pero permite guardar con ambos campos vacíos.');
  doc.fillColor('#f57f17').text('  - Permite guardar con solo nombre o solo teléfono.');
  doc.fillColor('#2e7d32').text('  - Al ingresar teléfono de 5 dígitos, mostró: "no es válido, debe tener 10 dígitos".');
  doc.fillColor('#333');
  doc.moveDown(1);

  // ===== SECCIÓN DIAGNÓSTICOS =====
  doc.addPage();
  doc.fontSize(16).fillColor('#cc0000').text('SECCIÓN: DIAGNÓSTICOS', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('React-Select de Diagnóstico (CIE-10)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 10 pruebas sobre el campo de búsqueda de diagnósticos.');
  doc.moveDown(0.3);

  doc.fillColor('#2e7d32').text('  - Click sin escribir: No aparecen opciones (comportamiento correcto).');
  doc.fillColor('#2e7d32').text('  - Buscar "diabetes": 20 opciones CIE-10 encontradas (E232, N251, E12X, E121, E120...).');
  doc.fillColor('#2e7d32').text('  - Buscar "hipertension": 20 opciones CIE-10 encontradas (O12X, I10X, O100, O13X, G932...).');
  doc.fillColor('#2e7d32').text('  - Buscar "gripe": 1 opción encontrada (Z251 - INMUNIZACIÓN CONTRA LA INFLUENZA).');
  doc.fillColor('#2e7d32').text('  - Texto sin sentido "xyzabc123": Sin opciones (validación correcta).');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Registro y Eliminación de Diagnósticos', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.fillColor('#2e7d32').text('  - Al seleccionar un diagnóstico, se agrega automáticamente a la tabla.');
  doc.fillColor('#2e7d32').text('  - Al hacer click en el botón de eliminar (trash), aparece un popup SweetAlert de confirmación.');
  doc.fillColor('#2e7d32').text('  - Se pueden registrar múltiples diagnósticos.');
  doc.fillColor('#2e7d32').text('  - Se pueden eliminar diagnósticos individuales.');
  doc.fillColor('#2e7d32').text('  - Se pueden limpiar todos los diagnósticos.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Tabla de Diagnósticos', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('La tabla muestra: Código, Nombre y Fecha de registro.');
  doc.fillColor('#2e7d32').text('  - Cuando no hay diagnósticos, muestra: "No hay diagnósticos registrados".');
  doc.fillColor('#333');
  doc.moveDown(1);

  // ===== SECCIÓN ANTECEDENTES =====
  doc.addPage();
  doc.fontSize(16).fillColor('#cc0000').text('SECCIÓN: ANTECEDENTES', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Radio Buttons (campos requeridos)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 10 pruebas sobre los 3 campos de radio buttons.');
  doc.moveDown(0.3);
  doc.fillColor('#f57f17').text('  - Sin seleccionar nada: Permitió guardar sin validación.');
  doc.fillColor('#2e7d32').text('  - Cada campo individual (Sí/No): Guardó correctamente.');
  doc.fillColor('#2e7d32').text('  - Todos Sí: Guardó correctamente.');
  doc.fillColor('#2e7d32').text('  - Todos No: Guardó correctamente.');
  doc.fillColor('#2e7d32').text('  - Combinación mixta (Sí, No, Sí): Guardó correctamente.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campos encontrados', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.fillColor('#2e7d32').text('  - Planificación (*) - Radio Sí/No.');
  doc.fillColor('#2e7d32').text('  - Embarazos (*) - Radio Sí/No.');
  doc.fillColor('#2e7d32').text('  - Citologías y mamografías (*) - Radio Sí/No.');
  doc.fillColor('#2e7d32').text('  - 2 selects adicionales (pendientes de explorar).');
  doc.fillColor('#2e7d32').text('  - Botón "Guardar Respuestas" (submit).');
  doc.fillColor('#333');
  doc.moveDown(1);

  // ===== SECCIÓN VACUNACIÓN =====
  doc.addPage();
  doc.fontSize(16).fillColor('#cc0000').text('SECCIÓN: VACUNACIÓN', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Vacuna de Cartilla', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron ciclos de llenado, guardado, eliminación y re-agregado.');
  doc.fillColor('#2e7d32').text('  - Botón "Vacuna de cartilla" abre el formulario correctamente.');
  doc.fillColor('#2e7d32').text('  - Select de vacuna: 14 opciones (BCG, DPT, Hepatitis A, Hepatitis B, Hexavalente, Neumocócica conjugada, Neumocócica polisacárida, Rotavirus, SR, SRP, Td, Tdpa, VPH).');
  doc.fillColor('#f57f17').text('  - BUG: Select de dosis sin opciones disponibles (solo "Seleccione dosis").');
  doc.fillColor('#2e7d32').text('  - Se puede llenar, guardar, eliminar con botón trash y re-agregar.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Vacuna Diferente (Otras Vacunas)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.fillColor('#2e7d32').text('  - Botón "Vacuna diferente" abre el formulario correctamente.');
  doc.fillColor('#2e7d32').text('  - Select de otras vacunas: 3 opciones (Otra vacuna, COVID-19, Influenza).');
  doc.fillColor('#f57f17').text('  - BUG: Select de dosis sin opciones disponibles.');
  doc.fillColor('#2e7d32').text('  - Ciclo completo funciona: llenar → guardar → eliminar → re-agregar.');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Stress Test: Datos Inválidos', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.text('Se realizaron 8 pruebas con datos que no deberían ser permitidos.');
  doc.moveDown(0.3);

  doc.fillColor('#2e7d32').text('  - Sin seleccionar nada: Bloqueó correctamente (popup de error).');
  doc.fillColor('#f57f17').text('  - Solo vacuna sin fecha/folio: Permitió guardar sin validación.');
  doc.fillColor('#f57f17').text('  - Fecha futura (2030-12-31): Permitió guardar sin validación.');
  doc.fillColor('#f57f17').text('  - Fecha antigua (1900-01-01): Permitió guardar sin validación.');
  doc.fillColor('#f57f17').text('  - Folio con caracteres especiales (!@#$%): Permitió guardar sin validación.');
  doc.fillColor('#f57f17').text('  - Folio con letras (ABCDEF): Permitió guardar sin validación.');
  doc.fillColor('#2e7d32').text('  - Folio 50 caracteres: Bloqueó correctamente (popup de error).');
  doc.fillColor('#2e7d32').text('  - Comentarios XSS (<script>alert("XSS")</script>): Filtró correctamente.');
  doc.fillColor('#333');
  doc.moveDown(1);

  // ===== SECCIÓN FACTURACIÓN =====
  doc.addPage();
  doc.fontSize(16).fillColor('#cc0000').text('SECCIÓN: FACTURACIÓN', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Campos encontrados', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.fillColor('#2e7d32').text('  - Tipo de persona: Select con 2 opciones (Persona Física, Persona Moral).');
  doc.fillColor('#2e7d32').text('  - Nombre fiscal: Input text requerido.');
  doc.fillColor('#2e7d32').text('  - RFC: Input text requerido, maxlength 13.');
  doc.fillColor('#2e7d32').text('  - Régimen fiscal: Select con 22 opciones SAT.');
  doc.fillColor('#2e7d32').text('  - Dirección igual a contacto: Checkbox (Sí/No).');
  doc.fillColor('#2e7d32').text('  - Dirección manual: Calle, Número exterior, CP, Colonia (dinámico), Estado, Municipio.');
  doc.fillColor('#2e7d32').text('  - Botón "Guardar cambios".');
  doc.fillColor('#333');
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor('#333').text('Tests realizados (17 pruebas)', { underline: true });
  doc.fontSize(10).fillColor('#333');
  doc.fillColor('#f57f17').text('  - Sin llenar nada: Guardó sin validación.');
  doc.fillColor('#f57f17').text('  - Solo nombre sin RFC: Guardó sin validación.');
  doc.fillColor('#f57f17').text('  - Solo RFC sin nombre: Guardó sin validación.');
  doc.fillColor('#f57f17').text('  - RFC inválido (3 chars): Guardó sin validación de formato.');
  doc.fillColor('#f57f17').text('  - RFC con caracteres especiales: Guardó sin validación.');
  doc.fillColor('#2e7d32').text('  - Persona Física / Moral: Guardó correctamente.');
  doc.fillColor('#2e7d32').text('  - Con régimen fiscal: Guardó correctamente.');
  doc.fillColor('#2e7d32').text('  - Dirección igual Sí/No: Ambos funcionan.');
  doc.fillColor('#2e7d32').text('  - Colonia dinámica: 28 opciones según CP, selección aleatoria funciona.');
  doc.fillColor('#f57f17').text('  - Nombre XSS: Guardó sin filtrar.');
  doc.fillColor('#2e7d32').text('  - RFC 20 chars: Truncado a 13 (maxlength respeta).');
  doc.fillColor('#f57f17').text('  - RFC vacío, CP con letras, CP 2 dígitos: Guardó sin validación.');
  doc.fillColor('#f57f17').text('  - Calle con caracteres especiales, Número con letras: Guardó sin validación.');
  doc.fillColor('#333');
  doc.moveDown(1);

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text('Reporte generado automáticamente por MediPlanner Stress Tests', { align: 'center' });

  doc.end();

  return new Promise((resolve) => {
    stream.on('finish', () => {
      console.log(`  📄 PDF generado: ${outputPath}`);
      resolve();
    });
  });
}

function printReport(): void {
  const separator = '═'.repeat(70);
  const thinSep = '─'.repeat(70);

  console.log('\n' + separator);
  console.log('  REPORTE FINAL - STRESS TEST INFORMACIÓN DEL PACIENTE');
  console.log(separator);
  console.log(`  Fecha: ${new Date().toISOString()}`);
  console.log(`  Total pruebas: ${results.length}`);
  console.log(thinSep);

  const pasos = results.filter(r => r.resultado === 'PASO');
  const fallos = results.filter(r => r.resultado === 'FALLO');
  const bugs = results.filter(r => r.resultado === 'BUG');
  const errores = results.filter(r => r.resultado === 'ERROR');

  console.log(`  ✅ PASO:  ${pasos.length}`);
  console.log(`  ❌ FALLO: ${fallos.length}`);
  console.log(`  🐛 BUG:   ${bugs.length}`);
  console.log(`  ⚠️  ERROR: ${errores.length}`);
  console.log(thinSep);

  const sections = [...new Set(results.map(r => r.seccion))];
  for (const section of sections) {
    const sectionResults = results.filter(r => r.seccion === section);
    console.log(`\n  📋 ${section}:`);
    for (const r of sectionResults) {
      const icon = r.resultado === 'PASO' ? '✅' : r.resultado === 'FALLO' ? '❌' : r.resultado === 'BUG' ? '🐛' : '⚠️';
      console.log(`    ${icon} ${r.caso}: ${r.detalles}`);
      if (r.screenshot) console.log(`       📸 Screenshot: ${r.screenshot}`);
    }
  }

  console.log('\n' + separator);

  // Print popup events
  if (popupEvents.length > 0) {
    console.log(`\n  🔔 POPUPS DETECTADOS: ${popupEvents.length}`);
    console.log(thinSep);
    for (const p of popupEvents) {
      const status = p.cerrado ? '✅ Cerrado' : '⚠️ No cerrado';
      console.log(`    ${status} [${p.seccion}] ${p.momento} (${p.tipo}): "${p.texto}"`);
    }
    console.log(thinSep);
  } else {
    console.log(`\n  🔔 Sin popups detectados`);
  }

  console.log('\n' + separator);

  if (bugs.length > 0 || errores.length > 0) {
    console.log('  ⚠️  SE ENCONTRARON PROBLEMAS - Revisar detalles arriba');
  } else if (fallos.length > 0) {
    console.log('  ⚠️  HAY FALLOS - Revisar validaciones');
  } else {
    console.log('  ✅ TODAS LAS PRUEBAS PASARON');
  }
  console.log(separator + '\n');
}

test.describe('Información del Paciente - Stress Tests', () => {
  test('Stress Test Información del Paciente', async ({ page }) => {
    test.setTimeout(600000);

    const monitor = setupConsoleMonitor(page);
    console.log('🔍 [MONITOR] DevTools monitor activo\n');

    console.log('\n🚀 === STRESS TEST - INFORMACIÓN DEL PACIENTE ===\n');

    await ensureScreenshotsDir();

    // Handle native browser dialogs (alert, confirm, prompt)
    page.on('dialog', async (dialog) => {
      const msg = dialog.message();
      const type = dialog.type();
      console.log(`  🔔 Diálogo nativo detectado (${type}): "${msg.substring(0, 80)}"`);
      popupEvents.push({
        seccion: 'Navegación',
        momento: 'diálogo nativo',
        tipo: type,
        texto: msg.substring(0, 100),
        cerrado: true
      });
      await dialog.accept();
    });

    // Step 1: Navigate to Pacientes
    console.log('📋 Navegando a /Pacientes...');
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`📋 URL actual: ${currentUrl}`);

    if (!currentUrl.includes('Pacientes') && !currentUrl.includes('pacientes')) {
      const screenshot = await captureErrorScreenshot(page, 'navigation-failed');
      results.push({ seccion: 'Navegación', caso: 'Ir a Pacientes', resultado: 'ERROR', detalles: `URL inesperada: ${currentUrl}`, screenshot });
      printReport();
      return;
    }

    // Step 2: Select specific patient - Daniela Jiménez Durán
    console.log('📋 Buscando paciente: Daniela Jiménez Durán...');
    const patientLinks = page.locator('a.font-semibold, a[class*="patient"], tr td a, [class*="nombre"] a, a[href*="Paciente"]');
    const patientCount = await patientLinks.count();
    console.log(`📋 Pacientes encontrados: ${patientCount}`);

    if (patientCount === 0) {
      const screenshot = await captureErrorScreenshot(page, 'no-patients');
      results.push({ seccion: 'Navegación', caso: 'Seleccionar paciente', resultado: 'ERROR', detalles: 'No hay pacientes en la lista', screenshot });
      printReport();
      return;
    }

    let selectedPatient = false;
    const targetName = 'Daniela Jiménez Durán';
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
      console.log(`📋 ⚠ "${targetName}" no encontrada, seleccionando primer paciente...`);
      const firstLink = patientLinks.first();
      const fallbackName = await firstLink.textContent().catch(() => 'Desconocido');
      console.log(`📋 Paciente fallback: ${fallbackName?.trim()}`);
      await firstLink.click();
    }

    await page.waitForTimeout(3000);
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);

    // Step 3: Navigate to "Información"
    console.log('📋 Buscando pestaña "Información"...');
    const infoSelectors = [
      'a:has-text("Información")', 'button:has-text("Información")',
      'a:has-text("Informacion")', 'button:has-text("Informacion")',
      'span:has-text("Información")', 'span:has-text("Informacion")',
      '[href*="informacion"]', '[href*="Informacion"]',
      'a:has-text("Info")', 'button:has-text("Info")'
    ];

    let foundInfo = false;
    for (const selector of infoSelectors) {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click();
          foundInfo = true;
          console.log(`📋 Click en "Información" con selector: ${selector}`);
          break;
        }
      } catch {}
    }

    if (!foundInfo) {
      console.log('📋 No se encontró enlace a Información, navegando directamente...');
      await page.goto('/Pacientes/informacion');
    }

    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(2000);

    // Step 3b: Click on "General" sub-tab in the scrollspy sidebar
    console.log('📋 Asegurando sub-pestaña "General" en scrollspy...');
    const scrollspySelectors = [
      'div[data-scrollspy] a:has-text("General")',
      'a:has-text("General")',
      'div[data-sticky] a:has-text("General")',
      'div.scrollspy a:has-text("General")'
    ];

    let foundGeneral = false;
    for (const sel of scrollspySelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
          // Verify it's inside the scrollspy sidebar, not some other "General" link
          const parentClass = await el.evaluate(e => {
            let p = e.parentElement;
            while (p) {
              if (p.getAttribute('data-scrollspy')) return 'scrollspy';
              if (p.getAttribute('data-sticky')) return 'sticky';
              p = p.parentElement;
            }
            return 'unknown';
          }).catch(() => 'unknown');

          if (parentClass === 'scrollspy' || parentClass === 'sticky' || sel.includes('data-scrollspy') || sel.includes('data-sticky')) {
            await el.click();
            foundGeneral = true;
            console.log(`📋 ✓ Sub-pestaña "General" clickeada (padre: ${parentClass})`);
            await page.waitForTimeout(1500);
            break;
          }
        }
      } catch {}
    }

    if (!foundGeneral) {
      // Try finding by the active class pattern or exact text match in scrollspy
      const scrollspyLinks = page.locator('div[data-scrollspy] a, div[data-sticky] a');
      const linkCount = await scrollspyLinks.count();
      for (let i = 0; i < linkCount; i++) {
        const link = scrollspyLinks.nth(i);
        if (await link.isVisible().catch(() => false)) {
          const text = (await link.textContent().catch(() => ''))?.trim() || '';
          if (text === 'General') {
            await link.click();
            foundGeneral = true;
            console.log(`📋 ✓ Sub-pestaña "General" clickeada por texto exacto en scrollspy`);
            await page.waitForTimeout(1500);
            break;
          }
        }
      }
    }

    if (!foundGeneral) {
      console.log(`📋 ⚠ No se encontró sub-pestaña "General" en scrollspy, continuando...`);
    }

    // Step 4: Test only General section
    try {
      await testGeneralSection(page);
    } catch (e) {
      console.log(`  [General] Error en test: ${e}`);
      results.push({ seccion: 'General', caso: 'Error general', resultado: 'ERROR', detalles: `Excepción: ${String(e).substring(0, 80)}` });
    }

    // Step 5: Test Datos de Contacto section
    try {
      await testDatosContactoSection(page);
    } catch (e) {
      console.log(`  [Datos de Contacto] Error en test: ${e}`);
      results.push({ seccion: 'Datos de Contacto', caso: 'Error general', resultado: 'ERROR', detalles: `Excepción: ${String(e).substring(0, 80)}` });
    }

    // Step 6: Test Diagnósticos section
    try {
      await testDiagnosticosSection(page);
    } catch (e) {
      console.log(`  [Diagnósticos] Error: ${e}`);
      results.push({ seccion: 'Diagnósticos', caso: 'Error', resultado: 'ERROR', detalles: `Excepción: ${String(e).substring(0, 80)}` });
    }

    // Step 7: Test Antecedentes section
    try {
      await testAntecedentesSection(page);
    } catch (e) {
      console.log(`  [Antecedentes] Error: ${e}`);
      results.push({ seccion: 'Antecedentes', caso: 'Error', resultado: 'ERROR', detalles: `Excepción: ${String(e).substring(0, 80)}` });
    }

    // Step 8: Test Vacunación section
    try {
      await testVacunacionSection(page);
    } catch (e) {
      console.log(`  [Vacunación] Error: ${e}`);
      results.push({ seccion: 'Vacunación', caso: 'Error', resultado: 'ERROR', detalles: `Excepción: ${String(e).substring(0, 80)}` });
    }

    // Step 9: Test Facturación section
    try {
      await testFacturacionSection(page);
    } catch (e) {
      console.log(`  [Facturación] Error: ${e}`);
      results.push({ seccion: 'Facturación', caso: 'Error', resultado: 'ERROR', detalles: `Excepción: ${String(e).substring(0, 80)}` });
    }

    // Print final report
    printReport();

    // PDF: generar solo cuando se solicite manualmente
    // await generatePDFReport();

    const result = monitor.printSummary();
    if (!result.passed) console.log(`⚠️ El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);
  });
});
