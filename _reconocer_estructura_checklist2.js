const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();
  let consultationsBody = null;
  page.on('response', async (r) => { if (r.url().includes('/api/consultations/getConsultations')) consultationsBody = await r.json().catch(() => null); });

  try {
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForSelector('.rdt_TableRow', { timeout: 15000 }).catch(() => {});
    await page.locator('input[placeholder*="Buscar" i]').first().fill('Percentil');
    await page.waitForTimeout(2000);
    await page.locator('text=/Percentil/i').first().click();
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("Consultas")').first().click();
    await page.waitForTimeout(5000);

    const cons = consultationsBody?.data?.consultations || [];
    const enProgreso = cons.filter(c => c.estatus_id !== 4).sort((a, b) => b.id - a.id);
    console.log(`Consultas NO finalizadas encontradas: ${enProgreso.length}`);
    enProgreso.slice(0, 5).forEach(c => console.log(`  id=${c.id} estatus=${c.estatus} fecha=${c.fecha_creacion} hora=${c.hora_creacion}`));

    if (!enProgreso.length) throw new Error('No hay ninguna consulta en progreso para reabrir');
    const target = enProgreso[0];

    // Buscar en la UI la fila/tarjeta de esa consulta y clickearla para abrirla.
    await page.waitForTimeout(1000);
    const filaConsulta = page.locator(`text=/${target.hora_creacion}/`).first();
    if (await filaConsulta.isVisible({ timeout: 5000 }).catch(() => false)) {
      const contenedor = filaConsulta.locator('xpath=ancestor::*[self::div][3]');
      await contenedor.click({ timeout: 5000 }).catch(async () => { await filaConsulta.click(); });
    } else {
      console.log('⚠️ No se encontró la tarjeta por hora, intentando primer resultado visible...');
      await page.locator('.rdt_TableRow, [class*="card"]').first().click().catch(() => {});
    }
    await page.waitForTimeout(2000);
    console.log('URL tras click:', page.url());

    if (!/Consulta\//.test(page.url())) {
      // Puede que abra un modal "Continuar consulta" en vez de navegar directo.
      const continuarBtn = page.getByRole('button', { name: /continuar|iniciar|ver consulta/i }).first();
      if (await continuarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await continuarBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log('URL final:', page.url());
    await page.screenshot({ path: 'test-results/reabrir-consulta.png', fullPage: true }).catch(() => {});

    for (const nombreSeccion of ['Exploración segmentaria', 'Aparatos y sistemas']) {
      console.log(`\n\n========== ${nombreSeccion} ==========`);
      const heading = page.getByRole('heading', { level: 3, name: new RegExp(`^${nombreSeccion}$`, 'i') }).first();
      const visible = await heading.isVisible({ timeout: 8000 }).catch(() => false);
      if (!visible) { console.log('⚠️ No se encontró el heading de esta sección'); continue; }

      let scope = heading.locator('xpath=ancestor::*[3]');
      let html = await scope.innerHTML().catch(() => '');
      if (html.length < 300) { scope = heading.locator('xpath=ancestor::*[4]'); html = await scope.innerHTML().catch(() => ''); }

      const counts = await scope.evaluate((el) => {
        const inputs = el.querySelectorAll('input');
        const byType = {};
        inputs.forEach(i => { const t = i.type || i.tagName; byType[t] = (byType[t] || 0) + 1; });
        return { byType, textareas: el.querySelectorAll('textarea').length, selects: el.querySelectorAll('select').length, totalInputs: inputs.length, totalLabelsText: el.innerText.substring(0, 300) };
      });
      console.log('Conteo de controles:', JSON.stringify(counts));

      const primerItemHtml = await scope.evaluate((el) => {
        const candidatos = Array.from(el.querySelectorAll('div, li, tr')).filter(d => d.querySelector('input'));
        if (!candidatos.length) return 'SIN CANDIDATOS';
        candidatos.sort((a, b) => a.innerHTML.length - b.innerHTML.length);
        return candidatos[0].outerHTML;
      });
      console.log('\n--- HTML del primer ítem individual ---');
      console.log(primerItemHtml.substring(0, 2000));
    }
  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/reabrir-consulta-error.png', fullPage: true }).catch(() => {});
  }

  await page.waitForTimeout(3000);
  await browser.close();
})();
