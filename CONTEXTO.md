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
- Navegador: **Chromium 1223** (ruta fija en config: `…/ms-playwright/chromium-1223/chrome-win64/chrome.exe`)
- `playwright.config.js`: solo Chromium, viewport **1366x768**, `headless: false`, `workers: 1` (serial)
- Archivos locales **NO versionados** y necesarios para correr: `.env` (BASE_URL + credenciales) y `storageState.json` (sesión auth)

---

## Estado actual (git)

- Último commit en `Normalization`: `564cb92` — *test(ingresos): arreglar timeouts de networkidle y desacoplar de consulta* (ya en remoto).
- **Cambios SIN commitear** en el working tree:
  - Los **9 stress tests** de `tests/stress tests/` (mejoras: ver abajo)
  - `playwright.config.js` (proyectos nuevos + rename de proyecto huérfano)
  - Fix de `facturacion.stress.test.ts` (opción B, ver abajo)
  - *(excluidos a propósito:* `storageState.json` = solo refresco de sesión; `MediplannerAppiumAutomation/` = repo aparte)*

> ⚠️ **Para reproducir el estado en otra computadora hay que commitear y pushear estos cambios** (o llevarlos por patch). Con solo este documento, la otra máquina tendrá el contexto pero NO el código nuevo de los stress tests.

---

## En qué estamos trabajando (historia reciente)

1. **Ya commiteado y pusheado (`564cb92`)**
   - Fix `waitForLoadState('networkidle')` → esperas específicas en `ingresos.spec.ts` (el `networkidle` nunca se cumplía porque GA/Zendesk/Clarity mantienen la red activa).
   - `ingresos` desacoplado de `doctor-consultation` (depende solo de `setup`): correr ingresos ya no corre la consulta primero (1.8m vs 5.3m).
   - Rename `Consultation.stress.test.spec.ts` → `consultation.inputs-validation.spec.ts`.

2. **Mejoras a los 9 stress tests (SIN commitear)** — `tests/stress tests/`
   - A los 9: fix `networkidle`→`load` + `setupConsoleMonitor(page)` + `printSummary()`.
   - Bug corregido en `pacientes.stress.test.ts`: `formInputs` → `allInputs` (ReferenceError).
   - `playwright.config.js`: agregados proyectos **`stress-antecedentes`** y **`stress-diagnosticos`** (no existían, esos 2 no se podían correr); proyecto huérfano `stress-test` (apuntaba al archivo renombrado) → **`consultation-inputs-validation`**.
   - **Suite completa corrida en serie: 8/9 pasan.** Solo falla `facturacion` (determinista, por un bug de la app — ver abajo).

3. **`facturacion.stress.test.ts` — opción B aplicada (SIN commitear)**
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
```

**Proyectos de stress disponibles:** `stress-login`, `stress-citas`, `stress-pacientes`, `stress-ingresos`, `stress-informacion-paciente`, `stress-facturacion`, `stress-vacunacion`, `stress-antecedentes`, `stress-diagnosticos`.

**Modo de corrida (preferencia):** test puntual que se quiere observar → primer plano (foreground, el navegador se abre por `headless:false`). Suite larga → background.

---

## Setup para reproducir en otra computadora

1. Instalar **Node 24.x** y **git** (y opcionalmente **GitHub CLI `gh`** — no está instalado en la PC principal).
2. `git clone https://github.com/PedroAndresQA6/MediplannerWebNuevo.git` y `git checkout Normalization`.
3. `npm install`.
4. `npx playwright install chromium` — y verificar que la versión de Chromium coincida con la ruta del config (`chromium-1223`); si difiere, ajustar `executablePath` en `playwright.config.js`.
5. Crear **`.env`** localmente (BASE_URL + credenciales) — **no está en git**, pedírselo a Pedro / copiarlo de la PC principal.
6. `storageState.json` se regenera solo al correr el proyecto `setup` (auth), o copiarlo de la PC principal.
7. (Si los cambios de stress tests aún no están en `Normalization`) hacer `git pull` después de que se hayan pusheado.

---

## Repos separados (importante)

`MediplannerAppiumAutomation/` (dentro de la carpeta de MediplannerWebNuevo) es **su PROPIO repo git independiente**, con su remote: https://github.com/PedroAndresQA6/MediplannerAppiumAutomation — **NO fusionarlo** dentro de WebNuevo. Es un framework Appium/pytest para la app móvil Android (POM: `pages/`, `tests/`, `conftest.py`). Rama local `WorkinProgress` (sin upstream; la remota es `WorkInProgress` con I mayúscula).

---

## Decisiones abiertas / pendientes

- [ ] **Commit + push** de los cambios de stress tests + `playwright.config.js` + fix facturacion a `Normalization` (pendiente de decisión de Pedro).
- [ ] Reportar a devs el bug `getFilledForm` 422 "relacion_id es requerido".
- [ ] (Baja prioridad) Arreglar fallback de `fillTabFields` en `e2e/utils.js` (llena inputs visibles con "N/A"/"70", puede sobreescribir datos correctos).
- [ ] Aplicar mejoras (monitor / esperas) a los tests de Staging y Producción (aún con código viejo).
