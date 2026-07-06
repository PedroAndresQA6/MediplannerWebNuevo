"""
Test para pestaña de Medicinas - Ver lista de medicamentos y detalles
"""
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


def test_medicinas_ver_lista_detalles(driver, home_page):
    """Medicinas: la pantalla carga con sus sub-pestañas; si hay medicamentos
    se abre el detalle del último, si no se valida el estado vacío."""
    print("\n=== TEST: Medicinas - Ver Lista y Detalles ===")

    home_page = volver_inicio(driver, home_page)
    home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5"))

    # La pantalla de Medicamentos debe cargar con sus dos sub-pestañas
    assert home_page.esta_visible(
        (AppiumBy.XPATH, "//*[@content-desc='Medicamentos']"), timeout=5), \
        "No se abrió la pantalla de Medicinas"
    assert home_page.esta_visible(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'Ahora estas tomando')]"), timeout=3), \
        "Falta la sub-pestaña 'Ahora estas tomando'"
    assert home_page.esta_visible(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'Inactivas')]"), timeout=3), \
        "Falta la sub-pestaña 'Inactivas'"
    print("[1] Pantalla Medicinas con sub-pestañas")

    # Si hay medicamentos, abrir el detalle del último; si no, validar el estado vacío.
    # Espera dinámica (no un find único): la lista o el estado vacío pueden tardar
    # en renderizar, sobre todo si el emulador viene lento.
    meds = home_page.buscar_elementos(
        (AppiumBy.XPATH,
         "//android.widget.ImageView[contains(@content-desc, 'mg') "
         "or contains(@content-desc, 'mililitros') or contains(@content-desc, 'ml')]"),
        timeout=6)

    if meds:
        meds[-1].click()
        detalle = home_page.esta_visible(
            (AppiumBy.XPATH, "//*[@content-desc='Medicamento' or contains(@content-desc, 'Indicaciones')]"), timeout=6)
        assert detalle, "Se abrió un medicamento pero no se cargó su detalle"
        print(f"[2] Detalle de medicamento abierto ({len(meds)} en lista)")
        driver.back()
    else:
        vacio = home_page.esta_visible(
            (AppiumBy.XPATH, "//*[contains(@content-desc, 'No hay medicamentos')]"), timeout=6)
        assert vacio, "Sin medicamentos, pero no se mostró el estado vacío esperado"
        print("[2] Estado vacío correcto ('No hay medicamentos para mostrar')")

    home_page.tomar_screenshot("medicinas")
    print("Test de Medicinas completado")
