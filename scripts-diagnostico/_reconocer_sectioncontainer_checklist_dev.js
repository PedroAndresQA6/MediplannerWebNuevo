// Reconocimiento puntual (2026-09-10): sectionContainer() encuentra el
// ancestro .card de "Aparatos y sistemas" pero NO el de "Exploración
// segmentaria", pese a que Pedro confirma que las 2 secciones tienen el
// mismo formato (checkboxes que revelan Normal/Anormal + Observaciones al
// clickearlos). Se vuelca la cadena de ancestros (tag/class/altura) de cada
// heading en 2 momentos: apenas visible, y después de que su propio
// "Cargando preguntas" se resuelva -- para ver en qué punto exacto difieren.
//
// Cumple CLAUDE.md §0.7: usa auditarPantalla() (ya corregido, sin catches
// mudos sobre la precondición de carga) en vez de un chequeo ad hoc.
const { chromium } = require('@playwright/test');
const { createAppointment, buscarBotonIniciarDePaciente, auditarPantalla } = require('../e2e/utils.js');

async function dumpAncestros(page, headingRegex, etiqueta) {
  const heading = page.getByRole('heading', { level: 3, name: headingRegex }).first();
  await heading.waitFor({ state: 'visible', timeout: 15000 });
  console.log(`\n--- Ancestros de "${etiqueta}" ---`);
  const info = await heading.evaluate((el) => {
    const rows = [];
    let node = el.parentElement;
    let depth = 1;
    while (node && depth <= 12) {
      const rect = node.getBoundingClientRect();
      rows.push({ depth, tag: node.tagName.toLowerCase(), cls: node.className || '', height: Math.round(rect.height) });
      node = node.parentElement;
      depth++;
    }
    return rows;
  });
  info.forEach(r => console.log(`  [${r.depth}] <${r.tag} class="${r.cls}"> height=${r.height}`));
  return info;
}

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: 'https://admin-dev.mediplanner.mx/' });
  const page = await context.newPage();

  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});

  console.log('Creando cita para Percentil...');
  await createAppointment(page, 'Percentil');
  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);

  const iniciarBtn = await buscarBotonIniciarDePaciente(page, 'Percentil');
  if (!iniciarBtn) throw new Error('No se encontro boton Iniciar');
  await iniciarBtn.click({ force: true });

  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  await signosButton.waitFor({ state: 'visible', timeout: 10000 });
  await signosButton.click();
  await page.waitForTimeout(1000);

  await page.locator('input[name="peso"]').fill('13');
  await page.locator('input[name*="talla" i]').first().fill('92');
  await page.locator('input[placeholder="000/000 mmHg"]').fill('115/075');
  await page.locator('input[name*="temp" i]').first().fill('36.8');
  await page.locator('input[name*="card" i]').first().fill('78');
  await page.locator('input[name="oxigenacion"]').fill('97');
  await page.locator('input[name="frecuencia_respiratoria"]').fill('18');
  const glucosaInput = page.locator('input[name="glucosa"]');
  if (await glucosaInput.count() > 0) await glucosaInput.fill('90');
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
    return btn && !btn.disabled;
  }, { timeout: 10000 });
  await page.getByRole('button', { name: /^Guardar$/i }).click();
  await page.waitForTimeout(1500);
  const cerrarButton = page.getByRole('button', { name: /cerrar/i });
  if (await cerrarButton.isVisible().catch(() => false)) await cerrarButton.click();

  await auditarPantalla(page, 'Consulta recién cargada (recon sectionContainer)', { maxWaitMs: 30000 });

  // Antes de asumir role=heading level=3, confirmar que el texto existe en
  // ALGUNA forma en la página (por si cambió de nivel/tag) y sacar screenshot
  // para poder mirarlo si algo no calza.
  const anyExploracion = page.getByText('Exploración segmentaria', { exact: false });
  console.log(`\nOcurrencias de texto "Exploración segmentaria" en la página: ${await anyExploracion.count()}`);
  const h3s = await page.getByRole('heading', { level: 3 }).allTextContents();
  console.log('Headings level=3 encontrados:', JSON.stringify(h3s));
  await page.screenshot({ path: 'test-results/recon-sectioncontainer-momento1.png', fullPage: true }).catch(() => {});

  console.log('\n========== MOMENTO 1: apenas cargó la consulta (posible "Cargando preguntas" aún activo) ==========');
  await dumpAncestros(page, /^Exploración segmentaria\s*$/i, 'Exploración segmentaria (momento 1)');
  await dumpAncestros(page, /^Aparatos y sistemas$/i, 'Aparatos y sistemas (momento 1)');

  console.log('\n--- Esperando explícitamente a que ambos checklists resuelvan "Cargando preguntas" ---');
  await page.waitForFunction(() => !document.body.innerText.toLowerCase().includes('cargando preguntas'), { timeout: 20000 })
    .then(() => console.log('✅ "Cargando preguntas" ya no aparece en la página'))
    .catch(() => console.log('⚠️ "Cargando preguntas" seguía presente tras 20s (dato en sí mismo)'));
  await page.waitForTimeout(1000);

  console.log('\n========== MOMENTO 2: después de esperar a que "Cargando preguntas" se resuelva ==========');
  await dumpAncestros(page, /^Exploración segmentaria\s*$/i, 'Exploración segmentaria (momento 2)');
  await dumpAncestros(page, /^Aparatos y sistemas$/i, 'Aparatos y sistemas (momento 2)');

  await page.screenshot({ path: 'test-results/recon-sectioncontainer-momento2.png', fullPage: true }).catch(() => {});

  await context.storageState({ path: 'storageState.json' });
  await browser.close();
})();
