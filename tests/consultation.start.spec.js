const { test, expect } = require('@playwright/test');
const { fillTabFields, checkNextDaysForIniciarButton, createAppointment, handleModals, setupConsoleMonitor } = require('../e2e/utils.js');

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

    function pickRandom(arr, n) {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n);
    }

    const firstGroup = Array.from({ length: Math.min(8, totalCheckboxes) }, (_, i) => i);
    const secondGroup = Array.from({ length: Math.max(0, totalCheckboxes - 8) }, (_, i) => i + 8);
    const selected = [
      ...pickRandom(firstGroup, Math.min(3, firstGroup.length)),
      ...pickRandom(secondGroup, Math.min(3, secondGroup.length))
    ].sort((a, b) => a - b);

    console.log(`📋 Checkboxes seleccionados: ${selected.map(i => i + 1).join(', ')} (${selected.length} total)`);

    for (const i of selected) {
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
        
        const estadoDeseado = Math.random() < 0.5 ? 'Normal' : 'Anormal';
        console.log(`   🎲 Seleccionando "${estadoDeseado}" (siguiente sibling)...`);
        const seleccionado = await page.evaluate((estado) => {
          const textareas = document.querySelectorAll('textarea:not([disabled])');
          const inputs = document.querySelectorAll('input[type="text"]:not([disabled])');
          const allFields = [...textareas, ...inputs].filter(el => el.offsetParent !== null);
          if (allFields.length === 0) return false;

          const lastField = allFields[allFields.length - 1];
          const textareaContainer = lastField.parentElement;
          const radioContainer = textareaContainer.previousElementSibling;

          if (!radioContainer) return false;

          const labels = radioContainer.querySelectorAll('label');
          for (const label of labels) {
            if (label.textContent.trim().toLowerCase() === estado.toLowerCase() && label.getAttribute('for')) {
              const radio = document.getElementById(label.getAttribute('for'));
              if (radio) {
                radio.click();
                return true;
              }
            }
          }
          return false;
        }, estadoDeseado);

        if (seleccionado) {
          console.log(`   ✅ "${estadoDeseado}" seleccionado`);
        } else {
          console.log(`   ⚠️ No se pudo seleccionar "${estadoDeseado}"`);
        }
        await page.waitForTimeout(500);
        
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
      cie10Input = labelCIE10.locator('xpath=following::textarea[1] | xpath=following::input[1] | xpath=../textarea | xpath=../input | xpath=..//textarea | xpath=..//input').first();
    }
    
    if (!cie10Input || !await cie10Input.isVisible().catch(() => false)) {
      const selectors = [
        'textarea[role="combobox"]',
        '#react-select-5-input',
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
      await cie10Input.click();
      console.log('✅ Click en input CIE-10');
      await page.waitForTimeout(800);
      
      const options = page.locator('[role="option"]:visible, .dropdown-item:visible, div[id*="option"]:visible');
      let optionCount = await options.count();
      console.log(`📋 Dropdown abierto con ${optionCount} opciones`);
      
      if (optionCount === 0) {
        await cie10Input.fill('A09');
        await page.waitForTimeout(1500);
        const searchedOptions = page.locator('[role="option"]:visible, .dropdown-item:visible, div[id*="option"]:visible');
        optionCount = await searchedOptions.count();
        console.log(`📋 Opciones después de búsqueda: ${optionCount}`);
        if (optionCount > 0) {
          const optionText = await searchedOptions.first().textContent().catch(() => 'Opción');
          await searchedOptions.first().click();
          console.log(`✅ Diagnóstico CIE-10 seleccionado: "${optionText.trim().substring(0, 40)}..."`);
          await page.waitForTimeout(500);
        }
      } else if (optionCount > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(optionCount, 10));
        const optionText = await options.nth(randomIndex).textContent().catch(() => 'Opción');
        await options.nth(randomIndex).click();
        console.log(`✅ Diagnóstico CIE-10 seleccionado: "${optionText.trim().substring(0, 40)}..."`);
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
  let guardarTreatmentClicked = false;
  let guardarLabClicked = false;
  
  try {
    await page.waitForTimeout(1000);
    
    // PASO 1: LLENAR INDICACIONES GENERALES (Jodit editor)
    console.log('📋 Llenando Indicaciones Generales...');
    const joditEditors = page.locator('div.jodit-wysiwyg');
    const joditCount = await joditEditors.count();
    console.log(`📝 Encontrados ${joditCount} Jodit editors`);
    
    if (joditCount > 0) {
      const editor = joditEditors.first();
      if (await editor.isVisible().catch(() => false)) {
        await editor.click();
        await page.waitForTimeout(200);
        await page.keyboard.press('Control+A');
        await page.waitForTimeout(100);
        await page.keyboard.type('Indicaciones generales: Tomar medicamentos según prescripción médica. Mantener hidratación adecuada.');
        console.log('✅ Indicaciones generales llenadas');
      }
    }
    await page.waitForTimeout(500);
    
    // PASO 2: REGISTRAR 1 MEDICAMENTO VÍA REACT-SELECT (solo llenar, NO guardar)
    console.log('\n💊 Registrando medicamento...');
    const medicamentoSelect = page.locator('#react-select-2-input');
    if (await medicamentoSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await medicamentoSelect.click();
      await page.waitForTimeout(300);
      await medicamentoSelect.fill('Paracetamol');
      console.log('   🔍 Buscando opciones de medicamento...');
      
      let optionClicked = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        await page.waitForTimeout(1000);
        const option = page.locator('[role="option"]:visible, div[id*="option"]:visible').first();
        const optionCount = await option.count().catch(() => 0);
        if (optionCount > 0) {
          const text = await option.textContent().catch(() => '');
          await option.click();
          console.log(`   ✅ Medicamento seleccionado: "${(text || '').trim().substring(0, 40)}"`);
          optionClicked = true;
          break;
        }
        console.log(`   ⏳ Intento ${attempt + 1}/5: esperando opciones...`);
      }
      if (!optionClicked) {
        console.log('   ⚠️ No aparecieron opciones de medicamento, continuando...');
      }
      await page.waitForTimeout(1000);
      await page.waitForLoadState('networkidle');
      
      // Llenar formulario del medicamento
      const viaSelect = page.locator('select[name="iViaAdministracionId-0"]');
      if (await viaSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await viaSelect.selectOption({ index: 1 });
        console.log('✅ Vía seleccionada');
      }
      
      const dosisInput = page.locator('input[name="dosis_cantidad"]');
      if (await dosisInput.isVisible().catch(() => false)) {
        await dosisInput.fill('1');
        console.log('✅ Dosis ingresada');
      }
      
      const unidadSelect = page.locator('select[name="unidad_dosis_id-0"]');
      if (await unidadSelect.isVisible().catch(() => false)) {
        await unidadSelect.selectOption({ index: 1 });
        console.log('✅ Unidad seleccionada');
      }
      
      const frecuenciaInput = page.locator('input[name="frecuencia_cantidad"]');
      if (await frecuenciaInput.isVisible().catch(() => false)) {
        await frecuenciaInput.fill('8');
        console.log('✅ Frecuencia ingresada');
      }
      
      const duracionInput = page.locator('input[name="tiempo_cantidad"]');
      if (await duracionInput.isVisible().catch(() => false)) {
        await duracionInput.fill('10');
        console.log('✅ Duración ingresada');
      }
      
      const tiempoSelect = page.locator('select[name="unidad_tiempo_id-0"]');
      if (await tiempoSelect.isVisible().catch(() => false)) {
        await tiempoSelect.selectOption({ index: 1 });
        console.log('✅ Tiempo seleccionado');
      }
      
      const indicacionesInput = page.locator('input[name="indicaciones-0"]');
      if (await indicacionesInput.isVisible().catch(() => false)) {
        await indicacionesInput.fill('Indicaciones estándar');
        console.log('✅ Indicaciones del medicamento ingresadas');
      }
    }
    
    // PASO 3: AGREGA TRATAMIENTO DIFERENTE (con nombre + indicaciones)
    console.log('\n➕ Agregando tratamiento diferente...');
    const agregarBtn = page.locator('button:has-text("Agrega tratamiendo diferente")');
    if (await agregarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await agregarBtn.click();
      await page.waitForTimeout(1000);
      
      const otrosContainer = page.locator('label:has-text("Otros medicamentos")').locator('..').locator('..');
      
      // Nombre del otro medicamento
      const nombreInput = otrosContainer.locator('input[maxlength="240"]');
      if (await nombreInput.isVisible().catch(() => false)) {
        await nombreInput.fill('Ácido fólico');
        console.log('✅ Nombre tratamiento diferente ingresado');
      }
      
      // Segundo apartado de indicaciones
      let indicacionesLlenado = false;
      const indicacionesSelectors = [
        otrosContainer.locator('textarea:visible'),
        otrosContainer.locator('input[maxlength="700"]'),
        otrosContainer.locator('input[placeholder*="indicacion" i]'),
        otrosContainer.locator('textarea[placeholder*="indicacion" i]'),
        page.locator('textarea:visible').last()
      ];
      
      for (const sel of indicacionesSelectors) {
        if (await sel.count().catch(() => 0) > 0 && await sel.first().isVisible().catch(() => false)) {
          await sel.first().fill('Tomar 1 tableta cada 24 horas');
          console.log('✅ Indicaciones tratamiento diferente ingresadas');
          indicacionesLlenado = true;
          break;
        }
      }
      if (!indicacionesLlenado) {
        console.log('   ⚠️ No se encontró campo de indicaciones para tratamiento diferente');
      }
      
      // GUARDAR TRATAMIENTO (type="submit") - último paso antes de laboratorios
      await page.waitForTimeout(500);
      const guardarTreatment = page.locator('button[type="submit"]:has-text("Guardar cambios")');
      if (await guardarTreatment.isVisible({ timeout: 3000 }).catch(() => false)) {
        await guardarTreatment.click();
        console.log('✅ Tratamiento guardado (type="submit")');
        guardarTreatmentClicked = true;
        await page.waitForTimeout(2000);
        const modal = page.locator('.swal2-confirm:visible');
        if (await modal.count() > 0) {
          await modal.first().click();
          await page.waitForTimeout(500);
        }
      } else {
        console.log('   ⚠️ No se encontró botón Guardar type="submit"');
        // Fallback: buscar cualquier botón "Guardar cambios"
        const fallbackBtn = page.locator('button:has-text("Guardar cambios")').first();
        if (await fallbackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await fallbackBtn.click();
          console.log('✅ Guardar clickeado (fallback)');
          guardarTreatmentClicked = true;
          await page.waitForTimeout(2000);
        }
      }
    }
    await page.waitForTimeout(500);
    
    // PASO 4: LABORATORIOS Y PROCEDIMIENTOS
    console.log('\n🔬 Laboratorios y Procedimientos...');
    
    if (joditCount > 1) {
      const labEditor = joditEditors.nth(1);
      if (await labEditor.isVisible().catch(() => false)) {
        await labEditor.click();
        await page.waitForTimeout(200);
        await page.keyboard.press('Control+A');
        await page.waitForTimeout(100);
        await page.keyboard.type('Solicitar estudios de laboratorio de rutina');
        console.log('✅ Indicaciones de laboratorio llenadas');
      }
    }
    await page.waitForTimeout(500);
    
    const labSelect = page.locator('#react-select-3-input');
    if (await labSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labSelect.click();
      await page.waitForTimeout(300);
      await labSelect.fill('Biometría');
      console.log('   🔍 Buscando opciones de laboratorio...');

      let labOptionClicked = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        await page.waitForTimeout(1000);
        const labOption = page.locator('[role="option"]:visible, div[id*="option"]:visible').first();
        const optionCount = await labOption.count().catch(() => 0);
        if (optionCount > 0) {
          const text = await labOption.textContent().catch(() => '');
          await labOption.click();
          console.log(`   ✅ Laboratorio seleccionado: "${(text || '').trim().substring(0, 40)}"`);
          labOptionClicked = true;
          break;
        }
        console.log(`   ⏳ Intento ${attempt + 1}/5: esperando opciones de laboratorio...`);
      }
      if (!labOptionClicked) {
        console.log('   ⚠️ No aparecieron opciones de laboratorio, continuando...');
      }
      await page.waitForTimeout(1000);
    }
    
    const procedimientoInput = page.locator('textarea[name="procedimiento-0"]');
    if (await procedimientoInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await procedimientoInput.fill('Biometría hemática completa');
      console.log('✅ Procedimiento llenado');
    }
    
    // GUARDAR LABORATORIOS - scroll y buscar
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    let guardarFound = false;
    const labGuardarSelectors = [
      'button[type="button"]:has-text("Guardar cambios")',
      'button:has-text("Guardar cambios")',
      'button.btn.btn-primary.mt-5:has-text("Guardar cambios")'
    ];
    
    for (const sel of labGuardarSelectors) {
      const btn = page.locator(sel);
      const count = await btn.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        if (await btn.nth(i).isVisible({ timeout: 1000 }).catch(() => false)) {
          const btnType = await btn.nth(i).getAttribute('type').catch(() => 'sin-type');
          await btn.nth(i).click();
          console.log(`✅ Laboratorios guardados (selector: "${sel}", #${i}, type="${btnType}")`);
          guardarLabClicked = true;
          guardarFound = true;
          await page.waitForTimeout(2000);
          const modal = page.locator('.swal2-confirm:visible');
          if (await modal.count() > 0) {
            await modal.first().click();
            await page.waitForTimeout(500);
          }
          break;
        }
      }
      if (guardarFound) break;
    }
    
    if (!guardarFound) {
      console.log('   ⚠️ No se encontró botón Guardar cambios visible para laboratorios');
      await page.screenshot({ path: 'test-results/lab-guardar-not-found.png', fullPage: true });
    }
    
    console.log('\n✅ Sección de Tratamiento completada');
    console.log(`📊 Guardar tratamiento (type="submit"): ${guardarTreatmentClicked ? '✅' : '❌'}, Guardar lab (type="button"): ${guardarLabClicked ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`⚠️ Error en fillTreatmentSection: ${error.message}`);
  }

  return { guardarTreatmentClicked, guardarLabClicked };
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
    
    // 1. SELECCIONAR 1 SOLO SERVICIO
    console.log('🔍 Buscando dropdown de servicio...');
    let servicioSeleccionado = false;

    const comboboxInputs = page.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible');
    const cbCount = await comboboxInputs.count();
    console.log(`📋 Encontrados ${cbCount} inputs de dropdown en Servicios`);

    if (cbCount > 0) {
      const dropdownInput = comboboxInputs.first();
      await dropdownInput.click();
      await page.waitForTimeout(500);
      const svgIcon = page.locator('svg.css-8mmkcg, svg[class*="css-"]').first();
      if (await svgIcon.isVisible({ timeout: 1000 }).catch(() => false)) {
        await svgIcon.click();
      }
      await page.waitForTimeout(1500);
      console.log('✅ Dropdown abierto');

      const dropdownMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
      const options = dropdownMenu.locator('[class*="option"], [role="option"]');
      let optionCount = await options.count();

      if (optionCount === 0) {
        await page.waitForTimeout(2000);
        optionCount = await options.count();
      }
      console.log(`📋 ${optionCount} opciones disponibles`);

      for (let j = 0; j < optionCount; j++) {
        const option = options.nth(j);
        if (await option.isVisible({ timeout: 300 }).catch(() => false)) {
          const optionText = (await option.textContent().catch(() => '')).trim();
          if (j < 10) console.log(`   Opción ${j}: "${optionText.substring(0, 60)}"`);
          if (optionText.toLowerCase().includes('certificado')) {
            await option.click();
            console.log(`✅ Seleccionado: "${optionText.substring(0, 60)}..."`);
            servicioSeleccionado = true;
            break;
          }
        }
      }

      if (!servicioSeleccionado && optionCount > 0) {
        const firstOption = options.first();
        const text = await firstOption.textContent().catch(() => '');
        await firstOption.click();
        console.log(`✅ Seleccionado (primera opción): "${(text || '').trim().substring(0, 60)}"`);
        servicioSeleccionado = true;
      }

      await page.waitForTimeout(1000);
    }

    // 2. LLENAR TEXTAREAS
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

    // 3. GUARDAR SERVICIOS
    if (servicioSeleccionado) {
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
    }

    console.log('✅ Servicios completados');
    await page.waitForTimeout(500);
    
  } catch (error) {
    console.log(`⚠️ Error en Servicios: ${error.message}`);
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

  const monitor = setupConsoleMonitor(page);
  console.log('🔍 [MONITOR] DevTools monitor activo — capturando consola y red...\n');

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
  await page.waitForTimeout(1000);
  
  const allInputs = page.locator('input:not([disabled]):not([readonly])');
  const inputCount = await allInputs.count();
  console.log(`📝 Encontrados ${inputCount} inputs en signos vitales`);
  
  await page.locator('input[name="peso"]').fill('70');
  
  const tallaInput = page.locator('input[name*="talla" i]');
  if (await tallaInput.count() > 0) await tallaInput.first().fill('170');
  
  const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
  if (await presionInput.isVisible().catch(() => false)) {
    await presionInput.fill('120/080');
    console.log('💓 Presión arterial: 120/080');
  }
  
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
  
  const fechaUltimoCicloInput = page.locator('input[placeholder="dd/mm/yyyy"]');
  if (await fechaUltimoCicloInput.count() > 0) {
    const now = new Date();
    const fechaSemanaPasada = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dia = String(fechaSemanaPasada.getDate()).padStart(2, '0');
    const mes = String(fechaSemanaPasada.getMonth() + 1).padStart(2, '0');
    const anio = fechaSemanaPasada.getFullYear();
    const fechaFormateada = `${dia}/${mes}/${anio}`;
    await fechaUltimoCicloInput.first().fill(fechaFormateada);
    console.log(`📅 Fecha último ciclo: ${fechaFormateada}`);
  }
  
  await page.waitForTimeout(1500);
  
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim().toLowerCase().includes('guardar'));
    return btn && !btn.disabled;
  }, { timeout: 10000 });
  
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
      const { guardarTreatmentClicked, guardarLabClicked } = await fillTreatmentSection(page);
      if (!guardarTreatmentClicked || !guardarLabClicked) {
        console.log(`❌ No se encontraron ambos botones Guardar cambios. Treatment: ${guardarTreatmentClicked}, Lab: ${guardarLabClicked}. Reintentando...`);
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        const allGuardar = page.locator('button:has-text("Guardar cambios")');
        const retryCount = await allGuardar.count();
        for (let i = 0; i < retryCount; i++) {
          if (await allGuardar.nth(i).isVisible({ timeout: 1000 }).catch(() => false)) {
            await allGuardar.nth(i).click();
            console.log(`✅ Retry: Guardar #${i+1} clickeado`);
            await page.waitForTimeout(1500);
            const modal = page.locator('.swal2-confirm:visible');
            if (await modal.count() > 0) {
              await modal.first().click();
              await page.waitForTimeout(500);
            }
          }
        }
      }
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

  const result = monitor.printSummary();
  if (!result.passed) {
    console.log(`⚠️  El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);
  }
});
