"""
Test para Home - Medication
Asume que el usuario ya está logueado
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


def test_medicamento_registro_de_toma(driver, home_page):
    """Test Home - scroll to medication and mark as taken"""
    print("\n=== TEST: Home - Medicamento ===")
    
    home_page = volver_inicio(driver, home_page)
    
    # Scroll to bottom completely
    for _ in range(5):
        home_page.scroll_abajo()
        time.sleep(0.5)
    
    time.sleep(1)
    
    # Get all medications
    medicamentos = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[contains(@content-desc, 'mg') or contains(@content-desc, 'mililitros') or contains(@content-desc, 'ml')]")
    print(f"Medicamentos encontrados: {len(medicamentos)}")
    
    # Try each medication until we find one that shows "Tomado" (i.e. no prior registration today)
    btn_tomado = (AppiumBy.XPATH, "//android.widget.ImageView[@content-desc='Tomado']")
    medicamento_encontrado = None
    
    for i, med in enumerate(medicamentos):
        bounds = med.get_attribute("bounds")
        med_locator = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{bounds}']")
        home_page.hacer_click(med_locator)
        print(f"Probando medicamento {i+1}")
        time.sleep(2)
        
        if home_page.esta_visible(btn_tomado, timeout=3):
            medicamento_encontrado = med_locator
            print(f"Medicamento {i+1} tiene opcion Tomado disponible")
            break
        else:
            driver.back()
            time.sleep(1)
            print(f"Medicamento {i+1} ya tiene registro, probando siguiente")
    
    if not medicamento_encontrado:
        print("No se encontro medicamento sin registro previo")
        return
    
    time.sleep(1)
    
    # Click "Tomado" option
    if not home_page.esta_visible(btn_tomado, timeout=3):
        btn_tomado = (AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Tomado')]")
    home_page.hacer_click(btn_tomado)
    print("Click en Tomado")
    time.sleep(1)
    
    # Select random emoji dynamically (find all emoji ImageViews in the container)
    emojis = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[contains(@content-desc, 'emoji') or contains(@content-desc, 'Emoji') or contains(@resource-id, 'emoji')]")
    
    if not emojis:
        # Alternative: find all ImageViews that are children of the emoji container
        # The emoji container typically has multiple ImageViews horizontally
        emojis = driver.find_elements(AppiumBy.XPATH, 
            "//android.view.View[contains(@content-desc, 'Tomado')]//following-sibling::android.widget.ImageView[position() <= 4]")
    
    if not emojis:
        # Last resort: get all ImageViews that could be emojis and pick randomly
        todos_imgs = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView")
        emojis = [img for img in todos_imgs if img.get_attribute("content-desc") in ["1", "2", "3", "4", "5", "6"]]
    
    opcion = 0
    if emojis:
        opcion = random.randint(0, len(emojis) - 1)
        emoji_bounds = emojis[opcion].get_attribute("bounds")
        emoji_locator = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{emoji_bounds}']")
        home_page.hacer_click(emoji_locator)
        print(f"Selecciono emoji {opcion + 1}")
    else:
        print("Advertencia: No se encontraron emojis, omitiendo selección")
    time.sleep(1)
    
    # Enter comment
    comentarios = [
        "Me siento excelente",
        "Me siento bien",
        "Me siento normal",
        "Me siento mal"
    ]
    campo_comentario = (AppiumBy.XPATH, "//android.widget.EditText[@hint='Comentarios (Opcional)']")
    home_page.ingresar_texto(campo_comentario, comentarios[opcion])
    time.sleep(1)
    
    # Click "Registrar toma" in the popup
    btn_registrar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar toma']")
    if not home_page.esta_visible(btn_registrar, timeout=3):
        btn_registrar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar']")
    if not home_page.esta_visible(btn_registrar, timeout=3):
        btn_registrar = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Registrar')]")
    home_page.hacer_click(btn_registrar)
    print("Click en Registrar toma")
    time.sleep(3)
    
    home_page.tomar_screenshot("04_medicamento_registrado")
    
    print("Test completado")