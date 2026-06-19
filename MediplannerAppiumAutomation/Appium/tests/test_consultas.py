"""
Test para pestaña de Consultas - Reprogramar y confirmar cita
Flujo: Cita agendada → Reprogramar → Nueva fecha → Nuevo horario → Confirmar asistencia
"""
import time
import random
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


def test_consultas_programadas(driver, home_page):
    """Test Consultas - Reprogramar cita agendada y confirmar asistencia"""
    print("\n=== TEST: Consultas Programadas ===")

    home_page = volver_inicio(driver, home_page)
    home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Consultas\nPestaña 3 de 5"))
    time.sleep(2)

    titulo_consultas = (AppiumBy.XPATH, "//android.view.View[@content-desc='Mis consultas']")
    if home_page.esta_visible(titulo_consultas, timeout=3):
        print("Pantalla de Consultas cargada correctamente")

    tab_programadas = (AppiumBy.ACCESSIBILITY_ID, "Programadas\nPestaña 1 de 2")
    if home_page.esta_visible(tab_programadas, timeout=2):
        home_page.hacer_click(tab_programadas)
        time.sleep(1)
        print("[1] Pestaña Programadas seleccionada")

    for _ in range(3):
        home_page.scroll_abajo()
        time.sleep(0.5)

    consultas = driver.find_elements(AppiumBy.XPATH,
        "//android.widget.ImageView[contains(@content-desc, 'Dr.')]")

    print(f"Consultas encontradas: {len(consultas)}")

    cita_agendada = None
    for consulta in consultas:
        info = consulta.get_attribute("content-desc")
        if "Agendada" in info:
            cita_agendada = consulta
            print(f"[2] Cita agendada encontrada: {info[:80]}...")
            break

    if not cita_agendada:
        print("No hay citas agendadas, agendando nueva cita desde Médicos...")

        home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Médicos\nPestaña 2 de 5"))
        time.sleep(2)
        print("[2a] Navegando a Médicos")

        doctores = driver.find_elements(AppiumBy.XPATH,
            "//android.view.View[contains(@content-desc, 'Dr.')]")

        if not doctores:
            print("No hay doctores disponibles")
            return

        doctor = doctores[0]
        doctor_bounds = doctor.get_attribute("bounds")
        doctor_locator = (AppiumBy.XPATH, f"//android.view.View[@bounds='{doctor_bounds}']")
        doctor_nombre = doctor.get_attribute("content-desc").split('\n')[0]
        print(f"[2b] Seleccionando doctor: {doctor_nombre}")

        home_page.hacer_click(doctor_locator)
        time.sleep(2)

        btn_solicitar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Solicitar cita']")
        if not home_page.esta_visible(btn_solicitar, timeout=3):
            print("No se encontró botón Solicitar cita")
            return

        home_page.hacer_click(btn_solicitar)
        time.sleep(2)
        print("[2c] Click en Solicitar cita")

        btn_tipo = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Selecciona el tipo de consulta']")
        home_page.hacer_click(btn_tipo)
        time.sleep(1)

        tipos = driver.find_elements(AppiumBy.XPATH,
            "//android.widget.Button[contains(@content-desc, 'Consulta')]")

        if not tipos:
            print("No hay tipos de consulta disponibles")
            return

        tipo_seleccionado = random.choice(tipos)
        tipo_nombre = tipo_seleccionado.get_attribute("content-desc")
        print(f"[2d] Tipo de consulta: {tipo_nombre}")
        tipo_seleccionado.click()
        time.sleep(1)

        fechas = driver.find_elements(AppiumBy.XPATH,
            "//android.view.View[contains(@content-desc, '/') or contains(@content-desc, '26') or contains(@content-desc, '27') or contains(@content-desc, '28') or contains(@content-desc, '29')]")

        fecha_seleccionada = None
        for fecha in fechas:
            if fecha.get_attribute("clickable") == "true":
                fecha_seleccionada = fecha
                print(f"[2e] Fecha: {fecha.get_attribute('content-desc')}")
                fecha.click()
                break

        if not fecha_seleccionada:
            print("No hay fechas disponibles")
            return
        time.sleep(1)

        horarios = driver.find_elements(AppiumBy.XPATH,
            "//android.view.View[contains(@content-desc, ':') and @clickable='true']")

        if not horarios:
            print("No hay horarios disponibles")
            return

        primer_horario = horarios[0]
        horario_nombre = primer_horario.get_attribute("content-desc")
        print(f"[2f] Horario: {horario_nombre}")
        primer_horario.click()
        time.sleep(1)

        btn_solicitar_final = (AppiumBy.XPATH,
            "//android.widget.Button[@content-desc='Solicitar cita' and @enabled='true']")

        if not home_page.esta_visible(btn_solicitar_final, timeout=3):
            print("Botón Solicitar cita no habilitado")
            return

        home_page.hacer_click(btn_solicitar_final)
        time.sleep(3)
        print("[2g] Cita solicitada exitosamente")

        home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Consultas\nPestaña 3 de 5"))
        time.sleep(2)
        print("[2h] Volviendo a Consultas")

        for _ in range(3):
            home_page.scroll_abajo()
            time.sleep(0.5)

        consultas = driver.find_elements(AppiumBy.XPATH,
            "//android.widget.ImageView[contains(@content-desc, 'Dr.')]")

        for consulta in consultas:
            info = consulta.get_attribute("content-desc")
            if "Agendada" in info:
                cita_agendada = consulta
                print(f"[2i] Nueva cita agendada encontrada: {info[:80]}...")
                break

        if not cita_agendada:
            print("No se pudo crear cita agendada")
            return

    consulta_bounds = cita_agendada.get_attribute("bounds")
    consulta_locator = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{consulta_bounds}']")
    home_page.hacer_click(consulta_locator)
    time.sleep(2)
    print("[3] Click en cita agendada")

    btn_reprogramar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Reprogramar']")
    if not home_page.esta_visible(btn_reprogramar, timeout=3):
        print("No se encontró botón Reprogramar")
        return

    home_page.hacer_click(btn_reprogramar)
    time.sleep(2)
    print("[4] Click en Reprogramar")

    titulo_reprogramar = (AppiumBy.XPATH, "//android.view.View[@content-desc='Reprogramar cita']")
    if home_page.esta_visible(titulo_reprogramar, timeout=3):
        print("[5] Pantalla de Reprogramar cargada correctamente")

    print("[6] Seleccionando tipo de consulta...")
    btn_tipo_consulta = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Consulta médico familiar']")
    if home_page.esta_visible(btn_tipo_consulta, timeout=2):
        print("   Tipo de consulta ya seleccionado: Consulta médico familiar")

    print("[7] Seleccionando la fecha más próxima disponible...")
    fechas = driver.find_elements(AppiumBy.XPATH,
        "//android.view.View[contains(@content-desc, '\\n') and contains(@content-desc, '26') or contains(@content-desc, '27') or contains(@content-desc, '28') or contains(@content-desc, '29')]")

    fecha_seleccionada = None
    for fecha in fechas:
        desc = fecha.get_attribute("content-desc")
        if "26" in desc:
            fecha_seleccionada = fecha
            print(f"   Fecha seleccionada: {desc}")
            break

    if not fecha_seleccionada and fechas:
        fecha_seleccionada = fechas[0]
        print(f"   Fecha seleccionada: {fecha_seleccionada.get_attribute('content-desc')}")

    if fecha_seleccionada:
        fecha_bounds = fecha_seleccionada.get_attribute("bounds")
        fecha_locator = (AppiumBy.XPATH, f"//android.view.View[@bounds='{fecha_bounds}']")
        home_page.hacer_click(fecha_locator)
        time.sleep(1)
        print("[8] Fecha seleccionada")
    else:
        btn_mas_fechas = (AppiumBy.XPATH, "//android.view.View[@content-desc='Más fechas']")
        if home_page.esta_visible(btn_mas_fechas, timeout=2):
            home_page.hacer_click(btn_mas_fechas)
            time.sleep(1)
            print("   Abriendo más fechas...")
            nuevas_fechas = driver.find_elements(AppiumBy.XPATH,
                "//android.view.View[contains(@content-desc, '\\n') and @clickable='true']")
            if nuevas_fechas:
                nf_bounds = nuevas_fechas[0].get_attribute("bounds")
                nf_locator = (AppiumBy.XPATH, f"//android.view.View[@bounds='{nf_bounds}']")
                home_page.hacer_click(nf_locator)
                time.sleep(1)
                print("   Primera fecha disponible seleccionada")

    print("[9] Seleccionando horario disponible...")
    horarios = driver.find_elements(AppiumBy.XPATH,
        "//android.view.View[contains(@content-desc, ':') and @clickable='true']")

    if horarios:
        primer_horario = horarios[0]
        horario_desc = primer_horario.get_attribute("content-desc")
        horario_bounds = primer_horario.get_attribute("bounds")
        horario_locator = (AppiumBy.XPATH, f"//android.view.View[@bounds='{horario_bounds}']")
        home_page.hacer_click(horario_locator)
        time.sleep(1)
        print(f"[10] Horario seleccionado: {horario_desc}")
    else:
        print("No hay horarios disponibles")
        return

    print("[11] Confirmando nuevo horario...")
    btn_confirmar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Confirmar nuevo horario']")

    for _ in range(10):
        if home_page.esta_visible(btn_confirmar, timeout=1):
            enabled = driver.find_element(AppiumBy.XPATH,
                "//android.widget.Button[@content-desc='Confirmar nuevo horario']").get_attribute("enabled")
            if enabled == "true":
                home_page.hacer_click(btn_confirmar)
                time.sleep(3)
                print("[12] Cita reprogramada exitosamente")
                break
        time.sleep(1)
    else:
        print("Botón Confirmar nuevo horario no habilitado")

    print("[13] Buscando nueva cita agendada para confirmar asistencia...")

    for _ in range(3):
        home_page.scroll_abajo()
        time.sleep(0.5)

    consultas = driver.find_elements(AppiumBy.XPATH,
        "//android.widget.ImageView[contains(@content-desc, 'Dr.')]")

    cita_agendada = None
    for consulta in consultas:
        info = consulta.get_attribute("content-desc")
        if "Agendada" in info:
            cita_agendada = consulta
            print(f"[14] Nueva cita agendada encontrada: {info[:80]}...")
            break

    if not cita_agendada:
        print("No hay citas agendadas para confirmar asistencia")
        print("Test de Consultas Programadas completado")
        return

    consulta_bounds = cita_agendada.get_attribute("bounds")
    consulta_locator = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{consulta_bounds}']")
    home_page.hacer_click(consulta_locator)
    time.sleep(2)
    print("[15] Click en cita agendada")

    btn_confirmar_asistencia = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Confirmar asistencia']")
    if home_page.esta_visible(btn_confirmar_asistencia, timeout=3):
        home_page.hacer_click(btn_confirmar_asistencia)
        time.sleep(2)
        print("[16] Confirmar asistencia clickeado")

        popup_confirmar = (AppiumBy.XPATH, "//android.view.View[@content-desc='¿Confirmar asistencia?']")
        if home_page.esta_visible(popup_confirmar, timeout=3):
            print("[16b] Popup de confirmación visible")

        btn_confirmar_popup = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Confirmar']")
        if home_page.esta_visible(btn_confirmar_popup, timeout=3):
            home_page.hacer_click(btn_confirmar_popup)
            time.sleep(3)
            print("[17] Asistencia confirmada exitosamente")
        else:
            print("No se encontró botón Confirmar en el popup")
    else:
        print("No se encontró botón Confirmar asistencia")

    print("Test de Consultas Programadas completado")


def test_consultas_previas(driver, home_page):
    """Test Consultas - Ver consultas previas con estado Terminada"""
    print("\n=== TEST: Consultas Previas ===")
    
    # Navegar a Consultas > Previas
    home_page = volver_inicio(driver, home_page)
    home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Consultas\nPestaña 3 de 5"))
    time.sleep(2)
    home_page.hacer_click((AppiumBy.ACCESSIBILITY_ID, "Previas\nPestaña 2 de 2"))
    time.sleep(5)  # Esperar a que carguen las citas
    print("Pestaña Previas seleccionada")
    
    # Buscar citas
    time.sleep(1)
    consultas = driver.find_elements(AppiumBy.XPATH, 
        "//android.widget.ImageView[contains(@content-desc, '/') and contains(@content-desc, 'AM') or contains(@content-desc, 'PM')]")
    
    if not consultas:
        print("No hay citas")
        print("Test de Consultas Previas completado")
        return
    
    print(f"Citas encontradas: {len(consultas)}")
    
    # PRIORIZAR: Primero buscar "Terminada", luego "Iniciada"
    cita_encontrada = None
    estado_seleccionado = None
    
    # Primera pasada: buscar TERMINADA
    for c in consultas:
        desc = c.get_attribute("content-desc")
        if "Terminada" in desc:
            cita_encontrada = c
            estado_seleccionado = "Terminada"
            break
    
    # Segunda pasada: si no hay TERMINADA, buscar INICIADA
    if not cita_encontrada:
        for c in consultas:
            desc = c.get_attribute("content-desc")
            if "Iniciada" in desc:
                cita_encontrada = c
                estado_seleccionado = "Iniciada"
                break
    
    if not cita_encontrada:
        print("No hay citas iniciadas o terminadas")
        print("Test de Consultas Previas completado")
        return
    
    desc = cita_encontrada.get_attribute("content-desc")
    print(f"Seleccionando cita con estado '{estado_seleccionado}': {desc[:60]}...")
    bounds = cita_encontrada.get_attribute("bounds")
    locator = (AppiumBy.XPATH, f"//android.widget.ImageView[@bounds='{bounds}']")
    home_page.hacer_click(locator)
    time.sleep(3)
    print("Detalles abiertos")
    
    # Cambiar a pestaña Receta
    tab_receta = (AppiumBy.XPATH, "//android.view.View[@content-desc='Receta\nPestaña 2 de 4']")
    print(f"Buscando pestaña Receta...")
    if home_page.esta_visible(tab_receta, timeout=2):
        print("Pestaña Receta encontrada, haciendo click...")
        home_page.hacer_click(tab_receta)
        time.sleep(2)
        print("Pestaña Receta seleccionada")
        
        # Buscar botón "Iniciar tratamiento"
        print("Buscando botón Iniciar tratamiento...")
        btn_iniciar = driver.find_elements(AppiumBy.XPATH, 
            "//android.widget.Button[@content-desc='Iniciar tratamiento']")
        
        if btn_iniciar:
            print("Botón Iniciar tratamiento encontrado, haciendo click...")
            btn_iniciar[0].click()
            time.sleep(3)
            print("Click en Iniciar tratamiento")
            
# Verificar si hay medicamentos sin iniciar (Switch unchecked)
            print("Verificando estado de medicamentos...")
            try:
                switches = driver.find_elements(AppiumBy.XPATH, "//android.widget.Switch")
                
                medicamentos_sin_iniciar = False
                for s in switches:
                    checked = s.get_attribute("checked")
                    if checked == "false":
                        medicamentos_sin_iniciar = True
                        break
                
                if not medicamentos_sin_iniciar:
                    print("Todos los medicamentos ya fueron iniciados anteriormente, continuando...")
                else:
                    # Hacer click en el Switch del medicamento (checkbox)
                    print("Buscando Switch del medicamento...")
                    switch_medicamento = (AppiumBy.XPATH, "//android.widget.Switch")
                    if home_page.esta_visible(switch_medicamento, timeout=3):
                        home_page.hacer_click(switch_medicamento)
                        time.sleep(1)
                        print("Switch del medicamento seleccionado")
                        
                        # Click en botón Siguiente
                        btn_siguiente = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Siguiente']")
                        if home_page.esta_visible(btn_siguiente, timeout=3):
                            home_page.hacer_click(btn_siguiente)
                            time.sleep(4)
                            print("Click en Siguiente")
                            
                            # Segundo click en Siguiente para llegar al seekbar
                            btn_siguiente2 = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Siguiente']")
                            if home_page.esta_visible(btn_siguiente2, timeout=3):
                                home_page.hacer_click(btn_siguiente2)
                                time.sleep(2)
                                print("Click en Siguiente (seekbar)")
                            
                            # Establecer hora: seekbar de horas a 14 y minutos a 30
                            print("Ajustando hora a 14:30...")
                            time.sleep(2)
                            
                            # Mover seekbar de horas
                            driver.swipe(160 + int((640-160)*14/24), 1143, 160 + int((640-160)*14/24), 1143, 500)
                            time.sleep(0.5)
                            
                            # Mover seekbar de minutos
                            driver.swipe(640 + int((1120-640)*30/60), 1143, 640 + int((1120-640)*30/60), 1143, 500)
                            time.sleep(1)
                            print("Hora ajustada a 14:30")
                            
                            # Click en "Iniciar tratamiento"
                            btn_iniciar_tratamiento = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Iniciar tratamiento']")
                            if home_page.esta_visible(btn_iniciar_tratamiento, timeout=5):
                                home_page.hacer_click(btn_iniciar_tratamiento)
                                time.sleep(3)
                                print("Click en Iniciar tratamiento final")
            except Exception as e:
                print(f"Error al procesar medicamentos: {e}")
            
            # Regresar a la consulta (solo 1 back para no salir)
            print("Regresando a la consulta...")
            driver.back()
            time.sleep(3)
    
    # Ya estamos en la consulta (no hacer más back)
    print("Continuando en la consulta...")
    
    # Verificar si estamos en la pantalla de consulta
    titulo_consulta = driver.find_elements(AppiumBy.XPATH, "//android.view.View[@content-desc='Consulta']")
    if not titulo_consulta:
        print("No estamos en consulta, haciendo más back...")
        driver.back()
        time.sleep(2)
    
    print("Regresando a detalles de la consulta Terminada")
    
    # Cambiar a pestaña Exploración
    print(f"Buscando pestaña Exploración...")
    tab_exploracion = (AppiumBy.XPATH, "//android.view.View[@content-desc='Exploración\nPestaña 4 de 4']")
    if home_page.esta_visible(tab_exploracion, timeout=5):
        print("Pestaña Exploración encontrada, haciendo click...")
        home_page.hacer_click(tab_exploracion)
        time.sleep(3)
        print("Pestaña Exploración visitada")
    else:
        print("NO se encontró pestaña Exploración")
    
    # Desde Exploración (pestaña 4), scroll a la izquierda para llegar a Estudios (pestaña 3)
    print("Scroll a la izquierda para llegar a Estudios...")
    try:
        driver.swipe(900, 965, 300, 965, 500)
    except:
        # Si swipe falla, usar tap en el borde izquierdo
        print("Swipe falló, usando tap alternativo...")
        driver.tap([(300, 965)])
    time.sleep(2)
    
    # Cambiar a pestaña Estudios (sin salir de la consulta)
    print(f"Buscando pestaña Estudios...")
    tab_estudios = (AppiumBy.XPATH, "//android.view.View[@content-desc='Estudios\nPestaña 3 de 4']")
    if home_page.esta_visible(tab_estudios, timeout=5):
        print("Pestaña Estudios encontrada, haciendo click...")
        home_page.hacer_click(tab_estudios)
        time.sleep(3)
        print("Pestaña Estudios visitada")
        
        # Buscar y hacer click en "Cargar resultados"
        btn_cargar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Cargar resultados']")
        if home_page.esta_visible(btn_cargar, timeout=3):
            print("Click en Cargar resultados...")
            home_page.hacer_click(btn_cargar)
            time.sleep(3)
            
            # Click en "Siguiente" (date picker)
            btn_siguiente = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Siguiente']")
            if home_page.esta_visible(btn_siguiente, timeout=5):
                home_page.hacer_click(btn_siguiente)
                time.sleep(2)
                print("Click en Siguiente (date picker)")
            
            # Click en "Tomar foto o seleccionar archivo"
            btn_tomar_foto = (AppiumBy.XPATH, "//android.view.View[@content-desc='Tomar foto o seleccionar archivo']")
            if home_page.esta_visible(btn_tomar_foto, timeout=5):
                print("Click en Tomar foto o seleccionar archivo...")
                home_page.hacer_click(btn_tomar_foto)
                time.sleep(3)
                
                # Esperar y hacer click en "Galería"
                print("Esperando Galería...")
                time.sleep(3)
                btn_galeria = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Galería']")
                if home_page.esta_visible(btn_galeria, timeout=5):
                    home_page.hacer_click(btn_galeria)
                    time.sleep(3)
                    print("Click en Galería")
                
                # Buscar y seleccionar una imagen
                print("Buscando imágenes en galería...")
                time.sleep(3)
                imagenes = driver.find_elements(AppiumBy.XPATH, 
                    "//android.widget.ImageView[@resource-id='com.google.android.documentsui:id/icon_thumb']")
                
                print(f"Imágenes encontradas: {len(imagenes)}")
                
                if imagenes:
                    imagenes[0].click()
                    time.sleep(2)
                    print("Imagen seleccionada")
                    
                    # Click en centro de pantalla para siguiente
                    print("Click en centro para siguiente...")
                    driver.tap([(640, 1400)])
                    time.sleep(2)
                    
                    # Buscar botón Siguiente
                    btn_siguiente2 = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Siguiente']")
                    if home_page.esta_visible(btn_siguiente2, timeout=5):
                        home_page.hacer_click(btn_siguiente2)
                        time.sleep(2)
                        print("Click en Siguiente (cargar archivo)")
                    
                    # Escribir en el EditText de comentarios
                    print("Buscando campo de comentarios...")
                    campo_comentarios = (AppiumBy.XPATH, "//android.widget.EditText[@hint='Puede agregar comentarios o notas referentes al documento cargado.']")
                    if home_page.esta_visible(campo_comentarios, timeout=5):
                        home_page.hacer_click(campo_comentarios)
                        time.sleep(1)
                        driver.execute_script("mobile: type", {"elementId": campo_comentarios, "text": "Estudio cargado desde automatización"})
                        time.sleep(1)
                        print("Descripción escrita")
                        
                        # Click en Finalizar
                        btn_finalizar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Finalizar']")
                        if home_page.esta_visible(btn_finalizar, timeout=5):
                            home_page.hacer_click(btn_finalizar)
                            time.sleep(2)
                            print("Click en Finalizar")
                else:
                    print("No se encontraron imágenes en galería")
        else:
            print("No hay botón Cargar resultados")
    else:
        print("NO se encontró pestaña Estudios")
    
    print("Test de Consultas Previas completado")