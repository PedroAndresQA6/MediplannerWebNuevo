// Repite _diagnostico_vacunacion_click_stack_dev.js pero fijando el viewport
// exacto de la resolucion del monitor principal (1536x912, WorkingArea real
// sin la barra de tareas, obtenida con PowerShell/System.Windows.Forms.Screen)
// y confirmando explicitamente que el zoom de la pagina esta al 100% -- a
// pedido de Pedro, para descartar que el desborde de layout del boton
// "Quitar fecha" (Hallazgo D) dependa del ancho de ventana usado antes
// (navegador maximizado con --start-maximized, que puede no coincidir
// exactamente con la resolucion real del monitor).
const { chromium } = require('@playwright/test');

const MONITOR_WIDTH = 1536;
const MONITOR_HEIGHT = 912;

(async () => {
  const browser = await chromium.launch({ headless: false, args: [`--window-size=${MONITOR_WIDTH},${MONITOR_HEIGHT}`, '--window-position=0,0'] });
  const context = await browser.newContext({
    storageState: 'storageState.json',
    viewport: { width: MONITOR_WIDTH, height: MONITOR_HEIGHT },
    deviceScaleFactor: 1,
    baseURL: 'https://admin-dev.mediplanner.mx',
  });
  const page = await context.newPage();

  const zoomInfo = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    outerWidth: window.outerWidth,
    devicePixelRatio: window.devicePixelRatio,
  }));
  console.log(`Viewport solicitado: ${MONITOR_WIDTH}x${MONITOR_HEIGHT}`);
  console.log(`window.innerWidth=${zoomInfo.innerWidth} devicePixelRatio=${zoomInfo.devicePixelRatio} (1 = zoom 100%, sin escalado)`);

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('span.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const pageSize = page.locator('select').first();
  if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.locator('span.font-semibold.text-sm.text-gray-900', { hasText: 'Agustin Tapia' }).first().click();
  await page.waitForTimeout(3000);
  await page.getByText(/^\s*Vacunación\s*$/i).first().click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  const table = page.locator('table.table-compact');
  const trashBtns = table.locator('button.btn-clear.text-danger');
  const before = await trashBtns.count();
  console.log('\nTrash buttons antes:', before);

  const first = trashBtns.first();
  await first.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const btnBox = await first.boundingBox();
  const centroX = btnBox.x + btnBox.width / 2;
  const centroY = btnBox.y + btnBox.height / 2;

  const stack = await page.evaluate(({ x, y }) => {
    return document.elementsFromPoint(x, y).slice(0, 4).map(el => ({
      tag: el.tagName,
      cls: el.className && typeof el.className === 'string' ? el.className : String(el.className),
      rect: (() => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })(),
    }));
  }, { x: centroX, y: centroY });

  console.log(`\nBounding box del botón trash: ${JSON.stringify(btnBox)}`);
  console.log(`\nPrimeros 4 elementos en el centro del botón (${centroX}, ${centroY}):`);
  stack.forEach((el, i) => console.log(`  [${i}] <${el.tag} class="${el.cls}"> rect=${JSON.stringify(el.rect)}`));

  const elementoTopmost = stack[0];
  const esElBoton = elementoTopmost.tag === 'BUTTON' || elementoTopmost.tag === 'svg' || elementoTopmost.tag === 'SVG' || elementoTopmost.tag === 'path' || elementoTopmost.tag === 'PATH';
  console.log(`\n¿El elemento superior en ese punto es el botón (o su ícono)? ${esElBoton ? '✅ SÍ' : '❌ NO — sigue siendo otra cosa'}`);

  console.log('\n--- Intentando clic real por coordenadas en el centro del botón ---');
  await page.mouse.click(centroX, centroY);
  await page.waitForTimeout(1500);
  const after = await trashBtns.count();
  console.log(`Trash buttons después del clic: ${after} ${after < before ? '✅ CAMBIÓ (el clic funcionó)' : '⚠️ sin cambio (el clic NO llegó al botón)'}`);

  await page.screenshot({ path: 'test-results/_diag-fullres-vacunacion.png', fullPage: false }).catch(() => {});

  await browser.close();
})();
