const { chromium } = require('@playwright/test');
const { createAppointment } = require('./e2e/utils.js');
require('dotenv').config({ path: '.env' });

// Error guessing NUEVO (2026-07-30): candidato identificado en memoria como
// sin probar — carrera de búsqueda en el combobox CIE-10 de Diagnóstico.
// Mismo patrón ya CONFIRMADO como bug de test (no de plataforma) en
// Medicamento/Laboratorio: escribir un código, cambiarlo rápido antes de que
// carguen las opciones, y clickear .first() a ciegas puede seleccionar el
// diagnóstico equivocado. Acá se prueba deliberadamente sin la mitigación
// (buscar coincidencia real) para ver si laом app se comporta bien sola.

const PACIENTE_BUSQUEDA = process.env.PACIENTE_BUSQUEDA || 'Percentil';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
  const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
  const page = await context.newPage();

  await page.goto('/Dashboard');
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2000);
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  if (await explorarLink.isVisible({ timeout: 2000 }).catch(() => false)) { await explorarLink.click({ force: true }).catch(() => {}); await page.waitForTimeout(1500); }
  const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
  if (await configurarMasTardeLink.isVisible({ timeout: 2000 }).catch(() => false)) { await configurarMasTardeLink.click({ force: true }).catch(() => {}); await page.waitForTimeout(1500); }

  console.log(`📅 Creando cita para "${PACIENTE_BUSQUEDA}"...`);
  await createAppointment(page, PACIENTE_BUSQUEDA);
  await page.waitForTimeout(1500);

  const buscarIniciarDelPaciente = async () => {
    const botones = page.getByRole('button', { name: /iniciar/i });
    const total = await botones.count();
    for (let i = 0; i < total; i++) {
      const btn = botones.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      const texto = (await fila.textContent().catch(() => '') || '');
      if (texto.toLowerCase().includes(PACIENTE_BUSQUEDA.toLowerCase())) return btn;
    }
    return null;
  };

  let iniciarBtn = null;
  for (let intento = 1; intento <= 3 && !iniciarBtn; intento++) {
    if (intento === 1) await page.goto('/Dashboard'); else await page.reload();
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(2500);
    const explorarLink2 = page.getByText(/prefiero explorar por mi cuenta/i);
    if (await explorarLink2.isVisible({ timeout: 2000 }).catch(() => false)) await explorarLink2.click({ force: true }).catch(() => {});
    const configurarMasTardeLink2 = page.getByText(/configurar más tarde/i);
    if (await configurarMasTardeLink2.isVisible({ timeout: 2000 }).catch(() => false)) await configurarMasTardeLink2.click({ force: true }).catch(() => {});
    iniciarBtn = await buscarIniciarDelPaciente();
  }
  if (!iniciarBtn) throw new Error('No se encontró botón "Iniciar"');
  await iniciarBtn.click();
  await page.waitForTimeout(1500);

  const signosButton = page.getByRole('button', { name: /capturar signos vitales/i });
  if (await signosButton.isVisible({ timeout: 8000 }).catch(() => false)) {
    await signosButton.click();
    await page.waitForTimeout(1000);
    await page.locator('input[name="peso"]').fill('70').catch(() => {});
    const tallaInput = page.locator('input[name*="talla" i]');
    if (await tallaInput.count() > 0) await tallaInput.first().fill('170').catch(() => {});
    const presionInput = page.locator('input[placeholder="000/000 mmHg"]');
    if (await presionInput.isVisible().catch(() => false)) await presionInput.fill('120/080').catch(() => {});
    const tempInput = page.locator('input[name*="temp" i]');
    if (await tempInput.count() > 0) await tempInput.first().fill('36.5').catch(() => {});
    const fcInput = page.locator('input[name*="card" i]');
    if (await fcInput.count() > 0) await fcInput.first().fill('80').catch(() => {});
    const satInput = page.locator('input[name="oxigenacion"]');
    if (await satInput.count() > 0) await satInput.first().fill('98').catch(() => {});
    const frInput = page.locator('input[name="frecuenciaRespiratoria"]');
    if (await frInput.count() > 0) await frInput.first().fill('18').catch(() => {});
    await page.waitForTimeout(500);
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim().toLowerCase() === 'guardar');
      return btn && !btn.disabled;
    }, { timeout: 10000 }).catch(() => {});
    await page.getByRole('button', { name: /^Guardar$/i }).click().catch(() => {});
    await page.waitForTimeout(1500);
    const cerrarButton = page.getByRole('button', { name: /cerrar/i });
    if (await cerrarButton.isVisible().catch(() => false)) { await cerrarButton.click(); await page.waitForTimeout(1000); }
  }

  await page.waitForFunction(() => !document.body.innerText.includes('Cargando información de consulta'), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('✅ En pantalla de Consulta');

  // Ubicar el combobox CIE-10 directo por su propia etiqueta ("Diagnóstico
  // CIE-10*"), más específico que el heading de sección (evita ambigüedad
  // con otros combobox de la página, ej. Medicamentos/Laboratorio).
  const cie10Label = page.getByText(/^Diagnóstico CIE-10/i).first();
  await cie10Label.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
    await page.screenshot({ path: 'test-results/eg-carrera-cie10-DEBUG-no-heading.png', fullPage: true }).catch(() => {});
    throw new Error('No se encontró la etiqueta "Diagnóstico CIE-10" — ver screenshot DEBUG');
  });
  await cie10Label.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando datos diagnósticos'), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);

  const cie10Input = cie10Label.locator('xpath=following::textarea[1]');
  await cie10Input.waitFor({ state: 'visible', timeout: 15000 });
  await cie10Input.click();
  await page.waitForTimeout(500);

  console.log('\n########## CARRERA: escribir "R05" (tos) y cambiar a "A09" (diarrea) SIN esperar ##########');
  await cie10Input.fill('R05'); // Tos
  await page.waitForTimeout(150); // muy poco tiempo — no alcanza a resolver
  await cie10Input.fill('');
  await cie10Input.fill('A09'); // Diarrea y gastroenteritis — código totalmente distinto
  await page.waitForTimeout(2000); // ahora sí esperar a que asiente

  const options = page.locator('[role="option"]:visible, div[id*="option"]:visible');
  const optionCount = await options.count();
  console.log(`Opciones visibles tras la carrera: ${optionCount}`);
  const textos = [];
  for (let i = 0; i < Math.min(optionCount, 5); i++) {
    textos.push((await options.nth(i).textContent().catch(() => '') || '').trim());
  }
  console.log(`Primeras opciones: ${JSON.stringify(textos)}`);

  if (optionCount > 0) {
    const primeraOpcion = textos[0] || '';
    await options.first().click();
    await page.waitForTimeout(500);
    console.log(`Se clickeó (a ciegas, sin verificar coincidencia): "${primeraOpcion}"`);

    // ¿La opción clickeada corresponde al código FINAL (A09, diarrea) o al
    // primero (R05, tos)? Buscamos "diarrea"/"gastroenteritis" (A09) vs
    // "tos"/"bronqu" (R05) en el texto de la opción realmente clickeada.
    const pareceA09 = /diarrea|gastroenteritis|A09/i.test(primeraOpcion);
    const pareceR05 = /tos|bronqu|R05/i.test(primeraOpcion);
    console.log(`¿La opción clickeada corresponde a A09 (código final)? ${pareceA09}`);
    console.log(`¿La opción clickeada corresponde a R05 (código anterior, obsoleto)? ${pareceR05}`);
    if (pareceR05 && !pareceA09) {
      console.log('⚠️⚠️ HALLAZGO: la carrera de búsqueda seleccionó el diagnóstico del código ANTERIOR (R05), no el código final tipeado (A09) — mismo patrón de bug ya confirmado en Medicamento/Laboratorio, ahora en CIE-10.');
    } else if (pareceA09) {
      console.log('✅ El combobox se resolvió correctamente al código final (A09) pese a la carrera — sin hallazgo.');
    } else {
      console.log('ℹ️ No se pudo clasificar automáticamente el texto de la opción — revisar manualmente el listado impreso arriba.');
    }
  } else {
    console.log('⚠️ Sin opciones visibles tras la carrera — no se pudo probar este escenario.');
  }
  await page.screenshot({ path: 'test-results/eg-carrera-cie10.png', fullPage: true }).catch(() => {});

  // ── A pedido de Pedro: completar el flujo real — guardar y FINALIZAR la
  // consulta, y después revisar toda la información presentada al terminar,
  // para confirmar que el diagnóstico equivocado (de la carrera) realmente
  // queda persistido y no se corrige solo en algún paso posterior. ──
  console.log('\n########## Completando el flujo: llenar Impresión diagnóstica, Guardar cambios, Finalizar ##########');

  const impresionInput = page.locator('textarea[placeholder="Impresión diagnóstica"]').first();
  if (await impresionInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await impresionInput.fill('Impresión diagnóstica de prueba — error guessing carrera CIE-10 (2026-07-30).');
  }

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

  const guardarGlobalBtn = page.locator('button:has-text("Guardar cambios")').first();
  if (await guardarGlobalBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    const respAddDiag = page.waitForResponse(r => r.url().includes('/api/consultations/addDiagnosis'), { timeout: 15000 }).catch(() => null);
    await guardarGlobalBtn.click();
    const resp = await respAddDiag;
    console.log(`addDiagnosis → status=${resp?.status()}`);
    await page.waitForTimeout(2000);
  } else {
    console.log('⚠️ No se encontró el botón "Guardar cambios"');
  }

  console.log('\n🏁 Finalizando consulta...');
  let consultaId = null;
  let pacienteId = null;
  const finalizarBtn = page.locator('button:has-text("Finalizar Consulta")').first();
  if (await finalizarBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    const reqPromise = page.waitForRequest(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 15000 }).catch(() => null);
    const respPromise = page.waitForResponse(r => r.url().includes('/api/consultations/finishConsultation'), { timeout: 15000 }).catch(() => null);
    await finalizarBtn.click();
    await page.waitForTimeout(1000);
    // Puede pedir confirmación (modal "¿Estás seguro?" o similar).
    const confirmarFinal = page.getByRole('button', { name: /^(confirmar|sí|aceptar|finalizar)/i }).last();
    if (await confirmarFinal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmarFinal.click().catch(() => {});
    }
    const [req, resp] = await Promise.all([reqPromise, respPromise]);
    if (req) {
      const body = JSON.parse(req.postData() || '{}');
      consultaId = body.consulta_id ?? body.id ?? null;
      pacienteId = body.paciente_id ?? null;
    }
    console.log(`finishConsultation → status=${resp?.status()} consulta_id=${consultaId} paciente_id=${pacienteId}`);
    await page.waitForTimeout(2500);
  } else {
    console.log('⚠️ No se encontró el botón "Finalizar Consulta"');
  }

  await page.screenshot({ path: 'test-results/eg-carrera-cie10-tras-finalizar.png', fullPage: true }).catch(() => {});
  console.log('\n=== Información presentada tras Finalizar (texto de la página) ===');
  const textoTrasFinalizar = await page.locator('body').innerText().catch(() => '');
  console.log(textoTrasFinalizar.split('\n').filter(Boolean).slice(0, 40).join(' | '));

  // Revisar vía API el diagnóstico que realmente quedó guardado.
  if (consultaId && pacienteId && capturedToken) {
    await page.waitForTimeout(3000);
    const detalle = await page.request.post('/api/consultations/getConsultation', {
      headers: { 'Content-Type': 'application/json', 'x-rym-token-app': capturedToken },
      data: { paciente_id: pacienteId, consulta_id: consultaId },
    }).then(r => r.json()).catch(() => null);
    console.log('\n=== Diagnóstico(s) guardado(s) según getConsultation ===');
    console.log(JSON.stringify(detalle?.data?.diagnosticos, null, 2));
    const diagnosticosTexto = JSON.stringify(detalle?.data?.diagnosticos || []);
    if (/R05|TOS/i.test(diagnosticosTexto) && !/A09|DIARREA/i.test(diagnosticosTexto)) {
      console.log('\n⚠️⚠️ CONFIRMADO POST-FINALIZAR: el diagnóstico "R05X - TOS" (código equivocado, de la carrera) quedó GUARDADO PERMANENTEMENTE en la consulta finalizada. El paciente queda con un diagnóstico clínico incorrecto en su expediente.');
    } else if (/A09|DIARREA/i.test(diagnosticosTexto)) {
      console.log('\nℹ️ El diagnóstico final guardado corresponde a A09 (correcto) — no se confirma persistencia del error tras Finalizar.');
    } else {
      console.log('\nℹ️ No se pudo clasificar el diagnóstico final — revisar el JSON impreso arriba.');
    }
  } else {
    console.log(`\n⚠️ No se pudo verificar vía API (consultaId=${consultaId}, pacienteId=${pacienteId}, token=${capturedToken ? 'OK' : 'FALTA'})`);
  }

  console.log('\n\n=== FIN ===');
  await page.waitForTimeout(20000);
  await browser.close();
})();
