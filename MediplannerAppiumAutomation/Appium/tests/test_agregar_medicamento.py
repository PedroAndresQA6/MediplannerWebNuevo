"""
Test: alta de medicamento personal desde la pestaña Medicinas.
Flujo completo con asserts en cada paso (sin falsos verdes) y duración corta
(1 día) por convención del proyecto. Reutiliza el helper agregar_medicamento.
"""
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.medicamentos import agregar_medicamento, NOMBRES_BUSQUEDA
from utils.navegacion import volver_inicio

TAB_MEDICINAS = (AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5")
TAB_INACTIVAS = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Inactivas')]")
# 'gramo'/'litro' cubren singular y plural (miligramo/miligramos,
# mililitro/mililitros) sin depender de cuál use la app para una dosis de 1.
SEL_MEDICAMENTOS = (AppiumBy.XPATH,
    "//android.widget.ImageView[contains(@content-desc, 'mg') "
    "or contains(@content-desc, 'gramo') or contains(@content-desc, 'litro')]")


def _listar_medicamentos(home_page):
    """Devuelve el conjunto de content-desc de todos los medicamentos visibles
    en Medicinas (pestañas 'Ahora estás tomando' + 'Inactivas'), recorriendo
    cada una con scroll completo (la lista virtualiza filas)."""
    vistos = set()
    tabs = [None]
    if home_page.esta_visible(TAB_INACTIVAS, timeout=2):
        tabs.append(TAB_INACTIVAS)
    for tab in tabs:
        if tab:
            home_page.hacer_click(tab)
        for _ in range(6):
            for m in home_page.buscar_elementos(SEL_MEDICAMENTOS, timeout=6):
                vistos.add(m.get_attribute("content-desc") or "")
            home_page.scroll_abajo()
    return vistos


def test_agregar_medicamento_personal(driver, home_page):
    """Alta completa de un medicamento; valida que cada paso del asistente aparece
    y que al finalizar se regresa a Home. Además verifica que la lista de
    Medicinas realmente ganó un medicamento nuevo — antes el test solo
    comprobaba que `agregar_medicamento()` no lanzó excepción, sin confirmar
    que el alta se persistió.

    Nota: se compara por diferencia de conjuntos (antes/después), NO por el
    nombre buscado — `agregar_medicamento()` documenta que el catálogo puede
    seleccionar un medicamento cuyo nombre real difiere del término buscado
    (confirmado contra la app real: buscar 'Napr' puede resultar en un
    producto de marca sin relación textual con 'Naproxeno')."""
    print("\n=== TEST: Agregar Medicamento Personal ===")

    home_page = volver_inicio(driver, home_page)
    home_page.hacer_click(TAB_MEDICINAS)
    antes = _listar_medicamentos(home_page)
    print(f"Medicamentos en Medicinas antes del alta: {len(antes)}")

    nombre = random.choice(NOMBRES_BUSQUEDA)
    print(f"Buscando: {nombre}")
    agregar_medicamento(driver, home_page, nombre)
    print("Asistente completado (regresó a Home)")

    home_page = volver_inicio(driver, home_page)
    home_page.hacer_click(TAB_MEDICINAS)
    despues = _listar_medicamentos(home_page)
    print(f"Medicamentos en Medicinas después del alta: {len(despues)}")

    nuevos = despues - antes
    assert nuevos, (
        f"Se completó el alta de '{nombre}' pero no apareció ningún medicamento "
        f"nuevo en Medicinas (antes={len(antes)}, después={len(despues)}) — "
        "el alta no parece haberse persistido"
    )
    print(f"Medicamento(s) nuevo(s) verificado(s): {next(iter(nuevos))[:70]}...")
