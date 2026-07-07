import subprocess
import time

import pytest

from config import APP_PACKAGE, APP_ACTIVITY

PLACA_PRUEBA = "TEST-001"


@pytest.mark.smoke
def test_S1_arranque_frio_cae_en_login(sesion_limpia, device_name, login_page):
    """S1: la app NO persiste sesión entre relanzamientos (confirmado en
    recon 2026-07-07). `sesion_limpia` cierra cualquier turno abierto ANTES
    del force-stop, para no dejar un turno huérfano en el backend."""
    subprocess.run(
        ["adb", "-s", device_name, "shell", "am", "force-stop", APP_PACKAGE],
        capture_output=True, timeout=10,
    )
    subprocess.run(
        ["adb", "-s", device_name, "shell", "am", "start", "-n", f"{APP_PACKAGE}/{APP_ACTIVITY}"],
        capture_output=True, timeout=10,
    )
    assert login_page.esta_visible(login_page.CAMPO_CREDENCIAL_FALLBACK, timeout=20), (
        "Tras un arranque en frío (force-stop + start) la app no cayó en Login: "
        "¿empezó a persistir la sesión, contra lo confirmado en el recon?"
    )


@pytest.mark.smoke
def test_S2_login_valido_inicia_y_cierra_turno(sesion_limpia, login_page, home_page, credenciales):
    """Migrado desde test_login.py (housekeeping de CONTEXTO.md) — mismo
    flujo, renombrado con el ID del checklist para trazabilidad 1 a 1."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), (
            "No se pudo confirmar que el Home del operador cargó tras el login "
            "(revisar si el backend rechazó el login, p.ej. por reloj desfasado)"
        )
        home_page.tomar_screenshot("S2_home_tras_login")
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_S3_home_carga_espacios_en_lista(sesion_limpia, login_page, home_page, credenciales):
    """S3: la Vista Lista debe traer al menos un espacio con cualquier
    filtro aplicado (Libres es el de mayor volumen esperado en dev)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert len(codigos) > 0, (
            "La Vista Lista no muestra ningún espacio con el filtro 'Libres' "
            "aplicado (¿pool de datos de prueba vacío en dev?)"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
@pytest.mark.slow
def test_S4_checkin_asistido_en_espacio_libre(sesion_limpia, gps, login_page, home_page, credenciales):
    """S4: check-in asistido de punta a punta. Usa la posición GPS base
    (fijada por Pedro, confirmada a ~9m del espacio más cercano de prueba
    en el recon) vía el fixture `gps` en vez de mover el GPS a mano, y
    libera el espacio al final para no consumir el pool de libres de dev
    (son 9 hoy)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert len(codigos) > 0, "No hay espacios libres disponibles para probar el check-in"
        codigo = codigos[0]

        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido(PLACA_PRUEBA)

        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_VIGENTES)
        vigentes = home_page.codigos_de_espacios_visibles()
        assert codigo in vigentes, (
            f"El espacio {codigo} no aparece en Vigentes tras el check-in asistido"
        )

        home_page.abrir_espacio(codigo)
        home_page.liberar_espacio_actual(confirmar=True)
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_S6_pull_to_refresh_en_lista(sesion_limpia, login_page, home_page, credenciales):
    """S6: chequeo blando (documentado en CONTEXTO.md) — el gesto de
    pull-to-refresh (swipe hacia abajo estando en el tope de la lista) no
    debe romper ni vaciar la pantalla. No hay forma de forzar que el
    backend devuelva datos distintos, así que se compara el set de códigos
    antes/después en vez de asumir que deben cambiar."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        antes = set(home_page.codigos_de_espacios_visibles())

        home_page.scroll_arriba()  # swipe hacia abajo = gesto de pull-to-refresh
        time.sleep(1.5)

        despues = set(home_page.codigos_de_espacios_visibles())
        assert len(despues) > 0, (
            "Tras el pull-to-refresh la lista quedó vacía (¿el gesto disparó "
            "una recarga que falló o limpió los datos?)"
        )
        if antes != despues:
            home_page.logger.warning(
                f"S6: el set de espacios cambió tras pull-to-refresh "
                f"(antes={antes}, después={despues}) — puede ser normal si "
                f"los datos rotan en dev."
            )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_S7_cierre_de_turno_completo(sesion_limpia, login_page, home_page, credenciales):
    """S7: cierre de turno de punta a punta. CONFIRMADO (recon 2026-07-07,
    ver HALLAZGOS.md) que este build NO tiene el paso de firma que describe
    el checklist original (11.7/11.8/11.9) — va directo del resumen a
    CONFIRMAR Y CERRAR TURNO."""
    login_page.login(credenciales["email"], credenciales["password"])
    assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
    home_page.cerrar_turno()
    assert login_page.esta_visible(login_page.CAMPO_CREDENCIAL_FALLBACK, timeout=15), (
        "Tras confirmar el cierre de turno, la app no volvió a la pantalla de Login"
    )


@pytest.mark.skip(reason=(
    "S5 bloqueado: recon interrumpido antes de tocar 'LEVANTAR REPORTE' "
    "(ver CONTEXTO.md, sección 'Bloqueados / requieren decisión'). Falta "
    "confirmar si abre cámara nativa o un picker in-app antes de poder "
    "escribir el assert."
))
def test_S5_reporte_con_foto():
    pass


@pytest.mark.skip(reason=(
    "S8 bloqueado: forzar una sesión expirada (401 real) requiere revocar "
    "el token desde el backend o tamperar el storage local; no hay forma "
    "limpia desde el cliente. Evaluar con Pedro si hay acceso a un endpoint "
    "de backoffice para revocar sesiones (ver CONTEXTO.md, sección "
    "'Bloqueados')."
))
def test_S8_sesion_expirada():
    pass
