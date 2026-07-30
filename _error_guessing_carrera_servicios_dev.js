const { chromium } = require('@playwright/test');
const { createAppointment } = require('./e2e/utils.js');
require('dotenv').config({ path: '.env' });

// Error guessing NUEVO (2026-07-30): candidato pareja del de CIE-10 —
// carrera de búsqueda en el combobox "Agregar servicios" de la consulta.

const PACIENTE_BUSQUEDA = process.env.PACIENTE_BUSQUEDA || 'Percentil';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await explorarLink.isVisible({ timeout: 2000 }).catch(() => false)) { await explorarLink.click({ force: true }).catch(() => {}); await page.waitForTimeout(1500); }
  const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
  if (await configurarMasTardeLink.isVisible({ timeout: 2000 }).catch(() => false)) { await configurarMasTardeLink.click({ force: true }).catch(() => {}); await page.waitForTimeout(1500); }

  console.log(`📅 Creando cita para "${PACIENTE_BUSQUEDA}"...`);
  await createAppointment(page, PACIENTE_BUSQUEDA);
  await page.waitForTimeout(1500);

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
    if (intento === 1) await page.goto('/Dashboard'); else await page.reload();
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(2500);
    const explorarLink2 = page.getByText(/prefiero explorar por mi cuenta/i);
    if (await explorarLink2.isVisible({ timeout: 2000 }).catch(() => false)) await explorarLink2.click({ force: true }).catch(() => {});
    const configurarMasTardeLink2 = page.getByText(/configurar más tarde/i);
    if (await configurarMasTardeLink2.isVisible({ timeout: 2000 }).catch(() => false)) await configurarMasTardeLink2.click({ force: true }).catch(() => {});
    iniciarBtn = await buscarIniciarDelPaciente();
  }
  if (!iniciarBtn) throw new Error('No se encontró botón "Iniciar"');
  await iniciarBtn.click();
  await page.waitForTimeout(1500);

  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  if (await signosButton.isVisible({ timeout: 8000 }).catch(() => false)) {
    await signosButton.click();
    await page.waitForTimeout(1000);
    await page.locator('input[name="peso"]').fill('70').catch(() => {});
    const tallaInput = page.locator('input[name*="talla" i]');
    if (await tallaInput.count() > 0) await tallaInput.first().fill('170').catch(() => {});
    const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
    if (await presionInput.isVisible().catch(() => false)) await presionInput.fill('120/080').catch(() => {});
    const tempInput = page.locator('input[name*="temp" i]');
    if (await tempInput.count() > 0) await tempInput.first().fill('36.5').catch(() => {});
    const fcInput = page.locator('input[name*="card" i]');
    if (await fcInput.count() > 0) await fcInput.first().fill('80').catch(() => {});
    const satInput = page.locator('input[name="oxigenacion"]');
    if (await satInput.count() > 0) await satInput.first().fill('98').catch(() => {});
    const frInput = page.locator('input[name="frecuenciaRespiratoria"]');
    if (await frInput.count() > 0) await frInput.first().fill('18').catch(() => {});
    await page.waitForTimeout(500);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
      return btn && !btn.disabled;
    }, { timeout: 10000 }).catch(() => {});
    await page.getByRole('button', { name: /^Guardar$/i }).click().catch(() => {});
    await page.waitForTimeout(1500);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await cerrarButton.isVisible().catch(() => false)) { await cerrarButton.click(); await page.waitForTimeout(1000); }
  }

  await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('✅ En pantalla de Consulta');

  // "Agregar servicios" es el último combobox de la página (sección
  // Servicios, al pie) — apuntar directo por posición evita ambigüedad con
  // instancias ocultas duplicadas (responsive) del mismo texto de label.
  const serviciosInput = page.locator('input[role="combobox"]:visible, input[id*="react-select"]:visible').last();
  await serviciosInput.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await serviciosInput.waitFor({ state: 'visible', timeout: 10000 });
  await serviciosInput.click();
  await page.waitForTimeout(500);

  console.log('\n########## CARRERA: escribir "Consulta" y cambiar a "Certificado" SIN esperar ##########');
  await serviciosInput.fill('Consulta');
  await page.waitForTimeout(150); // muy poco tiempo, no alcanza a resolver
  await serviciosInput.fill('');
  await serviciosInput.fill('Certificado');
  await page.waitForTimeout(2000);

  const dropdownMenu = page.locator('[class*="menu"]:not([class*="sidebar"]):not([class*="nav"])').last();
  const options = dropdownMenu.locator('[class*="option"], [role="option"]');
  const optionCount = await options.count();
  console.log(`Opciones visibles tras la carrera: ${optionCount}`);
  const textos = [];
  for (let i = 0; i < Math.min(optionCount, 8); i++) {
    textos.push((await options.nth(i).textContent().catch(() => '') || '').trim());
  }
  console.log(`Opciones: ${JSON.stringify(textos)}`);

  if (optionCount > 0) {
    const primeraOpcion = textos[0] || '';
    await options.first().click();
    await page.waitForTimeout(500);
    console.log(`Se clickeó (a ciegas): "${primeraOpcion}"`);
    const pareceCertificado = /certificado/i.test(primeraOpcion);
    const pareceConsulta = /consulta/i.test(primeraOpcion) && !pareceCertificado;
    console.log(`¿Corresponde al término final "Certificado"? ${pareceCertificado}`);
    console.log(`¿Corresponde al término anterior "Consulta" (obsoleto)? ${pareceConsulta}`);
    if (pareceConsulta) {
      console.log('⚠️⚠️ HALLAZGO: la carrera de búsqueda en Servicios seleccionó la opción del término ANTERIOR ("Consulta"), no el término final tipeado ("Certificado") — mismo patrón que CIE-10/Medicamento.');
    } else if (pareceCertificado) {
      console.log('✅ El combobox de Servicios se resolvió correctamente al término final pese a la carrera — sin hallazgo.');
    } else {
      console.log('ℹ️ No se pudo clasificar automáticamente — revisar el listado impreso arriba.');
    }
  } else {
    console.log('⚠️ Sin opciones visibles tras la carrera — no se pudo probar este escenario.');
  }
  await page.screenshot({ path: 'test-results/eg-carrera-servicios.png', fullPage: true }).catch(() => {});

  console.log('\n\n=== FIN ===');
  await page.waitForTimeout(20000);
  await browser.close();
})();
