from .base_page import BasePage
from appium.webdriver.common.appiumby import AppiumBy


class DoctorsPage(BasePage):

    def __init__(self, driver):
        super().__init__(driver)

        # Búsqueda (EditText superior de la pantalla Médicos).
        self.campo_busqueda = (AppiumBy.XPATH, "//android.widget.EditText")

        # Modal de filtros: todo por content-desc (resolución-independiente).
        self.btn_estado = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Estado']")
        self.btn_ciudad = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Ciudad']")
        self.btn_cancelar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Cancelar']")
        self.btn_buscar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Buscar']")

        # Cualquier médico de la lista.
        self.doctores = (AppiumBy.XPATH, "//*[contains(@content-desc, 'Dr.')]")

        # Pestañas inferiores.
        self.tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")
        self.tab_medicos = (AppiumBy.ACCESSIBILITY_ID, "Médicos\nPestaña 2 de 5")

    def ir_a_medicos(self):
        self.hacer_click(self.tab_medicos)

    def esta_en_doctors(self):
        return self.esta_visible(self.campo_busqueda, timeout=5)

    def abrir_filtro(self):
        """Abre el modal de filtros (icono superior derecha, por posición)."""
        return self.tap_esquina_sup_derecha("android.widget.ImageView", timeout=8)

    def buscar_texto(self, termino):
        self.ingresar_texto(self.campo_busqueda, termino)
        self.ocultar_keyboard()

    def seleccionar_estado(self, estado="Querétaro", max_scrolls=8):
        """En el modal, abre 'Estado' y elige uno (scroll hasta encontrarlo)."""
        self.hacer_click(self.btn_estado)
        loc = (AppiumBy.XPATH, f"//*[@content-desc='{estado}']")
        for _ in range(max_scrolls):
            if self.esta_visible(loc, timeout=1):
                self.hacer_click(loc)
                return True
            self.scroll_abajo()
        return False

    def hay_doctores(self, timeout=6):
        return len(self.buscar_elementos(self.doctores, timeout=timeout)) > 0
