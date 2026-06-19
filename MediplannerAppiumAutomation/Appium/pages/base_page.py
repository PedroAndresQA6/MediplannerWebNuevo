import os
import time
import logging
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from appium.webdriver.common.appiumby import AppiumBy


class BasePage:
    
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 15)
        self.logger = self._configurar_logger()
    
    def _configurar_logger(self):
        logger = logging.getLogger(self.__class__.__name__)
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)
        return logger
    
    def esperar_elemento_clickable(self, localizador, timeout=15):
        return WebDriverWait(self.driver, timeout).until(
            EC.element_to_be_clickable(localizador)
        )
    
    def esperar_elemento_visible(self, localizador, timeout=15):
        return WebDriverWait(self.driver, timeout).until(
            EC.visibility_of_element_located(localizador)
        )
    
    def esperar_elemento_presente(self, localizador, timeout=15):
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located(localizador)
        )
    
    def hacer_click(self, localizador, timeout=15):
        try:
            elemento = self.esperar_elemento_clickable(localizador, timeout)
            elemento.click()
            self.logger.info(f"Click: {localizador}")
        except Exception as e:
            self.logger.error(f"Error click: {e}")
            self.tomar_screenshot(f"error_click_{self._nombre(localizador)}")
            raise
    
    def ingresar_texto(self, localizador, texto, timeout=15):
        try:
            elemento = self.esperar_elemento_visible(localizador, timeout)
            elemento.click()
            time.sleep(0.5)
            elemento.clear()
            elemento.send_keys(texto)
            self.logger.info(f"Input: {texto}")
        except Exception as e:
            self.logger.error(f"Error input: {e}")
            self.tomar_screenshot(f"error_input_{self._nombre(localizador)}")
            raise
    
    def obtener_texto(self, localizador, timeout=15):
        elemento = self.esperar_elemento_visible(localizador, timeout)
        return elemento.text
    
    def obtener_atributo(self, localizador, atributo, timeout=15):
        elemento = self.esperar_elemento_visible(localizador, timeout)
        return elemento.get_attribute(atributo)
    
    def esta_visible(self, localizador, timeout=5):
        try:
            self.esperar_elemento_visible(localizador, timeout)
            return True
        except:
            return False
    
    def esta_habilitado(self, localizador, timeout=5):
        try:
            elemento = self.esperar_elemento_clickable(localizador, timeout)
            return elemento.is_enabled()
        except:
            return False
    
    def tomar_screenshot(self, nombre):
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        reports_dir = os.path.join(os.path.dirname(__file__), '..', 'reports')
        os.makedirs(reports_dir, exist_ok=True)
        filepath = os.path.join(reports_dir, f"{nombre}_{timestamp}.png")
        self.driver.get_screenshot_as_file(filepath)
        self.logger.info(f"Screenshot: {filepath}")
        return filepath
    
    def _nombre(self, localizador):
        return str(localizador).replace(' ', '_').replace('(', '').replace(')', '').replace(',', '').replace("'", "")[:50]
    
    def scroll_abajo(self):
        size = self.driver.get_window_size()
        self.driver.swipe(size['width']/2, size['height']*0.8, size['width']/2, size['height']*0.2, 500)
    
    def scroll_arriba(self):
        size = self.driver.get_window_size()
        self.driver.swipe(size['width']/2, size['height']*0.2, size['width']/2, size['height']*0.8, 500)
    
    def ocultar_keyboard(self):
        try:
            self.driver.hide_keyboard()
        except:
            pass