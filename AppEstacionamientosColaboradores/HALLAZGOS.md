# Hallazgos — AppEstacionamientosColaboradores

> Mismo formato que la sección "Hallazgo de QA" de `CONTEXTO.md` en la raíz
> del repo: cosas para reportar a devs, con estado de si ya se reportó.

---

## 🐛 Portal web — el formulario "Registrar infracción" no exige evidencia fotográfica (a diferencia de la app móvil)

**Estado: confirmado por Playwright (2026-07-17) — prioridad media (inconsistencia entre plataformas).**

En la app móvil, el módulo 10 (Reporte) exige mínimo 1 foto para habilitar
"ENVIAR REPORTE AL BACKOFFICE" (10.2/10.3). En el portal web
(`/index.php/infracciones/nueva`), el campo `input[name="evidencia"]`
**no tiene el atributo `required`** — confirmado que el formulario se envía
y registra la infracción con éxito ("Infracción registrada.") sin adjuntar
ninguna foto. Un supervisor puede levantar una falta desde escritorio sin
ninguna evidencia visual, mientras que el operador de campo sí está
obligado a documentarla. Ver `Playwright/tests/infracciones.spec.ts::
"10.6: envío exitoso sin evidencia fotográfica..."`.

## 🐛 Portal web — un segundo reporte sobre el mismo cajón/placa no muestra ningún aviso (posible duplicidad silenciosa)

**Estado: confirmado por Playwright (2026-07-17) — prioridad media.**

El checklist original (10.7, ya validado también en la app móvil) espera un
"aviso de reporte previo en la ocupación" al reportar dos veces el mismo
cajón/placa. En el portal web, registrar la MISMA placa en el MISMO cajón
dos veces seguidas no muestra ningún aviso — ambos envíos responden
"Infracción registrada." y crean dos filas separadas en la tabla de
Infracciones. Riesgo operativo: un supervisor puede duplicar
involuntariamente una falta ya registrada por otro supervisor (o por sí
mismo) sin ninguna señal de advertencia. Ver `infracciones.spec.ts::
"10.7: ... NO muestra aviso de reporte previo"`.

## 🤔 Portal web — "Levantar falta" prellena cajón/placa pero no preselecciona el motivo

**Estado: confirmado por Playwright (2026-07-17) — prioridad baja (gap de UX, no bloquea nada).**

Al tocar "Levantar falta" desde la lista de "Vehículos fuera de tiempo" en
Infracciones, el formulario llega con `cajon_id` y `placa` prellenados vía
query params, pero el `<select name="motivo">` se queda en "— Selecciona —"
en vez de preseleccionar "Fuera de tiempo" (que sería lo esperable dado el
contexto de origen — mismo criterio que 10.8/10.9 de la app móvil). No
bloquea el flujo (el supervisor solo tiene que elegirlo a mano), pero es una
oportunidad de UX perdida. Ver `infracciones.spec.ts::"10.8/10.9"`.

## 🐛 Portal web — envío del formulario de infracción sin red pierde todos los datos (peor manejo que la app móvil)

**Estado: confirmado por Playwright (2026-07-17) — prioridad media-alta (pérdida de trabajo del usuario).**

El formulario "Registrar infracción" es un `<form method="post" ...>` HTML
clásico (no AJAX/fetch). Al enviarlo sin conectividad, el navegador intenta
la navegación completa y cae en su propia página de error
(`chrome-error://chromewebdata/`), perdiendo TODOS los datos ya capturados
(cajón, placa, motivo, evidencia). La app móvil, en el mismo escenario
(10.10), maneja el error con un mensaje y conserva el formulario intacto.
Un supervisor con conectividad inestable puede perder una infracción ya
casi lista de tener que rellenarla de cero. **Sugerencia:** convertir el
envío a `fetch`/AJAX con manejo de error explícito, o al menos guardar el
estado del formulario en el navegador antes de enviarlo. Ver
`infracciones.spec.ts::"10.10"`.

## 🤔 Portal web — mensaje de validación "La contraseña es obligatorio." (inconsistencia de género gramatical)

**Estado: confirmado por Playwright (2026-07-17) — prioridad muy baja (copy).**

Al enviar el login sin contraseña, el mensaje real dice "La contraseña es
**obligatorio**." en vez de "obligatoria" (concordancia de género). Cosmético,
no bloquea nada. Ver `login-sesion.spec.ts::"4.2"`.

## ✅ Confirmado: un check-in real desde la app móvil se refleja correctamente en el portal web

**Estado: verificado por un test combinado Appium+Playwright (2026-07-17) —
no es un bug, es una confirmación positiva de consistencia entre plataformas.**

`Playwright/tests/combinado.checkin-web.spec.ts` dispara un check-in real
desde la app móvil (vía subproceso `pytest` sobre
`Appium/tests/test_combo_web_app.py`) y confirma que el KPI "Cajones libres
(vía pública)" de `/index.php/disponibilidad` baja exactamente en 1 de
inmediato — ambas plataformas comparten el mismo backend/zona ("Primer
Cuadro") sin lag observable. Vale la pena repetir este patrón (acción real
en una plataforma → verificación en la otra) para futuros escenarios
cruzados.

---

## 🔧 Pedido a devs: identificadores estables en los widgets de la app (Flutter)

**Estado: pendiente de reportar.**

La app (`com.example.estacionamientos_mobile`) es Flutter, y sus widgets
interactivos (campos de texto, botones) **no exponen `resource-id` ni
`content-desc` propio** en el árbol de accesibilidad — solo `android.view.View`
genéricos. Appium/UiAutomator2 solo puede ubicarlos por estructura: el label
hermano que los precede (`//View[@content-desc="Contraseña"]/following-sibling::EditText`)
o por posición/índice entre los `EditText` de la pantalla.

**Por qué importa:** esta es exactamente la fragilidad que las guías de
automatización móvil marcan como la causa #1 de tests inestables ("usar
accessibility IDs o resource IDs, no XPath posicional"). Un cambio de layout
menor — reordenar un campo, agregar uno nuevo antes de otro — puede romper
selectores que hoy funcionan, sin que sea un bug real de la app.

**Pedido concreto:** envolver los widgets interactivos clave (campos de login,
botones de acción como "INICIAR TURNO"/"Cerrar turno") en un
`Semantics(label: "...", child: ...)` con un label único y estable, o
asignarles una `Key` explícita. Cualquiera de las dos opciones aparece en el
árbol de UiAutomator2 como `content-desc` o `resource-id` respectivamente, y
elimina la necesidad de selectores estructurales.

**Mitigación aplicada mientras tanto:** `BasePage.ingresar_texto_con_fallback`
prueba el selector por label hermano y, si falla, cae a un selector por
índice de posición — no es tan robusto como un id estable, pero reduce el
punto único de falla (ver `pages/login_page.py`).

---

## 🐛 Crash real de la app durante login — causa raíz confirmada (Google Maps SDK)

**Estado: confirmado con stack trace completo (2026-07-16) — pendiente de
reportar. Prioridad media/alta: mata el proceso completo de la app.**

Durante el recon inicial (2026-07-07, ~12:12) la app ya se había cerrado sola
en medio de un flujo de login normal, pero el buffer de logcat rotó antes de
capturar el stack trace completo. **Se reprodujo de nuevo el 2026-07-16**
(sesión de confirmación del módulo 10, tercer intento de
`test_10_3_una_foto_habilita_envio`, ~12:26) — esta vez `crash_monitor` sí
capturó el trace completo antes de que rotara:

```
E AndroidRuntime: FATAL EXCEPTION: androidmapsapi-TilePrep_1
E AndroidRuntime: Process: com.example.estacionamientos_mobile, PID: 6713
E AndroidRuntime: java.lang.NoSuchFieldError: No static field a of type Lm140/gfy; in class Lm140/gfy; or its superclasses (declaration of 'm140.gfy' appears in /data/user_de/0/com.google.android.gms/app_chimera/m/00000011/dl-MapsCoreDynamite.integ_260830202100800.apk!classes2.dex)
	at m140.gge.d(:com.google.android.gms.policy_maps_core_dynamite@260830207@...)
	at m140.eoa.I(...) / m140.emo.a(...) / m140.emw.o(...) / m140.emv.run(...)
	at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1145)
	...
W ActivityTaskManager: Force finishing activity com.example.estacionamientos_mobile/.MainActivity
I ActivityManager: Process com.example.estacionamientos_mobile (pid 6713) has died: fg TOP
I Process: Sending signal. PID: 6713 SIG: 9
```

**Causa raíz identificada:** el crash ocurre en un **thread interno del SDK
de Google Maps** (`androidmapsapi-TilePrep_1`, preparación de tiles), dentro
del módulo dinámico `com.google.android.gms.policy_maps_core_dynamite` de
Google Play Services — **no es código Dart/Flutter de la app**. El
`NoSuchFieldError` sobre un campo estático ofuscado (`m140.gfy`) es la firma
típica de una **incompatibilidad de versión entre el Google Play Services
instalado en el AVD y el Maps SDK con el que se compiló la app** (el código
compilado espera una clase con un campo que la versión de Play Services
instalada en este emulador ya no tiene/renombró). Pasa justo cuando el mapa
de Home empieza a cargar tiles apenas termina el login — mata el proceso
completo (`SIG 9`), Android vuelve al launcher, y la sesión de Appium queda
con la app fuera de foreground.

**Es intermitente**: en la misma sesión del 2026-07-16, otros 2-3 logins
inmediatamente antes y después cargaron el mapa sin problema. Esto es
compatible con una carrera de inicialización en el SDK de Maps (dynamite
module loading) más que con un fallo determinístico — no se ha logrado
identificar un disparador específico (ej. tipo de conexión, primer login del
proceso vs. relogin).

**Recomendación para devs:** validar la versión del Google Play Services
services / Maps SDK contra la matriz de compatibilidad declarada en
`build.gradle` de la app, y considerar fijar (`pin`) una versión de Play
Services en la imagen del AVD de CI/QA si el problema persiste. Mientras
tanto, en la suite: si un test falla con `app_state=1` y
`categoria_fallo=Crash/ANR` justo después de un login, no tratarlo como
selector roto — es este crash conocido; relanzar la app y reintentar el test
suele bastar (el crash no dejó rastro de corrupción de datos en el backend
en los intentos observados).

---

## 🤔 Login intermitentemente lento (>20s) contra el backend de dev

**Estado: observado en varias corridas (2026-07-07 tarde) — bajo prioridad,
mitigado en los tests.**

Al automatizar los módulos Smoke y 3 (Splash/sesión), el tiempo entre tocar
"INICIAR TURNO" y que el Home termine de cargar varió fuerte entre corridas:
a veces ~2s, otras veces >30s con las mismas credenciales y el mismo build.
No hubo error visible en logcat (no es un crash) — el `finally` de cierre de
turno del test que falló por timeout igual pudo ejecutarse después, señal de
que el login sí había terminado, solo que tarde. Se subió el timeout de
`home_page.esta_cargado()` de 20s a 30s en los tests de Smoke y del módulo 3
como mitigación. Si se repite con timeouts más altos, reportar a devs como
posible lentitud del backend de dev (no del emulador, que en estas corridas
sí reportó buen estado — `app_state=4`, sin crash/ANR).

## 🤔 Card "Asignación de hoy" no aparece como paso posterior al login (checklist 4.4)

**Estado: observado en recon del módulo 4 (2026-07-07) — a confirmar con Pedro
si es un cambio de diseño intencional o un paso que falta implementar.**

El checklist QA describe, para el login exitoso (4.4): "Credenciales válidas
→ Iniciar → Card 'Asignación de hoy' (zona, turno, compañero); entra a Home"
— dando a entender una pantalla/card intermedia entre el login y Home. En
este build, esa card (con el texto "Sin asignación disponible por el
momento.") en realidad ya está renderizada **en la propia pantalla de
Login**, como preview antes de autenticar — no aparece como paso aparte
después de tocar "INICIAR TURNO": el login exitoso entra directo a Home. No
bloquea nada (el dato de asignación existe, solo que se muestra en otro
momento del flujo), pero difiere de lo que describe el checklist original.

## 🔧 Pedido a devs: pines del mapa sin identificador/estatus por accesibilidad

**Estado: pendiente de reportar.**

Los marcadores del mapa (Google Maps SDK) exponen TODOS el mismo
`content-desc="Marcador de mapa"` genérico — no hay forma de identificar por
accesibilidad ni el código de espacio ni el estatus (color) de un pin
específico, a diferencia de las filas de la Vista Lista (que sí incluyen el
código en su `content-desc`). Esto bloqueó automatizar 6.1 (colores por
estatus), 6.2 (leyenda vs. pines) y 6.3 (seleccionar un pin específico) — ver
`tests/test_6_mapa.py`. Además, tras 4 intentos de recon (click directo,
click con espera de estabilización, tap por coordenadas con bounds frescos)
no se logró reproducir de forma confiable que tocar un marcador abra el
sidebar, lo que sugiere que el hit-test del marcador podría ser más chico que
el bounding box reportado por accesibilidad, o requerir un estado de "mapa
idle" más estricto que el usado en el recon.

**Pedido concreto:** si es viable, exponer el código de espacio en el
`content-desc` de cada marcador (p.ej. vía `MarkerOptions.title` o un
`Semantics` custom sobre el marker), igual que ya se pidió para los widgets
de login/turno en el hallazgo de arriba.

**Nota adicional:** los marcadores cargan de forma ASÍNCRONA tras entrar a
Mapa (confirmado: 1 visible a los ~2s, 11 a los ~3.5s en la misma corrida) —
cualquier conteo debe esperar a que se estabilice, no leerlo apenas se
entra a la vista.

## 🤔 Diálogo de Filtros del mapa: sin botón "Limpiar" visible (checklist 6.7)

**Estado: observado en recon del módulo 6 (2026-07-07) — a confirmar con
Pedro.**

El checklist describe para 6.7 "Filtros → seleccionar tipo → Aplica
correctamente; 'Limpiar' restaura todo", pero el diálogo de Filtros mapeado
hoy (sección "Estatus": Libre/Vigente/Por vencer/Vencido; sección "Tipo de
vehículo": Civil/Discapacitados/Zona de Carga) no mostró ningún botón
"Limpiar" ni "Aplicar" — solo los botones de cada opción y un backdrop
"Sombreado" para cerrar. Tampoco se encontró un botón de "centrar ubicación"
(caso 6.10) en los dumps tomados. Podría ser que estos elementos no estén
implementados en este build, o que requieran un estado previo (algún filtro
ya activo) para aparecer — no investigado a fondo todavía.

## 🤔 Reloj del topbar 12h desfasado del reloj real del dispositivo (a confirmar)

**Estado: observado una vez en recon del módulo 7 (2026-07-07) — bajo
prioridad, sin investigar a fondo.**

En un screenshot tomado durante el recon, la barra de estado de Android
marcaba **10:12** (hora real del dispositivo, ya sincronizada por
`conftest.py`) pero el reloj del topbar de la app marcaba **22:12** — una
diferencia de exactamente 12 horas, compatible con un bug de conversión
12h/24h (p.ej. tratar una hora AM como si fuera PM o viceversa al formatear).
El turno mostraba "22:12 · Turno 06:06" en ese momento. No se investigó a
fondo porque no bloqueaba nada — el turno en cuestión llevaba abierto varias
horas por un problema de limpieza de la suite (ver housekeeping en
`CONTEXTO.md`), así que también podría ser un efecto secundario de esa
situación anómala y no representativo de un turno recién iniciado. Confirmar
con un turno fresco antes de reportarlo formalmente.

## ❌ RETRACTADO: 'Cancelar' en el diálogo de liberar espacio NO libera el espacio (era un falso positivo del test)

**Estado: descartado tras recon manual exhaustivo (2026-07-21) — el hallazgo
original de abajo (2026-07-09, marcado "confirmado, prioridad ALTA") era un
bug del harness de pruebas, no de la app.**

Se exploró el flujo a mano, paso a paso, con screenshot antes/después de
cada tap y las coordenadas del botón "Cancelar" obtenidas por
`uiautomator dump` (para descartar cualquier duda de que el click cayera
sobre "Liberar" por error — ambos botones están a solo 16px de distancia).
Resultado: **tocar "Cancelar" deja el espacio genuinamente ocupado** — no
vuelve a aparecer en el filtro "Libres" de la Vista Lista.

**Causa real del falso positivo:** el helper `codigos_de_espacios_visibles()`
(`pages/home_page.py`) ubicaba filas por `contains(@content-desc, "CJ-")`
sin exigir que fuera una fila real de la tabla. El sidebar del espacio queda
**abierto** después de cancelar el diálogo (Cancelar solo cierra el diálogo,
no el sidebar) y su título ("ESPACIO {código}") es un content-desc de una
sola línea que también matcheaba ese xpath — el helper lo contaba como si
fuera una fila de "Libres", aunque la tabla real nunca lo mostró. Se
confirmó cerrando el sidebar a mano: el falso positivo desaparece de
inmediato. El intento de blindaje que tenía el test original
(`limpiar_filtro_ocupado_activo()`, para descartar la teoría de "filtros
acumulativos") no alcanzaba a cubrir esta causa distinta, por eso el bug
pasó desapercibido en 2026-07-09.

**Corregido:** `codigos_de_espacios_visibles()` ahora exige contenido
multilínea (patrón real de una fila: `"Libre\nCJ-1-...\n16 de
septiembre\n— sin —\n9 m"`) para descartar títulos sueltos de un solo
renglón. `test_9_4_liberar_espacio_cancelar` ya no está marcado `xfail` y
pasa de forma consistente. Ver docstring del test para el detalle completo.

## 🤔 Contador de "Duración" del turno con valor inconsistente (a confirmar si es dato de prueba)

**Estado: observado una vez, sin investigar a fondo — bajo prioridad.**

Al cerrar un turno abierto hace ~2 minutos (12:05 → 12:07), la pantalla
"Cierre de turno" mostró **"Duración: 120:01:26"** (120 horas) en vez de algo
cercano a 00:02:xx. Podría ser un contador que no se resetea entre turnos en
el ambiente de dev, o un dato de prueba/seed no relacionado con el turno real.
No se investigó más porque no bloqueaba el flujo — señalarlo si se repite.

## 🤔 Módulo 10 (Reporte): tope real de fotos es 2, no 3

**Estado: confirmado en recon (2026-07-16) — a confirmar con Pedro si el
checklist está desactualizado o si es un bug.**

El checklist original (10.4) dice "Intentar capturar 4 fotos → Solo conserva
hasta 3 fotos". El recon confirmó que este build tiene un tope real de **2**:
la guía visual muestra "Evidencia 1 de 2 · placa visible" / "Evidencia 2 de 2
· placa visible", y el contador de fotos ("N fotos") dejó de subir después de
la segunda captura pese a 2 intentos adicionales. `tests/test_10_reporte.py::
test_10_4_tope_real_de_fotos` valida el comportamiento REAL (tope en 2), no
el del checklist.

## 🤔 Módulo 10 (Reporte): tras enviar, regresa al sidebar del espacio, no a Home

**Estado: observado en recon (2026-07-16) — no bloquea nada, solo difiere del
checklist.**

El checklist (10.6) dice "Enviar → Toast éxito; regresa a Home". En este
build, tras un envío exitoso la pantalla vuelve al sidebar del espacio
ocupado (con LEVANTAR REPORTE, Liberar espacio, etc. visibles de nuevo), no a
la pantalla Home/Operador. Comportamiento razonable, solo distinto al
descrito.

## 🔧 Reporte con cámara: la pantalla puede quedar rotando sola (gotcha de automatización, no bug de la app)

**Estado: confirmado y con causa raíz identificada (2026-07-16) — mitigación
aplicada, agregar a `conftest.py`/`CLAUDE.md` si se repite seguido.**

Durante el recon del módulo 10, después de usar la cámara del reporte
(capturar evidencia, cambiar de cámara), la pantalla del AVD empezó a
rotarse sola a intervalos (~cada 25-50s) pese a que `_forzar_landscape` ya
había fijado `accelerometer_rotation=0` / `user_rotation=0` al arrancar la
sesión. Confirmado por logcat: la app dispara `CameraService: makeClient:
Camera2 API, rotationOverride 1` al abrir la cámara del reporte — un modo de
compatibilidad de Android que fuerza la orientación de la PANTALLA COMPLETA
para que coincida con el sensor de la cámara del emulador, y ese estado queda
"pegado" al proceso de la app, re-disparando la rotación periódicamente
incluso después de salir de la pantalla de cámara y de resetear
`user_rotation` a mano. **Mitigación confirmada:** `adb shell am force-stop
com.example.estacionamientos_mobile` (matando el proceso, no solo cerrando
turno por UI) libera el estado de compatibilidad de cámara — tras eso,
`user_rotation=0` se mantuvo estable. Si un test automatizado usa
`tomar_foto_reporte()`, considerar hacer force-stop + relanzar la app al
terminar ese test específico, en vez de solo cerrar turno/sesión.

## 🤔 Módulo 11 (Cierre de turno): bitácora vacía deshabilita el botón, no muestra un toast

**Estado: confirmado en recon (2026-07-16) — no bloquea nada, solo difiere
del checklist.**

El checklist (11.4) dice "Exportar sin registros en bitácora → Toast o
mensaje: bitácora vacía". El recon confirmó que, en cambio, con la
'Actividad del turno' vacía, "EXPORTAR BITÁCORA" queda directamente
`clickable="false"` (mismo patrón de bloqueo silencioso ya visto en el resto
de la app — proximidad, fotos, etc.) — no hay ningún toast ni mensaje. Con
actividad real, el botón se habilita y ofrece 'Guardar en dispositivo' /
'Compartir' (este último abre el sheet nativo de Android, confirmado).
`tests/test_11_cierre_turno.py::test_11_4_exportar_bitacora_vacia_deshabilitado`
valida el comportamiento real.

## 🤔 Módulo 11: no existe paso de firma antes de cerrar turno (re-confirmado)

**Estado: re-confirmado 2026-07-16 (ya lo indicaba el docstring de
`HomePage.cerrar_turno` desde el recon 2026-07-07) — checklist 11.7/11.8 no
aplican a este build.**

El checklist describe un paso de firma antes de confirmar el cierre de turno
(11.7 "Firma vacía → botón deshabilitado", 11.8 "Cancelar firma → permanece
en resumen"). En este build (v1.0.0 build 1) no existe ningún paso de firma:
"CONFIRMAR Y CERRAR TURNO" es clickeable directo apenas carga el resumen. No
automatizado por no aplicar; señalar si una versión futura de la app agrega
el paso (ver nota similar sobre este mismo punto en `HomePage.cerrar_turno`).

## 🤔 Módulo 12: denegar ubicación NO muestra ningún diálogo propio de la app (a diferencia de cámara)

**Estado: confirmado en recon y por pytest (2026-07-16) — a confirmar con
Pedro si es un gap de UX real a reportar o simplemente el diseño esperado.**

El checklist (12.1/12.2) describe, para cuando se deniega el permiso de
ubicación, un "diálogo explicativo en pantalla" (primera negación) y un
"diálogo con enlace directo a Ajustes del sistema" (negación permanente) —
en ambos casos, de la PROPIA app. El recon confirmó que NINGUNO de los dos
existe en este build: tras denegar (una o varias veces), la app entra
directo a Home sin ningún aviso propio, ni al momento de la negación ni al
volver a abrir la app después.

**Esto contrasta directamente con el permiso de cámara** (9.6, 12.3): ahí sí
existe un diálogo propio real ("Permiso de cámara requerido", con botones
"Cancelar"/"Abrir configuración") cuando se deniega. Ubicación no tiene un
equivalente — el resultado es una degradación completamente silenciosa:

- La Vista Lista pierde el segmento de distancia de cada fila (formato pasa
  de `"...{Placa}\n{Tiempo}\n{Distancia}"` a `"...{Placa}"`, sin ningún
  indicador de por qué falta).
- El botón "Check-In Asistido" queda `clickable="false"` (mismo patrón
  silencioso que "fuera de proximidad", módulo 8) sin ningún banner que lo
  explique — a diferencia de "fuera de proximidad", que sí muestra el texto
  "Estás a X m del espacio".
- El chip "GPS" del topbar es visualmente indistinguible por accesibilidad
  entre "permiso concedido" y "permiso denegado" (mismo `content-desc="GPS"`
  en ambos casos) — esto también resuelve la duda pendiente del hallazgo de
  5.2 sobre el estado del chip inactivo.

**Por qué podría importar:** un operador que denegó ubicación por error (o
que perdió el permiso por alguna razón del sistema) no tiene ninguna señal
de la app para darse cuenta de que ese es el motivo por el que no puede
hacer check-in — lo vería simplemente como un botón que no responde, sin
poder auto-diagnosticar la causa. `tests/test_12_permisos.py::
test_12_1_ubicacion_denegada_primera_vez` y `test_12_2_ubicacion_denegada_permanente`
validan el comportamiento REAL (silencioso), no el del checklist.

**Detalle técnico adicional:** en este ambiente, Android marca el permiso de
ubicación con la flag `USER_FIXED` (no vuelve a preguntar) tras UNA sola
negación — no hicieron falta dos, como en versiones más viejas de Android.
Confirmado con `adb shell dumpsys package <pkg>`.

## 🤔 CORREGIDO: el punto de color del chip "En línea" SÍ refleja la conectividad — solo el texto se queda fijo

**Estado: corregido tras recon manual controlado (2026-07-21) — baja de
"prioridad media, sin ninguna señal" a "cosmético, señal visual SÍ existe".**

El hallazgo original (2026-07-17, ver historial más abajo) decía que el chip
"En línea" no daba NINGUNA señal de la pérdida de conectividad. Un recon
manual más controlado (arrancar con el punto ya estabilizado en VERDE
confirmado, no recién booteado) mostró algo distinto:

1. Con el chip en verde estable (red genuinamente activa) se cortó wifi+datos
   (`svc wifi disable` + `svc data disable`), confirmado real con `dumpsys
   connectivity` (`Active default network: none`) y `ping` inalcanzable.
2. A los 15s, el **punto de color del chip pasó de verde a rojo** — sí
   refleja el corte real.
3. Al reactivar wifi+datos, el punto volvió a verde a los pocos segundos.

Osea que el **color SÍ es una señal confiable** (ciclo verde→rojo→verde
confirmado limpio). El problema real, más acotado: el **texto** del chip se
queda fijo en "En línea" (content-desc exacto) incluso con el punto en rojo
— no cambia a algo como "Sin conexión". Es una inconsistencia de copy/UI
(rojo + "En línea" al mismo tiempo es confuso), no la ausencia total de
señal que se había reportado.

**Pendiente de reajustar:** `tests/test_13_resiliencia.py::
test_13_1_perdida_de_red_en_home_conserva_espacios` y `tests/test_5_topbar.py
::test_5_4_chip_conexion_refleja_desconexion` solo comprueban que el chip
"En línea" (por accessibility id/texto) sigue *presente*, no el color del
punto — por eso no habían detectado que el punto sí cambia. Si se quiere
automatizar el chequeo de color, hace falta leer el color real del ícono
(no visible por accesibilidad como texto), o aceptar que el texto fijo es el
único hallazgo reportable a devs.

<details>
<summary>Redacción original del hallazgo (2026-07-17), reemplazada por lo de arriba</summary>

Al automatizar el módulo 13 (Resiliencia), se confirmó que el chip "En línea"
del topbar se queda mostrando ese estado **indefinidamente**, incluso con el
dispositivo genuinamente sin red. Se verificó primero a nivel de sistema que
el corte de red es real (no un artefacto del test): con `svc wifi disable` +
`svc data disable`, `adb shell dumpsys connectivity` reportó `Active default
network: none`, `mobile_data=0` y un `ping 8.8.8.8` devolvió `Network is
unreachable`. Pese a eso, el chip "En línea" (accessibility id exacto) se
mantuvo visible, esperando hasta 60s en foreground y tras un ciclo completo
background→foreground. **Corrección 2026-07-21:** esta redacción solo
chequeaba presencia/texto, no el color del punto — el color sí cambiaba.

</details>

## 🔧 Módulo 12: restaurar un permiso concedido en caliente no alcanza sin un evento de ciclo de vida (background→foreground)

**Estado: confirmado en recon y por pytest (2026-07-16) — no bloquea nada,
es información útil para reportar a devs sobre cómo se refresca el permiso.**

Tras conceder de nuevo un permiso previamente denegado (`pm grant`, que
simula "conceder en Ajustes del sistema"), el estado de la UI de la app
(botones bloqueados, distancia faltante en Lista) **no se actualiza solo**
mientras la app sigue en foreground — el estado cacheado del lado de
Flutter (`permission_handler`) no se refresca hasta un evento real de ciclo
de vida. Confirmado: enviar la app a background y volver a traerla al
frente (`driver.background_app()`) sí dispara el refresco y desbloquea de
inmediato las acciones. Esto coincide exactamente con el flujo real que
describe el checklist 12.4 ("Conceder en Ajustes del SO → regresar a la
app"), así que no es un bug — pero vale la pena que devs lo tengan en
cuenta si alguna vez cambian el mecanismo de refresco de permisos (p.ej. un
listener de `AppLifecycleState.resumed` explícito en vez de depender de que
el usuario vuelva a la app manualmente).
