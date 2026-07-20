import subprocess
import sys
import os
import time

import pytest
from appium import webdriver
from appium.webdriver.common.appiumby import AppiumBy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_driver_options

PKG = "com.example.estacionamientos_mobile"


@pytest.fixture(scope="function")
def driver(appium_server_url, device_name):
    """Override del fixture `driver` de conftest.py, solo para este archivo:
    `pm clear` (simula instalación limpia, mismo patrón que 3.1) + sesión
    SIN `autoGrantPermissions`. El resto de la suite necesita esa capability
    (evita que el popup nativo tape logins/home de tests que no la
    involucran), pero el módulo 12 necesita justo lo contrario: que la app
    pida los permisos de verdad, la primera vez, como en un dispositivo
    real — con `autoGrantPermissions=True` el permiso ya está concedido
    antes de que la app lo pida, y el diálogo nativo nunca aparece.

    Enfoque más simple que el usado en 9.6 (conceder-todo-al-crear-sesión y
    revocar uno a mano después): ahí el revoke posterior no siempre se
    reflejaba en el proceso relanzado (cacheo de `permission_handler`, ver
    HALLAZGOS.md). Empezar sin auto-grant desde el arranque evita esa
    carrera por completo — confirmado en recon 2026-07-16."""
    subprocess.run(
        ["adb", "-s", device_name, "shell", "pm", "clear", PKG],
        capture_output=True, timeout=15,
    )
    options = get_driver_options(device_name)
    options.set_capability("autoGrantPermissions", False)
    driver = webdriver.Remote(command_executor=appium_server_url, options=options)
    driver.implicitly_wait(3)
    yield driver
    try:
        driver.quit()
    except Exception:
        pass


def _conceder_ubicacion(device_name):
    subprocess.run(
        ["adb", "-s", device_name, "shell", "pm", "grant", PKG, "android.permission.ACCESS_FINE_LOCATION"],
        capture_output=True, timeout=10,
    )
    subprocess.run(
        ["adb", "-s", device_name, "shell", "pm", "grant", PKG, "android.permission.ACCESS_COARSE_LOCATION"],
        capture_output=True, timeout=10,
    )


@pytest.mark.smoke
def test_12_1_ubicacion_denegada_primera_vez(sesion_limpia, device_name, login_page, home_page, credenciales):
    """12.1: al denegar el permiso de ubicación la primera vez que la app lo
    pide (justo al cargar Home tras el login), Android muestra su diálogo
    NATIVO real — recon (2026-07-16) confirmó el texto exacto: '¿Quieres
    permitir que Operador Estacionamientos acceda a la ubicación de este
    dispositivo?', con 'Mientras la app está en uso' / 'Solo esta vez' /
    'No permitir'.

    El checklist original describe un 'diálogo explicativo en pantalla' de
    la PROPIA app tras denegar — el recon confirmó que ese diálogo NO
    existe en este build: tras 'No permitir', la app entra directo a Home
    sin ningún aviso propio. Ver HALLAZGOS.md. Este test valida el
    comportamiento REAL: Home carga igual, pero degradado en silencio — el
    botón de Check-In Asistido queda `clickable=false` sin ningún banner
    que lo explique (a diferencia de 'fuera de proximidad', módulo 8, que
    sí muestra un banner de texto)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.denegar_popup_permiso_nativo(timeout=20), (
            "No apareció el diálogo nativo de permiso de ubicación la primera vez "
            "que la app lo pidió (¿ya estaba concedido de una corrida anterior?)"
        )
        # Hallazgo (2026-07-16): puede aparecer un SEGUNDO diálogo de ubicación
        # en secuencia (el SDK de Google Maps la vuelve a pedir al cargar el
        # mapa de Home, aparte de la solicitud inicial de la app) — si no se
        # deniega también, el auto-aceptador de `esta_cargado()`
        # (`manejar_popup_permiso_ubicacion`, pensado para el resto de la
        # suite) lo acepta y el permiso termina CONCEDIDO pese a la negación
        # inicial. Denegar todos los que aparezcan antes de usar
        # `esta_cargado()` (que además ya no hace falta: `esta_visible` sobre
        # el propio indicador no dispara el auto-aceptador).
        while home_page.denegar_popup_permiso_nativo(timeout=5):
            pass
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=30), (
            "Home no cargó tras denegar el permiso de ubicación (se esperaba que "
            "cargara igual, en modo degradado)"
        )

        home_page.ir_a_lista()
        home_page.hacer_click_estable(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para verificar el bloqueo de check-in"
        home_page.abrir_espacio(codigos[0])
        elems = home_page.buscar_elementos(home_page.BOTON_CHECKIN_ASISTIDO, timeout=5)
        assert elems, "El botón de Check-In Asistido no está presente"
        assert elems[0].get_attribute("clickable") == "false", (
            "Check-In Asistido sigue clickable sin permiso de ubicación (se esperaba "
            "bloqueado, mismo patrón silencioso 'clickable=false' que 'fuera de "
            "proximidad' del módulo 8)"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")
        _conceder_ubicacion(device_name)


@pytest.mark.smoke
def test_12_2_ubicacion_denegada_permanente(sesion_limpia, device_name, login_page, home_page, credenciales):
    """12.2: tras UNA sola negación, este ambiente ya marca el permiso con
    la flag `USER_FIXED` (confirmado por `dumpsys package` en recon
    2026-07-16 — no hicieron falta dos negaciones) y Android no vuelve a
    preguntar. El checklist espera un 'diálogo con enlace directo a Ajustes
    del sistema' de la PROPIA app para este caso — el recon confirmó que
    tampoco existe: relanzar la app (force-stop + start) no vuelve a
    mostrar NINGÚN diálogo (ni nativo ni propio) y se mantiene el mismo
    estado degradado y silencioso de 12.1. Ver HALLAZGOS.md."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.denegar_popup_permiso_nativo(timeout=20), (
            "No apareció el diálogo nativo de permiso de ubicación al loguear"
        )
        # Hallazgo (2026-07-16): puede aparecer un SEGUNDO diálogo de ubicación
        # en secuencia (el SDK de Google Maps la vuelve a pedir al cargar el
        # mapa de Home, aparte de la solicitud inicial de la app) — si no se
        # deniega también, el auto-aceptador de `esta_cargado()`
        # (`manejar_popup_permiso_ubicacion`, pensado para el resto de la
        # suite) lo acepta y el permiso termina CONCEDIDO pese a la negación
        # inicial. Denegar todos los que aparezcan antes de usar
        # `esta_cargado()` (que además ya no hace falta: `esta_visible` sobre
        # el propio indicador no dispara el auto-aceptador).
        while home_page.denegar_popup_permiso_nativo(timeout=5):
            pass
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=30), (
            "Home no cargó tras denegar el permiso de ubicación"
        )

        salida = subprocess.run(
            ["adb", "-s", device_name, "shell", "dumpsys", "package", PKG],
            capture_output=True, text=True, timeout=15,
        ).stdout
        assert "ACCESS_FINE_LOCATION: granted=false" in salida, (
            "El permiso de ubicación no quedó denegado tras la primera negación"
        )

        subprocess.run(
            ["adb", "-s", device_name, "shell", "am", "force-stop", PKG],
            capture_output=True, timeout=10,
        )
        subprocess.run(
            ["adb", "-s", device_name, "shell", "am", "start", "-n", f"{PKG}/.MainActivity"],
            capture_output=True, timeout=10,
        )
        time.sleep(3)

        assert not home_page.esta_visible(
            (AppiumBy.XPATH, '//*[contains(@resource-id, "permission")]'), timeout=3
        ), "Reapareció un diálogo nativo de permiso pese a estar denegado permanentemente (USER_FIXED)"
        assert home_page.esta_cargado(timeout=30), (
            "Home no cargó tras relanzar con el permiso de ubicación denegado permanentemente"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")
        _conceder_ubicacion(device_name)


@pytest.mark.smoke
def test_12_3_camara_denegada(sesion_limpia, device_name, login_page, home_page, credenciales):
    """12.3: mismo escenario que 9.6 (que quedó `skip` por un problema de
    cacheo con el enfoque de conceder-todo-y-revocar-después), pero
    reproducido acá con el enfoque más simple de este archivo: la sesión
    arranca SIN `autoGrantPermissions`, así que la cámara nunca estuvo
    concedida y la app la pide de forma 100% natural la primera vez que
    hace falta (LEVANTAR REPORTE) — sin ninguna carrera de revoke. Ubicación
    se concede a mano de antemano para no mezclar su propio diálogo acá; el
    foco de este test es cámara.

    Recon (2026-07-16): 1) diálogo NATIVO real ('¿Quieres permitir que
    Operador Estacionamientos tome fotos y grabe videos?'); 2) al elegir
    'No permitir', la propia app SÍ muestra un diálogo propio en su árbol
    de accesibilidad ('Permiso de cámara requerido', 'Cancelar'/'Abrir
    configuración') — a diferencia de ubicación (12.1/12.2), acá el
    checklist SÍ acierta: hay un diálogo explicativo real; 3) 'Cancelar'
    vuelve al sidebar del espacio sin haber entrado nunca a la pantalla de
    reporte."""
    _conceder_ubicacion(device_name)
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click_estable(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para preparar el caso de reporte"
        codigo = codigos[0]
        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido("TEST-012")
        assert home_page.ubicar_y_abrir_ocupado(codigo, intentos=6, espera_entre=3.0), (
            f"No se encontró {codigo} recién ocupado para levantar un reporte "
            f"(lag de categorización conocido, ver módulo 8)"
        )

        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)
        assert home_page.denegar_popup_permiso_nativo(timeout=8), (
            "No apareció el diálogo nativo de permiso de cámara al tocar LEVANTAR REPORTE "
            "sin el permiso otorgado"
        )
        home_page.assert_visible(
            home_page.DIALOGO_PERMISO_CAMARA_TITULO,
            "No apareció el diálogo propio de la app ('Permiso de cámara requerido') "
            "tras denegar el permiso nativo",
            timeout=10,
        )
        home_page.hacer_click(home_page.DIALOGO_PERMISO_CAMARA_CANCELAR)
        home_page.esperar_invisible(home_page.DIALOGO_PERMISO_CAMARA_TITULO, timeout=10)

        assert not home_page.esta_visible(home_page.TITULO_TIPO_REPORTE, timeout=2), (
            "El flujo navegó a la pantalla de Reporte pese a no tener permiso de cámara"
        )
        home_page.assert_visible(
            home_page.BOTON_LIBERAR_ESPACIO,
            "Tras cancelar el diálogo de permiso, no se quedó en el sidebar del espacio ocupado",
        )
    finally:
        try:
            if codigo:
                home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 12.3: {e}")
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")
        subprocess.run(
            ["adb", "-s", device_name, "shell", "pm", "grant", PKG, "android.permission.CAMERA"],
            capture_output=True, timeout=10,
        )


@pytest.mark.smoke
def test_12_4_restaurar_permiso_desbloquea(sesion_limpia, device_name, login_page, home_page, credenciales):
    """12.4: conceder el permiso en Ajustes del sistema y volver a la app
    desbloquea de inmediato las acciones antes bloqueadas — CONFIRMADO en
    recon (2026-07-16). Detalle importante: re-otorgar el permiso (`pm
    grant`) con la app en foreground NO alcanza por sí solo — el estado
    cacheado del lado de Flutter (`permission_handler`) no se refresca
    hasta un evento real de ciclo de vida; hace falta el paso de
    background→foreground, que es exactamente lo que describe el checklist
    ('regresar a la app'). `driver.background_app()` ya lo hace (mismo
    patrón que 3.2)."""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.denegar_popup_permiso_nativo(timeout=20), (
            "No apareció el diálogo nativo de permiso de ubicación al loguear"
        )
        # Hallazgo (2026-07-16): puede aparecer un SEGUNDO diálogo de ubicación
        # en secuencia (el SDK de Google Maps la vuelve a pedir al cargar el
        # mapa de Home, aparte de la solicitud inicial de la app) — si no se
        # deniega también, el auto-aceptador de `esta_cargado()`
        # (`manejar_popup_permiso_ubicacion`, pensado para el resto de la
        # suite) lo acepta y el permiso termina CONCEDIDO pese a la negación
        # inicial. Denegar todos los que aparezcan antes de usar
        # `esta_cargado()` (que además ya no hace falta: `esta_visible` sobre
        # el propio indicador no dispara el auto-aceptador).
        while home_page.denegar_popup_permiso_nativo(timeout=5):
            pass
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=30), (
            "Home no cargó tras denegar el permiso de ubicación"
        )

        home_page.ir_a_lista()
        home_page.hacer_click_estable(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para preparar el caso"
        codigo = codigos[0]
        home_page.abrir_espacio(codigo)
        elems = home_page.buscar_elementos(home_page.BOTON_CHECKIN_ASISTIDO, timeout=5)
        assert elems and elems[0].get_attribute("clickable") == "false", (
            "Precondición no cumplida: Check-In Asistido no estaba bloqueado "
            "antes de restaurar el permiso"
        )

        _conceder_ubicacion(device_name)
        home_page.driver.background_app(2)

        # El refresco del estado de permiso del lado de Flutter tras el resume
        # no siempre es inmediato (más lento aún bajo la carga alta típica de
        # un AVD recién reiniciado) — reintentar unos segundos antes de dar
        # por bloqueado, en vez de una sola lectura.
        desbloqueado = False
        for _ in range(6):
            elems = home_page.buscar_elementos(home_page.BOTON_CHECKIN_ASISTIDO, timeout=5)
            if elems and elems[0].get_attribute("clickable") == "true":
                desbloqueado = True
                break
            time.sleep(2)
        assert desbloqueado, (
            "Check-In Asistido sigue bloqueado tras conceder el permiso y volver a la app "
            "(background→foreground), tras varios reintentos"
        )

        codigo = codigos[0]
        home_page.hacer_checkin_asistido("TEST-012")
        assert home_page.esperar_fuera_de_libres(codigo), (
            f"El check-in de verificación no sacó a {codigo} de 'Libres' tras "
            f"restaurar el permiso (persistió tras reintentos)"
        )
    finally:
        try:
            if codigo:
                home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 12.4: {e}")
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")
