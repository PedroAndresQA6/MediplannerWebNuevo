const { chromium } = require('@playwright/test');
const { createAppointment, handleModals } = require('./e2e/utils.js');
require('dotenv').config({ path: '.env' });

// Inspección de la estructura REAL de "Exploración segmentaria" / "Aparatos y
// sistemas" — Pedro señaló que el test solo marca checkboxes pero no cubre
// "cada normal y anormal posible" ni llena observaciones. Este script crea
// una consulta nueva (sin llenar nada) y vuelca el HTML crudo de esas 2
// secciones para ver qué controles existen realmente por ítem.

const PACIENTE_BUSQUEDA = 'Carla';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  try {
    await createAppointment(page, PACIENTE_BUSQUEDA);
    for (let intento = 1; intento <= 4; intento++) {
      if (intento === 1) await page.goto('/Dashboard');
      else await page.reload();
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
      const sigueCargando = await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).then(() => false).catch(() => true);
      if (!sigueCargando) break;
      console.log(`⚠️ Dashboard en "Cargando..." (intento ${intento}/4)`);
    }
    await page.waitForTimeout(2000);

    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    let targetBtn = null;
    for (let i = 0; i < count; i++) {
      const btn = iniciarButtons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      const texto = (await fila.textContent().catch(() => '') || '');
      if (texto.toLowerCase().includes('carla')) { targetBtn = btn; break; }
    }
    if (!targetBtn) throw new Error('No se encontró botón "Iniciar" para Carla');
    await targetBtn.click();

    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await signosButton.waitFor({ state: 'visible', timeout: 10000 });
    await signosButton.click();
    await page.waitForTimeout(1000);
    await page.locator('input[name="peso"]').fill('68');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await page.waitForTimeout(2000);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await cerrarButton.isVisible().catch(() => false)) { await cerrarButton.click(); await page.waitForTimeout(1000); }

    try {
      await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
    } catch {
      await page.goto('/Consulta/ConsultaGeneral');
    }
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);

    for (const nombreSeccion of ['Exploración segmentaria', 'Aparatos y sistemas']) {
      console.log(`\n\n========== ${nombreSeccion} ==========`);
      const heading = page.getByRole('heading', { level: 3, name: new RegExp(`^${nombreSeccion}$`, 'i') }).first();
      await heading.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      let scope = heading.locator('xpath=ancestor::*[3]');
      let html = await scope.innerHTML().catch(() => '');
      if (html.length < 200) scope = heading.locator('xpath=ancestor::*[4]');
      html = await scope.innerHTML().catch(() => '');

      // Contar tipos de inputs presentes dentro de la sección
      const counts = await scope.evaluate((el) => {
        const inputs = el.querySelectorAll('input');
        const byType = {};
        inputs.forEach(i => { const t = i.type || i.tagName; byType[t] = (byType[t]||0)+1; });
        const textareas = el.querySelectorAll('textarea').length;
        const selects = el.querySelectorAll('select').length;
        return { byType, textareas, selects, totalInputs: inputs.length };
      });
      console.log('Conteo de controles:', JSON.stringify(counts));

      // Volcar la estructura de la PRIMERA fila/ítem con detalle (labels + inputs cercanos)
      const primerItemHtml = await scope.evaluate((el) => {
        // Buscar el primer contenedor que tenga al menos un input
        const candidatos = Array.from(el.querySelectorAll('div, li, tr')).filter(d => d.querySelector('input'));
        if (!candidatos.length) return 'SIN CANDIDATOS';
        // tomar el más chico (probablemente una fila individual, no todo el bloque)
        candidatos.sort((a,b) => a.innerHTML.length - b.innerHTML.length);
        return candidatos[0].outerHTML;
      });
      console.log('\n--- HTML del primer ítem individual (el más chico con un input) ---');
      console.log(primerItemHtml.substring(0, 1500));
    }

    await page.screenshot({ path: 'test-results/estructura-checklist.png', fullPage: true }).catch(() => {});
  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/estructura-checklist-error.png', fullPage: true }).catch(() => {});
  }

  await page.waitForTimeout(3000);
  await browser.close();
})();
