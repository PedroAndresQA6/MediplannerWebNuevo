// Diagnóstico: el modal "Capturar signos vitales" parece haber cambiado (ahora
// muestra "Rango permitido: X-Y" por campo). Confirmar el name/id real de cada
// input, en especial "Frecuencia Respiratoria" (quedó vacío en la corrida del
// full-flow, dejando "Guardar" deshabilitado).
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  await page.goto('https://admin-dev.mediplanner.mx/Dashboard');
  await page.waitForTimeout(2500);

  const btn = page.getByRole('button', { name: /capturar signos vitales/i });
  if (!(await btn.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.log('No se encontró el botón "Capturar signos vitales" en el Dashboard esta vez.');
    await browser.close();
    return;
  }
  await btn.click();
  await page.waitForTimeout(1500);

  const inputs = page.locator('div.swal2-popup input, [role="dialog"] input, .modal input, input:visible');
  const n = await inputs.count();
  console.log(`Inputs visibles encontrados: ${n}`);
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const name = await el.getAttribute('name').catch(() => null);
    const id = await el.getAttribute('id').catch(() => null);
    const placeholder = await el.getAttribute('placeholder').catch(() => null);
    const label = await el.evaluate(node => {
      const container = node.closest('div');
      return container ? container.parentElement?.querySelector('label,span')?.textContent : null;
    }).catch(() => null);
    console.log(`  [${i}] name="${name}" id="${id}" placeholder="${placeholder}"`);
  }

  await browser.close();
})();
