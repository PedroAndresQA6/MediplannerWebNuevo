import { test, expect } from '@playwright/test';

// Recon (2026-07-17): tras login, el Panel de control muestra 6 tarjetas KPI
// y un sidebar con 5 secciones (PRINCIPAL, VÍA PÚBLICA, ESTACIONAMIENTOS
// PÚBLICOS, SUPERVISIÓN, ADMINISTRACIÓN). El propio dashboard aclara que es
// "andamiaje base" — los módulos están enrutados pero no necesariamente
// implementados a fondo, así que este smoke solo confirma que carga y
// muestra los indicadores esperados, sin asumir profundidad de cada sección.
const KPIS = [
  'CAJONES ACTIVOS',
  'OCUPADOS AHORA',
  'FUERA DE TIEMPO',
  'USOS ACTIVOS',
  'ESTACIONAMIENTOS PÚBLICOS',
  'INFRACCIONES HOY',
];

const SECCIONES_MENU = [
  'Dashboard',
  'Monitoreo en tiempo real',
  'Consultas de placas',
  'Zonas',
  'Tramos',
  'Cajones (pintar)',
  'Perfiles horarios',
  'Días festivos',
  'Estacionamientos',
  'Cámaras',
  'Atributos (catálogo)',
  'Oferta pública (mapa)',
  'Infracciones',
  'Reportes',
  'Usuarios',
  'Roles y permisos',
  'Configuración',
  'Apps y llaves API',
  'API (documentación)',
];

test('dashboard: carga tras login y muestra las 6 tarjetas KPI', async ({ page }) => {
  await page.goto('/index.php/dashboard');
  await expect(page).toHaveURL(/dashboard/i);
  await expect(page.getByText('Panel de control').first()).toBeVisible({ timeout: 15000 });

  for (const kpi of KPIS) {
    await expect(page.getByText(kpi).first()).toBeVisible();
  }
});

test('dashboard: el sidebar expone las 19 secciones del menú', async ({ page }) => {
  await page.goto('/index.php/dashboard');
  await expect(page).toHaveURL(/dashboard/i);

  for (const seccion of SECCIONES_MENU) {
    await expect(page.locator('a', { hasText: seccion }).first()).toBeVisible();
  }
});
