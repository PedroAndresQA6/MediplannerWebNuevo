"""
Test para Dependientes
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


def test_dependientes_agregar(driver, home_page):
    """Test agregar nuevo dependiente"""
    print("\n=== TEST: Agregar Dependiente ===")
    
    home_page = volver_inicio(driver, home_page)
    
    btn_perfil = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[@tooltip-text='Mostrar menú']")
    if not btn_perfil:
        btn_perfil = driver.find_elements(AppiumBy.XPATH,
            "//android.widget.ImageView[@bounds='[48,192][546,366]']")
    if btn_perfil:
        btn_perfil[0].click()
        time.sleep(1)
        print("[0] Menu abierto")
    
    btn_agregar = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Agregar dependiente']")
    if btn_agregar:
        btn_agregar[0].click()
        time.sleep(1)
        print("[1] Formulario abierto")
    
    nombres_hombre = ["Juan", "Pedro", "Carlos", "Luis", "Miguel", "Jose"]
    nombres_mujer = ["Maria", "Ana", "Sofia", "Laura", "Kenia"]
    
    nombre_completo = random.choice(nombres_hombre + nombres_mujer)
    es_hombre = nombre_completo in nombres_hombre
    
    txt_nombre = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@bounds='[48,977][1232,1121]']")
    if txt_nombre:
        txt_nombre[0].click()
        txt_nombre[0].clear()
        txt_nombre[0].send_keys(nombre_completo)
    
    txt_apellido_p = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@bounds='[48,1229][1232,1373]']")
    if txt_apellido_p:
        txt_apellido_p[0].click()
        txt_apellido_p[0].clear()
        txt_apellido_p[0].send_keys("Garcia")
    
    txt_apellido_m = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@bounds='[48,1481][1232,1625]']")
    if txt_apellido_m:
        txt_apellido_m[0].click()
        txt_apellido_m[0].clear()
        txt_apellido_m[0].send_keys("Perez")
    
    txt_fecha = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@bounds='[48,1733][1232,1877]']")
    if txt_fecha:
        txt_fecha[0].click()
        time.sleep(1)
        print("[5] Click en fecha")
    
    btn_fecha = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[@bounds='[100,978][1180,2142]']")
    if btn_fecha:
        btn_fecha[0].click()
        time.sleep(1)
        print("[6] Selector año abierto")
    
    btn_1990 = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='1990']")
    if btn_1990:
        btn_1990[0].click()
        time.sleep(0.5)
        print("[7] Año 1990 seleccionado")
    
    btn_dia = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='15, lunes, 15 de agosto de 1990']")
    if btn_dia:
        btn_dia[0].click()
        time.sleep(0.5)
        print("[8] Dia 15 seleccionado")
    
    btn_aceptar = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='ACEPTAR']")
    if btn_aceptar:
        btn_aceptar[0].click()
        time.sleep(0.5)
        print("[9] ACEPTAR clickeado")
    
    btn_sexo = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[48,1985][1232,2129]']")
    if btn_sexo:
        btn_sexo[0].click()
        time.sleep(0.5)
        print("[10] Popup sexo abierto")
    
    btn_masculino = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Masculino']")
    btn_femenino = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Femenino']")
    
    if es_hombre and btn_masculino:
        btn_masculino[0].click()
        time.sleep(0.5)
        print("[11] Masculino seleccionado")
    elif not es_hombre and btn_femenino:
        btn_femenino[0].click()
        time.sleep(0.5)
        print("[11] Femenino seleccionado")
    
    btn_parentesco = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[48,2237][1232,2381]']")
    if btn_parentesco:
        btn_parentesco[0].click()
        time.sleep(0.5)
        print("[12] Popup parentesco abierto")
    
    parentescos = ["Hijo(a)", "Padre", "Madre", "Abuelo(a)", "Primo(a)", "Sobrino(a)", "Tio(a)"]
    btn_opcion = driver.find_elements(AppiumBy.XPATH, 
        f"//android.widget.Button[@content-desc='{random.choice(parentescos)}']")
    if btn_opcion:
        btn_opcion[0].click()
        time.sleep(0.5)
        print("[13] Parentesco seleccionado")
    
    btn_continuar = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Continuar']")
    if btn_continuar and btn_continuar[0].get_attribute("enabled") == "true":
        btn_continuar[0].click()
        time.sleep(2)
        print("[14] Continuar clickeado - Dependiente creado")
    
    print("[15] Test completado")


def test_dependientes_desvincular(driver, home_page):
    """Test desvincular cotitular y cerrar sesión"""
    print("\n=== TEST: Desvincular Dependiente ===")
    
    btn_perfil = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[@tooltip-text='Mostrar menú']")
    if not btn_perfil:
        btn_perfil = driver.find_elements(AppiumBy.XPATH,
            "//android.widget.ImageView[@bounds='[48,192][546,366]']")
    if btn_perfil:
        btn_perfil[0].click()
        time.sleep(1)
        print("[0] Menu abierto")
    else:
        print("[0] Menu NO encontrado")
    
    btn_dependiente = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[48,702][888,846]']")
    if not btn_dependiente:
        print("[1a] No hay dependientes, creando uno primero...")
        nombres_h = ["Juan", "Pedro", "Carlos", "Luis", "Miguel", "Jose"]
        nombres_m = ["Maria", "Ana", "Sofia", "Laura", "Kenia"]
        nombre = random.choice(nombres_h + nombres_m)
        es_hombre = nombre in nombres_h
        _abrir_formulario_agregar_dependiente(driver)
        _completar_formulario_dependiente(driver, nombre, es_hombre)
        time.sleep(2)
        print(f"[1b] Dependiente {nombre} creado")
        btn_dependiente = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.Button[@bounds='[48,702][888,846]']")
    if btn_dependiente:
        btn_dependiente[0].click()
        time.sleep(1)
        print("[1] Dependiente seleccionado")
    
    btn_menu = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[@bounds='[1103,221][1220,338]']")
    if btn_menu:
        btn_menu[0].click()
        time.sleep(1)
        print("[2] Menu perfil abierto")
    else:
        print("[2] Menu perfil NO encontrado")
    
    btn_compartir = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[contains(@content-desc, 'Compartir')]")
    if btn_compartir:
        btn_compartir[0].click()
        time.sleep(1)
        print("[3] Compartir abierto")
    
    btn_popup = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[@content-desc='Desbloquea acceso completo']")
    if btn_popup:
        print("[3b] Popup sin acceso - cerrando popup")
        btn_cancelar = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.Button[@content-desc='Cancelar']")
        if btn_cancelar:
            btn_cancelar[0].click()
            time.sleep(0.5)
        print("[4] Sin dependientes - procediendo a cerrar sesión")
    else:
        btn_cotitular = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.Button[@bounds='[0,678][1280,894]']")
        if btn_cotitular:
            btn_cotitular[0].click()
            time.sleep(1)
            print("[4] Cotitular seleccionado")
    
    btn_desvincular = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[48,1293][1232,1437]']")
    if btn_desvincular:
        btn_desvincular[0].click()
        time.sleep(1)
        print("[5] Desvincular clickeado")
    
    btn_confirmar_popup = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Desvincular']")
    if btn_confirmar_popup:
        btn_confirmar_popup[0].click()
        time.sleep(3)
        print("[6] Desvinculado confirmado - esperando carga")
    
    btn_atras = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[12,168][156,312]']")
    if btn_atras:
        btn_atras[0].click()
        time.sleep(1)
        print("[7] Volviendo a perfil")
    
    for _ in range(3):
        driver.back()
        time.sleep(1)
        tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")
        if home_page.esta_visible(tab_inicio, timeout=2):
            break
    print("[8] Regresando a Inicio")
    
    btn_perfil = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[@tooltip-text='Mostrar menú']")
    if not btn_perfil:
        btn_perfil = driver.find_elements(AppiumBy.XPATH,
            "//android.widget.ImageView[@bounds='[48,192][546,366]']")
    if btn_perfil:
        btn_perfil[0].click()
        time.sleep(1)
        print("[9] Menu abierto")
    
    btn_titular = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[48,558][888,702]']")
    if btn_titular:
        btn_titular[0].click()
        time.sleep(1)
        print("[10] Perfil del titular seleccionado")
    
    print("[14] Test completado")


def _abrir_formulario_agregar_dependiente(driver):
    """Abre el formulario de agregar dependiente desde el perfil"""
    time.sleep(2)
    
    btn_perfil = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[@tooltip-text='Mostrar menú']")
    if not btn_perfil:
        btn_perfil = driver.find_elements(AppiumBy.XPATH,
            "//android.widget.ImageView[@bounds='[48,192][546,366]']")
    if btn_perfil:
        btn_perfil[0].click()
        time.sleep(1)
    
    btn_agregar = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Agregar dependiente']")
    if btn_agregar:
        btn_agregar[0].click()
        time.sleep(1)


def _completar_formulario_dependiente(driver, nombre_completo, es_hombre):
    """Llena el formulario con los datos del dependiente y lo envía"""
    txt_nombre = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@bounds='[48,977][1232,1121]']")
    if txt_nombre:
        txt_nombre[0].click()
        txt_nombre[0].clear()
        txt_nombre[0].send_keys(nombre_completo)
    
    txt_apellido_p = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@bounds='[48,1229][1232,1373]']")
    if txt_apellido_p:
        txt_apellido_p[0].click()
        txt_apellido_p[0].clear()
        txt_apellido_p[0].send_keys("Garcia")
    
    txt_apellido_m = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@bounds='[48,1481][1232,1625]']")
    if txt_apellido_m:
        txt_apellido_m[0].click()
        txt_apellido_m[0].clear()
        txt_apellido_m[0].send_keys("Perez")
    
    txt_fecha = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.EditText[@bounds='[48,1733][1232,1877]']")
    if txt_fecha:
        txt_fecha[0].click()
        time.sleep(1)
    
    btn_fecha = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[@bounds='[100,978][1180,2142]']")
    if btn_fecha:
        btn_fecha[0].click()
        time.sleep(1)
    
    btn_1990 = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='1990']")
    if btn_1990:
        btn_1990[0].click()
        time.sleep(0.5)
    
    btn_dia = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='15, lunes, 15 de agosto de 1990']")
    if btn_dia:
        btn_dia[0].click()
        time.sleep(0.5)
    
    btn_aceptar = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='ACEPTAR']")
    if btn_aceptar:
        btn_aceptar[0].click()
        time.sleep(0.5)
    
    btn_sexo = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[48,1985][1232,2129]']")
    if btn_sexo:
        btn_sexo[0].click()
        time.sleep(0.5)
    
    btn_masculino = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Masculino']")
    btn_femenino = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Femenino']")
    
    if es_hombre and btn_masculino:
        btn_masculino[0].click()
        time.sleep(0.5)
    elif not es_hombre and btn_femenino:
        btn_femenino[0].click()
        time.sleep(0.5)
    
    btn_parentesco = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[48,2237][1232,2381]']")
    if btn_parentesco:
        btn_parentesco[0].click()
        time.sleep(0.5)
    
    parentescos = ["Hijo(a)", "Padre", "Madre", "Abuelo(a)", "Primo(a)", "Sobrino(a)", "Tio(a)"]
    btn_opcion = driver.find_elements(AppiumBy.XPATH, 
        f"//android.widget.Button[@content-desc='{random.choice(parentescos)}']")
    if btn_opcion:
        btn_opcion[0].click()
        time.sleep(0.5)
    
    btn_continuar = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@content-desc='Continuar']")
    if btn_continuar and btn_continuar[0].get_attribute("enabled") == "true":
        btn_continuar[0].click()
        time.sleep(2)


def _seleccionar_perfil_dependiente(driver):
    """Selecciona el perfil del dependiente desde el menú"""
    btn_dependiente = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.Button[@bounds='[48,702][888,846]']")
    if btn_dependiente:
        btn_dependiente[0].click()
        time.sleep(1)


def test_dependientes_agregar_dos(driver, home_page):
    """Test agregar dos dependientes desde el perfil de un dependiente"""
    print("\n=== TEST: Agregar Dos Dependientes ===")
    
    nombres_hombre = ["Juan", "Pedro", "Carlos", "Luis", "Miguel", "Jose"]
    nombres_mujer = ["Maria", "Ana", "Sofia", "Laura", "Kenia"]
    
    nombre1 = random.choice(nombres_hombre + nombres_mujer)
    es_hombre1 = nombre1 in nombres_hombre
    
    nombre2 = random.choice(nombres_hombre + nombres_mujer)
    es_hombre2 = nombre2 in nombres_hombre
    
    _abrir_formulario_agregar_dependiente(driver)
    print("[A] Formulario abierto - Dependiente 1")
    
    _completar_formulario_dependiente(driver, nombre1, es_hombre1)
    print(f"[B] Dependiente 1 creado: {nombre1}")
    
    time.sleep(2)
    
    _abrir_formulario_agregar_dependiente(driver)
    _seleccionar_perfil_dependiente(driver)
    print("[C] Perfil seleccionado - Dependiente 2")
    
    _completar_formulario_dependiente(driver, nombre2, es_hombre2)
    print(f"[D] Dependiente 2 creado: {nombre2}")
    
    print("[E] Test completado")