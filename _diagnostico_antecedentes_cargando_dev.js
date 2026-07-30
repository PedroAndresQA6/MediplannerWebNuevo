const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

const PACIENTE_BUSQUEDA = process.argv[2] || 'QARepro2';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  const erroresApi = [];
  const llamadasAntecedentes = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/')) {
      if (r.status() >= 400) erroresApi.push(`${r.status()} ${r.url()}`);
      if (/antecedente|form|pregunta/i.test(r.url())) {
        const body = await r.json().catch(() => null);
        llamadasAntecedentes.push(`${r.status()} ${r.url().split('/api/')[1]} → ${JSON.stringify(body).substring(0, 250)}`);
      }
    }
  });

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForSelector('.rdt_TableRow', { timeout: 15000 }).catch(() => {});
  const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
  await buscarInput.fill(PACIENTE_BUSQUEDA);
  await page.waitForTimeout(2000);
  const fila = page.locator(`text=/${PACIENTE_BUSQUEDA}/i`).first();
  await fila.waitFor({ state: 'visible', timeout: 10000 });
  await fila.click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const antecedentesTab = page.getByText(/^antecedentes$/i).first();
  await antecedentesTab.click();
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});

  console.log('⏳ Esperando hasta 20s a que "Cargando preguntas" desaparezca...');
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    const texto = await page.locator('body').innerText().catch(() => '');
    const cargandoCount = (texto.match(/Cargando preguntas/gi) || []).length;
    console.log(`  [t=${(i + 1) * 2}s] "Cargando preguntas" aparece ${cargandoCount} vez(es)`);
    if (cargandoCount === 0) {
      console.log('✅ Ya no aparece "Cargando preguntas" — resolvió.');
      break;
    }
  }
  await page.screenshot({ path: 'test-results/diag-antecedentes-tras-espera.png', fullPage: true }).catch(() => {});

  console.log(`\n🔴 Errores de API (${erroresApi.length}):`);
  erroresApi.forEach(e => console.log('   ' + e));
  console.log(`\n📥 Llamadas relacionadas a antecedentes/formularios/preguntas (${llamadasAntecedentes.length}):`);
  llamadasAntecedentes.forEach(l => console.log('   ' + l));

  await page.waitForTimeout(10000);
  await browser.close();
})();
