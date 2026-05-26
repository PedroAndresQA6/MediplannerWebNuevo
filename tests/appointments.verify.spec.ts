import { test, expect } from '@playwright/test';
const { checkNextDaysForIniciarButton, createAppointment } = require('../e2e/utils.js');
const config = require('../e2e/config');
const logger = config.logger;

test.describe('Verify Scheduled Appointment Creation', () => {

  test('Verify appointment was created and can be opened from Dashboard', async ({ page }) => {

    // Ir al Dashboard/Inicio donde se muestran las citas para iniciar
    await page.goto('/Dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Buscar botones de "Iniciar"
    let iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    let count = await iniciarButtons.count();
    
    if (count === 0) {
      logger.warning('No hay citas con botón Iniciar hoy');
      const found = await checkNextDaysForIniciarButton(page);
      
      if (!found) {
        logger.info('No se encontraron citas existentes, creando una nueva...');
        await createAppointment(page);
        
        // Volver al Dashboard para buscar el botón Iniciar
        await page.goto('/Dashboard');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        iniciarButtons = page.getByRole('button', { name: /iniciar/i });
        count = await iniciarButtons.count();
      } else {
        // checkNextDaysForIniciarButton ya hizo clic en Iniciar
        const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
        await expect(signosButton).toBeVisible({ timeout: 10000 });
        console.log('✅ Cita abierta exitosamente desde Dashboard');
        return;
      }
    }
    
    if (count === 0) {
      throw new Error('No se pudo encontrar ni crear una cita para verificar');
    }
    
    console.log(`✅ Encontradas ${count} cita(s) con botón Iniciar`);
    
    // Hacer clic en el primer botón de iniciar para abrir la cita
    await iniciarButtons.first().click();
    
    // Validar que se abre la consulta
    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await expect(signosButton).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Cita abierta exitosamente desde Dashboard');

  });

});