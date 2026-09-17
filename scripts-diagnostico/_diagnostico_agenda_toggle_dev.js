// Diagnóstico puntual: appointments.create.spec.ts (2do test, "Confirm scheduled
// appointment from agenda") no encontró ninguna cita en 4 semanas buscando texto
// "agendada"/"programada", justo después de que el 1er test creó una cita real
// para HOY (confirmado con el heading "¡Cita agendada!", assert duro, no solo
// suposición). Antes de asumir que es solo un problema del test (texto buscado
// no coincide) hay que confirmar EN VIVO si la cita de hoy aparece en la Agenda,
// y qué hace el toggle "Mostrando citas" que se ve apagado en la captura final.
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

  page.on('response', async (r) => {
    if (r.url().includes('getFilteredAppointments')) {
      const body = await r.json().catch(() => null);
      const citas = body?.data || [];
      console.log(`📅 ${r.status()} getFilteredAppointments → ${citas.length} cita(s)`);
      citas.forEach(c => console.log(`   - ${JSON.stringify({ title: c.title, start: c.start || c.fecha || c.date, status: c.status || c.estatus, paciente: c.paciente_nombre || c.patient_name })}`));
    }
  });

  await page.goto('/Citas');
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const hoyBtn = page.getByRole('button', { name: /^hoy$/i });
  const hoyVisible = await hoyBtn.isVisible({ timeout: 3000 }).catch(() => false);
  const hoyDisabled = hoyVisible ? await hoyBtn.isDisabled().catch(() => false) : null;
  console.log('Botón "Hoy" visible:', hoyVisible, '| disabled (=ya estamos en la semana de hoy):', hoyDisabled);
  if (hoyVisible && !hoyDisabled) {
    await hoyBtn.click();
    await page.waitForTimeout(1500);
  }

  console.log('\n=== ESTADO INICIAL (semana de hoy, toggle tal cual carga) ===');
  const toggle = page.locator('button[role="switch"], input[type="checkbox"]').first();
  const toggleState = await toggle.getAttribute('aria-checked').catch(() => null);
  const toggleChecked = await toggle.isChecked().catch(() => null);
  console.log('Toggle "Mostrando citas" — aria-checked:', toggleState, '| checked:', toggleChecked);

  const bodyText1 = await page.locator('body').innerText();
  console.log('¿Contiene "No hay eventos"?', bodyText1.includes('No hay eventos'));
  console.log('¿Contiene "12:15"?', bodyText1.includes('12:15'));
  await page.screenshot({ path: 'test-results/_diag-agenda-hoy-antes-toggle.png', fullPage: true });

  console.log('\n=== Clickeando el toggle "Mostrando citas" ===');
  await toggle.click({ force: true }).catch(e => console.log('No se pudo clickear el toggle:', e.message));
  await page.waitForTimeout(2000);
  const bodyText2 = await page.locator('body').innerText();
  console.log('¿Contiene "No hay eventos"? (tras toggle)', bodyText2.includes('No hay eventos'));
  console.log('¿Contiene "12:15"? (tras toggle)', bodyText2.includes('12:15'));
  await page.screenshot({ path: 'test-results/_diag-agenda-hoy-despues-toggle.png', fullPage: true });

  console.log('\n=== Texto completo del área de calendario (tras toggle) ===');
  console.log(bodyText2.substring(0, 1500));

  await browser.close();
})();
