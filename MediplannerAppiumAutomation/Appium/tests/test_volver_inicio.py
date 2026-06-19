"""
Test para volver_inicio - Navegar a la pantalla de Inicio
"""
from utils.navegacion import volver_inicio


def test_volver_inicio(driver, home_page):
    """Test simple: navegar a Inicio"""
    print("\n=== TEST: Volver a Inicio ===")
    
    home_page = volver_inicio(driver, home_page)
    
    home_page.tomar_screenshot("volver_inicio_ok")
    
    print("Test completado - Ahora en Inicio")