const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 30 });
  const context = await browser.newContext({
    storageState: path.join(__dirname, 'Mediplanner Staging', 'storageState.json'),
    baseURL: 'https://admin-staging.mediplanner.mx/',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // ── 1. /Pacientes: buscador + estructura de fila de paciente ──────────────
  console.log('\n=== /Pacientes ===');
  await page.goto('https://admin-staging.mediplanner.mx/Pacientes');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);

  const inputs = await page.locator('input').evaluateAll(els => els.map(el => ({
    placeholder: el.placeholder, name: el.name, type: el.type, id: el.id, class: el.className,
  })));
  console.log('INPUTS:', JSON.stringify(inputs, null, 2));

  // Buscar cualquier elemento cuyo texto sea "Agustin Tapia" o "Pedro Quijada Anaya" o "Percentil"
  for (const nombre of ['Agustin Tapia', 'Pedro Quijada Anaya', 'Percentil']) {
    const matches = await page.locator(`text=${nombre}`).evaluateAll((els) => els.map(el => ({
      tag: el.tagName, class: el.className, text: el.textContent.trim().slice(0, 60),
    })));
    console.log(`MATCHES for "${nombre}":`, JSON.stringify(matches, null, 2));
  }

  // Estructura genérica de la primera fila de paciente (buscar patrones comunes)
  const posiblesFilas = await page.locator('table tr, div[class*="row"], div[class*="card"]').count();
  console.log('Posibles filas/cards de tabla:', posiblesFilas);

  await page.screenshot({ path: path.join(__dirname, 'test-results', 'dom_pacientes.png'), fullPage: true });

  // ── 2. /Dashboard: tarjetas KPI ─────────────────────────────────────────
  console.log('\n=== /Dashboard ===');
  await page.goto('https://admin-staging.mediplanner.mx/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);

  const mainText = await page.locator('main').textContent().catch(() => '');
  console.log('MAIN TEXT (primeros 2000 chars):', (mainText || '').replace(/\s+/g, ' ').slice(0, 2000));

  // Buscar cualquier elemento con texto que contenga "CONSULTA"
  const consultaEls = await page.locator('main').getByText(/CONSULTA/i).evaluateAll(els => els.map(el => ({
    tag: el.tagName, class: el.className, text: el.textContent.trim().slice(0, 100),
    parentTag: el.parentElement?.tagName, parentClass: el.parentElement?.className,
    parentText: el.parentElement?.textContent.trim().slice(0, 100),
    grandParentText: el.parentElement?.parentElement?.textContent.trim().slice(0, 150),
  })));
  console.log('CONSULTA elements:', JSON.stringify(consultaEls, null, 2));

  await page.screenshot({ path: path.join(__dirname, 'test-results', 'dom_dashboard.png'), fullPage: true });

  // ── 3. Sidebar: Ajustes / Servicios ─────────────────────────────────────
  console.log('\n=== Sidebar Ajustes ===');
  const ajustesLinks = await page.locator('a:has-text("Ajustes"), span:has-text("Ajustes")').evaluateAll(els => els.map(el => ({
    tag: el.tagName, class: el.className, text: el.textContent.trim(),
  })));
  console.log('Ajustes matches:', JSON.stringify(ajustesLinks, null, 2));

  const ajustesLink = page.locator('a:has-text("Ajustes"), span.menu-title:has-text("Ajustes")').first();
  if (await ajustesLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await ajustesLink.click();
    await page.waitForTimeout(2500);
    const serviciosLinks = await page.locator('text=Servicios').evaluateAll(els => els.map(el => ({
      tag: el.tagName, class: el.className, text: el.textContent.trim(),
    })));
    console.log('Servicios matches tras click Ajustes:', JSON.stringify(serviciosLinks, null, 2));
    await page.screenshot({ path: path.join(__dirname, 'test-results', 'dom_ajustes.png'), fullPage: true });
  } else {
    console.log('No se encontró link "Ajustes" visible');
  }

  await browser.close();
})();
