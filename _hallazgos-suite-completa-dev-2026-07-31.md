# Hallazgos — suite completa en dev, 3 pasadas (2026-07-31)

A pedido de Pedro: correr TODOS los proyectos de `playwright.config.js` (dev) 3 veces
seguidas y documentar bugs. Tracking incremental aquí; se consolida en CONTEXTO.md al
terminar las 3 pasadas (o antes, si algo es grave). Log completo: `run-all-dev-3x-full.log`.

## Fix aplicado a mitad del pase 1 (bug de test, no de la app)

Pedro señaló (con captura del Dashboard real) que el botón "Iniciar" SÍ existe y es
visible normalmente en la app — confirmando que la racha de fallas en `doctor-consultation`,
`consultation-inputs-validation` y `consultation-user-errors` (todas: "No se encontró
botón Iniciar tras crear su cita") no era un bug de la app. Diagnóstico: `createAppointment`
(en `e2e/utils.js`) agarra el PRIMER día de los próximos 5 con horario libre — NO
necesariamente hoy — y ahora mismo en dev la agenda está llena hoy/mañana/pasado (0
horarios libres los primeros 2-3 días), así que la cita cae ~3 días después. Los 3 specs
tenían su propia reimplementación de "buscar Iniciar tras crear cita" que solo miraba la
vista de HOY del Dashboard (o, en el caso de `consultation.inputs-validation.spec.ts`,
buscaba botones "+N días" que no existen en el calendario real) — ninguna navegaba el
calendario al día real de la cita.

**Fix:** se agregó `buscarBotonIniciarDePaciente(page, patientSearch)` a `e2e/utils.js`
(reutiliza `asegurarCalendarioDashboard`/`irADiaEnCalendarioDashboard`, ya correctos, y
filtra por nombre de paciente en la fila) y se actualizaron los 3 specs
(`consultation.full-flow.spec.js`, `consultation.user-errors.spec.js`,
`consultation.inputs-validation.spec.ts`) para usarlo en vez de sus reimplementaciones
rotas. Aplicado a mitad del pase 1 — sus resultados de pase 1 (arriba) quedan con el bug
viejo; pase 2/3 ya corren con el fix.

## Pase 1

### dashboard-explorar — ✅ 4/4 passed (29.3s)

### dashboard — ❌ 1 failed, 1 passed (22.9s)
`tests/dashboard.spec.js:25` "KPIs, calendario y paneles muestran datos reales (no solo mapeo)":
`Error: Tarjeta "CONSULTAS" debe mostrar contenido además del título` — `expect(txt).not.toBe('')`
falló, la tarjeta "CONSULTAS" quedó vacía pese a que `getDashboardData` sí devolvió
`consultas=66` en la misma corrida (log: "📊 getDashboardData: consultas=66 recurrentes=15
nuevas=4 pacientes=48"). Posible bug real de render, o timing (la tarjeta no había
terminado de pintar el valor cuando se leyó el texto). **Sin confirmar todavía — ver si
reproduce en pase 2/3.** Screenshot: `test-results/dashboard-Dashboard-KPIs-c-657a9-datos-reales-no-solo-mapeo--dashboard/test-failed-1.png`.

### reportes — ❌ 1 failed, 1 passed (21.4s)
`tests/reportes.spec.ts:37` "Reportes: cargar KPIs/Top 10, filtrar por rango de fechas y ver
'Ingresos recientes'" → step "KPIs visibles": `expect(locator('text=Número de consultas')).toBeVisible()`
falló — timeout 5000ms, "element(s) not found". Podría ser: (a) el texto/label de esa
tarjeta cambió en la UI y el spec quedó desactualizado (como pasó con el spec de
staging), o (b) demora real de carga mayor a 5s. **Sin confirmar — ver si reproduce en
pase 2/3.** Screenshot: `test-results/reportes-Reportes-cargar-K-13d72-s-y-ver-Ingresos-recientes--reportes/test-failed-1.png`.

### dashboard-explorar/ajustes-explorar/reportes-explorar — ✅ pasaron todos limpios (4/4, 9/9, 2/2)

### percentil-explorar — ❌ 1 failed, 1 passed (34.6s)
`tests/percentil.explorar.spec.js:9`: `TimeoutError: locator.waitFor` — el input
`input[placeholder="Buscar Usuarios"]` nunca se volvió visible en 20s. Se ve raro:
`getPatients` sí respondió 200 con datos del paciente "Percentil" (id=903) a los
+7.19s, o sea la búsqueda de algún modo sí se disparó — probablemente el placeholder
del input cambió en la UI y el selector del script quedó desactualizado (mismo patrón
sospechado en `reportes`), no necesariamente un bug de la app. **Candidato a selector
desactualizado, no a bug real — a confirmar.** Screenshot:
`test-results/percentil.explorar-Buscar-paciente-y-mapear-acciones-percentil-explorar/test-failed-1.png`.

### recetas-explorar/recetas/vacunacion-explorar — ✅ pasaron todos limpios (2/2, 2/2, 2/2)

### vacunacion-ciclo-completo — ❌ 1 failed, 1 passed (1.6m) — CANDIDATO FUERTE A BUG REAL
`tests/vacunacion.ciclo-completo.spec.ts:154` "ciclo completo borrar-todo → vacío →
registrar-todo → verificar" › step "VERIFICAR vacío (tras refrescar)":
`Error: Tras borrar y refrescar no debe quedar ninguna dosis registrada` — esperaba 0,
quedaron **32**. El log del propio test ya había anotado la inconsistencia ANTES de
refrescar: `🗑️ Borrado otra-vacuna: filas iniciales=41, clics=30, restantes=32` — o sea
que de 30 clics de borrado, no se borraron ~9 filas incluso en la UI antes de refrescar,
y tras refrescar la página siguieron **32 dosis registradas** cuando se esperaba que el
borrado masivo dejara todo vacío. Esto es justo el patrón de "el borrado no persiste/no
se completa" que preocupa al proyecto (ver nota del propio spec en línea 267:
"el borrado no persistió"). **Candidato fuerte a bug real de la app — a confirmar en
pase 2/3 antes de reportar a devs.** Screenshot: `test-results/vacunacion.ciclo-completo--2355f--registrar-todo-→-verificar-vacunacion-ciclo-completo/test-failed-1.png`.

### appointments-create — ❌ 1 failed, 2 passed (48.8s) — BUG DE TEST (no de la app), CORREGIDO
`tests/appointments.create.spec.ts:12` "Confirm scheduled appointment from agenda":
`TypeError: logger.warn is not a function` (línea 40) — el script llama `logger.warn(...)`
pero `e2e/config.js` solo define `logger.warning` (no `.warn`), lo que hacía crashear el
test antes de verificar nada real. **No es un bug de la app — es un typo en el propio
test.** Corregido en el momento (3 ocurrencias: líneas 40, 68, 71 → `logger.warning`) para
que las pasadas 2 y 3 puedan probar de verdad el flujo "confirmar cita desde agenda".

### doctor-consultation — ❌ 1 failed, 1 passed (59.2s) — probable reaparición de inestabilidad YA CONOCIDA de dev
`tests/consultation.full-flow.spec.js:674`: `Error: No se encontró botón "Iniciar" para
"Percentil Prueba Prueba" tras crear su cita` (3 intentos, 40-48s). En el log aparece de
nuevo el wizard **"Configuración de tu cuenta" bloqueando el Dashboard**, un problema
YA DOCUMENTADO como intermitente en dev (ver CONTEXTO.md, sesión 2026-07-27: "la cuenta
de dev usada cae de forma intermitente... en un wizard extendido... que bloquea el
acceso al Dashboard real de forma no determinística"). También apareció un
`💥 [JS ERROR +40.96s] Cannot read properties of null (reading 'sequence')` justo antes
del wizard — no confirmado si está relacionado. **No se trata como hallazgo nuevo — es
la reaparición de un problema de entorno ya conocido —, pero se sigue el patrón normal
del proyecto (ver si reproduce again en pase 2/3).**

### consultation-inputs-validation — ❌ 1 failed, 1 passed (52.8s)
`tests/consultation.inputs-validation.spec.ts:1562` "Start a scheduled consultation -
Stress Test": `Error: No se pudieron encontrar o crear citas disponibles para iniciar` —
la cita SÍ se creó bien (2026-08-03), pero tras volver al Dashboard y revisar los
próximos 5 días, nunca apareció el botón "Iniciar". Mismo síntoma que el fallo de
`doctor-consultation` justo antes (no encontrar "Iniciar" tras crear la cita) — posible
mismo origen (wizard intermitente / timing del Dashboard). **Sin confirmar — ver si
reproduce en pase 2/3.**

### consultation-user-errors (en curso) — observación registrada por el propio test
`🐛 [HALLAZGO] 2 pacientes con nombre "juan garcia perez" son indistinguibles en la
lista (mismo correo/teléfono/fecha de nacimiento): ids 853, 861.` — es un log
informativo del propio spec (no necesariamente hace fallar el test), posiblemente sobre
datos de prueba preexistentes en dev. Anotado para revisar si es relevante; no se
confirma como "bug nuevo" sin más contexto.

### ingresos — ✅ 3/3 passed

### subir-estudios — ❌ 1 failed (20.3s)
`tests/subir-estudios.spec.ts:7`: `expect(locator('span.menu-title:text-is("Pacientes")')).toBeVisible()`
timeout 10s, "element(s) not found" — el link del sidebar "Pacientes" no se encontró.
Podría ser un selector desactualizado (clase/texto del menú cambió) o timing de carga
del sidebar. **Candidato a selector desactualizado — a confirmar en pase 2/3.**

### stress-citas/stress-pacientes/stress-ingresos/stress-login/stress-informacion-paciente — ✅ todos limpios (2/2, 2/2, 2/2, 1/1, 2/2 con "🐛 BUG: 0" reportado — sin hallazgos)

### stress-diagnosticos — ❌ 1 failed, 1 passed (29.2s)
`tests/stress tests/diagnosticos.stress.test.ts:539`: `TimeoutError: locator.click:
Timeout 15000ms exceeded` — buscó al paciente "Daniela Jiménez Durán", no lo encontró
en la lista, e intentó clickear el primer link genérico de paciente
(`a.font-semibold, ...`) pero ese selector nunca resolvió en 15s. Parece selector
desactualizado o problema de timing en la búsqueda, no necesariamente bug de la app.
**Candidato a selector desactualizado — a confirmar en pase 2/3.**

## Pase 2

### dashboard — ❌ REPRODUJO IDÉNTICO (2/2) — "CONSULTAS" vacía
Exactamente el mismo error que en pase 1, mismo mensaje, misma tarjeta ("CONSULTAS").
`getCardText` sube hasta 8 ancestros desde el label "CONSULTAS" buscando un contenedor
con MÁS texto que el label solo — y en ninguna profundidad hasta depth 8 encontró nada
extra, en 2/2 corridas. Como el fallo es SIEMPRE en el primer KPI del array (CONSULTAS,
nunca RECURRENTES/NUEVAS/PACIENTES), no parece timing aleatorio genérico — podría ser
que el valor de esa tarjeta específica tarda más en pintar que las otras 3, o un problema
real de render. **Sube a candidato fuerte — ver pase 3.**

### reportes — ❌ REPRODUJO IDÉNTICO (2/2) — "Número de consultas" no aparece
Mismo timeout de 5s en el mismo locator que pase 1. **Sube a candidato fuerte — ver pase 3.**

### ajustes-servicios — ❌ REPRODUJO IDÉNTICO (2/2) — servicio nuevo no persiste
Mismo error exacto: "El servicio [...] no apareció en getServices tras guardar — falso
registro". **Sube a candidato fuerte — ver pase 3.**

## Re-corrida enfocada — solo candidatos, 3 vueltas (a pedido de Pedro, tras el pase 2)

Se detuvo la corrida completa de 25 proyectos (llegó hasta pase 2, proyecto
ajustes-explorar) y se lanzó `_run-candidatos-3x.sh`: solo los 10 proyectos con
hallazgos/candidatos, 3 vueltas seguidas, para confirmar más rápido sin gastar tiempo en
los que ya salieron limpios. Log: `run-candidatos-3x-full.log`.

### CONFIRMADOS — 3/3 vueltas fallando idéntico:
- **dashboard** — tarjeta "CONSULTAS" vacía (3/3 total contando pase 1/2)
- **reportes** — "Número de consultas" no aparece (3/3 total)
- **ajustes-servicios** — servicio nuevo no aparece en getServices tras guardar (3/3 total)
- **percentil-explorar** — mismo timeout de selector (2/2 total)
- **vacunacion-ciclo-completo** — borrado masivo no deja todo en 0 (2/2 total; esta vez
  "filas iniciales=32, clics=30, restantes=32" — el estado no se limpia entre corridas,
  hay vacunas remanentes de la corrida anterior que tampoco se pudieron borrar del todo)

### ⚠️ consultation-inputs-validation — pasó el calendario, pero es un spec DESACTUALIZADO
Con el fix, corrió 2.7 min (antes 52.8s) — ya no se traba buscando "Iniciar". Pero ahora
falla más adelante: `TimeoutError: page.waitForLoadState('networkidle')` (30s) justo
después de clickear la pestaña "Exploración" (línea 1874). **Este spec todavía asume el
modelo VIEJO de pestañas clickeables**, de antes del rediseño "Modo Completo" (2026-07-23)
que ya se aplicó a `consultation.full-flow.spec.js` — el mismo síntoma que rompía el spec
viejo de full-flow ("el click cae en un heading inerte y networkidle nunca resuelve por
los beacons de GA/Zendesk", según el comentario histórico de ese archivo). **No es un bug
de la app — es que este spec quedó desactualizado y necesitaría la misma reescritura que
ya se le hizo a full-flow.** No se reescribe ahora (alcance grande, decisión de Pedro).

### ⚠️ consultation-user-errors — pasó el calendario (encuentra "Iniciar" bien), pero
### 5/6 tests fallan ahora en un paso posterior: botón "Guardar" de signos vitales queda
### DESHABILITADO 15s y nunca se habilita.
El helper `iniciarConsultaDeHoy` de este spec solo llena 2 campos de signos vitales
(peso, talla) — `consultation.full-flow.spec.js` (el spec endurecido) llena 8 (+presión,
temperatura, FC, saturación, FR, glucosa). Con solo 2 campos, el botón "Guardar" del modal
de signos vitales nunca se habilita — parece que el formulario requiere más campos
obligatorios de los que este spec llena. **Probable spec desactualizado** (no valida los
campos mínimos actuales), no necesariamente un bug de la app — pero no se puede descartar
del todo sin llenar los campos completos y confirmar. Bloquea 5/6 tests de este archivo.
Antes del fix del calendario, este mismo síntoma quedaba oculto porque el spec fallaba
antes, buscando "Iniciar".

### ✅ FIX DE CALENDARIO CONFIRMADO — doctor-consultation
Corrió el flujo COMPLETO por primera vez (6.8 min, ya no se quedó pegado en 59s buscando
"Iniciar"). Falló solo por el problema YA CONOCIDO de `getFilledForm` en blanco tras 130s
(igual que antes del fix) — todo lo demás, incluido `impresion_diagnostico` y
`diagnosticos: 1 elemento`, se guardó correctamente. El fix del calendario funciona.

## RESUMEN PASE 1 (25 proyectos)
- ✅ Limpios (18): dashboard-explorar, ajustes-explorar, reportes-explorar, recetas-explorar,
  recetas, vacunacion-explorar, ingresos, stress-citas, stress-pacientes, stress-ingresos,
  stress-login, stress-informacion-paciente, stress-facturacion, stress-antecedentes
  (14 realmente — contar bien al consolidar)
- ❌ Con fallas (11): dashboard, reportes, ajustes-servicios, percentil-explorar,
  vacunacion-ciclo-completo, appointments-create (bug de test, corregido),
  doctor-consultation, consultation-inputs-validation, consultation-user-errors (5/6),
  subir-estudios, stress-diagnosticos
- Fix de bug de test aplicado a mitad del pase: `logger.warn`→`logger.warning` en
  appointments.create.spec.ts
- Fix de bug de test aplicado a mitad del pase: navegación de calendario por día real
  (no solo "hoy") en 3 specs de consulta — afecta doctor-consultation,
  consultation-user-errors, consultation-inputs-validation desde pase 2 en adelante

### ajustes-servicios — ❌ 1 failed, 1 passed (25.7s)
`tests/ajustes.servicios.spec.ts:44` "Ajustes › Servicios: catálogo carga, filtro 'Sólo
activos' y alta de un servicio": `Error: El servicio "QA_TEST_SERVICIO_NO_BORRAR_..." no
apareció en getServices tras guardar — falso registro`. Se dio de alta un servicio nuevo
y, al releer `getServices`, NO aparece — 0 errores de API/consola en esa corrida (el
propio resumen del spec dice "Errores de consola REALES: 0, APIs de Servicios
fallidas: 0"), o sea que la UI no reportó ningún error al guardar pero el servicio
tampoco quedó persistido. **Candidato a bug real de pérdida silenciosa de datos — sin
confirmar todavía, ver si reproduce en pase 2/3.** Screenshot:
`test-results/ajustes.servicios-Ajustes--7a2e0-tivos-y-alta-de-un-servicio-ajustes-servicios/test-failed-1.png`.
