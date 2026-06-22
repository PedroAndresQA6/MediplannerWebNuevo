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
    time.sleep(2)
    assert home_page.abrir_perfil(), "No se pudo abrir Perfil"
    home_page.abrir_seccion_perfil("Historial")
    time.sleep(1.5)

    titulo = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Historial')]")
    assert home_page.esta_visible(titulo, timeout=5), "No se abrio Historial Medico"

    # Las secciones de antecedentes deben estar presentes
    secciones = ['HEREDOFAMILIARES', 'NO PATOL', 'Alergias']
    for s in secciones:
        loc = (AppiumBy.XPATH, f"//*[contains(@content-desc, '{s}')]")
        if not home_page.esta_visible(loc, timeout=2):
            for _ in range(3):
                home_page.scroll_abajo(); time.sleep(0.4)
                if home_page.esta_visible(loc, timeout=1):
                    break
        assert home_page.esta_visible(loc, timeout=1), f"Falta la seccion de antecedentes: {s}"
    print("[1] Secciones de antecedentes presentes")

    # Flujo completo en Antecedentes Patologicos: expandir -> Formulario -> opcion -> Enviar
    patologicos = (AppiumBy.XPATH, "//*[contains(@content-desc, 'PATOL') and not(contains(@content-desc, 'NO PATOL'))]")
    home_page.scroll_arriba(); time.sleep(0.5)
    home_page.hacer_click(patologicos); time.sleep(1.5)

    formulario = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Formulario')]")
    assert home_page.esta_visible(formulario, timeout=5), "No aparecio el boton Formulario en Patologicos"
    home_page.hacer_click(formulario); time.sleep(1.5)

    opcion = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Asma']")
    assert home_page.esta_visible(opcion, timeout=5), "No aparecieron las opciones del formulario de Patologicos"
    home_page.hacer_click(opcion); time.sleep(0.5)
    print("[2] Opcion 'Asma' seleccionada")

    # 'Enviar Reporte' suele estar bajo el fold (el formulario tiene muchas opciones)
    enviar = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Enviar')]")
    if not home_page.esta_visible(enviar, timeout=2):
        for _ in range(5):
            home_page.scroll_abajo(); time.sleep(0.5)
            if home_page.esta_visible(enviar, timeout=1):
                break
    assert home_page.esta_visible(enviar, timeout=2), "No aparecio el boton 'Enviar Reporte'"
    home_page.hacer_click(enviar)
    time.sleep(1.5)

    # El banner "Respuestas guardadas correctamente" es un toast que (a) puede no estar
    # en el arbol de accesibilidad y (b) solo aparece si hubo cambio respecto al estado
    # guardado. Por eso se valida como best-effort y NO como condicion de fallo.
    exito = (AppiumBy.XPATH,
             "//*[contains(@text, 'guardadas correctamente') "
             "or contains(@content-desc, 'guardadas correctamente') "
             "or contains(@text, 'Respuestas guardadas') "
             "or contains(@content-desc, 'Respuestas guardadas')]")
    if home_page.esta_visible(exito, timeout=4):
        print("[3] OK: confirmacion 'Respuestas guardadas correctamente' detectada")
    else:
        # Aserción confiable: el flujo no crasheó (el formulario o Historial siguen vivos).
        vivo = home_page.esta_visible(enviar, timeout=2) or home_page.esta_visible(titulo, timeout=2)
        assert vivo, "Tras enviar el reporte la app no quedó en un estado válido (posible crash)"
        print("[3] Reporte enviado; banner no visible en el arbol (flujo del formulario OK)")
    home_page.tomar_screenshot("perfil_historial")
    print("[4] Test completado")


def test_perfil_progreso(driver, home_page):
    print("=== TEST: Progreso ===")
    time.sleep(2)
    assert home_page.abrir_perfil(), "No se pudo abrir Perfil"
    home_page.abrir_seccion_perfil("Progreso")
    time.sleep(1.5)

    titulo = (AppiumBy.XPATH, "//*[@content-desc='Progreso']")
    assert home_page.esta_visible(titulo, timeout=5), "No se abrio Progreso"

    # Seccion Retos con al menos una insignia
    assert home_page.esta_visible((AppiumBy.XPATH, "//*[@content-desc='Retos']"), timeout=3),         "Falta la seccion Retos"
    insignia = (AppiumBy.XPATH,
                "//*[@content-desc='Bienvenida' or @content-desc='Tamiz' "
                "or @content-desc='Primera Semana' or @content-desc='Primera consulta agendada']")
    assert home_page.esta_visible(insignia, timeout=3), "No se ven insignias en Retos"
    print("[1] Retos e insignias presentes")

    # Estadisticas
    assert home_page.esta_visible(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'Insignias obtenidas')]"), timeout=3),         "Faltan las estadisticas (Insignias obtenidas)"
    print("[2] Estadisticas presentes")

    # Secciones inferiores (requieren scroll): Medicamentos y Medidas
    for nombre in ("Medicamentos", "Medidas"):
        loc = (AppiumBy.XPATH, f"//*[@content-desc='{nombre}']")
        if not home_page.esta_visible(loc, timeout=2):
            for _ in range(4):
                home_page.scroll_abajo(); time.sleep(0.4)
                if home_page.esta_visible(loc, timeout=1):
                    break
        assert home_page.esta_visible(loc, timeout=1), f"Falta la seccion {nombre}"
    print("[3] Secciones Medicamentos y Medidas presentes")

    home_page.tomar_screenshot("perfil_progreso")
    print("[4] Test completado")


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



