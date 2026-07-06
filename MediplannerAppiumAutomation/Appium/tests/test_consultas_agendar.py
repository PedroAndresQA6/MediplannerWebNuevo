"""
Test Consultas - Agendar cita.
Flujo: Consultas > Programadas → si no hay cita 'Agendada', agenda una nueva
desde Médicos (primer doctor/tipo/fecha/horario disponibles).
"""
from utils.navegacion import volver_inicio


def test_consultas_agendar_cita(driver, home_page, consultas_page):
    """Consultas > Programadas debe terminar con al menos una cita 'Agendada'.
    Si hubo que agendar una nueva, `agendar_cita()` ya verifica internamente
    que la cita resultante corresponde al doctor elegido (no cualquier cita
    'Agendada' preexistente) — si el backend no persiste la solicitud, ese
    método falla con un mensaje claro en vez de llegar hasta acá."""
    print("\n=== TEST: Consultas - Agendar cita ===")

    home_page = volver_inicio(driver, home_page)
    consultas_page.abrir()
    consultas_page.ir_a_programadas()

    cita = consultas_page.buscar_cita_agendada()
    if cita:
        print("Ya había una cita 'Agendada'; no se crea una duplicada")
    else:
        print("No hay citas agendadas, agendando una nueva desde Médicos...")
        cita = consultas_page.agendar_cita(home_page)
        print(f"Cita agendada y verificada: {cita.get_attribute('content-desc')[:80]}...")

    assert cita is not None, "No se pudo obtener ni crear una cita 'Agendada'"
    print("Test de Consultas - Agendar cita completado")
