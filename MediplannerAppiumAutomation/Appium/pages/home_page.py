from .base_page import BasePage
from appium.webdriver.common.appiumby import AppiumBy


class HomePage(BasePage):
    
    def __init__(self, driver):
        super().__init__(driver)
        
        # Bottom tabs - Spanish
        self.tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")
        self.tab_medicos = (AppiumBy.ACCESSIBILITY_ID, "Médicos\nPestaña 2 de 5")
        self.tab_consultas = (AppiumBy.ACCESSIBILITY_ID, "Consultas\nPestaña 3 de 5")
        self.tab_medicinas = (AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5")
        self.tab_estudios = (AppiumBy.ACCESSIBILITY_ID, "Estudios\nPestaña 5 de 5")
        
        # Home content
        self.btn_menu = (AppiumBy.XPATH, "//android.view.View[@content-desc='Mario A.']")
        self.fecha_actual = (AppiumBy.ACCESSIBILITY_ID, "Hoy, 14 abril 2026")
    
    def ir_a_inicio(self):
        self.hacer_click(self.tab_inicio)
    
    def ir_a_medicos(self):
        self.hacer_click(self.tab_medicos)
    
    def ir_a_consultas(self):
        self.hacer_click(self.tab_consultas)
    
    def ir_a_medicinas(self):
        self.hacer_click(self.tab_medicinas)
    
    def ir_a_estudios(self):
        self.hacer_click(self.tab_estudios)
    
    def esta_en_inicio(self):
        return self.esta_visible(self.tab_inicio)
    
    def abrir_menu(self):
        self.hacer_click(self.btn_menu)