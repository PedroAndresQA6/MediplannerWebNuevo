const { chromium } = require('@playwright/test');

// Script de RECONOCIMIENTO puntual (no destructivo): abre producción con la
// sesión ya guardada, entra a la cita que ya está lista para "Iniciar" desde
// el Dashboard, y solo observa/documenta si la pantalla de Consulta ya migró
// al nuevo "Modo Completo" (ver CONTEXTO.md, 2026-07-23) o sigue con el
// modelo viejo de pestañas. No llena ni guarda ningún dato.

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-web-security',
    ],
  });
  const base = 'https://admin.mediplanner.mx/';
  const context = await browser.newContext({
    storageState: 'Mediplanner produccion/storageState.json',
    viewport: null,
    baseURL: base,
  });
  const page = await context.newPage();

  page.on('pageerror', (err) => console.log('💥 pageerror:', err.message));
  page.on('response', (r) => {
    if (r.status() >= 400) console.log(`🔴 ${r.status()} ${r.url()}`);
  });

  console.log('Navegando al Dashboard de producción...');
  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
  // "Cargando..." puede tardar varios segundos en resolver — esperar a que
  // desaparezca en vez de un timeout fijo corto.
  await page.waitForFunction(
    () => !document.body.innerText.includes('Cargando'),
    { timeout: 20000 }
  ).catch(() => console.log('⚠️ Seguía en "Cargando..." tras 20s de espera'));
  await page.waitForTimeout(2000);

  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('ℹ️ Pantalla de onboarding detectada — clickeando "Prefiero explorar por mi cuenta"');
    await explorarLink.click();
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(2000);
    await page.goto('/Dashboard');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForFunction(
      () => !document.body.innerText.includes('Cargando'),
      { timeout: 20000 }
    ).catch(() => console.log('⚠️ Seguía en "Cargando..." tras 20s de espera'));
    await page.waitForTimeout(2000);
  }

  const PACIENTE_BUSQUEDA = 'Prueba DE Codigo';
  const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
  const count = await iniciarButtons.count();
  console.log(`Botones "Iniciar" visibles en Dashboard: ${count}`);

  await page.screenshot({ path: 'Mediplanner produccion/test-results/recon-00-dashboard.png', fullPage: true });

  if (count === 0) {
    console.log('⚠️ No se encontró ningún botón "Iniciar" visible en el Dashboard ahora mismo.');
    await browser.close();
    return;
  }

  let targetBtn = null;
  for (let i = 0; i < count; i++) {
    const btn = iniciarButtons.nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
    const texto = (await fila.textContent().catch(() => '') || '');
    if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.toLowerCase())) { targetBtn = btn; break; }
  }
  if (!targetBtn) {
    console.log(`⚠️ Ninguna fila con "Iniciar" contenía "${PACIENTE_BUSQUEDA}" — revisar captura manualmente.`);
    await browser.close();
    return;
  }
  console.log(`✅ Botón "Iniciar" de "${PACIENTE_BUSQUEDA}" encontrado.`);
  await targetBtn.click();
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
  await page.waitForTimeout(3000);

  console.log('URL tras click en "Iniciar":', page.url());
  await page.screenshot({ path: 'Mediplanner produccion/test-results/recon-01-post-iniciar.png', fullPage: true });

  // Señales del diseño VIEJO: pestañas clickeables, una sección a la vez.
  const tabTexts = ['General', 'Exploración', 'Diagnóstico', 'Tratamiento', 'Notas del Médico', 'Servicios'];
  let tabsEncontradas = 0;
  for (const t of tabTexts) {
    const tabEl = page.locator(`[role="tab"]:has-text("${t}"), button:has-text("${t}"), a:has-text("${t}")`).first();
    if (await tabEl.isVisible({ timeout: 1000 }).catch(() => false)) tabsEncontradas++;
  }

  // Señales del diseño NUEVO "Modo Completo": las 10 secciones como headings
  // h3 visibles todas a la vez + indicador/botón global.
  const headingsNuevos = ['Signos vitales', 'Apariencia general', 'Exploración segmentaria', 'Aparatos y sistemas', 'Laboratorios y Procedimientos'];
  let headingsEncontrados = 0;
  for (const h of headingsNuevos) {
    const headingEl = page.locator(`h3:has-text("${h}")`).first();
    if (await headingEl.isVisible({ timeout: 1000 }).catch(() => false)) headingsEncontrados++;
  }
  const modoCompletoTexto = await page.locator('text=/Modo Completo/i').first().isVisible({ timeout: 1000 }).catch(() => false);
  const guardarCambiosGlobal = await page.locator('button:has-text("Guardar cambios")').first().isVisible({ timeout: 1000 }).catch(() => false);

  console.log('\n=== DIAGNÓSTICO DE DISEÑO ===');
  console.log(`Pestañas viejas detectadas: ${tabsEncontradas}/${tabTexts.length}`);
  console.log(`Headings del "Modo Completo" detectados: ${headingsEncontrados}/${headingsNuevos.length}`);
  console.log(`Texto "Modo Completo" visible: ${modoCompletoTexto}`);
  console.log(`Botón global "Guardar cambios" visible: ${guardarCambiosGlobal}`);

  if (headingsEncontrados >= 3 || modoCompletoTexto) {
    console.log('\n👉 CONCLUSIÓN: producción YA tiene el nuevo diseño "Modo Completo" (igual que dev).');
  } else if (tabsEncontradas >= 3) {
    console.log('\n👉 CONCLUSIÓN: producción SIGUE con el diseño viejo de pestañas (distinto a dev).');
  } else {
    console.log('\n👉 CONCLUSIÓN: no concluyente por selectores — revisar las capturas manualmente.');
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
