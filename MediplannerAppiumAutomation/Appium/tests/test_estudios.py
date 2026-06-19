"""
Test para pestaña de Estudios - Ver lista de estudios y detalles
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy


def test_estudios_ver_lista_detalles(driver, home_page):
    """Test Estudios - navegar a la pestana, ver lista y ver detalles de un estudio"""
    print("\n=== TEST: Estudios - Ver Lista y Detalles ===")
    
    # Esperar a que la app este lista
    time.sleep(5)
    
    # Navegar a Estudios usando bounds
    btn_estudios = (AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[1024,2595][1280,2784]']")
    home_page.hacer_click(btn_estudios)
    time.sleep(3)
    time.sleep(2)
    
    # Verificar que estamos en la pestana de Estudios
    titulo_estudios = (AppiumBy.XPATH, "//android.view.View[@content-desc='Estudios']")
    if home_page.esta_visible(titulo_estudios, timeout=3):
        print("Pantalla de Estudios cargada correctamente")
    else:
        print("Advertencia: No se detecto claramente la pantalla de Estudios")
    
    time.sleep(1)
    
    # 1. Buscar estudios - elementos con fechas (formato DD/MM/AAAA)
    try:
        estudios = driver.find_elements(AppiumBy.XPATH, 
            "//android.view.View[contains(@content-desc, '/20')]")
    except:
        print("Advertencia: Error al buscar estudios")
        estudios = []
    
    print(f"Estudios encontrados: {len(estudios)}")
    
    if estudios:
        # Mostrar informacion de todos los estudios encontrados
        for i, estudio in enumerate(estudios):
            try:
                info = estudio.get_attribute("content-desc")
                if info:
                    nombre = info.split('\n')[0] if '\n' in info else info
                    print(f"Estudio {i+1}: {nombre[:60]}{'...' if len(nombre) > 60 else ''}")
            except:
                print(f"Estudio {i+1}: [informacion no disponible]")
        
        # 2. Seleccionar un estudio aleatorio
        indice = random.randint(0, len(estudios) - 1)
        estudio_seleccionado = estudios[indice]
        
        estudio_info = estudio_seleccionado.get_attribute("content-desc")
        nombre_estudio = estudio_info.split('\n')[0] if '\n' in estudio_info else estudio_info
        print(f"\nSeleccionando estudio aleatorio #{indice + 1}: {nombre_estudio[:50]}...")
        
        # Hacer click en el estudio seleccionado
        estudio_bounds = estudio_seleccionado.get_attribute("bounds")
        estudio_locator = (AppiumBy.XPATH, f"//android.view.View[@bounds='{estudio_bounds}']")
        home_page.hacer_click(estudio_locator)
        time.sleep(3)
        print("Viendo detalles del estudio seleccionado")
        
        # 3. Verificar que se cargo la pagina de detalles
        indicadores_detalle = [
            (AppiumBy.XPATH, "//android.view.View[@content-desc='Archivos']"),
            (AppiumBy.XPATH, "//android.view.View[@content-desc='Interpretacion']"),
            (AppiumBy.XPATH, "//android.view.View[@content-desc='Indicaciones']"),
            (AppiumBy.XPATH, "//android.view.View[contains(@content-desc, '/20')]"),
        ]
        
        detalle_cargado = False
        for elemento in indicadores_detalle:
            if home_page.esta_visible(elemento, timeout=3):
                print("Pagina de detalles cargada correctamente")
                detalle_cargado = True
                break
        
        if not detalle_cargado:
            print("Advertencia: No se pudo verificar claramente los detalles del estudio")
        
        # 4. Regresar a la lista de estudios
        driver.back()
        time.sleep(2)
        print("Volviendo a la lista de estudios")
        
        # 5. Click en boton "+" para agregar estudio
        btn_agregar = (AppiumBy.XPATH, "//android.widget.Button[@bounds='[1136,168][1280,312]']")
        home_page.hacer_click(btn_agregar)
        time.sleep(2)
        print("Click en Agregar estudio")
        
        # Verificar pantalla de agregar estudio
        pantalla_agregar = (AppiumBy.XPATH, "//android.view.View[@content-desc='Agregar estudio']")
        if home_page.esta_visible(pantalla_agregar, timeout=3):
            print("Pantalla de Agregar estudio cargada correctamente")
        
        # 6. Escribir palabra clave para buscar estudio
        palabras_busqueda = [
            "Sangre", "Orina", "Heces", "Quimica", "Biometria", 
            "Ultrasonido", "Rayos", "Resonancia", "Tomografia", "Electro",
            "Cardio", "Hepatico", "Renal", "Tiroides", "Hormonas",
            "Glucosa", "Colesterol", "Trigliceridos", "Protein", "Enzima"
        ]
        
        palabra_busqueda = random.choice(palabras_busqueda)
        campo_busqueda = (AppiumBy.XPATH, "//android.widget.EditText[@hint='Buscar por nombre de estudio']")
        home_page.ingresar_texto(campo_busqueda, palabra_busqueda)
        home_page.ocultar_keyboard()
        time.sleep(2)
        print(f"Buscando estudio con palabra: {palabra_busqueda}")
        
        # 7. Esperar resultados de busqueda y seleccionar uno aleatorio
        resultados = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.Button[@content-desc='Seleccionar']")
        
        if resultados:
            print(f"Resultados de busqueda encontrados: {len(resultados)}")
            indice_resultado = random.randint(0, len(resultados) - 1)
            btn_seleccionar = resultados[indice_resultado]
            btn_bounds = btn_seleccionar.get_attribute("bounds")
            btn_locator = (AppiumBy.XPATH, f"//android.widget.Button[@bounds='{btn_bounds}']")
            home_page.hacer_click(btn_locator)
            time.sleep(2)
            print(f"Seleccionado resultado #{indice_resultado + 1}")
        else:
            print("No se encontraron resultados con esa busqueda")
            driver.back()
            time.sleep(2)
        
        # 8. Click en Siguiente (seleccionar fecha)
        btn_siguiente = (AppiumBy.ACCESSIBILITY_ID, "Siguiente")
        if home_page.esta_visible(btn_siguiente, timeout=5):
            home_page.hacer_click(btn_siguiente)
            time.sleep(2)
            print("Click en Siguiente (seleccionar fecha)")
        
        # 9. Click en "Tomar foto o seleccionar archivo"
        btn_subir = (AppiumBy.XPATH, "//android.view.View[@content-desc='Tomar foto o seleccionar archivo']")
        if home_page.esta_visible(btn_subir, timeout=5):
            home_page.hacer_click(btn_subir)
            time.sleep(2)
            print("Click en Tomar foto o seleccionar archivo")
        
        # 10. Click en "Seleccionar Archivo (Foto o PDF)"
        btn_seleccionar_archivo = (AppiumBy.ACCESSIBILITY_ID, "Seleccionar Archivo (Foto o PDF)")
        if home_page.esta_visible(btn_seleccionar_archivo, timeout=5):
            home_page.hacer_click(btn_seleccionar_archivo)
            time.sleep(3)
            print("Click en Seleccionar Archivo")
            
            # 11. Seleccionar un archivo aleatorio del explorador
            archivos = driver.find_elements(AppiumBy.XPATH, 
                "//android.widget.ImageView[@resource-id='com.google.android.documentsui:id/icon_thumb']")
            
            if archivos:
                print(f"Archivos encontrados: {len(archivos)}")
                indice_archivo = random.randint(0, len(archivos) - 1)
                archivo_seleccionado = archivos[indice_archivo]
                archivo_bounds = archivo_seleccionado.get_attribute("bounds")
                archivo_locator = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{archivo_bounds}']")
                home_page.hacer_click(archivo_locator)
                time.sleep(2)
                print(f"Seleccionado archivo #{indice_archivo + 1}")
            else:
                print("No se encontraron archivos para seleccionar")
        
        # 12. Click en Siguiente (confirmar archivo)
        btn_siguiente = (AppiumBy.ACCESSIBILITY_ID, "Siguiente")
        if home_page.esta_visible(btn_siguiente, timeout=5):
            home_page.hacer_click(btn_siguiente)
            time.sleep(2)
            print("Click en Siguiente (confirmar archivo)")
        
# 13. Escribir comentarios usando hint
            try:
                campo_comentarios = driver.find_element(AppiumBy.XPATH, 
                    "//android.widget.EditText[@hint='Puede agregar comentarios o notas referentes al documento cargado.']")
                if campo_comentarios:
                    # Click para enfocar el campo
                    campo_comentarios.click()
                    time.sleep(1)
                    # Escribir comentarios
                    campo_comentarios.send_keys("Estudio de prueba automatizado")
                    time.sleep(2)
                    # Verificar texto
                    texto = campo_comentarios.text
                    if texto and ("Estudio" in texto or "prueba" in texto):
                        print("Comentarios escritos correctamente")
                    else:
                        print("Advertencia: No se verfico el texto")
            except Exception as e:
                print(f"No se encontro campo de comentarios")
        
        # 14. Click en Finalizar
        btn_finalizar = (AppiumBy.ACCESSIBILITY_ID, "Finalizar")
        if home_page.esta_visible(btn_finalizar, timeout=5):
            home_page.hacer_click(btn_finalizar)
            time.sleep(2)
            print("Click en Finalizar")
        
        # 15. Buscar el estudio registrado hoy para verificar
        print("Buscando el estudio registrado para verificar...")
        try:
            estudios_nuevos = driver.find_elements(AppiumBy.XPATH, 
                "//android.view.View[contains(@content-desc, '17/04/2026')]")
        except:
            print("Advertencia: No se pudo buscar estudios (Appium desconectado)")
            estudios_nuevos = []
        
        if estudios_nuevos:
            print(f"Estudios encontrados con fecha de hoy: {len(estudios_nuevos)}")
            estudio_reciente = estudios_nuevos[0]
            estudio_bounds = estudio_reciente.get_attribute("bounds")
            estudio_locator = (AppiumBy.XPATH, f"//android.view.View[@bounds='{estudio_bounds}']")
            home_page.hacer_click(estudio_locator)
            time.sleep(2)
            print("Entrando al estudio registrado para verificar")
            
            # Verificar elementos del estudio
            indicadores = [
                (AppiumBy.XPATH, "//android.view.View[@content-desc='Archivos']"),
                (AppiumBy.XPATH, "//android.view.View[@content-desc='Interpretacion']"),
            ]
            
            for ind in indicadores:
                if home_page.esta_visible(ind, timeout=3):
                    print(f"Elemento encontrado: {ind[1]}")
            
            # Regresar a la lista
            driver.back()
            time.sleep(2)
            print("Saliendo del estudio verificado")
        else:
            print("No se encontro estudio con fecha de hoy")
        
        # 16. Regresar a Inicio (ignorar errores de conexion)
        try:
            home_page.ir_a_inicio()
            time.sleep(2)
        except:
            print("Advertencia: Error al regresar a Inicio")
        print("Test completado - Regresando a Inicio")
        home_page.ir_a_inicio()
        time.sleep(2)
        print("Test completado - Regresando a Inicio")
        
    else:
        print("No se encontraron estudios en la lista")
        elementos = driver.find_elements(AppiumBy.XPATH, 
            "//android.view.View[contains(@bounds, '48,') and @clickable='true']")
        print(f"Elementos clicables encontrados: {len(elementos)}")
        
        if elementos:
            print("Intentando seleccionar primer elemento...")
            primero = elementos[0]
            bounds = primero.get_attribute("bounds")
            locator = (AppiumBy.XPATH, f"//android.view.View[@bounds='{bounds}']")
            home_page.hacer_click(locator)
            time.sleep(3)
    
    print("Test de Estudios completado")