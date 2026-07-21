import time

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

    # ── Cierre de turno: pantalla de resumen (recon módulo 11, 2026-07-16) ────
    # Confirmado: NO existe paso de firma antes de confirmar (a diferencia de
    # lo que describe el checklist en 11.7/11.8) — CONFIRMAR Y CERRAR TURNO
    # es clickeable directo apenas carga el resumen. Ver también el docstring
    # de `cerrar_turno` más abajo.
    TITULO_CIERRE_TURNO = (AppiumBy.ACCESSIBILITY_ID, "Cierre de turno")
    BOTON_EXPORTAR_BITACORA = (AppiumBy.ACCESSIBILITY_ID, "EXPORTAR BITÁCORA")
    OPCION_GUARDAR_EN_DISPOSITIVO = (AppiumBy.ACCESSIBILITY_ID, "Guardar en dispositivo")
    OPCION_COMPARTIR_BITACORA = (AppiumBy.ACCESSIBILITY_ID, "Compartir")
    ERROR_CARGA_RESUMEN = (
        AppiumBy.XPATH,
        '//android.view.View[contains(@content-desc, "No se pudo cargar el resumen")]',
    )
    BOTON_REINTENTAR_RESUMEN = (AppiumBy.ACCESSIBILITY_ID, "Reintentar")

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

    # ── Check-in asistido: bloqueo por proximidad (recon módulo 8, 2026-07-09) ─
    # Al alejarse >50m con el sidebar de check-in abierto, aparece un banner con
    # el texto "Estás a X m del espacio" (X se actualiza en vivo mientras se
    # mueve el GPS) seguido de "...debes estar a 50 m o menos...". Matchear por
    # "m del espacio" (estable ante el número real de metros, a diferencia del
    # texto completo). OJO clave: el botón "Check-In Asistido" NO desaparece ni
    # cambia su atributo `enabled` (queda "true") — el atributo real que se
    # apaga es `clickable` (pasa a "false"). `BasePage.esta_habilitado` usa
    # `is_enabled()` (mapea a `enabled`), así que da un falso "sigue habilitado"
    # acá — cualquier chequeo de este bloqueo debe leer `clickable` directo vía
    # `get_attribute("clickable")`, no `esta_habilitado`.
    BANNER_FUERA_PROXIMIDAD = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "m del espacio")]')

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

    # ── Historial del espacio (recon módulo 9, 2026-07-09) ────────────────
    # Sheet con título "Historial · {código}", filas por reservación
    # ("{PLACA}\noperador\nEstatus: {estado}\nInicio {fecha} · Límite {fecha}"),
    # se cierra igual que el diálogo de Filtros: tocando el backdrop
    # "Sombreado" (mismo patrón, no hay botón "Cerrar" propio).
    HISTORIAL_TITULO = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "Historial ·")]')
    CERRAR_HISTORIAL = (AppiumBy.XPATH, '//android.view.View[@content-desc="Sombreado"]')

    # ── Reporte (recon módulo 9, 2026-07-09) ──────────────────────────────
    # Al tocar LEVANTAR REPORTE sin permiso de cámara otorgado, Android
    # muestra su diálogo NATIVO de permiso (fuera del árbol de la app, mismo
    # patrón que `manejar_popup_permiso_ubicacion`). Si se deniega, la propia
    # app muestra un diálogo secundario (SÍ en su árbol de accesibilidad)
    # "Permiso de cámara requerido" con botones "Cancelar"/"Abrir
    # configuración" — y NO navega a la pantalla de reporte (checklist 9.6).
    DIALOGO_PERMISO_CAMARA_TITULO = (AppiumBy.ACCESSIBILITY_ID, "Permiso de cámara requerido")
    DIALOGO_PERMISO_CAMARA_CANCELAR = (AppiumBy.ACCESSIBILITY_ID, "Cancelar")

    # ── Pantalla de Reporte (recon módulo 10, 2026-07-16) ─────────────────
    # Se abre desde LEVANTAR REPORTE del sidebar de un ocupado. Catálogo real
    # confirmado (7 motivos, todos `android.view.View` clickable sin
    # `checked`/`selected` expuesto — Flutter no mapea el estado de selección
    # visual a accesibilidad, mismo tipo de limitación que los colores del
    # módulo 6): "Fuera de tiempo", "Placa no coincide", "Mal estacionado",
    # "Zona prohibida", "Sin registro (no escaneó QR)", "Obstrucción", "Otro".
    TITULO_TIPO_REPORTE = (AppiumBy.ACCESSIBILITY_ID, "TIPO DE REPORTE")
    MOTIVO_FUERA_DE_TIEMPO = (AppiumBy.ACCESSIBILITY_ID, "Fuera de tiempo")
    MOTIVO_PLACA_NO_COINCIDE = (AppiumBy.ACCESSIBILITY_ID, "Placa no coincide")
    MOTIVO_MAL_ESTACIONADO = (AppiumBy.ACCESSIBILITY_ID, "Mal estacionado")
    MOTIVO_ZONA_PROHIBIDA = (AppiumBy.ACCESSIBILITY_ID, "Zona prohibida")
    MOTIVO_SIN_REGISTRO = (AppiumBy.ACCESSIBILITY_ID, "Sin registro (no escaneó QR)")
    MOTIVO_OBSTRUCCION = (AppiumBy.ACCESSIBILITY_ID, "Obstrucción")
    MOTIVO_OTRO = (AppiumBy.ACCESSIBILITY_ID, "Otro")
    CAMPO_PLACA_OBSERVADA = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="PLACA OBSERVADA"]/following-sibling::android.widget.EditText[1]',
    )
    CONTADOR_FOTOS_REPORTE = (AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "fotos")]')
    BOTON_CAMBIAR_CAMARA = (AppiumBy.ACCESSIBILITY_ID, "Cambiar cámara")
    # El obturador no tiene content-desc propio (NAF en el dump) — se ubica
    # por posición relativa a 'Cambiar cámara', su vecino con label real, en
    # vez de bounds absolutos (resolución-independiente).
    BOTON_CAPTURAR_FOTO = (
        AppiumBy.XPATH,
        '//android.view.View[@content-desc="Cambiar cámara"]/preceding-sibling::android.view.View[@clickable="true"][1]',
    )
    BOTON_ENVIAR_REPORTE = (AppiumBy.ACCESSIBILITY_ID, "ENVIAR REPORTE AL BACKOFFICE")
    AVISO_REPORTE_PREVIO = (
        AppiumBy.XPATH,
        '//android.view.View[contains(@content-desc, "ya tiene un reporte")]',
    )

    def contador_fotos_reporte(self, timeout=5):
        """Lee 'N fotos' -> N. Devuelve None si no encuentra el contador."""
        import re
        elems = self.buscar_elementos(self.CONTADOR_FOTOS_REPORTE, timeout)
        if not elems:
            return None
        m = re.search(r"(\d+)\s*fotos", elems[0].get_attribute("content-desc") or "")
        return int(m.group(1)) if m else None

    def tomar_foto_reporte(self):
        """Toca el obturador de la pantalla de Reporte (cámara del emulador,
        produce una imagen real — el AVD sí simula una cámara virtual, ver
        HALLAZGOS.md sobre 10.11). Espera un poco: la captura no es
        instantánea y tocar de nuevo demasiado rápido no siempre suma una
        foto nueva (recon 2026-07-16)."""
        self.hacer_click(self.BOTON_CAPTURAR_FOTO)
        time.sleep(2)

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
        rotan).

        OJO (falso positivo real encontrado en recon 2026-07-21, ver
        HALLAZGOS.md): si el sidebar de un espacio sigue abierto (p.ej. justo
        después de cancelar un diálogo, que no lo cierra), su título "ESPACIO
        {código}" también matchea `contains(@content-desc, "CJ-")` aunque no
        sea una fila de la lista — y quedaba mal reportado como si el espacio
        apareciera en el filtro que se esté chequeando. Las filas reales
        tienen un content-desc multilínea ('Libre\\nCJ-1-0362AE\\n16 de
        septiembre\\n— sin —\\n9 m'); el título del sidebar es una sola
        línea. Se descarta cualquier match sin salto de línea para evitar
        ese falso positivo."""
        import re
        filas = self.buscar_elementos((AppiumBy.XPATH, '//android.view.View[contains(@content-desc, "CJ-")]'), timeout)
        codigos = []
        for fila in filas:
            desc = fila.get_attribute("content-desc") or ""
            if "\n" not in desc:
                continue
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
        `liberar_espacio_actual`). Espera a que el panel de confirmación se
        cierre tras tocar CONFIRMAR (hallazgo módulo 8, 2026-07-09: sin esta
        espera, un llamador que navega de inmediato a la Vista Lista puede
        adelantarse a que el backend termine de procesar el check-in y seguir
        viendo el espacio como 'Libre')."""
        self.ingresar_texto(self.CAMPO_PLACA_CHECKIN, placa)
        self.hacer_click(self.BOTON_CHECKIN_ASISTIDO)
        self.hacer_click(self.BOTON_CONFIRMAR_CHECKIN)
        self.esperar_invisible(self.BOTON_CONFIRMAR_CHECKIN, timeout=15)

    def esperar_fuera_de_libres(self, codigo, intentos=5, espera=2.0):
        """Reintenta hasta que un espacio recién chequeado desaparezca de
        'Libres' en la Vista Lista (debe estar aplicado ese filtro al
        llamar). Hallazgo módulo 8/9 (2026-07-09): pese a que
        `hacer_checkin_asistido` ya espera a que el backend cierre el panel
        de confirmación, la lista de 'Libres' no siempre refleja el cambio
        de inmediato al volver a la Vista Lista — reintentar (reactivando el
        filtro para forzar una re-lectura) evita declarar un falso bug por
        puro timing. Devuelve True si en algún intento ya no aparece."""
        codigos = self.codigos_de_espacios_visibles()
        restantes = intentos
        while codigo in codigos and restantes > 0:
            time.sleep(espera)
            self.hacer_click(self.FILTRO_LIBRES)  # desactivar
            self.hacer_click(self.FILTRO_LIBRES)  # reactivar (fuerza re-lectura)
            codigos = self.codigos_de_espacios_visibles()
            restantes -= 1
        return codigo not in codigos

    # ── Espacio ocupado (liberar / ver historial) ─────────────────────────

    def ubicar_y_abrir_ocupado(self, codigo, intentos=6, espera_entre=3.0):
        """Ubica un espacio ocupado por su código probando los filtros de
        ocupado de a uno (sin asumir bajo cuál cayó) y, si lo encuentra, lo
        deja con el sidebar YA ABIERTO. Factoriza la búsqueda que antes
        vivía inline en `liberar_por_codigo` para que otros flujos (probar
        Cancelar, probar el bloqueo por proximidad) no dupliquen la misma
        lógica de reintento. Dos hallazgos del módulo 8 (2026-07-09) que
        dictan cómo está escrito esto:

        1. **Lag de categorización de ocupados:** un espacio recién chequeado
           sale de 'Libres' al instante (UI optimista), pero tarda varios
           segundos en aparecer del lado de ocupado — de ahí el reintento.
        2. **Los filtros NO son unión confiable al encadenarse** (mismo hallazgo
           del módulo 7): activar Vigentes+Por vencer+Urgencia juntos mostró
           SOLO el set de Urgencia, no la unión. Por eso se prueba UN filtro a
           la vez (activar → leer → desactivar), que sí da resultados limpios.

        OJO para el llamador: el filtro que lo encontró queda ACTIVO (para
        no perder de vista la fila mientras se abre el sidebar). Si más
        adelante el llamador necesita chequear otro filtro (p.ej. volver a
        'Libres' tras cancelar una liberación), primero debe llamar
        `limpiar_filtro_ocupado_activo()` — de lo contrario, como los chips
        son acumulativos, terminaría viendo la UNIÓN de ambos filtros en vez
        del filtro nuevo solo (hallazgo real detectado al escribir 9.4: un
        espacio seguía 'ocupado' de verdad pero aparecía igual en 'Libres'
        porque 'Vigentes' había quedado prendido de este método).

        Devuelve True si lo encontró (y lo dejó abierto), False si no
        apareció en ningún intento."""
        self.ir_a_lista()
        filtros = (self.FILTRO_VIGENTES, self.FILTRO_POR_VENCER, self.FILTRO_URGENCIA)
        for intento in range(1, intentos + 1):
            for filtro in filtros:
                try:
                    self.hacer_click(filtro, timeout=5)
                except Exception:
                    continue
                presente = codigo in self.codigos_de_espacios_visibles()
                if presente:
                    self.abrir_espacio(codigo)
                    self._filtro_ocupado_activo = filtro
                    return True
                try:
                    self.hacer_click(filtro, timeout=5)  # desactivar antes del siguiente
                except Exception:
                    pass
            self.logger.info(
                f"ubicar_y_abrir_ocupado: {codigo} aún no visible en ningún filtro de "
                f"ocupado (intento {intento}/{intentos}), reintentando por el lag..."
            )
            time.sleep(espera_entre)
        return False

    def limpiar_filtro_ocupado_activo(self):
        """Desactiva el filtro de ocupado que dejó activo la última llamada a
        `ubicar_y_abrir_ocupado` (ver nota ahí sobre chips acumulativos).
        Llamar ANTES de aplicar un filtro distinto (p.ej. volver a 'Libres')
        para no terminar viendo la unión de ambos por error. No-op si no hay
        ninguno pendiente."""
        filtro = getattr(self, "_filtro_ocupado_activo", None)
        if filtro is None:
            return
        try:
            self.hacer_click(filtro, timeout=5)
        except Exception as e:
            self.logger.warning(f"limpiar_filtro_ocupado_activo: no se pudo desactivar el filtro: {e}")
        self._filtro_ocupado_activo = None

    def liberar_por_codigo(self, codigo, intentos=6, espera_entre=3.0):
        """Ubica un espacio ocupado por su código (ver `ubicar_y_abrir_ocupado`)
        y lo libera. Devuelve True si lo encontró y liberó, False si no
        apareció en ningún intento (el llamador decide si eso es fatal o
        log-and-continue)."""
        if not self.ubicar_y_abrir_ocupado(codigo, intentos, espera_entre):
            return False
        self.liberar_espacio_actual(confirmar=True)
        self.limpiar_filtro_ocupado_activo()
        return True

    def liberar_espacio_actual(self, confirmar=True):
        """Libera el espacio cuyo sidebar de ocupado ya está abierto. Con
        `confirmar=False` prueba el flujo de cancelación (el espacio queda
        sin cambios) — patrón "validar y no confirmar la acción destructiva".

        Usa `hacer_click_estable` para el botón 'Liberar espacio' porque el
        sidebar del ocupado se re-renderiza al abrirse y el botón puede quedar
        stale justo antes del click (hallazgo módulo 8, ver CLAUDE.md §4).
        También espera explícitamente a que el diálogo de confirmación esté
        presente antes de tocar Liberar/Cancelar (el diálogo puede tardar en
        montarse tras el click, y sin esta espera el click puede dispararse
        contra un árbol todavía sin el diálogo)."""
        self.hacer_click_estable(self.BOTON_LIBERAR_ESPACIO)
        self.esperar_elemento_visible(self.DIALOGO_LIBERAR_CONFIRMAR, timeout=15)
        if confirmar:
            self.hacer_click_estable(self.DIALOGO_LIBERAR_CONFIRMAR)
        else:
            self.hacer_click_estable(self.DIALOGO_LIBERAR_CANCELAR)
