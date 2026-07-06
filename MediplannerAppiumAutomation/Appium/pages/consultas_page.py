"""
Page object para la pestaña Consultas: listar programadas/previas, agendar,
reprogramar, confirmar asistencia y continuar el flujo de una consulta previa
(iniciar tratamiento desde Receta, cargar resultados en Estudios).

Reemplaza la lógica que antes vivía inline en tests/test_consultas.py (563
líneas en 2 tests). Sigue el mismo patrón que utils/medicamentos.py: pasos
validados con assert_visible (mensajes claros si la UI cambió) y esperas
dinámicas de BasePage en vez de time.sleep() fijos.
"""
import time
from appium.webdriver.common.appiumby import AppiumBy
from .base_page import BasePage


SEL_CITA_PROGRAMADA = (AppiumBy.XPATH, "//android.widget.ImageView[contains(@content-desc, 'Dr.')]")
SEL_CITA_PREVIA = (AppiumBy.XPATH,
    "//android.widget.ImageView[contains(@content-desc, '/') and "
    "(contains(@content-desc, 'AM') or contains(@content-desc, 'PM'))]")
SEL_FECHA_DISPONIBLE = (AppiumBy.XPATH, "//android.view.View[contains(@content-desc, '\n') and @clickable='true']")
SEL_HORARIO_DISPONIBLE = (AppiumBy.XPATH, "//android.view.View[contains(@content-desc, ':') and @clickable='true']")
BTN_SIGUIENTE = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Siguiente']")


def _clave_doctor(texto):
    """Normaliza un nombre de doctor para comparar entre pantallas que lo
    formatean distinto (confirmado contra la app real: Médicos muestra
    'Dr. Fernando...' con espacio, Programadas muestra 'Dr.Armando...' sin
    espacio). Quita 'Dr.' y todo espacio, compara en minúsculas."""
    return (texto or "").replace("Dr.", "").replace(" ", "").strip().lower()


class ConsultasPage(BasePage):

    def __init__(self, driver):
        super().__init__(driver)
        self.tab_consultas = (AppiumBy.ACCESSIBILITY_ID, "Consultas\nPestaña 3 de 5")
        self.tab_programadas = (AppiumBy.ACCESSIBILITY_ID, "Programadas\nPestaña 1 de 2")
        self.tab_previas = (AppiumBy.ACCESSIBILITY_ID, "Previas\nPestaña 2 de 2")
        self.titulo_consultas = (AppiumBy.XPATH, "//android.view.View[@content-desc='Mis consultas']")

    # ── Navegación ────────────────────────────────────────────────────────

    def abrir(self):
        """Entra a la pestaña Consultas desde la barra inferior."""
        self.hacer_click(self.tab_consultas)
        self.assert_visible(self.titulo_consultas, "No se cargó la pantalla de Consultas")

    def ir_a_programadas(self):
        self.hacer_click(self.tab_programadas)

    def ir_a_previas(self):
        self.hacer_click(self.tab_previas)

    def _scroll_y_listar(self, selector, intentos=3):
        for _ in range(intentos):
            self.scroll_abajo()
        return self.buscar_elementos(selector, timeout=6)

    # ── Programadas ───────────────────────────────────────────────────────

    def buscar_cita_agendada(self):
        """Busca (con scroll) la primera cita con estado 'Agendada' en
        Programadas. Devuelve el WebElement, o None si no hay ninguna."""
        for cita in self._scroll_y_listar(SEL_CITA_PROGRAMADA):
            if "Agendada" in (cita.get_attribute("content-desc") or ""):
                return cita
        return None

    def agendar_cita(self, home_page):
        """Agenda una cita nueva desde Médicos (primer doctor disponible, tipo
        de consulta / fecha / horario, el primero disponible de cada uno) y
        vuelve a Consultas > Programadas. Devuelve el WebElement de la cita
        recién agendada, verificando que corresponde al doctor elegido (no
        cualquier cita 'Agendada' preexistente)."""
        home_page.ir_a_medicos()
        doctores = self.buscar_elementos(
            (AppiumBy.XPATH, "//android.view.View[contains(@content-desc, 'Dr.')]"))
        assert doctores, "No hay doctores disponibles para agendar una cita"
        doctor = doctores[0]
        nombre_doctor = doctor.get_attribute("content-desc").split(chr(10))[0]
        self.logger.info(f"Agendando con: {nombre_doctor}")
        doctor.click()

        btn_solicitar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Solicitar cita']")
        self.assert_visible(btn_solicitar, "No se encontró el botón 'Solicitar cita'")
        self.hacer_click(btn_solicitar)

        btn_tipo = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Selecciona el tipo de consulta']")
        self.hacer_click(btn_tipo)
        tipos = self.buscar_elementos(
            (AppiumBy.XPATH, "//android.widget.Button[contains(@content-desc, 'Consulta')]"))
        assert tipos, "No hay tipos de consulta disponibles"
        tipos[0].click()

        fechas = self.buscar_elementos(SEL_FECHA_DISPONIBLE)
        assert fechas, "No hay fechas disponibles para agendar"
        fechas[0].click()

        horarios = self.buscar_elementos(SEL_HORARIO_DISPONIBLE)
        assert horarios, "No hay horarios disponibles para agendar"
        horarios[0].click()

        btn_final = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Solicitar cita' and @enabled='true']")
        self.assert_visible(btn_final, "El botón 'Solicitar cita' no se habilitó")
        self.hacer_click(btn_final)

        home_page.ir_a_consultas()
        self.ir_a_programadas()
        clave_doctor = _clave_doctor(nombre_doctor)
        for cita in self._scroll_y_listar(SEL_CITA_PROGRAMADA):
            desc = cita.get_attribute("content-desc") or ""
            if "Agendada" in desc and clave_doctor in _clave_doctor(desc):
                return cita
        raise AssertionError(
            f"Se solicitó la cita con '{nombre_doctor}' pero no aparece como 'Agendada' "
            "con ese doctor en Programadas (¿la solicitud no se persistió?)")

    def reprogramar(self, cita):
        """Reprograma la `cita` (WebElement con estado 'Agendada') a la
        fecha/horario más próximo disponible. Devuelve la nueva cita
        'Agendada' resultante, verificando que su fecha/hora (parte del
        content-desc) realmente cambió respecto a la original — si el backend
        ignora el reprogramado pero la UI navega igual, esto lo detecta."""
        desc_original = cita.get_attribute("content-desc") or ""
        cita.click()
        btn_reprogramar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Reprogramar']")
        self.assert_visible(btn_reprogramar, "No se encontró el botón 'Reprogramar'")
        self.hacer_click(btn_reprogramar)
        self.assert_visible(
            (AppiumBy.XPATH, "//android.view.View[@content-desc='Reprogramar cita']"),
            "No se cargó la pantalla de Reprogramar")

        fechas = self.buscar_elementos(SEL_FECHA_DISPONIBLE)
        if not fechas:
            btn_mas_fechas = (AppiumBy.XPATH, "//android.view.View[@content-desc='Más fechas']")
            if self.esta_visible(btn_mas_fechas, timeout=2):
                self.hacer_click(btn_mas_fechas)
                fechas = self.buscar_elementos(SEL_FECHA_DISPONIBLE)
        assert fechas, "No hay fechas disponibles para reprogramar"
        fechas[0].click()

        horarios = self.buscar_elementos(SEL_HORARIO_DISPONIBLE)
        assert horarios, "No hay horarios disponibles para reprogramar"
        horarios[0].click()

        btn_confirmar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Confirmar nuevo horario']")
        elemento = self.esperar_elemento_visible(btn_confirmar, timeout=10)
        assert elemento.get_attribute("enabled") == "true", \
            "El botón 'Confirmar nuevo horario' no se habilitó"
        elemento.click()

        # Forzar una relectura real (salir a Programadas y re-listar) en vez de
        # confiar en el estado en memoria justo tras el click de "Confirmar".
        self.ir_a_programadas()
        nueva_cita = self.buscar_cita_agendada()
        assert nueva_cita, "No se encontró la cita reprogramada como 'Agendada'"
        desc_nuevo = nueva_cita.get_attribute("content-desc") or ""
        assert desc_nuevo != desc_original, (
            "La cita sigue mostrando la misma fecha/hora que antes de reprogramar "
            f"({desc_original!r}) — el reprogramado no parece haberse persistido"
        )
        return nueva_cita

    def confirmar_asistencia(self, cita):
        """Abre la `cita` y confirma la asistencia (incluye el popup). Verifica
        que el estado de la cita cambió de 'Agendada' a 'Confirmada' en
        Programadas (confirmado contra la app real: el content-desc de la fila
        pasa de '...\\nAgendada\\n...' a '...\\nConfirmada\\n...')."""
        desc_original = cita.get_attribute("content-desc") or ""
        cita.click()
        btn = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Confirmar asistencia']")
        self.assert_visible(btn, "No se encontró el botón 'Confirmar asistencia'")
        self.hacer_click(btn)

        popup = (AppiumBy.XPATH, "//android.view.View[@content-desc='¿Confirmar asistencia?']")
        self.assert_visible(popup, "No apareció el popup '¿Confirmar asistencia?'")

        btn_popup = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Confirmar']")
        self.assert_visible(btn_popup, "No se encontró el botón 'Confirmar' del popup")
        self.hacer_click(btn_popup)

        # Forzar relectura real: salir a Programadas y buscar la misma cita por
        # su prefijo (doctor+fecha+hora), que no cambia al confirmar.
        prefijo = "\n".join(desc_original.split("\n")[:3])
        self.ir_a_programadas()
        citas = self._scroll_y_listar(SEL_CITA_PROGRAMADA)
        actualizada = next(
            (c for c in citas if prefijo in (c.get_attribute("content-desc") or "")), None)
        assert actualizada, (
            "Tras confirmar asistencia, la cita ya no aparece en Programadas "
            f"(prefijo buscado: {prefijo!r})"
        )
        desc_actualizado = actualizada.get_attribute("content-desc") or ""
        assert "Confirmada" in desc_actualizado, (
            "Tras confirmar asistencia, la cita sigue sin mostrar el estado "
            f"'Confirmada' (content-desc actual: {desc_actualizado!r})"
        )

    # ── Previas ───────────────────────────────────────────────────────────

    def buscar_cita_previa(self):
        """Busca (con scroll) una cita 'Terminada'; si no hay, una 'Iniciada'.
        Devuelve (WebElement, estado) o (None, None) si no hay ninguna."""
        citas = self._scroll_y_listar(SEL_CITA_PREVIA)
        for estado in ("Terminada", "Iniciada"):
            for cita in citas:
                if estado in (cita.get_attribute("content-desc") or ""):
                    return cita, estado
        return None, None

    def iniciar_tratamiento_desde_receta(self):
        """Desde el detalle de una cita previa: abre la pestaña Receta y, si
        hay medicamentos sin iniciar, completa el flujo de 'Iniciar
        tratamiento' (activa el switch, avanza los pasos y ajusta la hora a
        14:30). Deja la vista de vuelta en el detalle de la Consulta.
        Devuelve True si ejecutó el alta, False si ya estaban todos iniciados
        o no había botón 'Iniciar tratamiento'."""
        tab_receta = (AppiumBy.XPATH, "//android.view.View[@content-desc='Receta\nPestaña 2 de 4']")
        self.assert_visible(tab_receta, "No se encontró la pestaña Receta")
        self.hacer_click(tab_receta)

        botones_iniciar = self.buscar_elementos(
            (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Iniciar tratamiento']"), timeout=5)
        if not botones_iniciar:
            return False
        botones_iniciar[0].click()

        switches = self.buscar_elementos((AppiumBy.XPATH, "//android.widget.Switch"), timeout=5)
        sin_iniciar = any(s.get_attribute("checked") == "false" for s in switches)
        if not sin_iniciar:
            self.driver.back()
            return False

        switch_medicamento = (AppiumBy.XPATH, "//android.widget.Switch")
        self.assert_visible(switch_medicamento, "No se encontró el Switch del medicamento")
        self.hacer_click(switch_medicamento)

        self.assert_visible(BTN_SIGUIENTE, "No apareció 'Siguiente' tras activar el medicamento")
        self.hacer_click(BTN_SIGUIENTE)
        self.assert_visible(BTN_SIGUIENTE, "No apareció el segundo 'Siguiente' (seekbar)")
        self.hacer_click(BTN_SIGUIENTE)

        # Ajustar hora del tratamiento a 14:30. Es un gesto físico sobre un
        # seekbar sin elemento nuevo que aparezca al terminar, así que un
        # sleep corto tras cada swipe es inevitable (no hay qué esperar).
        self.driver.swipe(160 + int((640 - 160) * 14 / 24), 1143, 160 + int((640 - 160) * 14 / 24), 1143, 500)
        time.sleep(0.5)
        self.driver.swipe(640 + int((1120 - 640) * 30 / 60), 1143, 640 + int((1120 - 640) * 30 / 60), 1143, 500)

        btn_iniciar_final = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Iniciar tratamiento']")
        self.assert_visible(btn_iniciar_final, "No apareció el botón final 'Iniciar tratamiento'")
        self.hacer_click(btn_iniciar_final)

        # Señal de que el alta se procesó (no solo que el click no lanzó excepción):
        # el botón debe desaparecer al confirmarse: si el backend falla y la app se
        # queda en la misma pantalla, este assert lo detecta en vez de asumir éxito.
        assert self.esperar_invisible(btn_iniciar_final, timeout=10), \
            "Tras 'Iniciar tratamiento' el botón sigue visible (el alta no parece haberse procesado)"

        self.driver.back()
        return True

    def cargar_resultado_estudio(self, comentario="Estudio cargado desde automatización"):
        """Desde el detalle de una cita previa: navega a Estudios (vía
        Exploración + swipe) y carga el primer resultado disponible en la
        galería del dispositivo, con un comentario. Devuelve True si llegó
        hasta 'Finalizar', False si no había botón 'Cargar resultados'."""
        titulo_consulta = (AppiumBy.XPATH, "//android.view.View[@content-desc='Consulta']")
        if not self.esta_visible(titulo_consulta, timeout=2):
            self.driver.back()

        tab_exploracion = (AppiumBy.XPATH, "//android.view.View[@content-desc='Exploración\nPestaña 4 de 4']")
        self.assert_visible(tab_exploracion, "No se encontró la pestaña Exploración", timeout=5)
        self.hacer_click(tab_exploracion)

        # Swipe de pestañas: gesto físico, sin elemento propio que esperar.
        try:
            self.driver.swipe(900, 965, 300, 965, 500)
        except Exception:
            self.driver.tap([(300, 965)])
        time.sleep(0.5)

        tab_estudios = (AppiumBy.XPATH, "//android.view.View[@content-desc='Estudios\nPestaña 3 de 4']")
        self.assert_visible(tab_estudios, "No se encontró la pestaña Estudios", timeout=5)
        self.hacer_click(tab_estudios)

        btn_cargar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Cargar resultados']")
        if not self.esta_visible(btn_cargar, timeout=3):
            return False
        self.hacer_click(btn_cargar)

        if self.esta_visible(BTN_SIGUIENTE, timeout=5):
            self.hacer_click(BTN_SIGUIENTE)

        btn_tomar_foto = (AppiumBy.XPATH, "//android.view.View[@content-desc='Tomar foto o seleccionar archivo']")
        self.assert_visible(btn_tomar_foto, "No apareció 'Tomar foto o seleccionar archivo'", timeout=5)
        self.hacer_click(btn_tomar_foto)

        btn_galeria = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Galería']")
        self.assert_visible(btn_galeria, "No apareció el botón 'Galería'", timeout=8)
        self.hacer_click(btn_galeria)

        imagenes = self.buscar_elementos(
            (AppiumBy.XPATH, "//android.widget.ImageView[@resource-id='com.google.android.documentsui:id/icon_thumb']"),
            timeout=8)
        if not imagenes:
            return False
        imagenes[0].click()

        # Verificado contra la app real: al volver del picker nativo, la hoja
        # 'Galería/Cámara' de 'Tomar foto o seleccionar archivo' queda ABIERTA
        # encima de 'Agregar estudio' (el archivo sí se adjuntó) y tapa el
        # botón 'Siguiente'. El tap a coordenadas fijas que había antes no
        # caía sobre esa hoja para cerrarla (selector nativo, no expone un
        # elemento estable); back() sí la cierra de forma confiable.
        self.driver.back()

        if self.esta_visible(BTN_SIGUIENTE, timeout=5):
            self.hacer_click(BTN_SIGUIENTE)

        campo_comentarios = (AppiumBy.XPATH,
            "//android.widget.EditText[@hint='Puede agregar comentarios o notas referentes al documento cargado.']")
        # NOTA: en pruebas contra la app real, tras 'Siguiente' a veces la app se
        # queda en la misma pantalla ('Agregar estudio') sin avanzar al campo de
        # comentarios, incluso esperando 20s — no se pudo determinar si es un bug
        # real o un efecto de datos de prueba acumulados (archivos duplicados en
        # el mismo estudio). Pendiente de investigar con el estudio en un estado
        # limpio (un solo archivo cargado).
        self.assert_visible(campo_comentarios, "No apareció el campo de comentarios", timeout=10)
        self.ingresar_texto(campo_comentarios, comentario)
        self.ocultar_keyboard()

        btn_finalizar = (AppiumBy.XPATH, "//android.widget.Button[@content-desc='Finalizar']")
        self.assert_visible(btn_finalizar, "No apareció el botón 'Finalizar'", timeout=5)
        self.hacer_click(btn_finalizar)

        # Señal de que la carga se procesó: el botón/pantalla de 'Finalizar' debe
        # desaparecer; si el backend falla y la app se queda en la misma pantalla,
        # este assert lo detecta en vez de asumir éxito por no haber lanzado excepción.
        assert self.esperar_invisible(btn_finalizar, timeout=10), \
            "Tras 'Finalizar' la pantalla de carga sigue visible (la carga no parece haberse procesado)"
        return True
