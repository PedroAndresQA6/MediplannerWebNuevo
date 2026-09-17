const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Error guessing NUEVO (2026-07-30, a pedido de Pedro: priorizar bugs nuevos
// sobre reverificar viejos) sobre la pestaña "Información General" de la
// ficha de un paciente ya existente: CP→Colonia (select dependiente, nunca
// probado — candidato identificado en memoria), Fecha de nacimiento con
// valores absurdos, CURP con formato inválido.

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
      llamadas.push({ url: r.url().split('/api/')[1], body: r.postData(), status: null, respBody: null, t: Date.now() });
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

  const cpInput = page.locator('input[placeholder="5 dígitos"]').first();
  const coloniaSelect = page.locator('select').filter({ has: page.locator('option', { hasText: /ingresa primero el código postal|colonia/i }) }).first();
  // Fallback más robusto: el select de Colonia está justo bajo el label "Colonia".
  const coloniaSelectByLabel = page.locator('text=Colonia').locator('xpath=following::select[1]');
  const ciudadInput = page.locator('input[placeholder="Se llena automáticamente"]').first();

  // ── Escenario A: CP inexistente (no debería resolver a ninguna colonia real) ──
  console.log('\n########## ESCENARIO A: CP inexistente "00000" ##########');
  await cpInput.fill('00000');
  await page.waitForTimeout(2500);
  const coloniaOpcionesA = await coloniaSelectByLabel.locator('option').allTextContents().catch(() => []);
  const ciudadValA = await ciudadInput.inputValue().catch(() => '');
  console.log(`Opciones de Colonia tras CP "00000": [${coloniaOpcionesA.join(' | ')}]`);
  console.log(`Ciudad autollenada: "${ciudadValA}"`);
  await page.screenshot({ path: 'test-results/eg-ficha-A-cp-inexistente.png', fullPage: true }).catch(() => {});

  // ── Escenario B: CP válido conocido (Querétaro centro, 76000) ──
  console.log('\n########## ESCENARIO B: CP válido "76000" (Querétaro) ##########');
  await cpInput.fill('');
  await cpInput.fill('76000');
  await page.waitForTimeout(2500);
  const coloniaOpcionesB = await coloniaSelectByLabel.locator('option').allTextContents().catch(() => []);
  const ciudadValB = await ciudadInput.inputValue().catch(() => '');
  console.log(`Opciones de Colonia tras CP "76000": [${coloniaOpcionesB.slice(0, 10).join(' | ')}]`);
  console.log(`Ciudad autollenada: "${ciudadValB}"`);
  await page.screenshot({ path: 'test-results/eg-ficha-B-cp-valido.png', fullPage: true }).catch(() => {});

  // ── Escenario C: carrera — escribir CP válido y CAMBIARLO antes de que cargue, luego guardar ──
  console.log('\n########## ESCENARIO C: carrera CP→Colonia (cambiar CP antes de que resuelva) ##########');
  await cpInput.fill('');
  await cpInput.fill('76000'); // Querétaro
  await page.waitForTimeout(200); // no esperar a que cargue
  await cpInput.fill('');
  await cpInput.fill('44100'); // Guadalajara — CP totalmente distinto, sin esperar
  await page.waitForTimeout(2500); // ahora sí esperar a que asiente
  const coloniaOpcionesC = await coloniaSelectByLabel.locator('option').allTextContents().catch(() => []);
  const ciudadValC = await ciudadInput.inputValue().catch(() => '');
  console.log(`Tras carrera (76000 → 44100 sin esperar), Ciudad quedó: "${ciudadValC}"`);
  console.log(`Opciones de Colonia disponibles: [${coloniaOpcionesC.slice(0, 10).join(' | ')}]`);
  const inconsistente = ciudadValC && !/guadalajara|jalisco/i.test(ciudadValC);
  if (inconsistente) {
    console.log(`⚠️⚠️ POSIBLE HALLAZGO: Ciudad/Colonia no corresponden al CP final (44100 = Guadalajara, Jalisco) — quedó "${ciudadValC}" (residuo del CP anterior).`);
  }
  await page.screenshot({ path: 'test-results/eg-ficha-C-carrera-cp.png', fullPage: true }).catch(() => {});

  // Elegir la primera colonia real disponible (si hay) para poder guardar limpio después.
  const coloniaCount = await coloniaSelectByLabel.locator('option').count().catch(() => 0);
  if (coloniaCount > 1) {
    await coloniaSelectByLabel.selectOption({ index: 1 });
  }

  // ── Escenario D: Fecha de nacimiento absurda (futuro) ──
  console.log('\n########## ESCENARIO D: Fecha de nacimiento en el FUTURO ##########');
  const fechaInput = page.locator('input[type="date"]').first();
  const marcaD = llamadas.length;
  await fechaInput.fill('2099-01-01');
  await page.waitForTimeout(500);
  const guardarBtn1 = page.locator('button:has-text("Guardar cambios")').first();
  await guardarBtn1.click();
  await page.waitForTimeout(2500);
  const nuevasD = llamadas.slice(marcaD);
  console.log(`Llamadas POST tras guardar con fecha de nacimiento 2099-01-01 (${nuevasD.length}):`);
  nuevasD.forEach(l => console.log(`  → ${l.url} | status=${l.status} | resp=${l.respBody}`));
  const textoTrasGuardarD = await page.locator('body').innerText().catch(() => '');
  const huboErrorD = /fecha.*(inv[aá]lida|futuro|no puede)/i.test(textoTrasGuardarD);
  console.log(`¿Mensaje de error sobre fecha inválida detectado? ${huboErrorD}`);
  if (nuevasD.some(l => l.status && l.status < 300) && !huboErrorD) {
    console.log('⚠️⚠️ POSIBLE HALLAZGO: se guardó una fecha de nacimiento en el futuro (2099) sin ningún error.');
  }
  await page.screenshot({ path: 'test-results/eg-ficha-D-fecha-futuro.png', fullPage: true }).catch(() => {});

  // ── Escenario E: CURP con formato claramente inválido ──
  console.log('\n########## ESCENARIO E: CURP con formato inválido ##########');
  const curpInput = page.locator('input').filter({ hasNot: page.locator('[type="date"]') }).first();
  const curpInputReal = page.locator('text=CURP').locator('xpath=following::input[1]');
  await curpInputReal.fill('12345INVALIDO');
  const marcaE = llamadas.length;
  await guardarBtn1.click();
  await page.waitForTimeout(2500);
  const nuevasE = llamadas.slice(marcaE);
  console.log(`Llamadas POST tras guardar con CURP "12345INVALIDO" (${nuevasE.length}):`);
  nuevasE.forEach(l => console.log(`  → ${l.url} | status=${l.status} | resp=${l.respBody}`));
  const textoTrasGuardarE = await page.locator('body').innerText().catch(() => '');
  const huboErrorE = /curp.*(inv[aá]lid|formato|incorrect)/i.test(textoTrasGuardarE);
  console.log(`¿Mensaje de error sobre CURP inválida detectado? ${huboErrorE}`);
  if (nuevasE.some(l => l.status && l.status < 300) && !huboErrorE) {
    console.log('⚠️⚠️ POSIBLE HALLAZGO: se guardó un CURP con formato claramente inválido ("12345INVALIDO") sin ningún error.');
  }
  await page.screenshot({ path: 'test-results/eg-ficha-E-curp-invalida.png', fullPage: true }).catch(() => {});

  console.log('\n\n=== FIN — dejando navegador abierto 20s para inspección ===');
  await page.waitForTimeout(20000);
  await browser.close();
})();
