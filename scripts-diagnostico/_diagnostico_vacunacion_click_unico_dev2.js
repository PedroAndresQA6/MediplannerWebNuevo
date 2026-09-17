// Diagnóstico 2: el clic normal (sin force) al botón "Quitar fecha" de la
// cartilla de vacunación timeoutea a los 5s (Playwright dice que el elemento
// no es "actionable" — probablemente algo lo tapa o no es estable). Confirmar
// qué elemento real recibe el clic en esas coordenadas y por qué Playwright
// lo considera no accionable.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  await page.goto('https://admin-dev.mediplanner.mx/Pacientes');
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
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  const btn = page.locator('table.table-compact button.btn-clear.text-danger').first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  const box = await btn.boundingBox();
  console.log('BoundingBox del botón "Quitar fecha":', box);
  const isVisible = await btn.isVisible();
  const isEnabled = await btn.isEnabled();
  console.log('isVisible:', isVisible, 'isEnabled:', isEnabled);

  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const info = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName, cls: el.className, id: el.id,
        outerHTML: el.outerHTML.substring(0, 250),
        rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      };
    }, { x: cx, y: cy });
    console.log('elementFromPoint en el centro del botón:', JSON.stringify(info, null, 2));

    // Ancestros del propio botón (¿tiene un padre con display:none / opacity:0
    // / pointer-events:none / overflow:hidden que lo recorte visualmente pero
    // deje su bounding box "visible" para Playwright?)
    const ancestros = await btn.evaluate((el) => {
      const chain = [];
      let cur = el;
      for (let i = 0; i < 8 && cur; i++) {
        const cs = getComputedStyle(cur);
        chain.push({
          tag: cur.tagName, cls: cur.className,
          display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
          pointerEvents: cs.pointerEvents, overflow: cs.overflow, position: cs.position, zIndex: cs.zIndex,
        });
        cur = cur.parentElement;
      }
      return chain;
    });
    console.log('Cadena de estilos computados del botón hacia arriba:', JSON.stringify(ancestros, null, 2));
  }

  await page.screenshot({ path: 'test-results/_diag-vacuna-click-unico2.png', fullPage: false });
  await browser.close();
})();
