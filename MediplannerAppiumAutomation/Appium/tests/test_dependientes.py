"""
Test Dependientes: alta (y desvinculación) de un dependiente.
Selectores por content-desc / posición relativa (resolución-independiente) y
asserts en cada paso. El drawer de perfil se abre desde el avatar (esquina sup.
izquierda), NO desde el icono de Perfil (esquina sup. derecha).

NOTA (2026-08-03): la desvinculación NO se hace desde el perfil del
dependiente visto en el drawer del titular (como se asumía antes) — hay que
cambiar de contexto al dependiente, ir a Perfil -> Compartir, y desvincular
al TITULAR desde ahí (ver test_dependientes_desvincular). El cambio de
contexto de vuelta al titular no es instantáneo, y la desvinculación puede
tardar unos segundos en propagarse — ambos casos ya contemplados con
reintentos y esperas reales.
"""
import random
import time
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


NOMBRES_H = ["Juan", "Pedro", "Carlos", "Luis", "Miguel", "Jose"]
NOMBRES_M = ["Maria", "Ana", "Sofia", "Laura", "Kenia"]
PARENTESCOS = ["Hijo(a)", "Padre", "Madre", "Abuelo(a)", "Primo(a)", "Sobrino(a)", "Tio(a)"]

TITULO_FORM = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Información del dependiente')]")
BTN_AGREGAR = (AppiumBy.XPATH, "//*[@content-desc='Agregar dependiente']")
BTN_CONTINUAR = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Continuar']")


def _abrir_drawer(driver, home_page):
    """Abre el drawer de perfil (avatar, esquina sup. izquierda) desde Home."""
    home_page = volver_inicio(driver, home_page)
    assert home_page.tap_esquina_sup_izquierda("android.widget.ImageView", timeout=8), \
        "No se encontró el avatar para abrir el drawer de perfil"
    home_page.assert_visible(BTN_AGREGAR, "El drawer no muestra 'Agregar dependiente'")
    return home_page


def _seleccionar_fecha(home_page, driver):
    """Selecciona una fecha de nacimiento en el date picker (año 1990, algún día).
    Best-effort y resolución-independiente; validar contra la nueva versión."""
    # Cambiar a selección de año si el header lo permite, luego elegir 1990.
    btn_1990 = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='1990']")
    if not home_page.esta_visible(btn_1990, timeout=2):
        # Abrir el selector de año (header del picker) y buscar 1990 con scroll.
        for _ in range(6):
            if home_page.esta_visible(btn_1990, timeout=1):
                break
            home_page.scroll_abajo()
    if home_page.esta_visible(btn_1990, timeout=2):
        home_page.hacer_click(btn_1990)

    # Elegir un día cualquiera (botón cuyo content-desc empieza con un número).
    dias = home_page.buscar_elementos(
        (AppiumBy.XPATH, "//android.widget.Button[starts-with(@content-desc, '15')]"), timeout=3)
    if dias:
        dias[0].click()

    # Confirmar.
    for etiqueta in ("ACEPTAR", "Aceptar", "OK"):
        loc = (AppiumBy.XPATH, f"//android.widget.Button[@content-desc='{etiqueta}']")
        if home_page.esta_visible(loc, timeout=1):
            home_page.hacer_click(loc)
            return


def _llenar_formulario(driver, home_page, nombre, es_hombre, parentesco):
    """Llena el formulario de dependiente y envía. Los 4 EditText en orden son:
    Nombre, Apellido paterno, Apellido materno, Fecha de nacimiento."""
    home_page.hacer_click(BTN_AGREGAR)
    home_page.assert_visible(TITULO_FORM, "No se abrió el formulario 'Información del dependiente'")

    ets = home_page.buscar_elementos((AppiumBy.XPATH, "//android.widget.EditText"), timeout=6)
    assert len(ets) >= 4, f"Se esperaban >=4 campos en el formulario, hay {len(ets)}"
    # .clear() antes de .send_keys(): confirmado con capturas 1s que, si una
    # corrida anterior dejó este mismo formulario a medio llenar (el proceso
    # de la app no se reinicia entre corridas de pytest), el texto viejo NO se
    # limpiaba solo y se concatenaba con el nuevo (p.ej. 'Pedro'+'Laura' =
    # 'PedroLaura'), produciendo datos inválidos que nunca habilitaban
    # 'Continuar' — no era un bug de la app, era este test sin limpiar los
    # campos antes de escribir (ver CONTEXTO.md).
    ets[0].click(); ets[0].clear(); ets[0].send_keys(nombre)
    ets[1].click(); ets[1].clear(); ets[1].send_keys("Garcia")
    ets[2].click(); ets[2].clear(); ets[2].send_keys("Perez")

    # NO llamar a ocultar_keyboard() aquí: mismo bug confirmado en
    # test_home.py/test_medicamento.py (ver CONTEXTO.md) — hide_keyboard()
    # manda KEYCODE_ESCAPE, que puede cerrar el formulario en vez de solo el
    # teclado. El botón 'Continuar' ya está visible sin necesidad de ocultarlo.

    # Fecha de nacimiento (abre el date picker).
    ets_actual = home_page.buscar_elementos((AppiumBy.XPATH, "//android.widget.EditText"), timeout=3)
    if len(ets_actual) >= 4:
        ets_actual[3].click()
        _seleccionar_fecha(home_page, driver)

    # Sexo: abrir el selector y elegir según el nombre.
    opcion_sexo = "Masculino" if es_hombre else "Femenino"
    sel_sexo = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Masculino' or @content-desc='Femenino' or @content-desc='Sexo']")
    if home_page.esta_visible(sel_sexo, timeout=2):
        home_page.hacer_click(sel_sexo)
        loc = (AppiumBy.XPATH, f"//android.widget.Button[@content-desc='{opcion_sexo}']")
        if home_page.esta_visible(loc, timeout=2):
            home_page.hacer_click(loc)

    # Parentesco: abrir selector y elegir.
    sel_par = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Hijo(a)' or @content-desc='Parentesco']")
    if home_page.esta_visible(sel_par, timeout=2):
        home_page.hacer_click(sel_par)
        loc = (AppiumBy.XPATH, f"//android.widget.Button[@content-desc='{parentesco}']")
        if home_page.esta_visible(loc, timeout=2):
            home_page.hacer_click(loc)

    # Enviar.
    home_page.assert_visible(BTN_CONTINUAR, "No apareció el botón 'Continuar'")
    home_page.hacer_click(BTN_CONTINUAR)


def test_dependientes_agregar(driver, home_page):
    """Alta de un dependiente con datos ficticios; valida que el formulario se
    completa y se envía (el formulario deja de mostrarse)."""
    print("\n=== TEST: Agregar Dependiente ===")

    nombre = random.choice(NOMBRES_H + NOMBRES_M)
    es_hombre = nombre in NOMBRES_H
    parentesco = random.choice(PARENTESCOS)
    print(f"Dependiente: {nombre} ({'M' if es_hombre else 'F'}), parentesco {parentesco}")

    _abrir_drawer(driver, home_page)
    _llenar_formulario(driver, home_page, nombre, es_hombre, parentesco)

    # Éxito = el formulario ya no está visible (se envió y navegó fuera).
    assert not home_page.esta_visible(TITULO_FORM, timeout=5), \
        "Tras 'Continuar' el formulario del dependiente sigue visible (no se envió)"
    print(f"Dependiente '{nombre}' creado (formulario enviado)")


def test_dependientes_desvincular(driver, home_page):
    """Desvincula un dependiente. Si no hay ninguno, crea uno primero.

    Flujo real (confirmado por Pedro, 2026-08-03 — 'Desvincular' NO está en
    el perfil del dependiente visto desde el drawer del titular, como se
    asumía antes): cambiar de contexto al perfil del dependiente (drawer ->
    click en el dependiente) -> Perfil -> Compartir, donde el titular
    aparece como co-titular compartido -> click en su nombre -> pantalla
    'Compartiendo' con el botón 'Desvincular'. Tras desvincular: volver a
    Inicio, abrir el drawer, click en el perfil del TITULAR (para volver a
    su contexto) y confirmar que el dependiente ya no aparece en 'Mis
    Perfiles'."""
    print("\n=== TEST: Desvincular Dependiente ===")

    home_page = _abrir_drawer(driver, home_page)

    # Nombre del titular (fila superior del drawer, 'Mi Perfil') — se necesita
    # para reconocerlo dentro de 'Compartir' del dependiente y para volver a
    # su contexto al final.
    titular_row = home_page.buscar_elementos(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'Mi Perfil')]"), timeout=5)
    assert titular_row, "No se encontró la fila del titular ('Mi Perfil') en el drawer"
    desc_titular_row = titular_row[0].get_attribute("content-desc") or ""
    nombre_titular = desc_titular_row.split("\n")[0].strip()
    print(f"Titular: {nombre_titular!r}")

    # Buscar un dependiente en el drawer (botón con parentesco tras el nombre).
    dependientes = home_page.buscar_elementos(
        (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Hijo') "
         "or contains(@content-desc, 'Padre') or contains(@content-desc, 'Madre') "
         "or contains(@content-desc, 'Abuelo') or contains(@content-desc, 'Primo') "
         "or contains(@content-desc, 'Sobrino') or contains(@content-desc, 'Tio')]"), timeout=4)

    if not dependientes:
        print("[i] No hay dependientes en el drawer; creando uno para desvincular")
        nombre = random.choice(NOMBRES_H + NOMBRES_M)
        _llenar_formulario(driver, home_page, nombre, nombre in NOMBRES_H, "Hijo(a)")
        home_page = _abrir_drawer(driver, home_page)
        dependientes = home_page.buscar_elementos(
            (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Hijo') "
             "or contains(@content-desc, 'Padre') or contains(@content-desc, 'Madre')]"), timeout=4)

    assert dependientes, "No se encontró ningún dependiente para desvincular (ni tras crear uno)"
    desc_dependiente = dependientes[0].get_attribute("content-desc") or ""
    nombre_dependiente = desc_dependiente.split("\n")[0].strip()
    print(f"Dependiente a desvincular: {desc_dependiente!r}")

    # Cambiar de contexto: entrar al perfil del DEPENDIENTE (no el propio).
    dependientes[0].click()

    # Ya en contexto del dependiente: Perfil -> Compartir.
    assert home_page.abrir_perfil(), "No se pudo abrir Perfil (en contexto del dependiente)"
    home_page.abrir_seccion_perfil("Compartir")
    titulo_compartir = (AppiumBy.XPATH, "//*[@content-desc='Compartir']")
    home_page.assert_visible(titulo_compartir, "No se abrió Compartir (en contexto del dependiente)")

    # El titular aparece listado como co-titular compartido: click en su nombre.
    fila_titular = (AppiumBy.XPATH, f"//*[contains(@content-desc, '{nombre_titular}')]")
    if not home_page.esta_visible(fila_titular, timeout=3):
        for _ in range(4):
            home_page.scroll_abajo()
            if home_page.esta_visible(fila_titular, timeout=1):
                break
    home_page.assert_visible(fila_titular, f"No apareció el titular '{nombre_titular}' en Compartir del dependiente")
    home_page.hacer_click(fila_titular)

    # Pantalla 'Compartiendo': título + nombre del titular + botón 'Desvincular'.
    titulo_compartiendo = (AppiumBy.XPATH, "//*[@content-desc='Compartiendo']")
    home_page.assert_visible(titulo_compartiendo, "No se abrió la pantalla 'Compartiendo'")
    desvincular = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Desvincular']")
    home_page.assert_visible(desvincular, "No apareció el botón 'Desvincular' en la pantalla 'Compartiendo'")
    home_page.hacer_click(desvincular)

    # Puede haber un popup de confirmación adicional; si aparece, confirmarlo.
    confirm = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Desvincular']")
    if home_page.esta_visible(confirm, timeout=3):
        home_page.hacer_click(confirm)

    # Verificación de persistencia real: volver a Inicio, abrir el drawer,
    # click en el TITULAR (para volver a su contexto) y confirmar que el
    # dependiente ya no aparece en 'Mis Perfiles'. Antes el test asumía éxito
    # con solo haber clickeado 'Desvincular', sin comprobar que el backend
    # realmente procesó la desvinculación.
    home_page = volver_inicio(driver, home_page)
    home_page = _abrir_drawer(driver, home_page)
    fila_titular_drawer = (AppiumBy.XPATH, f"//*[contains(@content-desc, '{nombre_titular}') and contains(@content-desc, 'Mi Perfil')]")
    home_page.assert_visible(fila_titular_drawer, f"No apareció la fila del titular '{nombre_titular}' en el drawer del dependiente")
    home_page.hacer_click(fila_titular_drawer)

    # El cambio de contexto de vuelta al titular no es instantáneo (confirmado
    # con capturas cada 1s: aparece un spinner de carga en Home tras el
    # click) — reintentar abrir el drawer hasta ver la fila 'Mi Perfil' con el
    # nombre del TITULAR (no la del dependiente), en vez de asumir que ya
    # cambió tras un solo intento inmediato.
    cambio_confirmado = False
    for _ in range(6):
        home_page = volver_inicio(driver, home_page)
        home_page = _abrir_drawer(driver, home_page)
        fila_actual = home_page.buscar_elementos(
            (AppiumBy.XPATH, "//*[contains(@content-desc, 'Mi Perfil')]"), timeout=2)
        if fila_actual and nombre_titular in (fila_actual[0].get_attribute("content-desc") or ""):
            cambio_confirmado = True
            break
        home_page.driver.back()  # cerrar el drawer antes de reintentar
        time.sleep(2)
    assert cambio_confirmado, (
        f"Tras clickear al titular '{nombre_titular}' en el drawer, el contexto "
        "no volvió a él (la fila 'Mi Perfil' sigue mostrando otro perfil) tras "
        "varios reintentos"
    )

    # Reintentar con esperas reales antes de concluir que no se persistió: ya
    # se documentó en el proyecto (CONTEXTO.md, getFilledForm tras Finalizar)
    # que ciertas actualizaciones tardan en propagarse en el backend — no se
    # descarta como transitorio sin haber esperado de verdad y reabierto el
    # drawer, para no repetir el error de reportar un falso bug (ni de
    # silenciar uno real).
    sel_dependiente = (AppiumBy.XPATH, f"//*[contains(@content-desc, '{nombre_dependiente}')]")
    sigue_presente = home_page.esta_visible(sel_dependiente, timeout=3)
    intentos_espera = [5, 10, 15]
    for espera in intentos_espera:
        if not sigue_presente:
            break
        print(f"[i] '{nombre_dependiente}' sigue apareciendo; reintentando en {espera}s "
              "(posible retraso de propagación del backend)")
        time.sleep(espera)
        home_page.driver.back()
        home_page = _abrir_drawer(driver, home_page)
        sigue_presente = home_page.esta_visible(sel_dependiente, timeout=3)

    assert not sigue_presente, (
        f"Tras 'Desvincular' y {sum(intentos_espera)}s de reintentos, el "
        f"dependiente ({desc_dependiente!r}) sigue apareciendo en el drawer "
        "del titular — la desvinculación no parece haberse persistido"
    )
    print(f"Dependiente desvinculado y verificado: {desc_dependiente!r} ya no aparece en el drawer")
