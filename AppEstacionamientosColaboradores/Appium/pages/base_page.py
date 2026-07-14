import os
import re
import time
import logging
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from appium.webdriver.common.appiumby import AppiumBy

from config import APP_PACKAGE


class BasePage:

    APP_PACKAGE = APP_PACKAGE

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

    # ── Esperas y acciones base ────────────────────────────────────────────────

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

    def esperar_invisible(self, localizador, timeout=15):
        """Espera a que un elemento (spinner/loader) desaparezca."""
        return WebDriverWait(self.driver, timeout).until(
            EC.invisibility_of_element_located(localizador)
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

    def hacer_click_estable(self, localizador, timeout=15, reintentos=3):
        """Click tolerante a `StaleElementReferenceException`: re-localiza y
        reintenta si el elemento se vuelve stale entre que se lo encuentra y
        se lo clickea. Esta app Flutter re-renderiza sidebars/diálogos con
        animación continua (ver CLAUDE.md §4), así que un elemento recién
        hallado puede quedar desligado del DOM justo antes del `.click()`.
        Usar en botones que aparecen dentro de un panel que se está montando
        (p.ej. 'Liberar espacio' apenas se abre el sidebar de un ocupado)."""
        from selenium.common.exceptions import StaleElementReferenceException
        ultimo_error = None
        for intento in range(1, reintentos + 1):
            try:
                elemento = self.esperar_elemento_clickable(localizador, timeout)
                elemento.click()
                self.logger.info(f"Click estable: {localizador}")
                return
            except StaleElementReferenceException as e:
                ultimo_error = e
                self.logger.warning(
                    f"Elemento stale al clickear {localizador} "
                    f"(intento {intento}/{reintentos}); re-localizando..."
                )
                time.sleep(0.6)
        self.tomar_screenshot(f"stale_agotado_{self._nombre(localizador)}")
        raise ultimo_error

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
        return self.esperar_elemento_visible(localizador, timeout).text

    def obtener_atributo(self, localizador, atributo, timeout=15):
        return self.esperar_elemento_visible(localizador, timeout).get_attribute(atributo)

    def esta_visible(self, localizador, timeout=5):
        try:
            self.esperar_elemento_visible(localizador, timeout)
            return True
        except Exception:
            return False

    def esta_habilitado(self, localizador, timeout=5):
        try:
            elemento = self.esperar_elemento_clickable(localizador, timeout)
            return elemento.is_enabled()
        except Exception:
            return False

    def buscar_elementos(self, localizador, timeout=8):
        """find_elements con espera EXPLÍCITA: espera hasta que aparezca al menos
        un elemento; si en `timeout` no aparece ninguno, devuelve [] sin bloquear
        de más. Reemplaza el patrón caro `sleep(N) + driver.find_elements(...)`."""
        try:
            WebDriverWait(self.driver, timeout).until(
                lambda d: len(d.find_elements(*localizador)) > 0
            )
        except TimeoutException:
            return []
        return self.driver.find_elements(*localizador)

    def click_y_esperar(self, loc_click, loc_esperado, timeout=15):
        """Click y espera a que aparezca el elemento resultante, sin sleep fijo."""
        self.hacer_click(loc_click, timeout)
        return self.esperar_elemento_visible(loc_esperado, timeout)

    # ── Localizadores con fallback (mitiga fragilidad de apps Flutter) ─────────
    # Esta app es Flutter: los campos de texto no exponen resource-id ni
    # content-desc propio, así que se ubican por estructura (el label hermano
    # que los precede, o su posición/índice entre los EditText de la pantalla).
    # Ambas estrategias son más frágiles que un accessibility id estable — si
    # el layout se reordena, el localizador primario puede dejar de matchear.
    # `..._con_fallback` prueba una LISTA de localizadores en orden: no
    # reemplaza pedirle a los devs identificadores estables (Semantics/Key en
    # Flutter — ver hallazgo en CLAUDE.md), pero evita que un cambio menor de
    # layout tumbe el test si existe una segunda forma razonable de ubicar el
    # mismo elemento (p.ej. por índice de posición entre EditText).

    def _resolver_con_fallback(self, localizadores, timeout=15):
        ultimo_error = None
        for i, loc in enumerate(localizadores):
            try:
                elemento = self.esperar_elemento_visible(loc, timeout=timeout if i == 0 else min(timeout, 5))
                if i > 0:
                    self.logger.warning(
                        f"Localizador primario {localizadores[0]} no matcheó; "
                        f"funcionó el fallback #{i}: {loc}. Revisar si el layout "
                        f"cambió (señal temprana antes de que TODOS los "
                        f"fallbacks dejen de funcionar)."
                    )
                return elemento
            except Exception as e:
                ultimo_error = e
        self.tomar_screenshot(f"fallback_agotado_{self._nombre(localizadores[0])}")
        raise ultimo_error

    def hacer_click_con_fallback(self, localizadores, timeout=15):
        self._resolver_con_fallback(localizadores, timeout).click()

    def ingresar_texto_con_fallback(self, localizadores, texto, timeout=15):
        elemento = self._resolver_con_fallback(localizadores, timeout)
        elemento.click()
        time.sleep(0.5)
        elemento.clear()
        elemento.send_keys(texto)

    # ── Selección robusta (patrón "opción B" de facturación en la suite web) ───

    def seleccionar_con_reintento(self, localizador, accion_seleccion, mensaje_bug, intentos=2, espera_entre=0.8):
        """Envuelve una selección inestable (dropdown/picker nativo que a veces
        queda deshabilitado/re-renderizado, igual que el <select> de
        tipo_persona_id en facturación web) en reintentos cortos con try/except.
        Si tras `intentos` sigue sin poder seleccionar, falla con un mensaje de
        BUG explícito (prefijo 🐛) en vez de un TimeoutError genérico — para no
        confundir "bug de la app" con "selector roto del test".

        `accion_seleccion` es un callable sin argumentos con el click/selección
        real (lo define la page object concreta, que conoce el localizador)."""
        ultimo_error = None
        for intento in range(1, intentos + 1):
            try:
                accion_seleccion()
                return True
            except Exception as e:
                ultimo_error = e
                self.logger.warning(f"Intento {intento}/{intentos} de selección falló: {e}")
                time.sleep(espera_entre)
        self.tomar_screenshot(f"bug_seleccion_{self._nombre(localizador)}")
        raise AssertionError(f"🐛 {mensaje_bug} (último error: {ultimo_error})")

    # ── Verificación de persistencia real (patrón scanResidualIndicators web) ──

    def verificar_persistencia_doble_pasada(self, chequeo, espera_seg=1.5):
        """Confirma que un estado (dato guardado, indicador limpiado, badge
        actualizado, etc.) es REAL y no un falso positivo de timing: evalúa
        `chequeo()` (callable que devuelve bool), espera, y lo vuelve a evaluar.
        Solo devuelve True si el resultado es consistente en ambas pasadas —
        evita reportar un bug por una UI que todavía no terminó de re-renderizar."""
        primera = bool(chequeo())
        time.sleep(espera_seg)
        segunda = bool(chequeo())
        return primera and segunda

    # ── Selectores resolución-independientes (por posición, no bounds fijos) ───

    def tap_esquina_sup_derecha(self, clase="android.widget.Button", timeout=8):
        """Toca el elemento clickable de `clase` más a la DERECHA en la franja
        superior (~20% de alto). Para iconos sin content-desc. Resolución-
        independiente: nunca usar bounds absolutos hardcodeados."""
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

    def tap_esquina_sup_izquierda(self, clase="android.widget.Button", timeout=8):
        """Análogo a `tap_esquina_sup_derecha` pero para el elemento más a la
        IZQUIERDA (p.ej. hamburguesa/back sin content-desc)."""
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
        candidatos[0][1].click()
        return True

    def esta_en_foreground(self):
        """True si la app sigue en foreground (app_state >= 4, mismo criterio
        que crash_monitor en conftest.py)."""
        try:
            return self.driver.query_app_state(self.APP_PACKAGE) >= 4
        except Exception:
            return True

    def reactivar_si_salio(self):
        """Si un back de más (p.ej. atrapados en un picker nativo) sacó a la app
        del foreground, la reactiva en vez de seguir presionando back a ciegas.
        Devuelve True si tuvo que reactivarla (el llamador debe reintentar su
        chequeo, no seguir encadenando el siguiente back)."""
        if self.esta_en_foreground():
            return False
        self.logger.warning("La app salió de foreground; reactivando...")
        self.driver.activate_app(self.APP_PACKAGE)
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
        """Convierte un localizador (tupla (by, value)) en un nombre de
        archivo seguro. Los locators de esta app suelen ser XPath largos con
        `/`, `[`, `]`, `@`, `"` (p.ej. '//android.view.View[@content-desc="X"]')
        — reemplazar TODO carácter no alfanumérico por `_` en vez de solo
        espacios/paréntesis (que alcanzaba en Mediplanner, con locators simples
        de accessibility id, pero no acá: un `/` literal en el nombre de
        archivo se interpreta como separador de carpeta y rompe la escritura
        del screenshot)."""
        return re.sub(r'[^A-Za-z0-9_-]+', '_', str(localizador)).strip('_')[:50]

    def _parse_bounds(self, bounds_str):
        """Convierte '[x1,y1][x2,y2]' en (x1, y1, x2, y2). None si no parsea."""
        try:
            nums = re.findall(r'-?\d+', bounds_str or '')
            if len(nums) == 4:
                return tuple(int(n) for n in nums)
        except Exception:
            pass
        return None

    def scroll_abajo(self):
        size = self.driver.get_window_size()
        self.driver.swipe(size['width'] / 2, size['height'] * 0.8, size['width'] / 2, size['height'] * 0.2, 500)

    def scroll_arriba(self):
        size = self.driver.get_window_size()
        self.driver.swipe(size['width'] / 2, size['height'] * 0.2, size['width'] / 2, size['height'] * 0.8, 500)

    def manejar_popup_permiso_ubicacion(self, timeout=3):
        """Maneja el popup NATIVO de Android (fuera del árbol de la app) que
        pregunta por acceso a ubicación la primera vez que la app la pide en
        la sesión — puede aparecer pese a la capability `autoGrantPermissions`
        (esta última hace `pm grant` al crear la sesión, pero Android igual
        puede reabrir el diálogo "Solo esta vez / Mientras se usa la app / No
        permitir" si el flujo de la app lo dispara explícitamente). Directiva
        de Pedro: siempre elegir 'Mientras se usa la app'. Usa
        `find_elements` (no espera bloqueante) porque la mayoría de las
        corridas NO lo muestran — no debe agregar latencia en el caso común.
        El resource-id `permission_allow_foreground_only_button` es de AOSP
        (`com.android.permissioncontroller` / `com.google.android...`), no
        depende del texto ni del idioma."""
        try:
            elems = self.driver.find_elements(
                AppiumBy.XPATH, '//*[contains(@resource-id, "permission_allow_foreground_only_button")]'
            )
        except Exception:
            return False
        if not elems:
            return False
        try:
            elems[0].click()
            self.logger.info("Popup de permiso de ubicación detectado: elegido 'Mientras se usa la app'")
            time.sleep(0.5)
            return True
        except Exception as e:
            self.logger.warning(f"Popup de permiso de ubicación detectado pero no se pudo tocar el botón: {e}")
            return False

    def denegar_popup_permiso_camara(self, timeout=5):
        """Maneja el popup NATIVO de Android que pide acceso a cámara (p.ej.
        al tocar LEVANTAR REPORTE, módulo 9) y elige 'No permitir', a
        diferencia de `manejar_popup_permiso_ubicacion` que siempre acepta.
        Recon (2026-07-09): el botón de rechazo aparece como
        `permission_deny_button` la primera vez que Android pregunta, pero
        como `permission_deny_and_dont_ask_again_button` en preguntas
        posteriores dentro de la misma instalación — `contains` sobre
        "permission_deny" cubre ambos casos sin depender de cuál sea. A
        diferencia del popup de ubicación, este SÍ espera de forma bloqueante
        (con `timeout`) porque el caso de uso (9.6) depende de que aparezca."""
        try:
            elems = WebDriverWait(self.driver, timeout).until(
                lambda d: d.find_elements(AppiumBy.XPATH, '//*[contains(@resource-id, "permission_deny")]')
            )
        except TimeoutException:
            return False
        try:
            elems[0].click()
            self.logger.info("Popup de permiso de cámara detectado: elegido 'No permitir'")
            time.sleep(0.5)
            return True
        except Exception as e:
            self.logger.warning(f"Popup de permiso de cámara detectado pero no se pudo tocar el botón: {e}")
            return False

    def ocultar_keyboard(self):
        """Solo oculta el teclado si está REALMENTE visible. Lección aprendida
        en el recon de Estacionamientos Colaboradores: `driver.hide_keyboard()`
        sin teclado visible cae a un back nativo en UiAutomator2 y puede sacar
        la app entera a Home (mismo riesgo que usar `adb keyevent BACK` a
        ciegas). Nunca llamar a hide_keyboard() sin este chequeo previo."""
        try:
            if self.driver.is_keyboard_shown():
                self.driver.hide_keyboard()
        except Exception:
            pass
