import pytest
import os
import sys
import time
import re
import json
from appium import webdriver
from appium.options.android import UiAutomator2Options

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

APP_PACKAGE = "mx.mediplanner.app"

# Señales INEQUÍVOCAS de crash/ANR en logcat. Solo estas tumban el test; el resto
# del ruido de logcat (líneas 'E/' sueltas de React Native) va al reporte pero NO
# hace fallar (equivalente al 'log-and-continue' del monitor de consola en web).
# 'has died'/'Force finishing activity' se acotan a mx.mediplanner.app: sin eso,
# cualquier proceso ajeno que muera en background (p.ej. com.google.android.
# documentsui) se marcaba como crash de la app bajo prueba (falso positivo
# observado en test_perfil_datos_personales, que en realidad paso).
CRASH_PATTERNS = re.compile(
    r"FATAL EXCEPTION|ANR in |E/AndroidRuntime|"
    r"mx\.mediplanner\.app.*(has died|Force finishing activity|crash|SIGSEGV|SIGABRT)",
    re.IGNORECASE,
)

# Errores relevantes (no fatales) que se recolectan al reporte para dar visibilidad
# a fallos de red/JS que la UI podría ocultar (análogo a los 4xx/5xx del web).
NONFATAL_PATTERNS = re.compile(
    r"\bE/|ReactNativeJS.*(Error|Warning)|OkHttp.*(4\d\d|5\d\d)|"
    r"Retrofit|Unhandled|Exception",
    re.IGNORECASE,
)


@pytest.fixture(scope="session")
def credenciales():
    return {
        "email": os.environ.get("MEDIPLANNER_EMAIL", "luis.morenoramos@icloud.com"),
        "password": os.environ.get("MEDIPLANNER_PASSWORD", "@RyM2025")
    }


@pytest.fixture(scope="session")
def credenciales_alternativas():
    return {
        "email": os.environ.get("MEDIPLANNER_EMAIL", "paciente@rym-solutions.com"),
        "password": os.environ.get("MEDIPLANNER_PASSWORD", "@RyM2025")
    }


@pytest.fixture(scope="session")
def appium_server_url():
    host = os.environ.get("APPIUM_HOST", "localhost")
    port = os.environ.get("APPIUM_PORT", "4723")
    return f"http://{host}:{port}"


def get_android_device():
    try:
        import subprocess
        result = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=10)
        lines = result.stdout.strip().split('\n')
        devices = [line.split()[0] for line in lines[1:] if line.strip() and 'device' in line]
        for device in devices:
            if '5554' in device:
                return device
        return devices[0] if devices else "emulator-5554"
    except:
        return "emulator-5554"


@pytest.fixture(scope="session")
def device_name():
    return get_android_device()


def get_driver_options(device_name):
    options = UiAutomator2Options()
    options.platform_name = "Android"
    options.automation_name = "UiAutomator2"
    options.device_name = device_name
    options.app_package = "mx.mediplanner.app"
    options.app_activity = ".MainActivity"
    options.no_reset = True
    options.full_reset = False
    options.set_capability("autoGrantPermissions", True)
    options.set_capability("enforceXPath1", True)
    options.set_capability("skipUnlock", True)
    options.set_capability("newCommandTimeout", 300)
    return options


@pytest.fixture(scope="function")
def driver(appium_server_url, device_name):
    options = get_driver_options(device_name)
    driver = webdriver.Remote(command_executor=appium_server_url, options=options)
    # Implicit wait bajo (era 10): con 10s, cada find_elements que no encuentra nada
    # esperaba 10s completos -> un no-op podía tardar minutos. Las esperas explícitas
    # de base_page (WebDriverWait) son las que marcan el ritmo real. Se conserva un
    # colchón mínimo para los tests aún no migrados a esperas explícitas.
    driver.implicitly_wait(3)
    yield driver
    try:
        driver.quit()
    except:
        pass


def _leer_logcat(driver):
    """Lee el buffer de logcat acumulado en la sesión. Devuelve lista de mensajes."""
    try:
        return [e.get("message", "") for e in driver.get_log("logcat")]
    except Exception:
        return []


@pytest.fixture(scope="function", autouse=True)
def crash_monitor(request, driver):
    """Monitor global de crash/ANR/errores nativos (equivalente Appium del
    setupConsoleMonitor de Playwright). Antes del test drena el logcat; al terminar
    lo revisa + verifica que la app siga en foreground.

    - Crash/ANR/app-cerrada  -> HARD-FAIL (tumba el test aunque la UI 'pase').
    - Errores E/ no fatales    -> se recolectan al reporte JSON, NO tumban.
    """
    # Drenar el logcat previo para que solo veamos lo de ESTE test.
    _leer_logcat(driver)
    inicio = time.time()

    yield

    duracion = round(time.time() - inicio, 1)
    lineas = _leer_logcat(driver)
    crash = [ln for ln in lineas if CRASH_PATTERNS.search(ln)]
    no_fatales = [ln for ln in lineas if not CRASH_PATTERNS.search(ln) and NONFATAL_PATTERNS.search(ln)]

    # Estado de la app: 4 = corriendo en foreground. <4 = background/cerrada/crash.
    try:
        estado = driver.query_app_state(APP_PACKAGE)
    except Exception:
        estado = None

    # Reporte por test (baseline comparable, análogo a dumpMetrics).
    reporte = {
        "test": request.node.name,
        "duracion_seg": duracion,
        "app_state": estado,
        "crash_count": len(crash),
        "crash_lineas": crash[:30],
        "errores_no_fatales_count": len(no_fatales),
        "errores_no_fatales": no_fatales[:30],
    }
    try:
        mon_dir = os.path.join(os.path.dirname(__file__), "reports", "monitor")
        os.makedirs(mon_dir, exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S")
        with open(os.path.join(mon_dir, f"{request.node.name}_{stamp}.json"), "w", encoding="utf-8") as f:
            json.dump(reporte, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    if no_fatales:
        print(f"\n[MONITOR][WARN] {len(no_fatales)} error(es) no fatal(es) en logcat (ver reporte JSON)")

    # HARD-FAIL ante señales inequívocas de crash.
    problemas = []
    if crash:
        problemas.append(f"{len(crash)} crash/ANR en logcat")
    if estado is not None and estado < 4:
        problemas.append(f"la app no quedó en foreground (app_state={estado})")
    if problemas:
        detalle = "\n".join(crash[:15])
        pytest.fail(
            f"[MONITOR][CRASH] {request.node.name}: " + "; ".join(problemas) +
            (f"\n{detalle}" if detalle else ""),
            pytrace=False,
        )


@pytest.fixture(scope="function")
def login_page(driver):
    from pages.login_page import LoginPage
    return LoginPage(driver)


@pytest.fixture(scope="function")
def home_page(driver):
    from pages.home_page import HomePage
    return HomePage(driver)


@pytest.fixture(scope="function")
def doctors_page(driver):
    from pages.doctors_page import DoctorsPage
    return DoctorsPage(driver)


@pytest.fixture(scope="function")
def consultas_page(driver):
    from pages.consultas_page import ConsultasPage
    return ConsultasPage(driver)


@pytest.fixture(scope="function")
def bitacora_page(driver):
    from pages.bitacora_page import BitacoraPage
    return BitacoraPage(driver)