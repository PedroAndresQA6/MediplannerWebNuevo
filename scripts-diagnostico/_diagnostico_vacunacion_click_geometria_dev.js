// Hallazgo pendiente: el clic sobre el boton de borrar ("Quitar fecha") de
// una dosis de Vacunacion no registra el borrado -- Playwright reporta que el
// input[type=date] de la misma celda "intercepta los eventos de puntero" en
// el punto donde intentaria clickear. Este script mide la geometria real
// (bounding boxes) de ambos elementos para confirmar si de verdad se
// superponen visualmente o es un artefacto de cómo Playwright calcula el
// punto de clic (el centro del elemento, que puede no ser el area visible del
// icono), y despues intenta un clic real por coordenadas en un punto que SI
// esta libre, para ver si asi si funciona.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx' });
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
  await page.getByText(/^\s*Vacunación\s*$/i).first().click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  const table = page.locator('table.table-compact');
  const trashBtns = table.locator('button.btn-clear.text-danger');
  const before = await trashBtns.count();
  console.log('Trash buttons antes:', before);

  const first = trashBtns.first();
  await first.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // Bounding box del boton y de su input hermano (misma celda).
  const cellda = first.locator('xpath=ancestor::td[1]');
  const dateInputEnCelda = cellda.locator('input[type="date"]');

  const btnBox = await first.boundingBox();
  const inputBox = await dateInputEnCelda.boundingBox();
  console.log('Bounding box del boton trash:', JSON.stringify(btnBox));
  console.log('Bounding box del input de fecha en la misma celda:', JSON.stringify(inputBox));

  // ¿Que elemento hay REALMENTE en el centro del boton, segun el DOM?
  const centroX = btnBox.x + btnBox.width / 2;
  const centroY = btnBox.y + btnBox.height / 2;
  const elementoEnCentro = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? { tag: el.tagName, cls: el.className, title: el.getAttribute('title') } : null;
  }, { x: centroX, y: centroY });
  console.log(`Elemento real en el centro del boton (${centroX}, ${centroY}):`, JSON.stringify(elementoEnCentro));

  await page.screenshot({ path: 'test-results/_diag-geometria-zoom.png', clip: { x: Math.max(0, btnBox.x - 60), y: Math.max(0, btnBox.y - 20), width: 200, height: 60 } }).catch(() => {});

  console.log('\n--- Intentando clic por coordenadas exactas del boton (mouse.click, no locator.click) ---');
  await page.mouse.click(centroX, centroY);
  await page.waitForTimeout(1500);
  const after1 = await trashBtns.count();
  console.log('Trash buttons tras mouse.click en el centro:', after1, after1 < before ? '✅ CAMBIÓ' : '⚠️ sin cambio');

  if (after1 === before) {
    // Probar un punto un poco mas arriba (el icono suele estar centrado pero
    // el hitbox del boton completo puede ser mas alto que el icono visible).
    const yAlternativo = btnBox.y + btnBox.height * 0.3;
    console.log(`\n--- Reintentando en un punto distinto del boton (${centroX}, ${yAlternativo}) ---`);
    await page.mouse.click(centroX, yAlternativo);
    await page.waitForTimeout(1500);
    const after2 = await trashBtns.count();
    console.log('Trash buttons tras 2do intento:', after2, after2 < before ? '✅ CAMBIÓ' : '⚠️ sin cambio');
  }

  await page.screenshot({ path: 'test-results/_diag-geometria-final.png', fullPage: false }).catch(() => {});

  await browser.close();
})();
