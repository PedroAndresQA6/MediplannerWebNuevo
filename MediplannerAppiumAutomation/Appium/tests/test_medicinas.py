"""
Test para pestaña de Medicinas - Ver lista de medicamentos y detalles
"""
import time
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


def test_medicinas_ver_lista_detalles(driver, home_page):
    """Medicinas: la pantalla carga con sus sub-pestañas; si hay medicamentos
    se abre el detalle del último, si no se valida el estado vacío."""
    print("\n=== TEST: Medicinas - Ver Lista y Detalles ===")

    home_page = volver_inicio(driver, home_page)
    home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5"))
    time.sleep(2)

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

    # Si hay medicamentos, abrir el detalle del último; si no, validar el estado vacío
    meds = driver.find_elements(
        AppiumBy.XPATH,
        "//android.widget.ImageView[contains(@content-desc, 'mg') "
        "or contains(@content-desc, 'mililitros') or contains(@content-desc, 'ml')]")

    if meds:
        loc = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{meds[-1].get_attribute('bounds')}']")
        home_page.hacer_click(loc)
        time.sleep(2.5)
        detalle = home_page.esta_visible(
            (AppiumBy.XPATH, "//*[contains(@content-desc, 'Dosis') or contains(@content-desc, 'Frecuencia') "
             "or contains(@content-desc, 'Duración') or contains(@content-desc, 'Instrucciones')]"), timeout=4)
        assert detalle, "Se abrió un medicamento pero no se cargó su detalle"
        print(f"[2] Detalle de medicamento abierto ({len(meds)} en lista)")
        driver.back(); time.sleep(1)
    else:
        vacio = home_page.esta_visible(
            (AppiumBy.XPATH, "//*[contains(@content-desc, 'No hay medicamentos')]"), timeout=3)
        assert vacio, "Sin medicamentos, pero no se mostró el estado vacío esperado"
        print("[2] Estado vacío correcto ('No hay medicamentos para mostrar')")

    home_page.tomar_screenshot("medicinas")
    print("Test de Medicinas completado")
