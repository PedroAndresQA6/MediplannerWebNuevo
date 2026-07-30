const { chromium } = require('@playwright/test');

// Diagnóstico aislado: ¿un F5 real (page.reload()) a mitad de una consulta
// ya iniciada deja la página colgada en "Cargando información de consulta"?
// Esto simula el error más simple y común que un médico real podría cometer.

const BASE = 'https://admin.mediplanner.mx/';
const PACIENTE_BUSQUEDA = 'Prueba DE Codigo';

async function handleModals(page) {
  try {
    const swalModal = page.locator('.swal2-popup.swal2-modal:visible');
    if (await swalModal.count() > 0) {
      const confirmBtn = swalModal.locator('.swal2-confirm:visible, .swal2-button:visible');
      if (await confirmBtn.count() > 0) await confirmBtn.first().click({ timeout: 2000 });
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  } catch (e) {}
}

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({
    storageState: 'Mediplanner produccion/storageState.json',
    viewport: null,
    baseURL: BASE,
  });
  const page = await context.newPage();

  try {
    await page.goto('/Dashboard');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
    if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await explorarLink.click();
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
      await page.waitForTimeout(1500);
    }

    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    let targetBtn = null;
    for (let i = 0; i < count; i++) {
      const btn = iniciarButtons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      const texto = (await fila.textContent().catch(() => '') || '');
      if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.toLowerCase())) { targetBtn = btn; break; }
    }
    if (!targetBtn) throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_BUSQUEDA}" — puede que ya no queden citas pendientes de hoy`);
    await targetBtn.click();

    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await signosButton.waitFor({ state: 'visible', timeout: 10000 });
    await signosButton.click();
    await page.waitForTimeout(1000);
    await page.locator('input[name="peso"]').fill('68');
    const tallaInput = page.locator('input[name*="talla" i]').first();
    if (await tallaInput.count() > 0) await tallaInput.fill('165');
    const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
    if (await presionInput.isVisible().catch(() => false)) await presionInput.fill('120/080');
    const tempInput = page.locator('input[name*="temp" i]');
    if (await tempInput.count() > 0) await tempInput.first().fill('36.5');
    const fcInput = page.locator('input[name*="card" i]');
    if (await fcInput.count() > 0) await fcInput.first().fill('75');
    const satInput = page.locator('input[name="oxigenacion"]');
    if (await satInput.count() > 0) await satInput.first().fill('98');
    const frInput = page.locator('input[name="frecuenciaRespiratoria"]');
    if (await frInput.count() > 0) await frInput.first().fill('16');
    await page.waitForTimeout(1000);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
      return btn && !btn.disabled;
    }, { timeout: 10000 }).catch(() => {});
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await page.waitForTimeout(2000);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await cerrarButton.isVisible().catch(() => false)) { await cerrarButton.click(); await page.waitForTimeout(1000); }

    try {
      await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
    } catch {
      await page.goto('/Consulta/ConsultaGeneral');
      await page.waitForLoadState('load').catch(() => {});
    }
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const urlAntesDeReload = page.url();
    console.log(`✅ Consulta cargada normalmente. URL: ${urlAntesDeReload}`);
    const motivoVisibleAntes = await page.locator('textarea[name="visitaPaciente"]').isVisible().catch(() => false);
    console.log(`Motivo visible ANTES del reload: ${motivoVisibleAntes}`);

    console.log('\n🔄 Haciendo page.reload() (F5 real)...');
    await page.reload();
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 15000 }).catch(() => {
      console.log('⚠️ Seguía en "Cargando información de consulta" tras 15s post-reload');
    });
    await page.waitForTimeout(2000);

    console.log(`URL tras reload: ${page.url()}`);
    const bodyText = (await page.locator('body').innerText().catch(() => '')).substring(0, 200);
    console.log(`Texto visible tras reload (primeros 200 chars): "${bodyText}"`);
    const motivoVisibleDespues = await page.locator('textarea[name="visitaPaciente"]').isVisible().catch(() => false);
    console.log(`Motivo visible DESPUÉS del reload (F5): ${motivoVisibleDespues}`);

    await page.screenshot({ path: 'Mediplanner produccion/test-results/diagnostico-post-f5.png', fullPage: true });

    if (!motivoVisibleDespues) {
      console.log('\n🐛 CONFIRMADO: un F5 (reload) real a mitad de la consulta deja la página SIN el contenido de la consulta visible.');
      // ¿Se recupera navegando de nuevo al Dashboard y reabriendo?
      console.log('\n🔁 Probando recuperación: volver a Dashboard y reabrir la consulta...');
      await page.goto('/Dashboard');
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
      await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const iniciarButtons2 = page.getByRole('button', { name: /iniciar/i });
      const count2 = await iniciarButtons2.count();
      console.log(`Botones "Iniciar" visibles tras volver al Dashboard: ${count2}`);
      await page.screenshot({ path: 'Mediplanner produccion/test-results/diagnostico-dashboard-post-f5.png', fullPage: true });
    } else {
      console.log('\n✅ El F5 real SÍ recargó la consulta correctamente — el problema anterior era específico de mi patrón de navegación (goto a otra URL y volver), no de un reload real.');
    }
  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'Mediplanner produccion/test-results/diagnostico-error.png', fullPage: true }).catch(() => {});
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
