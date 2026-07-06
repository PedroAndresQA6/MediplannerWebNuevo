"""
Test Consultas - Reprogramar cita agendada.
Flujo: obtener una cita 'Agendada' (agendando una nueva si no existe) →
Reprogramar → nueva fecha/horario → Confirmar.
"""
from utils.navegacion import volver_inicio


def test_consultas_reprogramar_cita(driver, home_page, consultas_page):
    """Reprograma una cita 'Agendada' y valida que la fecha/hora realmente
    cambió (verificado contra la app real: `reprogramar()` compara el
    content-desc antes/después tras salir y volver a entrar a Programadas —
    si el backend ignora el reprogramado, falla ahí con un mensaje claro en
    vez de llegar hasta acá)."""
    print("\n=== TEST: Consultas - Reprogramar cita ===")

    home_page = volver_inicio(driver, home_page)
    consultas_page.abrir()
    consultas_page.ir_a_programadas()

    cita = consultas_page.buscar_cita_agendada()
    if not cita:
        print("No hay citas agendadas, agendando una nueva desde Médicos...")
        cita = consultas_page.agendar_cita(home_page)
    desc_original = cita.get_attribute("content-desc")

    nueva_cita = consultas_page.reprogramar(cita)
    assert nueva_cita is not None, "La reprogramación no dejó una cita 'Agendada'"
    print(f"Cita antes:    {desc_original[:80]}...")
    print(f"Cita despues:  {nueva_cita.get_attribute('content-desc')[:80]}... (verificada distinta)")
    print("Test de Consultas - Reprogramar cita completado")
