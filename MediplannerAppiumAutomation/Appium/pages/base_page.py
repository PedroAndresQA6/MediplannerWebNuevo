import os
import time
import logging
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
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

    # ── Esperas dinámicas (la app marca el ritmo, no un sleep fijo) ──────────────

    def esperar_invisible(self, localizador, timeout=15):
        """Espera a que un elemento (p.ej. un spinner/loader) desaparezca."""
        return WebDriverWait(self.driver, timeout).until(
            EC.invisibility_of_element_located(localizador)
        )

    def buscar_elementos(self, localizador, timeout=8):
        """find_elements con espera EXPLÍCITA: espera hasta que aparezca al menos un
        elemento y lo devuelve al instante; si en `timeout` no aparece ninguno,
        devuelve [] sin bloquear de más. Reemplaza al patrón caro
        `sleep(N) + driver.find_elements(...)`."""
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: len(d.find_elements(*localizador)) > 0
            )
        except TimeoutException:
            return []
        return self.driver.find_elements(*localizador)

    def click_y_esperar(self, loc_click, loc_esperado, timeout=15):
        """Hace click y espera a que aparezca el elemento resultante (patrón
        Playwright: interactuar → esperar lo que debe aparecer, sin sleep fijo).
        Devuelve el elemento esperado."""
        self.hacer_click(loc_click, timeout)
        return self.esperar_elemento_visible(loc_esperado, timeout)

    def tap_esquina_sup_izquierda(self, clase="android.widget.ImageView", timeout=8):
        """Toca el elemento clickable de `clase` más a la IZQUIERDA en la franja
        superior (~20% de alto). En Home es el avatar del titular → abre el drawer
        de perfil (con 'Agregar dependiente'). Resolución-independiente.

        Excluye el botón 'Escanear código QR' (también ImageView arriba a la
        izquierda): clickearlo abre la cámara, que no se puede probar."""
        elems = self.buscar_elementos((AppiumBy.XPATH, f"//{clase}[@clickable='true']"), timeout)
        franja = self.driver.get_window_size()['height'] * 0.2
        candidatos = []
        for e in elems:
            b = self._parse_bounds(e.get_attribute('bounds'))
            if not (b and b[1] < franja):
                continue
            desc = e.get_attribute('content-desc') or ''
            if any(k in desc for k in ('QR', 'Escanear', 'código', 'codigo')):
                continue  # no tocar el escáner QR (abre la cámara)
            candidatos.append((b[0], e))
        if not candidatos:
            return False
        candidatos.sort(key=lambda t: t[0])
        candidatos[0][1].click()  # el más a la izquierda (sin QR) = avatar del titular
        return True

    def tap_esquina_sup_derecha(self, clase="android.widget.Button", timeout=8):
        """Toca el elemento clickable de `clase` más a la derecha en la franja
        superior (~20% de alto). Reemplaza los selectores por bounds absolutos
        (que se rompen al cambiar la resolución del dispositivo). Devuelve True si
        clickeó algo."""
        elems = self.buscar_elementos((AppiumBy.XPATH, f"//{clase}[@clickable='true']"), timeout)
        franja = self.driver.get_window_size()['height'] * 0.2
        candidatos = []
        for e in elems:
            b = self._parse_bounds(e.get_attribute('bounds'))
            if b and b[1] < franja:
                candidatos.append((b[0], e))
        if not candidatos:
            return False
        candidatos.sort(key=lambda t: t[0])
        candidatos[-1][1].click()
        return True

    def assert_visible(self, localizador, mensaje, timeout=10):
        """Aserción con evidencia: si el elemento no aparece en `timeout`, toma
        screenshot y falla con un mensaje claro (para detección de bugs)."""
        if not self.esta_visible(localizador, timeout):
            self.tomar_screenshot(f"assert_fail_{self._nombre(localizador)}")
            raise AssertionError(mensaje)
        return True
    
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

    def _parse_bounds(self, bounds_str):
        """Convierte '[x1,y1][x2,y2]' en (x1, y1, x2, y2). None si no parsea.
        Sirve para localizar elementos por POSICIÓN RELATIVA (resolución-independiente)
        en vez de por bounds absolutos hardcodeados."""
        try:
            import re
            nums = re.findall(r'-?\d+', bounds_str or '')
            if len(nums) == 4:
                return tuple(int(n) for n in nums)
        except Exception:
            pass
        return None
    
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