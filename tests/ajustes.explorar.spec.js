const { test, expect } = require('@playwright/test');
const { setupConsoleMonitor } = require('../e2e/utils.js');

// Exploratorio NIVEL 2: por cada pestaña de Ajustes, abrir cada control
// interactivo (botones "Editar"/"Agregar"/etc.) para mapear los formularios
// que despliegan, SIN confirmar nada riesgoso:
//  - Planes: no clickear Contratar/Cancelar/Pagos (consecuencia de cobro real).
//  - Perfil > Credenciales: no clickear "Actualizar" (cambiaría la contraseña
//    real de la cuenta compartida del equipo).
//  - Perfil > Teléfono de cuenta: no clickear "Verificar" (dispara SMS real).
//  - Facturación: no subir archivos CSD reales ni confirmar cambios fiscales.
// Todo lo demás: abrir, mapear campos, cerrar/cancelar sin guardar.

async function goToTab(page, label) {
  await page.goto('/Dashboard');
  await page.waitForTimeout(2000);
  await page.locator('a:has-text("Ajustes"), button:has-text("Ajustes")').first().click();
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(2000);
  if (label !== 'Perfil') {
    const tabLink = page.locator(`a:text-is("${label}"), button:text-is("${label}"), [role="tab"]:text-is("${label}")`).first();
    await tabLink.click().catch(() => {});
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
}

async function cerrarModalSinGuardar(page) {
  // Intenta cerrar cualquier modal/dialog abierto sin confirmar: Escape,
  // luego botones de cierre/cancelar explícitos.
  const cerrarBtn = page.locator('[role="dialog"] button:has-text("Cancelar"), [role="dialog"] button:has-text("Cerrar"), .modal button:has-text("Cancelar"), button[aria-label="Close"], button[aria-label="Cerrar"]').first();
  if (await cerrarBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cerrarBtn.click().catch(() => {});
    await page.waitForTimeout(500);
    return;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
}

async function dumpFormAbierto(page, contexto) {
  await page.waitForTimeout(1200);
  const inputs = page.locator('input:visible, textarea:visible, select:visible');
  const ic = await inputs.count();
  console.log(`  [${contexto}] campos visibles: ${ic}`);
  for (let i = 0; i < ic; i++) {
    const el = inputs.nth(i);
    const tag = await el.evaluate(e => e.tagName).catch(() => '?');
    const type = (await el.getAttribute('type').catch(() => '')) || '';
    const name = (await el.getAttribute('name').catch(() => '')) || '';
    const placeholder = (await el.getAttribute('placeholder').catch(() => '')) || '';
    console.log(`    <${tag} type="${type}" name="${name}" placeholder="${placeholder}">`);
  }
  const btns = page.locator('[role="dialog"] button:visible, .modal button:visible');
  const bc = await btns.count();
  const vistos = new Set();
  for (let i = 0; i < bc; i++) {
    const t = (await btns.nth(i).textContent().catch(() => '') || '').trim();
    if (t) vistos.add(t);
  }
  console.log(`  [${contexto}] botones del modal: ${[...vistos].join(' | ')}`);
}

test('MAPEAR Perfil (pestaña): Editar, Agregar Especialidad, Agregar credencial, Agregar Hospital', async ({ page }) => {
  test.setTimeout(120000);
  setupConsoleMonitor(page);
  await goToTab(page, 'Perfil');
  await page.screenshot({ path: 'test-results/ajustes2-perfil-00.png', fullPage: true });

  for (const boton of ['Editar', 'Agregar Especialidad', 'Agregar', 'Agregar Hospital de Trabajo']) {
    console.log(`\n### Click en "${boton}" ###`);
    const btn = page.locator(`button:has-text("${boton}"), a:has-text("${boton}")`).first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`  ⚠️ No visible`);
      continue;
    }
    await btn.click().catch(() => {});
    await dumpFormAbierto(page, boton);
    const safe = boton.replace(/[^\w]+/g, '-').toLowerCase();
    await page.screenshot({ path: `test-results/ajustes2-perfil-${safe}.png`, fullPage: true }).catch(() => {});
    await cerrarModalSinGuardar(page);
  }

  console.log('\n### Campo "Teléfono de cuenta" — solo inspección, NO click en Verificar ###');
  const verificarBtn = page.locator('button:has-text("Verificar")').first();
  console.log(`  Botón "Verificar" presente: ${await verificarBtn.count() > 0} (no se clickea — dispara SMS real)`);

  console.log('\n✅ Perfil mapeado.');
});

test('MAPEAR Asistente: Agregar Asistente', async ({ page }) => {
  test.setTimeout(60000);
  setupConsoleMonitor(page);
  await goToTab(page, 'Asistente');
  await page.screenshot({ path: 'test-results/ajustes2-asistente-00.png', fullPage: true });

  const lista = page.locator('table, [class*="list"]');
  console.log(`Lista de asistentes visible: ${await lista.count() > 0}`);

  const btn = page.locator('button:has-text("Agregar Asistente"), a:has-text("Agregar Asistente")').first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await dumpFormAbierto(page, 'Agregar Asistente');
    await page.screenshot({ path: 'test-results/ajustes2-asistente-agregar.png', fullPage: true }).catch(() => {});
    await cerrarModalSinGuardar(page);
  }
  console.log('\n✅ Asistente mapeado.');
});

test('MAPEAR Servicios (catálogo): filtro Sólo activos + Nuevo Tipo', async ({ page }) => {
  test.setTimeout(60000);
  setupConsoleMonitor(page);
  await goToTab(page, 'Servicios');
  await page.screenshot({ path: 'test-results/ajustes2-servicios-00.png', fullPage: true });

  console.log('### Servicios existentes en la lista ###');
  const items = page.locator('tr, [class*="item"], li').filter({ hasText: /./ });
  console.log(`Elementos de lista candidatos: ${await items.count()}`);

  console.log('\n### Toggle "Sólo activos" ###');
  const filtro = page.locator('input[name="filtro"]').first();
  if (await filtro.isVisible({ timeout: 2000 }).catch(() => false)) {
    const antes = await filtro.isChecked().catch(() => null);
    await filtro.click().catch(() => {});
    await page.waitForTimeout(1000);
    const despues = await filtro.isChecked().catch(() => null);
    console.log(`  Checkbox "Sólo activos": ${antes} → ${despues}`);
    await filtro.click().catch(() => {}); // revertir
    await page.waitForTimeout(500);
  }

  console.log('\n### Click en "Nuevo Tipo" ###');
  const nuevoTipo = page.locator('button:has-text("Nuevo Tipo"), a:has-text("Nuevo Tipo")').first();
  if (await nuevoTipo.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nuevoTipo.click().catch(() => {});
    await dumpFormAbierto(page, 'Nuevo Tipo');
    await page.screenshot({ path: 'test-results/ajustes2-servicios-nuevotipo.png', fullPage: true }).catch(() => {});
    await cerrarModalSinGuardar(page);
  }
  console.log('\n✅ Servicios mapeado.');
});

test('MAPEAR Notificaciones: tabs Correo/App móvil + checkboxes', async ({ page }) => {
  test.setTimeout(60000);
  setupConsoleMonitor(page);
  await goToTab(page, 'Notificaciones');
  await page.screenshot({ path: 'test-results/ajustes2-notificaciones-00.png', fullPage: true });

  for (const subtab of ['Correo', 'App movil', 'App móvil']) {
    const t = page.locator(`button:text-is("${subtab}"), a:text-is("${subtab}")`).first();
    if (await t.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`\n### Sub-tab "${subtab}" ###`);
      await t.click().catch(() => {});
      await page.waitForTimeout(1000);
      const checks = page.locator('input[type="checkbox"]:visible');
      console.log(`  Checkboxes visibles: ${await checks.count()}`);
      await page.screenshot({ path: `test-results/ajustes2-notif-${subtab.replace(/\s/g, '')}.png`, fullPage: true }).catch(() => {});
    }
  }

  console.log('\n### Toggle-y-revertir un checkbox de notificación ###');
  const check = page.locator('input[type="checkbox"]:visible').first();
  if (await check.isVisible({ timeout: 2000 }).catch(() => false)) {
    const antes = await check.isChecked().catch(() => null);
    await check.click().catch(() => {});
    await page.waitForTimeout(800);
    const despues = await check.isChecked().catch(() => null);
    console.log(`  Checkbox[0]: ${antes} → ${despues}`);
    await check.click().catch(() => {}); // revertir
    await page.waitForTimeout(500);
  }
  console.log('\n✅ Notificaciones mapeado.');
});

test('MAPEAR Finanzas: Métodos de pago + tab Bancos', async ({ page }) => {
  test.setTimeout(60000);
  setupConsoleMonitor(page);
  await goToTab(page, 'Finanzas');
  await page.screenshot({ path: 'test-results/ajustes2-finanzas-00.png', fullPage: true });

  const checks = page.locator('input[type="checkbox"]:visible');
  console.log(`Checkboxes de métodos de pago: ${await checks.count()}`);

  const bancos = page.locator('button:text-is("Bancos"), a:text-is("Bancos")').first();
  if (await bancos.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bancos.click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/ajustes2-finanzas-bancos.png', fullPage: true }).catch(() => {});
    console.log('### Tab Bancos ###');
    const titles = page.locator('h1,h2,h3,h4,label');
    const tc = await titles.count();
    for (let i = 0; i < Math.min(tc, 15); i++) {
      const t = (await titles.nth(i).textContent().catch(() => '') || '').trim();
      if (t) console.log(`  "${t}"`);
    }
  }
  console.log('\n✅ Finanzas mapeado.');
});

test('MAPEAR Planes: SOLO LECTURA (no clickear Contratar/Cancelar/Pagos)', async ({ page }) => {
  test.setTimeout(60000);
  setupConsoleMonitor(page);
  await goToTab(page, 'Planes');
  await page.screenshot({ path: 'test-results/ajustes2-planes-00.png', fullPage: true });

  console.log('### Planes visibles y cuál está activo ###');
  const planCards = page.locator('[class*="card"], [class*="plan"]');
  console.log(`Cards candidatas: ${await planCards.count()}`);
  const actual = page.locator('text=/Plan actual/i').first();
  console.log(`"Plan actual" visible: ${await actual.count() > 0}`);

  for (const b of ['Pagos', 'Cancelar', 'Contratar']) {
    const btn = page.locator(`button:has-text("${b}")`).first();
    console.log(`Botón "${b}" presente: ${await btn.count() > 0} (NO se clickea)`);
  }
  console.log('\n✅ Planes mapeado (solo lectura).');
});

test('MAPEAR Recetas (plantillas): Nueva plantilla + ver detalle', async ({ page }) => {
  test.setTimeout(60000);
  setupConsoleMonitor(page);
  await goToTab(page, 'Recetas');
  await page.screenshot({ path: 'test-results/ajustes2-recetas-00.png', fullPage: true });

  console.log('### Plantillas existentes ###');
  const plantillas = page.locator('text=/Receta estándar genérica|Receta Medica Pruebas/i');
  console.log(`Plantillas visibles: ${await plantillas.count()}`);
  const primera = plantillas.first();
  if (await primera.isVisible({ timeout: 2000 }).catch(() => false)) {
    await primera.click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/ajustes2-recetas-detalle.png', fullPage: true }).catch(() => {});
    console.log('### Detalle de plantilla abierto ###');
    await dumpFormAbierto(page, 'detalle plantilla');
    await cerrarModalSinGuardar(page);
  }

  const nueva = page.locator('button:has-text("Nueva plantilla"), a:has-text("Nueva plantilla")').first();
  if (await nueva.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nueva.click().catch(() => {});
    await dumpFormAbierto(page, 'Nueva plantilla');
    await page.screenshot({ path: 'test-results/ajustes2-recetas-nueva.png', fullPage: true }).catch(() => {});
    await cerrarModalSinGuardar(page);
  }
  console.log('\n✅ Recetas mapeado.');
});

test('MAPEAR Facturación (fiscal): SOLO LECTURA de campos, botón Editar sin submitir', async ({ page }) => {
  test.setTimeout(60000);
  setupConsoleMonitor(page);
  await goToTab(page, 'Facturación');
  await page.screenshot({ path: 'test-results/ajustes2-facturacion-00.png', fullPage: true });

  const editar = page.locator('button:has-text("Editar")').first();
  if (await editar.isVisible({ timeout: 2000 }).catch(() => false)) {
    await editar.click().catch(() => {});
    await dumpFormAbierto(page, 'Editar perfil fiscal');
    await page.screenshot({ path: 'test-results/ajustes2-facturacion-editar.png', fullPage: true }).catch(() => {});
    await cerrarModalSinGuardar(page);
  }
  console.log('  (CSD/archivos: NO se sube nada real, solo inspección de los inputs type=file)');
  console.log('\n✅ Facturación mapeado (solo lectura).');
});
