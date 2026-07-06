const { test, expect } = require('@playwright/test');
const { setupConsoleMonitor } = require('../e2e/utils.js');

// Exploratorio: el paciente "percentil prueba prueba" YA EXISTE (lo creó Pedro).
// Buscarlo con el campo "Buscar Usuarios" de /Pacientes, abrirlo y volcar las
// acciones disponibles para entender cómo arrancar/agendar su consulta.
const PACIENTE = 'percentil';

test('Buscar paciente y mapear acciones', async ({ page }) => {
  test.setTimeout(180000);
  setupConsoleMonitor(page);

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(3000);

  console.log(`🔎 Buscando "${PACIENTE}" en el campo "Buscar Usuarios"...`);
  const buscar = page.locator('input[placeholder="Buscar Usuarios"]').first();
  await buscar.waitFor({ state: 'visible', timeout: 20000 });
  await buscar.click();
  await buscar.fill(PACIENTE);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/percentil-busqueda.png', fullPage: true });

  // Volcar filas/resultados visibles
  console.log('\n===== RESULTADOS (nombres visibles) =====');
  const nameLinks = page.locator('a.font-semibold, a.text-sm, td a, [role="row"] a');
  const nc = await nameLinks.count();
  for (let i = 0; i < nc; i++) {
    const el = nameLinks.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const t = (await el.textContent().catch(() => '') || '').trim();
    if (t) console.log(`  [${i}] "${t.substring(0, 60)}"`);
  }

  // Intentar abrir el paciente que contiene "percentil"
  const target = page.locator(`a:has-text("${PACIENTE}"), :text("${PACIENTE}")`).first();
  if (await target.count() > 0 && await target.isVisible().catch(() => false)) {
    console.log(`➡️ Abriendo paciente: "${(await target.textContent().catch(() => '') || '').trim()}"`);
    await target.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'test-results/percentil-perfil.png', fullPage: true });

    // Volcar todos los clickables/acciones del perfil
    console.log('\n===== ACCIONES EN PERFIL (a/button) =====');
    const acts = page.locator('a, button, [role="button"]');
    const ac = await acts.count();
    for (let i = 0; i < ac; i++) {
      const el = acts.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const t = (await el.textContent().catch(() => '') || '').trim();
      if (t) console.log(`  "${t.substring(0, 50)}"`);
    }
  } else {
    console.log('⚠️ No se encontró el paciente en los resultados — revisar screenshot percentil-busqueda.png');
  }

  console.log('\n✅ Exploración completada');
});
