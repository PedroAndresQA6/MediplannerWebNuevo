import time
from appium.webdriver.common.appiumby import AppiumBy


def volver_inicio(driver, page_object):
    """Navega de vuelta a la pestaña Inicio (Home).

    Estrategia resiliente: si el tab inferior 'Inicio' es visible, se clickea.
    Si estamos dentro de una sub-pantalla (formulario/detalle) que oculta la barra
    de tabs, se sale con el back de Android (mas fiable que el 'Regresar' in-app)
    hasta que reaparezca el tab, manejando dialogos de descarte que surjan."""
    print("\n[Navegando] Volviendo a Inicio...")

    tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")

    for _ in range(12):
        if page_object.esta_visible(tab_inicio, timeout=2):
            page_object.hacer_click(tab_inicio)
            time.sleep(1)
            print("[Navegando] Ahora en Inicio")
            return page_object
        # Aun no se ve la barra: salir de la sub-pantalla con back de Android
        driver.back()
        time.sleep(0.8)
        for txt in ('Descartar', 'Salir', 'Sí', 'Si', 'Aceptar'):
            dlg = (AppiumBy.XPATH, f"//android.widget.Button[@content-desc='{txt}']")
            if page_object.esta_visible(dlg, timeout=1):
                page_object.hacer_click(dlg)
                time.sleep(0.6)
                break

    print("[Navegando] No se pudo confirmar Inicio")
    return page_object