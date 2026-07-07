# CONTEXTO — AppEstacionamientosColaboradores

> Documento de continuidad de sesión. Objetivo: que una sesión nueva de Claude
> Code retome exactamente donde quedó esta, sin tener que re-explorar la app
> desde cero. **Leer esto junto con `CLAUDE.md` (cómo está armada la suite) y
> `HALLAZGOS.md` (bugs/pedidos a devs)** antes de tocar código.
>
> **Última actualización:** 2026-07-07 (tarde)

---

## 🟢 Prompt para una sesión nueva (copiar/pegar)

```
Lee AppEstacionamientosColaboradores/CONTEXTO.md, CLAUDE.md y HALLAZGOS.md y
ponte al tanto. Estamos automatizando con Appium (Python/pytest) la app
Flutter "Estacionamientos Colaboradores" sobre una tablet Android emulada,
usando checklist_qa_operador.html (74 casos) como plan maestro. Continúa con
el Módulo 8 (ver sección "Dónde quedamos"). Si el AVD lleva ya varias horas
corriendo (no es la primera sesión del día), **recomendá reiniciarlo en frío
antes de arrancar** — confirmado esta sesión que resuelve la inestabilidad
acumulada (ver "Inestabilidad del ambiente").
```

---

## Qué es esto

Suite Appium (`Appium/`, Python + pytest) para la app Flutter
`com.example.estacionamientos_mobile` ("APP Ciudad Qro — Parquímetro
Virtual"), corriendo sobre un AVD tablet (Pixel Tablet API 34, 2560x1600).
Vive dentro del repo `MediplannerWebNuevo` pero es una **app y suite
completamente independientes** de Mediplanner.

- **`CLAUDE.md`**: cómo está armada la suite (setup del AVD, patrón POM,
  helpers de `base_page.py`, monitor de crash/ANR con clasificación de
  fallos, script de estabilidad, gotchas ya resueltos del AVD).
- **`HALLAZGOS.md`**: bugs/pedidos a devs pendientes de reportar (localizadores
  Flutter sin resource-id, crash puntual, etc.) — **agregar acá**, no en
  este archivo.
- **`checklist_qa_operador.html`**: el plan maestro de pruebas (74 casos, 12
  módulos + Smoke), pegado por Pedro. Ábrelo en un navegador para ver/marcar
  progreso; el contenido canónico de los 74 casos vive ahí, no lo dupliques.

## Plan de trabajo (tasks trackeadas)

Se creó una tarea por módulo del checklist con el sistema de tasks del
propio harness (`TaskCreate`/`TaskList`/`TaskUpdate` — no confundir con
un TODO.md). **Si al retomar no ves estas tareas en tu contexto, es porque
son de otra sesión; recréalas con `TaskList` primero para ver si siguen
vivas, y si no, usa esta lista como referencia:**

| # | Módulo | Estado a esta fecha |
|---|--------|----------------------|
| 1 | S — Smoke Tests (S1-S8) | **completed** — `tests/test_smoke.py`, ver detalle abajo |
| 2 | 3 — Splash y sesión persistente | **completed** — `tests/test_3_splash_sesion.py` |
| 3 | 4 — Login e inicio de turno | **completed** — `tests/test_4_login.py` |
| 4 | 5 — Home: Topbar y estado del dispositivo | **completed** — `tests/test_5_topbar.py` |
| 5 | 6 — Home: Vista Mapa | **completed** — `tests/test_6_mapa.py`, 5/12 casos automatizados, 7 bloqueados (ver detalle) |
| 6 | 7 — Home: Vista Lista | **completed** — `tests/test_7_lista.py`, 8/9 casos, corrida 100% verde |
| 7 | 8 — Check-in asistido | **pending — siguiente** |
| 8 | 9 — Espacio ocupado | pending |
| 9 | 10 — Reporte / Infracción | pending |
| 10 | 11 — Cierre de turno | pending |
| 11 | 12 — Permisos del sistema | pending |
| 12 | 13 — Resiliencia y ciclo de vida | pending |

**Directiva de alcance de Pedro:** "cobertura total pero dividida en
diferentes pruebas separadas" — el objetivo final es cubrir los 74 casos,
pero repartido en tests/sesiones separadas (**no todo de una sentada** — si
estás retomando y ya se completaron 1-2 módulos más en esta sesión, es un
buen punto para cortar y dejar el resto para la próxima). Nombrar cada test
con el ID del checklist (`test_S1_...`, `test_4_2_...`) para trazabilidad
1 a 1.

**Directiva de Pedro sobre GPS:** la posición base del emulador ya está fija
en el punto correcto de proximidad (ver `config.GPS_LAT_BASE/LON_BASE`).
Cualquier test que necesite alejarse (casos "fuera de proximidad") puede
moverla vía `adb emu geo fix`, pero **siempre debe volver a la posición base
al final** — el fixture `gps` (en `conftest.py`) ya hace esto automáticamente
en su teardown, úsalo en vez de mover el GPS a mano.

**Directiva de Pedro sobre el popup de ubicación:** si aparece el diálogo
nativo de Android "Solo esta vez / Mientras se usa la app / No permitir",
**siempre elegir "Mientras se usa la app"**. Ya automatizado en
`BasePage.manejar_popup_permiso_ubicacion()`, llamado desde `LoginPage.login()`
y `HomePage.esta_cargado()` — no hace falta invocarlo a mano en tests que ya
pasen por esos dos puntos. Ver gotcha en `CLAUDE.md` sección 4.

---

## Dónde quedamos — próximo: Módulo 8 (Check-in asistido, 8.1-8.4)

Los módulos S, 3, 4, 5, 6 y 7 quedaron escritos y corridos contra el
emulador real esta sesión. El módulo 8 (Check-in asistido) es el siguiente:
8.1 (fuera de proximidad, requiere el fixture `gps` para alejarse),
8.2 (placa vacía — buscar el mismo patrón de validación por `live-region`
que ya funcionó en el módulo 4, aplicado al campo de placa), 8.3 (flujo
completo — ya está prácticamente cubierto por S4 en `test_smoke.py`, decidir
si 8.3 lo referencia/reusa o lo duplica con su propio ID), 8.4 (check-in sin
red, mismo patrón `svc wifi/data disable` ya usado en 3.3/4.7/5.4).

### Resumen de lo ya escrito (módulos S, 3, 4, 5, 6, 7)

- **`tests/test_smoke.py`** (S1-S8): S1, S2, S3, S4, S6, S7 escritos y
  verificados funcionalmente contra el emulador (con reintentos manuales
  puntuales por la lentitud del ambiente, ver abajo). S5 y S8 quedan
  `pytest.mark.skip` documentados (bloqueados, requieren decisión de Pedro
  o más recon — ver docstrings de skip en el propio archivo). **Matiz sobre
  S1** (descubierto en el recon del módulo 7): la app no persiste sesión
  entre relanzamientos SOLO si el turno se cerró primero por UI (que es lo
  que hace `sesion_limpia` antes del `force-stop` de S1) — si el turno queda
  abierto (p.ej. por un `cerrar_turno()` de limpieza que falló), la sesión
  local SÍ sobrevive tanto a `force-stop` como a un cold boot completo del
  AVD. El docstring de S1 ("la app NO persiste sesión") es impreciso en ese
  sentido; el comportamiento real y ya cubierto por el test sigue siendo
  correcto porque `sesion_limpia` garantiza el turno cerrado antes.
- **`tests/test_3_splash_sesion.py`** (3.1-3.4): 3.1 (pm clear simula
  primera instalación), 3.2 (`driver.background_app()` simula
  minimizar/reabrir sin matar el proceso — CONFIRMADO que a diferencia de
  S1 esto SÍ vuelve directo a Home) y 3.3 (cold start sin red, vía
  `svc wifi/data disable`) verificados. 3.4 (sesión expirada en background)
  skip — mismo bloqueo que S8.
- **`tests/test_4_login.py`** (4.1-4.7): recon confirmó que los mensajes de
  validación de campo vacío reaparecen como un `View` hijo del campo con
  `live-region="1"` (mismo texto que el hint de diseño) — selectores
  `LoginPage.ERROR_CREDENCIAL_REQUERIDA` / `ERROR_PASSWORD_REQUERIDA` /
  `ERROR_EMAIL_INVALIDO`. El diálogo "Recuperar contraseña" quedó mapeado
  (`DIALOGO_RECUPERAR_TITULO`, `CAMPO_EMAIL_RECUPERAR`,
  `BOTON_CANCELAR_RECUPERAR`, `BOTON_ENVIAR_ENLACE`). 4.3/4.6/4.7 son
  chequeos blandos (el toast de error/éxito no quedó capturable en el árbol
  de accesibilidad — ni con dump inmediato ni con espera; se verifica el
  resultado estable: se queda en Login, o el diálogo se cierra). **Hallazgo**:
  la card "Asignación de hoy" que describe el checklist como paso posterior
  al login en realidad ya está en la propia pantalla de Login (como preview,
  "Sin asignación disponible por el momento.") — no es un paso aparte, ver
  `HALLAZGOS.md`.
- **`tests/test_5_topbar.py`** (5.1-5.7): 5.1/5.3/5.4/5.6 escritos con
  selectores ya existentes (`ESTADO_GPS`, `ESTADO_CONEXION`,
  `abrir_menu_usuario`). 5.5 usa el selector nuevo `HomePage.DURACION_TURNO`
  (content-desc real confirmado: `" · Turno 00:00"`) y es
  `@pytest.mark.slow` (espera ~65s real para confirmar que el contador
  avanza). **5.2 y 5.7 quedaron `skip`**: 5.2 (chip GPS sin permiso) porque
  el recon reveló que `pm revoke` de ubicación en caliente hace que Android
  backgroundee/mate la app (comportamiento del SO, no bug) y no se alcanzó a
  confirmar el texto/estado del chip inactivo antes de que la sesión se
  volviera inestable; 5.7 (auto-refresco ~45s) porque depende de un espacio
  "por vencer" real en los datos de dev (no garantizado) y no hay hoy un
  helper para leer color/estado visual más allá del texto.

- **`tests/test_6_mapa.py`** (6.1-6.12): **el que más recon consumió** (4
  intentos solo para tapping de marcador). Hallazgo estructural: todos los
  pines del mapa comparten el content-desc genérico "Marcador de mapa" (sin
  código ni estatus), y cargan de forma ASÍNCRONA (1 marcador a los ~2s, 11 a
  los ~3.5s) — ver `HomePage.MARCADOR_MAPA` / `contar_marcadores_mapa()` y el
  hallazgo nuevo en `HALLAZGOS.md`. Escritos y verificados: 6.5 (ocultar
  libres, chequeo de "no rompe nada" — no se pudo verificar el efecto real
  por la limitación de arriba), 6.6/6.7 (diálogo de Filtros mapeado:
  secciones "Estatus" y "Tipo de vehículo", backdrop "Sombreado" para
  cerrar), 6.9 (cambio Mapa↔Lista). 6.4 (búsqueda) escrito pero la última
  corrida coincidió con degradación del emulador (ver abajo) — selector y
  lógica son correctos, repetir corrida suelta si hace falta confirmar.
  **Bloqueados (7 de 12 casos)**: 6.1/6.2 (colores de pines/leyenda — no
  legibles por accesibilidad, necesitarían análisis de píxeles), 6.3/6.8
  (seleccionar pin — tocar un marcador no abrió el sidebar en ningún intento,
  ni con click ni con tap por coordenadas), 6.10 (no se encontró botón de
  centrar ubicación), 6.11 (depende de datos de prueba específicos), 6.12
  (combo cold start + sin red + caché, no abordado).

- **`tests/test_7_lista.py`** (7.1-7.9): **corrida 100% verde** (primera de
  la sesión), tras reiniciar el AVD en frío a mitad de sesión — ver
  "Inestabilidad del ambiente". Recon confirmó el formato real de cada fila
  (`"{Estatus}\n{Código}\n{Fecha}\n{Placa o '— sin —'}\n{Tiempo}\n{Distancia}"`),
  lo que permitió validar CONTENIDO real por filtro (no solo "no está
  vacío"): Libres → filas `"Libre..."` (confirmado con 9 filas reales),
  Urgencia → `"Tiempo Vencido..."` (confirmado con 2 filas reales); Por
  vencer/Vigentes no tenían datos en el recon, así que su test asume el
  mismo patrón sin confirmación real (documentado en el docstring de cada
  test). 7.5 (conteos coherentes) se reinterpretó como consistencia interna
  del badge del chip vs. filas reales (`HomePage.conteo_de_filtro()`) en vez
  de comparar contra el mapa (evita la limitación de conteo del módulo 6).
  7.8 confirmado: "CÓMO LLEGAR" desde un espacio vencido SÍ abre
  `com.google.android.apps.maps` (intent nativo real). Solo 7.9 (sin
  coordenadas) quedó `skip` por falta de dato de prueba. **Hallazgo de
  comportamiento** (no bug, pero importante para escribir tests): los chips
  de filtro son ACUMULATIVOS (multi-select), no exclusivos — activar dos a
  la vez muestra la unión, y volver a tocar el mismo chip para "desactivarlo"
  no siempre registra de forma confiable entre pasos separados por otras
  acciones (abrir un sidebar, cambiar de tab). Cada test de este archivo usa
  login fresco + un solo filtro para evitar arrastrar estado.

### Housekeeping ya resuelto esta sesión

- `tests/test_login.py` se fusionó en `test_smoke.py` como
  `test_S2_login_valido_inicia_y_cierra_turno` y el archivo original se borró
  (confirmado con Pedro antes de borrar).
- `.gitignore` de `Appium/` tenía un hueco: no cubría los dumps XML de recon
  (`reports/*.xml`) ni los volcados de logcat completo
  (`reports/monitor/*_logcat_completo.txt`) — solo `.png`/`.json`. Corregido.

### ⚠️ Inestabilidad del ambiente detectada esta sesión (no es un bug de la app)

Ya estaba parcialmente documentada en memoria del proyecto ("emulador
flaky"), pero esta sesión sumó hallazgos concretos:

1. **Login intermitentemente lento** (a veces >30s entre tocar "INICIAR
   TURNO" y que Home termine de cargar, otras veces ~2s, mismas
   credenciales/build). Mitigado subiendo timeouts de `esta_cargado()` de
   20s a 30s. Ver `HALLAZGOS.md`.
2. **Popup nativo de permiso de ubicación** puede aparecer pese a
   `autoGrantPermissions` (más seguido tras ciclos de `pm revoke`/`pm grant`/
   `pm clear` de recon) y tapar el login/Home, produciendo fallos que
   parecen timeouts pero son este popup bloqueando la interacción. Ya
   automatizado (`BasePage.manejar_popup_permiso_ubicacion()`, directiva de
   Pedro: "Mientras se usa la app"). Ver gotcha en `CLAUDE.md` sección 4.
3. **Corridas completas de la suite a veces cascadearon en errores** (`Can't
   find service: settings`, `socket hang up`, `Broken pipe`) cuando el
   `system_server` o el servidor UiAutomator2 del emulador se cayeron a
   mitad de una corrida larga — se recuperan solos, pero invalidan todos los
   tests posteriores de esa corrida puntual. Si ves esto, no es necesario
   re-investigar cada vez: confirmar con
   `adb shell settings get global auto_time` (si responde, el `system_server`
   ya se recuperó) y volver a correr.
4. **La degradación se ACUMULÓ a lo largo de la sesión — CONFIRMADO y
   RESUELTO**: las corridas de la tarde (módulos 5 y 6) mostraron cada vez
   más fallos por lentitud/cascada con el mismo AVD corriendo varias horas
   seguidas. Pedro reinició el AVD en frío a mitad de esta sesión (antes del
   módulo 7) y la corrida siguiente salió **100% verde** — primera del día.
   **Recomendación confirmada**: si el AVD ya lleva rato corriendo al
   arrancar una sesión nueva, reiniciarlo en frío ANTES de empezar es más
   barato que perseguir fallos fantasma a mitad de una corrida.
5. **Una sesión persiste incluso a un cold boot del AVD** (no solo a
   `force-stop`): un turno abierto sobrevivió el reinicio completo del
   emulador y aparecía con >6 horas de duración al reconectar. Solo
   `pm clear` o cerrar turno por UI limpia la sesión local de verdad — ver
   nota sobre S1 más abajo.

**Consecuencia práctica:** varios tests de esta sesión pasaron en corridas
aisladas pero no siempre en una corrida completa del archivo/módulo. El
código y los selectores están verificados como correctos (recon manual
confirmó cada mecanismo); lo que no siempre se logró fue una corrida 100%
verde de principio a fin en un solo intento, por la inestabilidad del
ambiente. **No perseguir esto reintentando en loop** — si un test fallido
muestra un timeout genérico sin selector roto, asumir ambiente y seguir.

## Selectores nuevos disponibles (acumulado de toda la sesión)

En `pages/home_page.py`:
```
FILTRO_URGENCIA / FILTRO_POR_VENCER / FILTRO_VIGENTES / FILTRO_LIBRES
fila_espacio(codigo) / abrir_espacio(codigo) / codigos_de_espacios_visibles()
CAMPO_PLACA_CHECKIN / BOTON_CHECKIN_ASISTIDO / BOTON_CONFIRMAR_CHECKIN / BOTON_CORREGIR_CHECKIN
hacer_checkin_asistido(placa)
BOTON_COMO_LLEGAR / BOTON_LEVANTAR_REPORTE / BOTON_LIBERAR_ESPACIO / BOTON_VER_HISTORIAL
DIALOGO_LIBERAR_CONFIRMAR / DIALOGO_LIBERAR_CANCELAR
liberar_espacio_actual(confirmar=True/False)
DURACION_TURNO  # content-desc real: " · Turno 00:00", matchear por contains("Turno")
```

En `pages/login_page.py`:
```
ERROR_CREDENCIAL_REQUERIDA / ERROR_PASSWORD_REQUERIDA / ERROR_EMAIL_INVALIDO
DIALOGO_RECUPERAR_TITULO / CAMPO_EMAIL_RECUPERAR / BOTON_CANCELAR_RECUPERAR / BOTON_ENVIAR_ENLACE
```

En `pages/base_page.py`:
```
manejar_popup_permiso_ubicacion()  # ver directiva de Pedro arriba
```

En `conftest.py`: fixture **`gps`** (fijar/alejar/restaurar posición,
restaura sola en el teardown) y **`sesion_limpia`** (garantiza arrancar
desde Login).

## Datos de referencia rápida

- Paquete: `com.example.estacionamientos_mobile` / `.MainActivity`
- Credenciales: `fernando@rym-solutions.com` / `RYM_solutions` (fixture
  `credenciales` en `conftest.py`)
- GPS base: lat `20.593103`, lon `-100.393097` (zona "Primer Cuadro",
  Querétaro) — `config.GPS_LAT_BASE` / `GPS_LON_BASE`
- Espacio de prueba usado en el recon de check-in: `CJ-1-0362AE` (9 m de la
  base) — pero **no hardcodear este código en los tests**, usar
  `codigos_de_espacios_visibles()` porque los datos de prueba rotan.
- Levantar Appium: `appium --port 4723` (ver `CLAUDE.md` sección 1 para el
  setup completo con `ANDROID_HOME`).
- Correr todo: `cd AppEstacionamientosColaboradores/Appium && pytest tests/ -v`
- Ver estabilidad histórica: `python reports/generar_resumen_estabilidad.py`
- Si un test deja la app en un estado raro (turno huérfano, diálogo
  abierto), `adb shell am force-stop com.example.estacionamientos_mobile`
  antes de la siguiente corrida limpia el estado local (no persiste sesión,
  confirmado en S1) — pero un turno ya abierto en el backend de dev queda
  huérfano hasta que se cierre a mano o expire solo.

## Pendiente de limpieza (housekeeping menor)

- Los `reports/*.png`/`*.xml`/`*_logcat_completo.txt` sueltos generados hoy
  son descartables una vez que el hallazgo/selector que documentan ya está
  en código (están gitignored desde ahora, no afectan el repo, pero
  ensucian la carpeta local).
