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

- **Portal web** (aún NO se automatiza, solo referencia futura):
  `https://nestacionamientos-dev-62084190654.us-central1.run.app/index.php/usuarios`
- **Credenciales de prueba** (sirven para portal y para la app): confirmadas
  por Pedro, ya cargadas como default en `Appium/conftest.py` (fixture
  `credenciales`), overridable por `ESTACIONAMIENTOS_EMAIL` /
  `ESTACIONAMIENTOS_PASSWORD`.

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

## 5. Qué esperar a futuro

- Replicar esta misma estructura (`pages/` + `tests/` + `utils/` +
  `conftest.py` con monitor de crash/ANR) si se agrega otra app nueva —
  como carpeta hermana dentro de `MediplannerWebNuevo`, igual que esta.
- Cada test debe validar algo específico y verificable, con `assert` claros y
  evidencia (`assert_visible` / `tomar_screenshot`) ante un fallo.
- Preferir varios tests chicos con lógica en el page object antes que un test
  único gigante, cuando el flujo de negocio tenga pasos independientes entre sí.
