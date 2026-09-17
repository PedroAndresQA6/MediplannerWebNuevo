const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Verificación de la 2da vista que señaló Pedro: perfil del paciente →
// pestaña "Consultas" → seleccionar una consulta → sub-pestañas (General,
// Exploración, Diagnóstico, Tratamiento, Notas del médico) con vista
// preliminar + botón "Ver consulta" para la vista completa. Se usa la
// consulta id=39 de "Percentil Prueba Prueba" (conocida en detalle: checklist
// de Exploración segmentaria 17 elementos / Aparatos y sistemas 31
// elementos, ambos con dato real, confirmado hoy por API) para poder
// comparar contra datos reales, siguiendo CLAUDE.md §0 (inventario completo,
// esperar de forma realista, leer todo el texto, no solo mirar).

const PACIENTE_BUSQUEDA = 'Percentil';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  const erroresApi = [];
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (err) => console.log(`💥 [JS ERROR] ${err.message}`));

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
  console.log(`📍 Perfil del paciente: ${page.url()}`);

  // Ir a la pestaña "Consultas".
  const consultasTab = page.getByRole('tab', { name: /^consultas$/i }).or(page.getByText(/^consultas$/i)).first();
  await consultasTab.click();
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Espera realista (no un timeout corto) a que la lista de consultas
  // termine de cargar: ni el spinner visible, ni "de 0" resultados.
  for (let i = 0; i < 10; i++) {
    const texto = await page.locator('body').innerText().catch(() => '');
    const spinnerVisible = await page.locator('.animate-spin, [class*="spinner"]').first().isVisible().catch(() => false);
    if (!spinnerVisible && !/de 0\b/.test(texto)) break;
    console.log(`  ⏳ Lista de consultas aún cargando (intento ${i + 1}/10)...`);
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'test-results/vista-consultas-0-lista.png', fullPage: true }).catch(() => {});

  console.log('\n=== Lista de consultas visible ===');
  const textoLista = await page.locator('body').innerText().catch(() => '');
  console.log(textoLista.split('\n').filter(Boolean).slice(0, 30).join(' | '));

  // Elegir la primera consulta de la lista (debería ser la más reciente =
  // consulta_id 39, la última creada hoy con el full-flow) — clickear
  // directo sobre su texto "Consulta inicial", más confiable que adivinar
  // la clase del contenedor clickeable.
  // OJO: hay un <option value="1">Consulta inicial</option> oculto en algún
  // select de filtro de la página (mismo texto, distinto elemento) — hay que
  // descartarlo explícitamente y clickear el heading VISIBLE de la lista.
  const candidatos = page.getByText(/^Consulta inicial$/i);
  const nCandidatos = await candidatos.count().catch(() => 0);
  console.log(`Ítems "Consulta inicial" encontrados: ${nCandidatos}`);
  let clickeado = false;
  for (let i = 0; i < nCandidatos && !clickeado; i++) {
    const el = candidatos.nth(i);
    const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '?');
    if (tag === 'option') continue;
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      clickeado = true;
      console.log(`  Clickeado candidato [${i}] <${tag}>`);
    }
  }
  if (!clickeado) console.log('⚠️ No se encontró un ítem VISIBLE de "Consulta inicial" — revisar screenshot.');
  await page.waitForTimeout(2000);
  // Esperar de forma realista a que el detalle termine de cargar (no dejar
  // "Seleccione una consulta..." ni spinners).
  for (let i = 0; i < 8; i++) {
    const texto = await page.locator('body').innerText().catch(() => '');
    if (!/selecciona una consulta/i.test(texto) && !/cargando/i.test(texto)) break;
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'test-results/vista-consultas-1-seleccionada.png', fullPage: true }).catch(() => {});

  // Recorrer las sub-pestañas: General, Exploración, Diagnóstico, Tratamiento, Notas del médico.
  const subPestañas = ['General', 'Exploración', 'Diagnóstico', 'Tratamiento', 'Notas del médico'];
  for (const nombre of subPestañas) {
    const tab = page.getByText(new RegExp(`^${nombre}$`, 'i')).last();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(1500);

      // Espera realista a que cualquier "Cargando..." desaparezca (hasta 15s).
      for (let i = 0; i < 8; i++) {
        const texto = await page.locator('body').innerText().catch(() => '');
        if (!/cargando/i.test(texto)) break;
        await page.waitForTimeout(2000);
      }

      const textoSub = await page.locator('body').innerText().catch(() => '');
      const tieneCargando = /cargando/i.test(textoSub);
      console.log(`\n=== Sub-pestaña "${nombre}" ${tieneCargando ? '⚠️ AÚN MUESTRA "Cargando..."' : '✅ resuelto'} ===`);
      // Volcar el texto completo de la zona de detalle (no toda la página, para no repetir sidebar).
      console.log(textoSub.split('\n').filter(Boolean).slice(0, 40).join(' | '));
      await page.screenshot({ path: `test-results/vista-consultas-2-subtab-${nombre.replace(/\s+/g, '_')}.png`, fullPage: true }).catch(() => {});
    } else {
      console.log(`⚠️ Sub-pestaña "${nombre}" no encontrada/visible.`);
    }
  }

  // Botón "Ver consulta" → vista completa (misma que recién finalizada).
  const verConsultaBtn = page.getByRole('button', { name: /ver consulta/i }).first();
  if (await verConsultaBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('\n▶️ Clickeando "Ver consulta" (vista completa)...');
    await verConsultaBtn.click();
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Espera realista a que "Cargando información de consulta" y "Cargando
    // preguntas" desaparezcan — hasta 20s, chequeando cada 2s.
    for (let i = 0; i < 10; i++) {
      const texto = await page.locator('body').innerText().catch(() => '');
      if (!/cargando/i.test(texto)) break;
      await page.waitForTimeout(2000);
    }
    console.log(`📍 URL de la vista completa: ${page.url()}`);
    await page.screenshot({ path: 'test-results/vista-consultas-3-completa.png', fullPage: true }).catch(() => {});

    const textoCompleto = await page.locator('body').innerText().catch(() => '');
    const seccionesEsperadas = ['Exploración segmentaria', 'Aparatos y sistemas', 'Diagnóstico', 'Tratamiento'];
    console.log('\n=== Verificación de secciones en la vista completa ===');
    for (const seccion of seccionesEsperadas) {
      const idx = textoCompleto.indexOf(seccion);
      if (idx === -1) { console.log(`  ⚠️ Sección "${seccion}" no encontrada en el texto de la página`); continue; }
      const fragmento = textoCompleto.substring(idx, idx + 300).split('\n').filter(Boolean).slice(0, 8).join(' | ');
      const cargandoEnSeccion = /cargando/i.test(fragmento);
      console.log(`  ${cargandoEnSeccion ? '⚠️' : '✅'} "${seccion}": ${fragmento}`);
    }
  } else {
    console.log('\n⚠️ No se encontró el botón "Ver consulta".');
  }

  if (erroresApi.length > 0) {
    console.log(`\n🔴 ${erroresApi.length} error(es) de API durante toda la navegación:`);
    erroresApi.forEach(e => console.log('   ' + e));
  } else {
    console.log('\n✅ 0 errores de API durante toda la navegación de esta vista.');
  }

  console.log('\n\n=== FIN ===');
  await page.waitForTimeout(20000);
  await browser.close();
})();
