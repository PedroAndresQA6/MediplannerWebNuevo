import pytest
import os
import sys
import time
import re
import json
import subprocess
from appium import webdriver

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import APP_PACKAGE, AVD_NAME, TIMEZONE, get_driver_options

# Señales inequívocas de crash/ANR en logcat — equivalente Android del monitor
# de consola/red (setupConsoleMonitor) del lado Playwright de este repo. Solo
# esto tumba el test; el resto del ruido de logcat se recolecta al reporte pero
# NO hace fallar (mismo criterio "log-and-continue" que scanResidualIndicators).
#
# OJO: "has died" / "Force finishing activity" son EXTREMADAMENTE genéricos —
# Android los loguea para CUALQUIER proceso que el sistema mata por presión de
# memoria (limpieza rutinaria de caché), no solo crashes reales. Confirmado
# como falso positivo real: `com.android.providers.calendar` y
# `com.google.android.calendar` "murieron" (cch+65/cch+55 = cache eviction
# normal) durante un test que en realidad PASÓ, y el hard-fail disparó igual.
# Por eso esos dos patrones exigen que APP_PACKAGE aparezca en la MISMA línea
# (así loguea ActivityManager cuando el proceso que muere es el nuestro,
# confirmado con el crash real que sí capturamos en recon). "FATAL EXCEPTION"/
# "ANR in "/"E/AndroidRuntime" quedan sin acotar: son señales bastante más
# específicas de nuestra propia app en la práctica, y acotarlas exigiría
# correlacionar por PID entre líneas separadas del stack trace.
CRASH_PATTERNS = re.compile(
    rf"FATAL EXCEPTION|ANR in |E/AndroidRuntime|"
    rf"{re.escape(APP_PACKAGE)}.*(has died|crash|SIGSEGV|SIGABRT)|"
    rf"(has died|Force finishing activity).*{re.escape(APP_PACKAGE)}",
    re.IGNORECASE,
)

# Errores no fatales (red/Dart/Flutter) que se recolectan al reporte para dar
# visibilidad, análogo a los 4xx/5xx que captura setupConsoleMonitor en la web.
# App Flutter (no React Native) -> patrones ajustados a ese runtime.
NONFATAL_PATTERNS = re.compile(
    r"\bE/|flutter.*(Error|Exception)|PlatformException|DartError|"
    r"OkHttp.*(4\d\d|5\d\d)|Retrofit|Unhandled exception",
    re.IGNORECASE,
)

# Ruido de INFRAESTRUCTURA (el propio proceso de Appium logueando sus
# responses/reintentos internos vía logcat, o servicios del sistema operativo
# ajenos a la app) que NO debe contarse como error de la app bajo prueba.
# Confirmado en recon (2026-07-07): sin este filtro, cada `NoSuchElementError`
# interno de un `esperar_elemento_*` con reintentos infla el conteo con
# decenas de falsos "errores no fatales" (el JSON de AppiumResponse contiene
# la palabra "Exception" en el nombre de la clase Java/Python, no es un error
# real de la app).
INFRA_NOISE_PATTERNS = re.compile(
    r"\bI appium\s*:|AppiumResponse|NullBinder|TransactionTooLargeException",
    re.IGNORECASE,
)

# Clasificación estructurada de fallos (equivalente Appium de las categorías
# Assertion/Async Assertion/Action/Timeout/Infra que usa Playwright). Permite
# preguntar con datos "¿qué está fallando más?" en vez de revisar logs a mano
# cada vez — ver reports/generar_resumen_estabilidad.py. Orden = prioridad:
# la primera categoría que matchea gana.
FALLO_PATTERNS = [
    ("Backend/API", re.compile(
        r"reloj desfasado|petici[oó]n expirada|no se pudo seleccionar|\bHTTP ?[45]\d\d\b",
        re.IGNORECASE,
    )),
    ("Selector", re.compile(r"NoSuchElement|no such element|could not be located", re.IGNORECASE)),
    ("Timeout", re.compile(r"TimeoutException|timed? ?out", re.IGNORECASE)),
    ("Infra/Setup", re.compile(
        r"WebDriverException|ConnectionError|createSession|Remote end closed|"
        r"Failed to establish a new connection",
        re.IGNORECASE,
    )),
    ("Assertion", re.compile(r"AssertionError", re.IGNORECASE)),
]


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Guarda el resultado de cada fase (setup/call/teardown) en el item para
    que `crash_monitor` pueda clasificar el fallo — patrón estándar de pytest
    para inspeccionar en un fixture si el test que se está por cerrar falló y
    por qué (no hay otra forma de acceder al resultado desde un fixture)."""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)


def _clasificar_fallo(request, hubo_crash):
    """Devuelve una categoría de fallo legible a partir del resultado real de
    pytest para este test (no solo del logcat). `hubo_crash` manda siempre
    (es la señal más inequívoca); si no hubo crash, se busca la categoría por
    patrón en el traceback formateado del test."""
    if hubo_crash:
        return "Crash/ANR"
    rep_setup = getattr(request.node, "rep_setup", None)
    if rep_setup is not None and rep_setup.failed:
        return "Infra/Setup"
    rep_call = getattr(request.node, "rep_call", None)
    if rep_call is None:
        return "Sin_dato"
    if rep_call.passed:
        return "OK"
    texto = str(rep_call.longrepr)
    for categoria, patron in FALLO_PATTERNS:
        if patron.search(texto):
            return categoria
    return "Sin_clasificar"


@pytest.fixture(scope="session")
def appium_server_url():
    host = os.environ.get("APPIUM_HOST", "localhost")
    port = os.environ.get("APPIUM_PORT", "4723")
    return f"http://{host}:{port}"


@pytest.fixture(scope="session")
def credenciales():
    """Credenciales de prueba (sirven tanto para el portal web como para la
    app, confirmado por Pedro). Mismo patrón que `credenciales` en
    MediplannerAppiumAutomation/Appium/conftest.py: default hardcodeado +
    override por variable de entorno para no depender de un .env local."""
    return {
        "email": os.environ.get("ESTACIONAMIENTOS_EMAIL", "fernando@rym-solutions.com"),
        "password": os.environ.get("ESTACIONAMIENTOS_PASSWORD", "RYM_solutions"),
    }


def get_android_device():
    try:
        result = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=10)
        lines = result.stdout.strip().split("\n")
        devices = [line.split()[0] for line in lines[1:] if line.strip() and "device" in line]
        return devices[0] if devices else "emulator-5554"
    except Exception:
        return "emulator-5554"


def _es_tablet(serial):
    """Chequeo NO bloqueante: primero mira ro.build.characteristics; algunas
    imágenes de AVD tablet (confirmado con el Pixel Tablet usado en este
    proyecto: 2560x1600 @ 320dpi) reportan 'emulator' ahí en vez de 'tablet',
    así que se usa como fallback el ancho mínimo en dp (smallest width) —
    el mismo criterio que usa Android para el qualifier `sw600dp`: >=600dp
    se considera tablet. No tumba la corrida en ningún caso, solo avisa."""
    try:
        result = subprocess.run(
            ["adb", "-s", serial, "shell", "getprop", "ro.build.characteristics"],
            capture_output=True, text=True, timeout=10,
        )
        if "tablet" in result.stdout.lower():
            return True

        size = subprocess.run(
            ["adb", "-s", serial, "shell", "wm", "size"],
            capture_output=True, text=True, timeout=10,
        ).stdout
        density = subprocess.run(
            ["adb", "-s", serial, "shell", "wm", "density"],
            capture_output=True, text=True, timeout=10,
        ).stdout
        m_size = re.search(r"(\d+)x(\d+)", size)
        m_density = re.search(r"(\d+)", density)
        if m_size and m_density:
            w, h = int(m_size.group(1)), int(m_size.group(2))
            dpi = int(m_density.group(1))
            smallest_width_dp = min(w, h) / (dpi / 160)
            return smallest_width_dp >= 600
        return None
    except Exception:
        return None


def _forzar_landscape(serial):
    """Bloquea la orientación en landscape A NIVEL DE SISTEMA (no vía capability
    de Appium): desactiva accelerometer_rotation y fija user_rotation=0.
    Necesario porque en el AVD tablet usado (2560x1600) `ROTATION_0` es
    landscape (orientación natural del dispositivo, confirmado con `dumpsys
    window | grep mRotation`) — y dejar el auto-rotate activo hace que la app
    pueda quedar en portrait tras un cambio de foreground/background, lo que
    rompe layouts pensados para tablet. No bloqueante: si adb falla, solo
    advierte, no tumba la corrida (la sesión de Appium igual intenta forzar
    landscape via `config.py` como segunda capa)."""
    try:
        subprocess.run(
            ["adb", "-s", serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"],
            capture_output=True, timeout=10,
        )
        subprocess.run(
            ["adb", "-s", serial, "shell", "settings", "put", "system", "user_rotation", "0"],
            capture_output=True, timeout=10,
        )
    except Exception as e:
        print(f"\n[SETUP][WARN] No se pudo fijar landscape a nivel de sistema: {e}\n")


def _sincronizar_reloj(serial, max_espera=15):
    """El AVD puede arrancar con el reloj desfasado (típico al resumir un
    snapshot guardado en vez de cold-boot) y el backend rechaza requests con
    reloj desfasado — confirmado en recon (2026-07-07): drift de 5 días causó
    'Error: Petición expirada o reloj desfasado' en el login, sin ser un bug
    de la app. `adb shell date <valor>` falla por permisos en esta imagen (no
    rooteada: 'adbd cannot run as root in production builds'), así que se
    fuerza la sincronización por red (NITZ/NTP) vía `auto_time` para el epoch,
    y la zona horaria se fija EXPLÍCITO a `TIMEZONE` (America/Mexico_City) en
    vez de confiar en auto_time_zone: sin SIM/ubicación el AVD la infiere como
    GMT, y el turno del operador debe quedar en hora local real (también
    confirmado en recon: con auto_time_zone el reloj mostraba 17:59 GMT
    cuando en Querétaro eran las 11:59). No bloqueante: si no logra
    sincronizar en el tiempo dado, solo advierte — mejor eso que tumbar toda
    la corrida acá."""
    try:
        subprocess.run(
            ["adb", "-s", serial, "shell", "settings", "put", "global", "auto_time", "1"],
            capture_output=True, timeout=10,
        )
        # Zona horaria explícita, NO auto_time_zone (ver docstring).
        subprocess.run(
            ["adb", "-s", serial, "shell", "settings", "put", "global", "auto_time_zone", "0"],
            capture_output=True, timeout=10,
        )
        subprocess.run(
            ["adb", "-s", serial, "shell", "service", "call", "alarm", "3", "s16", TIMEZONE],
            capture_output=True, timeout=10,
        )
        for _ in range(max_espera):
            result = subprocess.run(
                ["adb", "-s", serial, "shell", "date", "+%s"],
                capture_output=True, text=True, timeout=10,
            )
            try:
                device_epoch = int(result.stdout.strip())
            except ValueError:
                device_epoch = None
            if device_epoch is not None and abs(device_epoch - time.time()) < 60:
                return True
            time.sleep(1)
        print(
            f"\n[SETUP][WARN] El reloj del emulador sigue desfasado tras "
            f"{max_espera}s de espera. La app puede rechazar requests como "
            f"'Petición expirada'. Si persiste, reiniciar el AVD en frío "
            f"(cold boot, no 'resume') suele resolverlo.\n"
        )
        return False
    except Exception as e:
        print(f"\n[SETUP][WARN] No se pudo verificar/sincronizar el reloj del emulador: {e}\n")
        return None


@pytest.fixture(scope="session")
def device_name():
    serial = get_android_device()
    if _es_tablet(serial) is False:
        print(
            f"\n[SETUP][WARN] El dispositivo {serial} no reporta 'tablet' en "
            f"ro.build.characteristics. Verificar que el AVD activo sea "
            f"'{AVD_NAME}' (tablet) y no un emulador de teléfono.\n"
        )
    _forzar_landscape(serial)
    _sincronizar_reloj(serial)
    return serial


@pytest.fixture(scope="function")
def driver(appium_server_url, device_name):
    options = get_driver_options(device_name)
    driver = webdriver.Remote(command_executor=appium_server_url, options=options)
    # Implicit wait bajo: las esperas explícitas de base_page marcan el ritmo
    # real. Un implicit wait alto convierte cada "no existe" en una espera larga.
    driver.implicitly_wait(3)
    yield driver
    try:
        driver.quit()
    except Exception:
        pass


def _leer_logcat(driver):
    try:
        return [e.get("message", "") for e in driver.get_log("logcat")]
    except Exception:
        return []


def _imprimir_resumen(reporte):
    """Banner de resumen por test — equivalente Appium del printSummary() de
    Playwright: visibilidad inmediata en consola sin tener que abrir el JSON."""
    print("\n" + "═" * 70)
    print(f"📊  RESUMEN MONITOR — {reporte['test']}")
    print("═" * 70)
    print(f"⏱️  Duración:                    {reporte['duracion_seg']}s")
    print(f"📱  Estado app (foreground≥4):   {reporte['app_state']}")
    print(f"🏷️  Resultado / categoría:       {reporte['resultado']} / {reporte['categoria_fallo']}")
    print(f"🔴  Crash/ANR:                   {reporte['crash_count']}")
    print(f"🟡  Errores no fatales:          {reporte['errores_no_fatales_count']}")
    if reporte["crash_lineas"]:
        print("\n── Crash/ANR detectados ────────────────────────────────────────")
        for i, ln in enumerate(reporte["crash_lineas"], 1):
            print(f"  [{i}] {ln}")
    print("═" * 70 + "\n")


@pytest.fixture(scope="function", autouse=True)
def crash_monitor(request, driver):
    """Monitor global de crash/ANR + resumen legible + reporte JSON por test.
    Cualquier test nuevo lo hereda automáticamente (autouse), sin tener que
    pedirlo explícitamente."""
    _leer_logcat(driver)  # drenar logcat previo: solo interesa lo de ESTE test
    inicio = time.time()

    yield

    duracion = round(time.time() - inicio, 1)
    lineas = _leer_logcat(driver)
    crash = [ln for ln in lineas if CRASH_PATTERNS.search(ln)]
    no_fatales = [
        ln for ln in lineas
        if not CRASH_PATTERNS.search(ln)
        and not INFRA_NOISE_PATTERNS.search(ln)
        and NONFATAL_PATTERNS.search(ln)
    ]

    try:
        estado = driver.query_app_state(APP_PACKAGE)
    except Exception:
        estado = None

    categoria = _clasificar_fallo(request, hubo_crash=bool(crash))
    rep_call = getattr(request.node, "rep_call", None)
    resultado = "passed" if (rep_call is not None and rep_call.passed) else "failed" if rep_call is not None else "sin_dato"

    reporte = {
        "test": request.node.name,
        "duracion_seg": duracion,
        "app_state": estado,
        "resultado": resultado,
        "categoria_fallo": categoria,
        "crash_count": len(crash),
        "crash_lineas": crash[:30],
        "errores_no_fatales_count": len(no_fatales),
        "errores_no_fatales": no_fatales[:30],
    }
    stamp = time.strftime("%Y%m%d-%H%M%S")
    try:
        mon_dir = os.path.join(os.path.dirname(__file__), "reports", "monitor")
        os.makedirs(mon_dir, exist_ok=True)
        with open(os.path.join(mon_dir, f"{request.node.name}_{stamp}.json"), "w", encoding="utf-8") as f:
            json.dump(reporte, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    if crash:
        # El buffer de logcat rota rápido (confirmado: se perdió el stack trace
        # de un crash real a los ~2 minutos por corridas posteriores pisándolo).
        # `crash_lineas` solo guarda las líneas que matchean el patrón, sin el
        # contexto alrededor (stack trace completo, causa previa). `lineas` ya
        # tiene TODO el logcat de este test (sin filtrar) — volcarlo completo a
        # un .txt es la única forma confiable de no perder esa evidencia para
        # el reporte de bug, antes de que otra corrida pise el buffer.
        try:
            os.makedirs(mon_dir, exist_ok=True)
            with open(os.path.join(mon_dir, f"{request.node.name}_{stamp}_logcat_completo.txt"), "w", encoding="utf-8") as f:
                f.write("\n".join(lineas))
        except Exception:
            pass

    _imprimir_resumen(reporte)

    # HARD-FAIL solo ante señales inequívocas (mismo criterio que Mediplanner Appium).
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
def gps(device_name):
    """Control de posición GPS para los casos de proximidad (check-in/liberar
    a ≤50m). SIEMPRE arranca y termina en la posición base que Pedro dejó
    fija manualmente (`config.GPS_LAT_BASE/LON_BASE`) — el `finally` implícito
    de este fixture (el código después del `yield`) restaura la posición pase
    lo que pase con el test, para no dejar el emulador movido de la ubicación
    real de trabajo."""
    from types import SimpleNamespace
    from utils.gps import fijar_posicion, alejar_posicion, restaurar_posicion_base

    restaurar_posicion_base(device_name)
    yield SimpleNamespace(
        fijar=lambda lat, lon: fijar_posicion(device_name, lat, lon),
        alejar=lambda metros=200: alejar_posicion(device_name, metros),
        restaurar=lambda: restaurar_posicion_base(device_name),
    )
    restaurar_posicion_base(device_name)


@pytest.fixture(scope="function")
def sesion_limpia(home_page):
    """Garantiza arrancar el test desde la pantalla de login, sin importar
    cómo haya quedado la app (turno abierto a mano por alguien explorando,
    o un test previo que no llegó a cerrar turno por un crash a mitad de
    camino). Lección aprendida en recon (2026-07-07): un re-login manual
    durante una sesión de exploración dejó la app en Home, y el siguiente
    test de login falló buscando campos que no estaban — no por un bug real,
    sino porque el test asumía un punto de partida que ya no era cierto.

    Cualquier test que dependa de arrancar en la pantalla de login (no solo
    test_login) debería pedir este fixture explícitamente."""
    if home_page.esta_visible(home_page.INDICADOR_HOME, timeout=3):
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"sesion_limpia: no se pudo cerrar el turno previo: {e}")
    yield
