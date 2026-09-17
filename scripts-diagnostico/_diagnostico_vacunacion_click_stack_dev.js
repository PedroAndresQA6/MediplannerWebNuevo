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
  const first = trashBtns.first();
  await first.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const btnBox = await first.boundingBox();
  const centroX = btnBox.x + btnBox.width / 2;
  const centroY = btnBox.y + btnBox.height / 2;

  const stack = await page.evaluate(({ x, y }) => {
    return document.elementsFromPoint(x, y).map(el => ({
      tag: el.tagName,
      cls: el.className && typeof el.className === 'string' ? el.className : String(el.className),
      id: el.id,
      rect: el.getBoundingClientRect ? (() => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })() : null,
      zIndex: getComputedStyle(el).zIndex,
      position: getComputedStyle(el).position,
      pointerEvents: getComputedStyle(el).pointerEvents,
    }));
  }, { x: centroX, y: centroY });

  console.log(`Pila completa de elementos en (${centroX}, ${centroY}), de arriba (0) a abajo:`);
  stack.forEach((el, i) => console.log(`  [${i}] <${el.tag}${el.id ? ' id="' + el.id + '"' : ''} class="${el.cls}"> pos=${el.position} z=${el.zIndex} pointer-events=${el.pointerEvents} rect=${JSON.stringify(el.rect)}`));

  // También el HTML crudo de la fila completa para revisarlo a ojo.
  const filaHtml = await first.locator('xpath=ancestor::tr[1]').innerHTML();
  console.log('\n--- HTML de la fila (primeros 3000 chars) ---');
  console.log(filaHtml.substring(0, 3000));

  await browser.close();
})();
