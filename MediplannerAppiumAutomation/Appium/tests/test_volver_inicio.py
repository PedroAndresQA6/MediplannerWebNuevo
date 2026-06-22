"""
Test para volver_inicio - Navegar a la pantalla de Inicio
"""
from utils.navegacion import volver_inicio


def test_volver_inicio(driver, home_page):
    """Test simple: navegar a Inicio y confirmar que se llegó."""
    print("\n=== TEST: Volver a Inicio ===")

    home_page = volver_inicio(driver, home_page)

    home_page.tomar_screenshot("volver_inicio_ok")

    assert home_page.esta_en_inicio(), "No se llegó a la pestaña Inicio"
    print("Test completado - Ahora en Inicio")