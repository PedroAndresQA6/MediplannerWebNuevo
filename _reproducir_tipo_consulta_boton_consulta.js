const { chromium } = require('@playwright/test');
const { handleModals } = require('./e2e/utils.js');
require('dotenv').config({ path: '.env' });

// Reproducción confirmada por Pedro (captura de pantalla): dentro del perfil
// de un paciente, el botón "Consulta" (atajo, distinto de "Agendar") abre un
// modal "Seleccionar Tipo de Cita y Hospital" con 3 selects (Tipo de Cita /
// Hospital / Modo) cuyo botón "Crear consulta" NO exige elegir Tipo de Cita
// ni Hospital — se puede crear la consulta dejándolos en su valor por
// defecto ("Sin cita" / "Seleccione un hospital"). Esto reproduce el bug
// original: al llegar a la consulta y clickear "Guardar cambios" aparece
// "Se necesita asignar el tipo de la consulta".

const PACIENTE_BUSQUEDA = process.argv[2] || 'QATipo';

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

  const erroresApi = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`);
  });

  try {
    console.log(`🔎 Buscando paciente "${PACIENTE_BUSQUEDA}" en /Pacientes...`);
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForSelector('.rdt_TableRow', { timeout: 15000 }).catch(() => {});
    const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
    await buscarInput.fill(PACIENTE_BUSQUEDA);
    await page.waitForTimeout(2000);

    const filaPaciente = page.locator(`text=/${PACIENTE_BUSQUEDA}/i`).first();
    await filaPaciente.waitFor({ state: 'visible', timeout: 10000 });
    const nombreCompleto = (await filaPaciente.textContent().catch(() => '') || '').trim();
    console.log(`✅ Paciente encontrado: "${nombreCompleto}" — entrando a su perfil...`);
    await filaPaciente.click();
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log(`📍 URL del perfil: ${page.url()}`);

    const consultaBtn = page.getByRole('button', { name: /^consulta$/i }).first();
    await consultaBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('\n▶️ Clickeando el botón "Consulta" (atajo del perfil, NO "Agendar")...');
    await consultaBtn.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/repro-boton-consulta-modal.png', fullPage: true }).catch(() => {});

    const modalHeading = page.getByText(/seleccionar tipo de cita y hospital/i);
    if (!(await modalHeading.isVisible({ timeout: 5000 }).catch(() => false))) {
      throw new Error('No apareció el modal "Seleccionar Tipo de Cita y Hospital" tras clickear "Consulta"');
    }
    console.log('✅ Modal "Seleccionar Tipo de Cita y Hospital" visible.');

    const modal = modalHeading.locator('xpath=ancestor::div[.//button][1]');
    const selects = modal.locator('select:visible');
    const selCount = await selects.count();
    console.log(`Selects en el modal: ${selCount}`);
    for (let i = 0; i < selCount; i++) {
      const val = await selects.nth(i).inputValue().catch(() => null);
      const texto = await selects.nth(i).evaluate(el => el.options[el.selectedIndex]?.text || '').catch(() => '');
      console.log(`  [select ${i}] valor="${val}" texto visible="${texto}"`);
    }

    // A propósito: NO tocar ningún select. Ir directo a "Crear consulta".
    const crearConsultaBtn = modal.getByRole('button', { name: /crear consulta/i }).first();
    await crearConsultaBtn.waitFor({ state: 'visible', timeout: 5000 });
    const habilitado = await crearConsultaBtn.isEnabled().catch(() => false);
    console.log(`\nBotón "Crear consulta" habilitado SIN elegir tipo de cita ni hospital: ${habilitado}`);

    if (!habilitado) {
      console.log('⚠️ "Crear consulta" está deshabilitado — NO se reproduce por este camino tal cual. Revisar screenshot.');
      await page.waitForTimeout(20000);
      await browser.close();
      return;
    }

    console.log('💥 Clickeando "Crear consulta" SIN tipo de cita ni hospital...');
    await crearConsultaBtn.click();
    await page.waitForTimeout(3000);
    await handleModals(page);
    await page.waitForTimeout(1000);

    console.log(`\n📍 URL tras "Crear consulta": ${page.url()}`);
    await page.screenshot({ path: 'test-results/repro-boton-consulta-tras-crear.png', fullPage: true }).catch(() => {});

    // Puede caer directo en /Consulta/ConsultaGeneral, o pedir signos vitales primero.
    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    if (await signosButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('ℹ️ Pidió capturar signos vitales — llenando mínimo...');
      await signosButton.click();
      await page.waitForTimeout(1000);
      const pesoInput = page.locator('input[name="peso"]');
      if (await pesoInput.isVisible().catch(() => false)) await pesoInput.fill('68');
      await page.waitForTimeout(500);
      const guardarSignosBtn = page.getByRole('button', { name: /^Guardar$/i });
      if (await guardarSignosBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await guardarSignosBtn.click();
        await page.waitForTimeout(1500);
      }
      const cerrarButton = page.getByRole('button', { name: /cerrar/i });
      if (await cerrarButton.isVisible().catch(() => false)) { await cerrarButton.click(); await page.waitForTimeout(1000); }
    }

    try {
      await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 10000 });
    } catch { /* puede que ya estemos ahí */ }
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log(`📍 URL final: ${page.url()}`);

    // Confirmar visualmente el estado de Hospital/Tipo consulta en "General".
    const generalHeading = page.getByRole('heading', { level: 3, name: /^General$/i }).first();
    if (await generalHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
      const scope = generalHeading.locator('xpath=ancestor::*[3]');
      const textoGeneral = (await scope.innerText().catch(() => '') || '');
      console.log('\n=== Sección General (para comparar contra la captura del bug) ===');
      console.log(textoGeneral.split('\n').filter(Boolean).slice(0, 10).join(' | '));
    }
    await page.screenshot({ path: 'test-results/repro-boton-consulta-general.png', fullPage: true }).catch(() => {});

    console.log('\n💾 Clickeando "Guardar cambios" sin llenar nada más...');
    const guardarGlobalBtn = page.locator('button:has-text("Guardar cambios")').first();
    if (await guardarGlobalBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await guardarGlobalBtn.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: 'test-results/repro-boton-consulta-tras-guardar.png', fullPage: true }).catch(() => {});

      const textoTrasGuardar = (await page.locator('body').innerText().catch(() => '') || '');
      const matchTipoConsulta = /tipo.{0,3}de.{0,3}la.{0,3}consulta|asignar.{0,15}tipo/i.test(textoTrasGuardar);
      if (matchTipoConsulta) {
        console.log('\n🐛 REPRODUCIDO: al clickear "Guardar cambios" apareció el error pidiendo asignar el tipo de la consulta.');
        console.log('   Screenshot: repro-boton-consulta-tras-guardar.png');
      } else {
        console.log('\nℹ️ NO se detectó el texto de error esperado. Revisar screenshot repro-boton-consulta-tras-guardar.png manualmente.');
        console.log('Texto visible tras guardar (primeras líneas):');
        console.log(textoTrasGuardar.split('\n').filter(Boolean).slice(0, 15).join(' | '));
      }
    } else {
      console.log('⚠️ No se encontró el botón "Guardar cambios" en la consulta.');
    }

    if (erroresApi.length > 0) {
      console.log(`\n🔴 ${erroresApi.length} respuesta(s) de API con error durante todo el flujo:`);
      erroresApi.forEach(e => console.log('   ' + e));
    } else {
      console.log('\n✅ 0 respuestas de API con error durante todo el flujo.');
    }

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/repro-boton-consulta-error.png', fullPage: true }).catch(() => {});
  }

  console.log('\n\n(Navegador se deja abierto 25s para inspección manual antes de cerrar)');
  await page.waitForTimeout(25000);
  await browser.close();
})();
