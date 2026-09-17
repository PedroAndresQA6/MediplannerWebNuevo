// Diagnóstico 2: profundizar por qué clickear "Servicios" no navega.
// Prueba: (a) click SIN force (para ver si hay un elemento interceptando),
// (b) esperar más tiempo tras cargar Ajustes antes de clickear,
// (c) click directo con mouse en las coordenadas del tab,
// (d) revisar si hay un <a href> real bajo el tab.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  page.on('response', r => { if (r.url().includes('/api/') && r.status() >= 400) console.log('API ERROR:', r.status(), r.url()); });

  await page.goto('https://admin-dev.mediplanner.mx/Dashboard');
  await page.waitForTimeout(2000);
  await page.locator('a:has-text("Ajustes")').first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000); // esperar más, por si el tab no estaba listo
  console.log('URL tras click en Ajustes:', page.url());

  const tab = page.getByText('Servicios', { exact: true }).first();
  const box = await tab.boundingBox();
  console.log('BoundingBox de "Servicios":', box);

  // Ver qué elemento responde realmente en esas coordenadas (elementFromPoint)
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const elAtPoint = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    return { tag: el.tagName, cls: el.className, text: el.textContent?.slice(0, 40), outerHTML: el.outerHTML.slice(0, 300) };
  }, { x: centerX, y: centerY });
  console.log('Elemento en el punto central del tab "Servicios":', JSON.stringify(elAtPoint, null, 2));

  // Buscar el ancestro clickeable (li/a/button) del span "Servicios"
  const ancestorInfo = await tab.evaluate(el => {
    let cur = el;
    const chain = [];
    for (let i = 0; i < 5 && cur; i++) {
      chain.push({ tag: cur.tagName, cls: cur.className, href: cur.getAttribute ? cur.getAttribute('href') : null });
      cur = cur.parentElement;
    }
    return chain;
  });
  console.log('Cadena de ancestros del span "Servicios":', JSON.stringify(ancestorInfo, null, 2));

  console.log('\nIntentando click SIN force...');
  try {
    await tab.click({ timeout: 5000 });
    console.log('Click sin force OK');
  } catch (e) {
    console.log('Click sin force FALLÓ:', e.message.split('\n')[0]);
  }
  await page.waitForTimeout(2000);
  console.log('URL tras click sin force:', page.url());

  // Intentar clic real por mouse en coordenadas de pantalla
  await page.mouse.click(centerX, centerY);
  await page.waitForTimeout(2000);
  console.log('URL tras page.mouse.click:', page.url());

  await page.screenshot({ path: 'test-results/_diag2-tras-mouse-click.png', fullPage: false });

  await browser.close();
})();
