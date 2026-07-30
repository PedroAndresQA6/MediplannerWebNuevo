const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Error guessing sobre "Crear perfil de paciente nuevo" (/Pacientes → "Agregar
// paciente" → "Crear perfil de paciente nuevo") contra DEV, a pedido de Pedro:
// ¿se puede avanzar/guardar con campos obligatorios vacíos? ¿el front valida
// bien formatos (teléfono/correo) antes de mandar al backend?

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');

  const abrirFormulario = async (page) => {
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /agregar paciente/i }).first().click();
    await page.waitForTimeout(1500);
    await page.getByText(/crear perfil de paciente nuevo/i).first().click();
    await page.waitForTimeout(1500);
  };

  const dumpCampos = async (page, label) => {
    console.log(`\n=== [${label}] Campos del formulario ===`);
    const inputs = page.locator('input:visible, select:visible, textarea:visible');
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const el = inputs.nth(i);
      const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '?');
      const name = await el.getAttribute('name').catch(() => '');
      const type = await el.getAttribute('type').catch(() => '');
      const required = await el.evaluate(e => e.required || e.getAttribute('aria-required') === 'true').catch(() => false);
      const val = await el.inputValue().catch(() => '');
      console.log(`  [${i}] <${tag}> name="${name}" type="${type}" required=${required} valorActual="${val}"`);
    }
  };

  // ── Escenario 1: TODOS los campos vacíos, clic directo en "Guardar cambios" ──
  await (async () => {
    const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
    const page = await context.newPage();
    const erroresApi = [];
    let seEnvioRequest = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/') && (r.method() === 'POST') && /patient/i.test(r.url())) seEnvioRequest = true;
    });
    page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`); });

    console.log('\n\n########## ESCENARIO 1: Guardar con TODO vacío ##########');
    await abrirFormulario(page);
    await dumpCampos(page, 'Escenario 1 - antes de guardar, todo vacío');

    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await page.waitForTimeout(3000);

    console.log(`¿Se disparó un request de guardado al backend? ${seEnvioRequest ? '⚠️ SÍ' : 'No (bloqueado en front)'}`);
    console.log(`URL tras el clic: ${page.url()}`);
    const textoValidacion = await page.locator('body').innerText().catch(() => '');
    const huboMensajeError = /obligatorio|requerido|required|campo.*vac[ií]o/i.test(textoValidacion);
    console.log(`¿Hay mensaje de validación visible? ${huboMensajeError ? 'Sí' : 'No detectado por regex'}`);
    await page.screenshot({ path: 'test-results/eg-alta-paciente-1-todo-vacio.png', fullPage: true }).catch(() => {});
    if (erroresApi.length) console.log('🔴 Errores de API:', erroresApi);
    await context.close();
  })();

  // ── Escenario 2: nombre con solo espacios (bypass de "required" con espacios) ──
  await (async () => {
    const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
    const page = await context.newPage();
    let seEnvioRequest = false;
    const erroresApi = [];
    page.on('request', (r) => { if (r.url().includes('/api/') && r.method() === 'POST' && /patient/i.test(r.url())) seEnvioRequest = true; });
    page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`); });

    console.log('\n\n########## ESCENARIO 2: Nombre = solo espacios, resto vacío ##########');
    await abrirFormulario(page);
    await page.locator('input[name="sNombre"]').fill('   ');
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await page.waitForTimeout(3000);
    console.log(`¿Se disparó un request de guardado? ${seEnvioRequest ? '⚠️ SÍ' : 'No'}`);
    console.log(`URL tras el clic: ${page.url()}`);
    await page.screenshot({ path: 'test-results/eg-alta-paciente-2-nombre-espacios.png', fullPage: true }).catch(() => {});
    if (erroresApi.length) console.log('🔴 Errores de API:', erroresApi);
    await context.close();
  })();

  // ── Escenario 3: teléfono y correo con formato inválido ──
  await (async () => {
    const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
    const page = await context.newPage();
    let bodyEnviado = null;
    const erroresApi = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/') && r.method() === 'POST' && /patient/i.test(r.url())) {
        bodyEnviado = r.postData();
      }
    });
    page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) erroresApi.push(`${r.status()} ${r.url()}`); });

    console.log('\n\n########## ESCENARIO 3: Teléfono con letras + correo sin @ ##########');
    await abrirFormulario(page);
    const SUFIJO = 'S3_' + Math.random().toString(36).slice(2, 8);
    await page.locator('input[name="sNombre"]').fill(`QA_ErrorGuessing_${SUFIJO}`);
    await page.locator('input[name="sPaterno"]').fill('Prueba');
    await page.locator('input[name="sMaterno"]').fill('Invalida');
    await page.locator('input[name="sTelefono1"]').fill('telefono-no-numerico');
    await page.locator('input[name="sCorreo"]').fill('correo-sin-arroba-ni-dominio');
    await page.screenshot({ path: 'test-results/eg-alta-paciente-3-antes.png', fullPage: true }).catch(() => {});
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await page.waitForTimeout(3000);
    console.log(`URL tras el clic: ${page.url()}`);
    console.log(`Body enviado al backend (si lo hubo): ${bodyEnviado}`);
    const textoTrasGuardar = await page.locator('body').innerText().catch(() => '');
    console.log(`¿Modal de éxito "Aceptar" visible? ${/aceptar/i.test(textoTrasGuardar)}`);
    await page.screenshot({ path: 'test-results/eg-alta-paciente-3-despues.png', fullPage: true }).catch(() => {});
    if (erroresApi.length) console.log('🔴 Errores de API:', erroresApi);
    else console.log('✅ 0 errores de API — si se guardó, hay que confirmar si el backend aceptó el teléfono/correo inválidos tal cual.');
    await context.close();
  })();

  // ── Escenario 4: llenar el formulario y CERRAR sin guardar (perdida de progreso esperada, pero ¿avisa?) ──
  await (async () => {
    const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
    const page = await context.newPage();
    console.log('\n\n########## ESCENARIO 4: Llenar todo y cerrar/navegar SIN guardar ##########');
    await abrirFormulario(page);
    await page.locator('input[name="sNombre"]').fill('QA_SinGuardar');
    await page.locator('input[name="sPaterno"]').fill('NoDebeQuedar');
    await page.locator('input[name="sMaterno"]').fill('Persistido');
    await page.locator('input[name="sTelefono1"]').fill('4425557788');
    await page.locator('input[name="sCorreo"]').fill('qa.singuardar@correofalso.com');
    await page.screenshot({ path: 'test-results/eg-alta-paciente-4-lleno-sin-guardar.png', fullPage: true }).catch(() => {});

    // Buscar botón de cerrar/cancelar (X, "Cancelar") en vez de navegar por URL,
    // para simular al usuario cerrando el modal por error.
    const cerrarBtn = page.locator('button[aria-label*="close" i], button:has-text("×"), button:has-text("Cancelar")').first();
    if (await cerrarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Cerrando el formulario con el botón de cerrar/cancelar (sin guardar)...');
      await cerrarBtn.click();
    } else {
      console.log('No se encontró botón de cerrar explícito — navegando directo a /Pacientes en su lugar.');
      await page.goto('/Pacientes');
    }
    await page.waitForTimeout(2000);
    console.log(`¿Hubo alguna confirmación de "tienes cambios sin guardar"? (revisar el texto/captura)`);
    await page.screenshot({ path: 'test-results/eg-alta-paciente-4-tras-cerrar.png', fullPage: true }).catch(() => {});

    // Reabrir el formulario y ver si por error quedó algo precargado (autosave
    // silencioso no documentado) — no debería, pero se confirma.
    await abrirFormulario(page);
    const nombreTrasReabrir = await page.locator('input[name="sNombre"]').inputValue().catch(() => '');
    console.log(`Valor de "Nombre" al reabrir el formulario limpio: "${nombreTrasReabrir}" (esperado: vacío)`);
    if (nombreTrasReabrir.trim()) {
      console.log('⚠️⚠️ POSIBLE HALLAZGO: el formulario reabierto conserva datos de un intento anterior no guardado.');
    }
    await context.close();
  })();

  await browser.close();
  console.log('\n\n=== FIN DE LOS 4 ESCENARIOS ===');
})();
