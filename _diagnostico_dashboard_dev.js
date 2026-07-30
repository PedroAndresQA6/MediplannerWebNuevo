const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

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
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // "Prefiero explorar por mi cuenta" es un <a href="/Dashboard"> — navegar
  // directo evita la carrera de "elemento desprendido del DOM" al clickear.
  const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
  if (await configurarMasTardeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('ℹ️ Wizard de configuración detectado — clickeando "Configurar más tarde"');
    await configurarMasTardeLink.click({ force: true }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1500);
  }
  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (await configurarMasTardeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('ℹ️ Wizard de configuración reapareció — clickeando "Configurar más tarde" de nuevo');
    await configurarMasTardeLink.click({ force: true }).catch(() => {});
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1500);
    await page.goto('/Dashboard');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  console.log('Hora actual del sistema (Date.now local):', new Date().toString());

  const agendaSection = page.locator('text=/Agenda de hoy/i').locator('xpath=ancestor::div[3]');
  const agendaTexto = await agendaSection.textContent().catch(() => 'NO SE PUDO LEER');
  console.log('\n=== Contenido de "Agenda de hoy" ===');
  console.log(agendaTexto);

  const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
  const count = await iniciarButtons.count();
  console.log(`\nBotones "Iniciar" totales visibles: ${count}`);
  for (let i = 0; i < count; i++) {
    const btn = iniciarButtons.nth(i);
    const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
    const texto = (await fila.textContent().catch(() => '') || '').trim();
    console.log(`  [${i}] fila: "${texto.substring(0, 150)}"`);
  }

  await page.screenshot({ path: 'test-results/dashboard-diagnostico-completo.png', fullPage: true });
  await page.waitForTimeout(2000);
  await browser.close();
})();
