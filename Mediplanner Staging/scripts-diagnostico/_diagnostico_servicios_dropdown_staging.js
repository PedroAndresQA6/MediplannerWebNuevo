// Confirmatorio del Hallazgo 3 (dev): si el combobox "Agregar servicios" de
// la consulta depende de getProfile (que en dev falla 100% de las veces),
// en STAGING (donde getProfile funciona 7/7, confirmado por separado) el
// combobox debería mostrar opciones con normalidad. Reusa la misma logica
// que Tests_Staging/consultation.full-flow.spec.js para llegar a la pantalla.
//
// Cumple CLAUDE.md §0.7: usa auditarPantalla() (real, sin catches mudos sobre
// la precondicion de carga) antes de interactuar.
const { chromium } = require('@playwright/test');
const { createAppointment, auditarPantalla } = require('./e2e/utils.js');

const PACIENTE_BUSQUEDA = 'Percentil';

async function saltarOnboardingYWizardConfig(page) {
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await explorarLink.click({ force: true }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
  if (await configurarMasTardeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await configurarMasTardeLink.click({ force: true }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-staging.mediplanner.mx/' });
  const page = await context.newPage();

  const todasLasApi = [];
  page.on('response', async (r) => {
    const url = r.url();
    if (!url.includes('/api/')) return;
    const body = await r.text().catch(() => '(no se pudo leer)');
    todasLasApi.push({ url, status: r.status(), body });
  });

  console.log('Creando cita para Percentil en staging...');
  await createAppointment(page, PACIENTE_BUSQUEDA);

  const buscarIniciarDelPaciente = async () => {
    const botones = page.getByRole('button', { name: /iniciar/i });
    const total = await botones.count();
    for (let i = 0; i < total; i++) {
      const btn = botones.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      const texto = (await fila.textContent().catch(() => '') || '');
      if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.toLowerCase())) return btn;
    }
    return null;
  };

  let iniciarBtn = null;
  for (let intento = 1; intento <= 3 && !iniciarBtn; intento++) {
    if (intento === 1) await page.goto('/Dashboard');
    else await page.reload();
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(2000);
    await saltarOnboardingYWizardConfig(page);
    iniciarBtn = await buscarIniciarDelPaciente();
    if (!iniciarBtn) console.log(`⚠️ Botón "Iniciar" no encontrado todavía (intento ${intento}/3)`);
  }
  if (!iniciarBtn) throw new Error('No se encontró botón "Iniciar" tras crear la cita');

  const overlay = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
  if (await overlay.count() > 0 && await overlay.first().isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  await iniciarBtn.click({ force: true });

  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  await signosButton.waitFor({ state: 'visible', timeout: 10000 });
  await signosButton.click();
  await page.waitForTimeout(1000);

  const fill = async (loc, val) => { if (await loc.count() > 0) await loc.first().fill(val).catch(() => {}); };
  await fill(page.locator('input[name="peso"]'), '13');
  await fill(page.locator('input[name*="talla" i]'), '92');
  await fill(page.locator('input[placeholder="000/000 mmHg"]'), '115/075');
  await fill(page.locator('input[name*="temp" i]'), '36.8');
  await fill(page.locator('input[name*="card" i]'), '78');
  await fill(page.locator('input[name="oxigenacion"]'), '97');
  await fill(page.locator('input[name="frecuencia_respiratoria"]'), '18');
  await fill(page.locator('input[name="glucosa"]'), '90');
  await page.waitForTimeout(1500);

  const guardarHabilitado = await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
    return btn && !btn.disabled;
  }, { timeout: 10000 }).then(() => true).catch(() => false);

  if (guardarHabilitado) {
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await page.waitForTimeout(1500);
  } else {
    console.log('⚠️ "Guardar" de signos vitales no se habilitó (puede que staging tenga otros campos obligatorios) — se sigue igual para ver la pantalla de Servicios.');
  }
  const cerrarButton = page.getByRole('button', { name: /cerrar/i });
  if (await cerrarButton.isVisible().catch(() => false)) await cerrarButton.click();

  await auditarPantalla(page, 'Consulta recién cargada en staging (recon Servicios)', { maxWaitMs: 30000 });

  const serviciosHeading = page.getByRole('heading', { level: 3, name: /^Servicios$/i }).first();
  await serviciosHeading.waitFor({ state: 'visible', timeout: 15000 });
  await serviciosHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  console.log('\n--- Abriendo el combobox "Agregar servicios" en STAGING ---');
  const dropdownInput = page.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible').last();
  await dropdownInput.click();
  await page.waitForTimeout(3000);

  const dropdownMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
  const options = dropdownMenu.locator('[class*="option"], [role="option"]');
  const optionCount = await options.count();
  console.log(`\nOpciones encontradas: ${optionCount}`);
  if (optionCount > 0) {
    for (let i = 0; i < optionCount; i++) {
      console.log(`  [${i}] ${(await options.nth(i).textContent().catch(() => '') || '').trim()}`);
    }
  } else {
    const menuText = await dropdownMenu.textContent().catch(() => '(no se pudo leer)');
    console.log(`Texto del menú: "${menuText}"`);
  }

  console.log(`\nLlamadas con "servic" en la URL desde el inicio: ${todasLasApi.filter(c => /servic/i.test(c.url)).length}`);
  todasLasApi.filter(c => /servic/i.test(c.url)).forEach(c => console.log(`  ${c.status} ${c.url.split('/api/')[1]}`));

  const getProfileCalls = todasLasApi.filter(c => c.url.includes('/api/profile/getProfile'));
  console.log(`\ngetProfile en esta corrida: ${getProfileCalls.length} llamadas, status: ${getProfileCalls.map(c => c.status).join(', ')}`);

  await page.screenshot({ path: 'test-results/recon-servicios-dropdown-staging.png', fullPage: true }).catch(() => {});

  await context.storageState({ path: 'storageState.json' });
  await browser.close();
})();
