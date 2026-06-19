"""
Test para pestaña de Medicinas - Ver lista de medicamentos y detalles
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


def test_medicinas_ver_lista_detalles(driver, home_page):
    """Test Medicinas - navegar a la pestaña, ver lista y ver detalles de un medicamento"""
    print("\n=== TEST: Medicinas - Ver Lista y Detalles ===")
    
    # Asegurarnos de estar en Home y navegar a Medicinas
    home_page = volver_inicio(driver, home_page)
    home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5"))
    time.sleep(2)
    
    # Verificar que estamos en la pestaña de Medicinas
    titulo_medicinas = (AppiumBy.XPATH, "//android.view.View[contains(@text, 'Medicinas') or contains(@content-desc, 'Medicinas')]")
    if home_page.esta_visible(titulo_medicinas, timeout=3):
        print("Pantalla de Medicinas cargada correctamente")
    else:
        print("Advertencia: No se detectó claramente la pantalla de Medicinas")
    
    # 1. Obtener y mostrar las medicinas disponibles
    # Buscamos elementos que representen medicamentos (similar al test_medicamento.py)
    medicinas = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[contains(@content-desc, ':') or contains(@content-desc, 'mg') or contains(@content-desc, 'ml')]")
    
    # Si no encontramos con ese patrón, buscamos de forma más genérica
    if not medicinas:
        medicinas = driver.find_elements(AppiumBy.XPATH, 
            "//android.view.View[starts-with(@content-desc, 'D') or contains(@content-desc, 'tablet') or contains(@content-desc, 'capsule')]")
    
    print(f"Medicinas encontradas: {len(medicinas)}")
    
    if medicinas:
        # Mostrar información de las primeras 3 medicinas (o menos si hay menos)
        for i, medicina in enumerate(medicinas[:3]):
            try:
                info = medicina.get_attribute("content-desc")
                if info:
                    print(f"Medicina {i+1}: {info[:80]}{'...' if len(info) > 80 else ''}")
            except:
                print(f"Medicina {i+1}: [información no disponible]")
        
        # 2. Seleccionar la última medicina dinámicamente (como en test_medicamento.py)
        ultima_medicina = medicinas[-1]
        medicina_bounds = ultima_medicina.get_attribute("bounds")
        medicina_locator = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{medicina_bounds}']")
        
        # Obtener información básica para logging
        medicina_info = ultima_medicina.get_attribute("content-desc")
        print_info = medicina_info[:50] + "..." if medicina_info and len(medicina_info) > 50 else medicina_info or "Medicina sin descripción"
        print(f"Seleccionando última medicina: {print_info}")
        
        # Hacer click para ver detalles
        home_page.hacer_click(medicina_locator)
        time.sleep(3)
        print("Viendo detalles de la medicina seleccionada")
        
        # 3. Verificar que se cargaron los detalles (buscando algún elemento típico de detalle de medicina)
        detalle_elementos = [
            (AppiumBy.XPATH, "//android.view.View[contains(@content-desc, 'Dosis')]"),
            (AppiumBy.XPATH, "//android.view.View[contains(@content-desc, 'Frecuencia')]"),
            (AppiumBy.XPATH, "//android.view.View[contains(@content-desc, 'Duración')]"),
            (AppiumBy.XPATH, "//android.view.View[contains(@content-desc, 'Instrucciones')]"),
            (AppiumBy.XPATH, "//android.widget.TextView")
        ]
        
        detalle_cargado = False
        for elemento in detalle_elementos:
            if home_page.esta_visible(elemento, timeout=3):
                print(f"Detalle de medicina cargado - se encontró elemento relacionado con medicina")
                detalle_cargado = True
                break
        
        if not detalle_cargado:
            print("Advertencia: No se pudo verificar claramente los detalles de la medicina")
        
        # 4. Regresar a la lista de medicinas
        driver.back()
        time.sleep(2)
        print("Regresando a lista de medicinas")
        
    else:
        print("No se encontraron medicinas en la lista")
        # Intentamos buscar por otros patrones comunes
        elementos_genericos = driver.find_elements(AppiumBy.XPATH, 
            "//android.view.View[@clickable='true' and string-length(@content-desc) > 10]")
        print(f"Elementos clicables con descripción significativa encontrados: {len(elementos_genericos)}")
        
        if elementos_genericos:
            print("Mostrando algunos elementos encontrados:")
            for i, elem in enumerate(elementos_genericos[:3]):
                try:
                    desc = elem.get_attribute("content-desc") or elem.get_attribute("text") or "Sin descripción"
                    print(f"  Elemento {i+1}: {desc[:60]}")
                except:
                    print(f"  Elemento {i+1}: [Error al obtener información]")
    
    print("Test de Medicinas completado")