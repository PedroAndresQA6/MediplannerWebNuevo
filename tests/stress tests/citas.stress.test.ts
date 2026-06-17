import { test, expect } from '@playwright/test';
const { setupConsoleMonitor } = require('../../e2e/utils.js');

const MALICIOUS_INPUTS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '"><script>alert(1)</script>',
  "'; DROP TABLE appointments;--",
  "1' OR '1'='1",
  '{{7*7}}',
  '${7*7}',
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
];

test.describe('Citas - Stress Tests', () => {
  let vulnerabilities: string[] = [];
  let protections = 0;

  test('Stress test on Citas module', async ({ page }) => {
    const monitor = setupConsoleMonitor(page);
    console.log('🔍 [MONITOR] DevTools monitor activo\n');

    await page.goto('/Citas');
    await expect(page).toHaveURL(/Citas/);
    await page.waitForTimeout(2000);

    console.log('Starting Citas stress test...');

    const openWizardBtn = page.getByRole('button', { name: /agendar cita/i });
    if (await openWizardBtn.isVisible()) {
      await openWizardBtn.click();
      await page.waitForTimeout(2000);
    }

    const wizard = page.locator('div.bg-white.shadow-md.rounded.p-5');
    if (await wizard.isVisible()) {
      console.log('Wizard opened - Step 1: Patient selection');

      const selects = wizard.locator('select');
      const selectCount = await selects.count();
      console.log(`Found ${selectCount} selects in step 1`);

      const patientSelect = selects.nth(0);
      const options = await patientSelect.locator('option').count();
      if (options > 1) {
        await patientSelect.selectOption({ index: 1 });
        console.log('Selected patient');
      }

      const continueBtn = page.getByRole('button', { name: /continuar/i });
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(2000);
      }

      console.log('Step 2: Type + Hospital');

      const selects2 = page.locator('select');
      const selectCount2 = await selects2.count();
      console.log(`Found ${selectCount2} selects in step 2`);

      for (let i = 0; i < selectCount2; i++) {
        const select = selects2.nth(i);
        if (await select.isVisible() && await select.isEnabled()) {
          const name = await select.getAttribute('name') || await select.getAttribute('id') || `select-${i}`;
          console.log(`Testing select ${i}: ${name}`);

          const optionCount = await select.locator('option').count();
          
          for (const malicious of MALICIOUS_INPUTS.slice(0, 3)) {
            try {
              await select.selectOption(malicious);
              await page.waitForTimeout(200);
              
              const value = await select.inputValue();
              if (value === malicious) {
                vulnerabilities.push(`Select ${i} (${name}): accepted "${malicious.substring(0, 20)}..."`);
                console.log(`  VULNERABILITY: accepted "${malicious.substring(0, 20)}"`);
              } else {
                protections++;
                console.log(`  Protected: rejected malicious input`);
              }
            } catch (e) {
              protections++;
            }
          }

          if (optionCount > 1) {
            await select.selectOption({ index: 1 });
          }
        }
      }

      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(2000);
      }

      console.log('Step 3: Date and text fields');

      const dateInput = page.locator('input[type="date"]');
      if (await dateInput.isVisible()) {
        console.log('Testing date input...');
        
        for (const testInput of MALICIOUS_INPUTS.slice(0, 3)) {
          try {
            await dateInput.fill('');
            await dateInput.type(testInput);
            await page.waitForTimeout(200);
            
            const value = await dateInput.inputValue();
            if (value && (value.includes('<') || value.includes('{{'))) {
              vulnerabilities.push(`Date input: accepted "${testInput}"`);
              console.log(`  VULNERABILITY: date accepted "${testInput.substring(0, 20)}"`);
            } else {
              protections++;
            }
          } catch (e) {
            protections++;
          }
        }

        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        await dateInput.fill(futureDate.toISOString().split('T')[0]);
        await page.waitForTimeout(1000);
      }

      const textareas = page.locator('textarea');
      const textareaCount = await textareas.count();
      console.log(`Found ${textareaCount} textareas`);

      for (let i = 0; i < textareaCount; i++) {
        const textarea = textareas.nth(i);
        if (await textarea.isVisible() && await textarea.isEnabled()) {
          const placeholder = await textarea.getAttribute('placeholder') || `textarea-${i}`;
          
          for (const malicious of MALICIOUS_INPUTS.slice(0, 3)) {
            try {
              await textarea.fill(malicious);
              await page.waitForTimeout(200);
              
              const value = await textarea.inputValue();
              if (value === malicious) {
                vulnerabilities.push(`Textarea (${placeholder}): accepted "${malicious.substring(0, 20)}..."`);
                console.log(`  VULNERABILITY: textarea accepted malicious input`);
              } else {
                protections++;
              }
            } catch (e) {
              protections++;
            }
          }
        }
      }

      const inputs = page.locator('input:not([type="hidden"]):not([readonly])');
      const inputCount = await inputs.count();
      console.log(`Found ${inputCount} inputs`);

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        if (await input.isVisible() && await input.isEnabled()) {
          const type = await input.getAttribute('type') || 'text';
          if (type === 'date') continue;
          
          const placeholder = await input.getAttribute('placeholder') || `input-${i}`;
          
          for (const malicious of MALICIOUS_INPUTS.slice(0, 3)) {
            try {
              await input.fill(malicious);
              await page.waitForTimeout(200);
              
              const value = await input.inputValue();
              if (value === malicious) {
                vulnerabilities.push(`Input (${placeholder}): accepted "${malicious.substring(0, 20)}..."`);
                console.log(`  VULNERABILITY: input accepted malicious input`);
              } else {
                protections++;
              }
            } catch (e) {
              protections++;
            }
          }
        }
      }

    } else {
      console.log('Wizard not visible');
    }

    console.log(`\n=== Citas Stress Test Results ===`);
    console.log(`Protections: ${protections}`);
    console.log(`Vulnerabilities: ${vulnerabilities.length}`);
    
    if (vulnerabilities.length > 0) {
      console.log('\nVulnerabilities found:');
      vulnerabilities.forEach(v => console.log(`  - ${v}`));
    }

    console.log('\n✅ Citas Stress Test completed');

    const result = monitor.printSummary();
    if (!result.passed) console.log(`⚠️ El test terminó con ${result.errors.length} error(es) y ${result.failedApiCalls.length} API call(s) fallida(s).`);
  });
});
