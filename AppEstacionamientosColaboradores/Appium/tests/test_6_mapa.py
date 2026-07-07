import time

import pytest


def _esperar_marcadores_estables(home_page, intentos=8, espera=1.5):
    """Los marcadores del mapa cargan de forma asíncrona (confirmado por
    recon: 1 marcador a los ~2s, 11 a los ~3.5s) — sondear hasta que el
    conteo se repita dos veces seguidas antes de usarlo en una aserción."""
    anterior = -1
    for _ in range(intentos):
        actual = home_page.contar_marcadores_mapa()
        if actual == anterior and actual > 0:
            return actual
        anterior = actual
        time.sleep(espera)
    return anterior


@pytest.mark.skip(reason=(
    "6.1 bloqueado: los pines de Google Maps no exponen su estatus (color) "
    "por accesibilidad — todos comparten el content-desc genérico 'Marcador "
    "de mapa' (ver HomePage.MARCADOR_MAPA). Verificar el color real "
    "requeriría análisis de píxeles sobre un screenshot, que esta suite no "
    "hace hoy. Evaluar con Pedro si vale la pena esa inversión o si alcanza "
    "con validar los estatus por Vista Lista (donde sí hay texto)."
))
def test_6_1_pines_por_estatus():
    pass


@pytest.mark.skip(reason=(
    "6.2 bloqueado: misma limitación que 6.1 (colores no legibles por "
    "accesibilidad). El texto de la leyenda sí se puede leer (ver "
    "recon: 'Libre'/'Vigente'/'Tiempo excedido'), pero comparar que el "
    "COLOR coincide con los pines reales requiere lectura de píxeles."
))
def test_6_2_leyenda_de_colores():
    pass


@pytest.mark.skip(reason=(
    "6.3 bloqueado: 4 intentos de recon (click directo, click tras esperar "
    "estabilización, tap por coordenadas con bounds frescos) no lograron "
    "reproducir de forma confiable que tocar un marcador abra el sidebar — "
    "en varios intentos el toque no tuvo efecto visible. Los marcadores de "
    "Google Maps son vistas recicladas y pueden requerir un mecanismo "
    "distinto (p.ej. tap nativo con más espera post-idle, o un zoom previo "
    "para separar pines superpuestos). Retomar con más tiempo dedicado antes "
    "de escribir el assert — ver intentos documentados en CONTEXTO.md."
))
def test_6_3_seleccionar_pin_abre_sidebar():
    pass


@pytest.mark.smoke
def test_6_4_busqueda_no_rompe_el_mapa(sesion_limpia, login_page, home_page, credenciales):
    """6.4: chequeo acotado a lo verificable de forma confiable — escribir en
    el buscador no debe romper la pantalla (el mapa sigue mostrando
    marcadores). No se afirma un conteo exacto esperado: el conteo de
    marcadores es asíncrono/ruidoso (ver `_esperar_marcadores_estables`) y no
    hay forma de saber por accesibilidad cuántos códigos deberían matchear
    'CJ-1' de antemano."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_mapa()
        _esperar_marcadores_estables(home_page)
        home_page.ingresar_texto(home_page.CAMPO_BUSCAR_ESPACIO, "CJ-1")
        time.sleep(2)
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=5), (
            "El mapa parece haberse roto tras escribir en el buscador"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_6_5_ocultar_libres_es_reversible(sesion_limpia, login_page, home_page, credenciales):
    """6.5: chequeo acotado — activar/desactivar el toggle no debe romper el
    mapa. No se verifica que los pines libres específicamente desaparezcan
    (mismo límite de accesibilidad que 6.1: no hay forma de identificar el
    estatus de un marcador individual), solo que la pantalla sigue
    respondiendo después de ambos toques."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_mapa()
        _esperar_marcadores_estables(home_page)
        home_page.hacer_click(home_page.TOGGLE_OCULTAR_LIBRES)
        time.sleep(2)
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=5), (
            "El mapa no responde tras activar 'Ocultar libres'"
        )
        home_page.hacer_click(home_page.TOGGLE_OCULTAR_LIBRES)
        time.sleep(2)
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=5), (
            "El mapa no responde tras desactivar 'Ocultar libres'"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_6_6_filtro_por_estatus_disponible(sesion_limpia, login_page, home_page, credenciales):
    """6.6: recon confirmó el diálogo de Filtros (sección 'Estatus' con
    Libre/Vigente/Por vencer/Vencido, todos `Button`). Como esos botones no
    exponen estado `checked` por accesibilidad, el test valida que el
    diálogo abre con las 4 opciones presentes, que tocar una no rompe nada,
    y que el backdrop 'Sombreado' lo cierra — no que el filtrado real
    coincida (eso requeriría leer el estatus de cada pin, bloqueado en 6.1)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.hacer_click(home_page.BOTON_FILTROS)
        home_page.assert_visible(home_page.FILTRO_ESTATUS_LIBRE, "No aparece el filtro de estatus 'Libre'")
        home_page.assert_visible(home_page.FILTRO_ESTATUS_VIGENTE, "No aparece el filtro de estatus 'Vigente'")
        home_page.assert_visible(home_page.FILTRO_ESTATUS_POR_VENCER, "No aparece el filtro de estatus 'Por vencer'")
        home_page.assert_visible(home_page.FILTRO_ESTATUS_VENCIDO, "No aparece el filtro de estatus 'Vencido'")
        home_page.hacer_click(home_page.FILTRO_ESTATUS_LIBRE)
        home_page.hacer_click(home_page.CERRAR_DIALOGO_FILTROS)
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=10), (
            "El diálogo de Filtros no se cerró (o rompió el Home) tras tocar el backdrop"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_6_7_filtro_por_tipo_de_vehiculo_disponible(sesion_limpia, login_page, home_page, credenciales):
    """6.7: mismo criterio que 6.6, para la sección 'Tipo de vehículo'
    (Civil/Discapacitados/Zona de Carga). El checklist menciona un botón
    'Limpiar' que restaura todo — no apareció en el recon de este diálogo
    (ver CONTEXTO.md); si no existe en este build, es un hallazgo a
    confirmar, no un selector mal escrito."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.hacer_click(home_page.BOTON_FILTROS)
        home_page.assert_visible(home_page.FILTRO_TIPO_CIVIL, "No aparece el filtro de tipo 'Civil'")
        home_page.assert_visible(home_page.FILTRO_TIPO_DISCAPACITADOS, "No aparece el filtro de tipo 'Discapacitados'")
        home_page.assert_visible(home_page.FILTRO_TIPO_ZONA_CARGA, "No aparece el filtro de tipo 'Zona de Carga'")
        home_page.hacer_click(home_page.FILTRO_TIPO_CIVIL)
        home_page.hacer_click(home_page.CERRAR_DIALOGO_FILTROS)
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=10), (
            "El diálogo de Filtros no se cerró (o rompió el Home) tras tocar el backdrop"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.skip(reason=(
    "6.8 bloqueado: depende de poder seleccionar un pin específico primero "
    "(6.3, bloqueado)."
))
def test_6_8_filtro_oculta_seleccion_activa():
    pass


@pytest.mark.smoke
def test_6_9_cambio_mapa_lista_no_rompe_contexto(sesion_limpia, login_page, home_page, credenciales):
    """6.9: caso de bajo riesgo — alternar el segmento Mapa/Lista varias
    veces no debe romper la pantalla."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        assert home_page.esta_visible(home_page.FILTRO_LIBRES, timeout=10), "La Vista Lista no cargó"
        home_page.ir_a_mapa()
        assert home_page.esta_visible(home_page.INDICADOR_HOME, timeout=10), "La Vista Mapa no cargó tras volver"
        home_page.ir_a_lista()
        assert home_page.esta_visible(home_page.FILTRO_LIBRES, timeout=10), (
            "La Vista Lista no volvió a cargar en el segundo cambio de segmento"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.skip(reason=(
    "6.10 bloqueado: no se encontró un botón de 'centrar ubicación' mapeado "
    "en los dumps de recon tomados hoy sobre la Vista Mapa. Puede requerir "
    "un estado específico (mapa desplazado lejos del operador) para que el "
    "botón aparezca, o no estar implementado en este build. Retomar con "
    "recon dedicado."
))
def test_6_10_centrar_en_ubicacion():
    pass


@pytest.mark.skip(reason=(
    "6.11 bloqueado: depende de que exista un espacio de prueba sin "
    "coordenadas en los datos de dev, no garantizado. Confirmar con Pedro o "
    "backend si hay uno reservado para este caso antes de automatizar."
))
def test_6_11_espacio_sin_coordenadas():
    pass


@pytest.mark.skip(reason=(
    "6.12 bloqueado: combina cold start + sin red + caché previo (similar a "
    "3.1+3.3 combinados) — requiere su propia sesión de recon dedicada para "
    "confirmar qué queda cacheado y cómo se ve. No abordado todavía."
))
def test_6_12_carga_offline_con_cache():
    pass
