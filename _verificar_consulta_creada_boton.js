const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

const PACIENTE_BUSQUEDA = process.argv[2] || 'Percentil';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({
    storageState: 'storageState.json',
    viewport: null,
    baseURL: base,
  });
  const page = await context.newPage();

  let consultationsBody = null;
  page.on('response', async (r) => {
    if (r.url().includes('/api/consultations/getConsultations')) consultationsBody = await r.json().catch(() => null);
  });

  try {
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForSelector('.rdt_TableRow', { timeout: 15000 }).catch(() => {});
    const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
    await buscarInput.fill(PACIENTE_BUSQUEDA);
    await page.waitForTimeout(2000);
    await page.locator(`text=/${PACIENTE_BUSQUEDA}/i`).first().click();
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const consultasTab = page.locator('button:has-text("Consultas")').first();
    await consultasTab.click();
    await page.waitForTimeout(2500);

    const consultas = consultationsBody?.data?.consultations || [];
    console.log(`\n=== ${consultas.length} consulta(s) encontradas para este paciente ===`);
    consultas
      .sort((a, b) => b.id - a.id)
      .slice(0, 5)
      .forEach(c => console.log(`  id=${c.id} fecha=${c.fecha || c.created_at || '?'} estatus=${c.estatus} hospital_id=${c.hospital_id ?? c.iHospitalId ?? '?'} tipo_cita_id=${c.tipo_cita_id ?? c.appointment_type_id ?? '?'}`));

    await page.screenshot({ path: 'test-results/verificar-tab-consultas.png', fullPage: true }).catch(() => {});

    const masReciente = consultas.reduce((max, c) => (!max || c.id > max.id) ? c : max, null);
    if (masReciente) {
      console.log(`\n▶️ Intentando abrir la consulta más reciente (id=${masReciente.id})...`);
      // Buscar en la tabla visible una fila que corresponda y darle click, o
      // buscar un botón "Continuar"/"Ver"/"Iniciar" en esa fila.
      const filas = page.locator('.rdt_TableRow, tr');
      const total = await filas.count();
      console.log(`Filas visibles en la tabla de consultas: ${total}`);
    }

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/verificar-tab-consultas-error.png', fullPage: true }).catch(() => {});
  }

  console.log('\n\n(Navegador se deja abierto 40s para inspección manual antes de cerrar)');
  await page.waitForTimeout(40000);
  await browser.close();
})();
