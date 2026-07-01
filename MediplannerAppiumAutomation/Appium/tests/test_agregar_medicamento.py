"""
Test: alta de medicamento personal desde la pestaña Medicinas.
Flujo completo con asserts en cada paso (sin falsos verdes) y duración corta
(1 día) por convención del proyecto. Reutiliza el helper agregar_medicamento.
"""
import random
from utils.medicamentos import agregar_medicamento, NOMBRES_BUSQUEDA


def test_agregar_medicamento_personal(driver, home_page):
    """Alta completa de un medicamento; valida que cada paso del asistente aparece
    y que al finalizar se regresa a Home (medicamento agendado)."""
    print("\n=== TEST: Agregar Medicamento Personal ===")

    nombre = random.choice(NOMBRES_BUSQUEDA)
    print(f"Buscando: {nombre}")

    agregar_medicamento(driver, home_page, nombre)

    print("Medicamento agregado exitosamente (regresó a Home)")
