import pytest
import time
from appium.webdriver.common.appiumby import AppiumBy


def test_login(driver, login_page, credenciales):
    """Test basic login flow"""
    print("\n=== TEST: Login ===")

    login_page.tomar_screenshot("01_login_inicio")

    login_page.iniciar_sesion(credenciales["email"], credenciales["password"])
    time.sleep(3)

    login_page.tomar_screenshot("02_login_fin")

    # Verificar que el login realmente llego al Home (no basta con no fallar)
    assert login_page.esta_logueado(), "El login no llego al Home (pestañas no visibles)"
    print("Login completado")


def test_navegacion_tabs(driver, login_page, home_page, credenciales):
    """Test navigation between all tabs"""
    print("\n=== TEST: Navegacion Tabs ===")

    # Solo hacer login si no está logueado
    if not login_page.esta_logueado():
        login_page.iniciar_sesion(credenciales["email"], credenciales["password"])
        time.sleep(2)

    tabs = [
        ("Inicio", home_page.tab_inicio),
        ("Medicos", home_page.tab_medicos),
        ("Consultas", home_page.tab_consultas),
        ("Medicinas", home_page.tab_medicinas),
        ("Estudios", home_page.tab_estudios),
    ]

    # Las 5 pestañas deben existir en la barra de navegación
    for nombre, loc in tabs:
        assert home_page.esta_visible(loc, timeout=5), f"No se encontró la pestaña {nombre}"

    # Navegar por cada pestaña (hacer_click falla si no es clickeable) y confirmar
    # que la barra de tabs sigue presente tras cada navegación
    for nombre, loc in tabs:
        home_page.hacer_click(loc)
        time.sleep(1)
        home_page.tomar_screenshot(f"tab_{nombre}")
        assert home_page.esta_visible(loc, timeout=3), f"La barra de tabs desapareció tras abrir {nombre}"

    # Volver a Inicio
    home_page.ir_a_inicio()
    time.sleep(1)
    assert home_page.esta_en_inicio(), "No se regresó a la pestaña Inicio"
    print("Navegacion completada")


def test_doctor_search(driver, login_page, doctors_page, credenciales):
    """Test doctor search"""
    print("\n=== TEST: Doctor Search ===")

    # Solo hacer login si no está logueado
    if not login_page.esta_logueado():
        login_page.iniciar_sesion(credenciales["email"], credenciales["password"])
        time.sleep(2)

    doctors_page.ir_a_tab("medicos")
    time.sleep(2)
    assert doctors_page.esta_en_doctors(), "No se abrió Médicos (campo de búsqueda ausente)"

    # Buscar y verificar que hay resultados ('Dr.') o un indicador de 'sin resultados'
    doctors_page.buscar("Fernando")
    time.sleep(2)
    doctors_page.tomar_screenshot("doctors_busqueda")

    doctores = driver.find_elements(AppiumBy.XPATH, "//*[contains(@content-desc, 'Dr.')]")
    sin_resultados = driver.find_elements(
        AppiumBy.XPATH,
        "//*[contains(@content-desc, 'No se encontr') or contains(@content-desc, 'in resultados')]")
    assert doctores or sin_resultados, \
        "La búsqueda no mostró ni resultados ('Dr.') ni indicador de 'sin resultados'"
    print(f"Busqueda completada: {len(doctores)} resultado(s) con 'Dr.'")