"""
Helper reutilizable para dar de alta un medicamento desde la pestaña Medicinas.
Selectores por content-desc (resolución-independiente) y esperas dinámicas.
Convención del proyecto: duración corta (default 1 día, máx 2) para no acumular
datos y poder seguir probando el alta.
"""
import time
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


NOMBRES_BUSQUEDA = [
    "Paracetamol", "Ibuprofeno", "Amoxicilina", "Omeprazol", "Metformina",
    "Losartan", "Amlodipino", "Atorvastatina", "Aspirina", "Naproxeno",
]

TAB_MEDICINAS = (AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5")


def _elegir_opcion(page, candidatos, paso, timeout=6):
    """Toca la primera opción disponible (por content-desc) de una lista. Falla con
    mensaje claro si ninguna aparece (el flujo se rompió o cambió la UI)."""
    for c in candidatos:
        loc = (AppiumBy.XPATH, f"//*[@content-desc='{c}']")
        if page.esta_visible(loc, timeout=timeout if c == candidatos[0] else 1):
            page.hacer_click(loc)
            return c
    raise AssertionError(f"Alta de medicamento, paso '{paso}': no apareció ninguna opción esperada {candidatos}")


def agregar_medicamento(driver, page, nombre="Paracetamol"):
    """Da de alta un medicamento (duración 1 día) y regresa a Home. Devuelve el
    nombre real del medicamento seleccionado (puede diferir del término buscado).
    Cada paso valida que la pantalla correcta apareció (asserts, sin sleeps fijos)."""
    page = volver_inicio(driver, page)
    page.hacer_click(TAB_MEDICINAS)

    # Abrir el formulario de alta (botón Agregar, esquina superior derecha).
    assert page.tap_esquina_sup_derecha("android.widget.Button", timeout=8), \
        "No se encontró el botón 'Agregar' en Medicinas"
    page.assert_visible(
        (AppiumBy.XPATH, "//*[contains(@content-desc, 'medicamento quiere agregar')]"),
        "No se abrió el formulario 'Registrar Medicamento'")

    # Buscar y seleccionar un medicamento. La búsqueda del catálogo es sensible:
    # se usa un PREFIJO corto (primeras 4 letras) para que matchee de forma holgada.
    campo = (AppiumBy.XPATH, "//android.widget.EditText")
    termino = nombre[:4]
    page.ingresar_texto(campo, termino)
    page.ocultar_keyboard()
    seleccionar = page.buscar_elementos(
        (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Seleccionar']"), timeout=8)
    assert seleccionar, f"La búsqueda de '{termino}' (prefijo de '{nombre}') no arrojó resultados"
    seleccionar[0].click()

    # Presentación → unidad → vía → frecuencia (opciones según el medicamento).
    _elegir_opcion(page, ["Tabletas", "Suspension", "Capsulas", "Ampolleta"], "presentación")
    _elegir_opcion(page, ["miligramo", "mililitro(mL)", "gramo", "Tableta", "gota(gts)"], "unidad")
    _elegir_opcion(page, ["Oral", "Cutánea", "Sublingual", "Nasal"], "vía")
    _elegir_opcion(page, ["Una vez al día", "Dos veces al día", "3 veces al día"], "frecuencia")

    # Primera dosis (se acepta el valor por defecto).
    siguiente = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Siguiente']")
    page.assert_visible((AppiumBy.XPATH, "//*[contains(@content-desc, 'primera dosis')]"),
                        "No apareció la pantalla de 'primera dosis'")
    page.hacer_click(siguiente)

    # "Ya casi terminas" → establecer duración.
    dur = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Establecer duración')]")
    page.assert_visible(dur, "No apareció la opción 'Establecer duración del tratamiento'")
    page.hacer_click(dur)

    # Fecha de inicio (hoy por defecto) → Siguiente.
    page.assert_visible((AppiumBy.XPATH, "//*[contains(@content-desc, 'fecha de inicio')]"),
                        "No apareció 'Establecer fecha de inicio'")
    page.hacer_click(siguiente)

    # Duración: elegir un número de días (default 1 = máx 2 días de la convención).
    elige = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Elige un número de días')]")
    page.assert_visible(elige, "No apareció 'Elige un número de días'")
    page.hacer_click(elige)
    page.assert_visible((AppiumBy.XPATH, "//*[contains(@content-desc, 'días dura el tratamiento')]"),
                        "No apareció el selector de número de días")
    page.hacer_click(siguiente)  # default 1 día → finaliza

    # Vuelve a Home con el medicamento agendado.
    page.assert_visible(
        (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5"),
        "Tras registrar el medicamento no se regresó a Home", timeout=20)
    return nombre
