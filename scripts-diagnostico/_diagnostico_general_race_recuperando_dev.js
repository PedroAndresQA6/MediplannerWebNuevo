// Repro de la hipotesis CORREGIDA (2026-09-10): el vaciado de "General" no lo
// causa elegir el CIE-10 (eso se descarto con una espera real de carga) --
// la sospecha ahora es que es una carrera contra el fetch en segundo plano
// "Recuperando datos del paciente...": si se escribe en General MIENTRAS ese
// overlay todavia esta activo, y despues el fetch resuelve, ¿pisa lo tipeado?
// Esta vez NO se toca Diagnostico/CIE-10 para nada -- aisla la variable.
const { chromium } = require('@playwright/test');
const { createAppointment, buscarBotonIniciarDePaciente } = require('../e2e/utils.js');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx/' });
  const page = await context.newPage();

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

  // A PROPOSITO: esperar solo lo minimo (que el campo exista), NO esperar a
  // que "Recuperando datos del paciente..." desaparezca -- es justo la
  // condicion que queremos probar.
  const motivoInput = page.locator('textarea[name="visitaPaciente"]');
  await motivoInput.waitFor({ state: 'visible', timeout: 20000 });

  const overlayRecuperando = page.getByText('Recuperando datos del paciente', { exact: false });
  const overlayVisibleAntes = await overlayRecuperando.isVisible().catch(() => false);
  console.log(`Overlay "Recuperando datos del paciente..." visible AL MOMENTO DE ESCRIBIR: ${overlayVisibleAntes}`);
  await page.screenshot({ path: 'test-results/repro-race-recuperando-antes-de-escribir.png', fullPage: true }).catch(() => {});

  const MOTIVO = 'RACE-REPRO: motivo escrito mientras (quizas) seguia Recuperando datos';
  const PADECIMIENTO = 'RACE-REPRO: padecimiento escrito mientras (quizas) seguia Recuperando datos';
  const NOTAS = 'RACE-REPRO: notas de evolucion';
  const REFERIDO = 'RACE-REPRO: nombre referido';

  console.log('\n--- Llenando General YA (sin esperar a que "Recuperando" termine) ---');
  await motivoInput.fill(MOTIVO);
  const padecimientoTa = page.locator('textarea[placeholder="¿Qué síntomas señala o presenta el paciente?"]').first();
  await padecimientoTa.fill(PADECIMIENTO);
  const notasEvolucionTa = page.locator('textarea[placeholder="Notas de evolución"]').first();
  await notasEvolucionTa.fill(NOTAS);
  const nombreReferidoInput = page.locator('input[placeholder="¿Quién refirió al paciente?"], textarea[placeholder="¿Quién refirió al paciente?"]').first();
  await nombreReferidoInput.fill(REFERIDO);

  console.log('Valores justo despues de escribir:');
  console.log('  motivo:', await motivoInput.inputValue());
  console.log('  padecimiento:', await padecimientoTa.inputValue());

  // Ahora sí esperar (sin catch) a que el overlay desaparezca, SIN tocar nada más.
  if (await overlayRecuperando.isVisible().catch(() => false)) {
    console.log('Overlay sigue visible, esperando a que desaparezca por su cuenta (sin tocar nada mas)...');
    await overlayRecuperando.waitFor({ state: 'hidden', timeout: 30000 }).catch((e) => console.log('(no desapareció dentro del timeout: ' + e.message + ')'));
  } else {
    console.log('El overlay ya no estaba visible al momento de escribir -- probamos igual esperando unos segundos por si el fetch de fondo sigue viajando.');
  }
  await page.waitForTimeout(3000);

  console.log('\nValores DESPUES de que "Recuperando" terminara (sin tocar Diagnostico/CIE-10 en ningún momento):');
  console.log('  motivo:', await motivoInput.inputValue().catch(() => '(no encontrado)'));
  console.log('  padecimiento:', await padecimientoTa.inputValue().catch(() => '(no encontrado)'));
  console.log('  notas_evolucion:', await notasEvolucionTa.inputValue().catch(() => '(no encontrado)'));
  console.log('  nombre_referido:', await nombreReferidoInput.inputValue().catch(() => '(no encontrado)'));
  await page.screenshot({ path: 'test-results/repro-race-recuperando-despues.png', fullPage: true }).catch(() => {});

  await context.storageState({ path: 'storageState.json' });
  await browser.close();
})();
