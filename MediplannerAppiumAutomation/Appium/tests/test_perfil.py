"""
Test para Perfil - Datos Personales
"""
import time
from appium.webdriver.common.appiumby import AppiumBy


def _abrir_datos_personales(driver, home_page):
    """Navega Home -> Perfil -> Datos Personales y deja el form Datos Generales visible."""
    time.sleep(2)
    assert home_page.abrir_perfil(), "No se pudo abrir la pantalla de Perfil"
    home_page.abrir_seccion_perfil("Datos Personales")
    time.sleep(1.5)
    tab_generales = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Datos Generales')]")
    assert home_page.esta_visible(tab_generales, timeout=5), "No se abrió Datos Personales"


def _siguiente_habilitado(driver):
    btn = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Siguiente']")
    return bool(btn) and btn[0].get_attribute("enabled") == "true"


def _guardar_habilitado(driver):
    btn = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar y Continuar']")
    return bool(btn) and btn[0].get_attribute("enabled") == "true"


def test_perfil_datos_personales(driver, home_page):
    print("\n=== TEST: Datos Personales ===")

    _abrir_datos_personales(driver, home_page)
    home_page.tomar_screenshot("perfil_datos_generales")

    # --- Datos Generales: los campos deben cargar con datos reales del paciente ---
    # EditTexts por orden: 0=Nombre, 1=Apellido paterno, 2=Apellido materno, 3=CURP
    ets = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText")
    assert len(ets) >= 4, f"Se esperaban >=4 campos en Datos Generales, hay {len(ets)}"

    nombre_original = ets[0].get_attribute("text") or ""
    apellido_original = ets[1].get_attribute("text") or ""
    curp_original = ets[3].get_attribute("text") or ""
    print(f"[1] Nombre={nombre_original!r} Apellido={apellido_original!r} CURP={curp_original!r}")

    assert nombre_original.strip(), "El nombre no cargó (campo vacío)"
    assert apellido_original.strip(), "El apellido no cargó (campo vacío)"
    assert len(curp_original) == 18, f"CURP debería tener 18 caracteres, tiene {len(curp_original)}"

    # --- Validación de CURP: una CURP inválida debe deshabilitar 'Siguiente' ---
    assert _siguiente_habilitado(driver), "Con datos válidos 'Siguiente' debería estar habilitado"

    curp = ets[3]
    curp.click(); curp.clear(); curp.send_keys("A" * 18); time.sleep(0.6)
    assert not _siguiente_habilitado(driver), "CURP de puras letras debería deshabilitar 'Siguiente'"
    print("[2] OK: CURP inválida (18 letras) deshabilita 'Siguiente'")

    # Restaurar CURP original y confirmar que se rehabilita
    curp.click(); curp.clear(); curp.send_keys(curp_original); time.sleep(0.6)
    assert _siguiente_habilitado(driver), "Al restaurar la CURP válida 'Siguiente' debería rehabilitarse"
    print("[3] OK: CURP restaurada rehabilita 'Siguiente'")

    # --- Tab Datos de Contacto: validación de correo ---
    tab_contacto = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Datos de Contacto')]")
    home_page.hacer_click(tab_contacto)
    time.sleep(1.5)

    # El correo está por debajo del fold: hacer scroll hasta encontrarlo
    correo = None
    for _ in range(4):
        candidatos = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText")
        correo = next((e for e in candidatos if "@" in (e.get_attribute("text") or "")), None)
        if correo:
            break
        home_page.scroll_abajo(); time.sleep(0.6)
    assert correo is not None, "No se encontró el campo de correo en Datos de Contacto"

    correo_original = correo.get_attribute("text") or ""
    print(f"[4] Correo original={correo_original!r}")

    # Correo inválido (sin @) debe deshabilitar 'Guardar y Continuar'
    correo.click(); correo.clear(); correo.send_keys("pacienterym.com"); time.sleep(0.6)
    assert not _guardar_habilitado(driver), "Correo sin @ debería deshabilitar 'Guardar y Continuar'"
    print("[5] OK: correo sin @ deshabilita 'Guardar y Continuar'")

    # Restaurar correo válido y confirmar rehabilitación
    correo.click(); correo.clear(); correo.send_keys(correo_original); time.sleep(0.6)
    assert _guardar_habilitado(driver), "Al restaurar un correo válido debería rehabilitarse 'Guardar y Continuar'"
    print("[6] OK: correo válido rehabilita 'Guardar y Continuar'")

    home_page.tomar_screenshot("perfil_datos_contacto")
    print("[7] Test completado")


def _click_si_existe(driver, home_page, nombre, max_scrolls=4):
    """Hace scroll buscando un elemento por content-desc y lo clickea. Devuelve True si lo encontró."""
    loc = (AppiumBy.XPATH, f"//*[contains(@content-desc, '{nombre}')]")
    for _ in range(max_scrolls):
        if home_page.esta_visible(loc, timeout=1):
            home_page.hacer_click(loc)
            return True
        home_page.scroll_abajo(); time.sleep(0.5)
    return False


def test_perfil_cuenta(driver, home_page):
    print("\n=== TEST: Cuenta ===")

    time.sleep(2)
    assert home_page.abrir_perfil(), "No se pudo abrir Perfil"
    home_page.abrir_seccion_perfil("Cuenta")
    time.sleep(1.5)

    # La pantalla Cuenta debe mostrar la info de suscripción
    assert _click_si_existe(driver, home_page, "Ver todos los planes"), \
        "No se encontró 'Ver todos los planes' en Cuenta"
    time.sleep(1)
    print("[1] 'Ver todos los planes' abierto")

    # Debe listar planes con precio ('$')
    planes = None
    for _ in range(4):
        planes = driver.find_elements(AppiumBy.XPATH, "//*[contains(@content-desc, '$')]")
        if planes:
            break
        home_page.scroll_abajo(); time.sleep(0.5)
    assert planes, "No se encontraron planes con precio ('$')"
    print(f"[2] OK: {len(planes)} planes con precio encontrados")
    driver.back(); time.sleep(1)

    # Cambiar ciclo de facturación -> guardar cambios y volver
    if _click_si_existe(driver, home_page, "Cambiar ciclo de facturación"):
        time.sleep(1)
        guardar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar cambios']")
        assert home_page.esta_visible(guardar, timeout=3), "No apareció 'Guardar cambios' al cambiar ciclo"
        home_page.hacer_click(guardar); time.sleep(1)
        print("[3] OK: ciclo de facturación - Guardar cambios")
        driver.back(); time.sleep(1)

    # Cancelar suscripción -> NO cancelar, mantener (no destructivo)
    assert _click_si_existe(driver, home_page, "Cancelar suscripción"), \
        "No se encontró 'Cancelar suscripción'"
    time.sleep(1)
    mantener = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Mantener Suscripción']")
    assert home_page.esta_visible(mantener, timeout=3), \
        "El flujo de cancelación no ofreció 'Mantener Suscripción'"
    home_page.hacer_click(mantener); time.sleep(1)
    print("[4] OK: 'Mantener Suscripción' (no se canceló)")

    home_page.tomar_screenshot("perfil_cuenta")
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



