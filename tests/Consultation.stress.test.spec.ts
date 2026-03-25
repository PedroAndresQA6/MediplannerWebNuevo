import { test, expect, Page, Locator } from '@playwright/test';
const { createAppointment: createAppointmentExternal } = require('../e2e/utils.js');

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
      console.log(`    📝 Input: "${valorMostrar}" - Escribió: ${permitio ? 'SÍ ⚠️' : 'NO ✅'}`);
      
      if (permitio) {
        console.log(`    💾 Intentando guardar cambios...`);
        
        const guardarBtn = page.locator('button:has-text("Guardar cambios"), button:has-text("Guardar"), button:has-text("Guardar y continuar")').first();
        
        if (await guardarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await guardarBtn.click();
          await page.waitForTimeout(2000);
          
          const errorModal = page.locator('.swal2-popup:visible, [role="alert"]:visible, .alert:visible');
          const errorText = page.locator('text=/error|inválido|incorrecto|caracter|especial|sql|xss|script/i');
          const successToast = page.locator('text=/éxito|guardado|actualizado|correcto/i');
          
          const errorVisible = await errorModal.first().isVisible().catch(() => false);
          const errorTextVisible = await errorText.first().isVisible().catch(() => false);
          const successVisible = await successToast.first().isVisible().catch(() => false);
          
          if (errorVisible || errorTextVisible) {
            console.log(`    💾 Resultado: ✅ RECHAZADO al guardar - Validación funciona`);
            
            const okBtn = page.locator('button:has-text("OK"), button:has-text("Aceptar"), .swal2-confirm');
            if (await okBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
              await okBtn.first().click();
              await page.waitForTimeout(500);
            }
          } else if (successVisible) {
            console.log(`    💾 Resultado: ❌ ACEPTADO Y GUARDADO - VULNERABLE!`);
          } else {
            console.log(`    💾 Resultado: ⚠️ Sin respuesta clara (revisar manualmente)`);
          }
        } else {
          console.log(`    💾 Botón guardar no encontrado`);
        }
      }
      
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

async function testRSWEditorValidation(
  page: Page,
  sectionName: string,
  editorIndex: number,
  editorName: string
): Promise<ValidationResult[]> {
  const resultados: ValidationResult[] = [];
  
  const rswEditors = page.locator('div.rsw-editor');
  if ((await rswEditors.count()) <= editorIndex) {
    console.log(`  ⚠️ RSW Editor #${editorIndex + 1} no encontrado`);
    return resultados;
  }
  
  const editor = rswEditors.nth(editorIndex);
  if (!(await editor.isVisible().catch(() => false))) {
    console.log(`  ⚠️ RSW Editor #${editorIndex + 1} no visible`);
    return resultados;
  }
  
  const contentEditable = editor.locator('[contenteditable="true"]').first();
  if (!(await contentEditable.isVisible().catch(() => false))) {
    console.log(`  ⚠️ ContentEditable del editor no visible`);
    return resultados;
  }
  
  const rswInvalidInputs = {
    'RSW XSS': '<script>alert("xss")</script>',
    'RSW SQL': "' OR '1'='1",
  };
  
  for (const [tipoPrueba, valorInvalido] of Object.entries(rswInvalidInputs)) {
    try {
      await contentEditable.click();
      await page.keyboard.press('Control+A');
      await page.waitForTimeout(100);
      
      const delay = valorInvalido.length > 500 ? 1 : 10;
      await page.keyboard.type(valorInvalido, { delay });
      await page.waitForTimeout(400);
      
      const actualValue = await contentEditable.textContent();
      const permitio = (actualValue?.length || 0) > 0;
      
      const valorMostrar = valorInvalido.length > 25 ? valorInvalido.substring(0, 25) + '...' : valorInvalido;
      console.log(`    📝 Input: "${valorMostrar}" - Escribió: ${permitio ? 'SÍ ⚠️' : 'NO ✅'}`);
      
      if (permitio) {
        console.log(`    💾 Intentando guardar cambios...`);
        
        const guardarBtn = page.locator('button:has-text("Guardar cambios"), button:has-text("Guardar"), button:has-text("Guardar y continuar")').first();
        
        if (await guardarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await guardarBtn.click();
          await page.waitForTimeout(2000);
          
          const errorModal = page.locator('.swal2-popup:visible, [role="alert"]:visible, .alert:visible');
          const errorText = page.locator('text=/error|inválido|incorrecto|caracter|especial|sql|xss|script/i');
          const successToast = page.locator('text=/éxito|guardado|actualizado|correcto/i');
          
          const errorVisible = await errorModal.first().isVisible().catch(() => false);
          const errorTextVisible = await errorText.first().isVisible().catch(() => false);
          const successVisible = await successToast.first().isVisible().catch(() => false);
          
          if (errorVisible || errorTextVisible) {
            console.log(`    💾 Resultado: ✅ RECHAZADO al guardar - Validación funciona`);
            
            const okBtn = page.locator('button:has-text("OK"), button:has-text("Aceptar"), .swal2-confirm');
            if (await okBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
              await okBtn.first().click();
              await page.waitForTimeout(500);
            }
          } else if (successVisible) {
            console.log(`    💾 Resultado: ❌ ACEPTADO Y GUARDADO - VULNERABLE!`);
          } else {
            console.log(`    💾 Resultado: ⚠️ Sin respuesta clara`);
          }
        }
      }
      
      resultados.push({
        campo: `RSW Editor #${editorIndex + 1}`,
        tipoPrueba,
        valorInvalido,
        permitioEscritura: permitio,
        nota: permitio ? `⚠️ Aceptó ${tipoPrueba}` : `✅ Bloqueó ${tipoPrueba}`
      });
    } catch (e) {
      console.log(`    ⚠️ Error en ${tipoPrueba}: ${e}`);
    }
    await page.waitForTimeout(200);
  }
  
  return resultados;
}

async function runSectionValidation(
  page: Page,
  sectionName: string,
  fields: { selector: string; name: string; type: 'input' | 'textarea' | 'rsw' }[]
): Promise<void> {
  console.log(`\n🧪 === VALIDACIÓN DE ${sectionName.toUpperCase()} ===`);
  
  const sectionReport: SectionReport = {
    seccion: sectionName,
    resultados: []
  };
  
  for (const field of fields) {
    console.log(`\n📋 Probando: ${field.name}`);
    
    if (field.type === 'rsw') {
      const rswResults = await testRSWEditorValidation(page, sectionName, field.selector as unknown as number, field.name);
      sectionReport.resultados.push(...rswResults);
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
  console.log('📊 REPORTE GLOBAL DE VALIDACIÓN DE TEXTOS');
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

async function fillSpecificField(page: Page, fieldName: string): Promise<void> {
  console.log(`🔍 Buscando campo específico: ${fieldName}`);
  
  const fieldSelectors = [
    `label:has-text("${fieldName}") + input, label:has-text("${fieldName}") + textarea, label:has-text("${fieldName}") + select`,
    `label:has-text("${fieldName}") ~ input, label:has-text("${fieldName}") ~ textarea, label:has-text("${fieldName}") ~ select`,
    `input[placeholder*="${fieldName}" i], textarea[placeholder*="${fieldName}" i], select[placeholder*="${fieldName}" i]`,
    `input[aria-label*="${fieldName}" i], textarea[aria-label*="${fieldName}" i], select[aria-label*="${fieldName}" i]`,
    `input[name*="${fieldName}" i], textarea[name*="${fieldName}" i], select[name*="${fieldName}" i]`,
    `input[id*="${fieldName}" i], textarea[id*="${fieldName}" i], select[id*="${fieldName}" i]`,
    `*:has-text("${fieldName}") >> input, *:has-text("${fieldName}") >> textarea, *:has-text("${fieldName}") >> select`
  ];
  
  let fieldFound = false;
  
  for (const selector of fieldSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();
      
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const element = elements.nth(i);
          if (await element.isVisible() && await element.isEnabled()) {
            const tagName = await element.evaluate((el) => el.tagName.toLowerCase());
            
            try {
              if (tagName === 'input' || tagName === 'textarea') {
                const currentValue = await element.inputValue();
                if (!currentValue || currentValue.trim() === '') {
                  let fillValue = '';
                  const fieldLower = fieldName.toLowerCase();
                  
                  if (fieldLower.includes('hospital')) {
                    fillValue = 'Hospital General';
                  } else if (fieldLower.includes('tipo') && fieldLower.includes('consulta')) {
                    fillValue = 'Consulta General';
                  } else if (fieldLower.includes('motivo')) {
                    fillValue = 'Paciente acude a consulta por cefalea persistente de 3 días de evolución.';
                  } else if (fieldLower.includes('padecimiento')) {
                    fillValue = 'Inicia padecimiento actual hace 3 días con cefalea frontal de tipo opresiva.';
                  } else if (fieldLower.includes('nota') || fieldLower.includes('evolucion') || fieldLower.includes('evolu')) {
                    fillValue = 'Evolución favorable sin complicaciones';
                  } else if (fieldLower.includes('referido')) {
                    fillValue = 'Pedro Quijada';
                  } else {
                    fillValue = 'Información proporcionada';
                  }
                  
                  await element.fill(fillValue);
                  console.log(`✅ Campo "${fieldName}" llenado con: "${fillValue}"`);
                  fieldFound = true;
                  break;
                }
              } else if (tagName === 'select') {
                const options = await element.locator('option').count();
                if (options > 1) {
                  const currentValue = await element.inputValue();
                  if (!currentValue || currentValue === '' || currentValue.includes('Seleccione')) {
                    await element.selectOption({ index: 1 });
                    console.log(`✅ Campo "${fieldName}" seleccionado opción index: 1`);
                    fieldFound = true;
                    break;
                  }
                }
              }
            } catch (fillError) {
              console.log(`⚠️ Error al llenar campo ${fieldName}: ${fillError.message}`);
              continue;
            }
          }
        }
      }
      
      if (fieldFound) break;
    } catch (selectorError) {
      continue;
    }
  }
  
  if (!fieldFound) {
    console.log(`⚠️ No se pudo encontrar o llenar el campo específico: ${fieldName}`);
  }
}

async function waitForFinalizarButton(page: Page): Promise<Locator | null> {
  console.log('🏁 Esperando botón de finalizar consulta...');
  
  const finalizarSelectors = [
    page.getByRole('button', { name: /finalizar consulta/i }),
    page.getByRole('button', { name: /finalizar$/i }),
    page.getByRole('button', { name: /terminar consulta/i }),
    page.locator('button:has-text("Finalizar")'),
    page.locator('button:has-text("Finalizar Consulta")'),
    page.locator('button:has-text("Finalizar consulta")'),
    page.locator('button[data-modal-toggle="#modal1"]'),
    page.locator('button[class*="finalizar"]'),
    page.locator('button[class*="finish"]')
  ];
  
  for (let intento = 0; intento < 6; intento++) {
    for (const selector of finalizarSelectors) {
      try {
        if (await selector.count() > 0) {
          const btn = selector.first();
          if (await btn.isVisible() && await btn.isEnabled()) {
            console.log('✅ Botón de finalizar encontrado y habilitado');
            return btn;
          }
        }
      } catch (e) {
        // Continuar intentando
      }
    }
    
    if (intento < 5) {
      console.log(`⏳ Intento ${intento + 1}/6: Esperando 1 segundo...`);
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');
    }
  }
  
  console.log('⚠️ Botón de finalizar no encontrado después de 30 segundos');
  return null;
}

async function handleModals(page: Page): Promise<void> {
  const modalSelectors = [
    '.swal2-container:visible',
    '[role="dialog"]:visible',
    '.modal:visible'
  ];
  
  for (const selector of modalSelectors) {
    const modal = page.locator(selector);
    if (await modal.count() > 0 && await modal.first().isVisible()) {
      const closeBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), button:has-text("Cerrar"), .swal2-confirm, .swal2-close');
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }
  }
}

async function fillExplorationSection(page: Page): Promise<void> {
  console.log('🔍 Iniciando llenado de la sección de Exploración...');
   
  try {
    await page.waitForTimeout(2000);
    
    const observaciones = [
      'Sin signos de alarma',
      'Exploración normal',
      'Dentro de límites normales',
      'Sin alteraciones en la exploración',
      'Sin datos de enfermedad actual',
      'Paciente sin síntomas de alarma',
      'Exploración sin hallazgos significativos',
      'Revisión por sistemas sin particularidades',
    ];
    
    console.log('📝 Llenando textareas generales de Exploración...');
    const textAreas = page.locator('textarea:not([disabled]):not([readonly])');
    const taCount = await textAreas.count();
    console.log(`📝 Encontradas ${taCount} textareas en Exploración`);
    
    for (let i = 0; i < taCount; i++) {
      const textarea = textAreas.nth(i);
      if (await textarea.isVisible() && await textarea.isEnabled()) {
        const currentValue = await textarea.inputValue();
        if (!currentValue || currentValue.trim() === '') {
          const placeholder = await textarea.getAttribute('placeholder') || '';
          let fillText = 'Exploración física realizada. Paciente en buen estado general.';
          
          if (placeholder.toLowerCase().includes('apariencia')) {
            fillText = 'Apariencia general: Paciente bien nutrido, hidratado, consciente, orientado.';
          } else if (placeholder.toLowerCase().includes('observacion')) {
            fillText = 'Observaciones: Sin hallazgos significativos durante la exploración.';
          }
          
          await textarea.fill(fillText);
          console.log(`✅ Textarea ${i+1} llenado`);
        }
      }
    }
    
    console.log('☑️ Iniciando procesamiento de checkboxes...');
    const allCheckboxes = page.locator('input[type="checkbox"]:not([disabled])');
    const totalCheckboxes = await allCheckboxes.count();
    console.log(`☑️ Encontrados ${totalCheckboxes} checkboxes en Exploración`);
    
    let processedCheckboxes = 0;
    
    for (let i = 0; i < totalCheckboxes; i++) {
      const checkbox = allCheckboxes.nth(i);
      
      try {
        const isVisible = await checkbox.isVisible({ timeout: 500 });
        if (!isVisible) continue;
      } catch (e) {
        continue;
      }
      
      console.log(`\n📦 Procesando checkbox ${i+1}`);
      
      await checkbox.click({ force: true });
      console.log(`   ✅ Checkbox marcado`);
      
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');
      
      const normalButtons = page.locator('button:has-text("Normal"), button:has-text("Anormal")');
      const normalBtnCount = await normalButtons.count();
      
      if (normalBtnCount > 0) {
        const normalBtn = page.locator('button:has-text("Normal")').first();
        if (await normalBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await normalBtn.click();
          console.log(`   ✅ Seleccionado "Normal"`);
        }
        await page.waitForTimeout(500);
      }
      
      const randomObs = observaciones[Math.floor(Math.random() * observaciones.length)];
      const observacionInputs = page.locator('textarea:visible:not([disabled]), input[type="text"]:visible:not([disabled])');
      const obsCount = await observacionInputs.count();
      
      if (obsCount > 0) {
        const lastInput = observacionInputs.last();
        try {
          await lastInput.fill(randomObs, { timeout: 3000 });
          console.log(`   ✅ Observación llenada: "${randomObs.substring(0, 35)}..."`);
        } catch (e) {
          console.log(`   ⚠️ No se pudo llenar observación`);
        }
      }
      
      await page.waitForTimeout(300);
      processedCheckboxes++;
      
    }
    
    console.log(`\n📊 Resumen: ${processedCheckboxes}/${totalCheckboxes} checkboxes procesados`);
    
    console.log('\n💾 Guardando sección de Exploración...');
    await page.waitForTimeout(1000);
    
    const guardarCount = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      let clicked = 0;
      buttons.forEach(btn => {
        if (btn.textContent.trim().toLowerCase().includes('guardar cambios')) {
          btn.click();
          clicked++;
        }
      });
      return clicked;
    });
    console.log(`💾 Click en ${guardarCount} botones "Guardar cambios" via JS`);
    await page.waitForTimeout(2000);
    
    await page.evaluate(() => {
      const modals = document.querySelectorAll('.swal2-confirm, .swal2-popup button');
      modals.forEach(btn => {
        if (btn.offsetParent !== null) btn.click();
      });
    });
    await page.waitForTimeout(1000);
    
    console.log('\n🔄 Cambiando todos los "Normal" a "Anormal"...');
    const cambiosNormales = await page.evaluate(() => {
      const allLabels = Array.from(document.querySelectorAll('label'));
      let changed = 0;
      
      allLabels.forEach(label => {
        const text = label.textContent.trim().toLowerCase();
        if (text === 'normal') {
          const forId = label.getAttribute('for');
          if (forId) {
            const anormalId = forId.replace(/-1$/, '-2');
            const anormalRadio = document.getElementById(anormalId);
            
            if (anormalRadio && anormalRadio.type === 'radio') {
              anormalRadio.click();
              changed++;
            }
          }
        }
      });
      
      return changed;
    });
    console.log(`🔄 ${cambiosNormales} radios cambiados de Normal a Anormal`);
    await page.waitForTimeout(5000);
    
    console.log('✅ Sección de Exploración completada');
    
  } catch (error) {
    console.log(`⚠️ Error en fillExplorationSection: ${error.message}`);
    await page.screenshot({ path: 'test-results/exploration-error.png', fullPage: true });
  }
}

async function fillDiagnosticoSection(page: Page): Promise<void> {
  console.log('🩺 Iniciando llenado de la sección de Diagnóstico...');
  
  try {
    await page.waitForTimeout(500);
    
    console.log('🔍 Buscando dropdown CIE-10...');
    
    const labelCIE10 = page.locator('label:has-text("CIE"), label:has-text("Código"), label:has-text("diagnóstico")').first();
    let cie10Input: Locator | null = null;
    
    if (await labelCIE10.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('✅ Label CIE-10 encontrado');
      cie10Input = labelCIE10.locator('xpath=following::input[1] | xpath=../input | xpath=..//input').first();
    }
    
    if (!cie10Input || !await cie10Input.isVisible().catch(() => false)) {
      const selectors = [
        'input[placeholder*="CIE" i]',
        'input[placeholder*="código" i]',
        'input[placeholder*="buscar" i]',
        '.vs__search',
        'input[type="search"]',
        'input[role="combobox"]'
      ];
      
      for (const sel of selectors) {
        const input = page.locator(sel).first();
        if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
          cie10Input = input;
          console.log(`✅ Dropdown encontrado con: ${sel}`);
          break;
        }
      }
    }
    
    if (cie10Input && await cie10Input.isVisible().catch(() => false)) {
      const svgIcon = page.locator('svg.css-8mmkcg, svg[class*="css-"]').first();
      if (await svgIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
        await svgIcon.click();
        console.log('✅ Click en SVG del dropdown');
      } else {
        await cie10Input.click();
        console.log('✅ Click en input (SVG no encontrado)');
      }
      await page.waitForTimeout(800);
      
      const options = page.locator('[role="option"]:visible, .dropdown-item:visible, li:visible, ul li:visible');
      const optionCount = await options.count();
      console.log(`📋 Dropdown abierto con ${optionCount} opciones`);
      
      if (optionCount > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(optionCount, 10));
        const optionText = await options.nth(randomIndex).textContent().catch(() => 'Opción');
        await options.nth(randomIndex).click();
        console.log(`✅ Diagnóstico CIE-10 seleccionado: "${optionText.trim().substring(0, 40)}..."`);
        
        await page.waitForTimeout(500);
      }
    } else {
      console.log('⚠️ No se encontró dropdown CIE-10');
    }
    
    console.log('📝 Llenando textareas de diagnóstico...');
    const textareas = page.locator('textarea:not([disabled]):not([readonly])');
    const taCount = await textareas.count();
    
    for (let i = 0; i < taCount; i++) {
      const textarea = textareas.nth(i);
      if (await textarea.isVisible() && await textarea.isEnabled()) {
        const currentValue = await textarea.inputValue();
        if (!currentValue || currentValue.trim() === '') {
          const placeholder = await textarea.getAttribute('placeholder') || '';
          let fillText = 'Diagnóstico pendiente de confirmación.';
          
          if (placeholder.toLowerCase().includes('impresión') || placeholder.toLowerCase().includes('diagnóstico')) {
            fillText = 'Impresión diagnóstica: Condición médica a evaluar. Se solicitan estudios complementarios.';
          } else if (placeholder.toLowerCase().includes('nota')) {
            fillText = 'Notas adicionales del diagnóstico.';
          }
          
          await textarea.fill(fillText);
          console.log(`✅ Textarea ${i+1} llenado`);
        }
      }
    }
    
    console.log('✅ Diagnóstico completado, continuando...');
    
  } catch (error) {
    console.log(`⚠️ Error en Diagnóstico: ${error.message}`);
  }
}

async function testMedicacionValidation(page: Page): Promise<void> {
  console.log('\n🧪 === PRUEBA DE VALIDACIÓN DE MEDICAMENTOS ===');
  
  const treatmentReport: { campo: string; valorInvalido: string; permitioEscritura: boolean; nota: string }[] = [];
  
  console.log('\n📋 Abriendo formulario de medicamento para pruebas...\n');
  
  await page.waitForTimeout(1500);
  
  const medicInput = page.locator('input[placeholder*="medic" i]:visible, input[placeholder*="Medicamento"]:visible, input[autocomplete="off"]:visible').first();
  const inputVisible = await medicInput.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (!inputVisible) {
    console.log('⚠️ No hay input de medicamento visible, buscando botón para agregar...');
    const addBtn = page.locator('button:has-text("Agregar"), button:has-text("+ Agregar"), button:has-text("Nuevo"), [class*="agregar"]:visible').first();
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1500);
    }
  }
  
  if (await page.locator('input[placeholder*="medic" i]:visible, input[autocomplete="off"]:visible').count() > 0) {
    const medInput = page.locator('input[placeholder*="medic" i]:visible, input[autocomplete="off"]:visible').first();
    await medInput.click();
    await page.waitForTimeout(500);
    await medInput.type('Aspirina', { delay: 50 });
    await page.waitForTimeout(1500);
    
    const option = page.locator('[role="option"]:visible').first();
    if (await option.count() > 0 && await option.isVisible({ timeout: 1000 }).catch(() => false)) {
      await option.click();
      console.log('✅ Medicamento seleccionado, esperando campos del formulario...\n');
      await page.waitForTimeout(2500);
      
      console.log('  📍 Seleccionando vía del medicamento...');
      const allSelects = page.locator('select:visible:not([disabled])');
      const selectCount = await allSelects.count();
      
      if (selectCount > 0) {
        const viaSelect = allSelects.first();
        try {
          await viaSelect.selectOption({ index: 1 }, { timeout: 1000 });
          console.log('  ✅ Vía seleccionada');
        } catch {
          await viaSelect.selectOption({ index: 1 });
          console.log('  ✅ Vía seleccionada (primera opción)');
        }
        await page.waitForTimeout(300);
      }
      
      console.log('  📏 Seleccionando unidad...');
      if (selectCount > 1) {
        const unidadSelect = allSelects.nth(1);
        try {
          await unidadSelect.selectOption({ index: 1 }, { timeout: 1000 });
          console.log('  ✅ Unidad seleccionada');
        } catch {
          await unidadSelect.selectOption({ index: 1 });
          console.log('  ✅ Unidad seleccionada (primera opción)');
        }
        await page.waitForTimeout(300);
      }
      
      console.log('  ⏰ Seleccionando tiempo...');
      if (selectCount > 2) {
        const tiempoSelect = allSelects.nth(2);
        try {
          await tiempoSelect.selectOption({ index: 1 }, { timeout: 1000 });
          console.log('  ✅ Tiempo seleccionado');
        } catch {
          await tiempoSelect.selectOption({ index: 1 });
          console.log('  ✅ Tiempo seleccionado (primera opción)');
        }
        await page.waitForTimeout(300);
      }
    }
  }
  
  console.log('\n🔍 Buscando campos numéricos del formulario de medicamento...\n');
  await page.waitForTimeout(2000);
  
  const allNumberInputs = page.locator('input[type="number"]:visible:not([disabled])');
  let numberCount = await allNumberInputs.count();
  console.log(`🔢 Encontrados ${numberCount} campos numéricos para probar\n`);
  
  for (let attempt = 0; attempt < 3 && numberCount === 0; attempt++) {
    console.log(`⏳ Intento ${attempt + 1}: Esperando campos numéricos...`);
    await page.waitForTimeout(2000);
    numberCount = await allNumberInputs.count();
    console.log(`🔢 Campos encontrados: ${numberCount}`);
  }
  
  for (let i = 0; i < Math.min(numberCount, 6); i++) {
    const input = allNumberInputs.nth(i);
    if (!(await input.isVisible().catch(() => false))) continue;
    
    const testCases = [
      { value: 'tres', desc: 'letras' },
      { value: '-10', desc: 'negativo' },
      { value: '0', desc: 'cero' },
      { value: '999999', desc: 'extremo' },
      { value: '12.5.8', desc: 'multiples_puntos' },
      { value: 'abc123', desc: 'mixto' },
      { value: '!@#$%', desc: 'simbolos' }
    ];
    
    for (const testCase of testCases) {
      try {
        await input.click({ clickCount: 3 });
        await input.press('Backspace');
        await page.waitForTimeout(200);
        
        await input.type(testCase.value, { delay: 25 });
        await page.waitForTimeout(350);
        
        const actualValue = await input.inputValue();
        
        let isVulnerable = false;
        let nota = '';
        
        if (actualValue === '' || actualValue === '0') {
          nota = `✅ BLOQUEADO: Valor vacío o 0`;
        } else if (actualValue !== testCase.value) {
          const numbersInInput = testCase.value.replace(/[^0-9.-]/g, '');
          const numbersInActual = actualValue.replace(/[^0-9.-]/g, '');
          if (testCase.value === 'tres' || testCase.value === '!@#$%') {
            nota = `✅ BLOQUEADO: No aceptó caracteres`;
          } else if (numbersInInput === numbersInActual || actualValue === numbersInActual) {
            nota = `✅ BLOQUEADO: Aceptó solo números "${actualValue}"`;
          } else if (parseFloat(actualValue) < parseFloat(numbersInInput)) {
            nota = `✅ BLOQUEADO: Recortó a límite "${actualValue}"`;
          } else {
            isVulnerable = true;
            nota = `❌ VULNERABLE: Aceptó "${actualValue}"`;
          }
        } else {
          isVulnerable = true;
          nota = `❌ VULNERABLE: Aceptó valor inválido completo`;
        }
        
        console.log(`  Campo #${i+1} (${testCase.desc}): "${testCase.value}" -> "${actualValue}" | ${isVulnerable ? 'ACEPTÓ ❌' : 'BLOQUEÓ ✅'}`);
        
        treatmentReport.push({
          campo: `Medicamento Campo #${i+1} (${testCase.desc})`,
          valorInvalido: testCase.value,
          permitioEscritura: isVulnerable,
          nota: nota
        });
      } catch (e) {
        console.log(`  ⚠️ Error en campo #${i+1}: ${e}`);
      }
      await page.waitForTimeout(250);
    }
  }
  
  console.log('\n📝 Probando textareas (indicaciones del medicamento)...');
  const textareas = page.locator('textarea:visible:not([disabled])');
  const taCount = await textareas.count();
  console.log(`📝 Encontrados ${taCount} textareas para probar\n`);
  
  for (let i = 0; i < Math.min(taCount, 3); i++) {
    const textarea = textareas.nth(i);
    if (!(await textarea.isVisible().catch(() => false))) continue;
    
    const maliciousTexts = [
      '<script>alert("xss")</script>',
      '{{constructor.constructor("alert(1)")()}}',
      '<img src=x onerror=alert(1)>',
      'javascript:alert(1)',
      'A'.repeat(10000),
      '   ',
      ';;; DROP TABLE medicamentos; --'
    ];
    
    for (const text of maliciousTexts) {
      try {
        await textarea.click();
        await page.keyboard.press('Control+A');
        await page.waitForTimeout(100);
        await page.keyboard.type(text, { delay: text.length > 100 ? 1 : 10 });
        await page.waitForTimeout(350);
        
        const actualValue = await textarea.inputValue();
        const permitio = actualValue.length > 0;
        
        const shortText = text.substring(0, 25).replace(/<[^>]*>/g, '');
        console.log(`  Textarea #${i+1}: "${shortText}..." -> "${actualValue.substring(0, 20)}..." | ${permitio ? 'ACEPTÓ ⚠️' : 'BLOQUEÓ ✅'}`);
        
        treatmentReport.push({
          campo: `Textarea #${i+1}`,
          valorInvalido: shortText,
          permitioEscritura: permitio,
          nota: permitio ? `⚠️ Aceptó texto` : `✅ Bloqueó`
        });
      } catch (e) {}
      await page.waitForTimeout(250);
    }
  }
  
  console.log('\n📊 === REPORTE DE VALIDACIÓN TRATAMIENTO ===');
  console.log('═'.repeat(80));
  
  let incorrectos = 0;
  let correctos = 0;
  
  for (const item of treatmentReport) {
    if (item.permitioEscritura) {
      incorrectos++;
    } else {
      correctos++;
    }
  }
  
  const vulnerableFields = treatmentReport.filter(r => r.permitioEscritura);
  const uniqueVulnerable = [...new Set(vulnerableFields.map(r => r.campo.split('(')[0].trim()))];
  
  console.log(`\n📈 RESUMEN: ${correctos} validaciones correctas ✅ | ${incorrectos} vulnerabilidades encontradas ❌\n`);
  
  if (uniqueVulnerable.length > 0) {
    console.log(`⚠️  CAMPOS VULNERABLES: ${uniqueVulnerable.join(', ')}`);
  }
  
  console.log('\n' + '═'.repeat(80));
  
  console.log('\n✅ Pruebas de validación completadas.\n');
}

async function fillTreatmentSection(page: Page): Promise<void> {
  console.log('💊 Iniciando llenado de la sección de Tratamiento...');
  
  console.log('📌 Cerrando barra lateral...');
  try {
    const sidebarToggle = page.locator('#sidebar_toggle');
    if (await sidebarToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sidebarToggle.click();
      console.log('✅ Barra lateral cerrada');
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log('⚠️ Error cerrando sidebar:', e.message.substring(0, 40));
  }
  
  try {
    await page.waitForTimeout(1000);
    
    console.log('\n📋 Llenando Indicaciones Generales...');
    await page.waitForTimeout(500);
    
    const rswEditors = page.locator('div.rsw-editor');
    const rswCount = await rswEditors.count();
    console.log(`📝 Encontrados ${rswCount} RSW editors en Tratamiento`);
    
    for (let i = 0; i < rswCount; i++) {
      const editor = rswEditors.nth(i);
      if (await editor.isVisible().catch(() => false)) {
        const contentEditable = editor.locator('[contenteditable="true"]').first();
        if (await contentEditable.count() > 0 && await contentEditable.isVisible().catch(() => false)) {
          await contentEditable.click();
          await page.waitForTimeout(200);
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.type('Indicaciones generales: Tomar medicamentos según prescripción médica. Mantener hidratación adecuada.');
          console.log(`✅ RSW editor ${i+1} llenado`);
        }
      }
    }
    console.log('✅ Indicaciones Generales completadas');
    await page.waitForTimeout(500);
    
    console.log('\n🧪 Ejecutando pruebas de validación de medicamentos...');
    await testMedicacionValidation(page);
    
    console.log('\n💊 Limpiando campos de prueba y preparando para registro válido...');
    await page.waitForTimeout(1000);
    
    console.log('\n💊 Llenando Aspirina con datos válidos...');
    const numberInputs = page.locator('input[type="number"]:visible:not([disabled])');
    const numCount = await numberInputs.count();
    
    if (numCount > 0) {
      const cantidadInput = numberInputs.first();
      await cantidadInput.click({ clickCount: 3 });
      await cantidadInput.fill('100');
      console.log('  ✅ Cantidad válida: 100');
      await page.waitForTimeout(200);
    }
    
    if (numCount > 1) {
      const freqInput = numberInputs.nth(1);
      await freqInput.click({ clickCount: 3 });
      await freqInput.fill('8');
      console.log('  ✅ Frecuencia válida: cada 8 horas');
      await page.waitForTimeout(200);
    }
    
    if (numCount > 2) {
      const duracionInput = numberInputs.nth(2);
      await duracionInput.click({ clickCount: 3 });
      await duracionInput.fill('7');
      console.log('  ✅ Duración válida: 7 días');
      await page.waitForTimeout(200);
    }
    
    const allSelects = page.locator('select:visible:not([disabled])');
    const selectCount = await allSelects.count();
    
    if (selectCount > 0) {
      const viaSelect = allSelects.first();
      await viaSelect.selectOption({ label: 'Oral' });
      console.log('  ✅ Vía válida: Oral');
      await page.waitForTimeout(200);
    }
    
    if (selectCount > 1) {
      const unidadSelect = allSelects.nth(1);
      await unidadSelect.selectOption({ label: 'miligramos' });
      console.log('  ✅ Unidad válida: miligramos');
      await page.waitForTimeout(200);
    }
    
    if (selectCount > 2) {
      const tiempoSelect = allSelects.nth(2);
      try {
        await tiempoSelect.selectOption({ label: 'día' });
        console.log('  ✅ Tiempo válido: día');
      } catch {
        await tiempoSelect.selectOption({ index: 1 });
        console.log('  ✅ Tiempo válido (primera opción)');
      }
      await page.waitForTimeout(200);
    }
    
    const textareaIndicaciones = page.locator('textarea:visible:not([disabled])').first();
    if (await textareaIndicaciones.isVisible({ timeout: 1000 }).catch(() => false)) {
      await textareaIndicaciones.fill('Tomar con alimentos. No exceder 3 tabletas al día.');
      console.log('  ✅ Indicaciones填入完成');
    }
    
    console.log('  ✅ Aspirina registrada con datos válidos');
    await page.waitForTimeout(500);
    
    const vias = ['Oral', 'Intramuscular', 'Intravenosa', 'Subcutánea', 'Cutánea'];
    const cantidades = [20, 100, 200, 400, 500];
    const unidades = ['miligramos', 'mililitros', 'gotas'];
    const frecuencias = ['8', '12', '24'];
    const tiempos = ['día', 'semana', 'mes'];
    
    console.log('\n💊 Registrando medicamento 1: Paracetamol');
    await registrarMedicamento(page, 'Paracetamol', vias, cantidades, unidades, frecuencias, tiempos);
    
    console.log('\n💊 Registrando medicamento 2: Ibuprofeno');
    await registrarMedicamento(page, 'Ibuprofeno', vias, cantidades, unidades, frecuencias, tiempos);
    
    console.log('\n💾 Guardando medicamentos...');
    await page.waitForTimeout(1000);
    
    const guardarBtnsTratamiento = page.locator('button:has-text("Guardar cambios")');
    const guardarCountTrat = await guardarBtnsTratamiento.count();
    console.log(`💾 Encontrados ${guardarCountTrat} botones "Guardar cambios"`);
    
    for (let i = 0; i < guardarCountTrat; i++) {
      const btn = guardarBtnsTratamiento.nth(i);
      try {
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click({ force: true });
          console.log(`✅ Click en "Guardar cambios" ${i + 1}`);
          await page.waitForTimeout(2000);
          const modal = page.locator('.swal2-container:visible, .swal2-popup:visible, [role="dialog"]:visible');
          if (await modal.count() > 0) {
            const okBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), .swal2-confirm');
            if (await okBtn.count() > 0) {
              await okBtn.first().click({ timeout: 3000 }).catch(() => {});
              console.log('✅ Modal cerrado');
              await page.waitForTimeout(1000);
            }
          }
        }
      } catch (e) {
        console.log(`⚠️ Error botón guardar ${i + 1}: ${e.message.substring(0, 40)}`);
      }
    }
    
    console.log('\n✅ Sección de Tratamiento completada');
  } catch (error) {
    console.log(`⚠️ Error en fillTreatmentSection: ${error.message}`);
  }
}

async function fillNotasMedicoSection(page: Page): Promise<void> {
  console.log('📋 Llenando sección de Notas del Médico...');
  
  try {
    await page.waitForTimeout(1000);
    
    const rswEditors = page.locator('div.rsw-editor');
    const rswCount = await rswEditors.count();
    console.log(`📝 Encontrados ${rswCount} RSW editors en Notas del Médico`);
    
    for (let i = 0; i < rswCount; i++) {
      const editor = rswEditors.nth(i);
      if (await editor.isVisible().catch(() => false)) {
        const contentEditable = editor.locator('[contenteditable="true"]').first();
        if (await contentEditable.count() > 0 && await contentEditable.isVisible().catch(() => false)) {
          await contentEditable.click();
          await page.waitForTimeout(200);
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.type('Notas del médico: Paciente en seguimiento. Estado de salud favorable.');
          console.log(`✅ RSW editor ${i+1} llenado`);
        }
      }
    }
    
    const contentEditable = page.locator('[contenteditable="true"]:not([style*="display: none"]):not([style*="display:none"])');
    const ceCount = await contentEditable.count();
    console.log(`📝 Encontrados ${ceCount} contenteditable en Notas del Médico`);
    
    for (let i = 0; i < ceCount; i++) {
      const el = contentEditable.nth(i);
      if (await el.isVisible().catch(() => false)) {
        const currentText = await el.textContent().catch(() => '');
        if (!currentText || currentText.trim() === '') {
          await el.click();
          await page.waitForTimeout(200);
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.type('Notas del médico: Seguimiento de evolución clínica favorable.');
          console.log(`✅ Contenteditable ${i+1} llenado`);
        }
      }
    }
    
    const textareas = page.locator('textarea:not([disabled]):not([readonly])');
    const taCount = await textareas.count();
    console.log(`📝 Encontradas ${taCount} textareas en Notas del Médico`);
    
    for (let i = 0; i < taCount; i++) {
      const textarea = textareas.nth(i);
      if (await textarea.isVisible().catch(() => false) && await textarea.isEnabled().catch(() => false)) {
        const currentValue = await textarea.inputValue().catch(() => '');
        if (!currentValue || currentValue.trim() === '') {
          await textarea.click();
          await page.waitForTimeout(100);
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.type('Notas del médico: Seguimiento favorable, paciente en buen estado general.');
          console.log(`✅ Textarea ${i+1} llenada`);
        }
      }
    }
    
    console.log('✅ Notas del Médico completadas');
    await page.waitForTimeout(500);
    
  } catch (error) {
    console.log(`⚠️ Error en Notas del Médico: ${error.message}`);
  }
}

async function fillServiciosSection(page: Page): Promise<void> {
  console.log('🏥 Llenando sección de Servicios...');
  
  try {
    await page.waitForTimeout(1000);
    
    console.log('🔍 Buscando dropdowns en Servicios...');
    
    const dropdownLabels = ['servicio', 'tipo', 'concepto', 'clasificación'];
    
    for (const labelText of dropdownLabels) {
      const labelDropdown = page.locator(`label:has-text("${labelText}"), span:has-text("${labelText}"), div:has-text("${labelText}"):not([role])`).first();
      
      if (await labelDropdown.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`✅ Label "${labelText}" encontrado`);
        
        let dropdownInput = labelDropdown.locator('xpath=following::input[1] | xpath=../input | xpath=..//input | xpath=following-sibling::div//input').first();
        
        if (!dropdownInput || !await dropdownInput.isVisible().catch(() => false)) {
          const selectors = [
            'input[role="combobox"]',
            'input[placeholder*="buscar" i]',
            'input[placeholder*="seleccion" i]',
            '.vs__search',
            'input[type="search"]'
          ];
          
          for (const sel of selectors) {
            const input = page.locator(sel).first();
            if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
              dropdownInput = input;
              console.log(`✅ Dropdown encontrado con: ${sel}`);
              break;
            }
          }
        }
        
        if (dropdownInput && await dropdownInput.isVisible().catch(() => false)) {
          const svgIcon = page.locator('svg.css-8mmkcg, svg[class*="css-"]').first();
          if (await svgIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
            await svgIcon.click();
            console.log('✅ Click en SVG del dropdown');
          } else {
            await dropdownInput.click();
            console.log('✅ Click en input dropdown');
          }
          await page.waitForTimeout(800);
          
          const options = page.locator('[role="option"]:visible, .dropdown-item:visible, li:visible, ul li:visible');
          const optionCount = await options.count();
          console.log(`📋 Dropdown abierto con ${optionCount} opciones`);
          
          if (optionCount > 0) {
            let certificadoOption = null;
            for (let j = 0; j < optionCount; j++) {
              const optionText = await options.nth(j).textContent().catch(() => '');
              if (optionText.toLowerCase().includes('certificado') && optionText.toLowerCase().includes('médico')) {
                certificadoOption = options.nth(j);
                console.log(`✅ Certificado Médico encontrado en índice ${j}`);
                break;
              }
            }
            
            if (!certificadoOption) {
              const randomIndex = Math.floor(Math.random() * Math.min(optionCount, 10));
              certificadoOption = options.nth(randomIndex);
              const optionText = await certificadoOption.textContent().catch(() => 'Opción');
              console.log(`ℹ️ Usando opción aleatoria: "${optionText.trim().substring(0, 40)}..."`);
            }
            
            await certificadoOption.click();
            console.log(`✅ Opción seleccionada`);
            await page.waitForTimeout(500);
          }
        }
      }
    }
    
    const rswEditors = page.locator('div.rsw-editor');
    const rswCount = await rswEditors.count();
    console.log(`📝 Encontrados ${rswCount} RSW editors en Servicios`);
    
    for (let i = 0; i < rswCount; i++) {
      const editor = rswEditors.nth(i);
      if (await editor.isVisible().catch(() => false)) {
        const contentEditable = editor.locator('[contenteditable="true"]').first();
        if (await contentEditable.count() > 0 && await contentEditable.isVisible().catch(() => false)) {
          await contentEditable.click();
          await page.waitForTimeout(200);
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.type('Servicio proporcionado según protocolo médico. Evaluación completa realizada.');
          console.log(`✅ RSW editor ${i+1} llenado`);
        }
      }
    }
    
    console.log('💾 Buscando botón "Guardar servicios"...');
    await page.waitForTimeout(500);
    const guardarServiciosSelectors = [
      page.getByRole('button', { name: /guardar servicios/i }),
      page.getByRole('button', { name: /guardar/i }),
      page.locator('button:has-text("Guardar servicios")'),
      page.locator('button:has-text("Guardar")')
    ];

    for (const selector of guardarServiciosSelectors) {
      try {
        if (await selector.count() > 0 && await selector.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          await selector.first().click();
          console.log('✅ Click en "Guardar servicios"');
          await page.waitForTimeout(1500);

          const modal = page.locator('.swal2-container:visible, [role="dialog"]:visible');
          if (await modal.count() > 0) {
            const okBtn = modal.locator('button:has-text("OK"), button:has-text("Aceptar"), .swal2-confirm');
            if (await okBtn.count() > 0) {
              await okBtn.first().click({ timeout: 2000 }).catch(() => {});
              await page.waitForTimeout(500);
            }
          }
          break;
        }
      } catch (e) {
        continue;
      }
    }

    console.log('✅ Servicios completados');
    await page.waitForTimeout(500);
    
  } catch (error) {
    console.log(`⚠️ Error en Servicios: ${error.message}`);
  }
}

async function registrarMedicamento(
  page: Page, 
  nombreMedicamento: string, 
  vias: string[], 
  cantidades: number[], 
  unidades: string[], 
  frecuencias: string[], 
  tiempos: string[]
): Promise<void> {
  const via = vias[Math.floor(Math.random() * vias.length)];
  const cantidad = cantidades[Math.floor(Math.random() * cantidades.length)];
  const unidad = unidades[Math.floor(Math.random() * unidades.length)];
  const frecuencia = frecuencias[Math.floor(Math.random() * frecuencias.length)];
  const tiempo = tiempos[Math.floor(Math.random() * tiempos.length)];
  
  console.log(`   📋 Vía: ${via}, Cantidad: ${cantidad}, Unidad: ${unidad}`);
  console.log(`   📋 Frecuencia: ${frecuencia}h, Duración: 10, Tiempo: ${tiempo}`);
  
  console.log(`   🔍 Buscando input para "${nombreMedicamento}"...`);
  const allMedicInputs = page.locator('input[placeholder*="medic" i]:visible, input[placeholder*="Medicamento"]:visible, input[autocomplete="off"]:visible');
  const inputCount = await allMedicInputs.count();
  console.log(`   📋 Encontrados ${inputCount} inputs de medicamentos`);
  
  let medicamentoInput: Locator | null = null;
  for (let i = 0; i < inputCount; i++) {
    const input = allMedicInputs.nth(i);
    const value = await input.inputValue();
    if (!value || value.trim() === '') {
      medicamentoInput = input;
      console.log(`   📋 Usando input ${i+1} (vacío)`);
      break;
    }
  }
  
  if (!medicamentoInput) {
    medicamentoInput = allMedicInputs.first();
    console.log(`   📋 Usando primer input (todos ocupados)`);
  }
  
  if (await medicamentoInput.isVisible()) {
    await medicamentoInput.clear();
    await medicamentoInput.click();
    await page.waitForTimeout(300);
    await medicamentoInput.type(nombreMedicamento, { delay: 80 });
    await page.waitForTimeout(1000);
    
    const option = page.locator('[role="option"]:visible, .dropdown-item:visible, li:visible').first();
    if (await option.count() > 0) {
      await option.click();
      console.log(`   ✅ Medicamento "${nombreMedicamento}" seleccionado`);
    } else {
      await medicamentoInput.press('Enter');
      console.log(`   ✅ Medicamento "${nombreMedicamento}" ingresado`);
    }
    
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
  }
  
  console.log('   📍 Seleccionando vía: ' + via + '...');
  try {
    const allSelects = page.locator('select:visible:not([disabled])');
    const selectCount = await allSelects.count();
    
    if (selectCount > 0) {
      const viaSelect = allSelects.first();
      try {
        await viaSelect.selectOption({ label: via }, { timeout: 1000 });
        console.log(`   ✅ Vía seleccionada: ${via}`);
      } catch {
        await viaSelect.selectOption({ index: 1 }, { timeout: 1000 });
        console.log(`   ✅ Vía seleccionada (primera opción)`);
      }
    } else {
      console.log(`   ⚠️ No hay selects visibles`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error vía: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  console.log('   🔢 Ingresando cantidad: ' + cantidad + '...');
  try {
    const numberInputs = page.locator('input[type="number"]:visible:not([disabled])');
    const numCount = await numberInputs.count();
    
    if (numCount > 0) {
      const cantidadInput = numberInputs.first();
      await cantidadInput.click({ clickCount: 3 });
      await page.waitForTimeout(100);
      await cantidadInput.type(cantidad.toString(), { delay: 30 });
      console.log(`   ✅ Cantidad ingresada: ${cantidad}`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error cantidad: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  console.log('   📏 Seleccionando unidad: ' + unidad + '...');
  try {
    const allSelects = page.locator('select:visible:not([disabled])');
    const selectCount = await allSelects.count();
    
    if (selectCount > 1) {
      const unidadSelect = allSelects.nth(1);
      try {
        await unidadSelect.selectOption({ label: unidad }, { timeout: 1000 });
        console.log(`   ✅ Unidad seleccionada: ${unidad}`);
      } catch {
        await unidadSelect.selectOption({ index: 1 }, { timeout: 1000 });
        console.log(`   ✅ Unidad seleccionada (primera opción)`);
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Error unidad: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  console.log('   ⏰ Ingresando frecuencia: cada ' + frecuencia + ' horas...');
  try {
    const numberInputs = page.locator('input[type="number"]:visible:not([disabled])');
    const numCount = await numberInputs.count();
    
    let frecuenciaInput: Locator | null = null;
    for (let i = 0; i < numCount; i++) {
      const input = numberInputs.nth(i);
      const value = await input.inputValue();
      if (!value || value === '' || value === '0') {
        frecuenciaInput = input;
        break;
      }
    }
    
    if (frecuenciaInput) {
      await frecuenciaInput.click({ clickCount: 3 });
      await page.waitForTimeout(100);
      await frecuenciaInput.type(frecuencia, { delay: 50 });
      console.log(`   ✅ Frecuencia ingresada: cada ${frecuencia} horas`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error frecuencia: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  console.log('   📅 Ingresando duración: 10...');
  try {
    let duracionInput = page.locator('input[name="tiempo_cantidad"]').first();
    
    if (!await duracionInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      const numberInputs = page.locator('input[type="number"]:visible:not([disabled])');
      const numCount = await numberInputs.count();
      if (numCount > 2) {
        duracionInput = numberInputs.nth(2);
      }
    }
    
    if (await duracionInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await duracionInput.click({ clickCount: 3 });
      await page.waitForTimeout(100);
      await duracionInput.type('10', { delay: 50 });
      console.log(`   ✅ Duración ingresada: 10`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error duración: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  console.log('   📆 Seleccionando unidad de tiempo: ' + tiempo + '...');
  try {
    const allSelects = page.locator('select:visible:not([disabled])');
    const selectCount = await allSelects.count();
    
    if (selectCount >= 3) {
      const tiempoSelect = allSelects.nth(2);
      try {
        await tiempoSelect.selectOption({ label: tiempo }, { timeout: 1000 });
        console.log(`   ✅ Tiempo seleccionado: ${tiempo}`);
      } catch {
        await tiempoSelect.selectOption({ index: 1 }, { timeout: 1000 });
        console.log(`   ✅ Tiempo seleccionado (primera opción)`);
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Error tiempo: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  console.log('   📝 Ingresando indicaciones...');
  const indicacionesInput = page.locator('textarea:visible, input[placeholder*="indicacion" i]:visible').last();
  if (await indicacionesInput.isVisible()) {
    await indicacionesInput.clear();
    await indicacionesInput.fill('Indicaciones estándar');
    console.log(`   ✅ Indicaciones ingresadas`);
  }
  await page.waitForTimeout(300);
  console.log('   ℹ️ Medicamento registrado (se guardará al final)');
}

async function checkNextDaysForIniciarButton(page: Page): Promise<boolean> {
  console.log('🔍 Buscando botón Iniciar en próximos días...');
  
  for (let day = 1; day <= 5; day++) {
    console.log(`📅 Verificando día +${day}...`);
    
    const dayButtons = page.locator(`button:has-text("+${day}"), button:has-text("+${day} días"), button:has-text("+${day}d")`);
    
    if (await dayButtons.count() > 0) {
      await dayButtons.first().click();
      await page.waitForTimeout(2000);
    }
    
    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    
    if (count > 0) {
      console.log(`✅ Encontradas ${count} citas con Iniciar en día +${day}`);
      return true;
    }
  }
  
  return false;
}

async function createAppointment(page: Page): Promise<void> {
  console.log('📅 Creando nueva cita usando utils...');
  
  try {
    await createAppointmentExternal(page);
    console.log('✅ Cita creada exitosamente');
  } catch (e) {
    console.log('⚠️ Error creando cita con utils, intentando método local...');
    
    await page.goto('/Citas');
    await page.waitForTimeout(2000);
    
    const agendarBtn = page.getByRole('button', { name: /agendar cita/i });
    if (await agendarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await agendarBtn.click();
      await page.waitForTimeout(3000);
      
      const pacienteInput = page.locator('input[placeholder*="paciente" i], input[name*="paciente" i]').first();
      if (await pacienteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pacienteInput.click();
        await pacienteInput.type('Paciente', { delay: 50 });
        await page.waitForTimeout(1000);
        
        const option = page.locator('[role="option"]:visible').first();
        if (await option.count() > 0) {
          await option.click();
          await page.waitForTimeout(500);
        }
        
        const guardarBtn = page.locator('button:has-text("Guardar"), button:has-text("Agendar")').first();
        if (await guardarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await guardarBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    console.log('✅ Intento de cita completado');
  }
}

async function fillTabFields(page: Page, tabName: string): Promise<void> {
  console.log(`📝 Llenando campos de la pestaña: ${tabName}`);
  
  const textareas = page.locator('textarea:not([disabled]):not([readonly])');
  const taCount = await textareas.count();
  
  for (let i = 0; i < taCount; i++) {
    const textarea = textareas.nth(i);
    if (await textarea.isVisible() && await textarea.isEnabled()) {
      const currentValue = await textarea.inputValue();
      if (!currentValue || currentValue.trim() === '') {
        await textarea.fill(`Información de ${tabName}`);
        console.log(`✅ Textarea ${i+1} llenado`);
      }
    }
  }
  
  const inputs = page.locator('input[type="text"]:not([disabled]):not([readonly])');
  const inputCount = await inputs.count();
  
  for (let i = 0; i < inputCount; i++) {
    const input = inputs.nth(i);
    if (await input.isVisible() && await input.isEnabled()) {
      const currentValue = await input.inputValue();
      if (!currentValue || currentValue.trim() === '') {
        await input.fill('N/A');
        console.log(`✅ Input ${i+1} llenado`);
      }
    }
  }
}

test('Start a scheduled consultation - Stress Test', async ({ page }) => {
  test.setTimeout(600000);
  
  console.log('🏠 Navegando a Dashboard (Inicio)...');
  await page.goto('/Dashboard');
  await page.waitForTimeout(3000);
  
  let iniciarButtons = page.getByRole('button', { name: /iniciar/i });
  let count = await iniciarButtons.count();
  
  if (count === 0) {
    console.log('⚠️ No hay citas con botón Iniciar hoy');
    console.log('🔍 Revisando próximos 5 días...');
    
    const foundInNextDays = await checkNextDaysForIniciarButton(page);
    
    if (!foundInNextDays) {
      console.log('📅 No se encontraron citas en 5 días, creando una cita...');
      await createAppointment(page);
      
      console.log('🔙 Volviendo a Dashboard...');
      await page.goto('/Dashboard');
      await page.waitForTimeout(3000);
      
      const foundAfterCreate = await checkNextDaysForIniciarButton(page);
      
      if (!foundAfterCreate) {
        throw new Error('No se pudieron encontrar o crear citas disponibles para iniciar');
      }
    }
  } else {
    console.log(`✅ Encontradas ${count} cita(s) con botón Iniciar`);
  }
  
  iniciarButtons = page.getByRole('button', { name: /iniciar/i });
  count = await iniciarButtons.count();
    
  if (count === 0) {
    throw new Error('No hay citas disponibles para iniciar');
  }
  
  let selectedIndex = 0;
  let earliestMinutes = Infinity;
  
  for (let i = 0; i < count; i++) {
    const button = iniciarButtons.nth(i);
    const row = button.locator('xpath=ancestor::*[self::div or self::tr][1]');
    try {
      const timeText = await row.locator('text=/\\d{2}:\\d{2}/').first().textContent();
      if (timeText) {
        const [hours, minutes] = timeText.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        if (totalMinutes < earliestMinutes) {
          earliestMinutes = totalMinutes;
          selectedIndex = i;
        }
      }
    } catch (e) {
      // Continuar con siguiente
    }
  }
    
  console.log('▶️ Iniciando consulta...');
  await page.waitForTimeout(1000);
  const overlay = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
  if (await overlay.count() > 0 && await overlay.first().isVisible()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  await iniciarButtons.nth(selectedIndex).click({ force: true });
    
  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  await expect(signosButton).toBeVisible({ timeout: 10000 });
  await signosButton.click();
    
  console.log('\n🧪 === PRUEBA DE VALIDACIÓN DE SIGNOS VITALES ===');
  
  const validationReport: { campo: string; valorInvalido: string; permitioEscritura: boolean; nota: string }[] = [];
  
  async function testFieldValidation(
    fieldName: string,
    selector: string,
    invalidValue: string,
    expectedBehavior: string
  ): Promise<void> {
    const field = page.locator(selector);
    if (await field.count() === 0) {
      console.log(`  ⚠️ ${fieldName}: Campo no encontrado`);
      return;
    }
    
    const input = field.first();
    if (!(await input.isVisible().catch(() => false))) {
      console.log(`  ⚠️ ${fieldName}: Campo no visible`);
      return;
    }
    
    await input.click({ clickCount: 3 });
    await input.press('Backspace');
    await page.waitForTimeout(200);
    
    await input.type(invalidValue, { delay: 50 });
    await page.waitForTimeout(300);
    
    const actualValue = await input.inputValue();
    
    let isVulnerable = false;
    let nota = '';
    
    if (actualValue === '' || actualValue === '0') {
      nota = `✅ BLOQUEADO: Valor vacío o 0`;
    } else if (actualValue !== invalidValue) {
      const numbersInInput = invalidValue.replace(/[^0-9]/g, '');
      const numbersInActual = actualValue.replace(/[^0-9]/g, '');
      if (numbersInInput === numbersInActual || actualValue === numbersInActual) {
        nota = `✅ BLOQUEADO: Aceptó solo números "${actualValue}"`;
      } else if (parseFloat(actualValue) < parseFloat(invalidValue.replace(/[^0-9]/g, ''))) {
        nota = `✅ BLOQUEADO: Recortó a límite "${actualValue}"`;
      } else {
        isVulnerable = true;
        nota = `❌ VULNERABLE: Aceptó "${actualValue}"`;
      }
    } else {
      isVulnerable = true;
      nota = `❌ VULNERABLE: Aceptó valor inválido completo`;
    }
    
    console.log(`  ${fieldName}: "${invalidValue}" -> "${actualValue}" | ${isVulnerable ? 'ACEPTÓ ❌' : 'BLOQUEÓ ✅'}`);
    
    validationReport.push({
      campo: fieldName,
      valorInvalido: invalidValue,
      permitioEscritura: isVulnerable,
      nota
    });
  }

  console.log('\n📋 Probando valores INVÁLIDOS (letras, valores extremos):\n');
  
  await testFieldValidation('Peso', 'input[name="peso"]', 'abc123', 'Debe ser numérico');
  await testFieldValidation('Peso (extremo)', 'input[name="peso"]', '99999', 'Valor muy grande');
  
  const tallaInput = page.locator('input[name*="talla" i]');
  if (await tallaInput.count() > 0) {
    await testFieldValidation('Talla', 'input[name*="talla" i]', 'tres', 'Debe ser numérico');
    await testFieldValidation('Talla (extremo)', 'input[name*="talla" i]', '999', 'Valor irreal');
  }
  
  const presionInput = page.locator('input[placeholder="000/00 mmHg"]');
  if (await presionInput.count() > 0) {
    await testFieldValidation('Presión Arterial', 'input[placeholder="000/00 mmHg"]', 'abc/def', 'Letras en presión');
    await testFieldValidation('Presión (extremo)', 'input[placeholder="000/00 mmHg"]', '999/999', 'Presión lethal');
  }
  
  const tempInput = page.locator('input[name*="temp" i]');
  if (await tempInput.count() > 0) {
    await testFieldValidation('Temperatura', 'input[name*="temp" i]', 'treinta', 'Debe ser numérico');
    await testFieldValidation('Temperatura (extremo)', 'input[name*="temp" i]', '150', 'Fiebre imposible');
  }
  
  const fcInput = page.locator('input[name*="card" i]');
  if (await fcInput.count() > 0) {
    await testFieldValidation('Frecuencia Cardiaca', 'input[name*="card" i]', 'corazon', 'Debe ser numérico');
    await testFieldValidation('FC (extremo)', 'input[name*="card" i]', '999', 'FC imposible');
  }
  
  const satInput = page.locator('input[name="oxigenacion"]');
  if (await satInput.count() > 0) {
    await testFieldValidation('Oxigenación', 'input[name="oxigenacion"]', 'aire', 'Debe ser numérico');
    await testFieldValidation('Oxigenación (extremo)', 'input[name="oxigenacion"]', '500', '>100% imposible');
  }
  
  const frInput = page.locator('input[name="frecuenciaRespiratoria"]');
  if (await frInput.count() > 0) {
    await testFieldValidation('Frecuencia Respiratoria', 'input[name="frecuenciaRespiratoria"]', 'respirar', 'Debe ser numérico');
    await testFieldValidation('FR (extremo)', 'input[name="frecuenciaRespiratoria"]', '200', 'FR imposible');
  }
  
  const glucosaInput = page.locator('input[name="glucosa"]');
  if (await glucosaInput.count() > 0) {
    await testFieldValidation('Glucosa', 'input[name="glucosa"]', 'dulce', 'Debe ser numérico');
    await testFieldValidation('Glucosa (extremo)', 'input[name="glucosa"]', '9999', 'Glucosa mortal');
  }

  console.log('\n📊 === REPORTE DE VALIDACIÓN ===');
  console.log('═'.repeat(80));
  
  let incorrectos = 0;
  let correctos = 0;
  
  for (const item of validationReport) {
    console.log(`\n🔹 ${item.campo}:`);
    console.log(`   Valor probado: "${item.valorInvalido}"`);
    console.log(`   Resultado: ${item.permitioEscritura ? '❌ ACEPTÓ (INCORRECTO)' : '✅ BLOQUEÓ (CORRECTO)'}`);
    console.log(`   Nota: ${item.nota}`);
    
    if (item.permitioEscritura) incorrectos++;
    else correctos++;
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log(`📈 RESUMEN: ${correctos} campos protegidos ✅ | ${incorrectos} campos vulnerables ❌`);
  console.log('═'.repeat(80));
  
  const vulnerableFields = validationReport.filter(r => r.permitioEscritura).map(r => r.campo);
  if (vulnerableFields.length > 0) {
    console.log(`\n⚠️  CAMPOS VULNERABLES A INPUT INVÁLIDO: ${vulnerableFields.join(', ')}`);
  }

  console.log('\n💉 Ahora llenando con valores válidos...');
  
  await page.locator('input[name="peso"]').fill('70');
  
  if (await page.locator('input[name*="talla" i]').count() > 0) {
    await page.locator('input[name*="talla" i]').first().fill('170');
  }
  
  if (await presionInput.isVisible().catch(() => false)) {
    await presionInput.fill('120/80');
  }
  
  if (await tempInput.count() > 0) {
    await tempInput.first().fill('36.6');
  }
  
  if (await fcInput.count() > 0) {
    await fcInput.first().fill('72');
  }
  
  if (await satInput.count() > 0) {
    await satInput.first().fill('98');
  }
  
  if (await frInput.count() > 0) {
    await frInput.first().fill('16');
  }
  
  if (await glucosaInput.count() > 0) {
    await glucosaInput.first().fill('95');
  }
  
  await page.getByRole('button', { name: /^Guardar$/i }).click();
  
  await page.waitForTimeout(2000);
  const cerrarButton = page.getByRole('button', { name: /cerrar/i });
  if (await cerrarButton.isVisible().catch(() => false)) {
    await cerrarButton.click();
    await page.waitForTimeout(1500);
  }
  
  console.log('🔄 Esperando redirección...');
  try {
    await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
    console.log('✅ Redirigido a página de consulta');
  } catch (e) {
    console.log('⚠️ Timeout, navegando manualmente...');
    await page.goto('/Consulta/ConsultaGeneral');
    await page.waitForLoadState('networkidle');
  }
  
  console.log('⏳ Esperando carga completa de la consulta...');
  try {
    await page.waitForFunction(() => {
      return !document.body.innerText.includes('Cargando información de consulta');
    }, { timeout: 30000 });
    console.log('✅ Página de consulta cargada');
  } catch (e) {
    console.log('⚠️ Timeout esperando carga, continuando de todos modos...');
  }
  await page.waitForTimeout(2000);

  const tabs = [
    { name: 'General', fields: ['hospital', 'tipo de consulta', 'motivo de la consulta', 'padecimiento actual', 'notas de evolución', 'nombre de referido'] },
    { name: 'Exploración', fields: [] },
    { name: 'Diagnóstico', fields: [] },
    { name: 'Tratamiento', fields: [] },
    { name: 'Notas del Médico', fields: [] },
    { name: 'Servicios', fields: [] }
  ];

  for (const tabInfo of tabs) {
    const tabName = tabInfo.name;
    const requiredFields = tabInfo.fields;
    
    console.log(`\n🔍 Buscando pestaña: ${tabName}`);
    
    const tabSelectors = [
      page.getByRole('tab', { name: new RegExp(`^${tabName}$`, 'i') }),
      page.getByRole('button', { name: new RegExp(`^${tabName}$`, 'i') }),
      page.locator(`div, span, p, li, a:has-text("${tabName}")`)
    ];
    
    let tabElement: Locator | null = null;
    for (const selector of tabSelectors) {
      try {
        if (await selector.count() > 0 && await selector.first().isVisible()) {
          tabElement = selector.first();
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!tabElement) {
      console.log(`⚠️ Pestaña "${tabName}" no encontrada, saltando...`);
      continue;
    }
    
    await handleModals(page);
    await page.waitForTimeout(500);
    
    await tabElement.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    if (requiredFields.length > 0) {
      console.log(`🎯 Llenando campos específicos para ${tabName}`);
      for (const fieldName of requiredFields) {
        await fillSpecificField(page, fieldName);
      }
    }
    
    if (tabName === 'General') {
      console.log('📋 Sección General: Completando información correcta sin tests...');
      await fillTabFields(page, tabName);
    } else if (tabName === 'Exploración') {
      console.log('📋 Sección Exploración: Completando con flujo correcto...');
      await fillExplorationSection(page);
      
      console.log('  💾 Clicking all available "Guardar" buttons in Exploración...');
      const guardarButtons = page.locator('button:has-text("Guardar"), button:has-text("Guardar cambios")');
      const guardarCount = await guardarButtons.count();
      console.log(`  📋 Found ${guardarCount} "Guardar" buttons to click`);
      
      for (let i = 0; i < guardarCount; i++) {
        const btn = guardarButtons.nth(i);
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click({ force: true });
          console.log(`  ✅ Clicked "Guardar" button ${i + 1}`);
          await page.waitForTimeout(1500);
          
          const okBtn = page.locator('button:has-text("OK"), button:has-text("Aceptar"), .swal2-confirm');
          if (await okBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
            await okBtn.first().click();
            await page.waitForTimeout(500);
          }
        }
      }
      console.log('  ✅ All "Guardar" buttons clicked in Exploración');
    } else if (tabName === 'Diagnóstico') {
      console.log('📋 Sección Diagnóstico: Completando información correcta sin tests...');
      await fillDiagnosticoSection(page);
    } else if (tabName === 'Tratamiento') {
      console.log('📋 Sección Tratamiento: Testeando medicamentos y solicitud...');
      await fillTreatmentSection(page);
      
      console.log('  💊 Testeando campo de medicamento...');
      const medInput = page.locator('input[placeholder*="medic" i], input[autocomplete="off"]:visible').first();
      if (await medInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await medInput.fill('Paracetamol');
        await page.waitForTimeout(500);
        
        const selectMed = page.locator('div[id*="medicamento"] button, div[id*="suggestions"] button').first();
        if (await selectMed.isVisible({ timeout: 2000 }).catch(() => false)) {
          await selectMed.click();
          await page.waitForTimeout(1500);
          
          console.log('  💊 Seleccionando vía del medicamento...');
          const viaSelect = page.locator('select[name*="via" i], select[id*="via" i], select:visible').first();
          if (await viaSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
            const options = await viaSelect.locator('option').count();
            if (options > 1) {
              await viaSelect.selectOption({ index: 1 });
              console.log('  ✅ Vía seleccionada');
              await page.waitForTimeout(500);
            }
          }
          
          console.log('  💊 Intentando guardar con medicamento...');
          const guardarBtn = page.locator('button:has-text("Guardar"), button:has-text("Guardar cambios")').first();
          if (await guardarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await guardarBtn.click();
            await page.waitForTimeout(1500);
          }
        }
      }
      
      console.log('  🔬 Buscando dropdown de solicitud...');
      
      const solicitudLabel = page.locator('label:has-text("Solicitud")');
      const labelCount = await solicitudLabel.count();
      
      if (labelCount > 0) {
        console.log(`  ✅ Label "Solicitud" encontrado`);
        
        const solicitudInput = page.locator('label:has-text("Solicitud") ~ div input[role="combobox"], label:has-text("Solicitud") + div input[role="combobox"]');
        
        if (await solicitudInput.count() > 0 && await solicitudInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          await solicitudInput.first().click();
          console.log('  ✅ Click en input de solicitud');
          await page.waitForTimeout(1000);
          
          const options = page.locator('[role="option"]:visible');
          const optionCount = await options.count();
          console.log(`  📋 Dropdown de solicitud abierto con ${optionCount} opciones`);
          
          if (optionCount > 0) {
            const randomIndex = Math.floor(Math.random() * Math.min(optionCount, 10));
            const optionText = await options.nth(randomIndex).textContent().catch(() => 'Estudio');
            await options.nth(randomIndex).click();
            console.log(`  ✅ Estudio seleccionado: "${optionText.trim().substring(0, 40)}..."`);
          } else {
            await solicitudInput.first().type('Biometría', { delay: 80 });
            await page.waitForTimeout(1000);
            
            const searchOptions = page.locator('[role="option"]:visible');
            const searchCount = await searchOptions.count();
            
            if (searchCount > 0) {
              await searchOptions.first().click();
              console.log('  ✅ Estudio seleccionado por búsqueda');
            }
          }
        } else {
          const reactSelectInput = page.locator('#react-select-4-input');
          if (await reactSelectInput.count() > 0) {
            await reactSelectInput.click();
            console.log('  ✅ Click en react-select-4-input');
            await page.waitForTimeout(1000);
            
            const options = page.locator('[role="option"]:visible');
            const optionCount = await options.count();
            console.log(`  📋 Dropdown abierto con ${optionCount} opciones`);
            
            if (optionCount > 0) {
              await options.first().click();
              console.log('  ✅ Estudio seleccionado');
            }
          } else {
            console.log('  ⚠️ Dropdown de solicitud no encontrado');
          }
        }
      } else {
        console.log('  ⚠️ Label "Solicitud" no encontrado');
      }
      
      console.log('  📝 Los estudios se guardarán al hacer clic en Continuar');
      
      console.log('  💾 Buscando botón guardar de laboratorios...');
      
      const guardarLabCount = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        let lastGuardar: HTMLButtonElement | null = null;
        buttons.forEach((btn: Element) => {
          if (btn.textContent?.trim().toLowerCase().includes('guardar cambios')) {
            lastGuardar = btn as HTMLButtonElement;
          }
        });
        if (lastGuardar) {
          lastGuardar.click();
          return 1;
        }
        return 0;
      });
      
      if (guardarLabCount > 0) {
        console.log('  ✅ Guardar cambios de laboratorios clickeado');
        await page.waitForTimeout(2000);
        
        await page.evaluate(() => {
          const modals = document.querySelectorAll('.swal2-confirm, .swal2-popup button');
          modals.forEach((btn: Element) => {
            if ((btn as HTMLElement).offsetParent !== null) btn.click();
          });
        });
        await page.waitForTimeout(1000);
      } else {
        console.log('  ⚠️ Botón guardar de laboratorios no encontrado');
      }
    } else if (tabName === 'Notas del Médico') {
      console.log('📋 Sección Notas del Médico: Sin tests...');
      await fillNotasMedicoSection(page);
    } else if (tabName === 'Servicios') {
      console.log('📋 Sección Servicios: Sin tests...');
      await fillServiciosSection(page);
    } else {
      await fillTabFields(page, tabName);
    }
    
    console.log(`💾 Buscando botón guardar/continuar en ${tabName}...`);
    
    const guardarSelectors = [
      page.getByRole('button', { name: /guardar y continuar/i }),
      page.getByRole('button', { name: /continuar/i }),
      page.getByRole('button', { name: /guardar/i }),
      page.locator('button:has-text("Siguiente")')
    ];
    
    for (const selector of guardarSelectors) {
      try {
        if (await selector.count() > 0 && await selector.first().isVisible()) {
          await selector.first().click();
          console.log(`✅ Click en guardar/continuar`);
          await page.waitForTimeout(1500);
          await page.waitForLoadState('networkidle');
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  console.log('\n🏁 === INICIANDO FINALIZACIÓN DE CONSULTA ===');
  await page.waitForTimeout(200);
  await page.waitForLoadState('networkidle');
  
  const finalizarBtn = await waitForFinalizarButton(page);
  
  if (finalizarBtn) {
    await handleModals(page);
    await finalizarBtn.click();
    await page.waitForTimeout(1000);
    
    const confirmBtn = page.locator('button:has-text("Confirmar"):visible, button:has-text("Aceptar"):visible, .swal2-confirm:visible');
    if (await confirmBtn.count() > 0) {
      await confirmBtn.first().click();
      console.log('✅ Confirmación clickeada');
    }
    
    await page.waitForTimeout(500);
    
    printGlobalValidationReport();
    
    await page.screenshot({ path: 'test-results/consultation-finalized.png', fullPage: true });
    console.log('\n🎉 === CONSULTA COMPLETADA EXITOSAMENTE ===');
  } else {
    throw new Error('No se encontró el botón de finalizar consulta');
  }
});
