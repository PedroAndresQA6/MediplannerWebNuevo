import { test, expect } from '@playwright/test';

// Adaptación de 6.6 (filtros por estatus), 6.11 (espacio sin coordenadas),
// 7.6 (recarga de lista) y 7.7 (tap en fila → acciones) al catálogo de
// Estacionamientos públicos (/index.php/estacionamientos). Recon
// (2026-07-17): filtro GET real con `select[name=estado]` (Todos/Activos/
// Inactivos) y checkbox `sin_coord` -- filas muestran badge "Ubicado" o
// "Falta" según tengan coordenada geográfica capturada o no.

test.beforeEach(async ({ page }) => {
  await page.goto('/index.php/estacionamientos');
  await page.waitForLoadState('domcontentloaded');
});

test('6.6: filtro por Estado "Activos" solo muestra filas con badge Activo', async ({ page }) => {
  await page.locator('select[name="estado"]').selectOption('activo');
  await page.locator('button[type="submit"]', { hasText: 'Filtrar' }).click();
  await page.waitForLoadState('domcontentloaded');

  const filas = page.locator('tbody tr');
  const total = await filas.count();
  expect(total, 'No hay filas para verificar el filtro').toBeGreaterThan(0);
  for (let i = 0; i < total; i++) {
    await expect(filas.nth(i).getByText('Inactivo', { exact: true })).toHaveCount(0);
  }
});

test('6.11: filtro "Sin coordenada" solo muestra estacionamientos con badge "Falta"', async ({ page }) => {
  await page.locator('input[name="sin_coord"]').check();
  await page.locator('button[type="submit"]', { hasText: 'Filtrar' }).click();
  await page.waitForLoadState('domcontentloaded');

  const filas = page.locator('tbody tr');
  const total = await filas.count();
  test.skip(total === 0, 'No hay estacionamientos sin coordenada en este momento');
  for (let i = 0; i < total; i++) {
    await expect(filas.nth(i).getByText('Ubicado')).toHaveCount(0);
    await expect(filas.nth(i).getByText('Falta')).toBeVisible();
  }
});

test('7.6: "Limpiar" restaura el listado sin filtros', async ({ page }) => {
  await page.locator('select[name="estado"]').selectOption('activo');
  await page.locator('button[type="submit"]', { hasText: 'Filtrar' }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/estado=activo/);

  await page.locator('a', { hasText: 'Limpiar' }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).not.toHaveURL(/estado=activo/);
  await expect(page.locator('select[name="estado"]')).toHaveValue('');
});

test('7.7: click en "Ver" de una fila abre el detalle del estacionamiento', async ({ page }) => {
  const primeraFila = page.locator('tbody tr').first();
  await expect(primeraFila).toBeVisible();
  const codigo = await primeraFila.locator('td').first().innerText();

  await primeraFila.locator('a', { hasText: 'Ver' }).click();
  await page.waitForLoadState('domcontentloaded');

  await expect(page).toHaveURL(/estacionamientos\/\d+$/);
  await expect(page.getByText(codigo.trim())).toBeVisible({ timeout: 10000 });
});
