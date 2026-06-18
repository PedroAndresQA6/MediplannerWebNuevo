# CONTEXTO — MediplannerWebNuevo

> **Qué es este archivo:** documento vivo de contexto del proyecto. Sirve para (a) comunicar en qué estamos trabajando y (b) poner al tanto a una sesión nueva de Claude Code (en esta u otra computadora). **Mantenerlo actualizado y commitearlo** cada vez que cambie el estado del trabajo.
>
> **Última actualización:** 2026-06-17

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

- **Trabajo más reciente:** automatización consolidada de **Vacunación (UI nueva)** + mapper + proyectos en config + fix de Chromium portable (ver `git log` para el hash más reciente).
- Commits clave previos: `1bb9cd7` (9 stress tests + monitor + facturacion opción B), más `feat(consultation)` y `test(vacunacion)` que llegaron del otro equipo.
- Se mantiene sincronizado en las **3 ramas** (`main`, `Trabajando`, `Normalization`) — apuntan al mismo commit.
- *(excluidos de git a propósito:* `storageState.json` = refresco de sesión; cambio local de `PW_CHROMIUM_PATH` en `.env` = ruta de esta máquina; `MediplannerAppiumAutomation/` = repo aparte)*

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
- [ ] Subir `MAX_DOSES` (actual 6 → 999) para registrar **TODAS** las dosis (lo pidió Pedro; iba a hacerse cuando se pausó).
- [ ] Completar borrado + verificación real de filas **"otra vacuna"** (al iniciar solo había plantillas vacías; mi corrida dejó una guardada, así que la próxima ya puede probar el borrado). Ajustar el selector del × rojo (`button[class*="hover:text-red"]`).
- [ ] Borrar los 3 tests viejos de vacunación (UI muerta) y su(s) proyecto(s) en el config.

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

## Repos separados (importante)

`MediplannerAppiumAutomation/` (dentro de la carpeta de MediplannerWebNuevo) es **su PROPIO repo git independiente**, con su remote: https://github.com/PedroAndresQA6/MediplannerAppiumAutomation — **NO fusionarlo** dentro de WebNuevo. Es un framework Appium/pytest para la app móvil Android (POM: `pages/`, `tests/`, `conftest.py`). Rama local `WorkinProgress` (sin upstream; la remota es `WorkInProgress` con I mayúscula).

---

## Decisiones abiertas / pendientes

- [x] ~~Commit + push de stress tests + config + fix facturacion~~ — hecho (commit `1bb9cd7`, pusheado a main/Trabajando/Normalization el 2026-06-17).
- [ ] Reportar a devs el bug `getFilledForm` 422 "relacion_id es requerido".
- [ ] **Reportar a devs:** indicador "sin guardar" no se limpia en **Tratamiento › Laboratorios y Procedimientos** (guarda 200 OK pero el triángulo se queda). Ver sección de hallazgos.
- [x] ~~Arreglar fallback de `fillTabFields` en `e2e/utils.js`~~ — hecho: usa `load` en vez de networkidle, solo rellena campos obligatorios (`required`/`aria-required`), valores numéricos realistas por campo, log de resumen.
- [~] Aplicar mejoras a Staging/Producción: **monitor DevTools ya agregado** (`setupConsoleMonitor`) a ambos `consultation.start.spec.js`. **Pendiente:** propagar el detector del indicador (`scanResidualIndicators`) y el fix de guardado de Exploración a Staging/Prod.
