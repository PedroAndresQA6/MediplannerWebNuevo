// Diagnóstico: ¿motivo/padecimiento/notas_evolucion/nombre_referido/apariencia
// (sección "General" de la consulta) siguen en blanco en getConsultation
// mucho después de Finalizar, o es un retraso transitorio como el ya conocido
// de getFilledForm? Confirmado en 2 corridas reales (run2 consulta_id=94,
// run3 consulta_id=95) que a los ~6s tras Finalizar estos 5 campos vuelven
// vacíos mientras otros campos de la MISMA respuesta (impresion_diagnostico,
// indicaciones_general, diagnosticos) sí traen su valor. Este script reintenta
// getConsultation cada 30s durante varios minutos sobre la consulta 95
// (paciente 903) para ver si en algún momento se resuelve solo.
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null });
  const page = await context.newPage();

  let capturedToken = null;
  page.on('request', (req) => {
    if (req.url().includes('/api/') && !capturedToken) {
      const h = req.headers();
      if (h['x-rym-token-app']) capturedToken = h['x-rym-token-app'];
    }
  });

  await page.goto('https://admin-dev.mediplanner.mx/Dashboard');
  await page.waitForTimeout(3000);
  console.log('Token capturado:', capturedToken ? 'OK' : 'FALTA');

  const CONSULTA_ID = 95;
  const PACIENTE_ID = 903;

  const consultar = async () => {
    const resp = await page.request.post('https://admin-dev.mediplanner.mx/api/consultations/getConsultation', {
      headers: { 'Content-Type': 'application/json', 'x-rym-token-app': capturedToken },
      data: { paciente_id: PACIENTE_ID, consulta_id: CONSULTA_ID },
    });
    const body = await resp.json().catch(() => null);
    const d = body?.data || {};
    return {
      status: resp.status(),
      estatus: d.estatus,
      motivo: d.motivo,
      padecimiento: d.padecimiento,
      notas_evolucion: d.notas_evolucion,
      nombre_referido: d.nombre_referido,
      apariencia: d.apariencia,
    };
  };

  for (let i = 0; i < 10; i++) {
    const r = await consultar();
    const t = new Date().toISOString();
    console.log(`[${t}] intento ${i + 1}/10 status=${r.status} estatus="${r.estatus}"`);
    console.log(`   motivo=${JSON.stringify(r.motivo)} padecimiento=${JSON.stringify((r.padecimiento||'').substring(0,30))} notas_evolucion=${JSON.stringify((r.notas_evolucion||'').substring(0,30))} nombre_referido=${JSON.stringify(r.nombre_referido)} apariencia=${JSON.stringify((r.apariencia||'').substring(0,30))}`);
    if (r.motivo && r.padecimiento && r.notas_evolucion && r.nombre_referido && r.apariencia) {
      console.log('✅ TODOS los campos de "General" ya tienen valor — se resolvió solo.');
      break;
    }
    await page.waitForTimeout(30000);
  }

  await browser.close();
})();
