import subprocess
import time

import pytest

PLACA_PRUEBA = "TEST-008"


@pytest.mark.smoke
def test_8_1_fuera_de_proximidad_bloquea_checkin(sesion_limpia, gps, login_page, home_page, credenciales):
    """8.1: a más de 50 m del espacio, el sidebar de check-in muestra el
    banner de advertencia de proximidad y bloquea la acción. Confirmado en
    recon (2026-07-09): el banner reaparece con el texto real "Estás a X m
    del espacio" + "...debes estar a 50 m o menos..." (X se actualiza en
    vivo), y el botón "Check-In Asistido" queda con el atributo
    `clickable="false"` aunque `enabled` sigue en "true" — por eso el chequeo
    lee `clickable` directo (ver nota en HomePage.BANNER_FUERA_PROXIMIDAD)."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para probar proximidad"
        codigo = codigos[0]

        home_page.abrir_espacio(codigo)
        gps.alejar()

        home_page.assert_visible(
            home_page.BANNER_FUERA_PROXIMIDAD,
            "No apareció el banner de 'fuera de proximidad' al alejarse >50m del espacio",
            timeout=10,
        )
        elems = home_page.buscar_elementos(home_page.BOTON_CHECKIN_ASISTIDO, timeout=5)
        assert elems, (
            "El botón 'Check-In Asistido' desapareció al alejarse (se esperaba "
            "que quedara visible pero bloqueado, no oculto)"
        )
        assert elems[0].get_attribute("clickable") == "false", (
            "El botón 'Check-In Asistido' sigue clickable estando a >50m del espacio"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_8_2_placa_vacia_no_avanza(sesion_limpia, login_page, home_page, credenciales):
    """8.2: recon (2026-07-09) confirmó que tocar 'Check-In Asistido' con la
    placa vacía no muestra ningún mensaje capturable en el árbol de
    accesibilidad (ni inline ni como nodo `live-region`, a diferencia de los
    campos de Login en el módulo 4) — el dump antes/después del tap salió
    idéntico, probablemente un Toast transitorio (mismo caso que 4.3/4.6). La
    señal estable y verificable es que el flujo NO avanza a la pantalla de
    confirmación."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para probar el check-in"
        codigo = codigos[0]

        home_page.abrir_espacio(codigo)
        home_page.hacer_click(home_page.BOTON_CHECKIN_ASISTIDO)
        time.sleep(1.5)
        assert not home_page.esta_visible(home_page.BOTON_CONFIRMAR_CHECKIN, timeout=3), (
            "Con la placa vacía, el flujo avanzó a la pantalla de confirmación "
            "de check-in (se esperaba que la validación lo bloqueara)"
        )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
@pytest.mark.slow
def test_8_3_flujo_completo_checkin_asistido(sesion_limpia, gps, login_page, home_page, credenciales):
    """8.3: mismo flujo de punta a punta que S4 (tests/test_smoke.py),
    duplicado con su propio ID de checklist para trazabilidad 1 a 1 (decisión
    documentada en CONTEXTO.md: "decidir si 8.3 lo referencia/reusa o lo
    duplica con su propio ID" — se optó por duplicar).

    Assert fuerte = la desaparición del espacio de 'Libres' (equivale a
    "espacio deja de estar libre / pasa a ocupado" del checklist) + el panel
    de confirmación cerrado (lo garantiza `hacer_checkin_asistido`, que espera
    a que CONFIRMAR desaparezca). Hallazgo 2026-07-09: el checklist dice "pasa
    a vigente", pero en dev un espacio recién chequeado NO cae de forma
    confiable en el filtro/badge 'Vigentes' — aparece con lag y a veces bajo
    'Por vencer'/'Urgencia' (misma inconsistencia de categorización por filtro
    ya documentada en el módulo 7). Por eso NO se asserta un filtro específico;
    la liberación de limpieza busca el espacio en TODOS los filtros de ocupado
    con reintento, y es best-effort (log-and-continue): si no lo encuentra,
    avisa pero no tumba el test — el objetivo (verificar el flujo de check-in)
    ya se cumplió con el assert fuerte."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos_antes = home_page.codigos_de_espacios_visibles()
        assert codigos_antes, "No hay espacios libres para probar el check-in"
        codigo = codigos_antes[0]

        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido(PLACA_PRUEBA)

        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        # Hallazgo 2026-07-09 (corrida de confirmación del módulo 8): la
        # desaparición de 'Libres' no siempre es instantánea al volver a la
        # Lista pese a que `hacer_checkin_asistido` ya esperó a que el backend
        # cierre el panel de confirmación — mismo lag de categorización que
        # `liberar_por_codigo` ya maneja del lado de ocupado. `esperar_fuera_de_libres`
        # reintenta en vez de un solo chequeo, para no declarar un falso "bug" por
        # timing puro (factorizado en home_page.py, reusado también en el módulo 9).
        assert home_page.esperar_fuera_de_libres(codigo), (
            f"El espacio {codigo} sigue apareciendo en 'Libres' tras el check-in asistido "
            f"(persistió tras reintentos con espera, no es solo timing)"
        )

        # Limpieza best-effort: activar todos los filtros de ocupado (chips
        # acumulativos, módulo 7) y reintentar por el lag de categorización.
        if not home_page.liberar_por_codigo(codigo):
            home_page.logger.warning(
                f"No se pudo ubicar {codigo} en los filtros de ocupado para liberarlo "
                f"(lag de categorización conocido). Queda ocupado en dev — liberar a mano."
            )
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_8_4_checkin_sin_red_no_avanza(sesion_limpia, device_name, login_page, home_page, credenciales):
    """8.4: mismo mecanismo de 3.3/4.7/5.4 (svc wifi/data disable), aplicado
    en el paso de CONFIRMAR. Recon (2026-07-09) confirmó que sin red el panel
    de confirmación se queda exactamente igual (ni cierra ni avanza) — mismo
    criterio de chequeo blando que 4.3/4.6/4.7 sobre el toast de error (no
    capturable en el árbol de accesibilidad). Al final, con la red ya
    restaurada, se cancela con 'CORREGIR' en vez de reintentar CONFIRMAR, para
    no dejar un check-in a medias creado en el backend."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para probar el check-in"
        codigo = codigos[0]

        home_page.abrir_espacio(codigo)
        home_page.ingresar_texto(home_page.CAMPO_PLACA_CHECKIN, PLACA_PRUEBA)
        home_page.hacer_click(home_page.BOTON_CHECKIN_ASISTIDO)
        home_page.esperar_elemento_visible(home_page.BOTON_CONFIRMAR_CHECKIN)

        subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "disable"], capture_output=True, timeout=10)
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "disable"], capture_output=True, timeout=10)
        try:
            home_page.hacer_click(home_page.BOTON_CONFIRMAR_CHECKIN)
            time.sleep(2.5)
            assert home_page.esta_visible(home_page.BOTON_CONFIRMAR_CHECKIN, timeout=3), (
                "El check-in sin red no permaneció en la pantalla de confirmación "
                "(¿se coló una respuesta cacheada u offline como si fuera éxito?)"
            )
        finally:
            subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "enable"], capture_output=True, timeout=10)
            subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "enable"], capture_output=True, timeout=10)
            time.sleep(2)

        home_page.hacer_click(home_page.BOTON_CORREGIR_CHECKIN)
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")
