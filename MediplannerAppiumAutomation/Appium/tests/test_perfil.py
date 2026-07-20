"""
Test para Perfil - Datos Personales
"""
import time
from appium.webdriver.common.appiumby import AppiumBy


def _esperar(condicion, timeout=3, intervalo=0.15):
    """Espera dinámica genérica: reintenta `condicion()` hasta que sea verdadera
    o se agote `timeout`. Reemplaza el patrón 'time.sleep(N) + chequeo único',
    que o espera de más (caso feliz) o de menos (app lenta) para reflejar el
    resultado de una validación (p.ej. un botón que se habilita/deshabilita)."""
    fin = time.time() + timeout
    while time.time() < fin:
        if condicion():
            return True
        time.sleep(intervalo)
    return condicion()


def _abrir_datos_personales(driver, home_page):
    """Navega Home -> Perfil -> Datos Personales y deja el form Datos Generales visible."""
    assert home_page.abrir_perfil(), "No se pudo abrir la pantalla de Perfil"
    home_page.abrir_seccion_perfil("Datos Personales")
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
    curp.click(); curp.clear(); curp.send_keys("A" * 18)
    assert _esperar(lambda: not _siguiente_habilitado(driver)), \
        "CURP de puras letras debería deshabilitar 'Siguiente'"
    print("[2] OK: CURP inválida (18 letras) deshabilita 'Siguiente'")

    # Restaurar CURP original y confirmar que se rehabilita
    curp.click(); curp.clear(); curp.send_keys(curp_original)
    assert _esperar(lambda: _siguiente_habilitado(driver)), \
        "Al restaurar la CURP válida 'Siguiente' debería rehabilitarse"
    print("[3] OK: CURP restaurada rehabilita 'Siguiente'")

    # --- Tab Datos de Contacto: validación de correo ---
    tab_contacto = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Datos de Contacto')]")
    home_page.hacer_click(tab_contacto)

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
    correo.click(); correo.clear(); correo.send_keys("pacienterym.com")
    assert _esperar(lambda: not _guardar_habilitado(driver)), \
        "Correo sin @ debería deshabilitar 'Guardar y Continuar'"
    print("[5] OK: correo sin @ deshabilita 'Guardar y Continuar'")

    # Restaurar correo válido y confirmar rehabilitación
    correo.click(); correo.clear(); correo.send_keys(correo_original)
    assert _esperar(lambda: _guardar_habilitado(driver)), \
        "Al restaurar un correo válido debería rehabilitarse 'Guardar y Continuar'"
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

    assert home_page.abrir_perfil(), "No se pudo abrir Perfil"
    home_page.abrir_seccion_perfil("Cuenta")

    # La pantalla Cuenta debe mostrar la info de suscripción
    assert _click_si_existe(driver, home_page, "Ver todos los planes"), \
        "No se encontró 'Ver todos los planes' en Cuenta"
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
    driver.back()

    # Cambiar ciclo de facturación -> guardar cambios y volver
    if _click_si_existe(driver, home_page, "Cambiar ciclo de facturación"):
        guardar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar cambios']")
        assert home_page.esta_visible(guardar, timeout=3), "No apareció 'Guardar cambios' al cambiar ciclo"
        home_page.hacer_click(guardar)
        print("[3] OK: ciclo de facturación - Guardar cambios")
        driver.back()

    # Cancelar suscripción -> NO cancelar, mantener (no destructivo)
    assert _click_si_existe(driver, home_page, "Cancelar suscripción"), \
        "No se encontró 'Cancelar suscripción'"
    mantener = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Mantener Suscripción']")
    assert home_page.esta_visible(mantener, timeout=3), \
        "El flujo de cancelación no ofreció 'Mantener Suscripción'"
    home_page.hacer_click(mantener)
    print("[4] OK: 'Mantener Suscripción' (no se canceló)")

    home_page.tomar_screenshot("perfil_cuenta")
    print("[5] Test Cuenta completado")


def test_perfil_historial_medico(driver, home_page):
    print("\n=== TEST: Historial Medico ===")
    assert home_page.abrir_perfil(), "No se pudo abrir Perfil"
    home_page.abrir_seccion_perfil("Historial")

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
    home_page.scroll_arriba()
    home_page.hacer_click(patologicos)

    formulario = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Formulario')]")
    assert home_page.esta_visible(formulario, timeout=5), "No aparecio el boton Formulario en Patologicos"
    home_page.hacer_click(formulario)

    # Las opciones son checkboxes persistentes (no un submit de una sola vez):
    # según lo que haya quedado guardado de una corrida anterior, cualquiera
    # puede empezar ya marcada. Verificado contra la app real: destildar una
    # opción existente es un caso ambiguo ('Enviar Reporte' no siempre navega
    # fuera de la pantalla en ese caso). Para evitarlo, se elige a propósito
    # una opción que hoy esté SIN marcar y se prueba el flujo de alta.
    candidatas = ["Asma", "Gastritis / Úlcera", "Epilepsia", "Dislipidemia", "Artritis", "Cancer"]
    opcion = None
    opcion_nombre = None
    for candidata in candidatas:
        loc = (AppiumBy.XPATH, f"//android.widget.Button[@content-desc='{candidata}']")
        if home_page.esta_visible(loc, timeout=2) and driver.find_element(*loc).get_attribute("selected") == "false":
            opcion, opcion_nombre = loc, candidata
            break
    assert opcion is not None, "No se encontró ninguna opción sin marcar entre las candidatas para probar el alta"

    home_page.hacer_click(opcion)
    assert _esperar(lambda: driver.find_element(*opcion).get_attribute("selected") == "true"), \
        f"El botón '{opcion_nombre}' no quedó marcado (selected) tras tocarlo"
    print(f"[2] Opción '{opcion_nombre}' seleccionada y marcada (selected=true)")

    # 'Enviar Reporte' suele estar bajo el fold (el formulario tiene muchas opciones)
    enviar = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Enviar')]")
    if not home_page.esta_visible(enviar, timeout=2):
        for _ in range(5):
            home_page.scroll_abajo(); time.sleep(0.5)
            if home_page.esta_visible(enviar, timeout=1):
                break
    assert home_page.esta_visible(enviar, timeout=2), "No aparecio el boton 'Enviar Reporte'"
    home_page.hacer_click(enviar)

    # El banner "Respuestas guardadas correctamente" es un toast que (a) puede no estar
    # en el arbol de accesibilidad y (b) solo aparece si hubo cambio respecto al estado
    # guardado; se valida como best-effort, informativo.
    exito = (AppiumBy.XPATH,
             "//*[contains(@text, 'guardadas correctamente') "
             "or contains(@content-desc, 'guardadas correctamente') "
             "or contains(@text, 'Respuestas guardadas') "
             "or contains(@content-desc, 'Respuestas guardadas')]")
    if home_page.esta_visible(exito, timeout=4):
        print("[3] OK: confirmacion 'Respuestas guardadas correctamente' detectada")
    else:
        print("[3] Banner de confirmación no visible en el árbol (normal en este entorno)")

    # Confirmado contra la app real: tras 'Enviar Reporte' la app NO navega
    # atrás sola — hay que salir explícitamente con back (a diferencia de
    # otros formularios del proyecto). Se verifica la persistencia real
    # reabriendo el formulario y comprobando que la opción elegida sigue
    # marcada, en vez de asumir éxito solo porque el click no lanzó excepción.
    driver.back()
    assert home_page.esta_visible(titulo, timeout=5), \
        "Tras 'Enviar Reporte' + back no se regresó a la pantalla de Historial"

    home_page.scroll_arriba()
    # 'Patologicos' es un acordeón: como quedó expandido de antes de 'Enviar',
    # tocarlo de nuevo lo COLAPSA en vez de abrirlo. Solo clickear si hace
    # falta expandirlo (confirmado contra la app real).
    if not home_page.esta_visible(formulario, timeout=2):
        home_page.hacer_click(patologicos)
    assert home_page.esta_visible(formulario, timeout=5), \
        "No se pudo reabrir Patologicos para verificar la persistencia"
    home_page.hacer_click(formulario)
    assert home_page.esta_visible(opcion, timeout=5), \
        f"No se pudo reabrir el formulario de opciones para verificar '{opcion_nombre}'"
    persistido = driver.find_element(*opcion).get_attribute("selected") == "true"
    assert persistido, (
        f"Tras reabrir el formulario, '{opcion_nombre}' ya no aparece marcado "
        "(el guardado no se persistió)"
    )
    print(f"[4] Persistencia verificada: '{opcion_nombre}' sigue marcado tras reabrir el formulario")
    driver.back()  # salir del formulario de opciones, de vuelta a Historial
    home_page.tomar_screenshot("perfil_historial")
    print("[5] Test completado")


def test_perfil_progreso(driver, home_page):
    print("=== TEST: Progreso ===")
    assert home_page.abrir_perfil(), "No se pudo abrir Perfil"
    home_page.abrir_seccion_perfil("Progreso")

    titulo = (AppiumBy.XPATH, "//*[@content-desc='Progreso']")
    assert home_page.esta_visible(titulo, timeout=5), "No se abrio Progreso"

    # Seccion Retos con al menos una insignia
    assert home_page.esta_visible((AppiumBy.XPATH, "//*[@content-desc='Retos']"), timeout=3), \
        "Falta la seccion Retos"
    insignia = (AppiumBy.XPATH,
                "//*[@content-desc='Bienvenida' or @content-desc='Tamiz' "
                "or @content-desc='Primera Semana' or @content-desc='Primera consulta agendada']")
    assert home_page.esta_visible(insignia, timeout=3), "No se ven insignias en Retos"
    print("[1] Retos e insignias presentes")

    # Estadisticas
    assert home_page.esta_visible(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'Insignias obtenidas')]"), timeout=3), \
        "Faltan las estadisticas (Insignias obtenidas)"
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
    print("=== TEST: Documentos ===")
    assert home_page.abrir_perfil(), "No se pudo abrir Perfil"
    home_page.abrir_seccion_perfil("Documentos")

    titulo = (AppiumBy.XPATH, "//*[@content-desc='Documentos']")
    assert home_page.esta_visible(titulo, timeout=5), "No se abrio Documentos"

    # Best-effort: documentos existentes (su content-desc incluye fecha dd/mm/aaaa)
    docs = driver.find_elements(AppiumBy.XPATH, "//*[contains(@content-desc, '/202')]")
    print(f"[1] Documentos existentes detectados: {len(docs)}")

    # Abrir el formulario de agregar documento (boton superior derecho, por posicion,
    # no por bounds absolutos que se rompen al cambiar de resolucion)
    assert home_page.tap_esquina_sup_derecha("android.widget.Button", timeout=5), \
        "No se encontro el boton de agregar documento"

    # El formulario debe mostrar sus campos clave
    assert home_page.esta_visible(
        (AppiumBy.XPATH, "//*[@content-desc='Agregar Documento']"), timeout=5), \
        "No se abrio el formulario Agregar Documento"
    for etiqueta in ("Nombre", "Tomar foto o seleccionar archivo", "Guardar"):
        assert home_page.esta_visible(
            (AppiumBy.XPATH, f"//*[@content-desc='{etiqueta}']"), timeout=3), \
            f"Falta el campo/boton '{etiqueta}' en el formulario"
    print("[2] Formulario Agregar Documento con sus campos")

    # Los campos Nombre (0) y Comentarios (1) deben aceptar texto
    ets = driver.find_elements(AppiumBy.XPATH, "//android.widget.EditText")
    assert len(ets) >= 2, f"Se esperaban 2 campos (Nombre, Comentarios), hay {len(ets)}"
    ets[0].click(); ets[0].send_keys("Documento de prueba QA")
    ets[1].click(); ets[1].send_keys("Comentario de prueba")
    assert (ets[0].get_attribute("text") or "").strip(), "El campo Nombre no acepto texto"
    print("[3] Campos Nombre y Comentarios aceptan texto")

    home_page.tomar_screenshot("perfil_documentos")
    # No se completa la subida (picker nativo de galeria, fragil) ni se guarda: salir
    # sin crear el documento (no destructivo).
    driver.back()
    print("[4] Test completado (formulario validado; subida de archivo no automatizada)")


def _invitar_habilitado(driver):
    btn = driver.find_elements(AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Invitar')]")
    return bool(btn) and btn[0].get_attribute("enabled") == "true"


def test_perfil_compartir(driver, home_page):
    print("=== TEST: Compartir ===")
    assert home_page.abrir_perfil(), "No se pudo abrir Perfil"
    home_page.abrir_seccion_perfil("Compartir")

    titulo = (AppiumBy.XPATH, "//*[@content-desc='Compartir']")
    assert home_page.esta_visible(titulo, timeout=5), "No se abrio Compartir"

    # Debe listar contactos con los que se comparte
    assert home_page.esta_visible(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'compartiendo')]"), timeout=3), \
        "No se ve la lista de contactos compartidos"
    print("[1] Lista de contactos compartidos presente")

    # Abrir el flujo de agregar contacto (boton superior derecho, por posicion) -> pantalla Contactos
    assert home_page.tap_esquina_sup_derecha("android.widget.Button", timeout=5), \
        "No se encontro el boton de agregar contacto"

    manual = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'adir manualmente')]")
    assert home_page.esta_visible(manual, timeout=5), "No aparecio 'Anadir manualmente' en Contactos"
    home_page.hacer_click(manual)
    print("[2] Formulario 'Anadir manualmente' abierto")

    # Validacion de telefono: la app exige 10 digitos para habilitar 'Invitar y compartir'
    # (espera explicita: la transicion Contactos -> 'Invitar a Mediplanner' tarda en
    # renderizar; un find_elements crudo aqui llegaba antes de que el formulario
    # existiera y devolvia [] con selectores por otro lado correctos)
    nombre = home_page.buscar_elementos((AppiumBy.XPATH, "//android.widget.EditText[@hint='Nombre completo']"))
    telefono = home_page.buscar_elementos((AppiumBy.XPATH, "//android.widget.EditText[@hint='10 dígitos']"))
    assert nombre and telefono, "No se encontraron los campos Nombre/Telefono del formulario manual"

    nombre[0].click(); nombre[0].send_keys("Juan Perez QA")

    # Telefono invalido (3 digitos) -> 'Invitar' deshabilitado
    telefono[0].click(); telefono[0].send_keys("123")
    assert _esperar(lambda: not _invitar_habilitado(driver)), \
        "Con telefono invalido (3 digitos) 'Invitar' deberia estar deshabilitado"
    print("[3] OK: telefono de 3 digitos deshabilita 'Invitar'")

    # Telefono valido (10 digitos) -> 'Invitar' habilitado
    telefono[0].clear(); telefono[0].send_keys("5551013614")
    assert _esperar(lambda: _invitar_habilitado(driver)), \
        "Con telefono valido (10 digitos) 'Invitar' deberia habilitarse"
    print("[4] OK: telefono de 10 digitos habilita 'Invitar'")

    home_page.tomar_screenshot("perfil_compartir")

    # Enviar la invitacion de punta a punta: el contacto es ficticio (nombre y
    # telefono inventados), asi que completar el envio es seguro/no destructivo
    # (no afecta a una persona real) y valida el flujo completo, no solo la
    # habilitacion del boton.
    invitar = (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Invitar')]")
    home_page.hacer_click(invitar)

    confirmacion = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Invitación enviada')]")
    assert home_page.esta_visible(confirmacion, timeout=8), \
        "No se confirmo el envio de la invitacion ('Invitacion enviada' no aparecio)"
    print("[5] OK: invitacion enviada, pantalla de confirmacion visible")

    listo = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Listo']")
    home_page.hacer_click(listo)
    print("[6] Test completado (invitacion enviada y confirmada de punta a punta)")
