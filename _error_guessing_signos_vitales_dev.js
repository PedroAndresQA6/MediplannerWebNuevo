const { chromium } = require('@playwright/test');
const { createAppointment, handleModals } = require('./e2e/utils.js');
require('dotenv').config({ path: '.env' });

// Error guessing NUEVO (2026-07-30): ¿el modal "Capturar signos vitales"
// acepta valores clínicamente imposibles (peso negativo, talla negativa,
// frecuencia cardiaca negativa) sin ninguna validación, tanto en el front
// como en el backend? Usa el paciente por defecto del full-flow.

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

  const llamadas = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/') && r.method() === 'POST') {
      llamadas.push({ url: r.url().split('/api/')[1], body: r.postData(), status: null, respBody: null });
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/') && r.request().method() === 'POST') {
      const entry = llamadas.slice().reverse().find(e => e.url === r.url().split('/api/')[1] && e.status === null);
      if (entry) { entry.status = r.status(); entry.respBody = (await r.text().catch(() => '')).substring(0, 400); }
    }
  });

  try {
    console.log(`📅 Creando cita para "${PACIENTE_BUSQUEDA}"...`);
    await createAppointment(page, PACIENTE_BUSQUEDA);
    await page.waitForTimeout(1500);
    await handleModals(page);

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
      await page.waitForTimeout(2500);
      const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
      if (await explorarLink.isVisible({ timeout: 2000 }).catch(() => false)) await explorarLink.click({ force: true }).catch(() => {});
      const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
      if (await configurarMasTardeLink.isVisible({ timeout: 2000 }).catch(() => false)) await configurarMasTardeLink.click({ force: true }).catch(() => {});
      iniciarBtn = await buscarIniciarDelPaciente();
      if (!iniciarBtn) console.log(`⚠️ Botón "Iniciar" no encontrado todavía (intento ${intento}/3)`);
    }
    if (!iniciarBtn) throw new Error('No se encontró botón "Iniciar"');
    await iniciarBtn.click();
    await page.waitForTimeout(1500);

    const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
    await signosButton.waitFor({ state: 'visible', timeout: 10000 });
    await signosButton.click();
    await page.waitForTimeout(1500);

    console.log('\n########## Llenando signos vitales con valores CLÍNICAMENTE IMPOSIBLES ##########');
    console.log('  peso = -15 (negativo)');
    console.log('  talla = -50 (negativa)');
    console.log('  temperatura = -40 (negativa, incompatible con la vida)');
    console.log('  frecuencia cardiaca: se deja default (probar aparte si esto ya bloquea)');

    await page.locator('input[name="peso"]').fill('-15');
    const tallaInput = page.locator('input[name*="talla" i]');
    if (await tallaInput.count() > 0) await tallaInput.first().fill('-50');
    const tempInput = page.locator('input[name*="temp" i]');
    if (await tempInput.count() > 0) await tempInput.first().fill('-40');
    const fcInput = page.locator('input[name*="card" i]');
    if (await fcInput.count() > 0) await fcInput.first().fill('-80');

    await page.waitForTimeout(1000);

    // Buscar si se calculó/mostró un IMC con estos valores absurdos.
    const textoConIMC = await page.locator('body').innerText().catch(() => '');
    const imcMatch = textoConIMC.match(/IMC[:\s]*([\-\d.]+)/i);
    console.log(`IMC calculado con peso/talla negativos: ${imcMatch ? imcMatch[1] : 'no encontrado en el texto'}`);

    await page.screenshot({ path: 'test-results/eg-signos-vitales-negativos-antes.png', fullPage: true }).catch(() => {});

    const guardarBtn = page.getByRole('button', { name: /^Guardar$/i });
    const habilitado = await guardarBtn.isEnabled().catch(() => false);
    console.log(`¿Botón "Guardar" habilitado con valores negativos? ${habilitado}`);

    const marca = llamadas.length;
    if (habilitado) {
      await guardarBtn.click();
      await page.waitForTimeout(2500);
    }
    const nuevas = llamadas.slice(marca);
    console.log(`Llamadas POST tras intentar guardar (${nuevas.length}):`);
    nuevas.forEach(l => console.log(`  → ${l.url} | status=${l.status} | resp=${l.respBody}`));

    const seGuardo = nuevas.some(l => /vitalSigns/i.test(l.url) && l.status && l.status < 300);
    console.log(`\n¿registerVitalSigns respondió 2xx con valores negativos? ${seGuardo}`);
    if (seGuardo) {
      console.log('⚠️⚠️ POSIBLE HALLAZGO: el backend aceptó signos vitales negativos/imposibles (peso -15, talla -50, temperatura -40, FC -80) sin ningún rechazo.');
    } else if (nuevas.length > 0) {
      console.log('✅ El backend rechazó los valores negativos (revisar status/resp arriba para el detalle del mensaje).');
    } else {
      console.log('✅ El front bloqueó el guardado antes de llegar al backend (botón deshabilitado o validación previa).');
    }
    await page.screenshot({ path: 'test-results/eg-signos-vitales-negativos-despues.png', fullPage: true }).catch(() => {});

  } catch (error) {
    console.log(`\n💥 ERROR: ${error.message}`);
    await page.screenshot({ path: 'test-results/eg-signos-vitales-error.png', fullPage: true }).catch(() => {});
  }

  console.log('\n\n=== FIN ===');
  await page.waitForTimeout(15000);
  await browser.close();
})();
