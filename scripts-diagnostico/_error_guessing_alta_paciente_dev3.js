const { chromium } = require('@playwright/test');
require('dotenv').config({ path: '.env' });

// Escenario aislado: nombre y correo VÁLIDOS, teléfono con letras/garbage —
// sTelefono1 no aparece marcado "required" en el dump del formulario, así que
// puede que no se valide en absoluto. Si el backend acepta la creación con un
// teléfono no numérico, es un hallazgo real de "valor incorrecto aceptado".

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--start-maximized'],
  });
  const base = (process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/').replace(/\/$/, '');
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
      if (entry) { entry.status = r.status(); entry.respBody = (await r.text().catch(() => '')).substring(0, 300); }
    }
  });

  const SUFIJO = 'TEL_' + Math.random().toString(36).slice(2, 8);
  const NOMBRE = `QA_TelInvalido_${SUFIJO}`;

  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /agregar paciente/i }).first().click();
  await page.waitForTimeout(1500);
  await page.getByText(/crear perfil de paciente nuevo/i).first().click();
  await page.waitForTimeout(1500);

  await page.locator('input[name="sNombre"]').fill(NOMBRE);
  await page.locator('input[name="sPaterno"]').fill('Prueba');
  await page.locator('input[name="sMaterno"]').fill('Telefono');
  await page.locator('input[name="sTelefono1"]').fill('abcXYZ!!');
  await page.locator('input[name="sCorreo"]').fill(`qa.telinvalido.${SUFIJO}@correofalso.com`);
  await page.screenshot({ path: 'test-results/eg3-tel-invalido-antes.png', fullPage: true }).catch(() => {});

  const valorTelefonoReal = await page.locator('input[name="sTelefono1"]').inputValue().catch(() => '');
  console.log(`Valor real en el campo Teléfono tras escribir "abcXYZ!!": "${valorTelefonoReal}"`);

  const marca = llamadas.length;
  await page.getByRole('button', { name: /guardar cambios/i }).click();
  await page.waitForTimeout(3500);

  console.log(`URL tras el clic: ${page.url()}`);
  const nuevas = llamadas.slice(marca);
  if (nuevas.length === 0) {
    console.log('Ningún POST /api/ disparado tras el clic.');
  } else {
    nuevas.forEach(l => console.log(`  → ${l.url} | body=${l.body} | status=${l.status} | resp=${l.respBody}`));
  }
  const texto = await page.locator('body').innerText().catch(() => '');
  console.log(`¿Modal de éxito "Aceptar" visible? ${/aceptar/i.test(texto)}`);
  await page.screenshot({ path: 'test-results/eg3-tel-invalido-despues.png', fullPage: true }).catch(() => {});

  // Si se creó, verificar por API qué quedó guardado como teléfono.
  const aceptarBtn = page.getByRole('button', { name: /^aceptar$/i });
  if (await aceptarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('⚠️ El paciente SÍ se creó pese al teléfono con letras — verificando qué quedó guardado...');
    await aceptarBtn.click();
    await page.waitForTimeout(2000);
    await page.goto('/Pacientes');
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    const buscarInput = page.locator('input[placeholder*="Buscar" i]').first();
    if (await buscarInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await buscarInput.fill(NOMBRE);
      await page.waitForTimeout(2000);
    }
    const fila = page.locator(`text=/${NOMBRE}/i`).first();
    if (await fila.isVisible({ timeout: 8000 }).catch(() => false)) {
      await fila.click();
      await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const textoPerfilPaciente = await page.locator('body').innerText().catch(() => '');
      const contieneTelefonoOriginal = textoPerfilPaciente.includes('abcXYZ');
      console.log(`¿El perfil del paciente muestra el teléfono inválido tal cual ("abcXYZ!!")? ${contieneTelefonoOriginal}`);
      await page.screenshot({ path: 'test-results/eg3-tel-invalido-perfil-creado.png', fullPage: true }).catch(() => {});
    }
  }

  await browser.close();
})();
