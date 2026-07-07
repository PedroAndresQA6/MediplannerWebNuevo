import time

import pytest


@pytest.mark.smoke
def test_5_1_chip_gps_con_permiso(sesion_limpia, login_page, home_page, credenciales):
    """5.1: con `autoGrantPermissions` (capability por defecto de la suite,
    ver config.py) el permiso de ubicación ya está concedido al crear la
    sesión — el chip 'GPS' del topbar debe estar visible en ese estado
    normal."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.assert_visible(home_page.ESTADO_GPS, "El chip GPS no aparece con el permiso concedido")
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.skip(reason=(
    "5.2 bloqueado por ahora: recon 2026-07-07 confirmó que `pm revoke` de "
    "ubicación en caliente hace que Android backgroundee/mate la app "
    "(comportamiento del SO desde Android 6, no un bug) — hay que revocar y "
    "reactivar con `driver.activate_app()` (sin nueva sesión, para no disparar "
    "de nuevo `autoGrantPermissions`) y confirmar el texto/estado real que "
    "muestra el chip inactivo. El intento de recon se cortó por la lentitud "
    "intermitente ya documentada (login no cargó a tiempo). Retomar con más "
    "margen de tiempo antes de escribir el assert."
))
def test_5_2_chip_gps_sin_permiso():
    pass


@pytest.mark.smoke
def test_5_3_chip_en_linea_conectado(sesion_limpia, login_page, home_page, credenciales):
    """5.3: con red activa (estado por defecto del AVD), el chip debe leer
    exactamente 'En línea' (accessibility id ya mapeado)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.assert_visible(home_page.ESTADO_CONEXION, "El chip 'En línea' no aparece con red activa")
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_5_4_chip_conexion_refleja_desconexion(sesion_limpia, device_name, login_page, home_page, credenciales):
    """5.4: chequeo blando — no se confirmó por recon el texto exacto del
    chip en estado offline (ver 5.2, misma limitación de tiempo), así que en
    vez de afirmar un texto puntual se verifica que el chip EXACTO 'En línea'
    deja de estar presente al cortar la red (la app tiene que reflejar el
    cambio de alguna forma distinguible)."""
    import subprocess
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        assert home_page.esta_visible(home_page.ESTADO_CONEXION, timeout=10), (
            "Precondición: el chip 'En línea' debería estar visible con red activa"
        )
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "disable"], capture_output=True, timeout=10)
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "disable"], capture_output=True, timeout=10)
        time.sleep(3)
        assert not home_page.esta_visible(home_page.ESTADO_CONEXION, timeout=5), (
            "El chip siguió mostrando exactamente 'En línea' tras cortar wifi+datos "
            "(¿la app no detecta la desconexión?)"
        )
    finally:
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "enable"], capture_output=True, timeout=10)
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "enable"], capture_output=True, timeout=10)
        time.sleep(2)
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
@pytest.mark.slow
def test_5_5_duracion_de_turno_avanza(sesion_limpia, login_page, home_page, credenciales):
    """5.5: recon confirmó el content-desc real (' · Turno 00:00'). Test
    lento a propósito (~65s de espera real): lee el valor, espera, y confirma
    que cambió — sin parsear el formato exacto, para no acoplarse a él."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        valor_inicial = home_page.obtener_atributo(home_page.DURACION_TURNO, "content-desc", timeout=10)
        time.sleep(65)
        valor_final = home_page.obtener_atributo(home_page.DURACION_TURNO, "content-desc", timeout=10)
        assert valor_final != valor_inicial, (
            f"El contador de duración de turno no avanzó en 65s (antes={valor_inicial!r}, "
            f"después={valor_final!r})"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_5_6_menu_operador_muestra_cerrar_turno(sesion_limpia, login_page, home_page, credenciales):
    """5.6: caso simple, reutiliza selectores ya mapeados en recon anterior."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.abrir_menu_usuario()
        home_page.assert_visible(
            home_page.OPCION_CERRAR_TURNO,
            "El menú de usuario no muestra la opción 'Cerrar turno'",
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.skip(reason=(
    "5.7 bloqueado: requiere un espacio 'por vencer' real en los datos de "
    "prueba de dev (no garantizado que exista en cada corrida) y esperar "
    "~45s observando un cambio de color/estado sin interacción — no hay hoy "
    "un helper que lea el color/estado visual de un pin o fila más allá del "
    "texto del content-desc. Evaluar con Pedro si el estado (Libre/Vigente/"
    "Por vencer/Vencido) se puede leer del content-desc de la fila en Vista "
    "Lista antes de invertir en esto."
))
def test_5_7_auto_refresco_de_espacios():
    pass
