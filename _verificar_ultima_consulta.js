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

  let consultationsBody = null;
  let capturedHeaders = null;
  page.on('response', async (r) => {
    if (r.url().includes('/api/consultations/getConsultations')) {
      consultationsBody = await r.json().catch(() => null);
    }
  });
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !capturedHeaders) {
      const h = req.headers();
      if (h['x-rym-token-app']) capturedHeaders = h;
    }
  });

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('.rdt_TableRow', { timeout: 20000 });
  const buscar = page.locator('input[placeholder*="Buscar" i]').first();
  await buscar.fill('Percentil');
  await page.waitForTimeout(2000);
  const fila = page.locator('span.font-semibold.text-sm.text-gray-900', { hasText: 'Percentil' }).first();
  await fila.click();
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);

  const consultasTab = page.locator('button:has-text("Consultas")').first();
  const respPromise = page.waitForResponse(r => r.url().includes('/api/consultations/getConsultations'), { timeout: 15000 }).catch(() => null);
  await consultasTab.click();
  await respPromise;
  await page.waitForTimeout(2000);

  const consultas = consultationsBody?.data?.consultations || [];
  // La MAS RECIENTE = el id interno mas alto (no confiar en el orden visual
  // de la lista ni en "primera fila con la fecha de hoy").
  const masReciente = consultas.reduce((max, c) => (!max || c.id > max.id) ? c : max, null);
  console.log(`Consulta mas reciente: id=${masReciente.id} appointment_id=${masReciente.cita?.appointment_id} hora=${masReciente.hora_creacion} estatus=${masReciente.estatus}`);
  console.log('Token capturado:', capturedHeaders ? 'si' : 'NO');

  const token = capturedHeaders?.['x-rym-token-app'];

  const detalle = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
    const resp = await fetch('/api/consultations/getConsultation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
      body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }),
      credentials: 'include',
    });
    return resp.json();
  }, { pacienteId: 903, consultaId: masReciente.id, tok: token });

  console.log('\n=== getConsultation (detalle completo de la consulta mas reciente) ===');
  console.log(JSON.stringify(detalle, null, 2));

  const treatments = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
    const resp = await fetch('/api/consultations/getTreatments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
      body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }),
      credentials: 'include',
    });
    return resp.json();
  }, { pacienteId: 903, consultaId: masReciente.id, tok: token });
  console.log('\n=== getTreatments (misma consulta) ===');
  console.log(JSON.stringify(treatments, null, 2));

  const procedures = await page.evaluate(async ({ pacienteId, consultaId, tok }) => {
    const resp = await fetch('/api/procedures/getProceduresList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
      body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId }),
      credentials: 'include',
    });
    return resp.json();
  }, { pacienteId: 903, consultaId: masReciente.id, tok: token });
  console.log('\n=== getProceduresList (misma consulta) ===');
  console.log(JSON.stringify(procedures, null, 2).substring(0, 1500));

  // Checkboxes de Exploracion segmentaria / Aparatos y sistemas: probar
  // registerAnswers-related GET (getFilledForm por relacion_id de formulario
  // + consulta) para ver si trae las respuestas guardadas.
  for (const formInfo of [{ nombre: 'Exploracion segmentaria', relId: 116 }, { nombre: 'Aparatos y sistemas', relId: 115 }]) {
    const respuestas = await page.evaluate(async ({ pacienteId, consultaId, relacionId, tok }) => {
      const resp = await fetch('/api/patients/getFilledForm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
        body: JSON.stringify({ paciente_id: pacienteId, relacion_id: relacionId, consulta_id: consultaId }),
        credentials: 'include',
      });
      return resp.json();
    }, { pacienteId: 903, consultaId: masReciente.id, relacionId: formInfo.relId, tok: token });
    console.log(`\n=== getFilledForm (${formInfo.nombre}, relacion_id=${formInfo.relId}) ===`);
    console.log(JSON.stringify(respuestas, null, 2).substring(0, 2000));
  }

  await browser.close();
})();
