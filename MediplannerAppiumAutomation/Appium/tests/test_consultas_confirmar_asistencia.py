"""
Test Consultas - Confirmar asistencia.
Flujo: obtener una cita 'Agendada' (agendando una nueva si no existe) →
abrirla → Confirmar asistencia → confirmar el popup.
"""
from utils.navegacion import volver_inicio


def test_consultas_confirmar_asistencia(driver, home_page, consultas_page):
    """Confirma la asistencia a una cita 'Agendada'. `confirmar_asistencia()`
    verifica (contra la app real, tras salir y volver a entrar a Programadas)
    que el estado de la cita cambió de 'Agendada' a 'Confirmada'; si el
    backend no persiste la confirmación, falla ahí con un mensaje claro en
    vez de que el test pase solo porque el popup se cerró."""
    print("\n=== TEST: Consultas - Confirmar asistencia ===")

    home_page = volver_inicio(driver, home_page)
    consultas_page.abrir()
    consultas_page.ir_a_programadas()

    cita = consultas_page.buscar_cita_agendada()
    if not cita:
        print("No hay citas agendadas, agendando una nueva desde Médicos...")
        cita = consultas_page.agendar_cita(home_page)

    consultas_page.confirmar_asistencia(cita)
    print("Asistencia confirmada y verificada (estado 'Confirmada' en Programadas)")
    print("Test de Consultas - Confirmar asistencia completado")
