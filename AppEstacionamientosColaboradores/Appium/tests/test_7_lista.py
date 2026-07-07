import time

import pytest


@pytest.mark.smoke
def test_7_1_filtro_urgencia_solo_vencidos_o_sin_checkin(sesion_limpia, login_page, home_page, credenciales):
    """7.1: recon confirmó el formato real de cada fila
    ('{Estatus}\\n{Código}\\n...') y que 'Urgencia' devuelve filas con estatus
    'Tiempo Vencido' (confirmado con datos reales). El checklist también
    incluye 'sin check-in' como parte de Urgencia, pero no hay dato de ese
    sub-caso en el ambiente de dev hoy — el assert se queda en lo confirmable:
    ninguna fila de Urgencia debería ser 'Libre' ni 'Vigente' (evidencia clara
    de que el filtro no está aplicando)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_URGENCIA)
        filas = home_page.buscar_elementos(
            home_page.fila_espacio("CJ-"), timeout=8
        )
        for fila in filas:
            desc = fila.get_attribute("content-desc") or ""
            assert not desc.startswith("Libre") and not desc.startswith("Vigente"), (
                f"El filtro Urgencia muestra una fila que no es urgente: {desc!r}"
            )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_7_2_filtro_por_vencer(sesion_limpia, login_page, home_page, credenciales):
    """7.2: no hubo ningún espacio 'Por vencer' en los datos de dev durante
    el recon (0 filas), así que el mapeo exacto del texto de estatus no está
    100% confirmado con datos reales — se asume 'Por vencer' por el mismo
    patrón que 'Libre'/'Tiempo Vencido' (el texto de la fila coincide con el
    label del chip). Si este assert falla el día que sí haya datos, es una
    señal real a investigar, no descartarlo como flaky."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_POR_VENCER)
        filas = home_page.buscar_elementos(home_page.fila_espacio("CJ-"), timeout=8)
        for fila in filas:
            desc = fila.get_attribute("content-desc") or ""
            assert desc.startswith("Por vencer"), (
                f"El filtro 'Por vencer' muestra una fila con estatus inesperado: {desc!r}"
            )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_7_3_filtro_vigentes(sesion_limpia, login_page, home_page, credenciales):
    """7.3: mismo criterio que 7.2 (0 filas en el recon, mapeo asumido por
    patrón)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_VIGENTES)
        filas = home_page.buscar_elementos(home_page.fila_espacio("CJ-"), timeout=8)
        for fila in filas:
            desc = fila.get_attribute("content-desc") or ""
            assert desc.startswith("Vigente"), (
                f"El filtro 'Vigentes' muestra una fila con estatus inesperado: {desc!r}"
            )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_7_4_filtro_libres(sesion_limpia, login_page, home_page, credenciales):
    """7.4: CONFIRMADO con datos reales (9 filas, todas 'Libre\\n...')."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert len(codigos) > 0, "El filtro 'Libres' no muestra ningún espacio"
        filas = home_page.buscar_elementos(home_page.fila_espacio("CJ-"), timeout=8)
        for fila in filas:
            desc = fila.get_attribute("content-desc") or ""
            assert desc.startswith("Libre"), (
                f"El filtro 'Libres' muestra una fila que no es libre: {desc!r}"
            )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_7_5_conteo_de_chip_coincide_con_filas_reales(sesion_limpia, login_page, home_page, credenciales):
    """7.5: el checklist pide comparar el conteo del chip contra el mapa,
    pero el mapa no permite contar pines de forma confiable (ver hallazgo del
    módulo 6: content-desc genérico + carga asíncrona). En su lugar se
    valida la consistencia INTERNA de la Vista Lista: el número en el badge
    del chip 'Libres' (p.ej. 'Libres\\n9') debe coincidir con la cantidad
    real de filas que trae ese filtro — sigue siendo una aserción real sobre
    datos que la app podría mostrar mal (badge desincronizado del contenido)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        conteo_badge = home_page.conteo_de_filtro(home_page.FILTRO_LIBRES)
        assert conteo_badge is not None, "No se pudo leer el número del badge del chip 'Libres'"
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert len(codigos) == conteo_badge, (
            f"El badge del chip 'Libres' dice {conteo_badge} pero la lista "
            f"muestra {len(codigos)} espacios"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_7_6_pull_to_refresh_en_lista(sesion_limpia, login_page, home_page, credenciales):
    """7.6: mismo patrón que S6 (smoke), con el ID propio del módulo 7 para
    trazabilidad — chequeo blando, no hay forma de forzar que el backend
    devuelva datos distintos."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        antes = set(home_page.codigos_de_espacios_visibles())

        home_page.scroll_arriba()  # swipe hacia abajo = gesto de pull-to-refresh
        time.sleep(1.5)

        despues = set(home_page.codigos_de_espacios_visibles())
        assert len(despues) > 0, "Tras el pull-to-refresh la lista quedó vacía"
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_7_7_tap_en_fila_abre_sidebar(sesion_limpia, login_page, home_page, credenciales):
    """7.7: usa una fila Libre (garantizada disponible) para verificar que
    tocarla abre el sidebar con acciones — a diferencia del mapa (módulo 6,
    bloqueado), la Vista Lista SÍ abre el sidebar de forma confiable porque
    cada fila tiene un código propio para ubicarla."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert len(codigos) > 0, "No hay espacios libres para probar el tap en fila"
        home_page.abrir_espacio(codigos[0])
        home_page.assert_visible(
            home_page.BOTON_CHECKIN_ASISTIDO,
            "No apareció el sidebar de check-in asistido al tocar una fila libre",
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
@pytest.mark.slow
def test_7_8_como_llegar_con_coordenadas_abre_maps(sesion_limpia, login_page, home_page, credenciales):
    """7.8: CONFIRMADO por recon — 'CÓMO LLEGAR' desde un espacio vencido
    (con coordenadas) lanza un intent nativo que abre
    `com.google.android.apps.maps`. Reactiva nuestra app al final (si no,
    Maps se queda en foreground y el `cerrar_turno` de limpieza fallaría)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_URGENCIA)
        codigos = home_page.codigos_de_espacios_visibles()
        assert len(codigos) > 0, "No hay espacios con Urgencia para probar 'Cómo llegar'"
        home_page.abrir_espacio(codigos[0])
        home_page.hacer_click(home_page.BOTON_COMO_LLEGAR)
        time.sleep(2.5)
        assert home_page.driver.current_package == "com.google.android.apps.maps", (
            f"'CÓMO LLEGAR' no abrió Google Maps (paquete actual: "
            f"{home_page.driver.current_package})"
        )
    finally:
        try:
            home_page.driver.activate_app(home_page.APP_PACKAGE)
            time.sleep(1.5)
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.skip(reason=(
    "7.9 bloqueado: requiere un espacio de prueba real sin coordenadas "
    "registradas en el backend de dev, no garantizado que exista. Confirmar "
    "con Pedro o backend si hay uno reservado para este caso."
))
def test_7_9_como_llegar_sin_coordenadas():
    pass
