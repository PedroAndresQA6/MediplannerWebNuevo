import pytest
import time


def test_login(driver, login_page, credenciales):
    """Test basic login flow"""
    print("\n=== TEST: Login ===")
    
    login_page.tomar_screenshot("01_login_inicio")
    
    login_page.iniciar_sesion(credenciales["email"], credenciales["password"])
    time.sleep(3)
    
    login_page.tomar_screenshot("02_login_fin")
    print("Login completado")


def test_navegacion_tabs(driver, login_page, home_page, credenciales):
    """Test navigation between all tabs"""
    print("\n=== TEST: Navegacion Tabs ===")
    
    # Solo hacer login si no está logueado
    if not login_page.esta_logueado():
        login_page.iniciar_sesion(credenciales["email"], credenciales["password"])
        time.sleep(2)
    
    home_page.tomar_screenshot("03_inicio")
    
    # Navigate to Médicos
    home_page.ir_a_medicos()
    time.sleep(1)
    home_page.tomar_screenshot("04_medicos")
    
    # Navigate to Consultas
    home_page.ir_a_consultas()
    time.sleep(1)
    home_page.tomar_screenshot("05_consultas")
    
    # Navigate to Medicinas
    home_page.ir_a_medicinas()
    time.sleep(1)
    home_page.tomar_screenshot("06_medicinas")
    
    # Navigate to Estudios
    home_page.ir_a_estudios()
    time.sleep(1)
    home_page.tomar_screenshot("07_estudios")
    
    # Back to Inicio
    home_page.ir_a_inicio()
    time.sleep(1)
    home_page.tomar_screenshot("08_inicio_vuelta")
    
    print("Navegacion completada")


def test_doctor_search(driver, login_page, doctors_page, credenciales):
    """Test doctor search"""
    print("\n=== TEST: Doctor Search ===")
    
    # Solo hacer login si no está logueado
    if not login_page.esta_logueado():
        login_page.iniciar_sesion(credenciales["email"], credenciales["password"])
        time.sleep(2)
    
    doctors_page.ir_a_tab("medicos")
    time.sleep(1)
    
    doctors_page.tomar_screenshot("06_doctors_inicio")
    
    # Search
    doctors_page.buscar("Fernando")
    time.sleep(1)
    
    doctors_page.tomar_screenshot("07_doctors_busqueda")
    print("Busqueda completada")