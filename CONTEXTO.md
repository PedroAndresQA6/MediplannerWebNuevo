# CONTEXTO — MediplannerWebNuevo

> **Qué es este archivo:** documento vivo de contexto del proyecto. Sirve para (a) comunicar en qué estamos trabajando y (b) poner al tanto a una sesión nueva de Claude Code (en esta u otra computadora). **Mantenerlo actualizado y commitearlo** cada vez que cambie el estado del trabajo.
>
> **Última actualización:** 2026-07-21 (limpieza de archivos muertos + fix del selector roto de la lista de Pacientes en dev, ver sección "🔧 Fix selector de Pacientes" más abajo). Anterior: 2026-07-21 (`8c358b2`, en `AppEstacionamientosColaboradores/` — sesión de reverificación de los bugs de plataforma de Estacionamientos antes de reportarlos formalmente a devs. Resultado: **se retractó el hallazgo de prioridad ALTA "'Cancelar' libera el espacio igual"** — recon manual con coordenadas exactas de los botones y capturas en cada paso probó que la app SÍ se comporta bien; el bug real estaba en el propio harness (`codigos_de_espacios_visibles()` matcheaba el título del sidebar, que queda abierto tras cancelar, como si fuera una fila real de la tabla). Se corrigió el helper (exige contenido multilínea) y se quitó el `xfail` de `test_9_4_liberar_espacio_cancelar`, que ahora pasa limpio. También se **corrigió y acotó** el hallazgo del chip "En línea" (módulo 13): una prueba controlada (verde estable → cortar red real confirmada por `dumpsys` → rojo a los 15s → reconectar → verde de nuevo) mostró que el **color del punto sí refleja la conectividad real** — el bug queda reducido a que el *texto* se queda fijo en "En línea", bajando de prioridad media a cosmético. Se reconfirmaron en vivo (con evidencia nueva, no solo pytest) los 5 hallazgos del portal web (sin evidencia fotográfica obligatoria, duplicidad silenciosa, pérdida de datos sin red, "Levantar falta" sin motivo preseleccionado, copy "obligatorio"/"obligatoria") y los 2 de app móvil que siguen en pie (crash del SDK de Maps confirmado con tombstone nuevo, permiso de ubicación silencioso reconfirmado). Detalle completo en `AppEstacionamientosColaboradores/HALLAZGOS.md`. Anterior: 2026-07-20 (tres commits. Dos en `AppEstacionamientosColaboradores/`, proyecto de estacionamientos "Querétaro con Futuro" — no Mediplanner: `9759a01` completó los módulos 8-13 del checklist de operador en la suite Appium — check-in, espacio ocupado, reporte/infracción, cierre de turno, permisos del sistema y resiliencia/ciclo de vida — más un fix de encoding en `conftest.py`; `f168d89` agregó una nueva suite **Playwright** para el portal web admin del mismo proyecto, con un test combinado Appium+Playwright y 5 hallazgos nuevos de plataforma — detalle completo en el `CONTEXTO.md`/`HALLAZGOS.md` propios de esa carpeta, no duplicado acá. El tercero, `0665923`, es de `MediplannerAppiumAutomation/` — módulo de bitácora + fix de espera en `test_perfil.py`; commiteado directo en este repo porque se confirmó que esa carpeta **ya no tiene su propio `.git`** pese a lo que decía la sección "Repos separados" — ver esa sección, corregida y marcada como pendiente de resolver con Pedro). Anterior: 2026-07-14 (se corrieron en **staging** los mismos tests adaptados en dev el 2026-07-09/10 — `doctor-consultation` y `ingresos` — para confirmar que el porteo, que había quedado sin commitear, funciona; commiteado en `807fe43`/`62e285c`. Ver sección STAGING abajo). Anterior: 2026-07-09 (re-verificación de los 2 bugs de plataforma pendientes: 422 relacion_id sigue vivo con otro endpoint, indicador "sin guardar" de Laboratorios ya no reproduce — ver sección homónima abajo). Mismo día, antes: rediseño de Ingresos + fix del wizard "Agendar cita" + paciente parametrizable. Anterior: 2026-07-07 (verificación de pendientes vs. código + corridas reales; + nueva suite Appium independiente en `AppEstacionamientosColaboradores/`)

---

## 🟢 Prompt para una sesión nueva (copiar/pegar)

```
Lee CONTEXTO.md en la raíz del repo MediplannerWebNuevo y ponte al tanto del estado
del proyecto. Soy Pedro, Test Automation Tester (no developer); los tests son mi
responsabilidad. Trabajamos en español. Continúa desde la sección "Estado actual" y
las "Decisiones abiertas". Antes de correr tests confirma que tengo .env y
storageState.json localmente (no están en git).
```

---

## Proyecto

- **Qué es:** suite de automatización E2E con **Playwright** para la web admin de Mediplanner (entorno dev: `https://admin-dev.mediplanner.mx/`).
- **Repo:** https://github.com/PedroAndresQA6/MediplannerWebNuevo
- **Rama de trabajo:** `Normalization`
- **Rol:** Pedro = Test Automation Tester. Detecta bugs y los reporta a devs. Los tests son su responsabilidad.

### Stack / entorno (verificado 2026-06-17 en PC principal)
- Node **v24.16.0**, npm **11.13.0**
- Playwright **1.58.2**
- Navegador: el config ya **NO** hardcodea la ruta. `executablePath` es **condicional** a la variable `PW_CHROMIUM_PATH`. En esta PC, `.env` la define apuntando a `chromium-1223`; en otra PC sin esa variable, Playwright usa su Chromium por defecto (`npx playwright install chromium`). Config portable.
- `playwright.config.js`: solo Chromium, viewport **1366x768**, `headless: false`, `workers: 1` (serial)
- Archivos locales necesarios para correr: `.env` (BASE_URL + credenciales + `PW_CHROMIUM_PATH`) y `storageState.json` (sesión auth).
  - ⚠️ **OJO seguridad:** `.env` actualmente **SÍ está trackeado en git** (con credenciales). Pendiente sacarlo del repo (`git rm --cached .env` + `.gitignore`). Por eso el cambio local de `PW_CHROMIUM_PATH` NO se commitea (es ruta de esta máquina).

---

## Estado actual (git)

- **Trabajo más reciente (desde el 2026-06-25, no reflejado antes en este doc):** `git rm --cached` de `.env`/`storageState`/`test-results` (`38b6ce6`); reintento robusto de selección de paciente en citas + spec de percentil, portado a staging/producción (`f6a4c78`, `7dce115`); login directo sin Google OAuth + specs de vacunación en producción (`0911ac1`); trabajo en Appium (robustez, reactivación de app, separación de tests); calendario nuevo del Dashboard + validación de bug de Servicios (`ad9f921`); mapeo exploratorio de Dashboard/Reportes/Ajustes (`3b20037`).
- Commits clave previos: `1bb9cd7` (9 stress tests + monitor + facturacion opción B), `b3efb22` (limpieza de tests muertos de vacunación, incluida en este trabajo), más `feat(consultation)` y `test(vacunacion)` que llegaron del otro equipo.
- Se mantiene sincronizado en las **3 ramas** (`main`, `Trabajando`, `Normalization`) — apuntan al mismo commit.
- *(excluidos de git a propósito:* `storageState.json` = refresco de sesión; cambio local de `PW_CHROMIUM_PATH` en `.env` = ruta de esta máquina; `MediplannerAppiumAutomation/` = repo aparte)*
- **`AppEstacionamientosColaboradores/`** (2026-07-07, en curso): suite de automatización para el sistema de estacionamientos "Querétaro con Futuro" — **completamente independiente** de Mediplanner (paquete/producto distinto), vive en este mismo repo por conveniencia. Ya tiene DOS suites: **Appium/pytest** para la app Flutter del operador de campo (los 13 módulos del checklist de 74 casos ya están escritos, commit `9759a01`) y, desde el 2026-07-17, **Playwright** para el portal web de administración (login/sesión, dashboard, disponibilidad, estacionamientos, infracciones — más un test combinado que valida consistencia de datos entre la app móvil y el portal; commit `f168d89`). No comparte page objects, credenciales ni fixtures con Mediplanner. Tiene su propio `CONTEXTO.md`/`CLAUDE.md`/`HALLAZGOS.md` — no duplicar ese detalle acá, solo esta referencia.

> ✅ El estado está en GitHub: en otra computadora basta `git clone` + `git checkout main` (o cualquiera de las 3 ramas) + `npm install` + (navegador: `npx playwright install chromium` o `PW_CHROMIUM_PATH` en `.env`).

---

## En qué estamos trabajando (historia reciente)

1. **Ya commiteado y pusheado (`564cb92`)**
   - Fix `waitForLoadState('networkidle')` → esperas específicas en `ingresos.spec.ts` (el `networkidle` nunca se cumplía porque GA/Zendesk/Clarity mantienen la red activa).
   - `ingresos` desacoplado de `doctor-consultation` (depende solo de `setup`): correr ingresos ya no corre la consulta primero (1.8m vs 5.3m).
   - Rename `Consultation.stress.test.spec.ts` → `consultation.inputs-validation.spec.ts`.

2. **Mejoras a los 9 stress tests (commit `1bb9cd7`)** — `tests/stress tests/`
   - A los 9: fix `networkidle`→`load` + `setupConsoleMonitor(page)` + `printSummary()`.
   - Bug corregido en `pacientes.stress.test.ts`: `formInputs` → `allInputs` (ReferenceError).
   - `playwright.config.js`: agregados proyectos **`stress-antecedentes`** y **`stress-diagnosticos`** (no existían, esos 2 no se podían correr); proyecto huérfano `stress-test` (apuntaba al archivo renombrado) → **`consultation-inputs-validation`**.
   - **Suite completa corrida en serie: 8/9 pasan.** Solo falla `facturacion` (determinista, por un bug de la app — ver abajo).

3. **`facturacion.stress.test.ts` — opción B aplicada (commit `1bb9cd7`)**
   - `fillFacturacion` ahora hace `selectOption(..., {timeout:5000})` dentro de `try/catch` y lanza un mensaje claro (`🐛 No se pudo seleccionar tipo de persona...`) en vez del `TimeoutError` genérico de 15s.
   - El test **sigue fallando a propósito** porque señala un bug real de la app (no es falso positivo).

---

## 🐛 Hallazgo de QA (reportar a devs)

Al abrir el formulario de **Facturación** de un paciente, `POST /api/patients/getFilledForm` responde **422 `{"status":"ERROR","message":"El campo relacion_id es requerido"}`**.

- Efecto en UI: el front loguea *"Error fetching form elements or invalid response structure"* + `TypeError: Cannot read properties of undefined (reading 'vacunas')` y `(reading 'map')` (bundle `vacunacion-*.js`).
- El select `tipo_persona_id` queda **inestable** (alterna habilitado/deshabilitado por re-render) → no se puede seleccionar tipo de persona.
- El mismo 422 aparece en antecedentes/diagnosticos/vacunacion (esos pasan porque no tienen asserts duros).
- El **DevTools monitor** (agregado a los tests) fue lo que destapó esto.

*Nota:* el entorno dev también es **flaky**: a veces aborta el bundle `index-*.js` (`net::ERR_ABORTED`), causando fallos distintos no relacionados con los tests.

### 🐛 Indicador "sin guardar" (triángulo) que no se limpia — *Laboratorios y Procedimientos*

Cada apartado de la consulta muestra un **triángulo de advertencia** (FontAwesome `triangle-exclamation`, naranja, en el `card-header`) cuando hay cambios sin guardar. **Confirmado (Pedro):** en **Tratamiento › Laboratorios y Procedimientos**, tras llenar y guardar:
- El API responde OK: `POST /api/procedures/setProceduresConsultation → 200 "Procedimientos de consulta actualizados exitosamente"`.
- **Pero el triángulo NO se limpia** → la data se persiste en el servidor, pero el indicador client-side de "sin guardar" se queda. Es un **bug de front**.
- Verificado con doble verificación (no es timing): el triángulo persiste en dos pasadas.

*Cómo se detecta automáticamente:* helper **`scanResidualIndicators(page, tabName)`** en `e2e/utils.js` — tras el guardado real de una pestaña (sin salir de ella; el triángulo es client-side y navegar lo descarta), escanea los apartados visibles y reporta los que conservan el triángulo. Cableado en `tests/consultation.full-flow.spec.js` para Exploración/Tratamiento/Notas/Servicios (General y Diagnóstico se excluyen: guardan con "Continuar", no con botón propio). Log-and-continue: registra + screenshot `test-results/indicador-residual-*.png` + resumen final, sin tumbar el test.

*Falso positivo descartado:* "Aparatos y sistemas" (Exploración) **NO** es bug de la app — era bug del **test**: el guardado de Exploración usaba `.first()` y solo guardaba el primer apartado. Corregido: ahora `fillExplorationSection` llena todo y guarda **cada apartado una vez al final** (se quitó el guardado por-checkbox). Exploración quedó limpia.

---

## 💉 Vacunación — UI NUEVA mapeada + automatización consolidada (2026-06-17)

⚠️ **La UI de Vacunación cambió por completo.** Los tests viejos `tests/vacunacion.registro.spec.ts`, `tests/vacunacion.ciclo.spec.ts` y `tests/stress tests/vacunacion.stress.test.ts` usan el flujo **MUERTO** (react-calendar, `div.cursor-pointer`, botón "Vacuna diferente") → **obsoletos, pendiente borrarlos**.

**Cómo funciona la UI nueva** (mapeada con `tests/vacunacion.explorar.spec.ts`, proyecto `vacunacion-explorar`):
- Cada dosis de la **Cartilla** es un `<input type="date">` inline → selector `table.table-compact input[type="date"]`. Llenar la fecha **AUTO-GUARDA**: dispara `POST /api/vaccines/saveVaccinesUser → 200` solo, sin botón. (Confirmado.)
- Ícono **lápiz** (`button.btn-secondary` con svg `data-icon="pencil"`) = editar folio/obs de esa dosis → abre `input[placeholder="Opcional"]` (folio) + `textarea[placeholder="Notas..."]`. Disponible tras poner la fecha.
- **Borrar** una dosis: `button.btn-secondary` cuyo **texto es "×"** (las de dosis vacías están `hidden`). OJO: lápiz y × comparten la clase `btn-secondary`.
- Sección **"Otra vacuna"** (abajo, fuera de la tabla): filas inline `input[name="vacuna_nombre"]`, `input[name="dosis_nombre"]`, `input[placeholder="Fecha"]`, `input[placeholder="Folio"]`, `textarea[placeholder="Comentarios"]`. Hay 2 filas-plantilla siempre presentes.
- Botón **"Guardar cambios"** = guarda **TODO el apartado de Vacunación** (cartilla + otra vacuna), no solo la otra vacuna.
- Al cargar lanza ~20 errores JS de consola (TypeErrors `'vacunas'`/`'map'` del bundle de vacunación) = bug de la app, NO rompen el flujo. 0 errores de API.

**Automatización consolidada nueva:** `tests/vacunacion.ciclo-completo.spec.ts` (proyecto **`vacunacion-ciclo-completo`**), paciente **Agustin Tapia**. Flujo: ir → borrar todas las dosis (× auto-save) + filas otra-vacuna → refrescar y **verificar 0** → registrar dosis (fecha auto-save, cap **`MAX_DOSES`**) + 1 otra vacuna → refrescar y **verificar persistencia**.
- ✅ **Corrida OK:** borró 2, verificó vacío (0), registró 6, verificó 6 tras refrescar. El bug viejo de "pierde interactividad tras guardar" **ya NO aplica** (el auto-save lo resolvió).

**Pendiente en vacunación:**
- [x] ~~Subir `MAX_DOSES` (actual 6 → 999)~~ — **hecho.** Verificado en código: `MAX_DOSES = 999` en `tests/vacunacion.ciclo-completo.spec.ts` y en las copias de Staging/Producción.
- [ ] Completar borrado + verificación real de filas **"otra vacuna"** (al iniciar solo había plantillas vacías; mi corrida dejó una guardada, así que la próxima ya puede probar el borrado). Ajustar el selector del × rojo (`button[class*="hover:text-red"]`). — **sigue pendiente**, sin cambios en el spec.
- [x] ~~Borrar los 3 tests viejos de vacunación (UI muerta) y su(s) proyecto(s) en el config~~ — **hecho.** `vacunacion.registro.spec.ts`, `vacunacion.ciclo.spec.ts` y el stress de vacunación ya no existen (borrados en commit `b3efb22`, 2026-06-23); `stress-vacunacion` ya no aparece como proyecto en `playwright.config.js`.

---

## Cómo correr los tests

```powershell
cd C:\Users\pandr\MediplannerWebNuevo

# Consulta full-flow
npx dotenv -e .env -- playwright test --project=doctor-consultation

# Ingresos
npx dotenv -e .env -- playwright test --project=ingresos

# Un stress test puntual (ej. facturacion)
npx dotenv -e .env -- playwright test --project=stress-facturacion

# Todos los stress tests (serie, ~20-40 min)
npx dotenv -e .env -- playwright test "stress tests"

# Listar/validar parseo sin correr
npx playwright test "stress tests" --list

# Vacunación — ciclo completo (borrar todo → registrar → verificar)
npx dotenv -e .env -- playwright test --project=vacunacion-ciclo-completo

# Vacunación — mapeador de la UI (exploratorio)
npx dotenv -e .env -- playwright test --project=vacunacion-explorar
```

**Proyectos de stress disponibles:** `stress-login`, `stress-citas`, `stress-pacientes`, `stress-ingresos`, `stress-informacion-paciente`, `stress-facturacion`, `stress-vacunacion`, `stress-antecedentes`, `stress-diagnosticos`.

**Modo de corrida (preferencia):** test puntual que se quiere observar → primer plano (foreground, el navegador se abre por `headless:false`). Suite larga → background.

---

## Setup para reproducir en otra computadora

1. Instalar **Node 24.x** y **git** (y opcionalmente **GitHub CLI `gh`** — no está instalado en la PC principal).
2. `git clone https://github.com/PedroAndresQA6/MediplannerWebNuevo.git` y `git checkout Normalization`.
3. `npm install`.
4. Navegador: `npx playwright install chromium` (usa el bundled). Si prefieres uno ya instalado, pon su ruta en `.env` como `PW_CHROMIUM_PATH=...` (el config la respeta; sin esa variable usa el bundled).
5. Crear **`.env`** localmente (BASE_URL + credenciales) — **no está en git**, pedírselo a Pedro / copiarlo de la PC principal.
6. `storageState.json` se regenera solo al correr el proyecto `setup` (auth), o copiarlo de la PC principal.
7. (Si los cambios de stress tests aún no están en `Normalization`) hacer `git pull` después de que se hayan pusheado.

---

## Repos separados (importante) — ⚠️ desactualizado, corregir con Pedro

`MediplannerAppiumAutomation/` (dentro de la carpeta de MediplannerWebNuevo) **debería ser** su propio repo git independiente, con remote propio: https://github.com/PedroAndresQA6/MediplannerAppiumAutomation. Es un framework Appium/pytest para la app móvil Android de Mediplanner (POM: `pages/`, `tests/`, `conftest.py`).

**Confirmado 2026-07-20: esa carpeta YA NO tiene su propio `.git`** — `git remote -v` ejecutado adentro resuelve al remote de `MediplannerWebNuevo` (no hay `.git` propio, sube al del padre). En la práctica quedó fusionada dentro de este repo en algún punto, contradiciendo la nota original de "NO fusionarlo". El commit `0665923` (módulo de bitácora + fix en `test_perfil.py`) se hizo directo en `MediplannerWebNuevo` por esta razón — no había otro repo real al cual subirlo.

**Pendiente de decidir con Pedro:** si se re-inicializa `MediplannerAppiumAutomation/` como repo propio (y se migra el historial reciente para allá) o si directamente se acepta que ahora vive dentro de `MediplannerWebNuevo` y se actualiza esta nota en consecuencia. Mientras tanto, cualquier cambio ahí se commitea en este mismo repo.

---

## 🟣 STAGING — porteo de automatizaciones y hallazgos (2026-06-25)

**Entorno:** `https://admin-staging.mediplanner.mx/` · carpeta **`Mediplanner Staging/`** (config propio, `baseURL` staging, NO usa `.env`; credenciales staging por fallback en `Tests_Staging/auth.setup.ts`: `dr@rym-solutions.com`). Se corre con CWD = `Mediplanner Staging/` (usa `node_modules` y Chromium de la raíz). No hay `package.json` ni `node_modules` propios.

**Patrón de porteo dev → staging** (lo aplicado con consulta y vacunación): copiar el spec **idéntico** de `tests/` a `Tests_Staging/`; `e2e/utils.js` y `e2e/config.js` ya están copiados idénticos en `Mediplanner Staging/e2e/`; agregar el proyecto al `Mediplanner Staging/playwright.config.js`; ajustar datos propios de staging (p.ej. el nombre del paciente). El `auth.setup.ts` de staging ya está adaptado.

- **Consulta** (`doctor-consultation`): porteada y verificada. Arranca desde "Inicio" (no depende de paciente por nombre). Corrida 3× el 2026-06-25, todas PASAN.
- **Vacunación** (`vacunacion-explorar`, `vacunacion-ciclo-completo`): porteada el 2026-06-25. Paciente fijado en ambos specs = **`Pedro Quijada Anaya`** (Agustin Tapia es de dev, NO existe en staging). `vacunacion-explorar` corrió OK (no destructivo). ✅ `vacunacion-ciclo-completo` **SÍ se ejecutó** — evidencia: `Mediplanner Staging/test-results/vac-ciclo-01-vacio.png` y `vac-ciclo-02-registrado.png`, generadas 2026-06-25 11:24-11:25 (poco después de escribirse esta sección, nunca se actualizó el estado aquí).
  - ⚠️ **Hallazgo sin documentar hasta ahora:** el mismo test destructivo también dejó evidencia de haberse corrido en **Producción** (`Mediplanner produccion/test-results/vac-ciclo-01-vacio.png` y `vac-ciclo-02-registrado.png`, generadas 2026-06-29 11:52, sobre el paciente **Agustin Tapia**). No estaba planeado en este documento — confirmar con Pedro si fue intencional, dado que borra dosis reales.

### 🐛 Hallazgos de consulta en STAGING (3 corridas, 100% reproducible → bug de plataforma)
1. **422 `POST /api/patients/getFilledForm` → "El campo relacion_id es requerido"**. Es el **mismo bug de dev**, confirmado que **también ocurre en staging**.
2. **404 `POST /api/patients/getFilledForm` (×2) → "No se encontró el formulario asignado al paciente"**, al **finalizar la consulta** (+ `Error fetching formularios paciente: undefined`). **Nuevo en staging** (en dev se ve el 422, no este 404).
- ✅ El indicador "sin guardar" (triángulo) de Lab/Procedimientos **NO se reproduce en staging** (en dev sí). Resto del flujo sólido.
- 📄 Reporte: `Reporte_QA_Consulta_Staging_2026-06-25.pdf` (raíz).

### 🔁 Actualización 2026-07-14 — porteo del fix de wizard + rediseño de Ingresos verificado en staging

Una sesión anterior (2026-07-09/10) ya había adaptado `Mediplanner Staging/e2e/utils.js` y los specs de `Tests_Staging/` al mismo rediseño de UI que se arregló en dev (wizard "Agendar cita" → "Confirmar cita" sin modal OK; calendario nuevo del Dashboard; dashboard de Ingresos con `rdt_TableRow`/"Registrar pago"), pero esos cambios habían quedado **sin commitear** y sin correr contra staging real. Hoy se corrieron ambas suites contra staging para confirmarlos:

- **`doctor-consultation`: 2/2 pasan (3.1m).** Cita creada + consulta completa (signos vitales → exploración → diagnóstico → tratamiento → laboratorios → notas → servicios → finalización) de punta a punta. Confirma el 404 `getFilledForm` de arriba; el indicador "sin guardar" de Laboratorios sigue sin reproducirse.
- **`ingresos`: 3/3 pasan (1.1m).** Conteo de pendientes/pagados correcto con los selectores nuevos. El paso "Registrar pago" **no llegó a ejecutarse de punta a punta**: los 2 ingresos pendientes del ciclo resultaron "ya pagados" al abrir el detalle (mismo síntoma de flakiness ya documentado en dev — no es bug del test).
- Se corrigió además un detalle del propio código de **dev** descubierto al portar: `irADiaEnCalendarioDashboard()` usaba `.first()` del botón "siguiente mes" (hay 2 en el DOM, el primero es decorativo) y el loop de días arrancaba en `dayOffset=1` asumiendo que "hoy" ya estaba visible. Corregido en ambos entornos.
- **Commiteado:** `807fe43` (fix de calendario en dev) y `62e285c` (porteo completo a staging).

**Plan ejecutado para generar un adeudo real:** se corrió `doctor-consultation` una 2ª vez (paciente Percentil Prueba Prueba, misma corrida ✅ 2/2) específicamente para dejar un nuevo cargo pendiente, y se corrió `ingresos` a continuación para procesarlo. Confirmado manualmente por Pedro (captura de la pantalla real de Ingresos en staging): sí hay adeudos reales sin pagar (2× $1,800.00, estatus "Pendiente", método "-") y el ícono del ojo lleva a su detalle — coincide con lo que hace `eyeButton` en el spec.

### 🐛 Hallazgo nuevo — `DetallePagos` crashea con TypeError cuando el paciente no tiene datos fiscales (probable causa real del falso "ya pagado")

En **todas** las corridas de `ingresos` (dev y staging, incluidas las de hoy) el paso "Registrar pago" reporta "ingreso ya pagado" — pero el ingreso está confirmado **sin pagar** (ver arriba). Al repetir la corrida contra staging con 3 pendientes reales, el monitor de DevTools capturó, justo cuando `POST /api/invoices/getFiscalData` respondió `{"status":"OK","data":[]}` (vacío) para el paciente "Percentil Prueba Prueba":

```
🔴 [DEVTOOLS ERROR +49.88s] Error: TypeError: Cannot read properties of undefined (reading 'cp')
    at Se (https://admin-staging.mediplanner.mx/assets/DetallePagos-dmoyFA51.js:1:2683)
```

Hipótesis: el componente de Detalle de pagos asume que `getFiscalData` siempre devuelve al menos un registro y lee `.cp` (código postal) de él sin chequear `undefined`; cuando el paciente no tiene datos fiscales capturados, el componente crashea y el botón "Registrar pago" nunca se renderiza. **Esto explica una parte de los falsos "ya pagado" (es intermitente, no reproduce siempre), pero no toda la historia** — ver corrección abajo.

**Pendiente:** reportar a devs `DetallePagos` no maneja `getFiscalData` vacío (TypeError `reading 'cp'`) → oculta el botón "Registrar pago" en cargos legítimamente pendientes, cuando reproduce.

### 🔍 Corrección — el flujo real de "Registrar pago" tiene selección de CONCEPTO (no un formulario directo de 1 cargo)

Pedro confirmó con una captura real de staging que el botón "Registrar pago" SÍ aparece con normalidad en ingresos con adeudo real, y que al hacer clic te lleva a un formulario con: radios de **Concepto** (uno por cada cargo del ingreso — ej. "Consulta General" + "Certificado Médico", cada uno con su propio monto pendiente), un campo **Monto** (prellenado al máximo del concepto elegido), tarjetas-botón de **Método de pago** (Efectivo/Transferencia/Tarjeta…) y un botón final **Registrar pago** que **paga solo el concepto seleccionado**. Para saldar un ingreso con varios cargos hay que repetir el envío una vez por concepto; solo cuando ya no queda ninguno con saldo desaparece el botón "Registrar pago".

Explorando esto de punta a punta contra staging (pagando de verdad un ingreso real de $1,800 = Consulta General $1,500 + Certificado Médico $300, en dos pagos con métodos distintos) se confirmó: `POST /api/payments/registerPayment → 200 "Pago registrado correctamente"` por cada concepto; el ingreso terminó con `Pagado: $1,800.00 / Adeudo: $0.00` y status **"Pagado"** en el historial; el botón queda momentáneamente en estado "Registrando…" (deshabilitado) durante el request — leer el DOM en ese instante hace ver "no hay botón" en falso.

**Causa real de casi todos los falsos "ya pagado" en `ingresos.spec.ts` (dev y staging):** el spec nunca seleccionaba un concepto explícitamente (dependía del radio default) y no manejaba ingresos con 2+ cargos ni el estado "Registrando…", más un timeout de 8s insuficiente para que el detalle terminara de cargar. **Corregido y verificado (commit `bb480b8`):** nueva función `pagarConceptosPendientes()` que paga cada concepto con saldo > 0 uno por uno hasta saldar el ingreso; timeout del botón "Registrar pago" en el detalle subido a 12s; espera explícita a que "Registrando…" desaparezca antes de releer el formulario. El crash de `DetallePagos` (TypeError `reading 'cp'`) sigue existiendo como bug de plataforma aparte (reproduce solo con algunos ingresos, ver arriba) y el test lo tolera sin romperse.

---

## Decisiones abiertas / pendientes

- [x] ~~Commit + push de stress tests + config + fix facturacion~~ — hecho (commit `1bb9cd7`, pusheado a main/Trabajando/Normalization el 2026-06-17).
- [ ] Reportar a devs el bug 422 "relacion_id"/"campos obligatorios" — **sigue vivo, reconfirmado 2026-07-09** (ver sección de verificación abajo), aunque cambió de endpoint (`getFilteredAppointments`/`getAppointmentCount`, ya no `getFilledForm`). Sin evidencia de que se haya reportado.
- [x] ~~Reportar a devs: indicador "sin guardar" no se limpia en Tratamiento › Laboratorios y Procedimientos~~ — **no se reprodujo en 3 corridas del full-flow el 2026-07-09** (2 pacientes distintos). Probablemente arreglado; dejar de tratarlo como bug confirmado, pero sin cerrarlo del todo (ver sección de verificación).
- [x] ~~Arreglar fallback de `fillTabFields` en `e2e/utils.js`~~ — hecho: usa `load` en vez de networkidle, solo rellena campos obligatorios (`required`/`aria-required`), valores numéricos realistas por campo, log de resumen.
- [x] ~~Aplicar mejoras a Staging/Producción: propagar `scanResidualIndicators` y el fix de guardado de Exploración~~ — **hecho.** Verificado en código: `scanResidualIndicators` está en `Mediplanner Staging/e2e/utils.js` y `Mediplanner produccion/e2e/utils.js`; el fix de Exploración (`fillExplorationSection`, guarda una vez al final) está en los 3 `consultation.full-flow.spec.js` (dev/staging/producción).
- [ ] **Reportar a devs (staging):** 422 `getFilledForm` "relacion_id es requerido" (ya está en staging) y 404 `getFilledForm` "No se encontró el formulario asignado al paciente" al finalizar consulta (nuevo en staging). Ver sección STAGING + `Reporte_QA_Consulta_Staging_2026-06-25.pdf`. — sin evidencia de reporte.
- [x] ~~Ejecutar en staging `vacunacion-ciclo-completo` (destructivo) sobre `Pedro Quijada Anaya`~~ — **hecho** el 2026-06-25 (ver sección STAGING). También se ejecutó, sin haber quedado planeado aquí, en **producción** sobre Agustin Tapia el 2026-06-29 — confirmar con Pedro si fue intencional.

---

## 🔧 Fix selector de Pacientes + limpieza de archivos muertos — 2026-07-21

**⚠️ Fix de seguridad — sesión de producción destrackeada.** `Mediplanner produccion/storageState.json` estaba **trackeado en git** desde el commit `7732ff7` (2026-06-15), pese a que `.gitignore` tiene `**/storageState.json` (esa regla se agregó después y nunca se hizo el `git rm --cached` correspondiente). Contenía cookies/tokens de sesión reales de producción, expuestos en el historial de GitHub. Se hizo `git rm --cached` (el archivo local NO se tocó, sigue existiendo para correr tests). **Pendiente:** evaluar si conviene invalidar/rotar esa sesión dado que ya estuvo expuesta en el historial remoto (el `git rm --cached` no borra el commit viejo donde ya se subió).

**Archivos muertos eliminados del repo** (`git rm`, sin reemplazo — ya no se usaban, `.bak`/`.backup` no son recogidos por Playwright):
- `playwright.config.ts.bak` (versión TS vieja del config, superada por `playwright.config.js`).
- `tests/consultation.start.spec.js.backup` y `Mediplanner produccion/Tests_Produccion/consultation.start.spec.js.backup` (versión pre-rediseño de la consulta, superada por `consultation.full-flow.spec.js`).
- `tests_copy.bat` (script de porteo dev→producción vía robocopy) se mantiene, sigue en uso.

**Selector roto de la lista de Pacientes — CONFIRMADO Y CORREGIDO.** Documentado desde el 2026-07-07 (bloqueaba 7 specs). Se inspeccionó el DOM real de `/Pacientes` en dev con un script Playwright puntual (sesión ya autenticada vía `storageState.json`): el nombre del paciente pasó de `<a class="font-semibold text-sm text-gray-900">` a `<span class="font-semibold text-sm text-gray-900 hover:text-primary truncate">` dentro de una celda de `react-data-table-component` (`div.rdt_TableRow` → celda con `data-tag="allowRowEvents"`). Se verificó en vivo que un click en ese `<span>` sigue navegando al detalle del paciente (el evento hace bubbling hasta el handler del row). Corregido el selector (`a.font-semibold...` → `span.font-semibold...`) en los 7 archivos afectados:
- `tests/recetas.explorar.spec.ts`, `tests/recetas.spec.ts`
- `tests/stress tests/antecedentes.stress.test.ts`, `tests/stress tests/facturacion.stress.test.ts`, `tests/stress tests/pacientes.stress.test.ts`
- `tests/vacunacion.ciclo-completo.spec.ts`, `tests/vacunacion.explorar.spec.ts`

✅ **Verificado con 2 corridas reales contra dev tras el fix:**
- `stress-facturacion`: **2 passed**, 0 responses con error de API — por primera vez en semanas la suite llega hasta el formulario de Facturación. **No se observó el 422 `relacion_id`/"campos obligatorios"** en esta corrida (ni `getFilledForm` ni ningún 4xx). Nota: no es la misma ruta donde se documentó originalmente el bug (ese se vio en `getFilteredAppointments`/`getAppointmentCount` durante `doctor-consultation`) — no se puede dar por cerrado con una sola corrida en esta pantalla, pero es la primera vez que se puede validar Facturación directamente.
- `vacunacion-explorar`: **2 passed**, 0 responses con error de API — confirma que el fix generaliza a otro spec (no solo facturación).

**Pendiente:** correr los 5 specs restantes afectados (`recetas.explorar`, `recetas`, `antecedentes` stress, `pacientes` stress, `vacunacion-ciclo-completo` — este último es destructivo) para terminar de confirmar el fix en toda la superficie. Re-verificar el bug 422 con 2-3 corridas más de `doctor-consultation` antes de considerarlo resuelto/no reproducido.

---

## 🔍 Verificación de pendientes — 2026-07-07

Sesión dedicada a comparar este documento contra el estado real del código y de la app (dev), analizando código + corriendo automatizaciones. Resumen arriba (items tachados); dos hallazgos nuevos:

1. ~~**🐛 Selector roto en la lista de Pacientes (bloquea validar el bug de facturación por automatización).**~~ — **corregido el 2026-07-21**, ver sección "🔧 Fix selector de Pacientes" arriba. Corrí `stress-facturacion` 2 veces contra dev — ambas fallaron **en el mismo punto exacto**, antes de llegar siquiera al formulario de Facturación: `page.waitForSelector('a.font-semibold.text-sm.text-gray-900')` agota el timeout de 25s. El screenshot del fallo muestra la lista de Pacientes cargada correctamente (35 pacientes, paginado bien) — pero el snapshot de accesibilidad confirma que el nombre del paciente **ya no es un `<a>`**, es un `<div>` (`generic [cursor=pointer]`). La app cambió la estructura de esa celda. Esto rompía el selector en **7 specs**: `recetas.explorar.spec.ts`, `recetas.spec.ts`, `tests/stress tests/antecedentes.stress.test.ts`, `tests/stress tests/facturacion.stress.test.ts`, `vacunacion.ciclo-completo.spec.ts`, `vacunacion.explorar.spec.ts`, `tests/stress tests/pacientes.stress.test.ts`.
2. **Ejecución de `vacunacion-ciclo-completo` en producción no documentada** (ver checklist arriba) — screenshots del 2026-06-29 muestran que corrió sobre Agustin Tapia en `Mediplanner produccion/`. Vale confirmar con Pedro si fue una corrida intencional o quedó pendiente de revisar el resultado.

---

## 🐛 Wizard de "Agendar cita" roto + fix, paciente parametrizable — 2026-07-09

Se quiso correr `doctor-consultation` (full-flow) contra dev con la paciente **Carla Perez Rojas** (no la default). Para eso, `tests/consultation.full-flow.spec.js` ahora soporta `PACIENTE_NOMBRE`/`PACIENTE_BUSQUEDA` por variable de entorno (mismo patrón que `PERCENTIL_RUN`); sin esas variables sigue usando el default `Percentil Prueba Prueba`.

Al correrlo, aparecieron **2 selectores rotos por un cambio de UI en el wizard de "Agendar cita"** — bloqueaban CUALQUIER corrida del full-flow (no es algo específico de Carla):

1. **Contenedor del wizard** (`e2e/utils.js` línea ~319): perdió sus clases Tailwind `bg-white shadow-md rounded p-5` (ya no existen en el DOM). Fix: ubicarlo por el heading "Agendar cita" (estable) + el ancestro más cercano que contenga un input (`xpath=ancestor::div[.//input][1]`), en vez de fijar otro set de clases que puede volver a romperse con un rediseño.
2. **Botón de confirmación final se renombró de "Agendar cita" a "Confirmar cita"**, y ya no aparece un modal "OK" después — la app navega directo a la pantalla de éxito "¡Cita agendada!". Este era el bug real que rompía el flujo: el código esperaba 15s un botón que ya no existe, fallaba, y el `catch` pasaba al siguiente día del loop de fechas — pero como el step 3 (fecha) queda colapsado tras avanzar al step 4 (confirmación), el input de fecha ya no es visible y todos los días siguientes fallan igual con "element is not visible", hasta agotar el loop y tirar "No se pudo registrar una cita en los próximos 5 días" (aun cuando a veces una cita SÍ llegaba a crearse a medias).

✅ **Corrida completa verificada tras el fix:** `2 passed (3.2m)` para Carla Perez Rojas en dev — cita agendada, consulta completa (signos vitales, exploración, tratamiento, notas, servicios, finalización). Los 3 errores 422 del resumen del DevTools monitor (`getFilteredAppointments`, `getAppointmentCount`, `setProceduresConsultation`) son el bug de plataforma ya conocido (`relacion_id`/campos obligatorios, ver hallazgo de QA arriba), no relacionados con este fix.

**Pendiente:** no se volvió a correr el full-flow para el paciente default (`Percentil Prueba Prueba`) tras este fix — sería bueno confirmar que también sigue pasando.

---

## 🐛 Rediseño de Ingresos + adaptación de `ingresos.spec.ts` — 2026-07-09

La pantalla de **Ingresos** cambió por completo: pasó de una tabla simple con filtro de estatus a un **dashboard** con tarjetas resumen (Citas del período, Total del período, Total cobrado), un panel "Filtrar registros" (Paciente, Consultorio, Estatus, Periodo) y un "Historial de ingresos" ahora renderizado con **react-data-table-component** (clases `rdt_Table`/`rdt_TableRow`/`rdt_TableCell`, no una `<table>` nativa). El flujo de registrar un pago también cambió de raíz. Se adaptó `tests/ingresos.spec.ts` en consecuencia:

1. **Selectores rotos por el rediseño:**
   - `select#estatus` perdió su `id` → ahora solo `select[name="estatus"]`.
   - El botón de filtro sin texto (identificado por clases CSS) ahora es un botón **"Buscar"** con nombre accesible propio.
   - El locator de filas (`'tr, [class*="row"]'`) matcheaba de más — cualquier div con "row" en la clase, no solo filas reales — e inflaba los conteos. Se cambió a `.rdt_TableRow` (clase estable de la librería de tabla).
   - El ícono de "Ver" (ojo) vive dentro de un `<button class="menu-link">` real; `.locator('..')` (un solo nivel) caía en un `<span>` intermedio, no el botón. Se sube por `xpath=ancestor::button[1]`.
2. **Flujo de pago simplificado — pasos "Abonar" y "Seleccionar concepto" ya NO EXISTEN:** el detalle del ingreso muestra directo el único cargo pendiente y un botón **"Registrar pago"** que lleva al formulario (monto prellenado con el adeudo + botones de método de pago, ya no radios). El endpoint sigue siendo `POST /api/payments/registerPayment` (sin cambios) y ya **no hay modal "OK"** de confirmación — navega directo de vuelta a "Detalle de ingreso" mostrando el cargo como Pagado.
3. **"Paypal" ya no es una opción** de método de pago (quedan: Efectivo, Transferencia, Tarjeta de crédito, Tarjeta de débito) — se quitó de `METODOS_PAGO`.
4. **Timing:** el conteo de "Contar estados de ingresos" corría antes de que la tabla terminara de cargar (carrera con la petición `getFiltered` inicial), dando 0/0 aunque había datos reales. Se agregó un `waitForResponse('getFiltered')` dentro de `navegarAIngresos`.

✅ **Verificado en vivo:** conteo real correcto (3 pendientes / 2 pagados en una corrida), y el flujo completo de registrar pago (abrir detalle → "Registrar pago" → elegir método → confirmar) se probó manualmente de punta a punta con éxito (`POST registerPayment → 200`, el cargo pasa a Pagado). En las corridas del spec oficial, la fila que le tocaba procesar en el ciclo resultó "ya pagada" al abrir el detalle un par de veces seguidas — se investigó y **no es un bug del test ni de la app**, es la flakiness ya conocida del entorno dev (ver hallazgo de QA arriba): la misma fila, reintentada momentos después, sí mostró "Registrar pago" con normalidad. El test ahora maneja ese caso sin romperse (loggea y salta al siguiente ciclo en vez de fallar a ciegas contra la pantalla equivocada).

**Pendiente:** no quedó una corrida del spec oficial que registrara un pago real de punta a punta (las 2 corridas de "Registrar ingreso pendiente" cayeron en el caso "ya pagado" por la flakiness mencionada) — solo se confirmó ese camino feliz con un script manual. Vale la pena volver a correrlo cuando el entorno esté menos cargado para verlo pasar por el camino completo dentro del spec mismo.

---

## 🔍 Re-verificación de los 2 bugs de plataforma pendientes — 2026-07-09

Se corrieron pruebas reales contra dev para confirmar si los 2 bugs de plataforma documentados hace semanas seguían vivos.

**1. 422 "relacion_id"/"campos obligatorios" — SIGUE VIVO, pero cambió de endpoint.** Se reprodujo en las 3 corridas de hoy (`doctor-consultation` ×2, más las corridas de ayer): `POST /api/appointments/getFilteredAppointments` y `POST /api/appointments/getAppointmentCount` responden **422** `{"status":"ERROR","message":"Verifica que los campos obligatorios no estén vacíos"}`. Ya no se vio en `getFilledForm` (donde estaba documentado originalmente) — es el mismo bug de fondo, pero manifestándose en otros endpoints de listado. No se pudo confirmar puntualmente en la pantalla de **Facturación** porque el selector roto de Pacientes (ver hallazgo del 2026-07-07, sigue exactamente igual) bloquea `stress-facturacion` antes de llegar ahí.

**2. Indicador "sin guardar" en Laboratorios y Procedimientos — NO SE REPRODUJO.** Se corrió el full-flow 3 veces (Carla Perez Rojas + paciente default `Percentil Prueba Prueba` ×2); las 3 veces Laboratorios guardó 200 OK (`setProceduresConsultation`) y el escaneo de indicadores residuales (`scanResidualIndicators`) reportó limpio: *"Ningún apartado conservó el triángulo tras guardar."* Con 3/3 corridas limpias, es razonable asumir que **ya lo arreglaron** — se baja de "confirmado pendiente" a "no reproduce". No cerrar del todo el hallazgo original (queda documentado arriba) por si vuelve a aparecer.

**Pendiente:** arreglar el selector roto de Pacientes (`a.font-semibold.text-sm.text-gray-900` → ahora `<div>`) en los 7 specs afectados para poder validar el bug 1 directamente en Facturación.
