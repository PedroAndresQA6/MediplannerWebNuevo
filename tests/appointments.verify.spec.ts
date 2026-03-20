import { test, expect } from '@playwright/test';
const config = require('../e2e/config');
const logger = config.logger;

test.describe('Verify Scheduled Appointment Creation', () => {

  test('Verify appointment was created and can be opened from Dashboard', async ({ page }) => {

    // Ir al Dashboard/Inicio donde se muestran las citas para iniciar
    await page.goto('/Dashboard');
    await expect(page).toHaveURL(/Dashboard/);
    
    // Esperar a que cargue la página
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Buscar botones de "Iniciar" que indiquen que hay citas disponibles
    let iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    
    // Verificar que haya al menos un botón de iniciar (cita disponible)
    let count = await iniciarButtons.count();
    
    if (count === 0) {
      logger.warning('No hay citas con botón Iniciar hoy');
      logger.info('Revisando próximos 5 días...');
      
      for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);
        const dateStr = targetDate.toISOString().split('T')[0];
        
        logger.info(`Revisando fecha: ${dateStr}`);
        
        // Intentar cambiar fecha
        const dateInput = page.locator('input[type="date"]').first();
        if (await dateInput.isVisible().catch(() => false)) {
          await dateInput.fill(dateStr);
          await page.waitForTimeout(2000);
        } else {
          const dateTextbox = page.locator('textbox').first();
          if (await dateTextbox.isVisible().catch(() => false)) {
            await dateTextbox.fill(dateStr);
            await page.waitForTimeout(2000);
          }
        }
        
        // Verificar botones
        iniciarButtons = page.getByRole('button', { name: /iniciar/i });
        count = await iniciarButtons.count();
        
        if (count > 0) {
          logger.success(`Encontradas ${count} cita(s) con botón Iniciar para ${dateStr}`);
          break;
        }
        
        console.log(`❌ No hay citas para ${dateStr}, intentando siguiente día...`);
      }
    }
    
    expect(count).toBeGreaterThan(0);
    
    console.log(`✅ Encontradas ${count} cita(s) con botón Iniciar`);
    
    // Hacer clic en el primer botón de iniciar para abrir la cita
    await iniciarButtons.first().click();
    
    // Validar que se abre la consulta (debería mostrar signos vitales u otros elementos de consulta)
    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await expect(signosButton).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Cita abierta exitosamente desde Dashboard');

  });

});