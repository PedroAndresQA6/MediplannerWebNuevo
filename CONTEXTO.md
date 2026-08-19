# CONTEXTO — MediplannerWebNuevo

> **Qué es este archivo:** documento vivo de contexto del proyecto. Sirve para (a) comunicar en qué estamos trabajando y (b) poner al tanto a una sesión nueva de Claude Code (en esta u otra computadora). **Mantenerlo actualizado y commitearlo** cada vez que cambie el estado del trabajo. Este documento se limpió a fondo el 2026-08-18 (a pedido de Pedro): lo viejo/resuelto quedó condensado en "Histórico resuelto" al final; acá arriba solo queda lo activo o accionable.
>
> **Última actualización:** 2026-08-18. Sesión larga, 3 frentes (el más reciente primero):
> 1. **Plan de 26 proyectos — Fase 0 + Batch 1 completo (12/12)**, corrido con un subagente "observador" por proyecto. 2 bugs de app nuevos confirmados (CSP bloquea Microsoft Clarity y `cdnjs.cloudflare.com`; `saveService` a veces no persiste el servicio creado — falso registro), 2 bugs de test arreglados y verificados (`reportes.spec.ts`, `percentil.explorar.spec.js`), 1 parcial (`subir-estudios.spec.ts`). Detalle en "🗺️ Plan: corrida completa de la suite dev con observador". **Pendiente: retomar desde Batch 2** (`appointments-create`).
> 2. **A pedido de Pedro: nuevo spec `consultation.tipos-consulta.spec.ts`** — prueba los 3 tipos reales de consulta (Completa/Exprés/Exprés Médico) llenando todo y verificando campo por campo contra la API. Confirmó que los signos vitales SÍ rechazan letras, pero encontró 2 bugs reales: sin validación de rango fisiológico, y un cruce de datos entre Tratamiento y Notas del Médico (2/2 en Exprés/Exprés Médico). Detalle en "🐛 Hallazgos nuevos durante la corrida del plan".
> 3. **Porteo de `consultation.full-flow.spec.js` a Staging/Producción** — Staging confirmado funcionando end-to-end; Producción con el fix del wizard aplicado pero bloqueado por credenciales pendientes de Pedro. Detalle en "🎯 Staging/Producción" abajo.
>
> Todo lo de hoy está commiteado y pusheado a `origin/claude/test-consulta-staging-9b8e3c`.

---

## 🟢 Prompt para una sesión nueva (copiar/pegar)

```
Lee CONTEXTO.md en la raíz del repo MediplannerWebNuevo y ponte al tanto del estado
del proyecto. Soy Pedro, Test Automation Tester (no developer); los tests son mi
responsabilidad. Trabajamos en español. Continúa desde "Decisiones abiertas" y el
plan marcado "SIN TERMINAR" ("🗺️ Plan: corrida completa de la suite dev con
observador") — retómalo desde la tabla de progreso en vez de re-planear. Antes de
correr tests confirma que tengo .env y storageState.json localmente (no están en
git) — aunque hay credenciales default hardcodeadas en cada *.setup.ts si no hay .env.
```

---

## 🎯 Staging/Producción: porteo de `consultation.full-flow.spec.js` (Producción bloqueada, retomar aquí ⏸️)

Contexto: `consultation.full-flow.spec.js` se reescribió en dev el 2026-07-23 para el nuevo "Modo Completo" de Consulta (commit `a1a1486`), pendiente portar a Staging/Producción.

### Staging — CONFIRMADO Y VERIFICADO ✅
- `tests/consultation.full-flow.spec.js` copiado sin tocar selectores a `Mediplanner Staging/Tests_Staging/` (backup del spec viejo en la misma carpeta). Staging **ya tiene el mismo "Modo Completo"** — no necesitó ajustes.
- Flujo completo punta a punta contra staging real: signos vitales → 10 secciones → guardado por sección → guardado global (7 endpoints) → "Finalizar Consulta" — **todos 200 OK**.
- El único "failed" es ruido ya investigado a fondo con Playwright+CDP: `404 POST /api/wizard/getActiveStep`, se dispara en TODA carga de `/Dashboard`, sin relación con Consulta. Decisión de Pedro: dejar el test así, no whitelistear ese endpoint.
- Commiteado: `b261184`.

### Producción — BLOQUEADA A MEDIAS, retomar aquí ⏸️
- Mismo procedimiento de porteo (`Mediplanner produccion/Tests_Produccion/`). Login con `dr@rym-solutions.com` funciona bien contra `https://admin.mediplanner.mx/`.
- **Bug de test real encontrado y corregido:** `Mediplanner produccion/e2e/utils.js` nunca había recibido el fix del wizard "Agendar cita" (ver "Referencia: wizard 'Agendar cita'" más abajo) — bloqueaba `createAppointment()` desde el primer paso. Ya corregido y verificado (llega hasta la búsqueda de paciente). Commiteado: `47a2716`.
- **Bloqueado en:** el paciente pedido, "Pedro Pruebas Rym Solutions", pertenece a otra cuenta (`pedro.quijada229217@potros.itson.edu.mx`), no a `dr@rym-solutions.com`. Esa credencial la compartió Pedro por screenshot — **nunca se ingresó ni se manejó**, por regla de seguridad.
- **Para retomar:** Pedro debe correr él mismo, desde `Mediplanner produccion/`:
  ```powershell
  $env:MEDIPLANNER_EMAIL='pedro.quijada229217@potros.itson.edu.mx'; $env:MEDIPLANNER_PASSWORD='@RyM2026'; npx playwright test --project=setup
  ```
  Luego, con `storageState.json` de esa cuenta ya generado:
  ```powershell
  $env:PACIENTE_NOMBRE='Pedro Pruebas Rym Solutions'; $env:PACIENTE_BUSQUEDA='Pedro Pruebas'; npx playwright test --project=doctor-consultation
  ```
  No hace falta repetir el fix del wizard, ya está aplicado y commiteado en `e2e/utils.js`.

---

## 🗺️ Plan: corrida completa de la suite dev con observador — SIN TERMINAR (Batch 1 de 4 completo)

**Objetivo:** correr los 26 proyectos de `playwright.config.js` (raíz, dev) contra `https://admin-dev.mediplanner.mx/`, con un subagente "observador" por corrida (recibe SOLO el output crudo, sin el resto de la conversación) que clasifica cada resultado antes de avanzar — para no perder bugs reales diluidos en el volumen, ni re-reportar ruido ya conocido.

### Fase 0 — Prerrequisitos ✅ (hecho)
`npm install` al día · Chromium en caché · `.env` no hizo falta (credenciales default de `auth.setup.ts`) · `storageState.json` generado.

### Los 26 proyectos, agrupados por riesgo
- **Batch 1** (exploratorios/read-only, bajo riesgo) — ✅ **12/12 completo**: `system-health`, `dashboard-explorar`, `dashboard`, `reportes-explorar`, `reportes`, `ajustes-explorar`, `ajustes-servicios`, `percentil-explorar`, `recetas-explorar`, `recetas`, `vacunacion-explorar`, `subir-estudios`.
- **Batch 2** (flujo de citas/consulta, mutación moderada): `appointments-create`, `doctor-consultation`, `consultation-inputs-validation` (🟡 corrido, ver hallazgos), `ingresos`.
- **Batch 3** (nunca corrido, se esperan selectores rotos): `consultation-user-errors` (6 tests de "error guessing", escritos 2026-07-21, nunca ejecutados contra dev — paciente `Daniela Jiménez Durán`).
- **Batch 4** (stress — cobertura exhaustiva de formularios, no load testing): `stress-citas`, `stress-pacientes`, `stress-ingresos`, `stress-login`, `stress-informacion-paciente`, `stress-facturacion`, `stress-antecedentes`, `stress-diagnosticos`. ⚠️ Antes de correr: confirmar caso por caso que ninguno crea cantidad desproporcionada de registros basura (parece que no, pero no verificado a fondo).
- **Checkpoint manual, NO incluir en un batch automático:** `vacunacion-ciclo-completo` — **destructivo** (borra y re-registra TODAS las dosis de un paciente real de dev, ~10 min). Requiere confirmación explícita de Pedro antes de correrlo.

### El loop "correr → observar → actuar"
1. `npx playwright test --project=<nombre>`.
2. Delegar a un subagente observador **solo** el output crudo (stdout + resumen del monitor + screenshot si falló), pidiendo veredicto: **PASA LIMPIO** / **PASA CON RUIDO CONOCIDO** / **BUG DE TEST** (con fix propuesto) / **BUG DE APP** (documentar, no tocar código de la app).
3. Bug de test → arreglar → re-correr ese proyecto → confirmar limpio. Bug de app → documentar en este archivo, seguir con el resto. Ruido conocido → anotar y seguir.
4. Actualizar la tabla de progreso antes de pasar al siguiente — así una sesión cortada retoma exactamente donde quedó.

### Ruido conocido (no reportar de nuevo)
- `net::ERR_ABORTED` en `google-analytics.com` y `mediplanner-atencion.zendesk.com` — beacons de analytics/chat.
- `404 POST /api/wizard/getActiveStep` — se dispara en cualquier carga de `/Dashboard`, causa raíz confirmada (ver sección Staging arriba).
- CSP bloquea Microsoft Clarity — confirmado bug de app esta sesión, ver hallazgos abajo (no volver a reportar como "nuevo").
- Bug 422 `relacion_id`/"campos obligatorios" en dev — no reproduce (3/3 limpias). Detalle en Histórico.
- Indicador "sin guardar" en Laboratorios y Procedimientos — no reproduce en dev; **sigue confirmado como bug real en Staging**.

### Tabla de progreso

| # | Proyecto | Batch | Estado | Notas |
|---|----------|-------|--------|-------|
| 0 | setup | Fase 0 | ✅ | storageState.json generado |
| 1 | system-health | 1 | 🐛 bug de app | CSP bloquea Clarity (script+beacon) |
| 2 | dashboard-explorar | 1 | ✅ ruido conocido | 4 passed, 0 hallazgos nuevos |
| 3 | dashboard | 1 | ✅ ruido conocido | 2 passed, KPIs/corte-de-hoy/agenda/estudios coinciden con API |
| 4 | reportes-explorar | 1 | ✅ ruido conocido | 2 passed, sin hallazgos |
| 5 | reportes | 1 | ✅ bug de test arreglado | 4 selectores/asunciones desactualizados, ver hallazgo abajo. Re-corrida: 2 passed |
| 6 | ajustes-explorar | 1 | ✅ ruido conocido | 9 passed (exploratorio) |
| 7 | ajustes-servicios | 1 | 🐛 bug de app confirmado | `saveService` a veces no persiste el servicio (falso registro), ver hallazgo abajo. Test queda en rojo a propósito |
| 8 | percentil-explorar | 1 | ✅ bug de test arreglado | Placeholder desactualizado. Re-corrida: 2 passed |
| 9 | recetas-explorar | 1 | ✅ ruido conocido | 2 passed, 12/12 APIs OK |
| 10 | recetas | 1 | ✅ ruido conocido | 2 passed, contador y paginación correctos |
| 11 | vacunacion-explorar | 1 | 🐛 bug de app (CSP) | 2 passed, 20/20 APIs OK. CSP bloquea `cdnjs.cloudflare.com`, ver hallazgo abajo |
| 12 | subir-estudios | 1 | 🟡 parcial | 3 bugs de test arreglados, ya no crashea, pero no llega a probar el upload real — gap de fondo, ver hallazgo abajo |
| 13 | appointments-create | 2 | ⬜ pendiente | |
| 14 | doctor-consultation | 2 | ⬜ pendiente | ya verificado limpio antes; re-confirmar sin regresión |
| 15 | consultation-inputs-validation | 2 | 🟡 corrido, 2 hallazgos | Letras SÍ se rechazan en signos vitales (7/7), pero sin validación de rango. Mitad del fuzzing del archivo es código muerto. Ver hallazgos abajo |
| 16 | ingresos | 2 | ⬜ pendiente | |
| 17 | consultation-user-errors | 3 | ⬜ pendiente | nunca corrido, esperar selectores rotos |
| 18-25 | stress-* (8 proyectos) | 4 | ⬜ pendiente | |
| — | vacunacion-ciclo-completo | checkpoint | ⬜ pendiente | requiere confirmación explícita de Pedro |

**Cómo retomar:** pegar el prompt de "sesión nueva". Seguir la tabla en orden desde la primera fila ⬜ (fila 13, `appointments-create`).

**Aceleración con `Workflow` (pipeline correr→observar→actuar):** solo si Pedro lo pide explícitamente en la sesión — no usar por defecto.

### 🐛 Hallazgos nuevos de esta sesión (2026-08-18)

**"Indicaciones Generales" de Tratamiento se guarda con el texto de "Notas del Médico" — cruce de datos entre editores, `consultation.tipos-consulta.spec.ts`.** En 2/2 corridas de "Consulta Express" y "Consulta Express Medico", el campo `indicaciones_general` (rich-text de Tratamiento) terminó guardado con el texto de "Notas del Médico". Se descartó activamente que fuera timing del test (verificación de relectura del DOM confirmó que el texto correcto SÍ estaba en pantalla antes de guardar, sin necesitar reintento). Apunta a un bug de la app: los editores de texto enriquecido de la página "Modo Completo" (Tratamiento/Laboratorios/Notas del Médico) parecen compartir o confundir estado al guardar. Alcance no confirmado del todo: 1/1 en "Consulta Completa" pasó limpio, pero un 2do intento de re-verificar chocó con ruido propio de la sesión (demasiadas citas de prueba ya creadas hoy), no con el bug. **Pendiente:** confirmar con una cuenta más limpia si es específico de Exprés/Exprés Médico. El test queda en rojo a propósito cuando esto reproduce — no se lo "arregla" para que pase.

**Signos vitales aceptan valores fuera de rango fisiológico — `consultation-inputs-validation` / `consultation-tipos-consulta`.** Buena noticia confirmada: las letras SÍ se rechazan correctamente en los 7 campos de signos vitales. Pero 6 de esos campos (todos menos Temperatura) aceptan valores médicamente imposibles sin ninguna advertencia: Peso=99999, Talla=999cm, Presión=999/999mmHg, FC=999lpm, Oxigenación=500% (máximo real 100%), FR=200rpm. Para reportar a devs: agregar validación de rango (min/max), no solo de tipo de dato.

**Gran parte del fuzzing de `consultation.inputs-validation.spec.ts` es código muerto, nunca se ejecuta.** El archivo (1993 líneas) tiene funciones bien construidas para probar XSS/SQLi (`runSectionValidation`) y validación numérica de medicamentos (`testMedicacionValidation`), pero el loop principal del test llama en cambio a versiones "solo llenar con datos válidos, sin tests". Resultado real: "0 protecciones ✅ | 0 vulnerabilidades ❌" — no porque todo esté seguro, sino porque no se probó nada. **Pendiente:** reconectar `runSectionValidation` (con selectores reales por sección) y `fillTreatmentSection`/`testMedicacionValidation` en el loop principal.

**`subir-estudios.spec.ts` — 3 bugs de test arreglados, gap real de fondo sin resolver.** Nunca se había corrido desde que se escribió. Arreglados: selector de Pacientes (a→span, era un 8vo archivo que se había quedado afuera del fix general), tab "Consultas" (a→button), lista de consultas (li→button, ahora por contenido de fecha en vez de clases), y un bug de control de flujo que crasheaba el test (`continue` seguía el for equivocado tras navegar de pantalla — corregido a `break`). **Pendiente real:** tras los fixes ya no crashea, pero nunca llega a probar el upload real — toda consulta "Terminada" resulta en "No se encontró pestaña Tratamiento", casi seguro el mismo síntoma del "Modo Completo" (ver Referencia técnica abajo) aplicado a la vista de detalle "Ver consulta". Requeriría una reescritura similar en alcance a la de `consultation.full-flow.spec.js` — fuera de alcance de esta sesión.

**`saveService` (catálogo de Servicios) reporta éxito pero a veces no persiste — falso registro confirmado, `ajustes-servicios`.** Investigado a fondo con 3 scripts Playwright standalone antes de concluirlo: `saveService → 200 "guardado correctamente"` con un ID nuevo válido, pero la siguiente llamada a `getServices` no incluye ese ID (reproducido 2/2 desmarcando "activo" antes de guardar). Con "activo" sin tocar, el servicio sí aparece pero queda persistido como `activo:false` de todas formas. El checkbox "activo" del modal "Nuevo Tipo" está roto de algún modo. Es un bug real de la app, no del test — no se modifica el test, queda en rojo a propósito.

**4 bugs de test en `reportes.spec.ts` (copy/comportamiento desactualizado desde 2026-07-06).** KPI "Número de consultas" → real es "Citas del período"; opción de combo "Últimos mes" → real es "Último mes"; opción de Estatus "Todos los estatus" → real es "Todos"; faltaba clic en "Buscar" tras cambiar el filtro de fecha (el panel "Filtrar registros" no auto-aplica, mismo patrón que Ingresos) + el locator del rango de fechas nunca matcheaba nada (formato real `DD-MM-YYYY – DD-MM-YYYY`, no "Desde:/Hasta:"). Los 4 fixes verificados juntos: 2 passed, 0 errores.

**CSP bloquea Microsoft Clarity (script + beacon) — `system-health`.** La CSP whitelistea `www.clarity.ms` en `script-src` pero el script real se sirve desde `scripts.clarity.ms` (subdominio distinto, no matchea); `img-src` no incluye ningún dominio `clarity.ms`. Es first-party (la política la define la app), no ruido de tercero. Para reportar a devs: agregar `scripts.clarity.ms`/`*.clarity.ms` a `script-src` y `clarity.ms` a `img-src`, o quitar el snippet si no es intencional.

**CSP bloquea `cdnjs.cloudflare.com` (Ace Editor + js-beautify) — `vacunacion-explorar`.** Origen completo ausente de la whitelist (no es solo un subdominio, como con Clarity). Los recursos (editor de código + formateador) no deberían tener relación con la pantalla de Vacunación — probablemente viene de algún bundle/layout global. Para reportar a devs: además de la whitelist, entender por qué se intenta cargar un editor de código ahí.

---

## Proyecto

- **Qué es:** suite de automatización E2E con **Playwright** para la web admin de Mediplanner (dev: `https://admin-dev.mediplanner.mx/`).
- **Repo:** https://github.com/PedroAndresQA6/MediplannerWebNuevo · **Rama de trabajo:** `Normalization`.
- **Rol:** Pedro = Test Automation Tester (no developer). Detecta bugs y los reporta a devs. Los tests son su responsabilidad. Trabajamos en español.
- **Stack:** Node v24.x, Playwright 1.58.2. Solo Chromium, viewport 1366x768, `headless:false`, `workers:1` (serial). `executablePath` condicional a `PW_CHROMIUM_PATH` (si no está, usa el Chromium bundled — config portable entre PCs).
- Archivos locales necesarios (no están en git): `.env` (BASE_URL + credenciales + `PW_CHROMIUM_PATH`) y `storageState.json`.
- ⚠️ **Pendiente de seguridad:** `.env` sigue trackeado en git (con credenciales) — falta `git rm --cached .env` + confirmar `.gitignore`.

## Estado actual (git)

- Sincronizado en las 3 ramas (`main`, `Trabajando`, `Normalization`) — apuntan al mismo commit.
- Excluidos de git a propósito: `storageState.json`, `PW_CHROMIUM_PATH` local en `.env`, `MediplannerAppiumAutomation/` (ver "Repos separados" abajo).
- **`AppEstacionamientosColaboradores/`**: suite de automatización para un producto **completamente distinto** ("Querétaro con Futuro", estacionamientos), vive en este repo por conveniencia. Tiene su propio `CONTEXTO.md`/`HALLAZGOS.md` — no se duplica ese detalle acá.

## Cómo correr los tests

```powershell
cd C:\Users\pandr\MediplannerWebNuevo

# Consulta full-flow
npx dotenv -e .env -- playwright test --project=doctor-consultation

# Consulta — los 3 tipos reales (Completa/Exprés/Exprés Médico) con verificación contra la API
npx dotenv -e .env -- playwright test --project=consultation-tipos-consulta

# Consulta — fuzzing de campos (XSS/SQLi + signos vitales) — ver hallazgo de código muerto arriba
npx dotenv -e .env -- playwright test --project=consultation-inputs-validation

# Ingresos
npx dotenv -e .env -- playwright test --project=ingresos

# Dashboard (KPIs, calendario, corte de hoy, agenda, nuevos estudios)
npx dotenv -e .env -- playwright test --project=dashboard

# Consulta — errores humanos reales (6 tests, nunca corrido contra dev)
npx dotenv -e .env -- playwright test --project=consultation-user-errors

# Un stress test puntual (ej. facturacion)
npx dotenv -e .env -- playwright test --project=stress-facturacion

# Todos los stress tests (serie, ~20-40 min)
npx dotenv -e .env -- playwright test "stress tests"

# Vacunación — ciclo completo (DESTRUCTIVO: borra todo → registra → verifica)
npx dotenv -e .env -- playwright test --project=vacunacion-ciclo-completo

# Vacunación — mapeador de la UI (exploratorio)
npx dotenv -e .env -- playwright test --project=vacunacion-explorar
```

**Proyectos de stress disponibles:** `stress-login`, `stress-citas`, `stress-pacientes`, `stress-ingresos`, `stress-informacion-paciente`, `stress-facturacion`, `stress-antecedentes`, `stress-diagnosticos`.

**Modo de corrida:** test puntual a observar → primer plano (`headless:false`). Suite larga → background.

## Setup para reproducir en otra computadora

1. Node 24.x + git (+ opcionalmente GitHub CLI `gh`).
2. `git clone` + `git checkout Normalization`.
3. `npm install`.
4. Navegador: `npx playwright install chromium`, o `PW_CHROMIUM_PATH=...` en `.env` si preferís uno ya instalado.
5. Crear `.env` localmente (pedírselo a Pedro) — no está en git.
6. `storageState.json` se regenera corriendo el proyecto `setup`.

## Repos separados — ⚠️ pendiente de decidir con Pedro

`MediplannerAppiumAutomation/` (framework Appium/pytest para la app móvil Android) debería ser su propio repo (`MediplannerAppiumAutomation` en GitHub), pero **ya no tiene su propio `.git`** — quedó fusionado dentro de `MediplannerWebNuevo` en algún punto. Pendiente decidir: ¿re-inicializarlo como repo propio, o aceptar que vive acá y actualizar la documentación en consecuencia? Mientras tanto, cualquier cambio ahí se commitea en este mismo repo.

---

## Referencias técnicas (para no re-investigar lo ya mapeado)

### Consulta — "Modo Completo" (rediseño 2026-07-23)

La pantalla de Consulta pasó de pestañas clickeables a **una sola página scrolleable con las 10 secciones visibles al mismo tiempo**: General, Signos vitales, Valoración (antes "Apariencia general" — mismo campo/placeholder, solo cambió el título visible), Exploración segmentaria, Aparatos y sistemas, Diagnóstico, Tratamiento, Laboratorios y Procedimientos, Notas del Médico, Servicios.

**Mecanismo de guardado:** Exploración segmentaria y Aparatos y sistemas tienen su propio botón "Guardar Respuestas" cada uno. Todo lo demás se persiste con un único botón global "Guardar cambios" (panel lateral derecho), clickeado una sola vez al final — dispara `editConsultation`/`addDiagnosis`/`setTreatments`/`setFreeTreatmentsConsultation`/`setProceduresConsultation`/`addServices`/`addNote` según qué se haya tocado. Hay 2 botones "Finalizar Consulta" en la página (panel lateral + al pie de Servicios) — usar `.first()`.

**Selectores clave ya probados en vivo** (ver `consultation.full-flow.spec.js` y `consultation.tipos-consulta.spec.ts` para el código completo): `sectionContainer(page, headingRegex)` ubica el card de una sección subiendo ancestros desde su heading `h3` — necesario porque con las 10 secciones en el DOM a la vez, selectores genéricos ("todas las textareas visibles") contaminan entre secciones sin acotar. Motivo de consulta es `textarea[name="visitaPaciente"]` (no input). Signos vitales: `input[name="peso"]`, `input[name*="talla" i]`, `input[placeholder="000/000 mmHg"]`, `input[name*="temp" i]`, `input[name*="card" i]`, `input[name="oxigenacion"]`, `input[name="frecuenciaRespiratoria"]`.

**Pendiente:** confirmar si el indicador "sin guardar" (triángulo, ver más abajo) sigue aplicando en algún lado con este rediseño. Confirmar qué hace el toggle "Expediente"/"Consultas" arriba a la derecha (no investigado).

### Indicador "sin guardar" (triángulo) — Laboratorios y Procedimientos

Bug de front reportado: el triángulo de "cambios sin guardar" no se limpia tras un guardado exitoso (200 OK) en Tratamiento › Laboratorios y Procedimientos. **Ya no reproduce en dev** (3/3 corridas limpias), **pero sigue confirmado como bug real en Staging**. Se detecta automáticamente con `scanResidualIndicators(page, tabName)` en `e2e/utils.js`.

### Wizard "Agendar cita" — patrón de bug recurrente entre entornos

El wizard cambió de UI (perdió las clases Tailwind de su contenedor; el botón final pasó de "Agendar cita"+modal "OK" a "Confirmar cita" sin modal) y esto rompió `createAppointment()` en dev, luego en Staging, y most recientemente (2026-08-18) se encontró que Producción **nunca había recibido el fix**. Fix estable: ubicar el wizard por el heading "Agendar cita" + ancestro más cercano con un input (no por clases CSS, que pueden volver a cambiar); confirmar con el botón "Confirmar cita" + esperar el heading "¡Cita agendada!". **Si se porta este spec a un entorno nuevo, revisar primero si `e2e/utils.js` de ese entorno ya tiene este fix.**

### Vacunación — UI (cartilla + auto-guardado)

Cada dosis es un `<input type="date">` inline (`table.table-compact input[type="date"]`) — llenar la fecha **auto-guarda** (`POST /api/vaccines/saveVaccinesUser`), sin botón. Lápiz = editar folio/notas; "×" = borrar dosis (ambos comparten la clase `btn-secondary`, cuidado). Sección "Otra vacuna" (fuera de la tabla) tiene sus propias filas inline. Botón "Guardar cambios" guarda TODO el apartado (cartilla + otra vacuna). `MAX_DOSES=999` ya aplicado en `vacunacion.ciclo-completo.spec.ts` (dev/Staging/Producción). **Pendiente real:** completar borrado + verificación de filas "otra vacuna" (selector del × rojo: `button[class*="hover:text-red"]`).

### Ingresos — flujo real de "Registrar pago"

El detalle de un ingreso con adeudo muestra: radios de **Concepto** (uno por cada cargo, ej. "Consulta General" + "Certificado Médico"), campo **Monto** prellenado al máximo del concepto, tarjetas de **Método de pago**, y "Registrar pago" que **paga solo el concepto seleccionado** — hay que repetir el envío una vez por concepto hasta saldar el ingreso completo. El botón queda en "Registrando…" (deshabilitado) durante el request. Función `pagarConceptosPendientes()` en el spec ya maneja esto (paga cada concepto con saldo > 0 uno por uno). Selectores post-rediseño: `select[name="estatus"]` (perdió su id), filas `.rdt_TableRow` (react-data-table-component), botón "Ver" sube por `xpath=ancestor::button[1]`. "Paypal" ya no es un método de pago disponible.

### Selector de lista de Pacientes — patrón de cambio recurrente

El nombre del paciente en la lista de `/Pacientes` pasó de `<a class="font-semibold...">` a `<span class="font-semibold text-sm text-gray-900 hover:text-primary truncate">` (dentro de `div.rdt_TableRow`). Ya corregido en 8 specs (7 el 2026-07-21 + `subir-estudios.spec.ts` el 2026-08-18, que se había quedado afuera). **Si un spec nuevo o poco usado falla buscando un paciente por nombre, revisar primero si usa el selector viejo (`a.font-semibold`).**

---

## Decisiones abiertas / pendientes

- [ ] **Producción — retomar full-flow de Consulta:** Pedro debe correr el login manualmente con `pedro.quijada229217@potros.itson.edu.mx` (comando en "🎯 Staging/Producción" arriba).
- [ ] **Ejecutar el plan de 26 proyectos desde Batch 2** (`appointments-create` en adelante) — ver tabla de progreso arriba.
- [ ] **Reconectar el fuzzing muerto de `consultation.inputs-validation.spec.ts`** (`runSectionValidation` + `fillTreatmentSection`/`testMedicacionValidation`) — ver hallazgo arriba.
- [ ] **Confirmar con Pedro** si reportar ya los 5 bugs de app encontrados hoy (CSP Clarity, CSP cdnjs, `saveService` falso registro, rango fisiológico de signos vitales, cruce Tratamiento/Notas) o esperar a acumular más antes de mandarlos a devs.
- [ ] Sacar `.env` del tracking de git (`git rm --cached .env`, confirmar `.gitignore`).
- [ ] Evaluar si conviene rotar la sesión de `Mediplanner produccion/storageState.json` (estuvo expuesta en el historial de git hasta el 2026-07-21, ya destrackeada pero el commit viejo sigue en el historial remoto).
- [ ] Decidir el futuro de `MediplannerAppiumAutomation/` (ver "Repos separados" arriba).
- [ ] Completar borrado + verificación de filas "otra vacuna" (ver Referencias técnicas).
- [ ] Correr `consultation-user-errors` contra dev por primera vez (batch 3 del plan) y arreglar lo que rompa.

---

## Histórico resuelto (condensado — detalle completo en el historial de git de este archivo si hace falta)

- **2026-07-23**: hallazgo y reescritura completa del rediseño "Modo Completo" de Consulta (ver Referencias técnicas arriba). 1 bug de test encontrado y corregido en la verificación manual post-reescritura (motivo de consulta usaba `input` en vez de `textarea`, se guardaba vacío en silencio).
- **2026-07-21**: fix del selector de Pacientes (a→span) en 7 specs + 2 bugs de test nuevos encontrados al verificar (paginación con guión largo "–", sub-pestaña Antecedentes a→button). Re-verificación del bug 422 `relacion_id`: 3/3 corridas limpias → bajado a "no reproduce". `dashboard.spec.js` creado (antes 0 asserts duros). Fix de performance: ~24-30s ahorrados en el toggle de observaciones de Diagnóstico. Limpieza de seguridad: `Mediplanner produccion/storageState.json` destrackeado de git (contenía sesión real de producción). Bugs de Staging confirmados como **solucionados por devs**: 422/404 de `getFilledForm`, crash de `DetallePagos` con `getFiscalData` vacío.
- **2026-07-20/21**: trabajo en `AppEstacionamientosColaboradores/` (proyecto de estacionamientos, no Mediplanner — ver su propio `HALLAZGOS.md`) y en `MediplannerAppiumAutomation/` (módulo de bitácora).
- **2026-07-14**: porteo a Staging del fix de wizard + rediseño de Ingresos, verificado con corridas reales (`807fe43`/`62e285c`). Confirmado con captura real que "Registrar pago" funciona con adeudos reales.
- **2026-07-09**: rediseño de Ingresos mapeado y `ingresos.spec.ts` adaptado. Wizard "Agendar cita" roto y arreglado por primera vez (ver Referencias técnicas). Re-verificación: bug 422 seguía vivo en ese momento (cambiando de endpoint), indicador "sin guardar" de Laboratorios no reprodujo esa vez.
- **2026-07-07**: verificación de pendientes vs. código real; hallazgo original del selector roto de Pacientes (bloqueaba 7 specs).
- **2026-06-17 a 2026-06-25**: 9 stress tests mejorados + monitor de consola (`1bb9cd7`); UI nueva de Vacunación mapeada y automatizada; porteo inicial a Staging de Consulta y Vacunación; `.env`/`storageState`/`test-results` destrackeados de git (`38b6ce6`).
