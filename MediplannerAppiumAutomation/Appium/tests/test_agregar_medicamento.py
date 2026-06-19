"""
Test para agregar medicamento personal
Flujo: Buscar nombre → Seleccionar presentacion → Unidad → Via administracion → Frecuencia → Dosis/Hora → Guardar
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


NOMBRES_MEDICAMENTOS = [
    "Paracetamol", "Ibuprofeno", "Amoxicilina", "Omeprazol", "Metformina",
    "Losartan", "Amlodipino", "Atorvastatina", "Levotiroxina", "Aspirina"
]

DOSIS_VALORES = [150, 300, 400, 600, 800]


def test_agregar_medicamento_personal(driver, home_page):
    """Test para agregar un medicamento personal"""
    print("\n=== TEST: Agregar Medicamento Personal ===")
    
    presentacion_seleccionada = None
    unidad_seleccionada = None
    
    home_page = volver_inicio(driver, home_page)
    
    home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5"))
    time.sleep(2)
    print("[1] Navegando a Medicinas")
    
    btn_agregar = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[1136,168][1280,312]']")
    
    if btn_agregar:
        btn_agregar[0].click()
        time.sleep(2)
        print("[2] Click en Agregar medicamento")
    
    nombre_med = random.choice(NOMBRES_MEDICAMENTOS)
    txt_nombre = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@hint='Busca o escribe el nombre del medicamento']")
    
    if txt_nombre:
        txt_nombre[0].click()
        txt_nombre[0].send_keys(nombre_med)
        time.sleep(2)
        print(f"[3] Nombre ingresado: {nombre_med}")
    
    medicamentos = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Seleccionar']")
    
    if medicamentos:
        med_seleccionado = random.choice(medicamentos)
        med_seleccionado.click()
        time.sleep(2)
        print("[4] Medicamento seleccionado")
    
    print("[5] Seleccionando presentacion...")
    
    opciones_presentacion = ['Tabletas', 'Suspension', 'Capsulas', 'Ampolleta']
    presentaciones = []
    for desc in opciones_presentacion:
        elementos = driver.find_elements(AppiumBy.XPATH, 
            f"//android.view.View[@content-desc='{desc}']")
        presentaciones.extend(elementos)
    
    if presentaciones:
        idx = random.randint(0, len(presentaciones) - 1)
        presentaciones[idx].click()
        presentacion_seleccionada = opciones_presentacion[idx % len(opciones_presentacion)]
        time.sleep(1)
        print(f"[6] Presentacion seleccionada: {presentacion_seleccionada}")
    
    print("[7] Seleccionando unidad de dosis...")
    
    opciones_unidad = ['miligramos', 'mililitros', 'gotas']
    unidades = []
    for desc in opciones_unidad:
        elementos = driver.find_elements(AppiumBy.XPATH, 
            f"//android.view.View[@content-desc='{desc}']")
        unidades.extend(elementos)
    
    if unidades:
        idx = random.randint(0, len(unidades) - 1)
        unidades[idx].click()
        unidad_seleccionada = opciones_unidad[idx % len(opciones_unidad)]
        time.sleep(1)
        print(f"[8] Unidad seleccionada: {unidad_seleccionada}")
    
    print("[9] Seleccionando via de administracion...")
    home_page.scroll_abajo()
    time.sleep(0.5)
    
    opciones_via = ['Oral', 'Subcutanea', 'Intramuscular']
    vias = []
    for desc in opciones_via:
        elementos = driver.find_elements(AppiumBy.XPATH, 
            f"//android.view.View[@content-desc='{desc}']")
        vias.extend(elementos)
    
    if vias:
        random.choice(vias).click()
        time.sleep(1)
        print("[10] Via seleccionada")
    
    print("[11] Seleccionando frecuencia...")
    
    frecuencias = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[contains(@content-desc, 'Una vez')]")
    
    if frecuencias:
        frecuencias[0].click()
        time.sleep(1)
        print("[12] Frecuencia seleccionada")
    
    print("[13] Ajustando dosis...")
    
    dosis_deseada = random.choice(DOSIS_VALORES)
    print(f"[14] Dosis a configurar: {dosis_deseada}")
    
    btn_mas = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[@bounds='[1088,807][1232,951]']")
    
    if btn_mas:
        btn_mas[0].click()
        time.sleep(1)
        print("[15] Click en + para abrir campo de texto")
    
    txt_dosis = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText")
    
    if txt_dosis:
        txt_dosis[0].click()
        txt_dosis[0].clear()
        txt_dosis[0].send_keys(str(dosis_deseada))
        time.sleep(0.5)
        print(f"[15b] Dosis ingresada: {dosis_deseada}")
    
    btn_siguiente = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Siguiente']")
    
    if btn_siguiente and btn_siguiente[0].get_attribute("enabled") == "true":
        btn_siguiente[0].click()
        time.sleep(2)
        print("[16] Click en Siguiente")
    
    home_page.tomar_screenshot("medicamento_registrado")
    print("[17] Test completado - Medicamento registrado")
    
    print("[18] Estableciendo duracion del tratamiento...")
    
    btn_duracion = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[@content-desc='Establecer duración del tratamiento']")
    
    if btn_duracion:
        btn_duracion[0].click()
        time.sleep(1)
        print("[19] Click en Establecer duracion")
    
    print("[20] Seleccionando fecha de inicio...")
    time.sleep(1)
    
    btn_siguiente_fecha = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Siguiente']")
    
    if btn_siguiente_fecha:
        btn_siguiente_fecha[0].click()
        time.sleep(1)
        print("[21] Siguiente - Pantalla duracion")
    
    print("[22] Seleccionando duracion...")
    
    opciones_duracion = ['5 días', '1 semana', '10 días']
    duraciones = []
    for desc in opciones_duracion:
        elementos = driver.find_elements(AppiumBy.XPATH, 
            f"//android.view.View[@content-desc='{desc}']")
        duraciones.extend(elementos)
    
    if duraciones:
        duraciones[0].click()
        time.sleep(1)
        print("[23] Duracion seleccionada")
    
    print("[24] Medicamento agregado exitosamente")