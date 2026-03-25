import { test, expect, Page, Locator } from '@playwright/test';

interface ValidationResult {
  campo: string;
  tipoPrueba: string;
  valorInvalido: string;
  permitioEscritura: boolean;
  nota: string;
}

interface SectionReport {
  seccion: string;
  resultados: ValidationResult[];
}

const globalValidationReports: SectionReport[] = [];

async function testTextInputValidation(
  page: Page,
  sectionName: string,
  selector: string,
  testName: string
): Promise<ValidationResult[]> {
  const resultados: ValidationResult[] = [];
  const field = page.locator(selector);
  
  if (await field.count() === 0) {
    console.log(`  ⚠️ ${testName}: Campo no encontrado`);
    return resultados;
  }
  
  const input = field.first();
  if (!(await input.isVisible().catch(() => false))) {
    console.log(`  ⚠️ ${testName}: Campo no visible`);
    return resultados;
  }

  const invalidInputs = {
    'XSS Script': '<script>alert("xss")</script>',
    'SQL Injection': "' OR '1'='1",
    'Template': '{{alert(1)}}',
    'Caracteres Esp': '!@#$%',
    'Solo Espacios': '   ',
  };

  for (const [tipoPrueba, valorInvalido] of Object.entries(invalidInputs)) {
    try {
      await input.click();
      await page.keyboard.press('Control+A');
      await page.waitForTimeout(50);
      
      const delay = valorInvalido.length > 100 ? 1 : 5;
      await page.keyboard.type(valorInvalido, { delay });
      await page.waitForTimeout(200);
      
      const actualValue = await input.inputValue();
      const permitio = actualValue.length > 0;
      
      const valorMostrar = valorInvalido.length > 25 ? valorInvalido.substring(0, 25) + '...' : valorInvalido;
      console.log(`    ${tipoPrueba}: "${valorMostrar}" | ${permitio ? 'ACEPTÓ ⚠️' : 'BLOQUEÓ ✅'}`);
      
      resultados.push({
        campo: testName,
        tipoPrueba,
        valorInvalido,
        permitioEscritura: permitio,
        nota: permitio ? `⚠️ Aceptó ${tipoPrueba}` : `✅ Bloqueó ${tipoPrueba}`
      });
    } catch (e) {
      console.log(`    ⚠️ Error en ${tipoPrueba}`);
    }
    await page.waitForTimeout(100);
  }
  
  return resultados;
}

async function testNumberInputValidation(
  page: Page,
  sectionName: string,
  selector: string,
  testName: string
): Promise<ValidationResult[]> {
  const resultados: ValidationResult[] = [];
  const field = page.locator(selector);
  
  if (await field.count() === 0) {
    console.log(`  ⚠️ ${testName}: Campo no encontrado`);
    return resultados;
  }
  
  const input = field.first();
  if (!(await input.isVisible().catch(() => false))) {
    console.log(`  ⚠️ ${testName}: Campo no visible`);
    return resultados;
  }

  const invalidInputs = {
    'Letras': 'abc123',
    'Negativo': '-50',
    'Cero': '0',
    'Extremo': '999',
    'Simbolos': '!@#$%',
  };

  for (const [tipoPrueba, valorInvalido] of Object.entries(invalidInputs)) {
    try {
      await input.click({ clickCount: 3 });
      await input.press('Backspace');
      await page.waitForTimeout(50);
      
      await input.type(valorInvalido, { delay: 25 });
      await page.waitForTimeout(200);
      
      const actualValue = await input.inputValue();
      const permitio = actualValue.length > 0;
      
      const valorMostrar = valorInvalido.length > 20 ? valorInvalido.substring(0, 20) + '...' : valorInvalido;
      console.log(`    ${tipoPrueba}: "${valorMostrar}" -> "${actualValue}" | ${permitio ? 'ACEPTÓ ⚠️' : 'BLOQUEÓ ✅'}`);
      
      resultados.push({
        campo: testName,
        tipoPrueba,
        valorInvalido,
        permitioEscritura: permitio,
        nota: permitio ? `⚠️ Aceptó ${tipoPrueba}` : `✅ Bloqueó ${tipoPrueba}`
      });
    } catch (e) {
      console.log(`    ⚠️ Error en ${tipoPrueba}`);
    }
    await page.waitForTimeout(100);
  }
  
  return resultados;
}

async function runSectionValidation(
  page: Page,
  sectionName: string,
  fields: { selector: string; name: string; type: 'text' | 'number' }[]
): Promise<void> {
  console.log(`\n🧪 === VALIDACIÓN DE ${sectionName.toUpperCase()} ===`);
  
  const sectionReport: SectionReport = {
    seccion: sectionName,
    resultados: []
  };
  
  for (const field of fields) {
    console.log(`\n📋 Probando: ${field.name}`);
    
    if (field.type === 'number') {
      const results = await testNumberInputValidation(page, sectionName, field.selector, field.name);
      sectionReport.resultados.push(...results);
    } else {
      const results = await testTextInputValidation(page, sectionName, field.selector, field.name);
      sectionReport.resultados.push(...results);
    }
    
    await page.waitForTimeout(300);
  }
  
  const vulnerable = sectionReport.resultados.filter(r => r.permitioEscritura).length;
  const secured = sectionReport.resultados.filter(r => !r.permitioEscritura).length;
  
  console.log(`\n📊 ${sectionName}: ${secured} bloquados ✅ | ${vulnerable} aceptados ❌`);
  
  globalValidationReports.push(sectionReport);
}

function printGlobalValidationReport(): void {
  console.log('\n');
  console.log('═'.repeat(100));
  console.log('📊 REPORTE GLOBAL DE VALIDACIÓN - CONFIGURACIÓN');
  console.log('═'.repeat(100));
  
  let totalVulnerable = 0;
  let totalProtected = 0;
  
  for (const report of globalValidationReports) {
    const vulnerable = report.resultados.filter(r => r.permitioEscritura).length;
    const secured = report.resultados.filter(r => !r.permitioEscritura).length;
    totalVulnerable += vulnerable;
    totalProtected += secured;
    
    console.log(`\n🔹 ${report.seccion}:`);
    console.log(`   ✅ Protegidos: ${secured} | ❌ Vulnerables: ${vulnerable}`);
    
    if (vulnerable > 0) {
      const tiposVulnerables = [...new Set(report.resultados.filter(r => r.permitioEscritura).map(r => r.tipoPrueba))];
      console.log(`   ⚠️ Tipos de ataque aceptados: ${tiposVulnerables.join(', ')}`);
    }
  }
  
  console.log('\n' + '═'.repeat(100));
  console.log(`📈 TOTAL: ${totalProtected} protecciones ✅ | ${totalVulnerable} vulnerabilidades ❌`);
  console.log('═'.repeat(100));
}

test('Stress Test - Configuración', async ({ page }) => {
  test.setTimeout(600000);
  
  console.log('🧪 === STRESS TEST CONFIGURACIÓN ===\n');
  
  await page.goto('/Dashboard');
  await page.waitForTimeout(3000);
  
  await page.goto('/Configuracion');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('📋 Navegando a Configuración...');
  
  await runSectionValidation(page, 'Datos del Médico', [
    { selector: 'input[name*="nombre" i]', name: 'Nombre', type: 'text' },
    { selector: 'input[name*="apellido" i]', name: 'Apellido', type: 'text' },
    { selector: 'input[name*="cedula" i]', name: 'Cédula', type: 'text' },
    { selector: 'input[name*="especialidad" i]', name: 'Especialidad', type: 'text' },
    { selector: 'input[name*="rfc" i]', name: 'RFC', type: 'text' },
  ]);
  
  await runSectionValidation(page, 'Contacto', [
    { selector: 'input[name*="telefono" i]', name: 'Teléfono', type: 'text' },
    { selector: 'input[name*="email" i]', name: 'Email', type: 'text' },
    { selector: 'input[name*="direccion" i]', name: 'Dirección', type: 'text' },
  ]);
  
  await runSectionValidation(page, 'Horarios', [
    { selector: 'input[name*="hora_inicio" i]', name: 'Hora Inicio', type: 'text' },
    { selector: 'input[name*="hora_fin" i]', name: 'Hora Fin', type: 'text' },
    { selector: 'input[name*="duracion" i]', name: 'Duración Cita', type: 'number' },
  ]);
  
  printGlobalValidationReport();
  
  console.log('\n✅ Stress Test de Configuración completado');
});
