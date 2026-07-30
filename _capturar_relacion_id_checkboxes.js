const { chromium } = require('@playwright/test');

// Captura el relacion_id REAL que usa la app de producción para Exploración
// segmentaria / Aparatos y sistemas, abriendo la consulta ya finalizada
// (id=1, paciente "Prueba DE Codigo") y observando cualquier llamada de red
// relacionada a formularios, en vez de asumir los relacion_id de dev (116/115).

const BASE = 'https://admin.mediplanner.mx/';
const PACIENTE_BUSQUEDA = 'Prueba DE Codigo';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({
    storageState: 'Mediplanner produccion/storageState.json',
    viewport: null,
    baseURL: BASE,
  });
  const page = await context.newPage();

  const llamadasRelevantes = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('getFilledForm') || url.includes('Form') || url.includes('registerAnswers')) {
      llamadasRelevantes.push({ url, method: req.method(), body: req.postData() });
    }
  });

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('.rdt_TableRow', { timeout: 20000 });
  const buscar = page.locator('input[placeholder*="Buscar" i]').first();
  await buscar.fill(PACIENTE_BUSQUEDA);
  await page.waitForTimeout(2000);
  const fila = page.locator('span.font-semibold.text-sm.text-gray-900', { hasText: PACIENTE_BUSQUEDA }).first();
  await fila.click();
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);

  const consultasTab = page.locator('button:has-text("Consultas")').first();
  await consultasTab.click();
  await page.waitForTimeout(2000);

  // Abrir la única consulta existente (id=1) desde la lista de tarjetas.
  const filaConsulta = page.locator('text=/Paciente acude a consulta por cefalea/i').first();
  if (await filaConsulta.isVisible({ timeout: 5000 }).catch(() => false)) {
    await filaConsulta.click();
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  } else {
    console.log('⚠️ No se encontró la tarjeta de consulta para abrir en la lista.');
  }

  console.log(`URL actual: ${page.url()}`);
  await page.screenshot({ path: 'Mediplanner produccion/test-results/consulta-reabierta.png', fullPage: true });

  console.log(`\n=== Llamadas relacionadas a formularios/respuestas capturadas: ${llamadasRelevantes.length} ===`);
  llamadasRelevantes.forEach(l => {
    console.log(`${l.method} ${l.url}`);
    if (l.body) console.log(`  body: ${l.body}`);
  });

  await page.waitForTimeout(2000);
  await browser.close();
})();
