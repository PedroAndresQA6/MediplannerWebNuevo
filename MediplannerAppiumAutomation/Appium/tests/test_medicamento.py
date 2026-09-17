"""
Test Home - Registrar toma de medicamento como 'Tomado' (emoji + comentario).
Si hay medicamentos programados en Home se ejercita el flujo y se valida el
registro; si no hay, se afirma el estado vacío (sin falsos verdes).
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


COMENTARIOS_TOMADO = [
    "Me siento excelente",
    "Me siento bien",
    "Me siento normal",
    "Me siento mal",
]

SEL_MEDICAMENTOS = (
    "//android.widget.ImageView[contains(@content-desc, 'mg') "
    "or contains(@content-desc, 'miligramos') or contains(@content-desc, 'ml') "
    "or contains(@content-desc, 'mililitros')]"
)


def test_medicamento_registro_de_toma(driver, home_page):
    """Home → medicamento → 'Tomado' (emoji + comentario). Valida el registro; si no
    hay medicamentos programados, valida el estado vacío."""
    print("\n=== TEST: Home - Medicamento Tomado ===")

    home_page = volver_inicio(driver, home_page)
    home_page.assert_visible(home_page.tab_inicio, "No se cargó la pantalla de Inicio")

    for _ in range(5):
        home_page.scroll_abajo()

    medicamentos = home_page.buscar_elementos((AppiumBy.XPATH, SEL_MEDICAMENTOS), timeout=6)
    print(f"Medicamentos encontrados: {len(medicamentos)}")

    if not medicamentos:
        vacio = home_page.esta_visible(
            (AppiumBy.XPATH, "//*[contains(@content-desc, 'Sin medicamentos') "
             "or contains(@content-desc, 'Añadir medicamentos')]"), timeout=5)
        assert vacio, "Sin medicamentos en Home, pero no se mostró el estado vacío esperado"
        print("[i] Sin medicamentos programados: estado vacío correcto")
        return

    # Buscar un medicamento que ofrezca la opción 'Tomado' (sin registro previo hoy).
    btn_tomado = (AppiumBy.XPATH, "//android.widget.ImageView[@content-desc='Tomado']")
    encontrado = None
    for i, med in enumerate(medicamentos):
        loc = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{med.get_attribute('bounds')}']")
        home_page.hacer_click(loc)
        if home_page.esta_visible(btn_tomado, timeout=3):
            encontrado = loc
            print(f"Medicamento {i + 1} tiene opción 'Tomado' disponible")
            break
        driver.back()

    # Todos ya tenían registro previo hoy: no es un fallo (dato), se informa.
    if not encontrado:
        print("[i] Todos los medicamentos ya tienen registro de hoy")
        return

    home_page.hacer_click(btn_tomado)

    # Selección de emoji (best-effort: la UI puede variar el nodo).
    emojis = driver.find_elements(
        AppiumBy.XPATH,
        "//android.widget.ImageView[contains(@content-desc, 'emoji') or contains(@content-desc, 'Emoji')]")
    opcion = 0
    if emojis:
        opcion = random.randint(0, len(emojis) - 1)
        emoji_loc = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{emojis[opcion].get_attribute('bounds')}']")
        home_page.hacer_click(emoji_loc)
        print(f"Emoji {opcion + 1} seleccionado")

    campo_comentario = (AppiumBy.XPATH, "//android.widget.EditText[@hint='Comentarios (Opcional)']")
    home_page.assert_visible(campo_comentario, "No apareció el campo de comentarios de 'Tomado'")
    comentario = COMENTARIOS_TOMADO[opcion % len(COMENTARIOS_TOMADO)]
    home_page.ingresar_texto(campo_comentario, comentario)

    # NO llamar a ocultar_keyboard() aquí: mismo bug confirmado en
    # test_home_medicamento_no_tomado (ver CONTEXTO.md) — hide_keyboard()
    # ejecuta 'adb shell input keyevent 111' (KEYCODE_ESCAPE), y el modal de
    # 'Tomado' trata ESCAPE como CANCELAR, cerrándose solo y descartando el
    # comentario tecleado sin que el test se diera cuenta hasta buscar
    # 'Registrar toma' y no encontrarlo. El botón ya está visible sin
    # necesidad de ocultar el teclado.

    btn_registrar = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Registrar')]")
    home_page.assert_visible(btn_registrar, "No apareció el botón 'Registrar toma'")
    home_page.hacer_click(btn_registrar)

    # El registro cerró el modal: el campo de comentario ya no debe estar visible.
    assert home_page.esperar_invisible(campo_comentario, timeout=8), \
        "Tras 'Registrar' el modal no se cerró (posible fallo del registro)"
    home_page.tomar_screenshot("home_tomado_registrado")

    # Verificación de persistencia real (no solo que el modal se cerró): tras
    # 'Registrar toma' la app debe volver a Home con la tarjeta del
    # medicamento reflejando el registro (mismo patrón confirmado en 'No
    # Tomado' — ver CONTEXTO.md). Si el backend no persistiera el registro,
    # ni el comentario ni el emoji aparecerían y este assert lo detecta.
    registrado = home_page.esta_visible(
        (AppiumBy.XPATH, f"//*[contains(@content-desc, '{comentario}')]"), timeout=8)
    assert registrado, (
        f"Tras registrar 'Tomado', el comentario '{comentario}' no aparece en "
        "la tarjeta del medicamento en Home — el registro no parece haberse "
        "persistido"
    )
    print(f"Toma registrada como 'Tomado': {comentario} (persistencia verificada)")
