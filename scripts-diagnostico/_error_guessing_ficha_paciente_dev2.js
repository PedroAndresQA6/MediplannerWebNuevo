const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Continuación: Escenarios D (fecha de nacimiento absurda) y E (CURP inválida)
// sobre la ficha del paciente — el script anterior crasheó ANTES de llegar
// acá por un selector ambiguo (ya corregido: usar #hospitalColonia directo).

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

  const llamadas = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/') && r.method() === 'POST') {
      llamadas.push({ url: r.url().split('/api/')[1], body: r.postData(), status: null, respBody: null });
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/') && r.request().method() === 'POST') {
      const entry = llamadas.slice().reverse().find(e => e.url === r.url().split('/api/')[1] && e.status === null);
      if (entry) { entry.status = r.status(); entry.respBody = (await r.text().catch(() => '')).substring(0, 300); }
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
  await page.waitForTimeout(2000);
  console.log(`📍 En perfil de paciente: ${page.url()}`);

  const guardarBtn1 = page.locator('button:has-text("Guardar cambios")').first();

  // ── Escenario D: Fecha de nacimiento absurda (futuro) ──
  console.log('\n########## ESCENARIO D: Fecha de nacimiento en el FUTURO (2099-01-01) ##########');
  const fechaInput = page.locator('input[type="date"]').first();
  await fechaInput.fill('2099-01-01');
  await page.waitForTimeout(500);
  const marcaD = llamadas.length;
  await guardarBtn1.click();
  await page.waitForTimeout(2500);
  const nuevasD = llamadas.slice(marcaD);
  console.log(`Llamadas POST tras guardar (${nuevasD.length}):`);
  nuevasD.forEach(l => console.log(`  → ${l.url} | status=${l.status} | resp=${l.respBody}`));
  const textoTrasGuardarD = await page.locator('body').innerText().catch(() => '');
  const huboErrorD = /fecha.*(inv[aá]lida|futuro|no puede)|no puede ser (mayor|futura)/i.test(textoTrasGuardarD);
  console.log(`¿Mensaje de error sobre fecha inválida detectado en el texto de la página? ${huboErrorD}`);
  const seGuardoD = nuevasD.some(l => /patient/i.test(l.url) && l.status && l.status < 300);
  console.log(`¿La llamada de guardado de paciente respondió 2xx? ${seGuardoD}`);
  await page.screenshot({ path: 'test-results/eg-ficha-D-fecha-futuro.png', fullPage: true }).catch(() => {});
  // Recargar y ver si la fecha absurda quedó realmente persistida.
  await page.reload();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const fechaTrasRecargar = await page.locator('input[type="date"]').first().inputValue().catch(() => '');
  console.log(`Fecha de nacimiento tras recargar la página: "${fechaTrasRecargar}"`);
  if (fechaTrasRecargar === '2099-01-01') {
    console.log('⚠️⚠️ HALLAZGO CONFIRMADO: se guardó y persistió una fecha de nacimiento en el año 2099 (paciente "nacido en el futuro") sin ningún error ni bloqueo.');
  } else {
    console.log('✅ La fecha de 2099 NO quedó persistida (se rechazó o revirtió) — sin hallazgo aquí.');
  }

  // ── Escenario E: CURP con formato claramente inválido ──
  console.log('\n########## ESCENARIO E: CURP con formato inválido ("12345INVALIDO") ##########');
  const curpInputReal = page.locator('text=CURP').locator('xpath=following::input[1]');
  await curpInputReal.fill('12345INVALIDO');
  await page.waitForTimeout(500);
  const marcaE = llamadas.length;
  await guardarBtn1.click();
  await page.waitForTimeout(2500);
  const nuevasE = llamadas.slice(marcaE);
  console.log(`Llamadas POST tras guardar (${nuevasE.length}):`);
  nuevasE.forEach(l => console.log(`  → ${l.url} | status=${l.status} | resp=${l.respBody}`));
  const textoTrasGuardarE = await page.locator('body').innerText().catch(() => '');
  const huboErrorE = /curp.*(inv[aá]lid|formato|incorrect)/i.test(textoTrasGuardarE);
  console.log(`¿Mensaje de error sobre CURP inválida detectado? ${huboErrorE}`);
  const seGuardoE = nuevasE.some(l => /patient/i.test(l.url) && l.status && l.status < 300);
  console.log(`¿La llamada de guardado de paciente respondió 2xx? ${seGuardoE}`);
  await page.screenshot({ path: 'test-results/eg-ficha-E-curp-invalida.png', fullPage: true }).catch(() => {});
  await page.reload();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const curpTrasRecargar = await page.locator('text=CURP').locator('xpath=following::input[1]').inputValue().catch(() => '');
  console.log(`CURP tras recargar la página: "${curpTrasRecargar}"`);
  if (curpTrasRecargar === '12345INVALIDO') {
    console.log('⚠️⚠️ HALLAZGO CONFIRMADO: se guardó y persistió un CURP con formato inválido ("12345INVALIDO") sin ningún error de validación.');
  } else {
    console.log('✅ El CURP inválido NO quedó persistido — sin hallazgo aquí.');
  }

  console.log('\n\n=== FIN ===');
  await page.waitForTimeout(15000);
  await browser.close();
})();
