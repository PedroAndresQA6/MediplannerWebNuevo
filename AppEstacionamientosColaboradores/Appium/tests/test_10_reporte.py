import subprocess
import time

import pytest

PLACA_PRUEBA = "TEST-010"


def _resetear_rotacion_tras_reporte(device_name):
    """Hallazgo 2026-07-16 (ver HALLAZGOS.md): abrir la pantalla de Reporte
    (preview de cámara en vivo) dispara `CameraService rotationOverride` en
    Android, que fuerza la rotación de TODA la pantalla y queda pegado al
    proceso — reapareciendo minutos después aunque `user_rotation` ya se haya
    reseteado a mano. La única mitigación confirmada es matar el proceso
    (`force-stop`), no solo resetear el setting. Se llama al final de CADA
    test de este módulo que abre LEVANTAR REPORTE, para no arrastrar el
    problema al siguiente test.

    OJO (hallazgo de arnés, 2026-07-16): el `force-stop` deja la app fuera de
    foreground justo cuando termina la función del test — y el fixture
    `crash_monitor` (autouse, `conftest.py`) chequea `query_app_state` al
    finalizar CUALQUIER test y hace fallar duro si no quedó en foreground.
    Sin relanzar acá, un test que pasa sus propios asserts igual sale con
    `ERROR` (falso positivo de "app no quedó en foreground", no un crash
    real). Por eso se relanza la app después del `force-stop`, dejándola de
    nuevo en un estado conocido (Home o Login, según haya turno abierto)."""
    subprocess.run(
        ["adb", "-s", device_name, "shell", "am", "force-stop", "com.example.estacionamientos_mobile"],
        capture_output=True, timeout=10,
    )
    subprocess.run(
        ["adb", "-s", device_name, "shell", "settings", "put", "system", "user_rotation", "0"],
        capture_output=True, timeout=10,
    )
    subprocess.run(
        ["adb", "-s", device_name, "shell", "am", "start", "-n",
         "com.example.estacionamientos_mobile/.MainActivity"],
        capture_output=True, timeout=10,
    )
    time.sleep(3)


def _crear_espacio_ocupado_propio(home_page, placa=PLACA_PRUEBA):
    """Prepara un espacio ocupado propio (check-in asistido) y lo deja con el
    sidebar de ocupado ya abierto. Igual que en el módulo 9, evita tocar la
    data 'Tiempo Vencido' compartida — acá además hace falta poder LEVANTAR
    REPORTE sobre él, y cualquier espacio ocupado (propio o compartido)
    expone ese botón."""
    home_page.ir_a_lista()
    home_page.hacer_click(home_page.FILTRO_LIBRES)
    codigos = home_page.codigos_de_espacios_visibles()
    assert codigos, "No hay espacios libres para preparar el caso de reporte"
    codigo = codigos[0]
    home_page.abrir_espacio(codigo)
    home_page.hacer_checkin_asistido(placa)
    assert home_page.esperar_fuera_de_libres(codigo), (
        f"El check-in de preparación no sacó a {codigo} de 'Libres' (persistió tras reintentos)"
    )
    assert home_page.ubicar_y_abrir_ocupado(codigo), (
        f"No se encontró {codigo} recién ocupado para levantar un reporte "
        f"(lag de categorización conocido, ver módulo 8)"
    )
    return codigo


@pytest.mark.smoke
def test_10_1_catalogo_de_motivos(sesion_limpia, device_name, login_page, home_page, credenciales):
    """10.1: abrir la pantalla de reporte carga el catálogo de motivos desde
    el backend. Recon (2026-07-16) confirmó 7 motivos reales: 'Fuera de
    tiempo', 'Placa no coincide', 'Mal estacionado', 'Zona prohibida', 'Sin
    registro (no escaneó QR)', 'Obstrucción' y 'Otro' — todos presentes y
    clickables al abrir la pantalla."""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        codigo = _crear_espacio_ocupado_propio(home_page)
        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)

        home_page.assert_visible(home_page.TITULO_TIPO_REPORTE, "No apareció el título 'TIPO DE REPORTE'")
        for motivo, nombre in (
            (home_page.MOTIVO_FUERA_DE_TIEMPO, "Fuera de tiempo"),
            (home_page.MOTIVO_PLACA_NO_COINCIDE, "Placa no coincide"),
            (home_page.MOTIVO_MAL_ESTACIONADO, "Mal estacionado"),
            (home_page.MOTIVO_ZONA_PROHIBIDA, "Zona prohibida"),
            (home_page.MOTIVO_SIN_REGISTRO, "Sin registro (no escaneó QR)"),
            (home_page.MOTIVO_OBSTRUCCION, "Obstrucción"),
            (home_page.MOTIVO_OTRO, "Otro"),
        ):
            home_page.assert_visible(motivo, f"No apareció el motivo '{nombre}' en el catálogo")
    finally:
        try:
            if codigo:
                home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 10.1: {e}")
        _resetear_rotacion_tras_reporte(device_name)


@pytest.mark.smoke
def test_10_2_enviar_sin_fotos_deshabilitado(sesion_limpia, device_name, login_page, home_page, credenciales):
    """10.2: sin capturar ninguna foto, el botón de enviar queda
    deshabilitado. Recon (2026-07-16): mismo patrón `clickable="false"` con
    `enabled="true"` ya documentado para los bloqueos por proximidad
    (módulos 8/9) — no se oculta el botón, se apaga `clickable`."""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        codigo = _crear_espacio_ocupado_propio(home_page)
        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)

        assert home_page.contador_fotos_reporte() == 0, "El contador de fotos no arrancó en 0"
        elems = home_page.buscar_elementos(home_page.BOTON_ENVIAR_REPORTE, timeout=5)
        assert elems, "El botón de enviar no está presente con 0 fotos"
        assert elems[0].get_attribute("clickable") == "false", (
            "El botón de enviar sigue clickable con 0 fotos (se esperaba deshabilitado)"
        )
    finally:
        try:
            if codigo:
                home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 10.2: {e}")
        _resetear_rotacion_tras_reporte(device_name)


@pytest.mark.smoke
def test_10_3_una_foto_habilita_envio(sesion_limpia, device_name, login_page, home_page, credenciales):
    """10.3: con 1 foto (motivo y GPS ya están dados por defecto — ver 10.8)
    el botón de enviar se habilita."""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        codigo = _crear_espacio_ocupado_propio(home_page)
        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)
        home_page.assert_visible(
            home_page.TITULO_TIPO_REPORTE,
            "No cargó la pantalla de Reporte tras LEVANTAR REPORTE",
            timeout=20,
        )

        home_page.tomar_foto_reporte()
        assert home_page.contador_fotos_reporte() == 1, "El contador de fotos no llegó a 1 tras capturar"
        elems = home_page.buscar_elementos(home_page.BOTON_ENVIAR_REPORTE, timeout=5)
        assert elems, "El botón de enviar no está presente con 1 foto"
        assert elems[0].get_attribute("clickable") == "true", (
            "El botón de enviar sigue deshabilitado con 1 foto"
        )
    finally:
        try:
            if codigo:
                home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 10.3: {e}")
        _resetear_rotacion_tras_reporte(device_name)


@pytest.mark.smoke
def test_10_4_tope_real_de_fotos(sesion_limpia, device_name, login_page, home_page, credenciales):
    """10.4: el checklist original dice 'máximo 3 fotos', pero el recon
    (2026-07-16) confirmó que este build tiene un tope real de **2** ('Evidencia
    2 de 2 · placa visible' en la guía visual, y el contador deja de subir tras
    la segunda captura) — ver HALLAZGOS.md. Este test valida el comportamiento
    REAL (tope en 2), no el del checklist desactualizado."""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        codigo = _crear_espacio_ocupado_propio(home_page)
        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)
        home_page.assert_visible(
            home_page.TITULO_TIPO_REPORTE,
            "No cargó la pantalla de Reporte tras LEVANTAR REPORTE",
            timeout=20,
        )

        for _ in range(4):
            home_page.tomar_foto_reporte()
        assert home_page.contador_fotos_reporte() == 2, (
            "El contador de fotos no se detuvo en 2 tras 4 intentos de captura "
            "(tope real documentado en HALLAZGOS.md — si esto cambió, actualizar el hallazgo)"
        )
    finally:
        try:
            if codigo:
                home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 10.4: {e}")
        _resetear_rotacion_tras_reporte(device_name)


@pytest.mark.smoke
def test_10_6_10_7_envio_exitoso_y_reporte_duplicado(sesion_limpia, device_name, login_page, home_page, credenciales):
    """10.6 + 10.7 en un solo test (comparten la misma preparación cara —
    crear el espacio ocupado y levantar el primer reporte): tras ENVIAR con
    datos completos, la pantalla regresa al sidebar del espacio (el checklist
    dice 'regresa a Home' — este build regresa un paso más atrás nomás, ver
    HALLAZGOS.md, no bloquea nada). Levantar un SEGUNDO reporte sobre la misma
    ocupación muestra el aviso real confirmado en recon: 'Este cajón ya tiene
    un reporte para su ocupación actual. Puedes levantar otro si es
    necesario.'"""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        codigo = _crear_espacio_ocupado_propio(home_page)
        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)
        home_page.assert_visible(
            home_page.TITULO_TIPO_REPORTE,
            "No cargó la pantalla de Reporte tras LEVANTAR REPORTE",
            timeout=20,
        )
        home_page.tomar_foto_reporte()

        home_page.hacer_click(home_page.BOTON_ENVIAR_REPORTE)
        home_page.esperar_invisible(home_page.BOTON_ENVIAR_REPORTE, timeout=15)
        home_page.assert_visible(
            home_page.BOTON_LEVANTAR_REPORTE,
            "Tras enviar el reporte, no se quedó en el sidebar del espacio ocupado",
            timeout=10,
        )

        # 10.7: segundo reporte sobre la misma ocupación.
        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)
        home_page.assert_visible(
            home_page.AVISO_REPORTE_PREVIO,
            "No apareció el aviso de reporte previo al levantar un segundo reporte "
            "sobre la misma ocupación",
            timeout=10,
        )
    finally:
        try:
            if codigo:
                home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 10.6/10.7: {e}")
        _resetear_rotacion_tras_reporte(device_name)


@pytest.mark.smoke
def test_10_10_enviar_sin_red_no_avanza(sesion_limpia, device_name, login_page, home_page, credenciales):
    """10.10: mismo mecanismo de 3.3/4.7/5.4/8.4 (`svc wifi/data disable`),
    aplicado al botón de enviar el reporte. Chequeo blando (como 4.3/4.6/8.4):
    la señal estable es que el flujo NO avanza (el botón de enviar sigue
    presente, no navegó de vuelta al sidebar)."""
    login_page.login(credenciales["email"], credenciales["password"])
    codigo = None
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        codigo = _crear_espacio_ocupado_propio(home_page)
        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)
        home_page.assert_visible(
            home_page.TITULO_TIPO_REPORTE,
            "No cargó la pantalla de Reporte tras LEVANTAR REPORTE",
            timeout=20,
        )
        home_page.tomar_foto_reporte()

        subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "disable"], capture_output=True, timeout=10)
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "disable"], capture_output=True, timeout=10)
        try:
            home_page.hacer_click(home_page.BOTON_ENVIAR_REPORTE)
            time.sleep(2.5)
            assert home_page.esta_visible(home_page.BOTON_ENVIAR_REPORTE, timeout=3), (
                "El envío de reporte sin red no permaneció en la pantalla de reporte "
                "(¿se coló una respuesta cacheada u offline como si fuera éxito?)"
            )
        finally:
            subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "enable"], capture_output=True, timeout=10)
            subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "enable"], capture_output=True, timeout=10)
            time.sleep(2)

        # Con la red restaurada, completar el envío para no dejar el flujo a
        # medias (mismo criterio de limpieza que 8.4, adaptado: acá sí se
        # reintenta porque enviar el reporte no deja estado ambiguo como un
        # check-in a medias — el espacio sigue ocupado y hay que liberarlo igual).
        home_page.hacer_click(home_page.BOTON_ENVIAR_REPORTE)
        home_page.esperar_invisible(home_page.BOTON_ENVIAR_REPORTE, timeout=15)
    finally:
        try:
            if codigo:
                home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 10.10: {e}")
        _resetear_rotacion_tras_reporte(device_name)


# 10.5 (enviar sin GPS): no automatizado — apagar el GPS en caliente es el
# mismo mecanismo de permiso/servicio que ya demostró backgroundear la app
# (`pm revoke` de ubicación, módulo 5; cámara, módulo 9). Requiere más recon
# para separar la señal real del ruido de un app backgroundeado a medias.
#
# 10.8/10.9 (motivo preseleccionado según estatus del espacio): bloqueado por
# accesibilidad — el recon (2026-07-16) confirmó que ninguno de los 7 motivos
# expone `checked`/`selected` en el árbol (Flutter no lo mapea), mismo tipo de
# limitación que los colores de pines del módulo 6. Señal indirecta: el botón
# de enviar quedó habilitado con 1 foto SIN tocar ningún motivo a mano (10.3),
# lo que sugiere que SÍ hay un motivo preseleccionado por defecto — pero no se
# puede confirmar CUÁL desde accesibilidad. Ver HALLAZGOS.md.
#
# 10.11 (emulador sin cámara física): no aplica tal cual al AVD usado en esta
# suite — la cámara virtual del emulador SÍ produce capturas utilizables (ver
# `tomar_foto_reporte`), a diferencia de lo que asume el checklist. Validar en
# dispositivo real sigue pendiente si Pedro lo considera necesario.
