from .base_page import BasePage
from appium.webdriver.common.appiumby import AppiumBy
from utils.navegacion import volver_inicio


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
        self.titulo_perfil = (AppiumBy.XPATH, "//*[@content-desc='Perfil']")

    def abrir_perfil(self):
        """Abre la pantalla de Perfil desde el icono de persona (esquina sup. der.,
        un ImageView sin content-desc; se localiza por posicion, no por bounds
        absolutos, via tap_esquina_sup_derecha). Sin importar en que pantalla
        empiece el test (incluso un formulario profundo o un picker nativo
        atrapado de un test anterior), usa el helper ya probado `volver_inicio`
        para garantizar que estamos en Home antes de intentar el tap posicional
        -- evita reinventar aqui el back-loop de recuperacion (fragil: en
        Perfil, por ejemplo, la esquina sup. der. es un boton 'Compartir', no
        un ImageView, asi que el tap posicional nunca matchea y machacar
        back() a ciegas desde ahi no garantiza volver a Home).
        No hay atajo por 'si ya estamos en Perfil': el content-desc='Perfil'
        del titulo tambien aparece como etiqueta de seccion dentro de otras
        pantallas (p.ej. el formulario 'Invitar a Mediplanner' tiene una fila
        'Perfil'), asi que detectarlo sin mas contexto da falsos positivos."""
        volver_inicio(self.driver, self)
        if self.tap_esquina_sup_derecha("android.widget.ImageView", timeout=4):
            return self.esta_visible(self.titulo_perfil, timeout=5)
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
        self.tap_esquina_sup_derecha("android.widget.ImageView", timeout=8)