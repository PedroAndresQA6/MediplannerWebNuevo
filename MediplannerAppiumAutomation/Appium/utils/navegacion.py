import time
from appium.webdriver.common.appiumby import AppiumBy


def volver_inicio(driver, page_object):
    """Navega de vuelta a la pestaña Inicio (Home) usando botón de la app"""
    print("\n[Navegando] Volviendo a Inicio...")
    
    tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")
    
    # Try up to 5 times to get to Inicio
    max_attempts = 5
    for attempt in range(max_attempts):
        if page_object.esta_visible(tab_inicio, timeout=2):
            break
        # Use in-app back button instead of driver.back()
        try:
            btn_back = driver.find_element(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
            if btn_back:
                btn_back.click()
                time.sleep(1)
        except:
            pass
    
    # Final click on Inicio tab
    if page_object.esta_visible(tab_inicio, timeout=2):
        page_object.hacer_click(tab_inicio)
        time.sleep(1)
    
    print("[Navegando] Ahora en Inicio")
    return page_object