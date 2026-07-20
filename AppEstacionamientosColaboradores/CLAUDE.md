# AppEstacionamientosColaboradores — guía de trabajo

Automatización de pruebas funcionales con Appium para la app móvil
**"Estacionamientos Colaboradores"**, corriendo sobre una **tablet Android
emulada** (Android Studio / AVD Manager). Estructura y convenciones tomadas de
`MediplannerAppiumAutomation/Appium/` (POM + esperas dinámicas + monitor de
crash/ANR) combinadas con las prácticas de detección de errores robustas de la
suite Playwright de este mismo repo (`e2e/utils.js`: resumen legible por
corrida, doble verificación de persistencia antes de reportar un bug,
reintentos con mensaje de bug explícito en vez de un timeout genérico).

Es una **app distinta** a Mediplanner (paquete/`applicationId` propio) — no
mezclar page objects, credenciales ni fixtures entre ambas suites aunque
convivan en el mismo repo `MediplannerWebNuevo`.

## 0. Referencia — portal / credenciales

- **Portal web** (automatización con Playwright iniciada 2026-07-17, ver
  sección 6 abajo): `https://nestacionamientos-dev-62084190654.us-central1.run.app/`
  — el login vive en `/index.php/login` (`/index.php/usuarios` redirige ahí
  si no hay sesión: es el guard de auth, NO la pantalla "Usuarios" del menú
  ADMINISTRACIÓN). Tras loguear, redirige a `/index.php/dashboard`.
- **Credenciales de prueba** (sirven para portal y para la app): confirmadas
  por Pedro, ya cargadas como default en `Appium/conftest.py` (fixture
  `credenciales`) y en `Playwright/tests/auth.setup.ts`, overridable por
  `ESTACIONAMIENTOS_EMAIL` / `ESTACIONAMIENTOS_PASSWORD`.

## 1. Setup obligatorio ANTES de correr cualquier test

### 1.1 Crear el AVD tablet (una sola vez, en Android Studio)

1. Android Studio → **Device Manager** → **Create Device**.
2. Categoría **Tablet** → elegir un perfil (p.ej. **Pixel Tablet** o
   **Nexus 10**). Evitar perfiles de teléfono: la app de colaboradores se
   valida en tablet, y varias apps ajustan layout/orientación según
   `ro.build.characteristics=tablet`.
3. System image: una imagen con **Google APIs** (o Google Play si la app
   necesita Play Services), API level acorde al `minSdkVersion`/
   `targetSdkVersion` real de la app (pedir a devs si no se sabe; API 34 es
   un default razonable si no hay restricción conocida).
4. Nombrar el AVD y anotarlo en `ESTACIONAMIENTOS_AVD_NAME` (o dejarlo como
   `Pixel_Tablet_API_34` y renombrar el AVD igual) — `Appium/config.py` lo usa
   solo para el chequeo de advertencia en `conftest.py`, no como capability
   directa (Appium igual se conecta por `adb devices`, no por nombre de AVD).
5. Arrancar el AVD **antes** de correr los tests y dejarlo bootear por
   completo (pantalla de inicio de Android visible, no el splash de arranque).

### 1.2 Verificar el emulador/dispositivo

```
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
adb devices
```

Debe listar un device en estado `device`. Si sale vacío u `offline`, el
emulador no está listo — no seguir hasta resolverlo. `conftest.py` además
imprime una advertencia (no bloqueante) si el dispositivo conectado no
reporta `tablet` en `ro.build.characteristics` — señal de que se levantó el
AVD equivocado (uno de teléfono).

### 1.3 Verificar que el puerto 4723 esté libre

```
netstat -ano | grep LISTENING | grep 4723
```

Si aparece un PID de un Appium previo que no cerró bien, matarlo
(`taskkill //F //PID <pid>`) antes de continuar.

### 1.4 Levantar Appium y mantenerlo corriendo (background, nunca foreground)

```
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
appium --port 4723
```

Esperar a `"ready":true` en `curl -s http://localhost:4723/status` antes de
correr pytest.

### 1.5 Instalar dependencias Python y correr

```
cd AppEstacionamientosColaboradores/Appium
pip install -r requirements.txt
pytest tests/ -v
```

### 1.6 Al terminar, parar el servidor Appium

No dejarlo huérfano entre sesiones (mismo criterio que Mediplanner: verificar
con `netstat` y `taskkill` si sigue escuchando en 4723).

## 2. Cómo se hacen los tests acá

Mismo patrón Page Object + esperas dinámicas de `MediplannerAppiumAutomation`,
con dos agregados portados de las prácticas robustas de la suite Playwright:

- **`pages/base_page.py`**: clase base. Además de lo ya conocido
  (`hacer_click`, `ingresar_texto`, `esperar_elemento_visible`,
  `assert_visible`, `tap_esquina_sup_derecha/izquierda`, `buscar_elementos`),
  trae helpers pensados para elevar la detección de errores:
  - **`seleccionar_con_reintento(localizador, accion_seleccion, mensaje_bug)`**:
    para pickers/dropdowns nativos inestables. Reintenta un par de veces y, si
    sigue fallando, falla con un mensaje `🐛 ...` explícito en vez de un
    `TimeoutError` genérico — así no se confunde "bug de la app" con "selector
    roto del test" (mismo problema que tuvo `fillFacturacion` en la suite web).
  - **`verificar_persistencia_doble_pasada(chequeo)`**: para confirmar que un
    estado (dato guardado, badge actualizado, etc.) es real y no un falso
    positivo de timing — evalúa dos veces con espera entre medio y solo da por
    válido lo que es consistente en ambas pasadas (equivalente a
    `scanResidualIndicators` en `e2e/utils.js`).
  - **`ingresar_texto_con_fallback` / `hacer_click_con_fallback(localizadores)`**:
    reciben una LISTA de localizadores y prueban en orden — mitigación para
    los selectores estructurales frágiles que exige esta app Flutter (ver
    hallazgo de localizadores en `HALLAZGOS.md`). Si un fallback más allá del
    primero funciona, loguea un warning: señal temprana de que el layout
    cambió, antes de que el selector se rompa del todo.
- **`pages/*.py`**: un page object por pantalla/flujo. `login_page.py` y
  `home_page.py` ya están mapeados contra la app real (recon 2026-07-07,
  sección 3). Selectores nuevos: seguir el mismo patrón (XPath por label
  hermano + `AppiumBy.ACCESSIBILITY_ID` para textos exactos).
- **`tests/test_*.py`**: un archivo por flujo, cortos y enfocados. Si un test
  supera ~150-200 líneas o mezcla varios flujos, partirlo.
- **`utils/`**: helpers reutilizables que no son un page object completo
  (`navegacion.py:volver_inicio`). Revisar antes de duplicar lógica.
- **`conftest.py`**: fixtures de driver + `credenciales` + `sesion_limpia` +
  cada page object, más `crash_monitor` (autouse): drena logcat antes del
  test, y al terminar reporta crash/ANR (hard-fail) y errores no fatales (se
  listan, no tumban el test), imprime un **resumen legible por consola**
  (equivalente al `printSummary()` de `setupConsoleMonitor` en la web) y
  guarda un JSON en `reports/monitor/`.
  - Cada JSON incluye **`resultado`** (passed/failed) y **`categoria_fallo`**
    (`Crash/ANR`, `Selector`, `Timeout`, `Backend/API`, `Infra/Setup`,
    `Assertion`, `OK`) — clasificación estructurada calculada por
    `_clasificar_fallo` a partir del resultado real de pytest (hook
    `pytest_runtest_makereport`), no solo del logcat. Sirve para responder
    "¿qué está fallando más y por qué?" con datos en vez de memoria.
  - **`python reports/generar_resumen_estabilidad.py`** agrega todos los
    JSON de `reports/monitor/` en una tabla por test: corridas, tasa de
    éxito, categorías de fallo más frecuentes, y marca ⚠️ los tests con
    <70% de éxito en 3+ corridas. Correrlo cada tanto para detectar tests
    inestables antes de confiar ciegamente en ellos.
- **`config.py`**: capabilities Appium (`APP_PACKAGE`, `APP_ACTIVITY`) —
  overrideable por variable de entorno, mismo criterio que `PW_CHROMIUM_PATH`
  en la suite Playwright de este repo.
- **`pytest.ini`**: markers `smoke`/`slow`/`destructivo`; timeout global de
  180s como backstop de un colgado (además del `crash_monitor`).
- **No destructivo por default**: los tests no deben cancelar/borrar datos
  reales salvo que sea explícitamente el propósito (dejarlo bajo marker
  `destructivo` y documentado). Si un test necesita crear datos, usar valores
  desechables y de vida corta.
- **Esperas**: helpers dinámicos de `base_page`, nunca `time.sleep()` fijo
  como mecanismo principal (excepción: bucles de scroll-y-reintento o gestos
  físicos sin elemento que esperar).
- **Hallazgos para devs** (localizadores frágiles, crash puntual, dato raro
  de duración de turno): ver `HALLAZGOS.md`, mismo formato que la sección de
  hallazgos de `CONTEXTO.md` en la raíz del repo.

## 3. Mapeo real de la app (recon 2026-07-07)

Login y Home ya están mapeados y automatizados (`login_page.py`, `home_page.py`,
`test_login.py`). Resumen de lo confirmado:

- **App real**: `com.example.estacionamientos_mobile` / `.MainActivity` — es
  **Flutter** (todo el árbol de accesibilidad son `android.view.View`/
  `android.widget.EditText` sin `resource-id`; los campos de texto no tienen
  `content-desc` propio, se ubican por el label hermano que los precede —
  ver el patrón XPath en `login_page.py`).
- **Login** ("Acceso operador"): campos "Número de credencial" + "Contraseña",
  botón "INICIAR TURNO". **No es un login pasivo**: al loguear se abre un
  **turno de trabajo real** en el backend (temporizador "Turno HH:MM:SS" en la
  barra superior). El menú de usuario (avatar, arriba a la derecha) tiene
  **"Modo presentación"** y **"Cerrar turno"** — cerrar turno lleva a una
  pantalla de resumen ("Cierre de turno": espacios verificados, reportes,
  check-ins, km recorridos) con botón "CONFIRMAR Y CERRAR TURNO".
- **Home** ("Operador"): mapa de Google con marcadores de espacios de
  estacionamiento, tabs Mapa/Lista, buscador, Filtros, toggle "Ocultar
  libres", leyenda de estados (Libre=verde, Vigente=azul, Tiempo
  excedido=rojo). Zona activa mostrada en la barra superior (p.ej.
  "Primer Cuadro", Querétaro).
- **Pendiente de mapear**: flujos de negocio propios del operador (check-in de
  vehículo, verificación de espacio, reportes por tipo — "Tiempo vencido",
  "Sin check-in detectado", "Placa no coincide" — vistos en el resumen de
  cierre de turno pero aún sin flujo de creación mapeado). Repetir el patrón
  de recon: `adb shell uiautomator dump` + screenshot antes de escribir
  selectores nuevos.

### Convención: todo test que loguea debe dejar el turno cerrado

Como el login abre un turno real, **cualquier test que llame a
`LoginPage.login`**:
- Debe pedir el fixture **`sesion_limpia`** (arranca desde login sin importar
  si quedó un turno abierto de una corrida/exploración anterior).
- Debe cerrar el turno en un `finally` (ver `test_login.py`), incluso si el
  resto del test falla — no dejar turnos huérfanos en el ambiente compartido
  de dev.

## 4. Gotchas del AVD descubiertos en recon (ya automatizados, no repetir a mano)

Todo lo siguiente ya está resuelto en `conftest.py`/`config.py`/`base_page.py`
— se documenta para que quede claro EL PORQUÉ si alguien lo toca:

- **Reloj del AVD desfasado.** Un AVD resumido desde snapshot (no cold-boot)
  puede arrancar con el reloj atrasado varios días. El backend rechaza
  requests con eso: `Error: "Petición expirada o reloj desfasado"` — no es un
  bug de la app. `adb shell date <valor>` falla por permisos en esta imagen
  ("adbd cannot run as root in production builds"). Fix: `conftest.py`
  fuerza sincronización por red (`auto_time`) al arrancar la sesión
  (`_sincronizar_reloj`).
- **Zona horaria quedando en GMT.** Sin SIM/ubicación, `auto_time_zone`
  cae a GMT en vez de la hora real de Querétaro (América/México). Como esta
  app registra turnos de trabajo, la hora local importa. Fix: zona horaria
  fijada EXPLÍCITO a `America/Mexico_City` (constante `TIMEZONE` en
  `config.py`), no vía `auto_time_zone`.
- **La capability `orientation` de UiAutomator2 backgroundeaba la app.** Con
  `orientation: LANDSCAPE` en las capabilities, la sesión llegó a mandar la
  app a background a mitad de un login sin excepción visible. Fix: el lock de
  landscape se hace 100% a nivel de sistema operativo (`adb shell settings put
  system accelerometer_rotation 0` + `user_rotation 0`, en
  `_forzar_landscape`) ANTES de crear la sesión de Appium — **no** usar la
  capability `orientation`.
- **`driver.hide_keyboard()` sin teclado visible = back nativo.** En
  UiAutomator2, si no hay teclado en pantalla, `hide_keyboard()` cae a un back
  nativo — que puede sacar la app entera a Home. Fix: `BasePage.
  ocultar_keyboard()` chequea `driver.is_keyboard_shown()` antes de intentar
  ocultarlo. Mismo tipo de riesgo que usar `adb keyevent BACK` a ciegas.
- **UiAutomator2 puede fallar en encontrar un elemento confirmado en el dump**
  cuando hay animación continua en pantalla (mapa de Google, reloj de turno
  con segundos). No es un selector roto — es una falla de sincronización de
  "idle" del framework. Si `hacer_click`/`find_element` falla de forma
  intermitente sobre un elemento que el dump SÍ confirma presente, la
  alternativa validada es un tap por coordenadas (`adb shell input tap x y`
  con los `bounds` del dump, o `driver.tap([(x, y)])`) en vez de insistir con
  `find_element`.
- **Popup nativo de permiso de ubicación puede aparecer pese a
  `autoGrantPermissions`.** El Home pide GPS para el mapa y a veces Android
  igual muestra el diálogo "Solo esta vez / Mientras se usa la app / No
  permitir" (más frecuente después de ciclos de `pm revoke`/`pm grant` o
  `pm clear` hechos a mano durante recon). Si queda en pantalla, tapa el
  login/Home y produce fallos que parecen timeouts de carga pero en realidad
  son este popup bloqueando la interacción. Directiva de Pedro: siempre
  elegir **"Mientras se usa la app"**. Fix: `BasePage.
  manejar_popup_permiso_ubicacion()` (matchea por el resource-id de AOSP
  `permission_allow_foreground_only_button`, no por texto/idioma) se llama
  automático desde `LoginPage.login()` y `HomePage.esta_cargado()` — no hace
  falta invocarlo a mano en tests nuevos que ya pasen por esos dos puntos.
- **Un crash real SÍ ocurrió durante el recon** (`Force finishing activity` +
  `Process ... has died: fg TOP` en logcat, capturado correctamente por
  `crash_monitor` como hard-fail). El buffer de logcat rota rápido y se perdió
  el stack trace antes de poder analizarlo — por eso `crash_monitor` ahora
  vuelca el logcat COMPLETO a `reports/monitor/*_logcat_completo.txt` apenas
  detecta un crash, no solo las líneas que matchean el patrón. Si vuelve a
  pasar, ese archivo tiene el contexto completo para reportarlo a devs.
- **`UnicodeEncodeError` al redirigir la salida de pytest a un archivo en
  Windows (descubierto 2026-07-17).** El resumen de `crash_monitor`
  (`_imprimir_resumen`) imprime emojis/box-drawing (`═`, `📊`, etc.). Con
  stdout interactivo (terminal) Windows lo maneja bien, pero al redirigir
  (`pytest ... > out.txt`, patrón usado para capturar corridas largas o para
  que otro proceso lea el resultado — ver sección 6 abajo) Python cae al
  encoding por default del sistema (`cp1252` en Windows), que no puede
  codificar esos caracteres y tira `UnicodeEncodeError` en pleno teardown,
  agregando un `ERROR` aparte del resultado real del test. Fix: `conftest.py`
  fuerza `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` al
  importar (no-op si stdout ya es UTF-8, disponible desde Python 3.7).

## 5. Qué esperar a futuro

- Replicar esta misma estructura (`pages/` + `tests/` + `utils/` +
  `conftest.py` con monitor de crash/ANR) si se agrega otra app nueva —
  como carpeta hermana dentro de `MediplannerWebNuevo`, igual que esta.
- Cada test debe validar algo específico y verificable, con `assert` claros y
  evidencia (`assert_visible` / `tomar_screenshot`) ante un fallo.
- Preferir varios tests chicos con lógica en el page object antes que un test
  único gigante, cuando el flujo de negocio tenga pasos independientes entre sí.

## 6. Portal web (Playwright) — `Playwright/` (iniciado 2026-07-17)

Suite Playwright para el **portal admin** del mismo sistema de
estacionamientos ("Querétaro con Futuro" / Sistema de Gestión de
Estacionamiento), en `AppEstacionamientosColaboradores/Playwright/`. Es la
contraparte WEB de la app móvil de este mismo proyecto — **mismas
credenciales** (ver sección 0), pero un producto/superficie totalmente
distinta (panel de administración, no la app del operador en campo). No
comparte page objects ni specs con Mediplanner ni con la suite Appium.

**Por qué carpeta propia sin `package.json`/`node_modules` propios:** mismo
patrón que `Mediplanner Staging/` y `Mediplanner produccion/` en la raíz del
repo — reutiliza el Playwright ya instalado en la raíz (`npx playwright test`
resuelve `node_modules` subiendo el árbol de directorios), solo con su propio
`playwright.config.js` (`testDir: './tests'`, `baseURL` propio) y su propio
`storageState.json` local (no compartido con Mediplanner). Correr siempre con
CWD = `AppEstacionamientosColaboradores/Playwright/`.

### Recon inicial (2026-07-17)

- **Login real vive en `/index.php/login`** (no en `/index.php/usuarios`
  como sugería la referencia original de la sección 0 — esa URL redirige a
  `/login` si no hay sesión: es el guard de auth). Campos: `input[type=email]`
  ("Correo institucional"), `input[type=password]` ("Contraseña"), botón
  `button[type=submit]` con texto "Iniciar sesión". Link "¿Olvidaste tu
  contraseña?" → `/index.php/recuperar` (no mapeado aún).
- **Tras login exitoso, redirige a `/index.php/dashboard`** ("Panel de
  control"). Confirmado con `auth.setup.ts` (guarda `storageState.json`,
  mismo patrón que `Mediplanner Staging/Tests_Staging/auth.setup.ts`).
- **Dashboard**: 6 tarjetas KPI (Cajones activos, Ocupados ahora, Fuera de
  tiempo, Usos activos, Estacionamientos públicos, Infracciones hoy) + un
  sidebar de 19 links agrupados en 5 secciones: PRINCIPAL (Dashboard,
  Monitoreo en tiempo real, Consultas de placas), VÍA PÚBLICA (Zonas, Tramos,
  Cajones (pintar), Perfiles horarios, Días festivos), ESTACIONAMIENTOS
  PÚBLICOS (Estacionamientos, Cámaras, Atributos (catálogo), Oferta pública
  (mapa)), SUPERVISIÓN (Infracciones, Reportes), ADMINISTRACIÓN (Usuarios,
  Roles y permisos, Configuración, Apps y llaves API, API (documentación)).
- **Ojo:** el propio dashboard aclara en pantalla *"Este es el andamiaje base
  del sistema. Los módulos operativos... están enrutados y listos para
  implementarse uno por uno."* — es decir, no asumir que cada sección del
  menú tiene funcionalidad completa solo porque el link existe y navega; hay
  que reconar cada módulo antes de escribirle tests reales (mismo criterio
  "recon antes de automatizar" que en la suite Appium).

### Estructura y convenciones

- `playwright.config.js`: un `project` por spec (mismo patrón que
  `Mediplanner Staging/playwright.config.js`) —
  - **`setup`**: corre `*.setup.ts` (`auth.setup.ts`), genera `storageState.json`.
  - **`recon`**: matchea `recon.*.spec.ts`, SIN `storageState` ni dependencia
    de `setup` (login manual dentro del propio test) — para exploración
    inicial de una pantalla nueva antes de mapearla en serio. Se conservan
    como referencia (mismo criterio que `vacunacion.explorar.spec.ts` en
    Mediplanner): `recon.secciones.spec.ts` (recorrido de las 8 secciones
    candidatas del sidebar), `recon.detalle.spec.ts` (toggle Mapa +
    formulario de infracción), `recon.recuperar.spec.ts` (validaciones de
    login + recuperar contraseña), `recon.login.spec.ts` (primer login).
  - **`login-sesion`**: matchea `login-sesion.spec.ts`, SIN `storageState`
    (cada test arranca de un contexto limpio — están probando el formulario
    de login/sesión desde cero, no tendría sentido arrastrar sesión).
  - **`explorar`**, **`disponibilidad`**, **`infracciones`**,
    **`estacionamientos`**: cada uno matchea su spec homónimo, dependen de
    `setup` y usan `storageState.json`.
  - **`combinado`**: matchea `combinado.*.spec.ts`, depende de `setup`,
    timeout largo (300s) porque orquesta subprocesos de Appium (~1 min c/u).
  - Agregar un `project` nuevo por cada módulo nuevo que se automatice en
    serio (no reusar uno existente para todo).
- Credenciales: `ESTACIONAMIENTOS_EMAIL` / `ESTACIONAMIENTOS_PASSWORD` (mismo
  nombre de variable que usa la suite Appium), default
  `fernando@rym-solutions.com` / `RYM_solutions` si no están seteadas.
- `e2e/utils.ts`: helper compartido `login(page, email?, password?)` /
  `logout(page)` / `assertLoggedIn(page)` — usarlo en vez de repetir el flujo
  de login inline en cada spec nuevo.
- Correr: `cd AppEstacionamientosColaboradores/Playwright && npx playwright test --project=<nombre>`.
- `storageState.json` y `test-results/` son locales, no commitear (ya
  cubiertos por los patrones genéricos `**/storageState.json` y
  `**/test-results/` del `.gitignore` raíz).

### Módulos del checklist de operador adaptados al portal (2026-07-17)

Mapeo del checklist de 74 casos (`checklist_qa_operador.html`, pensado para
la app móvil del operador) a sus equivalentes reales en el portal admin —
**solo se automatizaron los casos con una contraparte real confirmada por
recon**, no se forzó ningún mapeo especulativo:

| Spec | Casos del checklist cubiertos | Pantalla real |
|---|---|---|
| `login-sesion.spec.ts` | S1, S2, S8, 3.1, 3.2, 3.3, 4.1-4.6, 5.6 | `/index.php/login`, `/recuperar` |
| `dashboard.explorar.spec.ts` | S3 (adaptado) | `/index.php/dashboard` |
| `disponibilidad.spec.ts` | 6.2, 6.4, 6.10, 7.5, 7.8 | `/index.php/disponibilidad` (toggle "Mapa" de Estacionamientos) |
| `estacionamientos.spec.ts` | 6.6, 6.11, 7.6, 7.7 | `/index.php/estacionamientos` |
| `infracciones.spec.ts` | 10.1, 10.6, 10.7, 10.8, 10.9, 10.10 | `/index.php/infracciones/nueva` |
| `combinado.checkin-web.spec.ts` | (no es un caso del checklist) | check-in real vía Appium → verificado en `/disponibilidad` |

**Explícitamente NO aplican al portal** (acción física de operador de campo
sin equivalente en un panel de escritorio, o UI que no existe en este
portal): módulo 8 completo (check-in con GPS), módulo 9 (liberar/reportar
con proximidad — su equivalente real ya está cubierto por Infracciones),
módulo 11 (cierre de turno — no existe el concepto de "turno" para un
admin), módulo 12 (permisos nativos Android), módulo 13 (ciclo de vida app
móvil + tracking GPS), 5.1-5.5 (chips GPS/turno no existen en este topbar),
6.1/6.3/6.9 (pines de Google Maps sin identificador de accesibilidad, misma
limitación ya documentada para la app móvil), 6.5/6.7/6.8/6.12, 7.1-7.4/7.9,
10.2-10.5/10.11 (cámara/GPS nativos).

**Varios de estos tests documentan comportamiento REAL que difiere del
checklist** (mismo criterio que la suite Appium: validar lo que pasa de
verdad, no lo ideal) — ver `HALLAZGOS.md` para el detalle: el formulario de
infracción no exige foto, un segundo reporte no avisa duplicidad, "Levantar
falta" no preselecciona motivo, y el envío sin red pierde los datos (no hay
manejo AJAX del error).

### Test combinado app móvil + portal web

`combinado.checkin-web.spec.ts` es el primer escenario de punta a punta que
cruza ambas suites: dispara un check-in real desde la app móvil (subproceso
`python -m pytest` sobre `Appium/tests/test_combo_web_app.py`, que expone
`test_combo_ocupar_espacio` y `test_combo_liberar_espacio`) y confirma desde
Playwright que `/disponibilidad` refleja el cambio de inmediato (mismo
backend/zona "Primer Cuadro"). Requiere el emulador Android + servidor
Appium (puerto 4723) corriendo ANTES de invocar este project — no los
levanta por sí solo. Placa de prueba dedicada: `TESTCOMBO` (9 caracteres,
dentro del límite de 10 visto en el campo `placa` del formulario web —
usar una placa más larga hizo que CONFIRMAR se colgara en la app móvil sin
avisar, no vale la pena reproducir ese problema con otra placa).

**Patrón para escenarios cruzados futuros:** helper `correrPytest(testId,
extraEnv)` en el propio spec (usa `child_process.execFileSync`, con
`ANDROID_HOME`/`PATH` inyectados explícitamente porque el proceso Node de
Playwright no hereda el entorno de shell donde se exportaron a mano) — el
test de Appium debe imprimir un marcador parseable (`COMBO_CODIGO:.../
COMBO_PLACA:...`) en stdout para pasarle datos de vuelta a Playwright.
Reintentar la limpieza (liberar/revertir) un par de veces antes de darla por
perdida: el diálogo "Liberar espacio" puede tardar en montarse (gotcha ya
documentado en `HomePage.liberar_espacio_actual`), y un solo intento fallido
de limpieza puede dejar datos de prueba ocupando un cajón real en dev.

**Pendiente / próximos pasos:** decidir con Pedro si vale la pena profundizar
en Zonas/Cajones/Usuarios (quedaron fuera de alcance por ahora, sin un
mapeo claro a un caso específico del checklist de operador) o si el foco
pasa a casos de administración propios del portal (fuera del checklist
original, que fue escrito solo para el operador de campo).
