const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '../.env' });

// Investigación con paciencia REAL (CLAUDE.md §0.4: nada de racionalizar sin
// evidencia de esta corrida) — porteado de _investigar_getfilledform_blanco_dev.js.
// La 2ª corrida de doctor-consultation en STAGING (2026-07-31) terminó con
// Exploración segmentaria/Aparatos y sistemas TODAVÍA en blanco tras los 130s
// completos de reintentos del spec (peor que dev, que había resuelto entre
// 65-100s). Se retoma esa misma consulta y se sigue monitoreando por API cada
// 15s, hasta 5 min más, para ver si en algún momento posterior resuelve o si
// de verdad se queda en blanco permanentemente en staging.

const PACIENTE_ID = 1025;
const CONSULTA_ID = 9;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = 'https://admin-staging.mediplanner.mx';
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  let capturedToken = null;
  let doctorId = null;
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !capturedToken) {
      const h = req.headers();
      if (h['x-rym-token-app']) capturedToken = h['x-rym-token-app'];
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/profile/getProfile')) {
      const body = await r.json().catch(() => null);
      if (body?.data?.id) doctorId = body.data.id;
    }
  });

  // Navegar a cualquier pantalla autenticada para capturar token + doctor_id.
  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(3000);
  for (let intento = 0; intento < 4 && !capturedToken; intento++) {
    console.log(`⏳ Token todavía no capturado, esperando/reintentando (intento ${intento + 1}/4)...`);
    await page.reload().catch(() => {});
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(3000);
  }
  console.log(`Token capturado: ${capturedToken ? 'OK' : 'FALTA'} | doctor_id: ${doctorId}`);
  if (!capturedToken) {
    console.log('❌ No se pudo capturar el token tras varios reintentos — abortando (revisar storageState.json / login).');
    await browser.close();
    return;
  }

  const fetchApi = async (endpoint, body) => {
    const resp = await page.request.post(`/api/${endpoint}`, {
      headers: { 'Content-Type': 'application/json', 'x-rym-token-app': capturedToken },
      data: body,
    });
    return resp.json().catch(() => null);
  };

  const forms = await fetchApi('consultations/getForms', { paciente_id: PACIENTE_ID, consulta_id: CONSULTA_ID });
  console.log('Formularios de la consulta:', JSON.stringify(forms?.data?.map(f => ({ nombre: f.nombre, relacion_id: f.relacion_id })), null, 2));

  const formExploracion = (forms?.data || []).find(f => f.nombre.toLowerCase().includes('exploracion'));
  const formAparatos = (forms?.data || []).find(f => f.nombre.toLowerCase().includes('aparatos'));

  if (!formExploracion && !formAparatos) {
    console.log('⚠️ No se encontraron los formularios de Exploración/Aparatos en getForms — abortando.');
    await browser.close();
    return;
  }

  const detalle = await fetchApi('consultations/getConsultation', { paciente_id: PACIENTE_ID, consulta_id: CONSULTA_ID });
  console.log(`Consulta estatus: ${detalle?.data?.estatus}`);

  // Ir al perfil del paciente y a la pestaña Consultas → esta consulta, para
  // ver la vista real (no solo API).
  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
  await buscarInput.fill('Percentil');
  await page.waitForTimeout(2000);
  const fila = page.locator(`text=/Percentil/i`).first();
  await fila.waitFor({ state: 'visible', timeout: 10000 });
  await fila.click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`📍 Perfil del paciente: ${page.url()}`);

  const MAX_MIN = 5;
  const intervaloMs = 15000;
  const totalVueltas = Math.ceil((MAX_MIN * 60000) / intervaloMs);
  const t0 = Date.now();

  for (let vuelta = 1; vuelta <= totalVueltas; vuelta++) {
    const tRel = Math.round((Date.now() - t0) / 1000);
    console.log(`\n=== [t=${tRel}s desde el inicio de ESTE monitoreo] Vuelta ${vuelta}/${totalVueltas} ===`);

    for (const [nombreLog, formInfo] of [['Exploración segmentaria', formExploracion], ['Aparatos y sistemas', formAparatos]]) {
      if (!formInfo) continue;
      const filled = await fetchApi('patients/getFilledForm', { paciente_id: PACIENTE_ID, relacion_id: formInfo.relacion_id, consulta_id: CONSULTA_ID, doctor_id: doctorId });
      const elementos = filled?.data?.grupos?.[0]?.elementos || [];
      const valoresNoNulos = elementos.filter(e => e.valor !== 0 && e.valor !== null && e.valor !== '').length;
      console.log(`  [API] ${nombreLog}: status=${filled?.status} elementos=${elementos.length} valoresConDato=${valoresNoNulos}`);
      if (valoresNoNulos > 0) {
        console.log(`  ✅✅ [API] ${nombreLog} YA MUESTRA DATOS REALES en t=${tRel}s de este monitoreo — no es un bug permanente, solo tardó más de lo probado antes.`);
      }
    }

    if (vuelta === 1 || vuelta % 2 === 0 || vuelta === totalVueltas) {
      await page.reload();
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const textoUI = await page.locator('body').innerText().catch(() => '');
      const cargandoEnUI = (textoUI.match(/Cargando preguntas/gi) || []).length;
      console.log(`  [UI] "Cargando preguntas" visible ${cargandoEnUI} vez(es) tras recargar el perfil del paciente`);
      await page.screenshot({ path: `test-results/investigar-getfilledform-staging-t${tRel}s.png`, fullPage: true }).catch(() => {});
    }

    if (vuelta < totalVueltas) await page.waitForTimeout(intervaloMs);
  }

  console.log('\n\n=== FIN de la investigación (5 min de monitoreo adicionales sobre consulta_id=9) ===');
  await browser.close();
})();
