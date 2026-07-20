import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import path from 'path';

// Escenario combinado app móvil (Appium/pytest) + portal web (Playwright):
// ocupar un cajón real desde la app del operador y confirmar, del lado web,
// que /index.php/disponibilidad refleja el cambio (mismo backend, misma
// zona "Primer Cuadro" que la app móvil usa para sus cajones CJ-1-xxxx).
// Dispara los tests de Appium como subproceso (`pytest ... -s`) y parsea la
// línea `COMBO_CODIGO:.../COMBO_PLACA:...` que imprimen -- ver
// AppEstacionamientosColaboradores/Appium/tests/test_combo_web_app.py.
//
// Requiere que el emulador Android y el servidor Appium (puerto 4723) ya
// estén corriendo (mismo setup que la suite Appium, ver CLAUDE.md de
// AppEstacionamientosColaboradores). Timeout largo (`combinado`, ver
// playwright.config.js) porque cada paso de Appium tarda ~1 min real.

const APPIUM_DIR = path.resolve(__dirname, '..', '..', 'Appium');

function androidEnv() {
  const androidHome = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  const platformTools = path.join(androidHome, 'platform-tools');
  return {
    ...process.env,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
    PATH: `${platformTools};${process.env.PATH}`,
  };
}

function correrPytest(testId: string, extraEnv: Record<string, string> = {}) {
  return execFileSync('python', ['-m', 'pytest', `tests/test_combo_web_app.py::${testId}`, '-v', '-s'], {
    cwd: APPIUM_DIR,
    env: { ...androidEnv(), ...extraEnv },
    encoding: 'utf-8',
    timeout: 150000,
  });
}

async function leerCajonesLibres(page: import('@playwright/test').Page): Promise<number> {
  await page.goto('/index.php/disponibilidad');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  const texto = await page.locator('body').innerText();
  const m = texto.match(/(\d+)\s*\nCAJONES LIBRES \(VÍA PÚBLICA\)/);
  expect(m, 'No se encontró el KPI "Cajones libres" en /disponibilidad').not.toBeNull();
  return Number(m![1]);
}

test('combinado: check-in real desde la app móvil se refleja en /disponibilidad del portal web', async ({ page }) => {
  const antes = await leerCajonesLibres(page);

  let salida: string;
  try {
    salida = correrPytest('test_combo_ocupar_espacio');
  } catch (e: any) {
    throw new Error(`Falló el check-in desde la app móvil (Appium):\n${e.stdout || e.message}`);
  }
  const match = salida.match(/COMBO_CODIGO:(\S+) COMBO_PLACA:(\S+)/);
  expect(match, `No se encontró la línea COMBO_CODIGO en la salida de pytest:\n${salida}`).not.toBeNull();
  const codigo = match![1];
  console.log(`Check-in real confirmado desde Appium: ${codigo} / ${match![2]}`);

  try {
    const despues = await leerCajonesLibres(page);
    expect(despues, 'El conteo de "Cajones libres" en /disponibilidad no bajó en 1 tras el check-in real').toBe(antes - 1);
  } finally {
    // Limpieza: liberar el espacio SIEMPRE, pase lo que pase con el assert de
    // arriba. El diálogo "Liberar espacio" puede tardar en montarse (gotcha
    // ya documentado en HomePage.liberar_espacio_actual) -- reintentar antes
    // de dejar el ambiente de dev con un cajón de prueba ocupado.
    let liberado = false;
    for (let intento = 1; intento <= 3 && !liberado; intento++) {
      try {
        correrPytest('test_combo_liberar_espacio', { COMBO_CODIGO: codigo });
        liberado = true;
      } catch (e: any) {
        console.warn(`Intento ${intento}/3 de liberar ${codigo} falló: ${e.stdout || e.message}`);
      }
    }
    if (!liberado) {
      console.error(`No se pudo liberar ${codigo} tras 3 intentos -- queda ocupado en dev, liberar a mano.`);
    }
  }

  const restaurado = await leerCajonesLibres(page);
  expect(restaurado, 'El conteo de "Cajones libres" no volvió al valor original tras liberar el espacio').toBe(antes);
});
