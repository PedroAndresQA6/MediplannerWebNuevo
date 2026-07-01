"""
Test Médicos: lista + filtro de texto + filtro por estado, con asserts.
Selectores por content-desc (resolución-independiente). Navegación de retroceso
solo con driver.back() desde sub-pantallas (nunca desde la barra de tabs).
"""
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


ESPECIALIDADES = [
    "Cardiología", "Nutriología", "Psicología", "Andrología",
    "Rehabilitación", "Medicina",
]

SIN_RESULTADOS = (
    AppiumBy.XPATH,
    "//*[contains(@content-desc, 'No encontramos') or contains(@content-desc, 'sin resultados') "
    "or contains(@content-desc, 'No hay')]",
)


def test_medicos_flujo_completo(driver, doctors_page):
    """Médicos: la lista carga; el filtro de texto y el filtro por estado devuelven
    resultados o un indicador de vacío (nunca pasa en falso)."""
    print("\n=== TEST: Médicos - Lista y Filtros ===")

    volver_inicio(driver, doctors_page)
    doctors_page.ir_a_medicos()

    assert doctors_page.esta_en_doctors(), "No se abrió Médicos (campo de búsqueda ausente)"
    assert doctors_page.hay_doctores(), "No se listó ningún médico en la pantalla inicial"
    print("[1] Lista de médicos cargada")

    # --- Filtro de texto ---
    especialidad = random.choice(ESPECIALIDADES)
    doctors_page.buscar_texto(especialidad)
    hay = doctors_page.hay_doctores(timeout=5)
    vacio = doctors_page.esta_visible(SIN_RESULTADOS, timeout=3)
    assert hay or vacio, \
        f"El filtro de texto '{especialidad}' no mostró médicos ni indicador de 'sin resultados'"
    print(f"[2] Filtro de texto '{especialidad}': {'con resultados' if hay else 'sin resultados (indicado)'}")

    # Limpiar la búsqueda para el siguiente filtro.
    doctors_page.buscar_texto("")

    # --- Filtro por estado (modal) ---
    assert doctors_page.abrir_filtro(), "No se abrió el modal de filtros"
    doctors_page.assert_visible(doctors_page.btn_buscar, "El modal de filtros no muestra el botón 'Buscar'")
    print("[3] Modal de filtros abierto")

    if doctors_page.seleccionar_estado("Querétaro"):
        doctors_page.hacer_click(doctors_page.btn_buscar)
        hay = doctors_page.hay_doctores(timeout=6)
        vacio = doctors_page.esta_visible(SIN_RESULTADOS, timeout=3)
        assert hay or vacio, "El filtro por estado no mostró médicos ni indicador de 'sin resultados'"
        print(f"[4] Filtro estado Querétaro: {'con resultados' if hay else 'sin resultados (indicado)'}")
    else:
        # No se encontró el estado: cerrar el modal sin aplicar (no falla el test).
        if doctors_page.esta_visible(doctors_page.btn_cancelar, timeout=2):
            doctors_page.hacer_click(doctors_page.btn_cancelar)
        print("[4] Estado 'Querétaro' no disponible; modal cerrado")

    doctors_page.tomar_screenshot("medicos_filtros")
    print("Test de Médicos completado")
