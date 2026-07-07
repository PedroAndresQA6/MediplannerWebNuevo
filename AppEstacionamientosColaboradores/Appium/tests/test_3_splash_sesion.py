import subprocess
import time

import pytest

from config import APP_PACKAGE, APP_ACTIVITY


@pytest.mark.smoke
def test_3_1_primera_instalacion_muestra_login(sesion_limpia, device_name, login_page):
    """3.1: 'Primera instalación' se simula con `pm clear` (borra datos/sesión
    local sin desinstalar) en vez de un uninstall/install real, que sería
    mucho más lento y no cambia el resultado observable. `sesion_limpia`
    cierra cualquier turno abierto ANTES del clear: una vez borrados los
    datos locales se pierde el token, y no habría forma de cerrar el turno
    después (quedaría huérfano en el backend)."""
    subprocess.run(
        ["adb", "-s", device_name, "shell", "pm", "clear", APP_PACKAGE],
        capture_output=True, timeout=15,
    )
    subprocess.run(
        ["adb", "-s", device_name, "shell", "am", "start", "-n", f"{APP_PACKAGE}/{APP_ACTIVITY}"],
        capture_output=True, timeout=10,
    )
    assert login_page.esta_visible(login_page.CAMPO_CREDENCIAL_FALLBACK, timeout=25), (
        "Tras 'pm clear' (simulando primera instalación) + reapertura, la app "
        "no cayó en Login"
    )


@pytest.mark.smoke
def test_3_2_reapertura_con_turno_activo_va_directo_a_home(sesion_limpia, login_page, home_page, credenciales):
    """3.2: a diferencia de S1 (arranque en FRÍO, con force-stop), acá la app
    solo se manda a background y se vuelve a traer al frente sin matar el
    proceso — `driver.background_app` hace exactamente eso (home real +
    reactivación), sin el riesgo de `adb keyevent BACK` (puede sacar la app
    del todo, ver CLAUDE.md) ni de un `force-stop` (eso es S1, no este caso)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.driver.background_app(3)
        assert home_page.esta_cargado(timeout=15), (
            "Tras reabrir la app desde background (sin cerrar turno), no volvió "
            "directo a Home — ¿se perdió la sesión activa?"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_3_3_arranque_frio_sin_red_cae_en_login(sesion_limpia, device_name, login_page):
    """3.3: sin sesión válida guardada (garantizado por `sesion_limpia`, que
    ya deja la app en Login), un cold start sin red debe seguir cayendo en
    Login (no puede haber una llamada exitosa al backend que lleve a Home).
    No se afirma nada sobre el toast de error puntual: su texto/duración
    exactos no están confirmados por recon, así que el chequeo es sobre el
    resultado observable y estable (dónde cae la app), no sobre el toast."""
    subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "disable"], capture_output=True, timeout=10)
    subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "disable"], capture_output=True, timeout=10)
    try:
        subprocess.run(
            ["adb", "-s", device_name, "shell", "am", "force-stop", APP_PACKAGE],
            capture_output=True, timeout=10,
        )
        subprocess.run(
            ["adb", "-s", device_name, "shell", "am", "start", "-n", f"{APP_PACKAGE}/{APP_ACTIVITY}"],
            capture_output=True, timeout=10,
        )
        assert login_page.esta_visible(login_page.CAMPO_CREDENCIAL_FALLBACK, timeout=25), (
            "Arranque en frío sin red no cayó en Login (sin sesión guardada, no "
            "debería poder llegar a Home)"
        )
    finally:
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "enable"], capture_output=True, timeout=10)
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "enable"], capture_output=True, timeout=10)


@pytest.mark.skip(reason=(
    "3.4 bloqueado: forzar que el backend invalide la sesión mientras la app "
    "está en background requiere cooperación del backend (revocar el token "
    "activo) o tamperar el storage local — mismo bloqueo que S8 (ver "
    "CONTEXTO.md/HALLAZGOS.md). Evaluar con Pedro si hay endpoint de "
    "backoffice para revocar sesiones."
))
def test_3_4_sesion_expirada_en_background():
    pass
