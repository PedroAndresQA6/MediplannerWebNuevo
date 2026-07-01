from .base_page import BasePage
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait


class LoginPage(BasePage):

    def __init__(self, driver):
        super().__init__(driver)

        # Pantalla inicial (deslogueado)
        self.btn_iniciar_sesion = (AppiumBy.ACCESSIBILITY_ID, "Inicia sesión")
        self.btn_registrarse = (AppiumBy.ACCESSIBILITY_ID, "Regístrate")

        # Formulario de login. El email/contraseña se distinguen por el atributo
        # password (false=email, true=contraseña), no por el hint (que cambia).
        self.campo_email = (AppiumBy.XPATH, "//android.widget.EditText[@password='false']")
        self.campo_password = (AppiumBy.XPATH, "//android.widget.EditText[@password='true']")
        self.btn_entrar = (AppiumBy.ACCESSIBILITY_ID, "Entrar a Mediplanner")

        # Home / Perfil / logout
        self.tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")
        self.titulo_perfil = (AppiumBy.XPATH, "//*[@content-desc='Perfil']")
        # 'Cerrar sesión' aparece tanto como opción en Perfil como en el diálogo de
        # confirmación; se resuelve por posición (la última = botón del diálogo).
        self.opcion_cerrar_sesion = (AppiumBy.ACCESSIBILITY_ID, "Cerrar sesión")
        self.btn_cancelar = (AppiumBy.ACCESSIBILITY_ID, "Cancelar")

    # ── Detección de estado ─────────────────────────────────────────────────────

    def esta_logueado(self):
        """True si estamos en Home (pestañas visibles)."""
        return self.esta_visible(self.tab_inicio, timeout=3)

    def esta_en_pantalla_login(self):
        """True si estamos en la pantalla inicial de login."""
        return self.esta_visible(self.btn_iniciar_sesion, timeout=3)

    # ── Navegación al menú de Perfil (resolución-independiente) ──────────────────

    def _abrir_perfil_desde_menu(self, timeout=8):
        """Abre la pantalla Perfil desde el icono de menú (esquina superior derecha).

        NO usa bounds absolutos (cambian con la resolución): localiza el ImageView
        clickable más a la derecha de la franja superior, que es el icono de menú.
        Devuelve True si se llegó a la pantalla Perfil.

        Nota: el tooltip 'Mostrar menú' pertenece al drawer IZQUIERDO (avatar del
        titular, con 'Agregar dependiente'), NO a la pantalla Perfil; por eso se
        localiza por posición (icono top-right) y no por ese tooltip."""
        size = self.driver.get_window_size()
        franja = size['height'] * 0.2
        candidatos = []
        for im in self.driver.find_elements(AppiumBy.XPATH, "//android.widget.ImageView[@clickable='true']"):
            b = self._parse_bounds(im.get_attribute('bounds'))
            if b and b[1] < franja:
                candidatos.append((b[0], im))  # b[0] = x1
        if not candidatos:
            self.logger.error("No se encontró el icono de menú en la barra superior")
            return False
        candidatos.sort(key=lambda t: t[0])
        candidatos[-1][1].click()  # el más a la derecha = icono de menú
        return self.esta_visible(self.titulo_perfil, timeout)

    # ── Logout ───────────────────────────────────────────────────────────────────

    def logout_si_logueado(self):
        """Si hay sesión activa, la cierra de forma robusta:
        Home → menú → Perfil → (scroll) Cerrar sesión → confirmar → pantalla login."""
        if not self.esta_logueado():
            return

        self.logger.info("Sesión activa: cerrando sesión...")
        if not self._abrir_perfil_desde_menu():
            self.logger.warning("No se pudo abrir Perfil; se omite el logout")
            return

        # 'Cerrar sesión' está bajo el fold: scroll hasta que sea visible.
        for _ in range(6):
            if self.esta_visible(self.opcion_cerrar_sesion, timeout=1):
                break
            self.scroll_abajo()
        self.hacer_click(self.opcion_cerrar_sesion)  # abre el diálogo de confirmación

        # Confirmar. El diálogo trae 'Cancelar' + 'Cerrar sesión'; esperar a que
        # aparezca 'Cancelar' (señal de diálogo abierto) y pulsar el ÚLTIMO
        # 'Cerrar sesión' del árbol (el botón del diálogo, no la opción de la lista).
        self.esperar_elemento_visible(self.btn_cancelar, 5)
        botones = self.driver.find_elements(*self.opcion_cerrar_sesion)
        if botones:
            botones[-1].click()

        # Sesión cerrada = quedamos deslogueados. Según el build, el logout cae en el
        # FORMULARIO de credenciales (campo email) o en la pantalla intro con el
        # botón 'Inicia sesión'. Se acepta cualquiera de los dos como señal.
        self._esperar_deslogueado(15)
        self.logger.info("Logout completado")

    def _esperar_deslogueado(self, timeout=15):
        """Espera a estar deslogueado: formulario de credenciales visible (campo
        email) o pantalla intro con 'Inicia sesión'."""
        WebDriverWait(self.driver, timeout).until(
            lambda d: len(d.find_elements(*self.campo_email)) > 0
            or len(d.find_elements(*self.btn_iniciar_sesion)) > 0
        )

    # ── Login ──────────────────────────────────────────────────────────────────

    def ingresar_email(self, email):
        self.ingresar_texto(self.campo_email, email)
        self.ocultar_keyboard()

    def ingresar_password(self, password):
        self.ingresar_texto(self.campo_password, password)
        self.ocultar_keyboard()

    def hacer_click_iniciar_sesion(self):
        self.hacer_click(self.btn_iniciar_sesion)

    def hacer_click_registrarse(self):
        self.hacer_click(self.btn_registrarse)

    def hacer_click_entrar(self):
        self.ocultar_keyboard()
        self.hacer_click(self.btn_entrar)

    def _esperar_app_lista(self, timeout=30):
        """Espera a que la app termine el splash y muestre un estado CONOCIDO: Home
        (sesión persistida) o alguna pantalla de login. Evita la race condition de
        actuar durante el splash de arranque en frío."""
        WebDriverWait(self.driver, timeout).until(
            lambda d: d.find_elements(*self.tab_inicio)
            or d.find_elements(*self.campo_email)
            or d.find_elements(*self.btn_iniciar_sesion)
        )

    def _reiniciar_app(self):
        """Reinicia la app (terminate + activate). Recupera el cuelgue en blanco
        post-login (render hang de RN, intermitente en el emulador)."""
        pkg = "mx.mediplanner.app"
        try:
            self.driver.terminate_app(pkg)
            self.driver.activate_app(pkg)
        except Exception as e:
            self.logger.error(f"No se pudo reiniciar la app: {e}")

    def iniciar_sesion(self, email, password):
        """Login robusto e idempotente, sin sleeps fijos. Cubre todos los estados:
        splash de arranque, sesión ya activa (logout previo), pantalla intro o
        formulario directo, y el cuelgue en blanco post-login (reinicia y reintenta)."""
        # Dejar pasar el splash y aterrizar en un estado conocido.
        self._esperar_app_lista(30)

        # Estado limpio: si hay sesión activa, cerrarla.
        self.logout_si_logueado()

        # Entrar al formulario. En arranque en frío hay una intro con 'Inicia sesión';
        # tras un logout se cae directo al formulario. Solo se clickea si aparece.
        if self.esta_visible(self.btn_iniciar_sesion, timeout=3):
            self.hacer_click(self.btn_iniciar_sesion)

        # Formulario de credenciales.
        self.esperar_elemento_visible(self.campo_email, 15)
        self.ingresar_email(email)
        self.ingresar_password(password)
        self.hacer_click_entrar()

        # Confirmar que el login llegó al Home. Si no renderiza (posible render hang
        # post-login del emulador, con sesión ya creada), reiniciar la app y reintentar.
        if not self.esta_visible(self.tab_inicio, timeout=30):
            self.logger.warning(
                "Home no renderizó tras el login; reiniciando la app "
                "(posible cuelgue de render del emulador)"
            )
            self._reiniciar_app()
            if not self.esta_visible(self.tab_inicio, timeout=30):
                raise AssertionError(
                    "El login no llegó al Home ni tras reiniciar la app "
                    "(revisar OOM/render del emulador en logcat)"
                )
