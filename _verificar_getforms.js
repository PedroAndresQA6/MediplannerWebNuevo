const { chromium } = require('@playwright/test');

const BASE = 'https://admin.mediplanner.mx/';
const PACIENTE_ID = 1778;
const CONSULTA_ID = 1;

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({
    storageState: 'Mediplanner produccion/storageState.json',
    viewport: null,
    baseURL: BASE,
  });
  const page = await context.newPage();

  let token = null;
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !token) {
      const h = req.headers();
      if (h['x-rym-token-app']) token = h['x-rym-token-app'];
    }
  });

  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await explorarLink.click();
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(1500);

  const forms = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
    const resp = await fetch('/api/consultations/getForms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
      body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }),
      credentials: 'include',
    });
    return resp.json();
  }, { pacienteId: PACIENTE_ID, consultaId: CONSULTA_ID, tok: token });

  console.log('=== getForms ===');
  console.log(JSON.stringify(forms, null, 2));

  await browser.close();
})();
