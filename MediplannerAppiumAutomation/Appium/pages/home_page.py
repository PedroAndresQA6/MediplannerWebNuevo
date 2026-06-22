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
        # Boton de menu/perfil (icono de persona, esquina sup. derecha). No tiene
        # content-desc, asi que se localiza por su posicion en la barra superior.
        self.btn_menu = (AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[1103,221][1220,338]']")
        self.titulo_perfil = (AppiumBy.XPATH, "//*[@content-desc='Perfil']")

    def abrir_perfil(self):
        """Abre la pantalla de Perfil desde el icono de menu (esquina sup. der.).
        Si el test viene de una sub-pantalla (incluso un formulario profundo), regresa
        al Home antes de abrir el menu. Usa el back de Android como mecanismo principal
        (mas confiable que el 'Regresar' in-app, que a veces no navega) y maneja
        dialogos de descarte que puedan aparecer al salir de un formulario."""
        import time as _t
        for _ in range(12):
            if self.esta_visible(self.btn_menu, timeout=2):
                self.hacer_click(self.btn_menu)
                return self.esta_visible(self.titulo_perfil, timeout=5)
            # Back de Android (dismiss de formularios/modales mas fiable que 'Regresar')
            self.driver.back()
            _t.sleep(0.8)
            # Si aparece un dialogo de descartar/salir, confirmarlo
            for txt in ('Descartar', 'Salir', 'Sí', 'Si', 'Aceptar', 'Continuar'):
                dlg = (AppiumBy.XPATH, f"//android.widget.Button[@content-desc='{txt}']")
                if self.esta_visible(dlg, timeout=1):
                    self.hacer_click(dlg)
                    _t.sleep(0.6)
                    break
            if self.esta_visible(self.btn_menu, timeout=1):
                continue
            # Como respaldo, intentar el 'Regresar' in-app
            regresar = (AppiumBy.XPATH, "//*[@content-desc='Regresar']")
            if self.esta_visible(regresar, timeout=1):
                try:
                    self.hacer_click(regresar)
                except Exception:
                    pass
                _t.sleep(0.6)
        return False

    def abrir_seccion_perfil(self, nombre):
        """Desde la pantalla Perfil, abre una seccion por su texto (ej. 'Datos Personales',
        'Cuenta', 'Historial Medico', 'Progreso', 'Documentos', 'Compartir').
        Hace scroll si la seccion esta por debajo del fold."""
        loc = (AppiumBy.XPATH, f"//*[contains(@content-desc, '{nombre}')]")
        if not self.esta_visible(loc, timeout=3):
            for _ in range(3):
                self.scroll_abajo()
                if self.esta_visible(loc, timeout=1):
                    break
        self.hacer_click(loc)

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