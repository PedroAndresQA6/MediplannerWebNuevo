// Continuación de _diagnostico_getfilledform_ui_real_dev.js: esa corrida ya
// confirmó que la vista "Ver consulta" (completa) muestra bien los datos de
// Exploración segmentaria/Aparatos y sistemas incluso 1s después de
// Finalizar — no reproduce el 404 de getFilledForm ahí. Pedro pidió revisar
// TODAS las sub-pestañas de perfil del paciente → Consultas → consulta
// existente (General, Exploración, Diagnóstico, Tratamiento, Notas del
// médico), no solo la vista completa — según el punto 3 de CLAUDE.md esa
// vista preliminar es un lugar DISTINTO donde el mismo dato podría fallar
// aunque la vista completa esté bien.
//
// No crea una consulta nueva: reutiliza una ya finalizada y con tag conocido
// (UIREPRO-1789673419620, de la corrida anterior, con 8+15 ítems de
// checklist reales) para no gastar ~6 minutos de nuevo.
const { chromium } = require('@playwright/test');
const { auditarPantalla } = require('../e2e/utils.js');

const PACIENTE_BUSQUEDA = 'Percentil';
const TAG_CONOCIDO = 'UIREPRO-1789673419620';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx/' });
  const page = await context.newPage();

  const erroresApi = [];
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`); });

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 20000 });
  await page.waitForSelector('.rdt_TableRow', { timeout: 15000 });
  const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
  await buscarInput.fill(PACIENTE_BUSQUEDA);
  await page.waitForTimeout(2000);
  const fila = page.locator(`text=/${PACIENTE_BUSQUEDA}/i`).first();
  await fila.waitFor({ state: 'visible', timeout: 10000 });
  await fila.click();
  await page.waitForLoadState('load', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log(`📍 Perfil del paciente: ${page.url()}`);

  const consultasTab = page.getByRole('tab', { name: /^consultas$/i }).or(page.getByText(/^consultas$/i)).first();
  await consultasTab.click();
  await page.waitForTimeout(1500);
  await auditarPantalla(page, 'Lista de consultas', { maxWaitMs: 15000 });

  console.log(`Buscando la fila con tag conocido "${TAG_CONOCIDO}"...`);
  const filaTag = page.getByText(TAG_CONOCIDO, { exact: false }).first();
  const encontrada = (await filaTag.count()) > 0 && await filaTag.isVisible({ timeout: 5000 }).catch(() => false);
  if (!encontrada) throw new Error(`No se encontró la fila con tag "${TAG_CONOCIDO}" — puede haber caído de la primera página (120+ consultas).`);
  await filaTag.click();
  await page.waitForTimeout(2000);
  await auditarPantalla(page, 'Consulta seleccionada', { maxWaitMs: 15000 });
  await page.screenshot({ path: 'logs/getfilledform-subpestanas-screenshots/0-consulta-seleccionada.png', fullPage: true });

  // "General" ya se confirmó por screenshot (0-consulta-seleccionada.png,
  // pestaña activa por defecto): muestra "Motivo de consulta:
  // UIREPRO-1789673419620-motivo" correcto. Se excluye del loop porque el
  // texto "General" existe 2 veces en la página (pestaña de la consulta y
  // pestaña a nivel paciente) y no vale la pena resolver esa ambigüedad para
  // algo ya confirmado a simple vista. El label real de la última pestaña es
  // "Notas del Médico (Privado)", no "Notas del médico" (causa del "no
  // encontrada" anterior).
  const subPestañas = ['Exploración', 'Diagnóstico', 'Tratamiento', 'Notas del Médico (Privado)'];
  const hallazgos = ['General: ✅ con el tag (confirmado por screenshot, pestaña activa por defecto)'];

  for (const nombre of subPestañas) {
    console.log(`\n=== Sub-pestaña "${nombre}" ===`);
    const tab = page.getByText(new RegExp(`^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')).last();
    if (!(await tab.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`⚠️ Sub-pestaña "${nombre}" no encontrada/visible.`);
      hallazgos.push(`${nombre}: no encontrada`);
      continue;
    }
    await tab.click();
    await page.waitForTimeout(1000);
    await auditarPantalla(page, `Sub-pestaña ${nombre}`, { maxWaitMs: 15000 });

    const textoSub = await page.locator('body').innerText();
    const tieneCargando = /cargando/i.test(textoSub);
    const tieneTag = textoSub.includes(TAG_CONOCIDO);
    // Para "Exploración" en particular: buscar los nombres reales de ítems
    // del checklist (Cabeza/Cuello/...) para ver si el detalle aparece, no
    // solo el nombre de la sub-pestaña.
    const tieneItemsChecklist = /Cabeza|Articulado|Cardiovascular/i.test(textoSub);

    const estado = tieneCargando
      ? '⏳ AÚN MUESTRA "Cargando..."'
      : (nombre === 'Exploración'
          ? (tieneTag || tieneItemsChecklist ? '✅ con datos del checklist' : '❌ SIN datos del checklist visibles')
          : (tieneTag ? '✅ con el tag' : 'ℹ️ (esta pestaña no debería tener el tag — revisar a mano)'));

    console.log(`${estado}`);
    console.log('Texto (primeras 40 líneas no vacías):');
    console.log(textoSub.split('\n').filter(Boolean).slice(0, 40).join(' | '));

    const safe = nombre.replace(/[^\w]+/g, '-');
    await page.screenshot({ path: `logs/getfilledform-subpestanas-screenshots/${safe}.png`, fullPage: true });
    hallazgos.push(`${nombre}: ${estado}`);
  }

  console.log('\n=== RESUMEN ===');
  hallazgos.forEach(h => console.log('  ' + h));

  if (erroresApi.length > 0) {
    console.log(`\n🔴 ${erroresApi.length} error(es) de API durante toda la navegación:`);
    erroresApi.forEach(e => console.log('   ' + e));
  } else {
    console.log('\n✅ 0 errores de API durante toda la navegación.');
  }

  await browser.close();
})();
