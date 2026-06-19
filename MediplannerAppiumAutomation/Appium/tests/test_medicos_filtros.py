"""
Test para Médicos - Flujo completo de filtros:
1. Filtro de texto → perfil → regresar
2. Resetear
3. Filtro de estado → perfil → regresar
4. Resetear
5. Filtro texto + estado → perfil → regresar
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


ESPECIALIDADES = [
    "Acupuntura",
    "Internista",
    "Psiquiatría",
    "Otorrinolaringología",
    "Anestesiología",
    "Alergología",
    "Nutriología",
    "Ginecología",
    "Cardiología",
    "Audiología",
    "Neumología",
    "Broncoscopía",
    "Oncología",
    "Medicina General"
]


def abrir_modal_filtro(driver, doctors_page):
    """Abrir modal de filtros"""
    btn_filtro = (AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[1052,192][1232,372]']")
    doctors_page.hacer_click(btn_filtro)
    time.sleep(1)


def cerrar_modal_filtro(driver, doctors_page):
    """Cerrar modal con Cancelar"""
    btn_cancelar = (AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,852][622,996]']")
    doctors_page.hacer_click(btn_cancelar)
    time.sleep(1)


def resetear_filtros(driver, doctors_page):
    """Resetear filtros"""
    btn_cancelar = (AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,852][622,996]']")
    
    if doctors_page.esta_visible(btn_cancelar, timeout=2):
        cerrar_modal_filtro(driver, doctors_page)
    else:
        abrir_modal_filtro(driver, doctors_page)
        cerrar_modal_filtro(driver, doctors_page)
    
    doctors_page.tomar_screenshot("reseteado")


def aplicar_filtro_estado(driver, doctors_page):
    """Aplicar filtro por estado Querétaro"""
    btn_estado = (AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,456][1232,612]']")
    doctors_page.hacer_click(btn_estado)
    time.sleep(2)
    
    for _ in range(10):
        estados = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Querétaro']")
        if estados:
            doctors_page.hacer_click(estados[0])
            time.sleep(1)
            break
        doctors_page.scroll_abajo()
        time.sleep(0.5)


def clic_btn_buscar(driver, doctors_page):
    """Click en botón Buscar"""
    doctors_page.ocultar_keyboard()
    time.sleep(1)
    btn_buscar = (AppiumBy.XPATH, "//android.widget.Button[@bounds='[658,852][1232,996]']")
    doctors_page.hacer_click(btn_buscar)
    time.sleep(2)


def entrar_perfil_doctor(driver, doctors_page, paso):
    """Seleccionar un doctor y entrar a su perfil"""
    doctores = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[contains(@content-desc, 'Dr.')]")
    
    if doctores:
        doctor = doctores[-1]
        doctor_bounds = doctor.get_attribute("bounds")
        doctor_locator = (AppiumBy.XPATH, f"//android.view.View[@bounds='{doctor_bounds}']")
        
        doctor_nombre = doctor.get_attribute("content-desc").split('\n')[0]
        doctors_page.tomar_screenshot(f"paso_{paso}_lista")
        
        doctors_page.hacer_click(doctor_locator)
        time.sleep(3)
        
        doctors_page.tomar_screenshot(f"paso_{paso}_perfil")
        
        driver.back()
        time.sleep(2)
        
        return True
    return False


def test_medicos_flujo_completo(driver, doctors_page):
    """Test Médicos - Flujo completo de filtros"""
    print("\n=== TEST: Médicos - Flujo Completo ===")
    
    especialidad = random.choice(ESPECIALIDADES)
    print(f"Especialidad: {especialidad}")
    
    volver_inicio(driver, doctors_page)
    doctors_page.hacer_click(doctors_page.tab_medicos)
    time.sleep(3)
    
    doctors_page.tomar_screenshot("00_inicio")
    
    # Reset inicial
    resetear_filtros(driver, doctors_page)
    
    # PASO 1: Filtro de texto
    print("\n[1/3] Filtro de Texto")
    abrir_modal_filtro(driver, doctors_page)
    
    campo_buscar = (AppiumBy.XPATH, "//android.widget.EditText[@bounds='[48,210][1028,354]']")
    doctors_page.ingresar_texto(campo_buscar, especialidad)
    doctors_page.ocultar_keyboard()
    time.sleep(1)
    
    clic_btn_buscar(driver, doctors_page)
    time.sleep(3)
    
    doctors_page.tomar_screenshot("01_filtro_texto")
    entrar_perfil_doctor(driver, doctors_page, "01")
    
    # PASO 2: Filtro de estado
    print("\n[2/3] Filtro de Estado")
    resetear_filtros(driver, doctors_page)
    abrir_modal_filtro(driver, doctors_page)
    
    aplicar_filtro_estado(driver, doctors_page)
    clic_btn_buscar(driver, doctors_page)
    time.sleep(3)
    
    doctors_page.tomar_screenshot("02_filtro_estado")
    entrar_perfil_doctor(driver, doctors_page, "02")
    
    # PASO 3: Filtro texto + estado
    print("\n[3/3] Filtro Texto + Estado")
    resetear_filtros(driver, doctors_page)
    abrir_modal_filtro(driver, doctors_page)
    
    campo_buscar = (AppiumBy.XPATH, "//android.widget.EditText[@bounds='[48,210][1028,354]']")
    doctors_page.ingresar_texto(campo_buscar, especialidad)
    doctors_page.ocultar_keyboard()
    time.sleep(1)
    
    aplicar_filtro_estado(driver, doctors_page)
    clic_btn_buscar(driver, doctors_page)
    time.sleep(3)
    
    doctors_page.tomar_screenshot("03_filtro_ambos")
    entrar_perfil_doctor(driver, doctors_page, "03")
    
    resetear_filtros(driver, doctors_page)
    
    print("Test completado - 3 pasos ejecutados")