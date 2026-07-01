"""
Test para pestaña de Estudios - Ver lista de estudios y detalle
"""
import time
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


def test_estudios_ver_lista_detalles(driver, home_page):
    """Estudios: la pantalla carga, lista estudios (con fecha) y se puede abrir
    el detalle del primero y regresar a la lista."""
    print("\n=== TEST: Estudios - Ver Lista y Detalles ===")

    home_page = volver_inicio(driver, home_page)
    home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Estudios\nPestaña 5 de 5"))
    time.sleep(2)

    assert home_page.esta_visible(
        (AppiumBy.XPATH, "//*[@content-desc='Estudios']"), timeout=5), \
        "No se abrió la pantalla de Estudios"

    # Deben listarse estudios (su content-desc incluye la fecha dd/mm/aaaa)
    estudios = driver.find_elements(AppiumBy.XPATH, "//*[contains(@content-desc, '/202')]")
    assert estudios, "No se listó ningún estudio"
    nombre = (estudios[0].get_attribute("content-desc") or "").split("\n")[0]
    print(f"[1] {len(estudios)} estudios listados; abriendo: {nombre!r}")

    # Abrir el detalle del primer estudio
    estudios[0].click()
    time.sleep(2.5)
    home_page.tomar_screenshot("estudios_detalle")

    # Debe verse la pantalla de detalle: se valida por su CONTENIDO (secciones del
    # detalle), no por un botón de retroceso (cuyo selector cambia con la resolución).
    detalle = home_page.esta_visible(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'Archivos') "
         "or contains(@content-desc, 'Indicaciones') "
         "or contains(@content-desc, 'Interpretaci')]"), timeout=5)
    assert detalle, "No se abrió la pantalla de detalle del estudio"
    print("[2] Detalle del estudio abierto")

    # Regresar y confirmar que la lista vuelve a mostrarse
    driver.back(); time.sleep(1.5)
    estudios2 = driver.find_elements(AppiumBy.XPATH, "//*[contains(@content-desc, '/202')]")
    assert estudios2, "No se regresó a la lista de estudios tras ver el detalle"
    print("[3] Regreso a la lista de estudios OK")
    print("Test de Estudios completado")
