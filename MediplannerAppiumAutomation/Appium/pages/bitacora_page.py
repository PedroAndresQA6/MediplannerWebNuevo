from .base_page import BasePage
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


CATEGORIAS_MODAL = [
    "Medicamento", "Medición", "Valores de laboratorio", "Actividad",
    "Lactancia", "Deposición", "Control de síntomas", "Estado mental",
]


class BitacoraPage(BasePage):
    """Bitácora ('Mi bitácora') y el modal 'Agregar entrada única', alcanzable
    tanto desde el boton flotante '+ Registrar' de Home como desde el '+' de
    Mi bitácora (mismo componente, dos entradas -- confirmado por dump de UI)."""

    def __init__(self, driver):
        super().__init__(driver)
        self.titulo = (AppiumBy.XPATH, "//*[@content-desc='Mi bitácora']")
        self.seccion_tendencias = (AppiumBy.XPATH, "//*[@content-desc='TENDENCIAS']")
        self.seccion_registros = (AppiumBy.XPATH, "//*[@content-desc='REGISTROS']")
        self.fab_registrar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar']")
        self.modal_titulo = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Agregar entrada')]")
        self.modal_cancelar = (AppiumBy.XPATH, "//*[@content-desc='Cancelar']")
        self.buscador_lista = (AppiumBy.XPATH, "//android.widget.EditText[@hint='Buscar']")
        self.boton_guardar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Guardar']")

    # ── Navegación ────────────────────────────────────────────────────────────

    def abrir_desde_home(self):
        """Home -> tarjeta del carrusel 'Ver mi bitácora'. Se localiza por el
        descendiente con ese content-desc y se sube al ancestro clickeable: el
        carrusel cambia de contenido segun el perfil activo, asi que NUNCA fijar
        por posicion de slide (en un dependiente el primer slide no era bitácora)."""
        volver_inicio(self.driver, self)
        ver_bitacora = (AppiumBy.XPATH,
            "//*[@content-desc='Ver mi bitácora']/ancestor::*[@clickable='true'][1]")
        self.assert_visible(ver_bitacora, "No se encontro la tarjeta 'Ver mi bitácora' en Home")
        self.hacer_click(ver_bitacora)
        self.assert_visible(self.titulo, "No se abrio 'Mi bitácora' desde Home")

    def abrir_modal_desde_home(self):
        """Home -> boton flotante '+ Registrar'."""
        volver_inicio(self.driver, self)
        self.hacer_click(self.fab_registrar)
        self.assert_visible(self.modal_titulo, "No se abrio el modal 'Agregar entrada unica' desde el FAB")

    def abrir_modal_desde_bitacora(self):
        """Estando ya en 'Mi bitácora', abre el modal con el '+' superior derecho
        (Button sin content-desc, se localiza por posicion)."""
        assert self.tap_esquina_sup_derecha("android.widget.Button", timeout=5), \
            "No se encontro el boton '+' en Mi bitácora"
        self.assert_visible(self.modal_titulo, "No se abrio el modal 'Agregar entrada unica' desde Mi bitácora")

    # ── Modal "Agregar entrada única" ────────────────────────────────────────

    def loc_categoria(self, nombre):
        # Las categorias del modal son android.view.View (no Button); solo
        # 'Cancelar' es un Button real. Confirmado por dump de UI.
        return (AppiumBy.XPATH, f"//*[@content-desc='{nombre}' and @clickable='true']")

    def elegir_categoria(self, nombre):
        self.hacer_click(self.loc_categoria(nombre))

    def cancelar_modal(self):
        self.hacer_click(self.modal_cancelar)

    # ── "Seleccionar de la lista" ────────────────────────────────────────────

    def elegir_item_de_lista(self, nombre):
        """Toca un item por nombre. El content-desc real es '{nombre}\\n{unidad}'
        (p.ej. 'Peso\\nkg'), por eso se matchea con starts-with."""
        loc = (AppiumBy.XPATH, f"//android.widget.Button[starts-with(@content-desc, '{nombre}')]")
        self.assert_visible(loc, f"No aparecio el item '{nombre}' en 'Seleccionar de la lista'")
        self.hacer_click(loc)

    def buscar_en_lista(self, texto):
        self.ingresar_texto(self.buscador_lista, texto)
        self.ocultar_keyboard()

    def items_visibles_en_lista(self):
        return self.buscar_elementos((AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, '\n')]"))

    # ── Formulario de captura (teclado numérico IN-APP) ──────────────────────

    def teclear_numero(self, digitos):
        """Teclea un valor con el teclado numerico propio de la app (teclas
        '0'-'9' y '.' son android.view.View, no Button) -- NO es el teclado
        nativo de Android. Se filtra por clickable='true' porque el display
        grande del valor actual tambien tiene content-desc='0'/'8'/etc, pero
        no es clickeable."""
        for c in str(digitos):
            tecla = (AppiumBy.XPATH, f"//*[@content-desc='{c}' and @clickable='true']")
            self.hacer_click(tecla)

    def guardar_habilitado(self, timeout=2):
        return self.esta_habilitado(self.boton_guardar, timeout)

    def guardar(self):
        self.hacer_click(self.boton_guardar)

    # ── Medicamento (registrar toma de un medicamento del botiquín) ─────────

    def elegir_primer_medicamento_de_botiquin(self, timeout=10):
        """En 'Seleccionar medicamento', toca el primer item de 'Tu botiquín'
        (Button; no hay un nombre fijo porque el botiquín varía por paciente).
        Devuelve su content-desc completo. Espera explicita a que aparezca al
        menos un item DEBAJO del buscador (no solo el boton de back, que
        tambien matchea 'Button clickable' e hizo que la espera generica de
        buscar_elementos() terminara de mas antes de que el botiquin cargara)."""
        from selenium.webdriver.support.ui import WebDriverWait

        def _candidatos(d):
            items = d.find_elements(AppiumBy.XPATH, "//android.widget.Button[@clickable='true']")
            return [e for e in items
                    if (self._parse_bounds(e.get_attribute('bounds')) or (0, 0))[1] > 400]

        candidatos = WebDriverWait(self.driver, timeout).until(_candidatos)
        nombre = candidatos[0].get_attribute('content-desc')
        candidatos[0].click()
        return nombre

    def registrar_toma_habilitado(self, timeout=2):
        return self.esta_habilitado(
            (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar toma']"), timeout)

    def registrar_toma(self):
        self.hacer_click((AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar toma']"))

    # ── Lactancia > "Toma al pecho" ──────────────────────────────────────────

    def elegir_pecho(self, lado):
        """lado: 'Izquierdo' | 'Derecho' | 'Ambos' (android.view.View clickeable)."""
        self.hacer_click((AppiumBy.XPATH, f"//*[@content-desc='{lado}' and @clickable='true']"))

    # ── Deposición ────────────────────────────────────────────────────────────

    def elegir_tipo_bristol(self, n, timeout=25):
        """Elige 'Tipo N' de la escala de Bristol (1-7). El content-desc real
        incluye la descripcion despues del nombre, por eso starts-with.
        Timeout largo: la lista de Bristol tardo, en corridas reales, mas de
        los 15s default en renderizar (timeout observado en 2/2 corridas
        automatizadas, aunque en pruebas manuales aparecia en 1-2s)."""
        loc = (AppiumBy.XPATH, f"//*[starts-with(@content-desc, 'Tipo {n}') and @clickable='true']")
        self.hacer_click(loc, timeout)

    def elegir_color_deposicion(self, color):
        self.hacer_click((AppiumBy.XPATH, f"//*[@content-desc='{color}' and @clickable='true']"))

    def _scroll_hasta_ver_registrar_deposicion(self):
        """El boton 'Registrar deposición' queda debajo del fold (la lista de
        Bristol + Color ocupa toda la pantalla): sin scroll, element_to_be_
        clickable/is_displayed lo reporta como no visible aunque su atributo
        'enabled' ya haya cambiado, dando falsos negativos."""
        loc = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar deposición']")
        for _ in range(4):
            if self.esta_visible(loc, timeout=1):
                return
            self.scroll_abajo()

    def registrar_deposicion_habilitado(self, timeout=2):
        self._scroll_hasta_ver_registrar_deposicion()
        return self.esta_habilitado(
            (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar deposición']"), timeout)

    def registrar_deposicion(self):
        self._scroll_hasta_ver_registrar_deposicion()
        self.hacer_click((AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar deposición']"))

    # ── Control de síntomas / Estado mental (selector de humor) ──────────────

    def elegir_humor(self, nivel):
        """Elige un nivel de humor (1=triste ... 5=feliz) en 'Control de
        síntomas' o 'Estado mental'. Los 5 iconos son android.view.View SIN
        content-desc; se localizan por posicion (izquierda a derecha). El
        filtro @content-desc='' en el XPath no es fiable en el driver de
        Appium (devolvio 0 resultados en corrida real aunque el dump de
        uiautomator muestra content-desc=""), asi que se filtra en Python
        sobre TODOS los View clickeables, usando ademas que los iconos son
        cuadrados (ancho ~= alto) para no matchear otras filas. OJO: para un
        content-desc ausente, get_attribute() de Appium devuelve el STRING
        literal 'null' (no None ni ''), confirmado con un dump real -- hay
        que comparar contra ambos casos, no solo contra ''."""
        candidatos = self.buscar_elementos((AppiumBy.XPATH, "//android.view.View[@clickable='true']"))
        caras = []
        for e in candidatos:
            desc = e.get_attribute('content-desc') or ''
            b = self._parse_bounds(e.get_attribute('bounds'))
            if desc in ('', 'null') and b and abs((b[2] - b[0]) - (b[3] - b[1])) < 20:
                caras.append((b[0], e))
        caras.sort(key=lambda t: t[0])
        assert len(caras) >= 5, f"Se esperaban 5 iconos de humor, hay {len(caras)}"
        caras[nivel - 1][1].click()

    def registrar_habilitado(self, timeout=2):
        return self.esta_habilitado(
            (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar']"), timeout)

    def registrar(self):
        self.hacer_click((AppiumBy.XPATH, "//android.widget.Button[@content-desc='Registrar']"))

    # ── Verificación en "Mi bitácora" ────────────────────────────────────────

    def fila_registro_visible(self, nombre, valor_contiene, timeout=5):
        """True si en 'Mi bitácora' hay una fila de REGISTROS cuyo content-desc
        multilinea ('{nombre}\\nMedición\\n{valor}\\n{hora}') contiene tanto el
        nombre como el valor esperado."""
        loc = (AppiumBy.XPATH,
            f"//*[contains(@content-desc, '{nombre}') and contains(@content-desc, '{valor_contiene}')]")
        return self.esta_visible(loc, timeout)

    def fila_contiene(self, *fragmentos, timeout=5):
        """Version generica de fila_registro_visible: True si hay un elemento
        cuyo content-desc contiene TODOS los fragmentos dados."""
        cond = " and ".join(f"contains(@content-desc, '{f}')" for f in fragmentos)
        return self.esta_visible((AppiumBy.XPATH, f"//*[{cond}]"), timeout)
