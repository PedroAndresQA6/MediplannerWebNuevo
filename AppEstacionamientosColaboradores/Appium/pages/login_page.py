import time

from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage


class LoginPage(BasePage):
    """Pantalla "Acceso operador" (login con inicio de turno). Mapeada por
    recon el 2026-07-07 con `adb shell uiautomator dump` sobre la app real.

    Es una app Flutter: los EditText no tienen resource-id ni content-desc
    propio, así que se ubican por el label hermano (View con content-desc)
    que los precede en el árbol — patrón a repetir para cualquier campo nuevo
    de esta app. El botón "INICIAR TURNO" aparece DOS veces en el árbol: un
    breadcrumb no clickeable arriba del título y el botón real (clickable=true)
    más abajo — filtrar siempre por `@clickable="true"`."""

    # Localizador primario: por el label hermano (más legible/intencional).
    # Fallback: por índice de posición entre los EditText de la pantalla (solo
    # hay 2, confirmado en el recon) — sobrevive si alguien reordena o cambia
    # el texto del label, pero no si se agrega/quita un campo antes. Ninguna
    # de las dos es tan robusta como un accessibility id estable (ver hallazgo
    # de localizadores en CLAUDE.md); esto es mitigación, no la solución real.
    CAMPO_CREDENCIAL = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="Número de credencial"]'
        '/following-sibling::android.widget.EditText[1]',
    )
    CAMPO_CREDENCIAL_FALLBACK = (AppiumBy.XPATH, '(//android.widget.EditText)[1]')
    CAMPO_PASSWORD = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="Contraseña"]'
        '/following-sibling::android.widget.EditText[1]',
    )
    CAMPO_PASSWORD_FALLBACK = (AppiumBy.XPATH, '(//android.widget.EditText)[2]')
    BOTON_INICIAR_TURNO = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="INICIAR TURNO" and @clickable="true"]',
    )
    BOTON_OLVIDE_CONTRASENA = (AppiumBy.ACCESSIBILITY_ID, "¿Olvidaste tu contraseña?")
    # Mensaje de error que muestra el backend cuando el reloj del dispositivo
    # está desfasado (ver conftest.py:_sincronizar_reloj). Si esto aparece pese
    # al fix, señal de que el AVD necesita revisión manual del reloj.
    ERROR_RELOJ_DESFASADO = (AppiumBy.XPATH, '//*[contains(@content-desc, "reloj desfasado")]')

    # Validación de campos requeridos (recon módulo 4, 2026-07-07): al enviar
    # el form con un campo vacío, el mismo texto del hint reaparece como un
    # View hijo del EditText con `live-region="1"` (anuncio de accesibilidad)
    # — así se confirma que es realmente el mensaje de validación y no el
    # hint de diseño (que no es un nodo propio en el árbol hasta que el campo
    # se marca inválido).
    ERROR_CREDENCIAL_REQUERIDA = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="Ingresa tu número de credencial" and @live-region="1"]',
    )
    ERROR_PASSWORD_REQUERIDA = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="Ingresa tu contraseña" and @live-region="1"]',
    )

    # ── Diálogo "Recuperar contraseña" (recon módulo 4) ───────────────────────
    DIALOGO_RECUPERAR_TITULO = (AppiumBy.ACCESSIBILITY_ID, "Recuperar contraseña")
    CAMPO_EMAIL_RECUPERAR = (AppiumBy.XPATH, '//android.widget.EditText')
    BOTON_CANCELAR_RECUPERAR = (AppiumBy.ACCESSIBILITY_ID, "Cancelar")
    BOTON_ENVIAR_ENLACE = (AppiumBy.ACCESSIBILITY_ID, "Enviar enlace")
    # Mismo patrón de validación por live-region que los campos del login.
    ERROR_EMAIL_INVALIDO = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="Ingresa un correo válido" and @live-region="1"]',
    )

    def login(self, credencial, password):
        """Completa el form e inicia turno. OJO: si el login es exitoso, esto
        abre un turno REAL en el backend (marker: 'destructivo'/estado). Todo
        test que llame a este método debe cerrar el turno al terminar (ver
        HomePage.cerrar_turno) para no dejar turnos huérfanos en el ambiente
        compartido — lección aprendida en el recon inicial."""
        self.ingresar_texto_con_fallback([self.CAMPO_CREDENCIAL, self.CAMPO_CREDENCIAL_FALLBACK], credencial)
        self.ingresar_texto_con_fallback([self.CAMPO_PASSWORD, self.CAMPO_PASSWORD_FALLBACK], password)
        # NO llamar a ocultar_keyboard() acá: en esta pantalla, justo tras
        # escribir la contraseña, a veces el teclado ya se ocultó solo — y
        # driver.hide_keyboard() sin teclado visible cae a un back nativo que
        # saca la app entera a Home (ver BasePage.ocultar_keyboard).
        self.hacer_click(self.BOTON_INICIAR_TURNO)
        # El Home que carga tras el login pide ubicación para el mapa — puede
        # disparar el popup nativo de permiso (ver
        # BasePage.manejar_popup_permiso_ubicacion). Directiva de Pedro:
        # siempre "Mientras se usa la app".
        time.sleep(1)
        self.manejar_popup_permiso_ubicacion()
