"""
Tests para Bitácora ('Mi bitácora') y el modal 'Agregar entrada única', alcanzable
desde el boton flotante '+ Registrar' de Home y desde el '+' de Mi bitácora.

Mapeo completo en ../PLAN_BITACORA.md (dumps reales de UI, 2026-07-14).
"""
import pytest
from appium.webdriver.common.appiumby import AppiumBy

from pages.bitacora_page import CATEGORIAS_MODAL


def test_bitacora_ver(driver, bitacora_page):
    """Home -> 'Ver mi bitácora' -> valida estructura basica. Read-only."""
    print("\n=== TEST: Ver mi bitácora ===")
    bitacora_page.abrir_desde_home()

    assert bitacora_page.esta_visible(bitacora_page.seccion_tendencias, timeout=5), \
        "No se ve la seccion TENDENCIAS"
    assert bitacora_page.esta_visible(bitacora_page.seccion_registros, timeout=5), \
        "No se ve la seccion REGISTROS"
    print("[1] TENDENCIAS y REGISTROS visibles")

    filas = bitacora_page.buscar_elementos(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'Medición') and contains(@content-desc, '\n')]"))
    assert filas, "No hay ninguna fila de registro visible en REGISTROS"
    print(f"[2] OK: {len(filas)} fila(s) de registro visibles")

    bitacora_page.tomar_screenshot("bitacora_ver")
    driver.back()
    print("[3] Test completado (read-only)")


def test_bitacora_modal_desde_ambas_entradas(driver, bitacora_page):
    """El modal 'Agregar entrada única' debe ser el mismo desde el FAB de Home
    y desde el '+' de Mi bitácora: mismas 8 categorias en ambos casos. Read-only
    (cancela en las dos entradas, no elige ninguna categoria)."""
    print("\n=== TEST: Modal de registro desde ambas entradas ===")

    bitacora_page.abrir_modal_desde_home()
    for nombre in CATEGORIAS_MODAL:
        assert bitacora_page.esta_visible(bitacora_page.loc_categoria(nombre), timeout=3), \
            f"Falta la categoria '{nombre}' en el modal abierto desde el FAB de Home"
    print(f"[1] OK: {len(CATEGORIAS_MODAL)} categorias visibles desde el FAB de Home")
    bitacora_page.cancelar_modal()

    bitacora_page.abrir_desde_home()
    bitacora_page.abrir_modal_desde_bitacora()
    for nombre in CATEGORIAS_MODAL:
        assert bitacora_page.esta_visible(bitacora_page.loc_categoria(nombre), timeout=3), \
            f"Falta la categoria '{nombre}' en el modal abierto desde Mi bitácora"
    print(f"[2] OK: {len(CATEGORIAS_MODAL)} categorias visibles desde el '+' de Mi bitácora (coinciden)")
    bitacora_page.cancelar_modal()
    driver.back()
    print("[3] Test completado (read-only)")


def test_bitacora_registrar_medicion(driver, bitacora_page):
    """Flujo de escritura de punta a punta: FAB -> Medición -> Peso -> validar
    que 'Guardar' arranca deshabilitado con 0 -> teclear 80 -> Guardar -> la
    fila nueva debe verse en 'Mi bitácora'. Peso=80 es un valor ya usado por
    este paciente de prueba (no distorsiona la tendencia). No hay flujo de
    borrado mapeado todavia, asi que el registro queda (dato desechable, no
    afecta a un paciente real)."""
    print("\n=== TEST: Registrar medición (Peso) ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Medición")
    bitacora_page.elegir_item_de_lista("Peso")
    print("[1] Formulario de Peso abierto")

    assert not bitacora_page.guardar_habilitado(), \
        "Con el valor en 0, 'Guardar' deberia estar deshabilitado"
    print("[2] OK: 'Guardar' deshabilitado con valor 0")

    bitacora_page.teclear_numero("80")
    assert bitacora_page.guardar_habilitado(), \
        "Con un valor > 0, 'Guardar' deberia habilitarse"
    print("[3] OK: 'Guardar' habilitado tras teclear 80")

    bitacora_page.tomar_screenshot("bitacora_registrar_peso")
    bitacora_page.guardar()

    # El modal se abrio desde el FAB de Home (no desde Mi bitácora), asi que al
    # guardar el flujo regresa a Home, no a Mi bitácora -- hay que entrar
    # explicitamente para verificar la persistencia.
    bitacora_page.abrir_desde_home()
    assert bitacora_page.fila_registro_visible("Peso", "80 kg"), \
        "No se ve la nueva fila de 'Peso 80 kg' en REGISTROS tras guardar"
    print("[4] OK: nueva fila 'Peso 80 kg' visible en REGISTROS")
    driver.back()
    print("[5] Test completado (escritura confirmada de punta a punta)")


def test_bitacora_registrar_valores_laboratorio(driver, bitacora_page):
    """Mismo flujo generico que Medición (lista -> valor numerico -> Guardar),
    aplicado a 'Valores de laboratorio' con el item 'Colesterol'."""
    print("\n=== TEST: Registrar valores de laboratorio (Colesterol) ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Valores de laboratorio")
    bitacora_page.elegir_item_de_lista("Colesterol")

    assert not bitacora_page.guardar_habilitado(), \
        "Con el valor en 0, 'Guardar' deberia estar deshabilitado"
    bitacora_page.teclear_numero("180")
    assert bitacora_page.guardar_habilitado(), \
        "Con un valor > 0, 'Guardar' deberia habilitarse"
    print("[1] OK: validacion de 'Guardar' correcta para Colesterol")

    bitacora_page.guardar()
    bitacora_page.abrir_desde_home()
    assert bitacora_page.fila_contiene("Colesterol", "180"), \
        "No se ve la nueva fila de 'Colesterol 180' en REGISTROS tras guardar"
    print("[2] OK: nueva fila visible en REGISTROS")
    driver.back()
    print("[3] Test completado (escritura confirmada de punta a punta)")


def test_bitacora_registrar_actividad(driver, bitacora_page):
    """Mismo flujo generico que Medición, aplicado a 'Actividad' con el item
    'Caminar' (minutos)."""
    print("\n=== TEST: Registrar actividad (Caminar) ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Actividad")
    bitacora_page.elegir_item_de_lista("Caminar")

    assert not bitacora_page.guardar_habilitado(), \
        "Con el valor en 0, 'Guardar' deberia estar deshabilitado"
    bitacora_page.teclear_numero("30")
    assert bitacora_page.guardar_habilitado(), \
        "Con un valor > 0, 'Guardar' deberia habilitarse"
    print("[1] OK: validacion de 'Guardar' correcta para Caminar")

    bitacora_page.guardar()
    bitacora_page.abrir_desde_home()
    assert bitacora_page.fila_contiene("Caminar", "30"), \
        "No se ve la nueva fila de 'Caminar 30' en REGISTROS tras guardar"
    print("[2] OK: nueva fila visible en REGISTROS")
    driver.back()
    print("[3] Test completado (escritura confirmada de punta a punta)")


def test_bitacora_registrar_medicamento(driver, bitacora_page):
    """Flujo de escritura: FAB -> Medicamento -> primer item de 'Tu botiquín'
    -> 'Registrar toma' (ya habilitado con la cantidad default de 1) -> vuelve
    a Home -> aparece en Mi bitácora. Registrar que se tomo un medicamento del
    propio botiquin es una accion esperada de la app, no destructiva."""
    print("\n=== TEST: Registrar medicamento ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Medicamento")
    nombre = bitacora_page.elegir_primer_medicamento_de_botiquin()
    print(f"[1] Medicamento elegido: {nombre!r}")

    assert bitacora_page.registrar_toma_habilitado(), \
        "'Registrar toma' deberia estar habilitado con la cantidad default"
    bitacora_page.tomar_screenshot("bitacora_medicamento")
    bitacora_page.registrar_toma()

    bitacora_page.abrir_desde_home()
    assert bitacora_page.fila_contiene("Medicamento"), \
        "No se ve una fila de categoria 'Medicamento' en REGISTROS tras registrar la toma"
    print("[2] OK: nueva fila de Medicamento visible en REGISTROS")
    driver.back()
    print("[3] Test completado (escritura confirmada de punta a punta)")


def test_bitacora_registrar_lactancia(driver, bitacora_page):
    """Flujo de escritura: FAB -> Lactancia -> 'Toma al pecho' -> validar que
    'Registrar toma' arranca deshabilitado sin elegir pecho -> elegir 'Ambos'
    -> se habilita -> Registrar toma -> aparece en Mi bitácora."""
    print("\n=== TEST: Registrar lactancia (Toma al pecho) ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Lactancia")
    bitacora_page.elegir_item_de_lista("Toma al pecho")
    print("[1] Formulario 'Toma al pecho' abierto")

    assert not bitacora_page.registrar_toma_habilitado(), \
        "Sin elegir de que pecho, 'Registrar toma' deberia estar deshabilitado"
    print("[2] OK: 'Registrar toma' deshabilitado sin elegir pecho")

    bitacora_page.elegir_pecho("Ambos")
    assert bitacora_page.registrar_toma_habilitado(), \
        "Tras elegir 'Ambos', 'Registrar toma' deberia habilitarse"
    print("[3] OK: 'Registrar toma' habilitado tras elegir 'Ambos'")

    bitacora_page.tomar_screenshot("bitacora_lactancia")
    bitacora_page.registrar_toma()

    bitacora_page.abrir_desde_home()
    assert bitacora_page.fila_contiene("Toma al pecho"), \
        "No se ve la fila de 'Toma al pecho' en REGISTROS tras registrar"
    print("[4] OK: nueva fila visible en REGISTROS")
    driver.back()
    print("[5] Test completado (escritura confirmada de punta a punta)")


def test_bitacora_registrar_deposicion(driver, bitacora_page):
    """Flujo de escritura: FAB -> Deposición -> validar que 'Registrar
    deposición' arranca deshabilitado -> elegir 'Tipo 4' (saludable, no
    requiere color) -> se habilita -> Registrar -> aparece en Mi bitácora."""
    print("\n=== TEST: Registrar deposición ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Deposición")
    print("[1] Formulario 'Deposición' abierto")

    assert not bitacora_page.registrar_deposicion_habilitado(), \
        "Sin elegir un tipo de la escala de Bristol, 'Registrar deposición' deberia estar deshabilitado"
    print("[2] OK: 'Registrar deposición' deshabilitado sin elegir tipo")

    bitacora_page.elegir_tipo_bristol(4)
    assert bitacora_page.registrar_deposicion_habilitado(), \
        "Tras elegir 'Tipo 4', 'Registrar deposición' deberia habilitarse"
    print("[3] OK: 'Registrar deposición' habilitado tras elegir 'Tipo 4'")

    bitacora_page.tomar_screenshot("bitacora_deposicion")
    bitacora_page.registrar_deposicion()

    bitacora_page.abrir_desde_home()
    assert bitacora_page.fila_contiene("Deposición"), \
        "No se ve la fila de 'Deposición' en REGISTROS tras registrar"
    print("[4] OK: nueva fila visible en REGISTROS")
    driver.back()
    print("[5] Test completado (escritura confirmada de punta a punta)")


def test_bitacora_registrar_control_sintomas(driver, bitacora_page):
    """Flujo de escritura: FAB -> Control de síntomas -> validar que
    'Registrar' arranca deshabilitado -> elegir humor (cara mas feliz) -> se
    habilita -> Registrar -> aparece en Mi bitácora."""
    print("\n=== TEST: Registrar control de síntomas ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Control de síntomas")
    print("[1] Formulario 'Control de síntomas' abierto")

    assert not bitacora_page.registrar_habilitado(), \
        "Sin elegir humor, 'Registrar' deberia estar deshabilitado"
    print("[2] OK: 'Registrar' deshabilitado sin elegir humor")

    bitacora_page.elegir_humor(5)
    assert bitacora_page.registrar_habilitado(), \
        "Tras elegir un humor, 'Registrar' deberia habilitarse"
    print("[3] OK: 'Registrar' habilitado tras elegir humor")

    bitacora_page.tomar_screenshot("bitacora_control_sintomas")
    bitacora_page.registrar()

    bitacora_page.abrir_desde_home()
    assert bitacora_page.fila_contiene("Control de síntomas"), \
        "No se ve la fila de 'Control de síntomas' en REGISTROS tras registrar"
    print("[4] OK: nueva fila visible en REGISTROS")
    driver.back()
    print("[5] Test completado (escritura confirmada de punta a punta)")


def test_bitacora_registrar_estado_mental(driver, bitacora_page):
    """Flujo de escritura: FAB -> Estado mental -> validar que 'Registrar'
    arranca deshabilitado -> elegir humor -> se habilita -> Registrar ->
    aparece en Mi bitácora."""
    print("\n=== TEST: Registrar estado mental ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Estado mental")
    print("[1] Formulario 'Estado mental' abierto")

    assert not bitacora_page.registrar_habilitado(), \
        "Sin elegir humor, 'Registrar' deberia estar deshabilitado"
    print("[2] OK: 'Registrar' deshabilitado sin elegir humor")

    bitacora_page.elegir_humor(4)
    assert bitacora_page.registrar_habilitado(), \
        "Tras elegir un humor, 'Registrar' deberia habilitarse"
    print("[3] OK: 'Registrar' habilitado tras elegir humor")

    bitacora_page.tomar_screenshot("bitacora_estado_mental")
    bitacora_page.registrar()

    bitacora_page.abrir_desde_home()
    assert bitacora_page.fila_contiene("Estado mental"), \
        "No se ve la fila de 'Estado mental' en REGISTROS tras registrar"
    print("[4] OK: nueva fila visible en REGISTROS")
    driver.back()
    print("[5] Test completado (escritura confirmada de punta a punta)")


def test_bitacora_buscador_lista(driver, bitacora_page):
    """En 'Seleccionar de la lista' (categoria Medición), el buscador filtra
    los items. Read-only."""
    print("\n=== TEST: Buscador en 'Seleccionar de la lista' ===")

    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria("Medición")

    bitacora_page.buscar_en_lista("Temp")
    encontrados = bitacora_page.items_visibles_en_lista()
    nombres = [e.get_attribute("content-desc") for e in encontrados]
    assert nombres, "El buscador 'Temp' no devolvio ningun item"
    assert all("Temperatura" in n for n in nombres), \
        f"El buscador 'Temp' devolvio items que no son Temperatura: {nombres}"
    print(f"[1] OK: buscador 'Temp' devuelve solo Temperatura ({len(nombres)} item(s))")

    # Un solo back: 'Seleccionar de la lista' es un push screen (el modal ya se
    # consumio al elegir la categoria), un back de mas aqui saca la app entera
    # al launcher de Android (ya paso una vez).
    driver.back()
    print("[2] Test completado (read-only)")


@pytest.mark.smoke
@pytest.mark.parametrize("categoria", CATEGORIAS_MODAL)
def test_bitacora_smoke_categoria(driver, bitacora_page, categoria):
    """Smoke, read-only: cada una de las 8 categorias del modal 'Agregar entrada
    única' debe abrir una pantalla nueva (no debe quedarse en el modal ni tumbar
    la app). No valida el contenido especifico de cada flujo -- solo detecta
    categorias rotas; el detalle de cada una queda para tests dedicados
    (ya cubierto para 'Medición' en los tests de arriba)."""
    print(f"\n=== SMOKE: categoria '{categoria}' ===")
    bitacora_page.abrir_modal_desde_home()
    bitacora_page.elegir_categoria(categoria)

    assert not bitacora_page.esta_visible(bitacora_page.modal_titulo, timeout=3), \
        f"El modal 'Agregar entrada única' no se cerro al elegir '{categoria}'"
    bitacora_page.tomar_screenshot(f"bitacora_smoke_{categoria}")
    print(f"[OK] '{categoria}' abrio una pantalla nueva")

    driver.back()
    print("Test completado (read-only)")
