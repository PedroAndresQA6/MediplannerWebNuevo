"""Helpers de navegación reutilizables entre tests (equivalente a
navegacion.py de MediplannerAppiumAutomation). Antes de escribir un test
nuevo, revisar si ya existe un helper acá para no duplicar lógica de
navegación."""


def volver_inicio(driver, page_actual):
    """TODO(Pedro): adaptar al botón/tab real de "Inicio" una vez mapeada la
    app. Por ahora hace fallback a back nativo + reactivación si eso sacó la
    app de foreground.

    OJO (lección aprendida en Mediplanner): durante el recon exploratorio NO
    usar `adb shell input keyevent BACK` para navegar — puede sacar la app por
    completo en vez de retroceder una pantalla. Preferir siempre un botón/tab
    visible de la propia app; usar back nativo solo como fallback controlado
    como el de acá, con reactivación automática si falla."""
    page_actual.reactivar_si_salio()
    driver.back()
    page_actual.reactivar_si_salio()
