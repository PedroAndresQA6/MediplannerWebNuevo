const config = require('./config');

const logger = config.logger;

async function handleModals(page) {
  // Manejar modales comunes de SweetAlert2 u otros frameworks
  try {
    // SweetAlert2 modals
    const swalModal = page.locator('.swal2-popup.swal2-modal:visible');
    if (await swalModal.count() > 0) {
      // Si hay un botón de confirmación/aceptar, hacer clic
      const confirmBtn = swalModal.locator('.swal2-confirm:visible, .swal2-button:visible');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.first().click({ timeout: 2000 });
        await page.waitForTimeout(1000);
      } else {
        // Si no hay botón visible, intentar con Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
    }

    // Otros modales comunes
    const genericModals = page.locator('[role="dialog"]:visible, .modal:visible, .popup:visible');
    for (let i = 0; i < await genericModals.count(); i++) {
      const modal = genericModals.nth(i);
      if (await modal.isVisible()) {
        // Buscar botones de cerrar/aceptar
        const closeButtons = modal.locator('button:visible, [role="button"]:visible');
        if (await closeButtons.count() > 0) {
          await closeButtons.first().click({ timeout: 2000 });
          await page.waitForTimeout(1000);
        }
      }
    }
  } catch (modalError) {
    // Ignorar errores al manejar modales para no interrumpir el flujo principal
    logger.warning(`Error menor al manejar modals: ${modalError.message}`);
  }
}

module.exports = { handleModals };
