from .base_page import BasePage
from appium.webdriver.common.appiumby import AppiumBy


class DoctorsPage(BasePage):
    
    def __init__(self, driver):
        super().__init__(driver)
        
        # Search
        self.campo_busqueda = (AppiumBy.XPATH, "//android.widget.EditText[contains(@hint, 'Buscar')]")
        self.btn_filtro = (AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[1052,192][1232,372]']")
        
        # Filter modal
        self.campo_estado = (AppiumBy.ACCESSIBILITY_ID, "Queretaro")
        self.campo_ciudad = (AppiumBy.ACCESSIBILITY_ID, "City")
        self.btn_cancel = (AppiumBy.ACCESSIBILITY_ID, "Cancel")
        self.btn_buscar = (AppiumBy.ACCESSIBILITY_ID, "Search")
        
        # Bottom tabs - Spanish
        self.tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")
        self.tab_medicos = (AppiumBy.ACCESSIBILITY_ID, "Médicos\nPestaña 2 de 5")
        self.tab_consultas = (AppiumBy.ACCESSIBILITY_ID, "Consultas\nPestaña 3 de 5")
        self.tab_medicinas = (AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5")
        self.tab_estudios = (AppiumBy.ACCESSIBILITY_ID, "Estudios\nPestaña 5 de 5")
    
    def buscar(self, termino):
        self.ingresar_texto(self.campo_busqueda, termino)
        self.ocultar_keyboard()
    
    def abrir_filtro(self):
        self.hacer_click(self.btn_filtro)
    
    def cerrar_filtro(self):
        if self.esta_visible(self.btn_cancel):
            self.hacer_click(self.btn_cancel)
    
    def ir_a_inicio(self):
        self.hacer_click(self.tab_inicio)
    
    def ir_a_tab(self, tab_name):
        tabs = {
            "inicio": self.tab_inicio,
            "medicos": self.tab_medicos,
            "consultas": self.tab_consultas,
            "medicinas": self.tab_medicinas,
            "estudios": self.tab_estudios
        }
        self.hacer_click(tabs.get(tab_name, self.tab_inicio))
    
    def esta_en_doctors(self):
        return self.esta_visible(self.campo_busqueda)