const { chromium } = require('@playwright/test');

// Complemento de verificación: getProceduresList (con doctor_id, que faltaba
// en la corrida anterior) + checkboxes de Exploración segmentaria/Aparatos y
// sistemas vía getFilledForm, para la consulta id=1 / paciente_id=1778
// ("Prueba DE Codigo") ya creada y finalizada en producción.

const BASE = 'https://admin.mediplanner.mx/';
const PACIENTE_ID = 1778;
const CONSULTA_ID = 1;

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({
    storageState: 'Mediplanner produccion/storageState.json',
    viewport: null,
    baseURL: BASE,
  });
  const page = await context.newPage();

  let token = null;
  let doctorId = null;
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !token) {
      const h = req.headers();
      if (h['x-rym-token-app']) token = h['x-rym-token-app'];
    }
  });
  page.on('response', async (r) => {
    if (r.url().includes('/api/profile/getProfile')) {
      const body = await r.json().catch(() => null);
      if (body?.data?.id) doctorId = body.data.id;
    }
  });

  await page.goto('/Dashboard');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await explorarLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await explorarLink.click();
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(2000);

  console.log('Token capturado:', token ? 'sí' : 'NO');
  console.log('doctor_id capturado:', doctorId);

  const procedures = await page.evaluate(async ({ pacienteId, consultaId, tok, doctorId }) => {
    const resp = await fetch('/api/procedures/getProceduresList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
      body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId, doctor_id: doctorId }),
      credentials: 'include',
    });
    return resp.json();
  }, { pacienteId: PACIENTE_ID, consultaId: CONSULTA_ID, tok: token, doctorId });
  console.log('\n=== getProceduresList (con doctor_id) ===');
  console.log(JSON.stringify(procedures, null, 2));

  for (const formInfo of [{ nombre: 'Exploración segmentaria', relId: 116 }, { nombre: 'Aparatos y sistemas', relId: 115 }]) {
    const respuestas = await page.evaluate(async ({ pacienteId, consultaId, relacionId, tok, doctorId }) => {
      const resp = await fetch('/api/patients/getFilledForm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rym-token-app': tok },
        body: JSON.stringify({ paciente_id: pacienteId, relacion_id: relacionId, consulta_id: consultaId, doctor_id: doctorId }),
        credentials: 'include',
      });
      return resp.json();
    }, { pacienteId: PACIENTE_ID, consultaId: CONSULTA_ID, relacionId: formInfo.relId, tok: token, doctorId });
    console.log(`\n=== getFilledForm (${formInfo.nombre}, relacion_id=${formInfo.relId}) ===`);
    console.log(JSON.stringify(respuestas, null, 2).substring(0, 3000));
  }

  await browser.close();
})();
