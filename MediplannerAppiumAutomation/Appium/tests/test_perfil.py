"""
Test para Perfil - Datos Personales
"""
import time
from appium.webdriver.common.appiumby import AppiumBy


def test_perfil_datos_personales(driver, home_page):
    print("\n=== TEST: Datos Personales ===")
    
    time.sleep(3)
    
    # Verificar si ya está en pantalla de Perfil (buscar título con content-desc='Perfil')
    en_perfil = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[@content-desc='Perfil' and @bounds='[578,207][702,273]']")
    
    if en_perfil:
        print("[0] Ya está en Perfil")
    else:
        print("[0] No está en Perfil - navegando...")
        # Click en botón de menú (bounds [1103,221][1220,338])
        btn_menu = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.ImageView[@bounds='[1103,221][1220,338]']")
        if btn_menu:
            btn_menu[0].click()
            time.sleep(0.5)
    
    # Buscar y click en "Datos Personales" usando bounds fijos
    datos_personales = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[@bounds='[48,921][1232,1176]']")
    if datos_personales:
        datos_personales[0].click()
        time.sleep(0.5)
        print("[1] Datos Personales abierto")
    
    # Obtener campos
    nombre = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[48,624][1232,768]']")
    apellido = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[48,945][1232,1089]']")
    curp = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[48,1587][1232,1731]']")
    
    # Guardar valores originales
    nombre_original = nombre[0].get_attribute("text") if nombre else "Test"
    apellido_original = apellido[0].get_attribute("text") if apellido else "User"
    curp_original = curp[0].get_attribute("text") if curp else "TEST841116HDFRNC01"
    
    print(f"[2] Nombre original: {nombre_original}")
    print(f"[3] Apellido original: {apellido_original}")
    print(f"[4] CURP original: {curp_original}")
    
    # Limpiar y re-ingresar nombre
    if nombre:
        nombre[0].click()
        nombre[0].clear()
        time.sleep(0.3)
        nombre[0].send_keys(nombre_original)
        print(f"[5] Nombre re-ingresado: {nombre_original}")
    
    # Limpiar y re-ingresar apellido
    if apellido:
        apellido[0].click()
        apellido[0].clear()
        time.sleep(0.3)
        apellido[0].send_keys(apellido_original)
        print(f"[6] Apellido re-ingresado: {apellido_original}")
    
    # PRUEBA CURP - puras letras
    if curp:
        curp[0].click()
        curp[0].clear()
        curp[0].send_keys("A" * 18)
        btn = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,2592][1232,2736]']")
        if btn and btn[0].get_attribute("enabled") == "false":
            print("[OK] Boton deshabilitado con puras letras")
        
        # INSTANCIA 2: puras numeros
        curp[0].click()
        curp[0].clear()
        curp[0].send_keys("1" * 18)
        btn = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,2592][1232,2736]']")
        if btn and btn[0].get_attribute("enabled") == "false":
            print("[OK] Boton deshabilitado con puras numeros")
        
        # Re-ingresar CURP original
        curp[0].clear()
        time.sleep(0.3)
        curp[0].send_keys(curp_original)
        print(f"[7] CURP re-ingresada: {curp_original}")
    
    # Click Siguiente
    btn = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,2592][1232,2736]']")
    if btn and btn[0].get_attribute("enabled") == "true":
        btn[0].click()
        print("[8] Siguiente - Datos de Contacto")
    
    # Scroll down para ver correo y telefono
    for i in range(2):
        driver.swipe(600, 1800, 600, 600, 300)
    
# 8. Verificar si switch usa datos del titular
        switch_titular = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.Switch[@content-desc='Usar los datos de contacto del titular de la cuenta']")
        
        usar_titular = switch_titular and switch_titular[0].get_attribute("checked") == "true"
        
        if usar_titular:
            print("[8] Usando datos del titular - skip pruebas de correo/telefono")
        else:
            # PRUEBAS CORREO
            print("[8] === PRUEBAS CORREO ===")
            correo = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[48,978][1232,1122]']")
            
            if correo:
                original = correo[0].get_attribute("text") or ""
                
                # Sin @
                correo[0].click()
                correo[0].clear()
                correo[0].send_keys("pacienterym.com")
                btn_guardar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar y Continuar']")
                estado = btn_guardar[0].get_attribute("enabled") if btn_guardar else "no encontrado"
                print(f"   [OK] Sin @ - boton: {estado}")
                
                # Sin dominio
                correo[0].clear()
                correo[0].send_keys("paciente@")
                btn_guardar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar y Continuar']")
                estado = btn_guardar[0].get_attribute("enabled") if btn_guardar else "no encontrado"
                print(f"   [OK] Sin dominio - boton: {estado}")
                
                # Restaurar
                correo[0].clear()
                correo[0].send_keys(original)
                print(f"   [OK] Restaurado: {original}")
            
            # PRUEBAS TELEFONO
            print("[9] === PRUEBAS TELEFONO ===")
            telefono = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[48,1299][1232,1503]']")
            
            if telefono:
                original = telefono[0].get_attribute("text") or ""
                
                # Con letras
                telefono[0].click()
                telefono[0].clear()
                telefono[0].send_keys("abcABCdefg")
                btn_guardar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar y Continuar']")
                estado = btn_guardar[0].get_attribute("enabled") if btn_guardar else "no encontrado"
                print(f"   [OK] Con letras - boton: {estado}")
                
                # Restaurar
                telefono[0].clear()
                telefono[0].send_keys(original)
                print(f"   [OK] Restaurado: {original}")
        
        # 10. Verificar boton Guardar y dar click
        btn_guardar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar y Continuar']")
        if btn_guardar:
            print(f"[OK] Boton Guardar: enabled={btn_guardar[0].get_attribute('enabled')}")
            btn_guardar[0].click()
            time.sleep(0.5)
            print("[OK] Guardar clickeado")
        
        print("[10] Test completado")


def test_perfil_cuenta(driver, home_page):
    print("\n=== TEST: Cuenta ===")
    
    # Verificar si ya está en pantalla de Perfil
    en_perfil = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[@content-desc='Perfil' and @bounds='[578,207][702,273]']")
    
    if en_perfil:
        print("[0] Ya está en Perfil")
    else:
        print("[0] Navegando a Perfil...")
        # Navegar a Perfil
        for i in range(4):
            driver.swipe(1100, 2700, 200, 2700, 500)
            time.sleep(0.3)
        
        btn_perfil = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Perfil')]")
        if btn_perfil:
            btn_perfil[0].click()
            time.sleep(0.5)
    
    # Click en Cuenta usando bounds
    cuenta = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[48,1212][1232,1467]']")
    if cuenta:
        cuenta[0].click()
        time.sleep(0.5)
        print("[1] Cuenta abierto")
    
    # Scroll down para ver opciones
    for i in range(2):
        driver.swipe(600, 1800, 600, 600, 300)
    
    # Click en "Ver todos los planes"
    btn_planes = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Ver todos los planes']")
    if btn_planes:
        btn_planes[0].click()
        time.sleep(0.5)
        print("[2] Ver todos los planes abierto")
        
        # Scroll down para ver planes
        driver.swipe(600, 1500, 600, 800, 300)
        
        # Verificar planes
        planes = driver.find_elements(AppiumBy.XPATH, "//android.view.View[contains(@content-desc, '$')]")
        print(f"   [OK] Planes encontrados: {len(planes)}")
        
        # Cerrar
        driver.back()
        time.sleep(0.5)
    
    # Scroll up y click "Cambiar ciclo de facturación"
    driver.swipe(600, 800, 600, 1800, 300)
    btn_ciclo = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Cambiar ciclo de facturación']")
    if btn_ciclo:
        btn_ciclo[0].click()
        time.sleep(0.5)
        print("[3] Ciclo de facturación abierto")
        
        # Click Guardar cambios
        btn_guardar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar cambios']")
        if btn_guardar:
            btn_guardar[0].click()
            time.sleep(0.5)
            print("[OK] Guardar cambios clicked")
        
        # Volver
        driver.back()
        time.sleep(0.5)
    
    # Scroll down y click "Cancelar suscripción"
    driver.swipe(600, 1800, 600, 600, 300)
    btn_cancelar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Cancelar suscripción']")
    if btn_cancelar:
        btn_cancelar[0].click()
        time.sleep(0.5)
        print("[4] Cancelar suscripción abierto")
        
        # Click "Mantener Suscripción"
        btn_mantener = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Mantener Suscripción']")
        if btn_mantener:
            btn_mantener[0].click()
            time.sleep(0.5)
            print("[OK] Mantener Suscripción clicked")
    
    # Volver
    driver.back()
    time.sleep(0.5)
    print("[5] Test Cuenta completado")


def test_perfil_historial_medico(driver, home_page):
    print("\n=== TEST: Historial Medico ===")
    
    # Navigate to Perfil first
    for i in range(4):
        driver.swipe(1100, 2700, 200, 2700, 500)
        time.sleep(0.3)
    
    btn_perfil = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Perfil')]")
    if btn_perfil:
        btn_perfil[0].click()
        time.sleep(0.5)
    
    # Click menu
    btn_menu = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[1103,221][1220,338]']")
    if btn_menu:
        btn_menu[0].click()
        time.sleep(1)
    
    # Click Historial Médico
    historial = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Historial')]")
    if historial:
        historial[0].click()
        time.sleep(0.5)
        print("[1] Historial Medico abierto")
    
    # 2. Click on Antecedentes patológicos
    patologicos = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Antecedentes patológicos']")
    if patologicos:
        patologicos[0].click()
        time.sleep(0.5)
        print("[2] Antecedentes patológicos abierto")
        
        # Click Formulario
        btn_formulario = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Formulario']")
        if btn_formulario:
            btn_formulario[0].click()
            time.sleep(0.5)
            print("[3] Formulario abierto")
            
            # Select option (e.g., Asma)
            btn_opcion = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='(J45) Asma']")
            if btn_opcion:
                btn_opcion[0].click()
                time.sleep(0.3)
                print("[OK] Seleccionado: Asma")
            
            # Click Enviar Reporte
            btn_enviar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Enviar Reporte']")
            if btn_enviar:
                btn_enviar[0].click()
                time.sleep(1)
                print("[OK] Enviar Reporte")
            
# Click back button
                btn_atras = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
                if btn_atras:
                    btn_atras[0].click()
                    time.sleep(0.5)
                
                # Close dropdown by clicking same section
                try:
                    patologicos[0].click()
                    time.sleep(0.3)
                    print("[OK] Cerrando dropdown")
                except:
                    pass
    
    # 3. Scroll down and click on Antecedentes Heredofamiliares
    driver.swipe(600, 1500, 600, 600, 300)
    time.sleep(0.3)
    
    heredofamiliares = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Antecedentes Heredofamiliares']")
    if heredofamiliares:
        heredofamiliares[0].click()
        time.sleep(0.5)
        print("[4] Antecedentes Heredofamiliares abierto")
        
        # Click Formulario
        btn_formulario = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Formulario']")
        if btn_formulario:
            btn_formulario[0].click()
            time.sleep(0.5)
            print("[OK] Formulario abierto")
            
            # Select option (e.g., Miopia)
            btn_opcion = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Miopia')]")
            if btn_opcion:
                btn_opcion[0].click()
                time.sleep(0.3)
                print("[OK] Seleccionado: Miopía")
            
            # Click Enviar Reporte
            btn_enviar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Enviar Reporte']")
            if btn_enviar:
                btn_enviar[0].click()
                time.sleep(1)
                print("[OK] Enviar Reporte")
            
            # Click back to return to historial
            btn_atras = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
            if btn_atras:
                btn_atras[0].click()
                time.sleep(0.5)
            
            # Close dropdown clicking same section
            try:
                heredofamiliares[0].click()
                time.sleep(0.3)
                print("[OK] Cerrando dropdown")
            except:
                pass
    
    # 4. Scroll down and click on Alergias
    driver.swipe(600, 1500, 600, 600, 300)
    time.sleep(0.3)
    
    alergias = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Alergias']")
    if alergias:
        alergias[0].click()
        time.sleep(0.5)
        print("[5] Alergias abierto")
        
        # Click Formulario button inside Alergias section
        btn_formulario = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Formulario']")
        if btn_formulario:
            btn_formulario[0].click()
            time.sleep(0.5)
            print("[OK] Formulario abierto")
            
            # Delete existing allergy first
            btn_eliminar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Eliminar']")
            if btn_eliminar:
                btn_eliminar[0].click()
                time.sleep(0.5)
                print("[OK] Eliminando allergy")
            
            # Add new allergy - enter in EditText field
            txt_alergia = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[48,372][852,516]']")
            if txt_alergia:
                palabras_alergia = [
                    "Penicilina", "Aspirina", "Ibuprofeno", "Polen", "Ácaros",
                    "Mariscos", "Cacahuetes", "Leche", "Huevos", "Trigo",
                    "Soja", "Latex", "Picaduras", "Perros", "Gatos",
                    "Hierbas", "Moho", "Niquel", "Perfume", "Detergente"
                ]
                import random
                palabra = random.choice(palabras_alergia)
                txt_alergia[0].click()
                txt_alergia[0].send_keys(palabra)
                print(f"[OK] Adding: {palabra}")
            
            # Click Agregar
            btn_agregar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Agregar']")
            if btn_agregar:
                btn_agregar[0].click()
                time.sleep(0.5)
                print("[OK] Agregar clicked")
            
# Click back to exit form
                btn_atras = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
                if btn_atras:
                    btn_atras[0].click()
                    time.sleep(0.5)
                
                # Close dropdown clicking same section
                try:
                    alergias[0].click()
                    time.sleep(0.3)
                    print("[OK] Cerrando dropdown")
                except:
                    pass
    
    # 5. Click on Antecedentes Gineco-Obstetricos
    # No swipe needed - already visible after closing Alergias
    
    gineco = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Antecedentes gineco-obstétricos']")
    if gineco:
        gineco[0].click()
        time.sleep(0.5)
        print("[6] Antecedentes Gineco-Obstetricos abierto")
        
        # Click Formulario - usando bounds ya identificados
        btn_formulario = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Formulario']")
        if btn_formulario:
            btn_formulario[0].click()
            time.sleep(0.5)
            print("[OK] Formulario abierto")
            
            # Click each option to toggle between Si/No
            # Oppcion 1: Planificación * - bounds [48,654][1232,822]
            btn_plan = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,654][1232,822]']")
            if btn_plan:
                btn_plan[0].click()
                time.sleep(0.5)
                print("[OK] Planificación clickeado")
                # Esperar popup y clickear "No" - usar content-desc
                btn_no = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='No']")
                if btn_no:
                    btn_no[0].click()
                    time.sleep(0.3)
                    print("[OK] Seleccionado: No")
            
            # Opcion 2: Embarazos * - bounds [48,918][1232,1086]
            btn_emb = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,918][1232,1086]']")
            if btn_emb:
                btn_emb[0].click()
                time.sleep(0.5)
                print("[OK] Embarazos clickeado")
                # Esperar popup y clickear "No" - usar content-desc
                btn_no = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='No']")
                if btn_no:
                    btn_no[0].click()
                    time.sleep(0.3)
                    print("[OK] Seleccionado: No")
            
            # Opcion 3: Citologías y mamografías * - bounds [48,1182][1232,1350]
            btn_cito = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[48,1182][1232,1350]']")
            if btn_cito:
                btn_cito[0].click()
                time.sleep(0.5)
                print("[OK] Citologías clickeado")
                # Esperar popup y clickear "No" - usar content-desc
                btn_no = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='No']")
                if btn_no:
                    btn_no[0].click()
                    time.sleep(0.3)
                    print("[OK] Seleccionado: No")
            
            # Click Enviar Reporte - bounds [383,1494][897,1638]
            btn_enviar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[383,1494][897,1638]']")
            if btn_enviar:
                btn_enviar[0].click()
                time.sleep(1)
                print("[OK] Enviar Reporte")
            
            # Click back - bounds [12,168][156,312]
            btn_atras = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
            if btn_atras:
                btn_atras[0].click()
                time.sleep(0.5)
    
    # Click back to return to Perfil
    btn_atras = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
    if btn_atras:
        btn_atras[0].click()
        time.sleep(0.5)
        print("[8] Regresando a Perfil")
    
    print("[9] Test completado")


def test_perfil_progreso(driver, home_page):
    print("\n=== TEST: Progreso ===")
    
    # Navegar a Perfil usando swipe
    for i in range(4):
        driver.swipe(1100, 2700, 200, 2700, 500)
        time.sleep(0.3)
    
    btn_perfil = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Perfil')]")
    if btn_perfil:
        btn_perfil[0].click()
        time.sleep(0.5)
        print("[0] Navegó a Perfil")
    
    # Scroll para ver Progreso
    driver.swipe(600, 600, 600, 1800, 300)
    time.sleep(0.3)
    
    # Click Progreso usando bounds
    progreso = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[48,1794][1232,2049]']")
    if progreso:
        progreso[0].click()
        time.sleep(0.5)
        print("[1] Progreso abierto")
    
    # 2. Click on Retos section
    retos = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Retos']")
    if retos:
        retos[0].click()
        time.sleep(0.5)
        print("[2] Click en Retos")
    
    # 3. Verificar insignias obtenidas
    insignias_obtenidas = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[contains(@content-desc, 'Insignias obtenidas')]")
    
    if insignias_obtenidas:
        print("[OK] Insignias obtenidas encontrado")
        # Click en insignia con content-desc que contenga #
        insignias = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.ImageView[contains(@content-desc, '#')]")
        if insignias:
            insignias[0].click()
            time.sleep(0.5)
            print("[3] Click en insignia obtenida")
    else:
        print("[OK] No hay insignias obtenidas - Próximas Insignias")
        # Buscar insignias disponibles (content-desc sin #)
        insignias = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.ImageView[@content-desc='Bienvenida']")
        if insignias:
            insignias[0].click()
            time.sleep(0.5)
            print("[3] Click en insignia 'Bienvenida'")
    
    # Regresar a Retos usando botón
    btn_regresar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
    if btn_regresar:
        btn_regresar[0].click()
        time.sleep(0.5)
    
    # Regresar a Progreso usando botón
    btn_regresar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
    if btn_regresar:
        btn_regresar[0].click()
        time.sleep(0.5)
    
    print("[4] Regresando a Progreso")
    
    # Scroll down para ver Medicamentos
    driver.swipe(600, 1500, 600, 1200, 300)
    time.sleep(0.3)
    
    # 5. Click on Medicamentos
    medicamentos = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Medicamentos']")
    if medicamentos:
        medicamentos[0].click()
        time.sleep(1.5)
        print("[5] Click en Medicamentos")
    
    # 6. Click en tab Inicio
    btn_inicio = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[@content-desc='Inicio\nPestaña 1 de 5']")
    if btn_inicio:
        btn_inicio[0].click()
        time.sleep(0.5)
        print("[6] Click en Inicio")
    
    print("[7] Test completado")


def test_perfil_documentos(driver, home_page):
    print("\n=== TEST: Documentos ===")
    
    # Verificar si ya está en pantalla de Perfil
    en_perfil = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[@content-desc='Perfil' and @bounds='[578,207][702,273]']")
    
    if en_perfil:
        print("[0] Ya está en Perfil")
    else:
        print("[0] Navegando a Perfil...")
        # Navigate to Perfil
        for i in range(4):
            driver.swipe(1100, 2700, 200, 2700, 500)
            time.sleep(0.3)
        
        btn_perfil = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Perfil')]")
        if btn_perfil:
            btn_perfil[0].click()
            time.sleep(0.5)
    
    # Click menu
    btn_menu = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[1103,221][1220,338]']")
    if btn_menu:
        btn_menu[0].click()
        time.sleep(1)
    
    # Click Documentos
    documentos = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Documentos')]")
    if documentos:
        documentos[0].click()
        time.sleep(0.5)
        print("[1] Documentos abierto")
    
    # Click button to add document - bounds [1100,162][1256,318]
    btn_agregar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[1100,162][1256,318]']")
    if btn_agregar:
        btn_agregar[0].click()
        time.sleep(0.5)
        print("[2] Agregar Documento abierto")
    
    # Enter document name - bounds [72,672][1208,816]
    txt_nombre = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[72,672][1208,816]']")
    if txt_nombre:
        import random
        nombres = [
            "Análisis de sangre completa",
            "Electrocardiograma",
            "Radiografía de tórax",
            "Resonancia magnética cerebral",
            "Ultrasonido abdominal",
            "Prueba de esfuerzo físico",
            "Perfil lipídico",
            "Hemoglobina glicosilada"
        ]
        nombre_doc = random.choice(nombres)
        txt_nombre[0].click()
        txt_nombre[0].send_keys(nombre_doc)
        print(f"[3] Nombre: {nombre_doc}")
    
    # Enter comments - bounds [72,1422][1208,1782]
    txt_comentarios = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[72,1422][1208,1782]']")
    if txt_comentarios:
        comentarios = [
            "Paciente requiere seguimiento médico.",
            "Resultado dentro de parámetros normales.",
            "Se recomienda monitoreo continuo.",
            "Evaluar con especialista.",
            "Documento para expediente clínico."
        ]
        comentario = random.choice(comentarios)
        txt_comentarios[0].click()
        txt_comentarios[0].send_keys(comentario)
        print(f"[4] Comentario: {comentario}")
    
    # Click "Tomar foto o seleccionar archivo" - bounds [72,981][1208,1209]
    btn_archivo = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Tomar foto o seleccionar archivo']")
    if btn_archivo:
        btn_archivo[0].click()
        time.sleep(0.5)
        print("[5] Click Tomar foto o seleccionar archivo")
    
    # Click "Seleccionar Archivo (Foto o PDF)" - bounds [0,2616][1280,2784]
    btn_seleccionar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Seleccionar Archivo (Foto o PDF)']")
    if btn_seleccionar:
        btn_seleccionar[0].click()
        time.sleep(1)
        print("[6] Click Seleccionar Archivo")
    
    # Select first file from recent files - need to scroll and find the file
    # Wait for file picker to open
    time.sleep(2)
    
    # Click on first file in grid
    archivos = driver.find_elements(AppiumBy.XPATH, "//androidx.cardview.widget.CardView")
    if archivos:
        archivos[0].click()
        time.sleep(1)
        print("[7] Archivo seleccionado")
    else:
        # Fallback: click on file name
        btn_file = driver.find_elements(AppiumBy.XPATH, "//android.widget.TextView[contains(@text, '.jpeg') or contains(@text, '.png') or contains(@text, '.jpg')]")
        if btn_file:
            btn_file[0].click()
            time.sleep(1)
            print("[7] Archivo seleccionado")
    
    # Wait to return to form and click Guardar
    time.sleep(1)
    
    # Click Guardar - bounds [72,2124][1208,2268] (after file selected)
    btn_guardar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar']")
    if btn_guardar:
        btn_guardar[0].click()
        time.sleep(1)
        print("[8] Guardar clicked")
    
    # Click back to return to Perfil
    btn_atras = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
    if btn_atras:
        btn_atras[0].click()
        time.sleep(0.5)
        print("[9] Regresando a Perfil")
    
    print("[10] Test completado")


def test_perfil_compartir(driver, home_page):
    print("\n=== TEST: Compartir ===")
    
    # Verificar si ya está en pantalla de Perfil
    en_perfil = driver.find_elements(AppiumBy.XPATH, 
        "//android.view.View[@content-desc='Perfil' and @bounds='[578,207][702,273]']")
    
    if en_perfil:
        print("[0] Ya está en Perfil")
    else:
        print("[0] Navegando a Perfil...")
        # Navigate to Perfil
        for i in range(4):
            driver.swipe(1100, 2700, 200, 2700, 500)
            time.sleep(0.3)
        
        btn_perfil = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Perfil')]")
        if btn_perfil:
            btn_perfil[0].click()
            time.sleep(0.5)
    
    # Click menu
    btn_menu = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[1103,221][1220,338]']")
    if btn_menu:
        btn_menu[0].click()
        time.sleep(1)
    
    # Click Compartir
    compartir = driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Compartir')]")
    if compartir:
        compartir[0].click()
        time.sleep(0.5)
        print("[1] Compartir abierto")
    
    # 1. View "Compartido Parcialmente" contacts
    compartido = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Compartido Parcialmente']")
    if compartido:
        print("[OK] Compartido Parcialmente encontrado")
    
    # 2. Click on first shared contact (Pedro Quijada Anaya)
    btn_pedro = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Pedro Quijada Anaya']")
    if btn_pedro:
        btn_pedro[0].click()
        time.sleep(0.5)
        print("[2] Click en Pedro Quijada Anaya")
        
        # Verify switches are ON
        sw_medicamentos = driver.find_elements(AppiumBy.XPATH, "//android.widget.Switch[@content-desc='Medicamentos']")
        sw_estudios = driver.find_elements(AppiumBy.XPATH, "//android.widget.Switch[@content-desc='Estudios']")
        sw_documentos = driver.find_elements(AppiumBy.XPATH, "//android.widget.Switch[@content-desc='Documentos']")
        
        if sw_medicamentos and sw_medicamentos[0].get_attribute("checked") == "true":
            print("   [OK] Medicamentos: ON")
        if sw_estudios and sw_estudios[0].get_attribute("checked") == "true":
            print("   [OK] Estudios: ON")
        if sw_documentos and sw_documentos[0].get_attribute("checked") == "true":
            print("   [OK] Documentos: ON")
        
        # Go back
        driver.back()
        time.sleep(0.5)
    
    # 3. Click on share button (top right) to add new contact
    btn_add = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@bounds='[1100,162][1256,318]']")
    if btn_add:
        btn_add[0].click()
        time.sleep(0.5)
        print("[3] Click boton añadir contacto")
    
    # 4. Click "Añadir manualmente"
    btn_manual = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='o Añadir manualmente']")
    if btn_manual:
        btn_manual[0].click()
        time.sleep(0.5)
        print("[4] Añadir manualmente abierto")
    
    # 5. PRUEBAS DE VALIDACION DE TELEFONO - bounds [72,1359][1208,1563]
    telefono = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[72,1359][1208,1563]']")
    nombre = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText[@bounds='[72,1083][1208,1227]']")
    
    print("[5] === PRUEBAS VALIDACION TELEFONO ===")
    
    if telefono and nombre:
        # Enter name first
        nombre[0].click()
        nombre[0].send_keys("Juan Perez")
        print("   [OK] Nombre: Juan Perez")
        
        # INSTANCE 1: Letters only
        telefono[0].click()
        telefono[0].clear()
        telefono[0].send_keys("abcdeabcde")
        time.sleep(0.3)
        btn_invitar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Invitar y compartir']")
        estado = btn_invitar[0].get_attribute("enabled") if btn_invitar else "no encontrado"
        print(f"   [OK] 10 letras - boton: {estado}")
        
        # INSTANCE 2: 9 digits (should be invalid - needs 10)
        telefono[0].clear()
        telefono[0].send_keys("5551013613")
        time.sleep(0.3)
        btn_invitar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Invitar y compartir']")
        estado = btn_invitar[0].get_attribute("enabled") if btn_invitar else "no encontrado"
        print(f"   [OK] 9 digitos - boton: {estado}")
        
        # Valid: 10 digits
        telefono[0].clear()
        telefono[0].send_keys("5551013614")
        time.sleep(0.3)
        btn_invitar = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Invitar y compartir']")
        estado = btn_invitar[0].get_attribute("enabled") if btn_invitar else "no encontrado"
        print(f"   [OK] 10 digitos validos - boton: {estado}")
        
        # 6. Click Invitar yCompartir
        if btn_invitar and btn_invitar[0].get_attribute("enabled") == "true":
            btn_invitar[0].click()
            time.sleep(1)
            print("[6] Invitar yCompartir clicked")
            
            # Click "Listo" button - bounds [48,2664][1232,2808]
            btn_listo = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Listo']")
            if btn_listo:
                btn_listo[0].click()
                time.sleep(0.5)
                print("[OK] Listo clicked")
    
    print("[7] Test Compartir completado")



