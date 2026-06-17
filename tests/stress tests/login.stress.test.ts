import { test, expect, Page, Locator } from '@playwright/test';
const { setupConsoleMonitor } = require('../../e2e/utils.js');

interface ValidationResult {
  campo: string;
  tipoPrueba: string;
  valorInvalido: string;
  errorMostrado: string;
  accesoConcedido: boolean;
  esVulnerable: boolean;
  nota: string;
}

interface SectionReport {
  seccion: string;
  resultados: ValidationResult[];
}

const globalValidationReports: SectionReport[] = [];

async function getErrorType(page: Page): Promise<{ tipo: string; mensaje: string }> {
  const errorSelectors = [
    '.text-red',
    '.text-danger', 
    '.error',
    '[class*="error"]',
    '.alert',
    '[role="alert"]',
    'span:has-text("incorrecto")',
    'span:has-text("inválid")',
    'span:has-text("Error")',
    'text:has-text("verifica")',
    'text:has-text("incorrecto")',
    'text:has-text("El usuario")',
    'text:has-text("Debes")',
    'text:has-text("requerido")',
    'text:has-text("obligatorio")',
    'div:has-text("Error")',
    'p:has-text("Error")'
  ];
  
  for (const selector of errorSelectors) {
    const errorEl = page.locator(selector).first();
    if (await errorEl.isVisible().catch(() => false)) {
      const text = await errorEl.textContent().catch(() => '');
      if (text && text.trim().length > 0) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('debes') || lowerText.includes('requerido') || lowerText.includes('obligatorio') || lowerText.includes('vacío')) {
          return { tipo: 'VALIDACION_CAMPO', mensaje: text };
        }
        
        if (lowerText.includes('email') || lowerText.includes('formato') || lowerText.includes('válido')) {
          return { tipo: 'VALIDACION_EMAIL', mensaje: text };
        }
        
        if (lowerText.includes('usuario') || lowerText.includes('contraseña') || lowerText.includes('incorrecto') || lowerText.includes('inválid')) {
          return { tipo: 'CREDENCIALES', mensaje: text };
        }
        
        return { tipo: 'GENERICO', mensaje: text };
      }
    }
  }
  
  return { tipo: 'NINGUNO', mensaje: '' };
}

async function testLoginFieldValidation(
  page: Page,
  sectionName: string,
  emailSelector: string,
  passwordSelector: string,
  testName: string
): Promise<ValidationResult[]> {
  const resultados: ValidationResult[] = [];
  
  const emailField = page.locator(emailSelector).first();
  const passwordField = page.locator(passwordSelector).first();
  const submitBtn = page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Login"), button:has-text("iniciar sesión"), [role="button"]:has-text("Iniciar")').first();
  
  const validEmail = 'dr.walterwhite.mediplanner@gmail.com';
  const validPass = 'Pil8drof.';
  
  const testCases = [
    { 
      tipo: 'Solo Email (sin Pass)', 
      email: 'test@test.com', 
      pass: '',
      soloEmail: true,
      soloPass: false
    },
    { 
      tipo: 'Solo Pass (sin Email)', 
      email: '', 
      pass: 'password123',
      soloEmail: false,
      soloPass: true
    },
    { 
      tipo: 'Campos Vacíos', 
      email: '', 
      pass: '',
      soloEmail: false,
      soloPass: false
    },
    { 
      tipo: 'Email Válido + Pass Inválida', 
      email: validEmail, 
      pass: 'password_invalida',
      soloEmail: false,
      soloPass: false
    },
    { 
      tipo: 'Email Inválido + Pass Válida', 
      email: 'test@invalido.com', 
      pass: validPass,
      soloEmail: false,
      soloPass: false
    },
    { 
      tipo: 'Credenciales Correctas', 
      email: validEmail, 
      pass: validPass,
      soloEmail: false,
      soloPass: false,
      esCorrecto: true
    },
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n  🔍 Probando: ${testCase.tipo}`);
      
      await page.goto('/login');
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(1000);
      
      const currentEmailField = page.locator(emailSelector).first();
      const currentPassField = page.locator(passwordSelector).first();
      
      if (testCase.email) {
        await currentEmailField.click();
        await page.keyboard.press('Control+A');
        await page.waitForTimeout(50);
        await page.keyboard.type(testCase.email, { delay: 5 });
        await page.waitForTimeout(100);
      }
      
      if (testCase.pass) {
        await currentPassField.click();
        await page.keyboard.press('Control+A');
        await page.waitForTimeout(50);
        await page.keyboard.type(testCase.pass, { delay: 5 });
        await page.waitForTimeout(100);
      }
      
      await page.waitForTimeout(300);
      
      const currentSubmitBtn = page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar")').first();
      
      let clickeado = false;
      if (await currentSubmitBtn.isVisible().catch(() => false)) {
        await currentSubmitBtn.click();
        clickeado = true;
        
        if (testCase.esCorrecto) {
          console.log(`    ⏳ Esperando inicio de sesión...`);
          try {
            await page.waitForURL(/Dashboard|dashboard|inicio|home/i, { timeout: 10000 });
            console.log(`    ✅ Redirección detectada, esperando carga completa...`);
            await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
            await page.waitForTimeout(2000);
          } catch (e) {
            console.log(`    ⏳ Timeout de redirección, verificando URL actual...`);
          }
        } else {
          await page.waitForTimeout(2000);
        }
      }
      
      const urlActual = page.url();
      const estaEnDashboard = urlActual.includes('Dashboard') || urlActual.includes('dashboard') || urlActual.includes('inicio') || urlActual.includes('home') || !urlActual.includes('login');
      
      let accesoConcedido = false;
      let errorInfo = { tipo: 'NINGUNO', mensaje: '' };
      
      if (estaEnDashboard && clickeado) {
        accesoConcedido = true;
        console.log(`    ✅ ACCESO CONCEDIDO al Dashboard!`);
      } else {
        errorInfo = await getErrorType(page);
        console.log(`    📝 Error tipo: "${errorInfo.tipo}" - "${errorInfo.mensaje.substring(0, 40)}..."`);
      }
      
      let esVulnerable = false;
      let nota = '';
      
      if (testCase.esCorrecto && accesoConcedido) {
        nota = '✅ Login exitoso con credenciales correctas';
        console.log(`    ✅ Acceso correcto verificado`);
      } else if (testCase.esCorrecto && !accesoConcedido) {
        nota = '❌ Credenciales correctas pero no hubo acceso';
        console.log(`    ❌ Credenciales correctas fallaron`);
      } else if (accesoConcedido) {
        esVulnerable = true;
        nota = '⚠️ VULNERABLE: Acceso concedido sin credenciales válidas';
        console.log(`    ❌ VULNERABLE: Acceso concedido sin credenciales correctas!`);
      } else {
        if (errorInfo.tipo.includes('VALIDACION')) {
          nota = '✅ Validación de campo correcta';
        } else {
          nota = '⚠️ Error de credenciales (pero validó el input)';
        }
      }
      
      console.log(`    📊 Vulnerable: ${esVulnerable ? 'SÍ ❌' : 'NO ✅'} | Acceso: ${accesoConcedido ? 'SÍ' : 'NO'}`);
      
      resultados.push({
        campo: testName,
        tipoPrueba: testCase.tipo,
        valorInvalido: `Email: ${testCase.email.substring(0, 20)}... / Pass: ${testCase.pass.substring(0, 10)}...`,
        errorMostrado: errorInfo.tipo,
        accesoConcedido,
        esVulnerable,
        nota
      });
      
    } catch (e) {
      console.log(`    ⚠️ Error en ${testCase.tipo}: ${e}`);
    }
    await page.waitForTimeout(500);
  }
  
  return resultados;
}

async function runSectionValidation(
  page: Page,
  sectionName: string,
  fields: { selectorEmail: string; selectorPass: string; name: string }[]
): Promise<void> {
  console.log(`\n🧪 === VALIDACIÓN DE ${sectionName.toUpperCase()} ===`);
  
  const sectionReport: SectionReport = {
    seccion: sectionName,
    resultados: []
  };
  
  for (const field of fields) {
    console.log(`\n📋 Probando: ${field.name}`);
    
    const results = await testLoginFieldValidation(
      page, 
      sectionName, 
      field.selectorEmail, 
      field.selectorPass,
      field.name
    );
    sectionReport.resultados.push(...results);
    
    await page.waitForTimeout(500);
  }
  
  const vulnerables = sectionReport.resultados.filter(r => r.esVulnerable).length;
  const protegidos = sectionReport.resultados.filter(r => !r.esVulnerable).length;
  const accesosIncorrectos = sectionReport.resultados.filter(r => r.accesoConcedido && !sectionReport.resultados.find(x => x.tipoPrueba === 'Credenciales Correctas')?.accesoConcedido).length;
  
  console.log(`\n📊 ${sectionName}: ${protegidos} protegidos ✅ | ${vulnerables} vulnerables ❌`);
  
  globalValidationReports.push(sectionReport);
}

function printGlobalValidationReport(): void {
  console.log('\n');
  console.log('═'.repeat(100));
  console.log('📊 REPORTE GLOBAL DE VALIDACIÓN - LOGIN');
  console.log('═'.repeat(100));
  
  let totalVulnerable = 0;
  let totalProtected = 0;
  
  for (const report of globalValidationReports) {
    const vulnerables = report.resultados.filter(r => r.esVulnerable).length;
    const protegidos = report.resultados.filter(r => !r.esVulnerable).length;
    totalVulnerable += vulnerables;
    totalProtected += protegidos;
    
    console.log(`\n🔹 ${report.seccion}:`);
    console.log(`   ✅ Protegidos: ${protegidos} | ❌ Vulnerables: ${vulnerables}`);
    
    console.log('\n   📋 Detalle de pruebas:');
    for (const r of report.resultados) {
      const estado = r.esVulnerable ? '❌ VULNERABLE' : '✅ PROTEGIDO';
      console.log(`      ${estado} - ${r.tipoPrueba}: ${r.nota}`);
    }
  }
  
  console.log('\n' + '═'.repeat(100));
  console.log(`📈 TOTAL: ${totalProtected} protecciones ✅ | ${totalVulnerable} vulnerabilidades ❌`);
  console.log('═'.repeat(100));
}

test('Stress Test - Login', async ({ page }) => {
  test.setTimeout(300000);
  const monitor = setupConsoleMonitor(page);
  console.log('🔍 [MONITOR] DevTools monitor activo\n');

  console.log('🧪 === STRESS TEST LOGIN ===\n');
  console.log('Este test verifica la seguridad del formulario de login\n');
  
  await page.goto('/login');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(2000);
  
  console.log('📋 Navegando a Login...');
  
  await runSectionValidation(page, 'Formulario Login', [
    { 
      selectorEmail: 'input[name="email"], input[type="email"], input[placeholder*="email" i]', 
      selectorPass: 'input[name="password"], input[type="password"], input[placeholder*="password" i]', 
      name: 'Credenciales de Login' 
    },
  ]);
  
  printGlobalValidationReport();
  
  console.log('\n✅ Stress Test de Login completado');

  const result = monitor.printSummary();
  if (!result.passed) console.log(`⚠️ El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);
});
