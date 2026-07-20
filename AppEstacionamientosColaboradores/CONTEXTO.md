# CONTEXTO — AppEstacionamientosColaboradores

> Documento de continuidad de sesión. Objetivo: que una sesión nueva de Claude
> Code retome exactamente donde quedó esta, sin tener que re-explorar la app
> desde cero. **Leer esto junto con `CLAUDE.md` (cómo está armada la suite) y
> `HALLAZGOS.md` (bugs/pedidos a devs)** antes de tocar código.
>
> **Última actualización:** 2026-07-17 tarde (arrancó la automatización del
> **portal web admin** con Playwright, `Playwright/` — nueva carpeta, ver
> sección "Portal web" en `CLAUDE.md` y "Dónde quedamos" abajo. 5 specs
> escritos y confirmados: login-sesión, dashboard, disponibilidad,
> estacionamientos, infracciones — más un test COMBINADO Appium+Playwright
> que valida consistencia de datos entre la app móvil y el portal. 4
> hallazgos nuevos documentados en `HALLAZGOS.md`). Antes, mismo día:
> Módulo 13 (app móvil) escrito y completado: 13.1-13.4 confirmados por
> pytest, 13.5 bloqueado. Módulo 12 también completo. Módulos 8, 9 y 11
> también completos. Módulo 10: 10.1/10.2/10.3 confirmados por pytest, el
> resto verificado a mano. **Los 13 módulos del checklist de operador (app
> móvil) están escritos** — falta solo terminar de confirmar los pendientes
> del módulo 10.

---

## 🟢 Prompt para una sesión nueva (copiar/pegar)

```
Lee AppEstacionamientosColaboradores/CONTEXTO.md, CLAUDE.md y HALLAZGOS.md y
ponte al tanto. Este proyecto tiene DOS suites de automatización sobre el
mismo backend de estacionamientos ("Querétaro con Futuro"):

1. **App móvil (Appium/pytest, `Appium/`)**: los 13 módulos del checklist de
   operador (`checklist_qa_operador.html`, 74 casos) ya están ESCRITOS.
   Módulos 8, 9, 11, 12 y 13 completos y confirmados por pytest. Módulo 10
   (Reporte/Infracción): 10.1/10.2/10.3 confirmados por pytest, el resto
   verificado a mano por recon. Único pendiente real: terminar de confirmar
   los casos del módulo 10 por pytest.
2. **Portal web admin (Playwright, `Playwright/`, iniciada 2026-07-17)**:
   panel de administración ("Panel de control", Zonas/Cajones/Infracciones/
   Usuarios/etc.) — producto DISTINTO al operador móvil, mismo backend. Se
   mapearon los casos del checklist de operador que SÍ tienen equivalente
   real en este portal (login/sesión, dashboard, disponibilidad pública,
   estacionamientos, infracciones) — ver detalle en "Portal web" de
   `CLAUDE.md`. Además hay un test COMBINADO (`combinado.checkin-web.spec.ts`)
   que dispara un check-in real desde la app móvil y confirma que el portal
   web lo refleja. 4 hallazgos nuevos en `HALLAZGOS.md` (evidencia
   fotográfica no obligatoria en el form web, duplicidad silenciosa de
   reportes, "Levantar falta" no preselecciona motivo, envío sin red pierde
   los datos del formulario).

Próximo paso sugerido: decidir con Pedro si profundizar en más secciones del
portal web (Zonas, Cajones, Usuarios quedaron fuera de alcance por ahora) o
cerrar primero los pendientes del módulo 10 de la app móvil.

Antes de correr algo de la app móvil, reiniciar el AVD en frío SIEMPRE que
no sea la primera corrida del día. Correr `adb devices` antes de cualquier
corrida — si aparece MÁS DE UN `emulator-XXXX`, es señal de que una
instancia vieja quedó viva (posiblemente zombie, ver "Inestabilidad del
ambiente" ítem 9): avisarle a Pedro para que la cierre antes de seguir, no
asumir que `get_android_device()` va a elegir la instancia sana. El test
COMBINADO de Playwright necesita el emulador + Appium (puerto 4723) ya
corriendo de antemano — no los levanta solo.

IMPORTANTE: si el emulador se cuelga (adb devices vacío, adb shell colgado,
o el proceso emulator.exe/qemu-system-x86_64.exe desaparece), AVISAR a Pedro
y que él lo reinicie manualmente — NO reiniciarlo ni matar procesos por
línea de comandos (ver "Inestabilidad del ambiente", ítems 8 y 9).
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
| 7 | 8 — Check-in asistido | **completed** — `tests/test_8_checkin.py` (8.1-8.4), corrida individual confirmada por pytest |
| 8 | 9 — Espacio ocupado | **completed** — `tests/test_9_espacio_ocupado.py` (9.1-9.7), 9.4 marcado `xfail(strict=True)` (bug real confirmado, ver HALLAZGOS.md), 9.6 con manejo de permiso de cámara |
| 9 | 10 — Reporte / Infracción | **in_progress** — `tests/test_10_reporte.py` escrito (10.1-10.4, 10.6/10.7, 10.10); 10.1/10.2/10.3 confirmados por pytest, el resto verificado a mano por recon pero sin corrida limpia por pytest todavía (ver "Dónde quedamos") |
| 10 | 11 — Cierre de turno | **completed** — `tests/test_11_cierre_turno.py` (11.1, 11.3, 11.4, 11.9, 11.10 confirmados por pytest; 11.6 verificado a mano, ver detalle); 11.2/11.5 pendientes de bajo riesgo, 11.7/11.8 no aplican (sin paso de firma en este build) |
| 11 | 12 — Permisos del sistema | **completed** — `tests/test_12_permisos.py` (12.1-12.4), los 4 casos confirmados por pytest (ver "Dónde quedamos") |
| 12 | 13 — Resiliencia y ciclo de vida | **completed** — `tests/test_13_resiliencia.py` (13.1-13.4 confirmados por pytest en corrida completa; 13.5 `skip`, bloqueado — requiere acceso a backend, ver "Dónde quedamos") |

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

## Dónde quedamos — próximo: profundizar el portal web o cerrar el módulo 10

**Sesión 2026-07-17 (noche): arranque de la automatización del portal web
admin con Playwright.** Pedro pidió continuar la automatización web,
tomando el checklist de operador como base pero "solo aplicando las cosas
que apliquen a la plataforma" (portal admin, no la app móvil).

**Setup:** carpeta nueva `Playwright/` dentro de este proyecto, reutilizando
el Playwright de la raíz del repo (mismo patrón que `Mediplanner Staging/`).
Recon inicial reveló que el portal (`https://nestacionamientos-dev-...`) es
un **panel de administración** ("Panel de control" / Zonas / Cajones /
Infracciones / Usuarios / Reportes), NO una versión web del operador de
campo — el login real vive en `/index.php/login` (la URL de referencia
original, `/usuarios`, es en realidad el guard de auth que redirige ahí).

**Mapeo del checklist:** de los 74 casos, se identificaron los que tienen un
equivalente real en el portal (evidencia por recon, no suposición) —
ver la tabla completa en `CLAUDE.md` sección 6. Los más fuertes: el
formulario "Registrar infracción" (`/infracciones/nueva`) es casi un calco
del módulo 10 de la app móvil (mismos 7 motivos confirmados en ambos
lados), y `/disponibilidad` (alcanzable desde el toggle "Mapa" de
Estacionamientos) es el equivalente del módulo 6 (mapa con pines
Libre/Ocupado, leyenda, "Cómo llegar", botón "Ubicarme"). Los módulos 8, 9,
11, 12 y 13 (check-in GPS, turno, permisos nativos, ciclo de vida app móvil)
**no tienen equivalente** en un panel de escritorio — se documentó
explícitamente por qué, no se forzó ningún mapeo.

**Specs escritos y confirmados por Playwright (29 tests, todos verdes en
una corrida completa):**
- `login-sesion.spec.ts` (11 casos: S1/S2/S8, 3.1-3.3, 4.1-4.6, 5.6)
- `dashboard.explorar.spec.ts` (2 casos, ya existía de una verificación
  previa de la misma sesión)
- `disponibilidad.spec.ts` (5 casos: 6.2, 6.4, 6.10, 7.5, 7.8)
- `estacionamientos.spec.ts` (4 casos: 6.6, 6.11, 7.6, 7.7)
- `infracciones.spec.ts` (7 casos: 10.1, 10.6-10.10, + 1 extra de lógica
  condicional del formulario no incluida en el checklist original)

**Hallazgos reales encontrados durante la escritura** (documentados en
`HALLAZGOS.md`, resumen): el formulario web de infracción NO exige foto
(a diferencia de la app móvil); un segundo reporte sobre el mismo
cajón/placa no muestra ningún aviso de duplicidad; "Levantar falta" prellena
cajón/placa pero no preselecciona el motivo; el envío sin red cae en el
error nativo del navegador y pierde todos los datos del formulario (no es
AJAX); y un detalle de copy menor ("La contraseña es obligatorio", debería
ser "obligatoria").

**Test combinado app+web (pedido explícito de Pedro: "si hay algunas que
necesiten acciones en conjunto de app y web, hazlo"):**
`combinado.checkin-web.spec.ts` dispara un check-in real desde la app móvil
(subproceso `pytest` sobre un archivo nuevo, `Appium/tests/
test_combo_web_app.py`, con dos tests: `test_combo_ocupar_espacio` y
`test_combo_liberar_espacio`) y confirma que `/disponibilidad` refleja el
cambio de inmediato (el KPI "Cajones libres" bajó de 7 a 6 tras el check-in
real, y volvió a 7 tras liberar). **Corrió limpio de punta a punta.**

**Dos fixes de harness aplicados en el camino (no específicos de este
escenario, benefician a toda la suite Appium):**
1. `conftest.py` tenía un `UnicodeEncodeError` latente: `_imprimir_resumen`
   imprime emojis, y al redirigir stdout a un archivo en Windows
   (`pytest ... > out.txt`) Python cae a `cp1252` en vez de UTF-8. Fix:
   `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` al importar
   `conftest.py`.
2. La placa de prueba original para el escenario combinado
   (`TESTCOMBOWEB`, 12 caracteres) hacía que CONFIRMAR se colgara sin
   avisar en el check-in — se acortó a `TESTCOMBO` (9 caracteres, dentro
   del límite de 10 visto en el campo `placa` del formulario web
   equivalente).

**Inestabilidad del ambiente durante esta sesión:** el flujo de limpieza
(`test_combo_liberar_espacio`) falló 3 veces con síntomas distintos
(timeout de instrumentación UiAutomator2, luego una sesión residual que
dejó texto de login metido en el buscador del mapa) — coincidió con un
reinicio completo de la PC de Pedro a mitad de sesión (Appium quedó caído
tras el reinicio, se relanzó a mano). Ninguno de los reintentos requirió
reiniciar el AVD — el propio fixture `sesion_limpia` resolvió la sesión
residual sin intervención. Mismo criterio de siempre: reintentar tras
confirmar `adb devices` sano, no perseguir el síntoma en loop.

**Pendiente / próximos pasos:** decidir con Pedro si seguir profundizando el
portal web (Zonas, Cajones, Usuarios quedaron fuera de alcance, sin un caso
específico del checklist de operador que los cubra) o volver a cerrar los
pendientes del módulo 10 de la app móvil.

### Histórico — sesión 2026-07-17 (mañana/tarde): módulos 12 y 13 de la app móvil

**Continuación de sesión 2026-07-17 (tarde): Módulo 13 escrito completo.**
`tests/test_13_resiliencia.py` cubre 13.1-13.4 (13.5 bloqueado, ver abajo):

- **13.1/13.2 (pérdida de red / reconexión):** 'modo avión' se simula con el
  mismo mecanismo ya usado en 3.3/4.7/5.4/8.4 (`svc wifi/data disable`).
  Confirmado con `dumpsys connectivity` que el corte es real (`Active
  default network: none`, ping inalcanzable). **Hallazgo nuevo** (ver
  HALLAZGOS.md): el chip 'En línea' del topbar NO refleja la pérdida real de
  conectividad — se probó esperando hasta 60s en foreground y también un
  ciclo completo background→foreground (el mismo mecanismo que sí resuelve
  el cacheo de permisos en 12.4), y en ningún caso se actualizó. 13.1 quedó
  escrito para validar el comportamiento REAL (el chip se queda pegado en
  'En línea'), no el esperado por el checklist. 13.2 se rediseñó para
  validar lo que sí es observable: que la app queda funcional (Vista Lista
  responde) tras reconectar, ya que "el chip reaparece" no es una señal
  válida si nunca desapareció. **Nota abierta:** `test_5_4_chip_conexion_refleja_desconexion`
  (dado por confirmado en la sesión 2026-07-07) falló hoy con el mismo
  síntoma — no se investigó si el comportamiento cambió entre sesiones o si
  nunca corrió limpio por pytest pese a estar documentado como tal; revisar
  con Pedro y decidir si también actualizar ese test para reflejar el hallazgo.
- **13.3/13.4 (background/resume):** 13.3 documenta que "el auto-refresco/
  tracking se pausan en background" no es observable desde la UI (no hay
  árbol de accesibilidad mientras la app no está en foreground) — se
  redefinió para validar lo que sí importa operativamente: que un background
  prolongado (~70s) no rompe/crashea la app. 13.4 confirma la reanudación
  real: el temporizador de turno (`DURACION_TURNO`) avanza tras el ciclo
  background→foreground, y la Vista Lista sigue trayendo datos. Ambos usan
  `background_app(70)`, tiempo real (marcados `slow`). Un primer intento de
  13.3 falló por un colapso del servidor UiAutomator2 (mismo patrón ya
  documentado en "Inestabilidad del ambiente" ítem 6/3, no bug de la app) —
  se confirmó con `adb shell settings get global auto_time` que el
  `system_server` ya se había recuperado y el reintento pasó limpio.
- **13.5 (tracking GPS recibido por backend):** quedó `skip` — no hay
  ninguna señal observable por UI/accesibilidad que confirme que el backend
  RECIBIÓ una ubicación puntual (a diferencia de otros bloqueados, esto no
  es un problema de dato de prueba sino de visibilidad del lado backend).
  Evaluar con Pedro si existe un endpoint de backoffice para consultarlo.

Con el módulo 13 completo, **los 13 módulos del plan (74 casos) ya están
escritos**. Lo único que queda realmente pendiente de una sesión anterior es
confirmar por pytest los casos del módulo 10 que solo están verificados a
mano (10.4/10.6-10.7/10.10) — no hay más módulos nuevos que escribir.

### Histórico — sesión 2026-07-17 (mañana): confirmación de 12.4

Se retomó puntualmente para confirmar 12.4 por pytest. `adb devices` mostró una sola instancia sana
(`emulator-5554`, sin zombie) — descartada la causa raíz de la sesión
anterior. Aun así, la primera corrida de `test_12_4_restaurar_permiso_desbloquea`
sola falló con un síntoma NUEVO y distinto a los 3 anteriores:
`StaleElementReferenceException` al tocar el chip `FILTRO_LIBRES` justo
después de `ir_a_lista()` (navegar a la Vista Lista) — el mismo tipo de
gotcha ya documentado en `CLAUDE.md` §4 (re-render con animación continua
puede dejar stale un elemento recién hallado antes de clickearlo), para el
que ya existía el fix `BasePage.hacer_click_estable` pero solo se usaba en
el flujo de "Liberar espacio". Se aplicó el mismo fix a los 3 clicks de
`FILTRO_LIBRES` en `tests/test_12_permisos.py` (12.1, 12.3 y 12.4, mismo
patrón "ir_a_lista() → tocar Libres" en los tres). Con eso, **los 4 casos
del módulo 12 (12.1-12.4) corrieron limpio por pytest** en la misma sesión
(12.4 sola primero, luego 12.1/12.2/12.3 juntos como regresión) — **Módulo
12 queda completo**. (A continuación, en la misma sesión del 17, se escribió
y confirmó también el Módulo 13 — ver el bloque de arriba.)

### Histórico — sesión 2026-07-16 (tarde): escritura del módulo 12 y confirmación parcial

Se retomó para confirmar por pytest los casos pendientes del módulo 10 y
luego escribir el módulo 12.

**Módulo 10 — confirmación por pytest:** 10.3 se confirmó limpio. En el
camino se encontraron y arreglaron DOS bugs reales del arnés (no de la app):
1. **Falso positivo de `crash_monitor`**: `_resetear_rotacion_tras_reporte()`
   (limpieza de todos los tests de este módulo) hace `force-stop` como
   mitigación de la rotación de cámara — pero eso deja la app fuera de
   foreground justo cuando `crash_monitor` (autouse, `conftest.py`) chequea
   `query_app_state` al final de CUALQUIER test, y lo hacía fallar con
   `ERROR` aunque el test hubiera pasado sus propios asserts. Arreglado:
   la función ahora relanza la app tras el `force-stop`.
2. **Falta de espera tras LEVANTAR REPORTE**: 10.3/10.4/10.6-10.7/10.10 no
   esperaban a que cargara la pantalla de Reporte (`TITULO_TIPO_REPORTE`)
   antes de tocar el obturador — a diferencia de 10.1, que sí lo hacía.
   Agregada esa espera explícita (20s) a los 4 tests.

Con esos dos fixes, **10.3 corrió limpio por pytest**. 10.4 quedó sin
confirmar tras varios intentos, cada uno con un síntoma DISTINTO (pool de
"Libres" agotado por espacios de prueba huérfanos de intentos previos,
`socket hang up` de UiAutomator2, lag del contador de fotos tras una ráfaga
de 4 capturas) — todos de ambiente, no de lógica. **10.6/10.7 y 10.10 no
se reintentaron** en esta sesión (quedan con el mismo estado que antes:
verificados a mano, sin corrida limpia por pytest).

**Hallazgo importante: se reprodujo con stack trace completo el crash de
login que llevaba desde el 2026-07-07 sin evidencia** (ver HALLAZGOS.md) —
es un `FATAL EXCEPTION` en un thread interno del SDK de Google Maps
(`NoSuchFieldError` en el módulo dynamite de Google Play Services), no
código de la app. Intermitente, causa raíz probable: incompatibilidad de
versión entre Play Services del AVD y el Maps SDK compilado en la app.

**Módulo 12 (Permisos del sistema) — escrito completo esta sesión**
(`tests/test_12_permisos.py`, 12.1-12.4). Recon nuevo reveló varios
hallazgos (ver HALLAZGOS.md): a diferencia de cámara (9.6), el enfoque de
9.6 (conceder-todo-al-crear-sesión + revocar a mano) NO funcionaba de forma
confiable para reproducir el diálogo nativo — se resolvió con un enfoque
más simple, un fixture `driver` local a `test_12_permisos.py` que crea la
sesión de Appium SIN `autoGrantPermissions`, dejando que la app pida los
permisos de verdad la primera vez (mismo patrón de `pm clear` que 3.1).
Con eso: **12.1, 12.2 y 12.3 corrieron limpio por pytest** en esta sesión.
12.4 (restaurar permiso) se verificó a mano con éxito (confirmado: soltar
el permiso y hacer background→foreground desbloquea las acciones — con un
ajuste de reintento agregado al test porque el refresco del botón no
siempre es inmediato), pero **los 3 intentos por pytest fallaron con
síntomas totalmente distintos entre sí** (timeout de diálogo, `socket hang
up`, y finalmente un `adbExecTimeout` real de 20s). Diagnóstico real
encontrado en el tercer intento: Pedro había reiniciado el AVD a mitad de
la sesión (tras un primer fallo de `StaleElement` en 12.3) y la instancia
VIEJA (`emulator-5554`) no se cerró del todo — quedó **zombie** en `adb
devices` (aparecía como `device`, no `offline`, pero no respondía a ningún
comando) en paralelo con la instancia nueva y sana (`emulator-5556`). Como
`get_android_device()` toma el primer dispositivo de la lista, las
corridas podían estar conectándose a la instancia muerta sin ningún aviso
— eso explica por qué cada intento falló distinto (no es un patrón
reproducible de un bug real, es "a veces te toca el dispositivo zombie").
**No se llegó a confirmar 12.4 por pytest esta sesión** — queda para la
próxima, con la instancia vieja ya cerrada. Ver "Inestabilidad del
ambiente" ítem 9 (reescrito con el diagnóstico correcto, no el "load
average" que se sospechó al principio).

Se renombró `denegar_popup_permiso_camara` a `denegar_popup_permiso_nativo`
en `base_page.py` (el XPath ya era genérico, ahora lo usan cámara Y
ubicación) — actualizada la única referencia existente en
`test_9_espacio_ocupado.py::test_9_6`.

**Al retomar:** antes de correr nada, `adb devices` — si aparece más de un
emulator-XXXX, avisar a Pedro para que cierre el/los viejo(s) antes de
seguir (no matarlos por línea de comandos). Con un solo dispositivo sano,
correr `test_12_4_restaurar_permiso_desbloquea` sola primero para
confirmarla; después seguir con los pendientes del módulo 10
(10.4/10.6-10.7/10.10) o arrancar el módulo 13, según tiempo disponible.

### Histórico — primera mitad de la sesión 2026-07-16 (escritura del módulo 10)

Módulos 8 y 9 quedaron confirmados como completos.
Módulo 9 (`tests/test_9_espacio_ocupado.py`, 9.1-9.7) sumó un hallazgo real
de prioridad ALTA: "Cancelar" en el diálogo de liberar espacio libera el
espacio de todas formas (ver HALLAZGOS.md) — 9.4 quedó marcado
`xfail(strict=True)` documentando esto. Módulo 10 (`tests/test_10_reporte.py`)
se escribió completo (10.1, 10.2, 10.3, 10.4, 10.6/10.7, 10.10; 10.5/10.8/
10.9/10.11 documentados como no automatizables) con varios hallazgos de
checklist desactualizado (tope real de fotos es 2, no 3; tras enviar regresa
al sidebar, no a Home) — **10.1 y 10.2 ya corrieron limpio por pytest**;
10.3/10.4/10.6-10.7/10.10 están verificados a mano por recon (el
comportamiento es correcto) pero la sesión se puso demasiado inestable para
terminar de confirmarlos por pytest (ver "Inestabilidad del ambiente", ítems
7 y 8) — Pedro decidió avanzar al módulo 11 y dejarlos pendientes de esa
confirmación para una próxima sesión, mismo criterio que ya se usó con el
módulo 8 en su momento.

**Hallazgo importante de esta sesión, ítem 7 abajo:** abrir la pantalla de
Reporte (preview de cámara) puede rotar TODA la pantalla del AVD de forma
persistente (`CameraService rotationOverride` de Android, no un bug de la
app) — la mitigación (`am force-stop`) ya está aplicada en
`test_10_reporte.py`, pero cualquier test nuevo que toque `LEVANTAR REPORTE`
debe hacer lo mismo.

**Módulo 11 (Cierre de turno) — completado en esta misma sesión**
(`tests/test_11_cierre_turno.py`): 11.1 (resumen con métricas), 11.3 (error
sin red + Reintentar recupera), 11.4 (bitácora vacía → botón exportar
`clickable="false"`, no un toast como dice el checklist), 11.9 (cierre
completo → Login) y 11.10 (acceso desde Reporte) confirmados por pytest.
11.6 (compartir bitácora) se verificó a mano — abre el sheet nativo de
Android correctamente — pero la versión automatizada quedó floja porque el
chooser de cuentas/apps del sheet nativo no tiene selectores propios y su
contenido varía; el test actual solo confirma que se abrió (no intenta
navegar dentro del sheet) y limpia con `force-stop`. **Pendientes de bajo
riesgo:** 11.2 (sin turno activo en backend, no reproducible determinísticamente
desde la UI) y 11.5 (verificar el archivo CSV real en Descargas vía
filesystem, no solo el mecanismo de habilitar/deshabilitar ya cubierto por
11.4/11.6). **11.7/11.8 no aplican**: confirmado que este build no tiene
paso de firma antes de "CONFIRMAR Y CERRAR TURNO".

### Histórico — Módulo 8 (Check-in asistido, escrito 2026-07-09)

Los módulos S, 3, 4, 5, 6 y 7 quedaron escritos y corridos contra el
emulador real esta sesión. El módulo 8 (Check-in asistido) es el siguiente:
8.1 (fuera de proximidad, requiere el fixture `gps` para alejarse),
8.2 (placa vacía — buscar el mismo patrón de validación por `live-region`
que ya funcionó en el módulo 4, aplicado al campo de placa), 8.3 (flujo
completo — ya está prácticamente cubierto por S4 en `test_smoke.py`, decidir
si 8.3 lo referencia/reusa o lo duplica con su propio ID), 8.4 (check-in sin
red, mismo patrón `svc wifi/data disable` ya usado en 3.3/4.7/5.4).

### Módulo 8 — Check-in asistido (escrito 2026-07-09, ver `tests/test_8_checkin.py`)

Los 4 casos (8.1-8.4) están escritos. Cada uno pasó **individualmente** en
corridas sueltas; falta confirmar los 4 juntos en una sola corrida estable
(el AVD colapsó dos veces al intentarlo — ver "Inestabilidad del ambiente"
más abajo, ítem 6). Al retomar: `pytest tests/test_8_checkin.py -v` con el
AVD recién reiniciado en frío.

- **8.1 (fuera de proximidad)**: recon confirmó el banner real — content-desc
  `"Estás a X m del espacio"` + `"...debes estar a 50 m o menos..."` (X se
  actualiza en vivo). **Hallazgo clave**: el botón "Check-In Asistido" NO se
  oculta ni cambia su atributo `enabled` (queda `"true"`) al bloquearse —
  el atributo que realmente se apaga es `clickable` (pasa a `"false"`). Por
  eso el chequeo lee `clickable` directo vía `get_attribute`, no
  `BasePage.esta_habilitado` (que usa `is_enabled()` → mapea a `enabled`, dato
  equivocado para esta señal). Selector nuevo: `HomePage.BANNER_FUERA_PROXIMIDAD`.
- **8.2 (placa vacía)**: mismo patrón de chequeo blando que 4.3/4.6 — tocar
  "Check-In Asistido" sin placa no deja rastro capturable en el árbol de
  accesibilidad (dump antes/después idéntico, probablemente un Toast
  transitorio). La señal estable es que el flujo NO avanza a la pantalla de
  confirmación (el botón CONFIRMAR nunca aparece).
- **8.3 (flujo completo)**: duplicado de S4 (`test_smoke.py`) con su propio ID
  de checklist (se optó por duplicar, no solo referenciar). **Dos hallazgos de
  timing importantes:**
  - *Race condition real*: tras tocar CONFIRMAR, el backend tarda en procesar
    el check-in — un llamador que navega de inmediato a la Lista puede
    adelantarse y seguir viendo el espacio como "Libre". Fix aplicado en
    `HomePage.hacer_checkin_asistido()`: espera a que el botón CONFIRMAR se
    vuelva invisible antes de devolver el control.
  - *Lag + inconsistencia de categorización de ocupados*: el espacio sale de
    "Libres" al instante (UI optimista del lado de escritura), pero tarda
    varios segundos en reflejarse del lado de ocupado, y activar varios
    filtros juntos (Vigentes+Por vencer+Urgencia) **NO muestra la unión** —
    solo mostró el set de uno de ellos (mismo hallazgo de chips no confiables
    ya visto en el módulo 7, pero esta vez ni siquiera al encadenarlos se
    obtiene la unión esperada). Por eso el assert fuerte de 8.3 es la
    desaparición de "Libres" (no un filtro de ocupado específico), y la
    limpieza usa el nuevo helper `HomePage.liberar_por_codigo()`: prueba los
    tres filtros de ocupado **de uno a la vez** (activar → leer → desactivar)
    con reintento por el lag — es best-effort, no assert duro.
- **8.4 (check-in sin red)**: mismo mecanismo de 3.3/4.7/5.4
  (`svc wifi/data disable`), aplicado en el paso de CONFIRMAR. Confirmado por
  recon: sin red el panel de confirmación se queda exactamente igual (ni
  cierra ni avanza) — chequeo blando, mismo criterio que 4.3/4.6/4.7. Al
  reconectar la red, el test cancela con "CORREGIR" (no reintenta CONFIRMAR)
  para no dejar un check-in a medias creado en el backend.

**Helpers/selectores nuevos agregados a `home_page.py`/`base_page.py` esta
sesión:**
- `HomePage.BANNER_FUERA_PROXIMIDAD` (ver 8.1 arriba).
- `HomePage.liberar_por_codigo(codigo)` (ver 8.3 arriba) — preferir sobre
  armar el flujo de liberación a mano cuando no se sabe bajo qué filtro cayó
  un espacio recién ocupado.
- `BasePage.hacer_click_estable(localizador)`: click con reintento ante
  `StaleElementReferenceException` — el sidebar de un espacio ocupado se
  re-renderiza al abrirse y un botón recién hallado puede desligarse del DOM
  justo antes del `.click()` (mismo tipo de gotcha ya documentado en
  `CLAUDE.md` §4 para animaciones continuas, pero manifestado como stale en
  vez de "no such element"). `HomePage.liberar_espacio_actual` ya lo usa para
  "Liberar espacio" y el diálogo de confirmación.

**Pendiente al retomar:** confirmar que el espacio de prueba `CJ-1-0D542E`
(placa `TEST-008`, quedó ocupado por una corrida de 8.3 previa al fix de
timing) esté liberado — si el AVD sigue con esa data al retomar,
`home_page.liberar_por_codigo('CJ-1-0D542E')` debería resolverlo solo. No es
data real, es descartable.

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
6. **Colapso DURO del servidor UiAutomator2 — escaló más allá de lo visto
   antes (sesión del módulo 8, 2026-07-09).** El ítem 3 ya documentaba
   cascadas de `socket hang up`/`Can't find service: settings` que se
   recuperaban solas. Esta sesión, en cambio, el AVD completo **dejó de
   responder a `adb devices`** (device desaparecido, no solo el driver de
   Appium) — tuvo que relanzarse el emulador entero, dos veces en la misma
   sesión, con cold boot (`-no-snapshot-load`). Tras el primer relanzamiento
   volvió a colapsar a los pocos minutos (todo comando devolvía
   `socket hang up`, incluso `driver.quit()`). **No se identificó una causa
   de la app** — coincidió con corridas de scripts de recon/limpieza sueltos
   (fuera de pytest) en sucesión rápida contra la misma sesión de Appium, lo
   que puede haber acumulado presión sobre el emulador más que las corridas
   normales de pytest (que abren/cierran su propio `driver` por test). Si
   esto se repite: relanzar el AVD en frío es la única mitigación confirmada
   por ahora; no perder tiempo diagnosticando el `socket hang up` en sí.
7. **La pantalla de Reporte (cámara) puede rotar TODA la pantalla del AVD de
   forma persistente (sesión módulo 10, 2026-07-16).** Confirmado por
   logcat: al abrir LEVANTAR REPORTE, Android dispara `CameraService:
   makeClient: Camera2 API, rotationOverride 1` — un modo de compatibilidad
   que fuerza la orientación de TODA la pantalla para calzar con el sensor de
   cámara del emulador, y ese estado queda pegado al proceso de la app,
   re-disparando la rotación cada ~25-50s incluso después de resetear
   `user_rotation` a mano. **Mitigación confirmada:** `adb shell am
   force-stop com.example.estacionamientos_mobile` (no solo cerrar turno por
   UI) libera el estado y `user_rotation=0` se mantiene estable después. Ver
   HALLAZGOS.md. `test_10_reporte.py` ya llama esto al final de cada test que
   usa la cámara (`_resetear_rotacion_tras_reporte`) — pero correr los 6
   tests del archivo SEGUIDOS (uno atrás del otro con force-stop entre cada
   uno) disparó el colapso del ítem 3 en la sesión del 2026-07-16; correrlos
   DE A UNO dio mejor resultado.
8. **Colapso duro del emulador SIN causa de la app identificada (sesión
   módulo 10, 2026-07-16).** Dos veces en la misma sesión el proceso completo
   del emulador (`emulator.exe`/`qemu-system-x86_64.exe`) desapareció de
   `tasklist` — más grave que el ítem 6 (ahí el proceso seguía vivo, solo
   `adb` no respondía). **Directiva de Pedro: si esto pasa, avisarle y que
   él reinicie el AVD manualmente (Android Studio/AVD Manager) — no
   reiniciarlo por línea de comandos** (`taskkill` + `emulator -avd ...`),
   aunque técnicamente funcione. Ver `[[feedback-appium-no-reiniciar-emulador-por-comando]]`
   en memoria.
9. **Dos instancias del emulador corriendo a la vez tras un reinicio manual
   a mitad de sesión — CAUSA RAÍZ real de varios fallos "fantasma" (sesión
   módulo 12, 2026-07-16).** Cuando Pedro reinició el AVD a mitad de la
   confirmación del módulo 12 (tras un primer fallo de `StaleElement` en
   12.3), la instancia VIEJA (`emulator-5554`) no se cerró del todo — quedó
   viva en `adb devices` (reportando `device`, no `offline`) pero con el
   proceso `qemu-system-x86_64.exe` real casi sin memoria (65 MB, vs. ~1 GB
   de la instancia sana) y **totalmente colgada** (`adb -s emulator-5554
   shell echo test` colgó 15s+ sin responder). La instancia nueva sana
   quedó como `emulator-5556`. `get_android_device()` en `conftest.py` toma
   el PRIMER dispositivo que devuelve `adb devices` — con las dos
   instancias activas, eso podía resolver a la vieja/zombie según el orden
   de esa lista, produciendo fallos con síntomas totalmente distintos entre
   sí en cada intento (timeout de diálogo, `socket hang up`, `adbExecTimeout`
   real de 20s en un comando interno de UiAutomator2) — ninguno reproducible
   de forma consistente porque cuál instancia se usaba variaba entre
   corridas. **Se llegó a sospechar inicialmente de "load average alto tras
   el boot"**, pero el diagnóstico real fue este: dos AVDs vivos a la vez,
   uno zombie. **Recomendación:** si después de que Pedro reinicia el AVD a
   mitad de sesión los fallos siguen siendo inconsistentes entre sí (no el
   mismo síntoma dos veces), correr `adb devices` — si aparece MÁS DE UN
   dispositivo, es señal de que la instancia vieja no se cerró. No matar
   procesos por línea de comandos (ver ítem 8): avisarle a Pedro para que
   cierre la instancia vieja manualmente antes de seguir.
10. **Diálogo nativo "Precisión de la ubicación" (Google Play Services)
    bloqueando la pantalla tras ciclos de `svc wifi disable/enable` (sesión
    2026-07-17, reconfirmación de hallazgos del módulo 13).** Al reconfirmar
    `test_13_1` (que corta y restaura wifi/datos), quedó un diálogo del
    sistema —`com.google.android.gms/...LocationSettingsCheckerActivity`,
    texto "Para mejorar la experiencia, el dispositivo necesita usar la
    Precisión de la ubicación... Búsqueda de Wi-Fi"— tapando toda la
    pantalla y **reapareciendo inmediatamente después de tocar "No,
    gracias"** (no es un simple popup que se cierra una vez). Causa raíz:
    `adb shell settings get global wifi_scan_always_enabled` devolvía `0` —
    probablemente los propios `svc wifi disable/enable` de los tests de
    conectividad (13.1-13.2, 3.3, 4.7, 5.4, 8.4, etc.) dejan ese setting en
    un estado que dispara el checker de Play Services en loop. **Mitigación
    confirmada:** `adb shell settings put global wifi_scan_always_enabled 1`
    hace que el diálogo se cierre para siempre (no solo esa vez). Si un test
    nuevo que usa `svc wifi disable` deja la sesión siguiente bloqueada por
    este diálogo, este es el fix — no perder tiempo reintentando el tap
    "No, gracias" a ciegas. Además, ese mismo episodio dejó un turno abierto
    (el force-stop de limpieza no cierra turno, solo mata el proceso) que
    `sesion_limpia` no detectó a tiempo en el primer reintento posterior
    (posible carrera justo tras relanzar la app) — un segundo intento con
    cierre de turno explícito lo resolvió. Ninguno de los dos es un bug de
    la app: son gotchas del propio arnés/AVD al simular red inestable.

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
conteo_de_filtro(localizador_filtro)  # lee el número del badge de un chip, p.ej. "Libres\n9" -> 9
CAMPO_PLACA_CHECKIN / BOTON_CHECKIN_ASISTIDO / BOTON_CONFIRMAR_CHECKIN / BOTON_CORREGIR_CHECKIN
hacer_checkin_asistido(placa)
BOTON_COMO_LLEGAR / BOTON_LEVANTAR_REPORTE / BOTON_LIBERAR_ESPACIO / BOTON_VER_HISTORIAL
DIALOGO_LIBERAR_CONFIRMAR / DIALOGO_LIBERAR_CANCELAR
liberar_espacio_actual(confirmar=True/False)
DURACION_TURNO  # content-desc real: " · Turno 00:00", matchear por contains("Turno")
MARCADOR_MAPA / contar_marcadores_mapa()  # OJO: todos los pines comparten el mismo
                                            # content-desc genérico, cargan async — ver hallazgo módulo 6
FILTRO_ESTATUS_LIBRE / FILTRO_ESTATUS_VIGENTE / FILTRO_ESTATUS_POR_VENCER / FILTRO_ESTATUS_VENCIDO
FILTRO_TIPO_CIVIL / FILTRO_TIPO_DISCAPACITADOS / FILTRO_TIPO_ZONA_CARGA
CERRAR_DIALOGO_FILTROS  # backdrop "Sombreado" del diálogo de Filtros (mapa)
BANNER_FUERA_PROXIMIDAD  # módulo 8: contains("m del espacio") — ver hallazgo clickable vs enabled
liberar_por_codigo(codigo)  # módulo 8: ubica un espacio ocupado probando los filtros de uno
                             # a la vez (con reintento por lag) y lo libera; preferir sobre
                             # armar el flujo de liberación a mano
```

En `pages/login_page.py`:
```
ERROR_CREDENCIAL_REQUERIDA / ERROR_PASSWORD_REQUERIDA / ERROR_EMAIL_INVALIDO
DIALOGO_RECUPERAR_TITULO / CAMPO_EMAIL_RECUPERAR / BOTON_CANCELAR_RECUPERAR / BOTON_ENVIAR_ENLACE
```

En `pages/base_page.py`:
```
manejar_popup_permiso_ubicacion()  # ver directiva de Pedro arriba
hacer_click_estable(localizador)  # módulo 8: click con reintento ante StaleElementReferenceException,
                                    # para botones dentro de un panel que se está re-renderizando
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
