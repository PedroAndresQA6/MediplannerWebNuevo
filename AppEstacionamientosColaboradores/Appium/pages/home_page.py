from appium.webdriver.common.appiumby import AppiumBy
from pages.base_page import BasePage


class HomePage(BasePage):
    """Pantalla principal del operador (mapa de espacios + turno activo).
    Mapeada por recon el 2026-07-07. Estructura: barra superior (zona activa,
    GPS, conectividad, reloj de turno, menú de usuario) + mapa de Google con
    marcadores de espacios + barra de herramientas (Mapa/Lista, buscador,
    filtros) + leyenda de estados (Libre/Vigente/Tiempo excedido)."""

    # Aparece apenas termina de cargar el mapa tras el login — más estable que
    # esperar el propio mapa de Google (que puede tardar/streamear tiles).
    INDICADOR_HOME = (AppiumBy.ACCESSIBILITY_ID, "ZONA ACTIVA")

    ESTADO_GPS = (AppiumBy.ACCESSIBILITY_ID, "GPS")
    ESTADO_CONEXION = (AppiumBy.ACCESSIBILITY_ID, "En línea")
    # Recon módulo 5 (2026-07-07): content-desc real es " · Turno 00:00"
    # (con el separador y los dos puntos incluidos) — matchear por
    # `contains("Turno")` en vez del texto exacto, ya que el valor cambia
    # todo el tiempo.
    DURACION_TURNO = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "Turno")]')
    TAB_MAPA = (AppiumBy.ACCESSIBILITY_ID, "Mapa")
    TAB_LISTA = (AppiumBy.ACCESSIBILITY_ID, "Lista")
    BOTON_FILTROS = (AppiumBy.ACCESSIBILITY_ID, "Filtros")
    TOGGLE_OCULTAR_LIBRES = (AppiumBy.ACCESSIBILITY_ID, "Ocultar libres")
    CAMPO_BUSCAR_ESPACIO = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="Mapa"]/following-sibling::android.widget.EditText[1]',
    )
    # El menú de usuario expone email+nombre en un solo content-desc multilínea
    # ("FE\nfernando\nfernando@rym-solutions.com") — matchear por email con
    # `contains` en vez de comparar el content-desc completo (el nombre varía
    # por operador).
    MENU_USUARIO = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "@")]')
    OPCION_MODO_PRESENTACION = (AppiumBy.ACCESSIBILITY_ID, "Modo presentación")
    OPCION_CERRAR_TURNO = (AppiumBy.ACCESSIBILITY_ID, "Cerrar turno")
    BOTON_CONFIRMAR_CERRAR_TURNO = (AppiumBy.ACCESSIBILITY_ID, "CONFIRMAR Y CERRAR TURNO")

    # ── Vista Lista: chips de filtro (el badge de conteo es parte del mismo
    # content-desc, p.ej. "Libres\n9" — SIEMPRE usar `contains`, nunca
    # comparación exacta, porque el número cambia con los datos reales) ───────
    FILTRO_URGENCIA = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "Urgencia")]')
    FILTRO_POR_VENCER = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "Por vencer")]')
    FILTRO_VIGENTES = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "Vigentes")]')
    FILTRO_LIBRES = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "Libres")]')

    # ── Sidebar de espacio LIBRE (check-in asistido) ──────────────────────────
    CAMPO_PLACA_CHECKIN = (AppiumBy.XPATH, '//android.widget.EditText')
    BOTON_CHECKIN_ASISTIDO = (AppiumBy.ACCESSIBILITY_ID, "Check-In Asistido")
    BOTON_CONFIRMAR_CHECKIN = (AppiumBy.ACCESSIBILITY_ID, "CONFIRMAR")
    BOTON_CORREGIR_CHECKIN = (AppiumBy.ACCESSIBILITY_ID, "CORREGIR")

    # ── Diálogo de Filtros del mapa (recon módulo 6, 2026-07-07) ──────────────
    # `pane-title="Cuadro de diálogo"`, con secciones "Estatus" (Libre/Vigente/
    # Por vencer/Vencido) y "Tipo de vehículo" (Civil/Discapacitados/Zona de
    # Carga), todos `android.widget.Button` sin estado `checked` expuesto (no
    # se puede leer si un filtro quedó seleccionado por accesibilidad, solo
    # tocar). El backdrop clickeable+dismissable se llama "Sombreado" — tocarlo
    # cierra el diálogo (mismo patrón que "Cerrar" en recuperar contraseña).
    # OJO nombres: el botón "Vencido" acá vs. "Tiempo excedido" en la leyenda
    # del mapa — mismo estatus, texto distinto (posible inconsistencia, no
    # reportada aún).
    FILTRO_ESTATUS_LIBRE = (AppiumBy.XPATH, '//android.widget.Button[@content-desc="Libre"]')
    FILTRO_ESTATUS_VIGENTE = (AppiumBy.XPATH, '//android.widget.Button[@content-desc="Vigente"]')
    FILTRO_ESTATUS_POR_VENCER = (AppiumBy.XPATH, '//android.widget.Button[@content-desc="Por vencer"]')
    FILTRO_ESTATUS_VENCIDO = (AppiumBy.XPATH, '//android.widget.Button[@content-desc="Vencido"]')
    FILTRO_TIPO_CIVIL = (AppiumBy.ACCESSIBILITY_ID, "Civil")
    FILTRO_TIPO_DISCAPACITADOS = (AppiumBy.ACCESSIBILITY_ID, "Discapacitados")
    FILTRO_TIPO_ZONA_CARGA = (AppiumBy.ACCESSIBILITY_ID, "Zona de Carga")
    CERRAR_DIALOGO_FILTROS = (AppiumBy.XPATH, '//android.view.View[@content-desc="Sombreado"]')

    # ── Vista Mapa: marcadores (recon módulo 6) ───────────────────────────────
    # TODOS los pines comparten el mismo content-desc genérico "Marcador de
    # mapa" (Google Maps no expone el código/estatus de cada uno por
    # accesibilidad) — solo sirve para CONTAR pines o tocar "alguno", nunca
    # para identificar uno específico. Cargan de forma asíncrona tras entrar
    # a Mapa (confirmado: 1 marcador a los ~2s, 11 a los ~3.5s en el mismo
    # recon) — esperar a que el conteo se estabilice antes de usarlo.
    MARCADOR_MAPA = (AppiumBy.XPATH, '//android.view.View[@content-desc="Marcador de mapa"]')

    def contar_marcadores_mapa(self):
        return len(self.driver.find_elements(*self.MARCADOR_MAPA))

    # ── Sidebar de espacio OCUPADO (vigente/por vencer/vencido) ───────────────
    BOTON_COMO_LLEGAR = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "CÓMO LLEGAR")]')
    BOTON_LEVANTAR_REPORTE = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "LEVANTAR REPORTE")]')
    BOTON_LIBERAR_ESPACIO = (AppiumBy.ACCESSIBILITY_ID, "Liberar espacio")
    BOTON_VER_HISTORIAL = (AppiumBy.ACCESSIBILITY_ID, "VER HISTORIAL DEL ESPACIO")
    DIALOGO_LIBERAR_CONFIRMAR = (AppiumBy.XPATH, '//android.widget.Button[@content-desc="Liberar"]')
    DIALOGO_LIBERAR_CANCELAR = (AppiumBy.XPATH, '//android.widget.Button[@content-desc="Cancelar"]')

    def esta_cargado(self, timeout=15):
        # Chequeo defensivo: el mapa pide GPS al cargar y puede disparar el
        # popup nativo de ubicación con algo de delay tras el login (ver
        # BasePage.manejar_popup_permiso_ubicacion) — si sigue en pantalla,
        # tapa el indicador de Home.
        self.manejar_popup_permiso_ubicacion()
        return self.esta_visible(self.INDICADOR_HOME, timeout)

    def abrir_menu_usuario(self):
        self.hacer_click(self.MENU_USUARIO)
        self.esperar_elemento_visible(self.OPCION_CERRAR_TURNO)

    def cerrar_turno(self):
        """Cierra el turno abierto por LoginPage.login (marker: 'destructivo'
        a nivel de estado — termina una sesión real de trabajo en el backend).

        OJO: el checklist QA original describe un paso de FIRMA antes de
        confirmar (11.7/11.8/11.9) que NO EXISTE en este build (v1.0.0 build 1)
        — confirmado en recon 2026-07-07 con actividad real en el turno
        (check-in + liberación) y scrolleando toda la pantalla de resumen: va
        directo de "Actividad del turno" al botón "CONFIRMAR Y CERRAR TURNO".
        Ver HALLAZGOS.md. Si en una versión futura de la app aparece la firma,
        este método va a quedar colgado esperando `BOTON_CONFIRMAR_CERRAR_TURNO`
        — seria la señal de que hay que agregar el paso acá.

        OJO 2 (lección aprendida en recon): con el mapa de Google y el reloj de
        turno animándose de forma continua, UiAutomator2 puede fallar en
        encontrar estos elementos por `find_element` aunque estén confirmados
        presentes en el dump de accesibilidad (falla de sincronización de
        'idle', no un problema del selector). Si `hacer_click` falla acá de
        forma intermitente, la alternativa probada es un tap por coordenadas
        (`driver.tap([(x, y)])`) usando los bounds del dump en vez de
        `find_element`."""
        self.abrir_menu_usuario()
        self.hacer_click(self.OPCION_CERRAR_TURNO)
        self.hacer_click(self.BOTON_CONFIRMAR_CERRAR_TURNO)

    # ── Vista Lista ────────────────────────────────────────────────────────

    def ir_a_lista(self):
        self.hacer_click(self.TAB_LISTA)

    def ir_a_mapa(self):
        self.hacer_click(self.TAB_MAPA)

    def fila_espacio(self, codigo):
        """Localizador de una fila de espacio por su código (p.ej.
        'CJ-1-0362AE'). El content-desc de la fila entera es multilínea
        ('Libre\\nCJ-1-0362AE\\n16 de septiembre\\n— sin —\\n9 m'), así que
        `contains` con el código alcanza y es estable ante cambios de fecha/
        placa/distancia."""
        return (AppiumBy.XPATH, f'//android.view.View[contains(@content-desc, "{codigo}")]')

    def abrir_espacio(self, codigo):
        self.hacer_click(self.fila_espacio(codigo))

    def conteo_de_filtro(self, localizador_filtro, timeout=8):
        """Extrae el número de badge de un chip de filtro (p.ej. 'Libres\\n9'
        -> 9). Devuelve None si no encuentra el chip o no trae número (recon
        módulo 7, 2026-07-07: sirve para chequear que el badge del chip
        coincide con la cantidad real de filas que trae ese filtro, sin
        depender del conteo de pines del mapa — ver limitación de
        `MARCADOR_MAPA` más arriba)."""
        import re
        elems = self.buscar_elementos(localizador_filtro, timeout)
        if not elems:
            return None
        desc = elems[0].get_attribute("content-desc") or ""
        m = re.search(r"(\d+)\s*$", desc)
        return int(m.group(1)) if m else None

    def codigos_de_espacios_visibles(self, timeout=8):
        """Devuelve los códigos de espacio (p.ej. 'CJ-1-0362AE') de todas las
        filas visibles en la Vista Lista con el filtro actual aplicado.
        Útil para elegir un espacio de prueba sin hardcodear un código que
        puede no existir en la próxima corrida (los datos son de prueba y
        rotan)."""
        import re
        filas = self.buscar_elementos((AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "CJ-")]'), timeout)
        codigos = []
        for fila in filas:
            desc = fila.get_attribute("content-desc") or ""
            m = re.search(r"CJ-[\w-]+", desc)
            if m:
                codigos.append(m.group(0))
        return codigos

    # ── Check-in asistido (espacio libre) ─────────────────────────────────

    def hacer_checkin_asistido(self, placa):
        """Completa el check-in asistido sobre el espacio cuyo sidebar ya está
        abierto (llamar después de `abrir_espacio`). Deja el registro
        REALMENTE creado en el backend — el llamador es responsable de
        liberar el espacio después si quiere dejar el ambiente limpio (ver
        `liberar_espacio_actual`)."""
        self.ingresar_texto(self.CAMPO_PLACA_CHECKIN, placa)
        self.hacer_click(self.BOTON_CHECKIN_ASISTIDO)
        self.hacer_click(self.BOTON_CONFIRMAR_CHECKIN)

    # ── Espacio ocupado (liberar / ver historial) ─────────────────────────

    def liberar_espacio_actual(self, confirmar=True):
        """Libera el espacio cuyo sidebar de ocupado ya está abierto. Con
        `confirmar=False` prueba el flujo de cancelación (el espacio queda
        sin cambios) — patrón "validar y no confirmar la acción destructiva"."""
        self.hacer_click(self.BOTON_LIBERAR_ESPACIO)
        if confirmar:
            self.hacer_click(self.DIALOGO_LIBERAR_CONFIRMAR)
        else:
            self.hacer_click(self.DIALOGO_LIBERAR_CANCELAR)
