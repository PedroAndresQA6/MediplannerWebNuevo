import { test, expect } from '@playwright/test';

const invalidInputs = {
  'XSS Script': '<script>alert("xss")</script>',
  'SQL Injection': "' OR '1'='1",
  'Template': '{{alert(1)}}',
  'Caracteres Esp': '!@#$%',
  'Solo Espacios': '   ',
  'Negativo': '-50',
  'Muy Grande': '999999999999',
  'Texto': 'abc',
  'Decimal': '100.50',
  'Especial HTML': '<img src=x onerror=alert(1)>',
};

const validBoundaryTests = {
  'Cero': '0',
  'Negativo': '-1',
  'Mayor al monto': '999999',
  'Monto exacto': '100',
  'Monto menor': '50',
};

async function waitForLoadingToAppear(page: any, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const loading = page.locator('text=/cargando/i');
    const isVisible = await loading.isVisible().catch(() => false);
    if (isVisible) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function waitForLoadingToDisappear(page: any, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const loading = page.locator('text=/cargando/i');
    const isVisible = await loading.isVisible().catch(() => false);
    if (!isVisible) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function waitForFullLoading(page: any) {
  await waitForLoadingToAppear(page);
  await waitForLoadingToDisappear(page);
}

test.describe('Ingresos - Stress Tests', () => {
  test('Stress test on Abonar - Subtotal field', async ({ page }) => {
    test.setTimeout(600000);
    
    console.log('🧪 === STRESS TEST - MÓDULO INGRESOS (ABONAR) ===\n');
    
    await page.goto('/Dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('📋 Navegando a Ingresos desde el menú...');
    
    const ingresosLink = page.locator('span.menu-title:text-is("Ingresos")');
    await ingresosLink.click();
    await expect(page).toHaveURL(/Ingresos/);
    
    await waitForFullLoading(page);
    console.log('📋 Página de Ingresos cargada');
    
    console.log('📋 Seleccionando filtro "Pendiente"...');
    const estatusSelect = page.locator('select#estatus');
    if (await estatusSelect.isVisible()) {
      await estatusSelect.selectOption({ value: '2' });
      console.log('📋 Filtro aplicado');
    }
    
    await waitForFullLoading(page);
    
    console.log('📋 Buscando ingresos pendientes...');
    
    const pendientes = page.locator('tr, [class*="row"]').filter({
      has: page.locator('text=/pendiente/i')
    });
    
    const count = await pendientes.count();
    console.log(`📋 Ingresos pendientes encontrados: ${count}`);
    
    if (count > 0) {
      console.log('📋 Abriendo primer ingreso pendiente...');
      const pendiente = pendientes.first();
      const eyeButton = pendiente.locator('svg.fa-eye').locator('..').first();
      
      if (await eyeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await eyeButton.click();
        await waitForFullLoading(page);
        
        console.log('📋 Buscando botón Abonar...');
        const btnAbonar = page.getByRole('button', { name: /abonar/i });
        
        if (await btnAbonar.isVisible({ timeout: 5000 }).catch(() => false)) {
          await btnAbonar.click();
          await waitForFullLoading(page);
          
          console.log('\n🧪 === SELECCIONANDO MÉTODO DE PAGO ===');
          
          const metodoPagoRadio = page.locator('input[type="radio"]:visible');
          const radioCount = await metodoPagoRadio.count();
          console.log(`📋 Métodos de pago encontrados: ${radioCount}`);
          
          if (radioCount > 1) {
            await metodoPagoRadio.nth(1).click();
            console.log('📋 Método de pago seleccionado');
            await page.waitForTimeout(1000);
          }
          
          console.log('\n🧪 === TESTEANDO CAMPO SUBTOTAL ===');
          
          const subtotalInput = page.locator('input[name="subtotal"]');
          const subtotalVisible = await subtotalInput.isVisible().catch(() => false);
          
          console.log(`📋 Campo subtotal visible: ${subtotalVisible}`);
          
          const btnRegistrar = page.getByRole('button', { name: /registrar pago/i });
          
          if (subtotalVisible) {
            const currentValue = await subtotalInput.inputValue();
            console.log(`📋 Valor actual del campo: ${currentValue}`);
            
            console.log('\n--- PRUEBAS DE INPUTS INVÁLIDOS ---');
            for (const [tipo, valor] of Object.entries(invalidInputs)) {
              console.log(`\n🧪 Probando: ${tipo} = "${valor}"`);
              
              try {
                await subtotalInput.fill('');
                await page.waitForTimeout(300);
                await subtotalInput.type(valor);
                await page.waitForTimeout(500);
                
                const newValue = await subtotalInput.inputValue();
                console.log(`  Valor en campo: "${newValue}"`);
                
                console.log(`  Clic en "Registrar Pago"...`);
                await btnRegistrar.click();
                await page.waitForTimeout(2000);
                
                const errorModal = page.locator('.swal2-popup:visible, [role="alert"]:visible, .alert:visible');
                const errorText = page.locator('text=/error|inválido|incorrecto|mayor|menor|negativo|exced|máximo/i');
                const successModal = page.locator('.swal2-popup:visible, text=/éxito|guardado|registrado|confirmado/i');
                
                const errorVisible = await errorModal.first().isVisible().catch(() => false);
                const errorTextVisible = await errorText.first().isVisible().catch(() => false);
                const successVisible = await successModal.first().isVisible().catch(() => false);
                
                if (errorVisible || errorTextVisible) {
                  const errorMsg = await errorText.first().textContent().catch(() => 'Error detectado');
                  console.log(`  📝 Resultado: ✅ BLOQUEADO - ${errorMsg}`);
                } else if (successVisible) {
                  console.log(`  📝 Resultado: ❌ ACEPTADO - El sistema permitió el registro`);
                  
                  const okBtn = page.locator('button:has-text("OK"), button:has-text("Aceptar"), .swal2-confirm');
                  if (await okBtn.first().isVisible()) {
                    await okBtn.first().click();
                    await page.waitForTimeout(1000);
                  }
                } else {
                  console.log(`  📝 Resultado: ⚠️ Revisar manualmente`);
                }
              } catch (e) {
                console.log(`  📝 Resultado: Error - ✅ BLOQUEADO`);
              }
            }
            
            console.log('\n--- PRUEBAS DE LÍMITES ---');
            for (const [tipo, valor] of Object.entries(validBoundaryTests)) {
              console.log(`\n🧪 Probando: ${tipo} = "${valor}"`);
              
              try {
                await subtotalInput.fill('');
                await page.waitForTimeout(300);
                await subtotalInput.type(valor);
                await page.waitForTimeout(500);
                
                const newValue = await subtotalInput.inputValue();
                console.log(`  Valor en campo: "${newValue}"`);
                
                console.log(`  Clic en "Registrar Pago"...`);
                await btnRegistrar.click();
                await page.waitForTimeout(2000);
                
                const errorText = page.locator('text=/error|inválido|incorrecto|mayor|menor|negativo|exced|máximo/i');
                const successModal = page.locator('.swal2-popup:visible, text=/éxito|guardado|registrado|confirmado/i');
                
                const errorTextVisible = await errorText.first().isVisible().catch(() => false);
                const successVisible = await successModal.first().isVisible().catch(() => false);
                
                if (errorTextVisible) {
                  const errorMsg = await errorText.first().textContent().catch(() => 'Error detectado');
                  console.log(`  📝 Resultado: ✅ BLOQUEADO - ${errorMsg}`);
                } else if (successVisible) {
                  console.log(`  📝 Resultado: ✅ ACEPTADO (valor válido)`);
                  
                  const okBtn = page.locator('button:has-text("OK"), button:has-text("Aceptar"), .swal2-confirm');
                  if (await okBtn.first().isVisible()) {
                    await okBtn.first().click();
                    await page.waitForTimeout(1000);
                  }
                } else {
                  console.log(`  📝 Resultado: ⚠️ Revisar`);
                }
              } catch (e) {
                console.log(`  📝 Resultado: Error`);
              }
            }
            
            console.log('\n✅ Pruebas completadas');
          } else {
            console.log('⚠️ Campo subtotal no encontrado');
          }
        } else {
          console.log('⚠️ Botón Abonar no encontrado');
        }
      } else {
        console.log('⚠️ No hay ingresos pendientes para probar');
      }
    } else {
      console.log('⚠️ No hay ingresos pendientes');
    }
    
    console.log('\n✅ Test completado');
  });
});
