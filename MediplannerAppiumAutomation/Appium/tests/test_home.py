"""
Test Home - Marcar medicamento como No Tomado
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
    "Lo tomé tarde"
]


def test_home_medicamento_no_tomado(driver, home_page):
    """Test Home - Marcar medicamento como no tomado"""
    print("\n=== TEST: Home - Medicamento No Tomado ===")
    
    home_page = volver_inicio(driver, home_page)
    time.sleep(2)
    
    home_page.tomar_screenshot("00_inicio")
    
    for _ in range(5):
        home_page.scroll_abajo()
        time.sleep(0.5)
    
    time.sleep(1)
    
    medicamentos = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[contains(@content-desc, 'mg') or contains(@content-desc, 'miligramos')]")
    print(f"Medicamentos encontrados: {len(medicamentos)}")
    
    if not medicamentos:
        print("No se encontraron medicamentos")
        return
    
    bounds = medicamentos[-1].get_attribute("bounds")
    medicamento = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{bounds}']")
    home_page.hacer_click(medicamento)
    time.sleep(2)
    
    home_page.tomar_screenshot("01_medicamento_detalle")
    
    btn_no_tomado = (AppiumBy.XPATH, "//android.widget.ImageView[@content-desc='No Tomado']")
    home_page.hacer_click(btn_no_tomado)
    time.sleep(3)
    
    home_page.tomar_screenshot("02_modal_no_tomado")
    
    time.sleep(2)
    campo_comentario = (AppiumBy.XPATH, "//android.widget.EditText[@hint='Comentarios']")
    comentario = random.choice(COMENTARIOS_NO_TOMADO)
    home_page.ingresar_texto(campo_comentario, comentario)
    home_page.ocultar_keyboard()
    time.sleep(1)
    
    home_page.tomar_screenshot("03_comentario_ingresado")
    
    # Click "Aceptar" - 1 second after filling comments
    btn_aceptar = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Aceptar') or contains(@text, 'Aceptar')]")
    if not home_page.esta_visible(btn_aceptar, timeout=3):
        btn_aceptar = (AppiumBy.XPATH, "//android.widget.Button[@resource-id='android:id/button1']")
    if not home_page.esta_visible(btn_aceptar, timeout=3):
        btn_aceptar = (AppiumBy.XPATH, "//android.view.View[@content-desc='Aceptar']")
    home_page.hacer_click(btn_aceptar)
    time.sleep(3)
    
    home_page.tomar_screenshot("04_medicamento_registrado")
    
    print(f"Medicamento marcado como NO TOMADO: {comentario}")
    print("Test completado")