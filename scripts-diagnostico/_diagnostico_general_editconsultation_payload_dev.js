// Diagnostico puntual: ¿el editConsultation que se dispara automaticamente al
// elegir el CIE-10 en Diagnostico manda los campos de General (motivo,
// padecimiento, notas_evolucion, nombre_referido) con lo recien tipeado, o
// con una foto vieja/vacia? Reproduce el minimo necesario: iniciar consulta,
// pasar signos vitales, llenar SOLO General, y despues tocar el combobox de
// CIE-10 en Diagnostico -- capturando el body real del POST a editConsultation.
//
// TOCAR_CIE10=0 node _diagnostico_....js  -> corrida de CONTROL: llena General
// y espera lo mismo que tardaria el paso de CIE-10, pero SIN tocar Diagnostico,
// para confirmar que el vaciado es causado especificamente por esa interaccion
// y no por el mero paso del tiempo / otra cosa que pasa en simultaneo.
const TOCAR_CIE10 = process.env.TOCAR_CIE10 !== '0';
const { chromium } = require('@playwright/test');
const { createAppointment, buscarBotonIniciarDePaciente } = require('../e2e/utils.js');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx/' });
  const page = await context.newPage();

  page.on('request', (req) => {
    if (req.url().includes('/api/consultations/editConsultation')) {
      console.log('\n=== editConsultation REQUEST ===');
      console.log('postData:', req.postData());
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/consultations/editConsultation')) {
      console.log('=== editConsultation RESPONSE ===', r.status(), await r.text().catch(() => ''));
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

  // OJO (2026-09-10, señalado por Pedro viendo la corrida anterior en
  // pantalla): el chequeo viejo (`!innerText.includes('Cargando información
  // de consulta')` + `.catch(() => {})`) no prueba nada -- si el spinner real
  // es otro (o ese texto exacto cambia), la condición se cumple falsa de
  // entrada, y el catch traga cualquier timeout igual. En vez de adivinar el
  // selector del spinner, se espera algo concreto e innegable: la respuesta
  // real de getConsultation Y que el campo "Motivo de consulta" esté visible
  // y habilitado -- sin catch, para que truene si no se cumple en vez de
  // seguir de largo en silencio. Además se saca un screenshot para poder
  // confirmarlo a ojo, no solo por el DOM.
  await page.waitForResponse(r => /\/api\/consultations\/getConsultation\b/.test(r.url()), { timeout: 20000 });
  const motivoInputReady = page.locator('textarea[name="visitaPaciente"]');
  await motivoInputReady.waitFor({ state: 'visible', timeout: 20000 });
  await motivoInputReady.waitFor({ state: 'attached', timeout: 5000 });
  if (!(await motivoInputReady.isEnabled())) throw new Error('El campo Motivo de consulta está visible pero deshabilitado -- la consulta no terminó de cargar');

  // 2026-09-10, hallado con un screenshot (Pedro señaló que no se esperaba la
  // carga real): hay un SEGUNDO overlay ("Recuperando datos del paciente...")
  // que tapa toda la pantalla con blur, independiente del texto "Cargando
  // información de consulta" y de que el campo Motivo ya esté visible/
  // habilitado en el DOM. Sin esto, se escribe mientras la página sigue
  // trayendo datos en segundo plano. Se espera a que el overlay desaparezca
  // DE VERDAD (sin catch) antes de seguir.
  const overlayRecuperando = page.getByText('Recuperando datos del paciente', { exact: false });
  if (await overlayRecuperando.isVisible().catch(() => false)) {
    console.log('⏳ Overlay "Recuperando datos del paciente..." visible, esperando a que desaparezca...');
    await overlayRecuperando.waitFor({ state: 'hidden', timeout: 30000 });
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/repro-general-cie10-antes-de-llenar.png', fullPage: true }).catch(() => {});
  console.log('✅ Consulta cargada de verdad (getConsultation respondió + campo Motivo visible/habilitado + overlay "Recuperando datos" ausente). Screenshot: test-results/repro-general-cie10-antes-de-llenar.png');

  const MOTIVO = 'DIAGNOSTICO-REPRO: motivo escrito ANTES de tocar CIE-10';
  const PADECIMIENTO = 'DIAGNOSTICO-REPRO: padecimiento escrito ANTES de tocar CIE-10';
  const NOTAS = 'DIAGNOSTICO-REPRO: notas de evolucion ANTES de tocar CIE-10';
  const REFERIDO = 'DIAGNOSTICO-REPRO: nombre referido';

  console.log('\n--- Llenando SOLO General (sin guardar nada todavia) ---');
  const motivoInput = page.locator('textarea[name="visitaPaciente"]');
  await motivoInput.fill(MOTIVO);
  const padecimientoTa = page.locator('textarea[placeholder="¿Qué síntomas señala o presenta el paciente?"]').first();
  await padecimientoTa.fill(PADECIMIENTO);
  const notasEvolucionTa = page.locator('textarea[placeholder="Notas de evolución"]').first();
  await notasEvolucionTa.fill(NOTAS);
  const nombreReferidoInput = page.locator('input[placeholder="¿Quién refirió al paciente?"], textarea[placeholder="¿Quién refirió al paciente?"]').first();
  await nombreReferidoInput.fill(REFERIDO);

  console.log('Valores en el DOM justo despues de llenar:');
  console.log('  motivo:', await motivoInput.inputValue());
  console.log('  padecimiento:', await padecimientoTa.inputValue());
  console.log('  notas_evolucion:', await notasEvolucionTa.inputValue());
  console.log('  nombre_referido:', await nombreReferidoInput.inputValue());

  if (TOCAR_CIE10) {
    console.log('\n--- Yendo a Diagnostico a elegir un CIE-10 (sin guardar General antes) ---');
    const cie10Input = page.locator('textarea[role="combobox"]').first();
    await cie10Input.scrollIntoViewIfNeeded();
    await cie10Input.click();
    await page.waitForTimeout(500);
    await cie10Input.fill('TOS');
    await page.waitForTimeout(1500);
    const options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
    if (await options.count() > 0) {
      await options.first().click();
      console.log('CIE-10 seleccionado.');
    } else {
      console.log('Sin opciones de CIE-10 para "TOS"');
    }
  } else {
    console.log('\n--- CONTROL: NO se toca Diagnostico/CIE-10 esta vez, solo se espera lo mismo ---');
  }

  await page.waitForTimeout(3000);

  console.log(TOCAR_CIE10
    ? '\nValores en el DOM DESPUES de elegir CIE-10 (¿se resetearon?):'
    : '\nValores en el DOM tras esperar SIN tocar CIE-10 (control):');
  console.log('  motivo:', await motivoInput.inputValue().catch(() => '(no encontrado)'));
  console.log('  padecimiento:', await padecimientoTa.inputValue().catch(() => '(no encontrado)'));
  console.log('  notas_evolucion:', await notasEvolucionTa.inputValue().catch(() => '(no encontrado)'));
  console.log('  nombre_referido:', await nombreReferidoInput.inputValue().catch(() => '(no encontrado)'));

  await context.storageState({ path: 'storageState.json' });
  await browser.close();
})();
