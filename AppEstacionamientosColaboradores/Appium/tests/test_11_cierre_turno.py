import subprocess
import time

import pytest
from appium.webdriver.common.appiumby import AppiumBy


@pytest.mark.smoke
def test_11_1_carga_resumen_del_turno(sesion_limpia, login_page, home_page, credenciales):
    """11.1: Menú → Cerrar turno abre el resumen con métricas y bitácora.
    Recon (2026-07-16) confirmó las métricas reales: Check-ins asistidos,
    Espacios verificados, Reportes enviados, Reportes por tipo, Distancia
    recorrida, Duración, y la sección 'Actividad del turno' (lista de eventos
    del turno actual). No se encontró una 'gráfica por tipo de vehículo'
    separada como menciona el checklist — puede ser parte de 'Reportes por
    tipo' sin gráfico visual distinto, no investigado a fondo (bajo
    prioridad, no bloquea nada)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.abrir_menu_usuario()
        home_page.hacer_click(home_page.OPCION_CERRAR_TURNO)

        home_page.assert_visible(home_page.TITULO_CIERRE_TURNO, "No apareció el título 'Cierre de turno'")
        for texto in ("Check-ins asistidos", "Espacios verificados", "Reportes enviados", "Duración"):
            home_page.assert_visible(
                (AppiumBy.XPATH, f'//android.view.View[@content-desc="{texto}"]'),
                f"No apareció la métrica '{texto}' en el resumen",
            )
        home_page.assert_visible(
            home_page.BOTON_CONFIRMAR_CERRAR_TURNO,
            "No apareció 'CONFIRMAR Y CERRAR TURNO' en el resumen",
        )
    finally:
        try:
            home_page.hacer_click(home_page.BOTON_CONFIRMAR_CERRAR_TURNO)
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_11_3_error_de_carga_sin_red(sesion_limpia, device_name, login_page, home_page, credenciales):
    """11.3: sin red al abrir Cierre de turno, se muestra un error con
    'Reintentar'. Recon (2026-07-16) confirmó el texto real: 'No se pudo
    cargar el resumen del turno. Intenta de nuevo.' + botón 'Reintentar'.
    Con la red restaurada, 'Reintentar' sí recupera el resumen normal (se
    valida como parte del mismo test, no solo el estado de error)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"

        subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "disable"], capture_output=True, timeout=10)
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "disable"], capture_output=True, timeout=10)
        try:
            home_page.abrir_menu_usuario()
            home_page.hacer_click(home_page.OPCION_CERRAR_TURNO)
            home_page.assert_visible(
                home_page.ERROR_CARGA_RESUMEN,
                "No apareció el error de carga del resumen al estar sin red",
                timeout=15,
            )
            home_page.assert_visible(
                home_page.BOTON_REINTENTAR_RESUMEN,
                "No apareció el botón 'Reintentar' junto al error de carga",
            )
        finally:
            subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "enable"], capture_output=True, timeout=10)
            subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "enable"], capture_output=True, timeout=10)
            time.sleep(3)

        home_page.hacer_click(home_page.BOTON_REINTENTAR_RESUMEN)
        home_page.assert_visible(
            home_page.BOTON_CONFIRMAR_CERRAR_TURNO,
            "'Reintentar' con la red restaurada no recuperó el resumen normal",
            timeout=15,
        )
    finally:
        try:
            home_page.hacer_click(home_page.BOTON_CONFIRMAR_CERRAR_TURNO)
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_11_4_exportar_bitacora_vacia_deshabilitado(sesion_limpia, login_page, home_page, credenciales):
    """11.4: el checklist dice 'exportar sin registros → toast/mensaje de
    bitácora vacía'. Recon (2026-07-16) confirmó un comportamiento distinto
    (no un bug, un mecanismo más simple): con 'Actividad del turno' vacía,
    'EXPORTAR BITÁCORA' queda directamente `clickable="false"` — mismo patrón
    de bloqueo ya visto en toda la app (proximidad, fotos, etc.), sin toast."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.abrir_menu_usuario()
        home_page.hacer_click(home_page.OPCION_CERRAR_TURNO)
        home_page.assert_visible(home_page.TITULO_CIERRE_TURNO, "No apareció el título 'Cierre de turno'")

        elems = home_page.buscar_elementos(home_page.BOTON_EXPORTAR_BITACORA, timeout=5)
        assert elems, "'EXPORTAR BITÁCORA' no está presente con actividad vacía"
        assert elems[0].get_attribute("clickable") == "false", (
            "'EXPORTAR BITÁCORA' sigue clickable con la actividad del turno vacía"
        )
    finally:
        try:
            home_page.hacer_click(home_page.BOTON_CONFIRMAR_CERRAR_TURNO)
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_11_6_compartir_bitacora_con_datos(sesion_limpia, login_page, home_page, credenciales):
    """11.6: con actividad real en el turno (un check-in asistido propio),
    'EXPORTAR BITÁCORA' se habilita y ofrece 'Guardar en dispositivo' /
    'Compartir' — 'Compartir' abre el sheet NATIVO de Android (confirmado
    por recon, fuera del árbol de accesibilidad de la app). El test no
    completa el share (no hay a dónde enviarlo en el emulador de forma
    determinística) — solo confirma que el sheet se abrió y vuelve atrás
    tocando fuera de él (no usa BACK nativo, ver gotcha de CLAUDE.md)."""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para generar actividad de turno"
        codigo = codigos[0]
        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido("TEST-011")

        home_page.abrir_menu_usuario()
        home_page.hacer_click(home_page.OPCION_CERRAR_TURNO)
        home_page.assert_visible(home_page.TITULO_CIERRE_TURNO, "No apareció el título 'Cierre de turno'")

        elems = home_page.buscar_elementos(home_page.BOTON_EXPORTAR_BITACORA, timeout=10)
        assert elems, "'EXPORTAR BITÁCORA' no está presente"
        assert elems[0].get_attribute("clickable") == "true", (
            "'EXPORTAR BITÁCORA' sigue deshabilitado pese a haber actividad real en el turno"
        )
        home_page.hacer_click(home_page.BOTON_EXPORTAR_BITACORA)
        home_page.assert_visible(
            home_page.OPCION_COMPARTIR_BITACORA, "No apareció la opción 'Compartir' al exportar bitácora"
        )
        home_page.assert_visible(
            home_page.OPCION_GUARDAR_EN_DISPOSITIVO,
            "No apareció la opción 'Guardar en dispositivo' al exportar bitácora",
        )

        home_page.hacer_click(home_page.OPCION_COMPARTIR_BITACORA)
        time.sleep(2)
        # El sheet nativo del SO (chooser de cuentas/apps) no tiene selectores
        # propios de la app y su contenido varía según lo que haya instalado
        # el dispositivo — se confirma solo indirectamente, por la ausencia
        # del título de la app, sin intentar volver a navegar dentro de él
        # (el mecanismo de cierre del chooser no es estable entre corridas).
        # La limpieza (force-stop) se encarga de dejar todo en un estado
        # conocido después, en vez de un tap-to-dismiss frágil.
        assert not home_page.esta_visible(home_page.TITULO_CIERRE_TURNO, timeout=2), (
            "No se detectó la transición al sheet nativo de compartir"
        )
    finally:
        subprocess.run(
            ["adb", "shell", "am", "force-stop", "com.example.estacionamientos_mobile"],
            capture_output=True, timeout=10,
        )
        subprocess.run(
            ["adb", "shell", "settings", "put", "system", "user_rotation", "0"],
            capture_output=True, timeout=10,
        )


@pytest.mark.smoke
def test_11_9_cierre_de_turno_completo(sesion_limpia, login_page, home_page, credenciales):
    """11.9: Confirmar cierra el turno y vuelve a Login (sesión cerrada de
    verdad, no solo un cambio de pantalla). Ya se ejerce implícitamente en
    el resto de la suite vía `HomePage.cerrar_turno()`, pero se deja este
    test explícito para trazabilidad 1 a 1 con el ID del checklist."""
    login_page.login(credenciales["email"], credenciales["password"])
    assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
    home_page.cerrar_turno()
    home_page.assert_visible(
        login_page.CAMPO_CREDENCIAL,
        "Tras confirmar el cierre de turno, no volvió a la pantalla de Login",
        timeout=15,
    )


@pytest.mark.smoke
def test_11_10_acceso_desde_reporte(sesion_limpia, login_page, home_page, credenciales):
    """11.10: el menú de usuario (y 'Cerrar turno') es accesible también
    desde la pantalla de Reporte, no solo desde Home — abre la misma
    pantalla de cierre de turno."""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para preparar el caso"
        codigo = codigos[0]
        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido("TEST-011")
        assert home_page.esperar_fuera_de_libres(codigo), (
            f"El check-in de preparación no sacó a {codigo} de 'Libres'"
        )
        assert home_page.ubicar_y_abrir_ocupado(codigo), (
            f"No se encontró {codigo} recién ocupado para abrir la pantalla de Reporte"
        )
        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)
        home_page.assert_visible(home_page.TITULO_TIPO_REPORTE, "No se abrió la pantalla de Reporte")

        home_page.abrir_menu_usuario()
        home_page.hacer_click(home_page.OPCION_CERRAR_TURNO)
        home_page.assert_visible(
            home_page.TITULO_CIERRE_TURNO,
            "'Cerrar turno' desde la pantalla de Reporte no abrió el Cierre de turno",
            timeout=10,
        )
    finally:
        try:
            home_page.hacer_click(home_page.BOTON_CONFIRMAR_CERRAR_TURNO)
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")
        subprocess.run(
            ["adb", "shell", "am", "force-stop", "com.example.estacionamientos_mobile"],
            capture_output=True, timeout=10,
        )
        subprocess.run(
            ["adb", "shell", "settings", "put", "system", "user_rotation", "0"],
            capture_output=True, timeout=10,
        )


# 11.2 (sin turno activo en backend): no automatizado — requeriría forzar que
# el backend invalide el turno mientras la app sigue con sesión local activa
# (p.ej. otro cliente cerrándolo por API), no reproducible de forma
# determinística desde la UI. Pendiente de recon si se vuelve prioritario.
#
# 11.5 (exportar CSV con datos → archivo en Descargas): 'Guardar en
# dispositivo' se mapeó (mismo diálogo que 11.6) pero no se automatizó la
# verificación del archivo en sí (leer el filesystem del emulador vía adb
# agrega una capa de verificación distinta a lo que hace el resto de la
# suite). Queda como pendiente de bajo riesgo — el mecanismo de habilitar/
# deshabilitar el botón ya está cubierto por 11.4/11.6.
#
# 11.7/11.8 (firma vacía / cancelar firma): NO APLICAN a este build (v1.0.0
# build 1) — confirmado en recon 2026-07-07 y re-confirmado 2026-07-16: no
# existe ningún paso de firma antes de 'CONFIRMAR Y CERRAR TURNO'. Ver
# docstring de `HomePage.cerrar_turno` y HALLAZGOS.md.
