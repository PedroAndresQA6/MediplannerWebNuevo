const { test, expect } = require('@playwright/test');
const { fillTabFields, checkNextDaysForIniciarButton, createAppointment, handleModals } = require('../e2e/utils.js');

// Funciones auxiliares
async function fillSpecificField(page, fieldName) {
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
                    fillValue = 'Paciente acude a consulta por cefalea persistente de 3 días de evolución, localizada en región frontal, de intensidad moderada, sin respuesta a analgésicos de venta libre.';
                  } else if (fieldLower.includes('padecimiento')) {
                    fillValue = 'Inicia padecimiento actual hace 3 días con cefalea frontal de tipo opresiva, intensidad 6/10 en escala visual análoga, acompañada de fotofobia leve. Niega fiebre, vómito o alteraciones neurológicas focales.';
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

async function waitForFinalizarButton(page) {
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

async function fillExplorationSection(page) {
  console.log('🔍 Iniciando llenado de la sección de Exploración...');
   
  try {
    await page.waitForTimeout(2000);
    
    // Lista de observaciones para llenar
    // Observaciones para Normal
    const observaciones = [
      'Sin signos de alarma',
      'Exploración normal',
      'Dentro de límites normales',
      'Sin alteraciones en la exploración',
      'Sin datos de enfermedad actual',
      'Paciente sin síntomas de alarma',
      'Exploración sin hallazgos significativos',
      'Revisión por sistemas sin particularidades',
      'Exploración sin hallazgos significativos. Sin datos de alarma.',
    ];
    
    // Primero: Llenar textareas generales de Exploración
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
            fillText = 'Apariencia general: Paciente bien nutrido, hidratado, consciente, orientado, sin facies de dolor, sin dificultad respiratoria.';
          } else if (placeholder.toLowerCase().includes('observacion')) {
            fillText = 'Observaciones: Sin hallazgos significativos durante la exploración.';
          }
          
          await textarea.fill(fillText);
          console.log(`✅ Textarea ${i+1} llenado`);
        }
      }
    }
    
    // Segundo: Encontrar y procesar checkboxes
    console.log('☑️ Iniciando procesamiento de checkboxes...');
    const allCheckboxes = page.locator('input[type="checkbox"]:not([disabled])');
    const totalCheckboxes = await allCheckboxes.count();
    console.log(`☑️ Encontrados ${totalCheckboxes} checkboxes en Exploración`);
    
    let processedCheckboxes = 0;
    
    for (let i = 0; i < totalCheckboxes; i++) {
      const checkbox = allCheckboxes.nth(i);
      
      try {
        try {
          const isVisible = await checkbox.isVisible({ timeout: 500 });
          if (!isVisible) continue;
        } catch (e) {
          continue;
        }
        
        let checkboxLabel = '';
        try {
          const label = checkbox.locator('xpath=../label | xpath=following-sibling::label | xpath=preceding-sibling::label').first();
          if (await label.count() > 0) {
            checkboxLabel = await label.textContent() || `Checkbox ${i+1}`;
          }
        } catch (e) {
          checkboxLabel = `Checkbox ${i+1}`;
        }
        checkboxLabel = checkboxLabel.trim().substring(0, 50);
        
        console.log(`\n📦 Procesando checkbox ${i+1}: "${checkboxLabel}"`);
        
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
        
        // Click en botón "Guardar cambios" cercano al textarea recién llenado
        await page.waitForTimeout(500);
        const guardarCercano = await page.evaluate(() => {
          // Buscar el textarea/input que acabamos de llenar (el último visible)
          const textareas = document.querySelectorAll('textarea:not([disabled])');
          const inputs = document.querySelectorAll('input[type="text"]:not([disabled])');
          const allFields = [...textareas, ...inputs].filter(el => el.offsetParent !== null);
          
          if (allFields.length === 0) return 0;
          const lastField = allFields[allFields.length - 1];
          
          // Buscar el botón "Guardar cambios" más cercano al campo llenado
          let parent = lastField.parentElement;
          let clicked = 0;
          
          for (let i = 0; i < 10 && parent; i++) {
            const btn = parent.querySelector('button');
            if (btn && btn.textContent.toLowerCase().includes('guardar')) {
              btn.click();
              clicked = 1;
              break;
            }
            parent = parent.parentElement;
          }
          
          // Si no se encontró uno cercano, buscar cualquier botón guardar visible
          if (!clicked) {
            const allBtns = document.querySelectorAll('button');
            allBtns.forEach(btn => {
              if (btn.textContent.toLowerCase().includes('guardar cambios') && btn.offsetParent !== null) {
                btn.click();
                clicked++;
              }
            });
          }
          
          return clicked;
        });
        
        if (guardarCercano > 0) {
          console.log(`   💾 Click en "Guardar cambios" después de observación`);
          await page.waitForTimeout(1500);
          
          // Cerrar modal si aparece
          await page.evaluate(() => {
            const modals = document.querySelectorAll('.swal2-confirm, .swal2-popup button');
            modals.forEach(btn => {
              if (btn.offsetParent !== null) btn.click();
            });
          });
          await page.waitForTimeout(500);
        }
        
        await page.waitForTimeout(300);
        processedCheckboxes++;
        
      } catch (error) {
        console.log(`   ⚠️ Error procesando checkbox ${i+1}: ${error.message.substring(0, 50)}...`);
        await page.waitForTimeout(500);
      }
    }
    
    console.log(`\n📊 Resumen: ${processedCheckboxes}/${totalCheckboxes} checkboxes procesados`);
    
    // GUARDAR: Click en TODOS los botones "Guardar cambios" via JavaScript
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
    
    // Cerrar modales que puedan aparecer
    await page.evaluate(() => {
      const modals = document.querySelectorAll('.swal2-confirm, .swal2-popup button');
      modals.forEach(btn => {
        if (btn.offsetParent !== null) btn.click();
      });
    });
    await page.waitForTimeout(1000);
    
    // Cambiar todos los radios de "Normal" a "Anormal"
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
    
    // Guardar después de cambiar a Anormal (mismo método que después de cada checkbox)
    console.log('💾 Guardando cambios de Anormal...');
    const guardarAnormal = await page.evaluate(() => {
      const textareas = document.querySelectorAll('textarea:not([disabled])');
      const inputs = document.querySelectorAll('input[type="text"]:not([disabled])');
      const allFields = [...textareas, ...inputs].filter(el => el.offsetParent !== null);
      
      if (allFields.length === 0) return 0;
      const lastField = allFields[allFields.length - 1];
      
      let parent = lastField.parentElement;
      let clicked = 0;
      
      for (let i = 0; i < 10 && parent; i++) {
        const btn = parent.querySelector('button');
        if (btn && btn.textContent.toLowerCase().includes('guardar')) {
          btn.click();
          clicked = 1;
          break;
        }
        parent = parent.parentElement;
      }
      
      if (!clicked) {
        const allBtns = document.querySelectorAll('button');
        allBtns.forEach(btn => {
          if (btn.textContent.toLowerCase().includes('guardar cambios') && btn.offsetParent !== null) {
            btn.click();
            clicked++;
          }
        });
      }
      
      return clicked;
    });
    
    if (guardarAnormal > 0) {
      console.log('💾 Click en "Guardar cambios" después de Anormal');
    } else {
      console.log('⚠️ No se encontró botón guardar después de Anormal');
    }
    await page.waitForTimeout(2000);
    
    // Cerrar modales
    await page.evaluate(() => {
      const modals = document.querySelectorAll('.swal2-confirm, .swal2-popup button');
      modals.forEach(btn => {
        if (btn.offsetParent !== null) btn.click();
      });
    });
    await page.waitForTimeout(1000);
    
    // Capturar estado final
    await page.screenshot({ path: 'test-results/exploration-final.png', fullPage: true });
    console.log('📸 Screenshot final guardado: exploration-final.png');
    
    // Guardar HTML final
    const fs = require('fs');
    const finalHtml = await page.content();
    fs.writeFileSync('test-results/exploration-final.html', finalHtml);
    console.log('📄 HTML final guardado');
    
    console.log('✅ Sección de Exploración completada');
    
  } catch (error) {
    console.log(`⚠️ Error en fillExplorationSection: ${error.message}`);
    await page.screenshot({ path: 'test-results/exploration-error.png', fullPage: true });
  }
}

async function fillDiagnosticoSection(page) {
  console.log('🩺 Iniciando llenado de la sección de Diagnóstico...');
  
  try {
    await page.waitForTimeout(500);
    
    // 1. PRIMERO: Dropdown CIE-10
    console.log('🔍 Buscando dropdown CIE-10...');
    
    const labelCIE10 = page.locator('label:has-text("CIE"), label:has-text("Código"), label:has-text("diagnóstico")').first();
    let cie10Input = null;
    
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
      // Hacer click en el SVG (ícono de flecha) en lugar del input
      const svgIcon = page.locator('svg.css-8mmkcg, svg[class*="css-"]').first();
      if (await svgIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
        await svgIcon.click();
        console.log('✅ Click en SVG del dropdown');
      } else {
        // Buscar SVG cerca del input
        const nearbySvg = cie10Input.locator('xpath=following-sibling::svg | xpath=../svg | xpath=..//svg').first();
        if (await nearbySvg.isVisible({ timeout: 500 }).catch(() => false)) {
          await nearbySvg.click();
          console.log('✅ Click en SVG cercano al input');
        } else {
          await cie10Input.click();
          console.log('✅ Click en input (SVG no encontrado)');
        }
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
        
        // Esperar a que el dropdown se cierre
        await page.waitForTimeout(500);
      }
    } else {
      console.log('⚠️ No se encontró dropdown CIE-10');
    }
    
    // Verificar si existe el input consultaInicial (readonly) como confirmación
    console.log('🔍 Verificando input consultaInicial...');
    const consultaInicial = page.locator('input[name="consultaInicial"][readonly]');
    if (await consultaInicial.count() > 0) {
      const value = await consultaInicial.inputValue();
      console.log(`✅ Input consultaInicial detectado con valor: "${value}" - continuando...`);
    } else {
      console.log('ℹ️ Input consultaInicial no encontrado, continuando de todos modos');
    }
    
    // 2. DESPUÉS: Llenar textareas de diagnóstico
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

async function fillTreatmentSection(page) {
  console.log('💊 Iniciando llenado de la sección de Tratamiento...');
  
  // PASO 1: Cerrar barra lateral
  console.log('📌 Cerrando barra lateral...');
  try {
    const sidebarToggle = page.locator('#sidebar_toggle');
    if (await sidebarToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sidebarToggle.click();
      console.log('✅ Barra lateral cerrada');
      await page.waitForTimeout(500);
    } else {
      console.log('ℹ️ Botón sidebar no encontrado, continuando...');
    }
  } catch (e) {
    console.log('⚠️ Error cerrando sidebar:', e.message.substring(0, 40));
  }
  
  try {
    await page.waitForTimeout(1000);
    
    // PASO 2: LLENAR INDICACIONES GENERALES (RSW editors)
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
          await page.keyboard.type('Indicaciones generales: Tomar medicamentos según prescripción médica. Mantener hidratación adecuada. Acudir a cita de control en caso de presentar algún síntoma adverso.');
          console.log(`✅ RSW editor ${i+1} llenado`);
        }
      }
    }
    console.log('✅ Indicaciones Generales completadas');
    await page.waitForTimeout(500);
    
    // PASO 3: Registrar medicamentos
    const vias = ['Cutánea', 'Inhalatoria', 'Intradérmica', 'Intramuscular', 'Intravenosa', 'Nasal', 'Ocular', 'Oral', 'Ótica', 'Rectal', 'Subcutánea', 'Sublingual', 'Transdérmica', 'Vaginal'];
    const cantidades = [20, 100, 200, 400, 600, 800];
    const unidades = ['miligramos', 'mililitros', 'gotas'];
    const frecuencias = ['8', '12'];
    const tiempos = ['día', 'semana', 'mes'];
    
    console.log('\n💊 Registrando medicamento 1: Paracetamol');
    await registrarMedicamento(page, 'Paracetamol', vias, cantidades, unidades, frecuencias, tiempos);
    
    console.log('\n💊 Registrando medicamento 2: Ibuprofeno');
    await registrarMedicamento(page, 'Ibuprofeno', vias, cantidades, unidades, frecuencias, tiempos);
    
    // PASO 4: Guardar medicamentos
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
    
    // PASO 5: Laboratorios y Procedimientos
    console.log('\n🔬 Iniciando Laboratorios y Procedimientos...');
    await fillLaboratoriosSection(page);
    
    // PASO 6: Guardar LABORATORIOS (buscar botón "Guardar cambios" en sección de Laboratorios)
    console.log('\n💾 Guardando Laboratorios...');
    await page.waitForTimeout(1000);
    
    const guardarLabCount = await page.evaluate(() => {
      // Buscar el label "Solicitud" que es único de la sección de Laboratorios
      const solicitudLabel = document.querySelector('label');
      let labSection = null;
      
      // Buscar el label que contiene "Solicitud"
      const allLabels = document.querySelectorAll('label');
      for (const label of allLabels) {
        if (label.textContent.trim().toLowerCase().includes('solicitud')) {
          // Navegar hacia arriba para encontrar el contenedor de la sección de Laboratorios
          let parent = label.parentElement;
          for (let i = 0; i < 15 && parent; i++) {
            const btn = parent.querySelector('button');
            if (btn && btn.textContent.trim().toLowerCase().includes('guardar cambios')) {
              labSection = btn;
              break;
            }
            parent = parent.parentElement;
          }
          break;
        }
      }
      
      if (labSection) {
        labSection.click();
        return 1;
      }
      
      // Fallback: buscar el ÚLTIMO botón "Guardar cambios" (el de laboratorios)
      const buttons = document.querySelectorAll('button');
      let lastGuardar = null;
      buttons.forEach(btn => {
        if (btn.textContent.trim().toLowerCase().includes('guardar cambios')) {
          lastGuardar = btn;
        }
      });
      
      if (lastGuardar) {
        lastGuardar.click();
        return 1;
      }
      
      return 0;
    });
    
    if (guardarLabCount > 0) {
      console.log('💾 Click en "Guardar cambios" de Laboratorios');
      await page.waitForTimeout(2000);
      
      // Cerrar modales
      await page.evaluate(() => {
        const modals = document.querySelectorAll('.swal2-confirm, .swal2-popup button');
        modals.forEach(btn => {
          if (btn.offsetParent !== null) btn.click();
        });
      });
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠️ No se encontró botón de guardar en Laboratorios');
    }
    
    console.log('\n✅ Sección de Tratamiento completada');
  } catch (error) {
    console.log(`⚠️ Error en fillTreatmentSection: ${error.message}`);
  }
}

async function fillNotasMedicoSection(page) {
  console.log('📋 Llenando sección de Notas del Médico...');
  
  try {
    await page.waitForTimeout(1000);
    
    // RSW editors (contenteditable)
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
          await page.keyboard.type('Notas del médico: Paciente en seguimiento. Estado de salud favorable. Se continúa con tratamiento indicado. Próxima cita según evolución clínica.');
          console.log(`✅ RSW editor ${i+1} llenado`);
        }
      }
    }
    
    // Contenido editable suelto (sin RSW)
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
          await page.keyboard.type('Notas del médico: Seguimiento de evolución clínica favorable. Paciente responde adecuadamente al tratamiento.');
          console.log(`✅ Contenteditable ${i+1} llenado`);
        }
      }
    }
    
    // Textareas normales
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
    
    // Inputs de texto
    const inputs = page.locator('input[type="text"]:not([disabled]):not([readonly])');
    const inputCount = await inputs.count();
    console.log(`📝 Encontrados ${inputCount} inputs en Notas del Médico`);
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible().catch(() => false)) {
        const currentValue = await input.inputValue().catch(() => '');
        if (!currentValue || currentValue.trim() === '') {
          await input.fill('N/A');
          console.log(`✅ Input ${i+1} llenado`);
        }
      }
    }
    
    // Selects
    const selects = page.locator('select:not([disabled])');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      if (await select.isVisible().catch(() => false)) {
        const options = await select.locator('option').count();
        if (options > 1) {
          const currentValue = await select.inputValue().catch(() => '');
          if (!currentValue || currentValue.includes('Seleccione')) {
            await select.selectOption({ index: 1 });
            console.log(`✅ Select ${i+1} seleccionado`);
          }
        }
      }
    }
    
    console.log('✅ Notas del Médico completadas');
    await page.waitForTimeout(500);
    
  } catch (error) {
    console.log(`⚠️ Error en Notas del Médico: ${error.message}`);
  }
}

async function fillServiciosSection(page) {
  console.log('🏥 Llenando sección de Servicios...');
  
  try {
    await page.waitForTimeout(1000);
    
    // 1. MANEJAR DROPDOWNS (tipo CIE-10)
    console.log('🔍 Buscando dropdowns en Servicios...');
    
    const dropdownLabels = ['servicio', 'tipo', 'concepto', 'clasificación'];
    
    for (const labelText of dropdownLabels) {
      const labelDropdown = page.locator(`label:has-text("${labelText}"), span:has-text("${labelText}"), div:has-text("${labelText}")`).first();
      
      if (await labelDropdown.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`✅ Label "${labelText}" encontrado`);
        
        // Buscar input/combobox cerca del label
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
          // Click en SVG o en el input
          const svgIcon = page.locator('svg.css-8mmkcg, svg[class*="css-"]').first();
          if (await svgIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
            await svgIcon.click();
            console.log('✅ Click en SVG del dropdown');
          } else {
            const nearbySvg = dropdownInput.locator('xpath=following-sibling::svg | xpath=../svg | xpath=..//svg').first();
            if (await nearbySvg.isVisible({ timeout: 500 }).catch(() => false)) {
              await nearbySvg.click();
              console.log('✅ Click en SVG cercano');
            } else {
              await dropdownInput.click();
              console.log('✅ Click en input dropdown');
            }
          }
          await page.waitForTimeout(800);
          
          // Buscar opción específica "Certificado Médico" o aleatoria
          const options = page.locator('[role="option"]:visible, .dropdown-item:visible, li:visible, ul li:visible');
          const optionCount = await options.count();
          console.log(`📋 Dropdown abierto con ${optionCount} opciones`);
          
          if (optionCount > 0) {
            // Buscar "Certificado Médico" primero
            let certificadoOption = null;
            for (let j = 0; j < optionCount; j++) {
              const optionText = await options.nth(j).textContent().catch(() => '');
              if (optionText.toLowerCase().includes('certificado') && optionText.toLowerCase().includes('médico')) {
                certificadoOption = options.nth(j);
                console.log(`✅ Certificado Médico encontrado en índice ${j}`);
                break;
              }
            }
            
            // Si no se encuentra, usar aleatorio
            if (!certificadoOption) {
              const randomIndex = Math.floor(Math.random() * Math.min(optionCount, 10));
              certificadoOption = options.nth(randomIndex);
              const optionText = await certificadoOption.textContent().catch(() => 'Opción');
              console.log(`ℹ️ Certificado Médico no encontrado, usando: "${optionText.trim().substring(0, 40)}..."`);
            }
            
            await certificadoOption.click();
            console.log(`✅ Opción seleccionada`);
            await page.waitForTimeout(500);
          }
        }
      }
    }
    
    // RSW editors (contenteditable)
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
          await page.keyboard.type('Servicio proporcionado según protocolo médico. Evaluación completa realizada durante la consulta.');
          console.log(`✅ RSW editor ${i+1} llenado`);
        }
      }
    }
    
    // Contenido editable suelto
    const contentEditable = page.locator('[contenteditable="true"]:not([style*="display: none"]):not([style*="display:none"])');
    const ceCount = await contentEditable.count();
    console.log(`📝 Encontrados ${ceCount} contenteditable en Servicios`);
    
    for (let i = 0; i < ceCount; i++) {
      const el = contentEditable.nth(i);
      if (await el.isVisible().catch(() => false)) {
        const currentText = await el.textContent().catch(() => '');
        if (!currentText || currentText.trim() === '') {
          await el.click();
          await page.waitForTimeout(200);
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.type('Servicio médico: Consulta de seguimiento completada exitosamente.');
          console.log(`✅ Contenteditable ${i+1} llenado`);
        }
      }
    }
    
    // Textareas normales
    const textareas = page.locator('textarea:not([disabled]):not([readonly])');
    const taCount = await textareas.count();
    console.log(`📝 Encontradas ${taCount} textareas en Servicios`);
    
    for (let i = 0; i < taCount; i++) {
      const textarea = textareas.nth(i);
      if (await textarea.isVisible().catch(() => false) && await textarea.isEnabled().catch(() => false)) {
        const currentValue = await textarea.inputValue().catch(() => '');
        if (!currentValue || currentValue.trim() === '') {
          await textarea.click();
          await page.waitForTimeout(100);
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.type('Servicio proporcionado exitosamente durante la consulta médica.');
          console.log(`✅ Textarea ${i+1} llenada`);
        }
      }
    }
    
    // Buscar dropdown de servicio, abrirlo y seleccionar "Certificado Médico"
    console.log('🔍 Abriendo dropdown de servicio...');
    try {
      const comboboxInputs = page.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible');
      const cbCount = await comboboxInputs.count();
      console.log(`📋 Encontrados ${cbCount} inputs de dropdown en Servicios`);

      if (cbCount > 0) {
        const dropdownInput = comboboxInputs.first();
        // Solo hacer click para abrir el dropdown, sin escribir nada
        await dropdownInput.click();
        await page.waitForTimeout(500);
        // Hacer click en el SVG (flecha) si existe para asegurar que se abre
        const svgIcon = page.locator('svg.css-8mmkcg, svg[class*="css-"]').first();
        if (await svgIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
          await svgIcon.click();
        }
        await page.waitForTimeout(1500);
        console.log('✅ Dropdown abierto');

        // Buscar opciones del dropdown (solo dentro del menú del dropdown, no el menú lateral)
        const dropdownMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
        const options = dropdownMenu.locator('[class*="option"], [role="option"]');
        let optionCount = await options.count();
        console.log(`📋 ${optionCount} opciones disponibles`);

        // Si no hay opciones, esperar y reintentar
        if (optionCount === 0) {
          await page.waitForTimeout(2000);
          optionCount = await options.count();
          console.log(`📋 ${optionCount} opciones (reintento)`);
        }

        // Buscar "Certificado Médico" entre las opciones visibles
        let certificadoSelected = false;
        for (let j = 0; j < optionCount; j++) {
          const option = options.nth(j);
          if (await option.isVisible({ timeout: 300 }).catch(() => false)) {
            const optionText = (await option.textContent().catch(() => '')).trim();
            // Loggear primeras 10 opciones para debug
            if (j < 10) console.log(`   Opción ${j}: "${optionText.substring(0, 60)}"`);
            if (optionText.toLowerCase().includes('certificado')) {
              await option.click();
              console.log(`✅ Seleccionado: "${optionText.substring(0, 60)}..."`);
              certificadoSelected = true;
              break;
            }
          }
        }

        if (!certificadoSelected) {
          console.log('⚠️ No se encontró Certificado Médico en las opciones');
        }

        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('⚠️ Error con dropdown de certificado:', e.message.substring(0, 50));
    }

    // Click en botón "Guardar servicios"
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

          // Cerrar modal si aparece
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

async function fillLaboratoriosSection(page) {
  console.log('🔬 Llenando sección de Laboratorios y Procedimientos...');
  
  try {
    await page.waitForTimeout(1000);
    
    // 1. LLENAR INDICACIONES DE LABORATORIOS (rsw-editor)
    console.log('📝 Llenando indicaciones de laboratorios...');
    try {
      // Esperar a que el editor esté listo
      await page.waitForSelector('div.rsw-editor', { timeout: 3000 }).catch(() => {});
      
      // Buscar el editor de indicacionesLab
      const indicacionesLab = page.locator('div.rsw-editor div[name="indicacionesLab"], #indicacionesLab');
      
      if (await indicacionesLab.count() > 0) {
        // Esperar a que sea visible
        await indicacionesLab.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        
        // Hacer click para enfocar y luego escribir
        await indicacionesLab.first().click();
        await page.waitForTimeout(300);
        
        // Usar keyboard para escribir en contenteditable
        await page.keyboard.type('Solicitar estudios de laboratorio según indicación clínica. Hemograma completo, química sanguínea, perfil hepático.');
        console.log('✅ Indicaciones de laboratorios llenadas');
      } else {
        console.log('⚠️ Editor de indicacionesLab no encontrado');
      }
    } catch (e) {
      console.log('⚠️ Error llenando indicaciones lab:', e.message.substring(0, 50));
    }
    await page.waitForTimeout(500);
    
    // 2. SELECCIONAR ESTUDIO/PROCEDIMIENTO DEL DROPDOWN
    console.log('🔬 Buscando dropdown de solicitud...');
    try {
      // Buscar el label "Solicitud" y luego el dropdown cerca de él
      const solicitudLabel = page.locator('label:has-text("Solicitud")');
      const labelCount = await solicitudLabel.count();
      
      if (labelCount > 0) {
        console.log(`📋 Label "Solicitud" encontrado (${labelCount})`);
        
        // Buscar el container de react-select cerca del label
        // El container está en el mismo div que el label
        const solicitudInput = page.locator('label:has-text("Solicitud") ~ div input[role="combobox"], label:has-text("Solicitud") + div input[role="combobox"]');
        
        if (await solicitudInput.count() > 0 && await solicitudInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          // Hacer click en el input
          await solicitudInput.first().click();
          console.log('✅ Click en input de solicitud');
          
          await page.waitForTimeout(1000);
          
          // Buscar y seleccionar una opción
          const options = page.locator('[role="option"]:visible');
          const optionCount = await options.count();
          console.log(`📋 Dropdown de solicitud abierto con ${optionCount} opciones`);
          
          if (optionCount > 0) {
            const randomIndex = Math.floor(Math.random() * Math.min(optionCount, 10));
            const optionText = await options.nth(randomIndex).textContent().catch(() => 'Estudio');
            await options.nth(randomIndex).click();
            console.log(`✅ Estudio seleccionado: "${optionText.trim().substring(0, 40)}..."`);
          } else {
            // Intentar escribir para buscar
            await solicitudInput.first().type('Biometría', { delay: 80 });
            await page.waitForTimeout(1000);
            
            const searchOptions = page.locator('[role="option"]:visible');
            const searchCount = await searchOptions.count();
            
            if (searchCount > 0) {
              await searchOptions.first().click();
              console.log('✅ Estudio seleccionado por búsqueda');
            } else {
              console.log('⚠️ No se encontraron opciones en el dropdown');
            }
          }
        } else {
          // Buscar por ID react-select-4-input
          const reactSelectInput = page.locator('#react-select-4-input');
          if (await reactSelectInput.count() > 0) {
            await reactSelectInput.click();
            console.log('✅ Click en react-select-4-input');
            await page.waitForTimeout(1000);
            
            const options = page.locator('[role="option"]:visible');
            const optionCount = await options.count();
            console.log(`📋 Dropdown abierto con ${optionCount} opciones`);
            
            if (optionCount > 0) {
              await options.first().click();
              console.log('✅ Estudio seleccionado');
            }
          } else {
            console.log('⚠️ Dropdown de solicitud no encontrado');
          }
        }
      } else {
        console.log('⚠️ Label "Solicitud" no encontrado');
      }
    } catch (e) {
      console.log('⚠️ Error con dropdown solicitud:', e.message.substring(0, 50));
    }
    await page.waitForTimeout(500);
    
    console.log('✅ Laboratorios y Procedimientos registrados (se guardarán al final)');
    
  } catch (error) {
    console.log('⚠️ Error en fillLaboratoriosSection:', error.message.substring(0, 60));
  }
}

async function registrarMedicamento(page, nombreMedicamento, vias, cantidades, unidades, frecuencias, tiempos) {
  // Seleccionar valor aleatorio
  const via = vias[Math.floor(Math.random() * vias.length)];
  const cantidad = cantidades[Math.floor(Math.random() * cantidades.length)];
  const unidad = unidades[Math.floor(Math.random() * unidades.length)];
  const frecuencia = frecuencias[Math.floor(Math.random() * frecuencias.length)];
  const tiempo = tiempos[Math.floor(Math.random() * tiempos.length)];
  
  console.log(`   📋 Vía: ${via}, Cantidad: ${cantidad}, Unidad: ${unidad}`);
  console.log(`   📋 Frecuencia: ${frecuencia}h, Duración: 10, Tiempo: ${tiempo}`);
  
  // Buscar input de medicamento - buscar el primero que esté vacío
  console.log(`   🔍 Buscando input para "${nombreMedicamento}"...`);
  const allMedicInputs = page.locator('input[placeholder*="medic" i]:visible, input[placeholder*="Medicamento"]:visible, input[autocomplete="off"]:visible');
  const inputCount = await allMedicInputs.count();
  console.log(`   📋 Encontrados ${inputCount} inputs de medicamentos`);
  
  let medicamentoInput = null;
  for (let i = 0; i < inputCount; i++) {
    const input = allMedicInputs.nth(i);
    const value = await input.inputValue();
    if (!value || value.trim() === '') {
      medicamentoInput = input;
      console.log(`   📋 Usando input ${i+1} (vacío)`);
      break;
    }
  }
  
  // Si no hay inputs vacíos, usar el primero
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
    
    // Seleccionar del dropdown
    const option = page.locator('[role="option"]:visible, .dropdown-item:visible, li:visible').first();
    if (await option.count() > 0) {
      await option.click();
      console.log(`   ✅ Medicamento "${nombreMedicamento}" seleccionado`);
    } else {
      await medicamentoInput.press('Enter');
      console.log(`   ✅ Medicamento "${nombreMedicamento}" ingresado`);
    }
    
    // Esperar a que aparezcan los campos del formulario
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
  }
  
  // SELECCIONAR VÍA DE ADMINISTRACIÓN
  console.log('   📍 Seleccionando vía: ' + via + '...');
  try {
    // Buscar el primer select visible que no esté deshabilitado
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
  
  // INGRESAR CANTIDAD (Tomar)
  console.log('   🔢 Ingresando cantidad: ' + cantidad + '...');
  try {
    // Buscar input number que esté vacío o disponible
    const numberInputs = page.locator('input[type="number"]:visible:not([disabled])');
    const numCount = await numberInputs.count();
    
    if (numCount > 0) {
      const cantidadInput = numberInputs.first();
      await cantidadInput.click({ clickCount: 3 });
      await page.waitForTimeout(100);
      await cantidadInput.type(cantidad.toString(), { delay: 30 });
      console.log(`   ✅ Cantidad ingresada: ${cantidad}`);
    } else {
      console.log(`   ⚠️ No hay inputs number visibles`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error cantidad: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  // SELECCIONAR UNIDAD
  console.log('   📏 Seleccionando unidad: ' + unidad + '...');
  try {
    // Buscar el segundo select visible (el primero es vía)
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
    } else {
      console.log(`   ⚠️ No hay suficientes selects`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error unidad: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  // INGRESAR FRECUENCIA (cada cuánto tiempo)
  console.log('   ⏰ Ingresando frecuencia: cada ' + frecuencia + ' horas...');
  try {
    // Buscar input number que esté vacío (después de cantidad, el siguiente vacío es frecuencia)
    const numberInputs = page.locator('input[type="number"]:visible:not([disabled])');
    const numCount = await numberInputs.count();
    
    let frecuenciaInput = null;
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
    } else {
      console.log(`   ⚠️ No se encontró input para frecuencia`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error frecuencia: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  // INGRESAR DURACIÓN (tiempo_cantidad) - Valor fijo: 10
  console.log('   📅 Ingresando duración: 10...');
  try {
    // Buscar el tercer input number o el que tenga name tiempo_cantidad
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
    } else {
      console.log(`   ⚠️ Campo duración no encontrado`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error duración: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  // SELECCIONAR TIEMPO (días/semanas/mes)
  console.log('   📆 Seleccionando unidad de tiempo: ' + tiempo + '...');
  try {
    // Buscar el tercer select visible (vía, unidad, tiempo)
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
    } else {
      console.log(`   ⚠️ No hay suficientes selects`);
    }
  } catch (e) {
    console.log(`   ⚠️ Error tiempo: ${e.message.substring(0, 40)}`);
  }
  await page.waitForTimeout(200);
  
  // LLENAR INDICACIONES DEL MEDICAMENTO
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

// Test principal
test('Start a scheduled consultation from Inicio', async ({ page }) => {
  test.setTimeout(300000); // 5 minutos de timeout
  
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
  
  // Seleccionar la cita más temprana
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
    
  console.log('💉 Llenando signos vitales...');
  await page.locator('input[name="peso"]').fill('70');
  
  const tallaInput = page.locator('input[name*="talla" i]');
  if (await tallaInput.count() > 0) await tallaInput.first().fill('170');
  
  const presionInput = page.locator('input[placeholder="000/00 mmHg"]');
  if (await presionInput.isVisible().catch(() => false)) await presionInput.fill('120/80');
  
  const tempInput = page.locator('input[name*="temp" i]');
  if (await tempInput.count() > 0) await tempInput.first().fill('36.6');
  
  const fcInput = page.locator('input[name*="card" i]');
  if (await fcInput.count() > 0) await fcInput.first().fill('72');
  
  const satInput = page.locator('input[name="oxigenacion"]');
  if (await satInput.count() > 0) await satInput.first().fill('98');
  
  const frInput = page.locator('input[name="frecuenciaRespiratoria"]');
  if (await frInput.count() > 0) await frInput.first().fill('16');
  
  const glucosaInput = page.locator('input[name="glucosa"]');
  if (await glucosaInput.count() > 0) await glucosaInput.first().fill('95');
  
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
  
  // Esperar a que la página cargue completamente (desaparezca "Cargando información...")
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

  // Procesar cada pestaña
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
    
    // Buscar la pestaña
    const tabSelectors = [
      page.getByRole('tab', { name: new RegExp(`^${tabName}$`, 'i') }),
      page.getByRole('button', { name: new RegExp(`^${tabName}$`, 'i') }),
      page.locator(`div, span, p, li, a:has-text("${tabName}")`)
    ];
    
    let tabElement = null;
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
    
    // Manejar modales antes de hacer clic
    await handleModals(page);
    await page.waitForTimeout(500);
    
    await tabElement.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Llenar campos específicos si existen
    if (requiredFields.length > 0) {
      console.log(`🎯 Llenando campos específicos para ${tabName}`);
      for (const fieldName of requiredFields) {
        await fillSpecificField(page, fieldName);
      }
    }
    
    // Llenar según la pestaña
    if (tabName === 'Exploración') {
      await fillExplorationSection(page);
    } else if (tabName === 'Diagnóstico') {
      await fillDiagnosticoSection(page);
    } else if (tabName === 'Tratamiento') {
      await fillTreatmentSection(page);
    } else if (tabName === 'Notas del Médico') {
      await fillNotasMedicoSection(page);
    } else if (tabName === 'Servicios') {
      await fillServiciosSection(page);
    } else {
      await fillTabFields(page, tabName);
    }
    
    // Buscar y hacer clic en continuar/guardar
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

  // FINALIZACIÓN
  console.log('\n🏁 === INICIANDO FINALIZACIÓN DE CONSULTA ===');
  await page.waitForTimeout(200);
  await page.waitForLoadState('networkidle');
  
  const finalizarBtn = await waitForFinalizarButton(page);
  
  if (finalizarBtn) {
    await handleModals(page);
    await finalizarBtn.click();
    await page.waitForTimeout(1000);
    
    // Confirmar si hay modal
    const confirmBtn = page.locator('button:has-text("Confirmar"):visible, button:has-text("Aceptar"):visible, .swal2-confirm:visible');
    if (await confirmBtn.count() > 0) {
      await confirmBtn.first().click();
      console.log('✅ Confirmación clickeada');
    }
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/consultation-finalized.png', fullPage: true });
    console.log('\n🎉 === CONSULTA COMPLETADA EXITOSAMENTE ===');
  } else {
    throw new Error('No se encontró el botón de finalizar consulta');
  }
});
