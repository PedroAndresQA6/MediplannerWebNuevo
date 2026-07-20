import os

import pytest

PLACA_COMBO = "TESTCOMBO"  # 9 caracteres: dentro del límite de 10 visto en el formulario web equivalente

# Helpers para la verificación combinada app móvil + portal web
# (AppEstacionamientosColaboradores/Playwright/tests/combinado.checkin-web.spec.ts).
# No son casos del checklist de operador en sí -- son el lado "app" de un
# escenario de punta a punta: ocupar un cajón real desde la app móvil y
# confirmar desde Playwright que el portal admin refleja el cambio (conteo de
# "libres" en /disponibilidad, formulario de Infracciones). Playwright los
# dispara como subproceso (`pytest ... -s`) y parsea la línea `COMBO_...` de
# stdout -- por eso el print es el "output" real de estos tests, no solo un
# log informativo.


@pytest.mark.smoke
def test_combo_ocupar_espacio(sesion_limpia, login_page, home_page, credenciales):
    """Ocupa un espacio libre real (check-in asistido) y DEJA el estado
    ocupado a propósito -- no libera al final. El cierre de turno es seguro
    igual (no afecta la ocupación, son conceptos independientes del backend).
    Imprime `COMBO_CODIGO:<codigo> COMBO_PLACA:<placa>` para que el lado
    Playwright sepa qué cajón/placa verificar en el portal web."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        home_page.ir_a_lista()
        home_page.hacer_click_estable(home_page.FILTRO_LIBRES)
        codigos = home_page.codigos_de_espacios_visibles()
        assert codigos, "No hay espacios libres para el escenario combinado"
        codigo = codigos[0]

        home_page.abrir_espacio(codigo)
        home_page.hacer_checkin_asistido(PLACA_COMBO)

        home_page.ir_a_lista()
        home_page.hacer_click_estable(home_page.FILTRO_LIBRES)
        assert home_page.esperar_fuera_de_libres(codigo), (
            f"El espacio {codigo} sigue en 'Libres' tras el check-in (no se pudo "
            f"confirmar la ocupación antes de verificar del lado web)"
        )
        print(f"COMBO_CODIGO:{codigo} COMBO_PLACA:{PLACA_COMBO}")
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_combo_liberar_espacio(sesion_limpia, login_page, home_page, credenciales):
    """Libera el espacio dejado ocupado por `test_combo_ocupar_espacio`,
    identificado por la variable de entorno `COMBO_CODIGO` (Playwright la
    setea al invocar este test como subproceso, tras terminar sus propias
    verificaciones del lado web)."""
    codigo = os.environ.get("COMBO_CODIGO")
    assert codigo, "Falta la variable de entorno COMBO_CODIGO"

    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras el login"
        liberado = home_page.liberar_por_codigo(codigo, intentos=6, espera_entre=3.0)
        assert liberado, f"No se pudo ubicar/liberar {codigo} en la limpieza del escenario combinado"
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")
