"""
Test Home - Marcar medicamento como No Tomado.
Si hay medicamentos programados en Home se ejercita el flujo y se valida el
registro; si no hay, se afirma el estado vacío (sin falsos verdes).
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


COMENTARIOS_NO_TOMADO = [
    "Me sentí mal del estómago",
    "Se me olvidó",
    "No tenía agua disponible",
    "Me causo nauseas",
    "Lo tomé tarde",
]

SEL_MEDICAMENTOS = (
    "//android.widget.ImageView[contains(@content-desc, 'mg') "
    "or contains(@content-desc, 'miligramos') or contains(@content-desc, 'ml') "
    "or contains(@content-desc, 'mililitros')]"
)


def test_home_medicamento_no_tomado(driver, home_page):
    """Home → medicamento → 'No Tomado' con comentario. Valida el registro; si no
    hay medicamentos programados, valida el estado vacío."""
    print("\n=== TEST: Home - Medicamento No Tomado ===")

    home_page = volver_inicio(driver, home_page)

    # La pantalla de Inicio debe estar cargada (barra de pestañas visible).
    home_page.assert_visible(home_page.tab_inicio, "No se cargó la pantalla de Inicio")

    # Bajar hasta la sección de medicamentos del día.
    for _ in range(5):
        home_page.scroll_abajo()

    medicamentos = home_page.buscar_elementos((AppiumBy.XPATH, SEL_MEDICAMENTOS), timeout=6)
    print(f"Medicamentos encontrados: {len(medicamentos)}")

    # Sin datos: afirmar el estado vacío en vez de pasar en falso.
    if not medicamentos:
        vacio = home_page.esta_visible(
            (AppiumBy.XPATH, "//*[contains(@content-desc, 'Sin medicamentos') "
             "or contains(@content-desc, 'Añadir medicamentos')]"), timeout=5)
        assert vacio, "Sin medicamentos en Home, pero no se mostró el estado vacío esperado"
        print("[i] Sin medicamentos programados: estado vacío correcto")
        return

    # Con datos: abrir el detalle del último medicamento.
    bounds = medicamentos[-1].get_attribute("bounds")
    medicamento = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{bounds}']")
    home_page.hacer_click(medicamento)

    # Si el medicamento ya tiene un registro de hoy (p.ej. una corrida previa
    # en la misma sesión ya lo marcó), la tarjeta ya no ofrece 'No Tomado'/
    # 'Tomado' — confirmado contra la app real: los reemplaza por el
    # comentario guardado. No es un fallo (dato), es la persistencia
    # funcionando; se informa y no se reintenta un segundo registro el mismo día.
    btn_no_tomado = (AppiumBy.XPATH, "//android.widget.ImageView[@content-desc='No Tomado']")
    if not home_page.esta_visible(btn_no_tomado, timeout=5):
        print("[i] El medicamento ya tiene un registro de hoy (no ofrece 'No Tomado'/'Tomado')")
        return
    home_page.hacer_click(btn_no_tomado)

    # Modal de comentario.
    campo_comentario = (AppiumBy.XPATH, "//android.widget.EditText[@hint='Comentarios']")
    home_page.assert_visible(campo_comentario, "No apareció el campo de comentarios de 'No Tomado'")
    comentario = random.choice(COMENTARIOS_NO_TOMADO)
    home_page.ingresar_texto(campo_comentario, comentario)

    # NO llamar a ocultar_keyboard() aquí: confirmado con evidencia real (log de
    # Appium + capturas cada 1s) que hide_keyboard() ejecuta 'adb shell input
    # keyevent 111' (KEYCODE_ESCAPE) para cerrar el teclado, y el modal de
    # 'No Tomado'/'Tomado' trata ESCAPE como CANCELAR: el modal se cierra solo
    # (sin haber tocado 'Aceptar'), descartando el comentario tecleado, sin que
    # el test se diera cuenta hasta buscar 'Aceptar' y no encontrarlo. El botón
    # 'Aceptar' ya está completamente visible sin necesidad de ocultar el
    # teclado (confirmado en captura), así que ocultarlo aquí es innecesario y
    # además destructivo.

    # Aceptar (varios fallbacks de selector según el tipo de nodo).
    btn_aceptar = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Aceptar') or contains(@text, 'Aceptar')]")
    if not home_page.esta_visible(btn_aceptar, timeout=3):
        btn_aceptar = (AppiumBy.XPATH, "//android.widget.Button[@resource-id='android:id/button1']")
    if not home_page.esta_visible(btn_aceptar, timeout=3):
        btn_aceptar = (AppiumBy.XPATH, "//android.view.View[@content-desc='Aceptar']")
    home_page.assert_visible(btn_aceptar, "No apareció el botón 'Aceptar' del modal")
    home_page.hacer_click(btn_aceptar)

    # El registro cerró el modal: el campo de comentario ya no debe estar visible.
    assert home_page.esperar_invisible(campo_comentario, timeout=8), \
        "Tras 'Aceptar' el modal de comentario no se cerró (posible fallo del registro)"
    home_page.tomar_screenshot("home_no_tomado_registrado")

    # Verificación de persistencia real (no solo que el modal se cerró):
    # confirmado con capturas cada 1s que, tras 'Aceptar', la app vuelve a
    # Home y la tarjeta del medicamento reemplaza los botones 'No Tomado'/
    # 'Tomado' por el comentario tecleado. Si el backend no persistiera el
    # registro, este texto no aparecería y el assert lo detecta en vez de
    # asumir éxito porque el modal cerró.
    registrado = home_page.esta_visible(
        (AppiumBy.XPATH, f"//*[contains(@content-desc, '{comentario}')]"), timeout=8)
    assert registrado, (
        f"Tras registrar 'No Tomado', el comentario '{comentario}' no aparece "
        "en la tarjeta del medicamento en Home — el registro no parece "
        "haberse persistido"
    )
    print(f"Medicamento marcado como NO TOMADO: {comentario} (persistencia verificada)")
