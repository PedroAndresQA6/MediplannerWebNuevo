# MediplannerAppiumAutomation — guía de trabajo

Automatización de pruebas funcionales de apps móviles con Appium. Hoy contiene
una sola suite (`Appium/`, para la app Mediplanner Android); si en el futuro se
agrega otra app, debe vivir en una carpeta hermana dentro de este directorio y
seguir la misma estructura y convenciones descritas más abajo.

## 1. Setup obligatorio ANTES de correr cualquier test

No intentar correr ni un solo test sin completar esto primero. El objetivo es
llegar al punto en que el emulador ya se puede manipular (Appium responde y ve
el dispositivo) antes de tocar `pytest`.

1. **Verificar el emulador/dispositivo:**
   ```
   export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
   export ANDROID_SDK_ROOT="$ANDROID_HOME"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"
   adb devices
   ```
   Debe listar un device en estado `device` (p.ej. `emulator-5554`). Si sale
   vacío o `offline`, el emulador no está listo — no seguir hasta resolverlo
   (arrancarlo, esperar a que bootee).

2. **Verificar que el puerto 4723 esté libre** (un Appium previo que no se
   cerró bien deja el puerto ocupado y el arranque falla con `EADDRINUSE`):
   ```
   netstat -ano | grep LISTENING | grep 4723
   ```
   Si aparece un PID, matarlo (`taskkill //F //PID <pid>`) antes de continuar.
   Nota: `TaskStop` sobre el task en background no siempre mata el proceso
   `node.exe` hijo en Windows — verificar con `netstat` y forzar con
   `taskkill` si sigue escuchando.

3. **Levantar el servidor Appium y mantenerlo corriendo hasta terminar las
   pruebas** (es un proceso de larga duración, correrlo en background, NUNCA
   en foreground bloqueando la sesión):
   ```
   export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
   export ANDROID_SDK_ROOT="$ANDROID_HOME"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"
   appium --port 4723
   ```
   `ANDROID_HOME`/`ANDROID_SDK_ROOT` son obligatorios en el mismo proceso que
   arranca Appium — si faltan, la sesión de Appium falla en `createSession`
   con "Neither ANDROID_HOME nor ANDROID_SDK_ROOT...".

4. **Esperar a que Appium esté listo** (no asumir que ya lo está por haber
   arrancado el proceso):
   ```
   curl -s http://localhost:4723/status
   ```
   Repetir con una espera corta hasta ver `"ready":true`. Recién ahí se puede
   correr pytest.

5. **Al terminar la corrida de tests**, parar el servidor Appium (no dejarlo
   huérfano entre sesiones): `TaskStop` del task y, si `netstat` todavía lo
   muestra escuchando en 4723, `taskkill //F //PID <pid>`.

### Credenciales

`conftest.py` ya trae valores por defecto para `MEDIPLANNER_EMAIL` /
`MEDIPLANNER_PASSWORD` si no están en el entorno — normalmente NO hace falta
exportarlas a mano. Si hay que exportarlas, nunca escribir el valor literal en
un comando de shell (dispara el bloqueo de "credencial expuesta" del
clasificador de permisos); dejar que las tome del entorno ya configurado o de
los defaults de `conftest.py`.

## 2. Cómo se hacen los tests en este proyecto

Patrón Page Object + esperas dinámicas, sin `time.sleep()` fijo como mecanismo
principal de sincronización:

- **`pages/base_page.py`**: la clase base. Toda página nueva hereda de acá.
  Provee `hacer_click`, `ingresar_texto`, `esperar_elemento_visible`,
  `esta_visible`, `buscar_elementos` (reemplaza `sleep(N) + find_elements`),
  `assert_visible` (falla con screenshot y mensaje claro), `tap_esquina_sup_
  derecha/izquierda` (toca el elemento clickable en la franja superior por
  POSICIÓN, para iconos sin `content-desc` — nunca usar bounds absolutos
  hardcodeados, se rompen con la resolución del dispositivo).
- **`pages/*.py`**: un page object por sección/flujo de la app (`login_page`,
  `home_page`, `doctors_page`, `consultas_page`, …). Ahí vive TODA la lógica
  de selectores e interacción; los tests no deberían tener XPaths sueltos más
  que los específicos de la validación que están haciendo.
- **`tests/test_*.py`**: un archivo por flujo/feature, cortos y enfocados (si
  un test supera ~150-200 líneas o mezcla varios flujos de negocio, hay que
  partirlo — ver `tests/test_consultas_*.py` como referencia de cómo se separó
  un test de 563 líneas en 4). Selectores preferidos: `content-desc` /
  accessibility id. Evitar bounds absolutos; si hace falta posición (icono sin
  descripción), usar los helpers de `base_page`.
- **`utils/`**: helpers reutilizables entre tests que no son un page object
  completo (`navegacion.py:volver_inicio`, `medicamentos.py:agregar_
  medicamento`). Antes de escribir un test nuevo, revisar si ya existe un
  helper equivalente — no duplicar lógica de navegación/alta de datos.
- **`conftest.py`**: fixtures de driver y de cada page object, más el fixture
  `crash_monitor` (autouse) que lee logcat antes/después de cada test y hace
  fallar el test ante crash/ANR reales (no ante ruido de logcat). Cualquier
  suite Appium nueva debería traer un monitor equivalente.
- **No destructivo por default**: los tests no deben cancelar suscripciones,
  desvincular dependientes reales, ni borrar datos a menos que sea
  explícitamente el propósito del test (y en ese caso, dejarlo comentado como
  tal, ver `test_perfil_cuenta`/`test_perfil_compartir` para el patrón de
  "validar y no confirmar la acción destructiva"). Si un test necesita crear
  datos, usar valores desechables y de vida corta (p.ej. medicamentos con
  duración de 1-2 días, convención ya usada en `utils/medicamentos.py`).
- **Esperas**: usar los helpers dinámicos de `base_page` (`esperar_elemento_
  visible`, `buscar_elementos`, `assert_visible`) en vez de `time.sleep()`.
  `time.sleep()` corto solo se acepta dentro de bucles de scroll-y-reintento
  (patrón ya establecido: `for _ in range(N): scroll_abajo(); time.sleep(0.4-
  0.6)`) o para gestos físicos sin elemento que esperar (swipes de seekbar,
  transiciones de pestañas por swipe).
- **`pytest.ini`**: markers `smoke`/`slow`/`destructivo` disponibles para
  taguear tests nuevos; timeout global de 180s como backstop de un test
  colgado (además del `crash_monitor`, que cubre crash/ANR pero no un hang sin
  error).

## 3. Qué esperar de los tests a futuro / si se automatiza otra app

- Replicar esta misma estructura (`pages/` + `tests/` + `utils/` + `conftest.py`
  con monitor de crash/ANR) para cualquier app nueva que se automatice,
  respetando las mismas convenciones de esperas dinámicas y selectores
  resolución-independientes.
- Cada test debe validar algo específico y verificable (no solo "no crasheó"):
  usar `assert` con mensajes claros y, cuando aplique, `assert_visible` /
  `tomar_screenshot` para dejar evidencia ante un fallo.
- Si un flujo de negocio tiene varios pasos independientes entre sí (agendar,
  reprogramar, confirmar, etc.), preferir varios tests chicos con su lógica en
  el page object, no un test único gigante.
- Antes de escribir selectores nuevos, revisar si ya hay un helper aplicable
  en `base_page.py` (posición relativa, esperas, asserts) para no reinventar
  patrones ya resueltos.
