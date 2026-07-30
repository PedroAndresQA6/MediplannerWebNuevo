const { chromium } = require('@playwright/test');
const { handleModals } = require('./e2e/utils.js');
require('dotenv').config({ path: '.env' });

// Reproducción del bug reportado por Pedro (captura de pantalla, 2026-07-27):
// al "Guardar cambios" en una consulta aparece el error "Se necesita asignar
// el tipo de la consulta". Hipótesis: el wizard "Agendar cita" (paso 2, selects
// nativos de Tipo de Consulta + Hospital) no exige elegir ninguno de los 2 para
// avanzar, permitiendo crear una cita/consulta sin esos datos — que luego el
// guardado SÍ valida, dejando al médico en un callejón sin salida.
// Este script agenda una cita a propósito SIN elegir tipo de consulta ni
// hospital en el paso 2, e intenta iniciar esa consulta y guardar cambios.

const PACIENTE_BUSQUEDA = 'Daniela Jiménez';

const hallazgos = [];
function reportar(escenario, severidad, descripcion) {
  hallazgos.push({ escenario, severidad, descripcion });
  console.log(`\n${severidad === 'BUG' ? '🐛' : 'ℹ️'} [${escenario}] ${descripcion}`);
}

async function sectionContainer(page, headingRegex, maxDepth = 10) {
  const heading = page.getByRole('heading', { level: 3, name: headingRegex }).first();
  await heading.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  for (let depth = 2; depth <= maxDepth; depth++) {
    const container = heading.locator(`xpath=ancestor::*[${depth}]`);
    if (await container.count() === 0) continue;
    const box = await container.boundingBox().catch(() => null);
    if (box && box.height > 100) return container;
  }
  return page;
}

async function irADashboard(page) {
  for (let intento = 1; intento <= 3; intento++) {
    if (intento === 1) await page.goto('/Dashboard');
    else await page.reload();
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    const cargando = await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).then(() => false).catch(() => true);
    if (!cargando) return true;
    console.log(`⚠️ Dashboard seguía en "Cargando..." (intento ${intento}/3)`);
  }
  return false;
}

async function pasarOnboardingYWizardConfig(page) {
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('ℹ️ Onboarding detectado — clickeando "Prefiero explorar por mi cuenta"');
    await explorarLink.click({ force: true }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1500);
  }
  const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
  if (await configurarMasTardeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('ℹ️ Wizard de "Configuración de tu cuenta" detectado — clickeando "Configurar más tarde"');
    await configurarMasTardeLink.click({ force: true }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1500);
  }
}

// Variante de createAppointment (e2e/utils.js) que a propósito NO elige
// Tipo de Consulta ni Hospital en el paso 2 del wizard.
async function crearCitaSinTipoNiHospital(page, patientSearch) {
  await page.goto('/Citas');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const agendarButton = page.getByRole('button', { name: /agendar cita/i }).first();
  await agendarButton.waitFor({ state: 'visible', timeout: 10000 });
  await agendarButton.click();

  const wizardHeading = page.getByRole('heading', { name: 'Agendar cita' });
  await wizardHeading.waitFor({ state: 'visible', timeout: 10000 });
  const wizard = wizardHeading.locator('xpath=ancestor::div[.//input][1]');

  const combos = wizard.getByRole('combobox');
  await combos.first().waitFor({ state: 'visible', timeout: 10000 });
  await combos.first().click();
  await page.waitForTimeout(500);
  await combos.first().fill(patientSearch);
  await page.waitForTimeout(2000);
  const optSel = '[id*="react-select"][id*="option"], [role="option"], [class*="option"]';
  let elegido = null;
  for (let intento = 1; intento <= 5 && !elegido; intento++) {
    const opciones = page.locator(optSel);
    const count = await opciones.count();
    for (let k = 0; k < count; k++) {
      const t = (await opciones.nth(k).textContent().catch(() => '') || '').toLowerCase();
      if (t.includes(patientSearch.toLowerCase())) { elegido = opciones.nth(k); break; }
    }
    if (!elegido) await page.waitForTimeout(1000);
  }
  if (!elegido) throw new Error(`No se encontró la opción del paciente "${patientSearch}" en el wizard`);
  await elegido.click();

  const continueBtn = page.getByRole('button', { name: /continuar/i });
  await page.waitForTimeout(1000);
  await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
  await continueBtn.click();
  await page.waitForTimeout(1500);

  // Paso 2: Tipo de Consulta + Hospital — a propósito, NO tocar ninguno.
  const selectsStep2 = page.locator('select:visible');
  const selCount = await selectsStep2.count();
  console.log(`Selects visibles en paso 2: ${selCount}`);
  if (selCount > 0) {
    const val0 = await selectsStep2.nth(0).inputValue().catch(() => null);
    const opts0 = await selectsStep2.nth(0).locator('option').count();
    console.log(`  [0] Tipo de Consulta: ${opts0} opción(es) totales, valor actual = "${val0}"`);
  }
  if (selCount > 1) {
    const val1 = await selectsStep2.nth(1).inputValue().catch(() => null);
    const opts1 = await selectsStep2.nth(1).locator('option').count();
    console.log(`  [1] Hospital: ${opts1} opción(es) totales, valor actual = "${val1}"`);
  }
  await page.screenshot({ path: 'test-results/repro-tipo-consulta-paso2-sin-elegir.png', fullPage: true }).catch(() => {});

  const continueBtn2 = page.getByRole('button', { name: /continuar/i });
  await continueBtn2.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  const habilitado = await continueBtn2.isEnabled().catch(() => false);
  console.log(`Botón "Continuar" (paso 2) habilitado SIN elegir tipo de consulta ni hospital: ${habilitado}`);
  reportar('Wizard-Paso2-SinElegir', 'INFO', `El botón "Continuar" del paso 2 quedó ${habilitado ? 'HABILITADO' : 'DESHABILITADO'} sin elegir tipo de consulta ni hospital.`);

  if (!habilitado) {
    return { avanzo: false };
  }

  await continueBtn2.click();
  await page.waitForTimeout(2000);

  const dateInput = page.locator('input[type="date"]').first();
  await dateInput.waitFor({ state: 'visible', timeout: 10000 });

  for (let dayOffset = 0; dayOffset < 15; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];
    try {
      await dateInput.fill(dateStr);
      await page.waitForTimeout(2000);
      await handleModals(page);
      const hours = page.locator('text=/\\d{2}:\\d{2}/');
      const hourCount = await hours.count();
      if (hourCount === 0) continue;

      let horaSeleccionada = false;
      for (let i = 0; i < Math.min(hourCount, 5); i++) {
        try {
          await hours.nth(i).click({ timeout: 5000 });
          await page.waitForTimeout(1000);
          await handleModals(page);
          const errorModal = page.locator('.swal2-popup, [role="dialog"]:visible');
          if (await errorModal.count() > 0) continue;
          horaSeleccionada = true;
          break;
        } catch { continue; }
      }
      if (!horaSeleccionada) continue;

      await page.getByRole('button', { name: /continuar/i }).click();
      await page.waitForTimeout(1000);
      const confirmarBtn = page.getByRole('button', { name: /confirmar cita/i });
      await confirmarBtn.scrollIntoViewIfNeeded();
      await confirmarBtn.click();
      await page.getByRole('heading', { name: /cita agendada/i }).waitFor({ state: 'visible', timeout: 10000 });
      console.log(`✅ Cita agendada SIN tipo de consulta ni hospital, fecha ${dateStr}`);
      return { avanzo: true };
    } catch (error) {
      console.log(`⚠️ Error en fecha ${dateStr}: ${error.message}`);
      await handleModals(page);
      continue;
    }
  }
  throw new Error('No se pudo agendar la cita (sin tipo/hospital) en los próximos 15 días');
}

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
    console.log(`📅 Agendando cita para "${PACIENTE_BUSQUEDA}" SIN elegir tipo de consulta ni hospital...`);
    const resultadoWizard = await crearCitaSinTipoNiHospital(page, PACIENTE_BUSQUEDA);

    if (!resultadoWizard.avanzo) {
      console.log('\n⚠️ El wizard NO permitió avanzar sin elegir tipo de consulta/hospital.');
      console.log('Probando sub-escenario: elegir SOLO Hospital, dejar Tipo de Consulta sin elegir...');

      // Sub-escenario aislado: reabrir el wizard y esta vez elegir Hospital
      // pero deliberadamente dejar Tipo de Consulta en su opción por defecto,
      // para confirmar si es específicamente ESE campo el que bloquea o no.
      await page.goto('/Citas');
      await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const agendarButton2 = page.getByRole('button', { name: /agendar cita/i }).first();
      await agendarButton2.click();
      const wizardHeading2 = page.getByRole('heading', { name: 'Agendar cita' });
      await wizardHeading2.waitFor({ state: 'visible', timeout: 10000 });
      const wizard2 = wizardHeading2.locator('xpath=ancestor::div[.//input][1]');
      const combos2 = wizard2.getByRole('combobox');
      await combos2.first().click();
      await page.waitForTimeout(500);
      await combos2.first().fill(PACIENTE_BUSQUEDA);
      await page.waitForTimeout(2000);
      const opciones2 = page.locator('[id*="react-select"][id*="option"], [role="option"], [class*="option"]');
      let elegido2 = null;
      for (let k = 0; k < await opciones2.count(); k++) {
        const t = (await opciones2.nth(k).textContent().catch(() => '') || '').toLowerCase();
        if (t.includes(PACIENTE_BUSQUEDA.toLowerCase())) { elegido2 = opciones2.nth(k); break; }
      }
      if (elegido2) await elegido2.click(); else await opciones2.first().click();
      const continueBtn3 = page.getByRole('button', { name: /continuar/i });
      await continueBtn3.click();
      await page.waitForTimeout(1500);

      const selectsPaso2b = page.locator('select:visible');
      if (await selectsPaso2b.count() > 1) {
        const opts1 = await selectsPaso2b.nth(1).locator('option').count();
        if (opts1 > 1) {
          await selectsPaso2b.nth(1).selectOption({ index: 1 });
          console.log('✅ Hospital elegido (índice 1). Tipo de Consulta se deja SIN elegir.');
        }
      }
      await page.waitForTimeout(1000);
      const continueBtn2b = page.getByRole('button', { name: /continuar/i });
      const habilitado2 = await continueBtn2b.isEnabled().catch(() => false);
      reportar('Wizard-Paso2-SoloHospital', 'INFO', `Con Hospital elegido pero Tipo de Consulta SIN elegir, "Continuar" quedó ${habilitado2 ? 'HABILITADO' : 'DESHABILITADO'}.`);
      await page.screenshot({ path: 'test-results/repro-tipo-consulta-solo-hospital.png', fullPage: true }).catch(() => {});

      console.log('\n\n════════════════ RESUMEN (no se llegó a iniciar consulta) ════════════════');
      hallazgos.forEach(h => console.log(`[${h.severidad}] ${h.escenario}: ${h.descripcion}`));
      await page.waitForTimeout(2000);
      await browser.close();
      return;
    }

    console.log('\n🏠 Volviendo a Dashboard para iniciar la cita recién creada...');
    let dashboardOk = await irADashboard(page);
    if (!dashboardOk) throw new Error('El Dashboard no terminó de cargar.');
    await page.waitForTimeout(1500);
    await pasarOnboardingYWizardConfig(page);
    dashboardOk = await irADashboard(page);
    await page.waitForTimeout(1500);
    await pasarOnboardingYWizardConfig(page);

    await page.screenshot({ path: 'test-results/repro-tipo-consulta-dashboard-pre-iniciar.png', fullPage: true }).catch(() => {});

    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    let targetBtn = null;
    for (let i = 0; i < count; i++) {
      const btn = iniciarButtons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      const texto = (await fila.textContent().catch(() => '') || '');
      if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.split(' ')[0].toLowerCase())) { targetBtn = btn; break; }
    }
    if (!targetBtn) throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_BUSQUEDA}" tras crear su cita`);
    await targetBtn.click();

    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await signosButton.waitFor({ state: 'visible', timeout: 10000 });
    await signosButton.click();
    await page.waitForTimeout(1000);
    await page.locator('input[name="peso"]').fill('68');
    const tallaInput = page.locator('input[name*="talla" i]').first();
    if (await tallaInput.count() > 0) await tallaInput.fill('165');
    const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
    if (await presionInput.isVisible().catch(() => false)) await presionInput.fill('120/080');
    const tempInput = page.locator('input[name*="temp" i]');
    if (await tempInput.count() > 0) await tempInput.first().fill('36.5');
    const fcInput = page.locator('input[name*="card" i]');
    if (await fcInput.count() > 0) await fcInput.first().fill('75');
    const satInput = page.locator('input[name="oxigenacion"]');
    if (await satInput.count() > 0) await satInput.first().fill('98');
    const frInput = page.locator('input[name="frecuenciaRespiratoria"]');
    if (await frInput.count() > 0) await frInput.first().fill('16');
    await page.waitForTimeout(1000);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
      return btn && !btn.disabled;
    }, { timeout: 10000 }).catch(() => {});
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await page.waitForTimeout(2000);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await cerrarButton.isVisible().catch(() => false)) { await cerrarButton.click(); await page.waitForTimeout(1000); }

    try {
      await page.waitForURL(/Consulta\/(ConsultaGeneral|ConsultaDetalles)/, { timeout: 15000 });
    } catch {
      await page.goto('/Consulta/ConsultaGeneral');
      await page.waitForLoadState('load').catch(() => {});
    }
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('✅ Consulta iniciada.\n');

    // Confirmar visualmente que Hospital / Tipo consulta quedaron vacíos en "General"
    const generalScope = await sectionContainer(page, /^General$/i);
    const textoGeneral = (await generalScope.innerText().catch(() => '') || '');
    console.log('=== Texto de la sección General (para comparar contra la captura del bug) ===');
    console.log(textoGeneral.split('\n').filter(Boolean).slice(0, 12).join(' | '));
    await page.screenshot({ path: 'test-results/repro-tipo-consulta-seccion-general.png', fullPage: true }).catch(() => {});

    // ═══════════════════════════════════════════════════════════════════
    // Intentar "Guardar cambios" SIN llenar nada más — replica la captura
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n💾 Clickeando "Guardar cambios" sin llenar nada más...');
    const guardarGlobalBtn = page.locator('button:has-text("Guardar cambios")').first();
    await guardarGlobalBtn.waitFor({ state: 'visible', timeout: 10000 });
    await guardarGlobalBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/repro-tipo-consulta-tras-guardar.png', fullPage: true }).catch(() => {});

    const textoTrasGuardar = (await page.locator('body').innerText().catch(() => '') || '');
    const matchTipoConsulta = /tipo.{0,3}de.{0,3}la.{0,3}consulta|asignar.{0,15}tipo/i.test(textoTrasGuardar);
    if (matchTipoConsulta) {
      reportar('Repro-TipoConsulta-GuardarCambios', 'BUG', 'REPRODUCIDO: al clickear "Guardar cambios" en una consulta creada sin tipo de consulta/hospital, apareció un error pidiendo asignar el tipo de la consulta. Screenshot: repro-tipo-consulta-tras-guardar.png');
    } else {
      reportar('Repro-TipoConsulta-GuardarCambios', 'NO-REPRO', 'NO se detectó el mensaje de error esperado tras "Guardar cambios". Revisar screenshot repro-tipo-consulta-tras-guardar.png manualmente.');
    }

    // Intentar también "Finalizar Consulta" para ver si dispara el mismo error
    console.log('\n🏁 Probando también "Finalizar Consulta" sin llenar nada más...');
    const finalizarBtn = page.getByRole('button', { name: /finalizar consulta/i }).first();
    if (await finalizarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await finalizarBtn.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: 'test-results/repro-tipo-consulta-tras-finalizar.png', fullPage: true }).catch(() => {});
      const textoTrasFinalizar = (await page.locator('body').innerText().catch(() => '') || '');
      const matchFinalizar = /tipo.{0,3}de.{0,3}la.{0,3}consulta|asignar.{0,15}tipo/i.test(textoTrasFinalizar);
      reportar('Repro-TipoConsulta-Finalizar', matchFinalizar ? 'BUG' : 'INFO', matchFinalizar
        ? 'REPRODUCIDO también con "Finalizar Consulta": mismo error de tipo de consulta requerido. Screenshot: repro-tipo-consulta-tras-finalizar.png'
        : 'Con "Finalizar Consulta" no se detectó el mismo texto de error (revisar screenshot).');
    }

    if (erroresApi.length > 0) {
      console.log(`\n🔴 ${erroresApi.length} respuesta(s) de API con error durante todo el flujo:`);
      erroresApi.forEach(e => console.log('   ' + e));
    } else {
      console.log('\n✅ 0 respuestas de API con error durante todo el flujo.');
    }

    console.log('\n\n════════════════ RESUMEN DE HALLAZGOS ════════════════');
    hallazgos.forEach(h => console.log(`[${h.severidad}] ${h.escenario}: ${h.descripcion}`));

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/repro-tipo-consulta-error.png', fullPage: true }).catch(() => {});
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
