from .base_page import BasePage
from appium.webdriver.common.appiumby import AppiumBy
import time


class LoginPage(BasePage):
    
    def __init__(self, driver):
        super().__init__(driver)
        
        # Initial screen - Spanish
        self.btn_iniciar_sesion = (AppiumBy.ACCESSIBILITY_ID, "Inicia sesión")
        self.btn_registrarse = (AppiumBy.ACCESSIBILITY_ID, "Regístrate")
        
        # Login form - Spanish
        self.campo_email = (AppiumBy.XPATH, "//android.widget.EditText[@hint='email@email.com']")
        self.campo_password = (AppiumBy.XPATH, "//android.widget.EditText[@hint='Escribe tu contraseña']")
        self.btn_entrar = (AppiumBy.ACCESSIBILITY_ID, "Entrar a Mediplanner")
        
        # Home - menu button (top right) - bounds updated
        self.btn_menu = (AppiumBy.XPATH, "//android.widget.ImageView[@bounds='[1103,221][1220,338]']")
        
        # Profile menu - Spanish
        self.btn_cerrar_sesion_menu = (AppiumBy.ACCESSIBILITY_ID, "Cerrar sesión")
        
        # Logout confirmation dialog - Spanish
        self.btn_cerrar_sesion_confirm = (AppiumBy.ACCESSIBILITY_ID, "Cerrar sesión")
        self.btn_cancelar = (AppiumBy.ACCESSIBILITY_ID, "Cancelar")
        
        # Home tabs - Spanish
        self.tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")
    
    def esta_logueado(self):
        """Detecta si ya está en Home (logueado)"""
        return self.esta_visible(self.tab_inicio, timeout=3)
    
    def esta_en_pantalla_login(self):
        """Detecta si está en pantalla de login"""
        return self.esta_visible(self.btn_iniciar_sesion, timeout=3)
    
    def logout_si_logueado(self):
        """Hace logout si ya está logueado"""
        if self.esta_logueado():
            self.logger.info("Ya logueado, haciendo logout...")
            
            # Click menu button (top right)
            self.hacer_click(self.btn_menu)
            time.sleep(2)
            
            # Multiple scrolls to find logout option
            for _ in range(3):
                self.scroll_abajo()
                time.sleep(0.5)
            
            # Click logout in menu
            self.hacer_click(self.btn_cerrar_sesion_menu)
            time.sleep(2)
            
            # Confirm logout
            self.hacer_click(self.btn_cerrar_sesion_confirm)
            time.sleep(5)
            
            # Esperar a que aparezca la pantalla de login
            time.sleep(3)
            self.logger.info("Logout completado")
    
    def hacer_click_iniciar_sesion(self):
        self.hacer_click(self.btn_iniciar_sesion)
    
    def hacer_click_registrarse(self):
        self.hacer_click(self.btn_registrarse)
    
    def ingresar_email(self, email):
        self.ingresar_texto(self.campo_email, email)
        self.ocultar_keyboard()
    
    def ingresar_password(self, password):
        self.ingresar_texto(self.campo_password, password)
        self.ocultar_keyboard()
    
    def hacer_click_entrar(self):
        self.ocultar_keyboard()
        self.hacer_click(self.btn_entrar)
    
    def iniciar_sesion(self, email, password):
        time.sleep(3)
        
        # Detectar en qué pantalla estamos
        en_home = self.esta_logueado()
        
        if en_home:
            # Ya está logueado, solo fazer click en menu y logout
            self.logger.info("Ya está en home, haciendo logout...")
            self.hacer_click(self.btn_menu)
            time.sleep(2)
            self.scroll_abajo()
            time.sleep(1)
            self.hacer_click(self.btn_cerrar_sesion_menu)
            time.sleep(2)
            self.hacer_click(self.btn_cerrar_sesion_confirm)
            time.sleep(8)
        
        # Ahora debe aparecer pantalla con "Regístrate" e "Inicia sesión"
        time.sleep(3)
        
        # Click en "Inicia sesión" (android.view.View con bounds [751,2451][1024,2529])
        btn_iniciar = (AppiumBy.XPATH, "//android.view.View[@content-desc='Inicia sesión']")
        if self.esta_visible(btn_iniciar, timeout=3):
            self.hacer_click(btn_iniciar)
            time.sleep(4)
        
        # Ahora llenar formulario
        self.ingresar_email(email)
        self.ingresar_password(password)
        self.hacer_click_entrar()