const { test, expect } = require('@playwright/test');
const { setupConsoleMonitor } = require('../e2e/utils.js');

// Exploratorio: se re-implementó el Dashboard en dev. Mapear su estructura
// (widgets, gráficos, filtros, links) para decidir qué automatizar y qué
// tests existentes que pasan por /Dashboard hay que revisar.
test('MAPEAR Dashboard nuevo', async ({ page }) => {
  test.setTimeout(120000);
  const session = setupConsoleMonitor(page);

  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'test-results/dashboard-mapeo.png', fullPage: true });

  console.log('\n===== TÍTULOS / SECCIONES (h1-h4, .card-title) =====');
  const titles = page.locator('h1, h2, h3, h4, .card-title, .card-header');
  const tc = await titles.count();
  for (let i = 0; i < tc; i++) {
    const el = titles.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const t = (await el.textContent().catch(() => '') || '').trim();
    if (t) console.log(`  [${i}] "${t.substring(0, 80)}"`);
  }

  console.log('\n===== CALENDARIO DEL DASHBOARD: ¿input[type=date] o botones? =====');
  const dateInput = page.locator('input[type="date"], input[type="month"]');
  console.log(`  input[type=date/month] encontrados: ${await dateInput.count()}`);
  const dayButtons = page.locator('button:text-is("15"), button:text-is("20")');
  console.log(`  Botones numéricos de día (ej. "15"/"20") encontrados: ${await dayButtons.count()}`);
  const prevNext = page.locator('button:has-text("Hoy")').locator('xpath=..').locator('button');
  console.log(`  Botones junto a "Hoy" (prev/next mes): ${await prevNext.count()}`);

  console.log('\n===== AGENDA DE HOY: estructura de la tabla =====');
  const agendaCard = page.locator(':text("Agenda de hoy")').first().locator('xpath=ancestor::*[self::div][3]');
  const agendaText = (await agendaCard.textContent().catch(() => '') || '').trim();
  console.log(`  Contenido cerca de "Agenda de hoy": "${agendaText.substring(0, 200)}"`);
  const iniciarBtns = page.getByRole('button', { name: /iniciar/i });
  console.log(`  Botones "Iniciar" visibles hoy: ${await iniciarBtns.count()}`);

  console.log('\n===== SIDEBAR: items completos =====');
  const sidebarLinks = page.locator('nav a, aside a, nav button, aside button');
  const sc = await sidebarLinks.count();
  const vistos2 = new Set();
  for (let i = 0; i < sc; i++) {
    const el = sidebarLinks.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const t = (await el.textContent().catch(() => '') || '').trim();
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    if (t && !vistos2.has(t)) { vistos2.add(t); console.log(`  "${t}" ${href ? `→ ${href}` : '(sin href, probablemente routing por JS)'}`); }
  }

  console.log(`\n===== ERRORES DE CONSOLA: ${session.errors.length} =====`);
  for (const e of session.errors.slice(0, 30)) {
    console.log(`  [+${e.timestamp}s] ${(e.text || e.failure || '').toString().substring(0, 150)}`);
  }

  console.log('\n✅ Exploración de Dashboard completada. Ver test-results/dashboard-mapeo.png');
});

test('MAPEAR Reportes y Ajustes (sidebar nuevo)', async ({ page }) => {
  test.setTimeout(120000);
  setupConsoleMonitor(page);

  for (const label of ['Reportes', 'Ajustes']) {
    console.log(`\n\n########## ${label} (click desde sidebar) ##########`);
    await page.goto('/Dashboard');
    await page.waitForTimeout(2500);
    const link = page.locator(`a:has-text("${label}"), button:has-text("${label}")`).first();
    if (await link.count() === 0) {
      console.log(`  ⚠️ No se encontró el link "${label}" en el sidebar`);
      continue;
    }
    await link.click().catch(() => {});
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `test-results/dashboard-${label.toLowerCase()}.png`, fullPage: true });
    console.log(`URL actual: ${page.url()}`);

    const titles = page.locator('h1, h2, h3, h4, .card-title');
    const tc = await titles.count();
    for (let i = 0; i < Math.min(tc, 20); i++) {
      const el = titles.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const t = (await el.textContent().catch(() => '') || '').trim();
      if (t) console.log(`  [título] "${t.substring(0, 80)}"`);
    }

    const acts = page.locator('a, button, [role="tab"], input, select');
    const ac = await acts.count();
    console.log(`  Total elementos interactivos: ${ac}`);
    const vistos = new Set();
    for (let i = 0; i < ac; i++) {
      const el = acts.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const t = (await el.textContent().catch(() => '') || '').trim() || (await el.getAttribute('placeholder').catch(() => '')) || '';
      if (t && !vistos.has(t)) { vistos.add(t); console.log(`    "${t.substring(0, 50)}"`); }
    }
  }
  console.log('\n✅ Exploración de Reportes/Ajustes completada.');
});

test('MAPEAR calendario del Dashboard: click en día futuro', async ({ page }) => {
  test.setTimeout(120000);
  setupConsoleMonitor(page);

  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(3000);

  // Los botones de día (1-31) son botones cuyo texto es exactamente un número;
  // no hace falta acotar al widget del calendario, es el único lugar del
  // Dashboard con botones así. (getByRole por nombre accesible no matcheó —
  // se usa el mismo locator crudo que ya funcionó en el mapeo inicial.)
  const allButtons = page.locator('a, button, [role="button"]');
  const abTotal = await allButtons.count();
  console.log(`Total elementos a/button/[role=button] en la página: ${abTotal}`);

  // Día actual (resaltado) vs. un día futuro cualquiera con número mayor.
  const hoy = new Date();
  const hoyNum = hoy.getDate();
  let futureBtn = null;
  let futureLabel = null;
  let dtotal = 0;
  for (let i = 0; i < abTotal; i++) {
    const btn = allButtons.nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    const txt = (await btn.textContent().catch(() => '') || '').trim();
    if (!/^\d{1,2}$/.test(txt)) continue;
    dtotal++;
    const n = parseInt(txt, 10);
    if (!futureBtn && n > hoyNum) { futureBtn = btn; futureLabel = txt; }
  }
  console.log(`Botones de día detectados en el calendario: ${dtotal}`);

  if (!futureBtn) {
    console.log('⚠️ No se encontró un día futuro clickable en el mes visible (puede requerir avanzar de mes con ›)');
  } else {
    console.log(`\n➡️ Clickeando día futuro "${futureLabel}"...`);
    const antesAgenda = (await page.locator(':text("Agenda de hoy")').first().locator('xpath=ancestor::*[self::div][3]').textContent().catch(() => '') || '').trim();
    const antesTituloAgenda = (await page.locator('h1, h2, h3, h4, .card-title, .card-header').allTextContents()).find(t => /agenda/i.test(t)) || '';

    const respPromise = page.waitForResponse(r => r.url().includes('/api/') && r.request().method() !== 'GET', { timeout: 6000 }).catch(() => null);
    await futureBtn.click().catch(() => {});
    const resp = await respPromise;
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/dashboard-calendario-dia-futuro.png', fullPage: true });

    console.log(`  Llamada API tras el click: ${resp ? resp.url() : 'ninguna detectada'}`);
    console.log(`  URL tras click: ${page.url()}`);

    const despuesTituloAgenda = (await page.locator('h1, h2, h3, h4, .card-title, .card-header').allTextContents()).find(t => /agenda/i.test(t)) || '';
    console.log(`  Título de "Agenda de hoy" antes: "${antesTituloAgenda}" | después: "${despuesTituloAgenda}"`);

    const despuesAgenda = (await page.locator(':text("Agenda")').first().locator('xpath=ancestor::*[self::div][3]').textContent().catch(() => '') || '').trim();
    console.log(`  Contenido cerca de "Agenda" tras click: "${despuesAgenda.substring(0, 250)}"`);
    console.log(`  ¿Cambió el contenido de la agenda?: ${despuesAgenda !== antesAgenda}`);

    // ¿El día clickeado queda marcado/resaltado como "seleccionado"?
    const clase = (await futureBtn.getAttribute('class').catch(() => '')) || '';
    console.log(`  class del botón de día tras click: "${clase}"`);
  }

  console.log('\n✅ Exploración del calendario completada.');
});
