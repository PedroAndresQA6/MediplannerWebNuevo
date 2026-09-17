const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--start-maximized'] });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();
  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const html = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, [class*="sidebar"] *'));
    const found = els.filter(e => e.textContent.trim() === 'Ingresos' && e.children.length === 0);
    return found.map(e => ({
      tag: e.tagName,
      cls: e.className,
      parentTag: e.parentElement?.tagName,
      parentCls: e.parentElement?.className,
      grandparentTag: e.parentElement?.parentElement?.tagName,
      grandparentCls: e.parentElement?.parentElement?.className,
    }));
  });
  console.log(JSON.stringify(html, null, 2));

  await browser.close();
})();
