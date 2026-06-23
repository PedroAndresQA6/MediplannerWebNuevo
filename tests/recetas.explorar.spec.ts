import { test, Page } from '@playwright/test';
const { setupConsoleMonitor } = require('../e2e/utils.js');

// ─────────────────────────────────────────────────────────────────────────────
// MAPEADOR del módulo "Recetas" del paciente (tab del perfil).
// No hay test de Recetas todavía. Este spec NO asserta: navega al tab Recetas,
// vuelca su estructura (lista de recetas, botones de acción, estado vacío, API)
// y toma screenshots para diseñar el test real.
// ─────────────────────────────────────────────────────────────────────────────

const PATIENT = 'Agustin Tapia';

function log(...a: any[]) { console.log(...a); }
function section(t: string) { console.log(`\n${'═'.repeat(70)}\n🗺️  ${t}\n${'═'.repeat(70)}`); }

async function goToPaciente(page: Page): Promise<void> {
  await page.goto('/Pacientes');
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('a.font-semibold.text-sm.text-gray-900', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const pageSize = page.locator('select').first();
  if (await pageSize.isVisible({ timeout: 3000 }).catch(() => false)) {
    await pageSize.selectOption({ label: 'Todos' }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.locator('a.font-semibold.text-sm.text-gray-900', { hasText: PATIENT }).first().click();
  await page.waitForTimeout(3000);
}

test('MAPEAR módulo Recetas del paciente', async ({ page }) => {
  test.setTimeout(180000);
  const monitor = setupConsoleMonitor(page);
  const apiRecetas: string[] = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (/\/api\/(recipes|prescriptions|recetas|treatments|consultations)\//i.test(u)) {
      let body = ''; try { body = (await res.text()).substring(0, 90); } catch {}
      apiRecetas.push(`${res.request().method()} ${res.status()} ${u.split('/api/')[1]} → ${body}`);
    }
  });

  section(`Ir al perfil de ${PATIENT}`);
  await goToPaciente(page);

  section('Click en tab "Recetas"');
  const tab = page.locator('button:has-text("Recetas"), a:has-text("Recetas")').first();
  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab.click().catch(() => {});
    await page.waitForTimeout(3000);
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => null);
    log('  ✅ Tab Recetas clickeado');
  } else {
    log('  ⚠️ No se encontró el tab "Recetas"');
  }
  await page.screenshot({ path: 'test-results/recetas-01-tab.png', fullPage: true });

  section('Estructura de la vista de Recetas');
  const estructura = await page.evaluate(() => {
    const txt = (el: Element | null) => (el?.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 60);
    // Headings/títulos visibles
    const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,.card-title'))
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(e => txt(e)).filter(Boolean).slice(0, 15);
    // Botones visibles
    const botones = Array.from(document.querySelectorAll('button, a[role="button"]'))
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map(b => { const svg = b.querySelector('svg'); return { txt: txt(b), icon: svg?.getAttribute('data-icon') || '', cls: (b.getAttribute('class') || '').substring(0, 35) }; })
      .filter(b => b.txt || b.icon).slice(0, 25);
    // Filas/tarjetas (posibles recetas listadas)
    const filas = document.querySelectorAll('table tbody tr, .card, [class*="receta"], [class*="prescription"]').length;
    // Texto de estado vacío
    const vacio = Array.from(document.querySelectorAll('p,span,div'))
      .map(e => txt(e)).filter(t => /no hay|sin recetas|vac[íi]o|a[úu]n no|0 recetas/i.test(t)).slice(0, 5);
    return { heads, botones, filasOTarjetas: filas, posibleEstadoVacio: vacio };
  });
  log(JSON.stringify(estructura, null, 2));

  section('API observada (recipes/prescriptions/treatments/consultations)');
  apiRecetas.forEach((c, i) => log(`  [${i + 1}] ${c}`));

  const result = monitor.printSummary();
  log(`  Errores consola/JS: ${result.errors.length}`);
});
