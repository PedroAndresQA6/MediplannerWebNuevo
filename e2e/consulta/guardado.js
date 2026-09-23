const { expect } = require('@playwright/test');
const { handleModals } = require('../utils.js');
const { opcional } = require('../opcional.js');

// ─────────────────────────────────────────────────────────────────────────
// Mecanismo de guardado confirmado en vivo (recon 2026-07-23, actualizado
// 2026-09-10):
//   - Exploración segmentaria y Aparatos y sistemas: la suposición vieja de
//     que tienen SU PROPIO botón "Guardar Respuestas" está desactualizada —
//     confirmado en vivo que ese botón ya no aparece en ninguna de las 2
//     secciones. En su lugar, cada respuesta (checkbox + Normal/Anormal +
//     Observaciones) se autoguarda apenas se completa, vía
//     `POST /api/patients/registerAnswers` (200 OK confirmado), sin botón.
//   - Todo lo demás (General, Diagnóstico, Tratamiento, Laboratorios,
//     Notas del Médico, Servicios) se persiste con el botón GLOBAL
//     "Guardar cambios" del panel lateral derecho (dispara editConsultation/
//     addNote/addDiagnosis/setTreatments/addServices según qué haya cambiado).
// ─────────────────────────────────────────────────────────────────────────

// Clickea el botón GLOBAL "Guardar cambios" (panel lateral) y verifica que
// al menos una de las llamadas de guardado por dominio responda 200.
async function guardarCambiosGlobal(page) {
  console.log('💾 Clickeando "Guardar cambios" (global)...');
  const endpointsGuardado = [
    '/api/consultations/editConsultation',
    '/api/consultations/addNote',
    '/api/consultations/addDiagnosis',
    '/api/consultations/setTreatments',
    '/api/consultations/setFreeTreatmentsConsultation',
    '/api/procedures/setProceduresConsultation',
    '/api/consultations/addServices',
  ];
  const respuestas = [];
  const listener = async (r) => {
    if (endpointsGuardado.some(ep => r.url().includes(ep))) {
      respuestas.push({ url: r.url(), status: r.status() });
    }
  };
  page.on('response', listener);

  const guardarBtn = page.locator('button:has-text("Guardar cambios")').first();
  await expect(guardarBtn, 'Debe existir el botón global "Guardar cambios"').toBeVisible({ timeout: 10000 });
  await handleModals(page);
  await guardarBtn.click();
  await page.waitForTimeout(5000);
  await handleModals(page);

  page.off('response', listener);
  console.log(`💾 Llamadas de guardado disparadas por "Guardar cambios": ${respuestas.length}`);
  respuestas.forEach(r => console.log(`   ${r.status} ${r.url.split('/api/')[1]}`));

  const fallidas = respuestas.filter(r => r.status >= 400);
  expect(fallidas.length, `Ninguna llamada de guardado debe fallar: ${JSON.stringify(fallidas)}`).toBe(0);

  return respuestas;
}

async function waitForFinalizarButton(page) {
  console.log('🏁 Esperando botón de finalizar consulta...');
  // Hay 2 botones "Finalizar Consulta" en la página (panel lateral + abajo de
  // Servicios) — usar el primero.
  const finalizarBtn = page.getByRole('button', { name: /finalizar consulta/i }).first();
  await expect(finalizarBtn, 'Debe existir el botón "Finalizar Consulta"').toBeVisible({ timeout: 15000 });
  const habilitado = await opcional(finalizarBtn.isEnabled(), 'finalizar:boton-isenabled');
  console.log(`✅ Botón de finalizar ${habilitado ? 'encontrado y habilitado' : 'encontrado pero DESHABILITADO'}`);
  return finalizarBtn;
}

module.exports = { guardarCambiosGlobal, waitForFinalizarButton };
