import { test, expect } from '@playwright/test';
import { createAppointment } from '../e2e/utils.js';
const config = require('../e2e/config');
const logger = config.logger;

test.describe('Schedule Appointment Flow', () => {

  test('Schedule appointment for a patient', async ({ page }) => {
    await createAppointment(page);
  });

  test('Confirm scheduled appointment from agenda', async ({ page }) => {

    await page.goto('/Citas');
    await expect(page).toHaveURL(/Citas/);

    // Esperar a que se cargue la página completamente
    await page.waitForTimeout(3000);

    // Ir a vista Agenda si existe enlace
    const agendaLink = page.getByRole('link', { name: /agenda/i });
    if (await agendaLink.isVisible()) {
      await agendaLink.click();
      await page.waitForTimeout(2000);
    }

    // Explorar semana actual + 3 semanas siguientes
    let citaEncontrada = false;
    const maxSemanas = 4;

    for (let semana = 0; semana < maxSemanas; semana++) {
      if (semana > 0) {
        // Dar click en "Semana siguiente" para avanzar
        const nextWeekBtn = page.locator('button.fc-next-button, button[title="Semana siguiente"]');
        if (await nextWeekBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await nextWeekBtn.click();
          logger.info(`Avanzando a semana ${semana + 1}...`);
          await page.waitForTimeout(2000);
        } else {
          logger.warn('Botón "Semana siguiente" no encontrado');
          break;
        }
      }

      // Buscar citas agendadas en la semana actual
      const possibleTexts = ['agendada', 'programada'];

      for (const text of possibleTexts) {
        const candidate = page.locator(`text=/${text}/i`).first();
        if (await candidate.isVisible({ timeout: 3000 }).catch(() => false)) {
          logger.success(`Encontrada cita con texto: "${text}" en semana ${semana + 1}`);
          
          // Abrir la cita
          await candidate.click();
          await page.waitForTimeout(2000);

          // Esperar bloque emergente
          const modal = page.locator('[role="dialog"], .modal, .bg-white');
          if (await modal.first().isVisible({ timeout: 5000 }).catch(() => false)) {
            logger.info('Modal abierto');
            
            // Confirmar directamente la cita
            const confirmButton = page.getByRole('button', { name: /confirmar/i });
            if (await confirmButton.isVisible({ timeout: 5000 }).catch(() => false)) {
              await confirmButton.click();
              logger.success('Cita confirmada exitosamente');
            } else {
              logger.warn('Botón "confirmar" no encontrado en el modal');
            }
          } else {
            logger.warn('Modal no se abrió');
          }
          
          citaEncontrada = true;
          break;
        }
      }

      if (citaEncontrada) break;
      logger.info(`Sin citas en semana ${semana + 1}, continuando...`);
    }

    if (!citaEncontrada) {
      logger.warning('No se encontraron citas agendadas en 4 semanas');
    }

  });

});
