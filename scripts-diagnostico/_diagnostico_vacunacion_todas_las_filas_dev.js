// Pedro señaló que a mano SÍ puede borrar clickeando el ícono rojo de
// basurero -- contradice el hallazgo anterior (probado solo con el PRIMER
// boton encontrado, que resultó ser de la fila HEXAVALENTE con 4 columnas de
// dosis). Este script revisa TODOS los botones de borrar visibles en la
// cartilla de "Agustin Tapia" (la más cargada, con casi todas las vacunas con
// dosis), midiendo para cada uno si su centro está realmente cubierto por
// otro elemento (el input de fecha vecino) o no -- para saber si el problema
// es general o solo de las filas con más columnas (Influenza x6, Hexavalente
// x4, Pentavalente x4) y no de las de 2-3 columnas.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1536,912', '--window-position=0,0'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: { width: 1536, height: 912 }, deviceScaleFactor: 1, baseURL: 'https://admin-dev.mediplanner.mx' });
  const page = await context.newPage();

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('span.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const pageSize = page.locator('select').first();
  if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.locator('span.font-semibold.text-sm.text-gray-900', { hasText: 'Agustin Tapia' }).first().click();
  await page.waitForTimeout(3000);
  await page.locator('text=/^\\s*Vacunación\\s*$/i').first().click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});

  const table = page.locator('table.table-compact');
  const trashBtns = table.locator('button.btn-clear.text-danger');
  const total = await trashBtns.count();
  console.log(`Total de botones de borrar en la cartilla: ${total}\n`);

  let cubiertos = 0;
  let libres = 0;

  for (let i = 0; i < total; i++) {
    const btn = trashBtns.nth(i);
    await btn.scrollIntoViewIfNeeded();
    const box = await btn.boundingBox();
    if (!box) { console.log(`[${i}] sin bounding box (no visible), saltando`); continue; }

    // Nombre de la vacuna (primera celda de la fila) y etiqueta de la dosis (columna).
    const fila = btn.locator('xpath=ancestor::tr[1]');
    const nombreVacuna = (await fila.locator('td').first().textContent().catch(() => '') || '').trim();
    const celda = btn.locator('xpath=ancestor::td[1]');
    const etiquetaDosis = (await celda.locator('div.text-gray-500').first().textContent().catch(() => '') || '').trim();

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const elementoReal = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.tagName : null;
    }, { x: cx, y: cy });

    const cubierto = elementoReal !== 'BUTTON' && elementoReal !== 'svg' && elementoReal !== 'SVG' && elementoReal !== 'path' && elementoReal !== 'PATH';
    if (cubierto) cubiertos++; else libres++;
    console.log(`[${i}] ${nombreVacuna} / ${etiquetaDosis}: centro=(${cx.toFixed(0)},${cy.toFixed(0)}) → elemento real ahí = ${elementoReal} ${cubierto ? '❌ TAPADO' : '✅ libre'}`);
  }

  console.log(`\nResumen: ${libres} botones libres (el clic sí llegaría), ${cubiertos} tapados (el clic NO llegaría) de ${total} totales.`);

  await browser.close();
})();
