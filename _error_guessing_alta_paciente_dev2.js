const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Segunda pasada, más precisa: loguea TODOS los POST /api/ (URL + body + status
// + respuesta) alrededor del clic en "Guardar cambios", para saber con certeza
// si el front bloquea el guardado con campos obligatorios vacíos/inválidos o si
// llega una llamada de creación real al backend.

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

  const correrEscenario = async (nombre, llenarCampos) => {
    const context = await browser.newContext({ storageState: 'storageState.json', viewport: null, baseURL: base });
    const page = await context.newPage();
    const llamadas = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/') && r.method() === 'POST') {
        llamadas.push({ url: r.url().split('/api/')[1], body: r.postData(), status: null, respBody: null });
      }
    });
    page.on('response', async (r) => {
      if (r.url().includes('/api/') && r.request().method() === 'POST') {
        const entry = llamadas.slice().reverse().find(e => e.url === r.url().split('/api/')[1] && e.status === null);
        if (entry) {
          entry.status = r.status();
          entry.respBody = (await r.text().catch(() => '')).substring(0, 200);
        }
      }
    });

    console.log(`\n\n########## ${nombre} ##########`);
    await abrirFormulario(page);
    await llenarCampos(page);
    await page.screenshot({ path: `test-results/eg2-${nombre.replace(/\s+/g, '_')}-antes.png`, fullPage: true }).catch(() => {});

    const marcaAntes = llamadas.length;
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await page.waitForTimeout(3500);

    console.log(`URL tras el clic: ${page.url()}`);
    const nuevasLlamadas = llamadas.slice(marcaAntes);
    if (nuevasLlamadas.length === 0) {
      console.log('✅ Ningún POST /api/ disparado tras el clic — bloqueado enteramente en el front.');
    } else {
      console.log(`Llamadas POST /api/ disparadas tras el clic (${nuevasLlamadas.length}):`);
      nuevasLlamadas.forEach(l => console.log(`  → ${l.url} | body=${l.body} | status=${l.status} | resp=${l.respBody}`));
    }
    const textoTrasGuardar = await page.locator('body').innerText().catch(() => '');
    console.log(`¿Modal/mensaje de éxito visible ("aceptar")? ${/^.*aceptar.*$/im.test(textoTrasGuardar) && page.url().includes('/Crear') === false ? 'sí (posiblemente)' : 'no detectado'}`);
    await page.screenshot({ path: `test-results/eg2-${nombre.replace(/\s+/g, '_')}-despues.png`, fullPage: true }).catch(() => {});
    await context.close();
  };

  await correrEscenario('1-todo-vacio', async () => {});

  await correrEscenario('2-nombre-solo-espacios', async (page) => {
    await page.locator('input[name="sNombre"]').fill('   ');
  });

  await correrEscenario('3-correo-invalido-telefono-invalido', async (page) => {
    const SUFIJO = 'S3_' + Math.random().toString(36).slice(2, 8);
    await page.locator('input[name="sNombre"]').fill(`QA_ErrorGuessing_${SUFIJO}`);
    await page.locator('input[name="sPaterno"]').fill('Prueba');
    await page.locator('input[name="sMaterno"]').fill('Invalida');
    await page.locator('input[name="sTelefono1"]').fill('telefono-no-numerico');
    await page.locator('input[name="sCorreo"]').fill('correo-sin-arroba-ni-dominio');
  });

  await correrEscenario('4-solo-nombre-sin-correo', async (page) => {
    await page.locator('input[name="sNombre"]').fill('QA_SoloNombre_' + Date.now());
  });

  await browser.close();
  console.log('\n\n=== FIN ===');
})();
