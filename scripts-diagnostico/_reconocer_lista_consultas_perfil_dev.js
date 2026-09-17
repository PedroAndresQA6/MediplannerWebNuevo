// Reconocimiento (no asume nada) de la estructura real de la lista de
// consultas en perfil del paciente → pestaña "Consultas". El script
// _diagnostico_getfilledform_ui_real_dev.js asumía que cada fila se
// identifica con el texto exacto "Consulta inicial" (copiado de un script
// viejo) y esa asunción resultó falsa — nunca encontró nada en 5 corridas.
// Este script no interactúa con nada más que navegar y mirar: vuelca el HTML
// y el texto de cada fila candidata para elegir un selector real, siguiendo
// el punto 1 de CLAUDE.md (inventario antes de asumir).
const { chromium } = require('@playwright/test');
const { auditarPantalla } = require('../e2e/utils.js');

const PACIENTE_BUSQUEDA = 'Percentil';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx/' });
  const page = await context.newPage();

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 20000 });
  await page.waitForSelector('.rdt_TableRow', { timeout: 15000 });
  const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
  await buscarInput.fill(PACIENTE_BUSQUEDA);
  await page.waitForTimeout(2000);
  const fila = page.locator(`text=/${PACIENTE_BUSQUEDA}/i`).first();
  await fila.waitFor({ state: 'visible', timeout: 10000 });
  await fila.click();
  await page.waitForLoadState('load', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log(`📍 Perfil del paciente: ${page.url()}`);

  const consultasTab = page.getByRole('tab', { name: /^consultas$/i }).or(page.getByText(/^consultas$/i)).first();
  await consultasTab.click();
  await page.waitForTimeout(1500);
  await auditarPantalla(page, 'Lista de consultas (recon)', { maxWaitMs: 15000 });

  console.log('\n=== Texto completo de la pantalla (para ubicar la zona de la lista) ===');
  console.log(await page.locator('body').innerText());

  console.log('\n=== Inventario de candidatos a "fila de consulta" ===');
  // Probar varios contenedores típicos de listas clickeables sin asumir cuál es.
  const selectoresCandidatos = [
    '.rdt_TableRow',
    '[class*="consulta"]',
    'li',
    '[role="listitem"]',
    '[role="button"]',
    'div[class*="card"]',
    'div[class*="item"]',
  ];
  for (const sel of selectoresCandidatos) {
    const loc = page.locator(sel);
    const n = await loc.count();
    if (n === 0) continue;
    console.log(`\n--- selector "${sel}" → ${n} elemento(s) ---`);
    const max = Math.min(n, 8);
    for (let i = 0; i < max; i++) {
      const el = loc.nth(i);
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;
      const texto = ((await el.textContent().catch(() => '')) || '').trim().replace(/\s+/g, ' ').substring(0, 150);
      const clase = (await el.getAttribute('class').catch(() => '')) || '';
      console.log(`  [${i}] visible=${visible} class="${clase.substring(0, 80)}" texto="${texto}"`);
    }
  }

  await page.screenshot({ path: 'logs/recon-lista-consultas.png', fullPage: true });
  console.log('\n📸 Screenshot: logs/recon-lista-consultas.png');

  await page.waitForTimeout(3000);
  await browser.close();
})();
