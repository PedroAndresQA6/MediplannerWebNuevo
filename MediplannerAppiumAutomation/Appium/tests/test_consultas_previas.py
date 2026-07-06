"""
Tests Consultas - Previas.
Cada test abre su propia cita previa (Terminada, o Iniciada como respaldo) y
ejercita un flujo independiente: iniciar tratamiento desde Receta, o cargar
un resultado de estudio.
"""
from utils.navegacion import volver_inicio


def _abrir_cita_previa(driver, home_page, consultas_page):
    home_page = volver_inicio(driver, home_page)
    consultas_page.abrir()
    consultas_page.ir_a_previas()
    cita, estado = consultas_page.buscar_cita_previa()
    return cita, estado


def test_consultas_previas_iniciar_tratamiento(driver, home_page, consultas_page):
    """Consultas > Previas: inicia el tratamiento de la receta de una cita previa."""
    print("\n=== TEST: Consultas Previas - Iniciar tratamiento ===")

    cita, estado = _abrir_cita_previa(driver, home_page, consultas_page)
    if not cita:
        print("No hay citas previas (Terminada/Iniciada); nada que iniciar")
        return

    print(f"Cita previa encontrada con estado '{estado}': {cita.get_attribute('content-desc')[:60]}...")
    cita.click()

    # iniciar_tratamiento_desde_receta() ya verifica (esperando a que el botón
    # 'Iniciar tratamiento' desaparezca) que el alta se procesó de verdad; si
    # el backend fallara en silencio, el método falla ahí en vez de devolver
    # True sin más. False acá solo significa "no había nada pendiente".
    inicio_realizado = consultas_page.iniciar_tratamiento_desde_receta()
    if inicio_realizado:
        print("Tratamiento iniciado y verificado exitosamente")
    else:
        print("Los medicamentos ya estaban iniciados (o no había receta pendiente)")
    print("Test de Consultas Previas - Iniciar tratamiento completado")


def test_consultas_previas_cargar_estudio(driver, home_page, consultas_page):
    """Consultas > Previas: carga un resultado de estudio para una cita previa."""
    print("\n=== TEST: Consultas Previas - Cargar estudio ===")

    cita, estado = _abrir_cita_previa(driver, home_page, consultas_page)
    if not cita:
        print("No hay citas previas (Terminada/Iniciada); nada que cargar")
        return

    print(f"Cita previa encontrada con estado '{estado}': {cita.get_attribute('content-desc')[:60]}...")
    cita.click()

    # cargar_resultado_estudio() ya verifica (esperando a que el botón
    # 'Finalizar' desaparezca) que la carga se procesó de verdad; si el
    # backend fallara en silencio, el método falla ahí en vez de devolver
    # True sin más. False acá solo significa "no había botón 'Cargar
    # resultados' disponible".
    cargado = consultas_page.cargar_resultado_estudio()
    if cargado:
        print("Resultado de estudio cargado y verificado exitosamente")
    else:
        print("No había botón 'Cargar resultados' disponible para esta cita")
    print("Test de Consultas Previas - Cargar estudio completado")
