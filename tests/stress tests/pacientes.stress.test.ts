import { test, expect } from '@playwright/test';

const invalidInputs = {
  'XSS Script': '<script>alert("xss")</script>',
  'SQL Injection': "' OR '1'='1",
  'Template': '{{alert(1)}}',
  'Caracteres Esp': '!@#$%',
  'Solo Espacios': '   ',
};

test.describe('Pacientes - Stress Tests', () => {
  test('Open random patient and analyze fields', async ({ page }) => {
    test.setTimeout(600000);
    
    console.log('🧪 === STRESS TEST - ANÁLISIS DE PERFIL DE PACIENTE ===\n');
    
    await page.goto('/Pacientes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('📋 Lista de pacientes cargada');
    
    const patientLinks = page.locator('a.font-semibold.text-sm.text-gray-900');
    const patientCount = await patientLinks.count();
    console.log(`📋 Pacientes encontrados: ${patientCount}`);
    
    if (patientCount > 0) {
      const randomIndex = Math.floor(Math.random() * patientCount);
      const patientName = await patientLinks.nth(randomIndex).textContent();
      console.log(`📋 Seleccionando paciente aleatorio: ${patientName}`);
      
      const allRows = page.locator('[role="row"]');
      const patientRow = allRows.nth(randomIndex + 1);
      
      const editBtn = patientRow.locator('button.btn-icon').last();
      const editBtnVisible = await editBtn.isVisible();
      console.log(`📋 Botón editar visible: ${editBtnVisible}`);
      
      if (editBtnVisible) {
        await editBtn.click();
        await page.waitForTimeout(3000);
        
        const modal = page.locator('[role="dialog"], .modal');
        const modalCount = await modal.count();
        console.log(`📋 Modales encontrados: ${modalCount}`);
        
        console.log('\n📋 Analizando campos del formulario de paciente...');
        
        const allButtons = page.locator('[role="dialog"] button, .modal button');
        const buttonCount = await allButtons.count();
        console.log(`📋 Botones en modal: ${buttonCount}`);
        
        for (let i = 0; i < buttonCount; i++) {
          const btn = allButtons.nth(i);
          if (await btn.isVisible()) {
            const btnText = await btn.textContent();
            console.log(`  Botón ${i + 1}: ${btnText}`);
          }
        }
        
        const editModalBtn = page.locator('[role="dialog"] button:has-text("Editar"), .modal button:has-text("Editar")');
        if (await editModalBtn.count() > 0 && await editModalBtn.first().isVisible()) {
          console.log('📋 Haciendo clic en botón Editar del modal...');
          await editModalBtn.first().click();
          await page.waitForTimeout(2000);
        }
        
        const allInputs = page.locator('[role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select');
        const inputCount = await allInputs.count();
        console.log(`📋 Total campos encontrados: ${inputCount}`);
        
        for (let i = 0; i < Math.min(inputCount, 30); i++) {
          const input = formInputs.nth(i);
          if (await input.isVisible() && await input.isEnabled()) {
            const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
            const placeholder = await input.getAttribute('placeholder') || '';
            const name = await input.getAttribute('name') || '';
            const type = await input.getAttribute('type') || '';
            const id = await input.getAttribute('id') || '';
            const ariaLabel = await input.getAttribute('aria-label') || '';
            
            let labelText = '';
            const label = page.locator(`label[for="${id}"]`).first();
            if (await label.count() > 0) {
              labelText = await label.textContent() || '';
            }
            
            console.log(`\n  Campo ${i + 1}:`);
            console.log(`    Tag: ${tagName}`);
            console.log(`    Name: ${name || 'N/A'}`);
            console.log(`    Type: ${type || 'N/A'}`);
            console.log(`    Placeholder: ${placeholder || 'N/A'}`);
            console.log(`    Label: ${labelText || 'N/A'}`);
            console.log(`    ID: ${id || 'N/A'}`);
            console.log(`    Aria-label: ${ariaLabel || 'N/A'}`);
          }
        }
        
        const textareas = page.locator('textarea');
        const textareaCount = await textareas.count();
        console.log(`\n📋 Textareas encontrados: ${textareaCount}`);
        
        for (let i = 0; i < textareaCount; i++) {
          const textarea = textareas.nth(i);
          if (await textarea.isVisible()) {
            const placeholder = await textarea.getAttribute('placeholder') || '';
            const name = await textarea.getAttribute('name') || '';
            const id = await textarea.getAttribute('id') || '';
            console.log(`  Textarea ${i + 1}: name="${name}" placeholder="${placeholder}" id="${id}"`);
          }
        }
        
        const selects = page.locator('select');
        const selectCount = await selects.count();
        console.log(`\n📋 Selects encontrados: ${selectCount}`);
        
        for (let i = 0; i < selectCount; i++) {
          const select = selects.nth(i);
          if (await select.isVisible()) {
            const name = await select.getAttribute('name') || '';
            const id = await select.getAttribute('id') || '';
            const optionsCount = await select.locator('option').count();
            console.log(`  Select ${i + 1}: name="${name}" id="${id}" options=${optionsCount}`);
          }
        }
        
        console.log('\n✅ Análisis completado');
      }
    }

    console.log('\n✅ Test completado');
  });
});
