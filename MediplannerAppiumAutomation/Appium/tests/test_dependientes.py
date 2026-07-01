"""
Test Dependientes: alta (y desvinculación) de un dependiente.
Selectores por content-desc / posición relativa (resolución-independiente) y
asserts en cada paso. El drawer de perfil se abre desde el avatar (esquina sup.
izquierda), NO desde el icono de Perfil (esquina sup. derecha).

NOTA: date picker y desvinculación se re-validan en la corrida final contra la
nueva versión de la app (pueden requerir ajustar algún selector).
"""
import random
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
    ets[0].click(); ets[0].send_keys(nombre)
    ets[1].click(); ets[1].send_keys("Garcia")
    ets[2].click(); ets[2].send_keys("Perez")
    home_page.ocultar_keyboard()

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
    NOTA: flujo destructivo; validar selectores contra la nueva versión."""
    print("\n=== TEST: Desvincular Dependiente ===")

    home_page = _abrir_drawer(driver, home_page)

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
    dependientes[0].click()

    # Desde el perfil del dependiente: menú (icono top-right) → Desvincular → confirmar.
    home_page.tap_esquina_sup_derecha("android.widget.ImageView", timeout=6)
    desvincular = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Desvincular')]")
    if not home_page.esta_visible(desvincular, timeout=4):
        for _ in range(4):
            home_page.scroll_abajo()
            if home_page.esta_visible(desvincular, timeout=1):
                break
    home_page.assert_visible(desvincular, "No apareció la opción 'Desvincular'")
    home_page.hacer_click(desvincular)

    # Confirmación.
    confirm = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Desvincular']")
    home_page.assert_visible(confirm, "No apareció la confirmación de 'Desvincular'")
    home_page.hacer_click(confirm)
    print("Dependiente desvinculado")
