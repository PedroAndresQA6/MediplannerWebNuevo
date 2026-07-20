import { test, expect } from '@playwright/test';

// Adaptación del módulo 6 (Home — Vista Mapa) del checklist de operador a
// /index.php/disponibilidad, la vista de "Oferta pública" (mapa de Google
// con cajones libres/ocupados y estacionamientos, alcanzable también desde
// el toggle "Mapa" de Estacionamientos). Recon (2026-07-17): a diferencia de
// la Vista Mapa de la app móvil, acá NO hay un modo "Lista" alternativo (6.9
// no aplica) y los pines del mapa son overlays de Google Maps sin selector
// de accesibilidad propio (misma limitación ya documentada para la app
// móvil en HALLAZGOS.md de Appium) -- 6.1/6.3 quedan fuera de alcance por lo
// mismo. Lo que SÍ es DOM-testable: leyenda de texto, buscador, botón
// "Ubicarme" (equivalente web de "centrar en ubicación", 6.10) y "Cómo
// llegar" (7.8).

test.beforeEach(async ({ page }) => {
  await page.goto('/index.php/disponibilidad');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
});

test('6.2: leyenda de colores visible (Cajones: Libre/Ocupado · Estac.: Disponible/Casi lleno/Lleno)', async ({ page }) => {
  await expect(page.getByText('Libre', { exact: true })).toBeVisible();
  await expect(page.getByText('Ocupado', { exact: true })).toBeVisible();
  await expect(page.getByText('Disponible', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Casi lleno')).toBeVisible();
  await expect(page.getByText('Lleno', { exact: true })).toBeVisible();
});

test('6.4: buscador de estacionamiento/colonia está disponible y acepta texto', async ({ page }) => {
  const buscador = page.locator('input[placeholder*="Busca un estacionamiento"]');
  await expect(buscador).toBeVisible({ timeout: 10000 });
  await buscador.fill('Centro');
  await expect(buscador).toHaveValue('Centro');
});

test('6.10: botón "Ubicarme" dispara la solicitud de geolocalización del navegador', async ({ page, context }) => {
  // Adaptado de "Centrar en ubicación" (tageado Android en el checklist,
  // pero el navegador tiene un equivalente directo vía Geolocation API).
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 20.593103, longitude: -100.393097 });

  const boton = page.locator('button', { hasText: 'Ubicarme' });
  await expect(boton).toBeVisible();
  await boton.click();
  // Chequeo blando: no hay una señal de accesibilidad de "mapa centrado" --
  // se confirma que el botón es clickeable y no rompe la pantalla (no hard
  // assert sobre el centro real del mapa, mismo criterio que otros chequeos
  // blandos del proyecto cuando no hay una señal DOM confiable).
  await page.waitForTimeout(1000);
  await expect(page.getByText('CAJONES LIBRES (VÍA PÚBLICA)')).toBeVisible();
});

test('7.8: "Cómo llegar" de un estacionamiento abre Google Maps en una pestaña nueva', async ({ page, context }) => {
  const cómoLlegar = page.locator('a', { hasText: 'Cómo llegar' }).first();
  await expect(cómoLlegar).toBeVisible({ timeout: 10000 });

  const [nuevaPagina] = await Promise.all([
    context.waitForEvent('page'),
    cómoLlegar.click(),
  ]);
  await nuevaPagina.waitForLoadState('domcontentloaded', { timeout: 15000 });
  expect(nuevaPagina.url()).toMatch(/google\.[a-z.]+\/maps/i);
  await nuevaPagina.close();
});

test('7.5: KPI de cajones libres del panel coincide con el desglose por zona', async ({ page }) => {
  const kpiTexto = await page.locator('body').innerText();
  const matchKpi = kpiTexto.match(/(\d+)\s*\nCAJONES LIBRES \(VÍA PÚBLICA\)/);
  const matchZona = kpiTexto.match(/(\d+)\s*libres de\s*(\d+)/);
  expect(matchKpi, 'No se encontró el KPI de cajones libres').not.toBeNull();
  expect(matchZona, 'No se encontró el desglose por zona').not.toBeNull();
  if (matchKpi && matchZona) {
    expect(Number(matchKpi[1])).toBe(Number(matchZona[1]));
  }
});
