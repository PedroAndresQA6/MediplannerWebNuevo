import subprocess
import time

import pytest
from appium.webdriver.common.appiumby import AppiumBy

PLACA_PRUEBA = "TEST-009"


def _abrir_un_espacio_ocupado(home_page):
    """Helper de recon (no destructivo): entra a Lista, filtra por Urgencia
    (los 'Tiempo Vencido' compartidos de dev, ya usados como data de solo
    lectura en el módulo 7) y abre el primero. Sirve para 9.1/9.2, que no
    modifican el espacio — evita gastar un check-in propio para un chequeo
    de solo lectura."""
    home_page.ir_a_lista()
    home_page.hacer_click(home_page.FILTRO_URGENCIA)
    codigos = home_page.codigos_de_espacios_visibles()
    assert codigos, "No hay espacios en 'Urgencia' para probar el sidebar de ocupado"
    codigo = codigos[0]
    home_page.abrir_espacio(codigo)
    return codigo


@pytest.mark.smoke
def test_9_1_sidebar_espacio_ocupado(sesion_limpia, login_page, home_page, credenciales):
    """9.1: tocar un espacio vigente/por vencer/vencido abre un sidebar con
    las opciones de Reporte, Historial y Liberar. Recon (2026-07-09) contra
    un espacio 'Tiempo Vencido' compartido confirmó los tres botones reales:
    'LEVANTAR REPORTE', 'VER HISTORIAL DEL ESPACIO' y 'Liberar espacio' (más
    'CÓMO LLEGAR', que ya cubre el módulo 7). Chequeo de solo lectura: no se
    toca ninguno de los tres, solo se confirma que están presentes."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        _abrir_un_espacio_ocupado(home_page)

        home_page.assert_visible(
            home_page.BOTON_LEVANTAR_REPORTE,
            "No apareció 'LEVANTAR REPORTE' en el sidebar de un espacio ocupado",
        )
        home_page.assert_visible(
            home_page.BOTON_VER_HISTORIAL,
            "No apareció 'VER HISTORIAL DEL ESPACIO' en el sidebar de un espacio ocupado",
        )
        home_page.assert_visible(
            home_page.BOTON_LIBERAR_ESPACIO,
            "No apareció 'Liberar espacio' en el sidebar de un espacio ocupado",
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_9_2_ver_historial(sesion_limpia, login_page, home_page, credenciales):
    """9.2: 'Ver historial' abre un sheet con los movimientos del espacio.
    Recon (2026-07-09): título real 'Historial · {código}', filas por
    reservación con el patrón '{PLACA}\\noperador\\nEstatus: {estado}\\n
    Inicio {fecha} · Límite {fecha}'. Se cierra tocando el backdrop
    'Sombreado' (mismo patrón que el diálogo de Filtros del módulo 6, sin
    botón 'Cerrar' propio). El checklist menciona que la segunda apertura es
    más rápida por caché — se mide y se loguea, pero es un chequeo BLANDO
    (no tumba el test): el ambiente ya tiene lentitud intermitente
    documentada (ver CONTEXTO.md) que puede enmascarar una mejora real de
    caché en una corrida puntual."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        codigo = _abrir_un_espacio_ocupado(home_page)

        t0 = time.time()
        home_page.hacer_click(home_page.BOTON_VER_HISTORIAL)
        home_page.assert_visible(
            home_page.HISTORIAL_TITULO,
            "No apareció el sheet de Historial tras tocar 'VER HISTORIAL DEL ESPACIO'",
            timeout=10,
        )
        t_primera = time.time() - t0

        titulo = home_page.buscar_elementos(home_page.HISTORIAL_TITULO, timeout=5)
        assert titulo and codigo in (titulo[0].get_attribute("content-desc") or ""), (
            f"El título del historial no incluye el código del espacio ({codigo})"
        )

        home_page.hacer_click(home_page.CERRAR_HISTORIAL)
        home_page.esperar_invisible(home_page.HISTORIAL_TITULO, timeout=10)
        time.sleep(0.5)

        t0 = time.time()
        home_page.hacer_click(home_page.BOTON_VER_HISTORIAL)
        home_page.assert_visible(home_page.HISTORIAL_TITULO, "No reabrió el historial la segunda vez", timeout=10)
        t_segunda = time.time() - t0

        home_page.logger.info(f"Historial: primera apertura {t_primera:.2f}s, segunda {t_segunda:.2f}s")
        if t_segunda > t_primera:
            home_page.logger.warning(
                f"9.2: la segunda apertura del historial ({t_segunda:.2f}s) no fue más rápida "
                f"que la primera ({t_primera:.2f}s) — el checklist espera una mejora por caché; "
                f"podría deberse a la lentitud intermitente conocida del ambiente, no asertado duro."
            )
        home_page.hacer_click(home_page.CERRAR_HISTORIAL)
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_9_3_liberar_espacio_confirmar(sesion_limpia, login_page, home_page, credenciales):
    """9.3: Liberar → Confirmar (≤50m) devuelve el espacio a Libre. Para no
    tocar la data 'Tiempo Vencido' compartida (usada de solo lectura por
    otros módulos), este test crea su PROPIO espacio ocupado con un check-in
    asistido (mismo patrón que el módulo 8) y lo libera — así el assert
    fuerte es tanto la creación como la liberación del mismo espacio."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para preparar el caso de liberar"
        codigo = codigos[0]

        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido(PLACA_PRUEBA)

        assert home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0), (
            f"No se pudo ubicar y liberar el espacio {codigo} recién ocupado "
            f"(lag de categorización conocido, ver módulo 8) — no se pudo confirmar 9.3"
        )

        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        assert codigo in home_page.codigos_de_espacios_visibles(), (
            f"El espacio {codigo} no volvió a aparecer en 'Libres' tras liberarlo"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
@pytest.mark.xfail(
    reason="BUG confirmado 2026-07-09 (ver HALLAZGOS.md): 'Cancelar' en el diálogo "
    "de liberar espacio libera igual el espacio en el backend — descartado el "
    "falso positivo de filtros acumulativos (se limpia el chip de ocupado activo "
    "antes de chequear 'Libres') y reproducido en dos corridas limpias distintas.",
    strict=True,
)
def test_9_4_liberar_espacio_cancelar(sesion_limpia, login_page, home_page, credenciales):
    """9.4: Liberar → Cancelar debería dejar el espacio sin cambios (sigue
    ocupado) — ese es el comportamiento que este test intenta verificar.
    Mismo patrón que 9.3 (check-in propio para no tocar data compartida),
    pero cancelando el diálogo de confirmación (`liberar_espacio_actual`
    ya soporta `confirmar=False` para esto). Limpieza: libera de verdad al
    final para no dejar el espacio de prueba huérfano en dev.

    Marcado `xfail(strict=True)`: el comportamiento REAL confirmado en recon
    es que 'Cancelar' libera el espacio de todas formas (mismo efecto que
    'Liberar') — ver HALLAZGOS.md. Si algún día se corrige, este test pasa a
    XPASS y `strict=True` lo hace fallar la corrida, señal para actualizar
    este marcador."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para preparar el caso de liberar"
        codigo = codigos[0]

        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido(PLACA_PRUEBA)

        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        assert home_page.esperar_fuera_de_libres(codigo), (
            f"El check-in de preparación no sacó a {codigo} de 'Libres' (persistió tras reintentos)"
        )

        # Reabrir el espacio ya ocupado y cancelar la liberación.
        assert home_page.ubicar_y_abrir_ocupado(codigo), (
            f"No se encontró {codigo} en ningún filtro de ocupado para probar Cancelar "
            f"(lag de categorización conocido, ver módulo 8)"
        )
        home_page.liberar_espacio_actual(confirmar=False)

        # OJO (hallazgo real al escribir este test, 2026-07-09): el filtro de
        # ocupado usado por `ubicar_y_abrir_ocupado` (p.ej. 'Vigentes') queda
        # ACTIVO. Como los chips son acumulativos (módulo 7), activar 'Libres'
        # sin desactivarlo antes muestra la UNIÓN de ambos — y el espacio, que
        # sigue genuinamente ocupado, aparece igual por culpa de 'Vigentes',
        # dando un falso positivo de "se liberó pese a cancelar". Limpiarlo
        # primero evita ese falso positivo (ver `limpiar_filtro_ocupado_activo`).
        home_page.limpiar_filtro_ocupado_activo()
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        assert codigo not in home_page.codigos_de_espacios_visibles(), (
            f"El espacio {codigo} volvió a 'Libres' pese a haber cancelado la liberación"
        )
    finally:
        try:
            home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 9.4: {e}")
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_9_5_liberar_fuera_de_proximidad_bloquea(sesion_limpia, gps, login_page, home_page, credenciales):
    """9.5: a más de 50m, 'Liberar espacio' (y 'LEVANTAR REPORTE') quedan
    bloqueados. Recon (2026-07-09) con un espacio ocupado propio: a
    diferencia del check-in (8.1), acá NO aparece ningún banner de texto de
    proximidad — la única señal es el mismo atributo `clickable="false"` ya
    documentado (mientras `enabled` sigue en 'true'). Se deja constancia de
    esta diferencia para no esperar un banner que no existe en este flujo."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para preparar el caso de liberar"
        codigo = codigos[0]

        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido(PLACA_PRUEBA)

        assert home_page.ubicar_y_abrir_ocupado(codigo), (
            f"No se encontró {codigo} recién ocupado para probar el bloqueo por proximidad "
            f"(lag de categorización conocido, ver módulo 8)"
        )

        gps.alejar()
        time.sleep(2)

        elems_liberar = home_page.buscar_elementos(home_page.BOTON_LIBERAR_ESPACIO, timeout=5)
        assert elems_liberar, "'Liberar espacio' desapareció al alejarse (se esperaba visible pero bloqueado)"
        assert elems_liberar[0].get_attribute("clickable") == "false", (
            "'Liberar espacio' sigue clickable estando a >50m del espacio"
        )

        elems_reporte = home_page.buscar_elementos(home_page.BOTON_LEVANTAR_REPORTE, timeout=5)
        assert elems_reporte, "'LEVANTAR REPORTE' desapareció al alejarse (se esperaba visible pero bloqueado)"
        assert elems_reporte[0].get_attribute("clickable") == "false", (
            "'LEVANTAR REPORTE' sigue clickable estando a >50m del espacio"
        )
    finally:
        try:
            gps.restaurar()
            time.sleep(2)
            home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        except Exception as e:
            home_page.logger.warning(f"No se pudo liberar {codigo} en la limpieza de 9.5: {e}")
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
@pytest.mark.skip(
    reason="Bloqueado (2026-07-09): el flujo SÍ se confirmó manualmente en recon "
    "(revocar permiso de cámara + relanzar la app dispara el diálogo nativo, luego "
    "el diálogo propio 'Permiso de cámara requerido'), pero automatizado dentro de "
    "pytest (revoke + force-stop + am start antes del login de este mismo test) el "
    "diálogo nativo no volvió a aparecer en ninguna corrida — la app parece seguir "
    "considerando el permiso concedido pese a que `dumpsys package` confirma "
    "`granted=false` en ese momento (probablemente un estado de "
    "`permission_handler` cacheado del lado de Flutter que no se sincroniza igual "
    "cuando el proceso se relanza vía Appium/adb en sucesión rápida que cuando se "
    "hace a mano con más tiempo entre pasos). Requiere más recon para automatizar "
    "de forma confiable — no perseguirlo en loop, ver CONTEXTO.md."
)
def test_9_6_reporte_sin_permiso_camara(sesion_limpia, device_name, login_page, home_page, credenciales):
    """9.6: sin permiso de cámara, intentar un reporte muestra el diálogo de
    permiso y NO navega a la pantalla de reporte. Recon (2026-07-09) mapeó el
    flujo completo: 1) revocar el permiso en caliente BACKGROUNDEA la app
    (mismo gotcha que `pm revoke` de ubicación en el módulo 5) — por eso se
    revoca ANTES del login, no a mitad del test; 2) al tocar LEVANTAR
    REPORTE aparece el diálogo NATIVO de Android (fuera del árbol de la
    app); 3) al elegir 'No permitir' ahí, la propia app muestra un segundo
    diálogo EN su árbol de accesibilidad ('Permiso de cámara requerido',
    botones 'Cancelar'/'Abrir configuración'); 4) 'Cancelar' vuelve al
    sidebar sin haber entrado nunca a la pantalla de reporte (que sí se
    mapeó en el recon: tiene 'TIPO DE REPORTE' y 'ENVIAR REPORTE AL
    BACKOFFICE'). Limpieza: re-otorga el permiso al final para no dejarlo
    revocado para el resto de la suite (que asume `autoGrantPermissions`)."""
    # Orden importante: matar el proceso ANTES de revocar (no al revés) para
    # que no quede ningún estado de permiso cacheado en memoria del proceso
    # de Flutter — un `pm revoke` con el proceso ya vivo puede no reflejarse
    # hasta el siguiente check real contra el SO, y esta app parece cachear
    # el resultado de `permission_handler` en vez de reconsultarlo siempre.
    subprocess.run(
        ["adb", "-s", device_name, "shell", "am", "force-stop",
         "com.example.estacionamientos_mobile"],
        capture_output=True, timeout=10,
    )
    subprocess.run(
        ["adb", "-s", device_name, "shell", "pm", "revoke",
         "com.example.estacionamientos_mobile", "android.permission.CAMERA"],
        capture_output=True, timeout=10,
    )
    subprocess.run(
        ["adb", "-s", device_name, "shell", "am", "start", "-n",
         "com.example.estacionamientos_mobile/.MainActivity"],
        capture_output=True, timeout=10,
    )
    time.sleep(3)
    try:
        login_page.login(credenciales["email"], credenciales["password"])
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        _abrir_un_espacio_ocupado(home_page)

        home_page.hacer_click(home_page.BOTON_LEVANTAR_REPORTE)
        assert home_page.denegar_popup_permiso_nativo(timeout=8), (
            "No apareció el popup nativo de permiso de cámara al tocar LEVANTAR REPORTE "
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

        assert not home_page.esta_visible(
            (AppiumBy.XPATH, '//*[@content-desc="TIPO DE REPORTE"]'), timeout=2
        ), (
            "Se encontró 'TIPO DE REPORTE': el flujo navegó a la pantalla de reporte "
            "pese a no tener permiso de cámara"
        )
        home_page.assert_visible(
            home_page.BOTON_LIBERAR_ESPACIO,
            "Tras cancelar el diálogo de permiso, no se quedó en el sidebar del espacio ocupado",
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")
        subprocess.run(
            ["adb", "-s", device_name, "shell", "pm", "grant",
             "com.example.estacionamientos_mobile", "android.permission.CAMERA"],
            capture_output=True, timeout=10,
        )
