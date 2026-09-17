// Diagnostico puntual (2026-09-10, pedido por Pedro): investigar por que el
// combobox "Agregar servicios" de la seccion Servicios de una consulta
// aparece con 0 opciones ("No se encontraron elementos"). Se captura TODA la
// red (no solo /api/) al abrir el combobox, para ver que endpoint (si alguno)
// se dispara y que responde -- confirmar si es el mismo patron de
// inestabilidad de backend del Hallazgo 2 (getProfile/getDrHospitals 500) o
// un problema propio del catalogo de servicios.
//
// Cumple CLAUDE.md §0.7: usa auditarPantalla() (sin catches mudos sobre la
// precondicion de carga) antes de interactuar.
const { chromium } = require('@playwright/test');
const { createAppointment, buscarBotonIniciarDePaciente, auditarPantalla } = require('../e2e/utils.js');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx/' });
  const page = await context.newPage();

  const llamadasRelevantes = [];
  const todasLasApi = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/servic/i.test(url)) {
      console.log(`📤 REQUEST ${req.method()} ${url}`);
      if (req.postData()) console.log(`   postData: ${req.postData()}`);
    }
  });
  page.on('response', async (r) => {
    const url = r.url();
    if (!url.includes('/api/')) return;
    const body = await r.text().catch(() => '(no se pudo leer body)');
    todasLasApi.push({ url, status: r.status(), body });
    if (/servic/i.test(url)) {
      console.log(`📥 RESPONSE ${r.status()} ${url}`);
      console.log(`   body: ${body.substring(0, 500)}`);
      llamadasRelevantes.push({ url, status: r.status(), body: body.substring(0, 500) });
    }
  });

  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});

  console.log('Creando cita para Percentil...');
  await createAppointment(page, 'Percentil');
  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);

  const iniciarBtn = await buscarBotonIniciarDePaciente(page, 'Percentil');
  if (!iniciarBtn) throw new Error('No se encontro boton Iniciar');
  await iniciarBtn.click({ force: true });

  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  await signosButton.waitFor({ state: 'visible', timeout: 10000 });
  await signosButton.click();
  await page.waitForTimeout(1000);

  await page.locator('input[name="peso"]').fill('13');
  await page.locator('input[name*="talla" i]').first().fill('92');
  await page.locator('input[placeholder="000/000 mmHg"]').fill('115/075');
  await page.locator('input[name*="temp" i]').first().fill('36.8');
  await page.locator('input[name*="card" i]').first().fill('78');
  await page.locator('input[name="oxigenacion"]').fill('97');
  await page.locator('input[name="frecuencia_respiratoria"]').fill('18');
  const glucosaInput = page.locator('input[name="glucosa"]');
  if (await glucosaInput.count() > 0) await glucosaInput.fill('90');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
    return btn && !btn.disabled;
  }, { timeout: 10000 });
  await page.getByRole('button', { name: /^Guardar$/i }).click();
  await page.waitForTimeout(1500);
  const cerrarButton = page.getByRole('button', { name: /cerrar/i });
  if (await cerrarButton.isVisible().catch(() => false)) await cerrarButton.click();

  await auditarPantalla(page, 'Consulta recién cargada (recon Servicios dropdown)', { maxWaitMs: 30000 });

  // Ir directo a la sección Servicios (al final de la página) sin llenar nada más.
  const serviciosHeading = page.getByRole('heading', { level: 3, name: /^Servicios$/i }).first();
  await serviciosHeading.waitFor({ state: 'visible', timeout: 15000 });
  await serviciosHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  console.log('\n--- Abriendo el combobox "Agregar servicios" ---');
  const dropdownInput = page.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible').last();
  await dropdownInput.click();
  await page.waitForTimeout(3000);

  const dropdownMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
  const options = dropdownMenu.locator('[class*="option"], [role="option"]');
  const optionCount = await options.count();
  console.log(`\nOpciones encontradas tras abrir: ${optionCount}`);
  const menuText = await dropdownMenu.textContent().catch(() => '(no se pudo leer)');
  console.log(`Texto del menu desplegado: "${menuText}"`);

  console.log(`\nLlamadas de red con "servic" en la URL detectadas: ${llamadasRelevantes.length}`);
  if (llamadasRelevantes.length === 0) {
    console.log('⚠️ NINGUNA llamada de red relacionada con "servicios" se disparó al abrir el combobox -- la lista podría venir de datos ya cargados antes (ej. junto con getConsultation/getCatalogs al entrar a la pantalla), no de una llamada nueva.');
  }

  console.log(`\n--- Buscando "servici" en el BODY de las ${todasLasApi.length} responses de /api/ capturadas desde el inicio ---`);
  for (const call of todasLasApi) {
    if (/servici/i.test(call.body)) {
      console.log(`\n🔎 Match en ${call.status} ${call.url}`);
      console.log(`   body (hasta 1500 chars): ${call.body.substring(0, 1500)}`);
    }
  }
  console.log('\n--- Todas las URLs /api/ llamadas, en orden (para ver si falta algo esperable) ---');
  todasLasApi.forEach(c => console.log(`  ${c.status} ${c.url.split('/api/')[1]}`));

  console.log('\n--- Body COMPLETO de cada getCatalogs capturada ---');
  todasLasApi.filter(c => c.url.includes('/api/catalogs/getCatalogs')).forEach((c, i) => {
    console.log(`\n=== getCatalogs #${i + 1} ===`);
    console.log(c.body);
  });

  await page.screenshot({ path: 'test-results/recon-servicios-dropdown-vacio.png', fullPage: true }).catch(() => {});

  await context.storageState({ path: 'storageState.json' });
  await browser.close();
})();
