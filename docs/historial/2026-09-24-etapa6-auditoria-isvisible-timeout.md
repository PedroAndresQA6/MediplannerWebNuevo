# Etapa 6 — Auditoría de `isVisible({ timeout })` en toda la suite — 2026-09-24

> Encargo nuevo, posterior al cierre de `docs/tarea-actual.md` (Etapas 1-5).
> Origen: hallazgo real de la Etapa 5 (`docs/historial/2026-09-24-etapa5-specs-citas.md`)
> — `locator.isVisible({ timeout })` no espera de verdad en esta versión de
> Playwright, y el patrón está repartido por buena parte de la suite.

## Inventario

Recorridos `e2e/` y `tests/` (excluyendo `scripts-diagnostico/` y las
carpetas de staging/producción, que son copias espejo con su propio ciclo):
**138 sitios** con el patrón `isVisible({ timeout: N })`.

Clasificación, sitio por sitio, según qué precedía al chequeo:

- **~68 sitios** esperaban contenido que aparece tras una acción (click de
  guardar/confirmar, navegación, apertura de sección/tab/wizard, búsqueda) →
  **bug latente confirmado** → corregidos a
  `waitFor({ state: 'visible', timeout }).then(() => true)` (o `.catch` según
  el sitio), preservando el mismo patrón booleano no-throw que ya usaba cada
  uno (`opcional()` en `e2e/`, `.catch(() => false)` en `tests/`).
- **~65 sitios** ya estaban protegidos por una espera real previa
  (`waitForLoadState`, `waitForSelector`, otro `waitFor`, o eran un modal de
  "cerrar si está de antes" sin acción propia que lo dispare) → se les quitó
  el `timeout`, que solo sugería al lector una espera que nunca existió.
- **5 sitios** de `e2e/consulta/secciones.js` (CIE-10, Impresión diagnóstica,
  input de medicamento, select de laboratorio, editor de Notas del Médico) no
  tenían evidencia clara — a diferencia de `fillChecklistSection`, no tienen
  su propio "Cargando...". Se confirmaron en vivo corriendo
  `doctor-consultation` contra dev: los 5 campos se encontraron y guardaron
  correctamente, verificación post-Finalizar limpia → tratados como
  estáticos.

Ningún sitio quedó sin decidir por falta de evidencia (norma anti-
racionalización de `CLAUDE.md` §0.4).

## Dos bugs reales adicionales, descubiertos por el propio fix

El timeout roto volvía todo instantáneo — al arreglarlo, dos problemas
preexistentes que estaban enmascarados quedaron a la vista.

### 1. `td[data-day]` agarraba una celda oculta del mes anterior

`e2e/citas/agenda.js` (`asegurarCalendarioDashboard`): `page.locator('td[data-day]').first()`
sin más. Confirmado con script de diagnóstico
(`scripts-diagnostico/_diagnostico_calendario_dashboard_rendering_dev.js`,
conservado como referencia) y captura de pantalla: el calendario del
Dashboard estaba **perfectamente renderizado** (35 celdas `td[data-day]`,
Septiembre 2026 completo, día 24 marcado), pero el PRIMER `td[data-day]` en
el DOM es una celda de relleno del mes anterior (`data-day="2026-08-31"`),
oculta por CSS — nunca se vuelve visible. `.first()` colgaba siempre los 8s
completos × 3 reintentos, aunque el calendario real ya estuviera listo.
`td[data-day]:visible` resuelve casi al instante y apunta a la primera celda
real (`data-day="2026-09-01"`).

Corregido: `page.locator('td[data-day]:visible').first()`. Mismo patrón que
ya usa `irADiaEnCalendarioDashboard` con `.last()` para el botón "mes
siguiente" duplicado (documentado en un comentario existente del mismo
archivo) — un duplicado oculto/decorativo en el DOM del calendario no es un
caso aislado.

### 2. La tabla "Agenda de hoy" perdía su margen de tiempo accidental

Al arreglar (1), `asegurarCalendarioDashboard` pasó a resolver casi al
instante. Antes, como el selector roto SIEMPRE fallaba, la función agotaba
sus 3 reintentos con `page.reload()` — cada reload + `waitForLoadState` +
1500ms le daba, por accidente, tiempo de sobra a la tabla "Agenda de hoy"
(sección aparte del Dashboard, con su propia carga) para hidratar. Con el
selector corregido, ese margen accidental desapareció.

Confirmado en vivo (Pedro lo notó mirando la corrida): una cita de
"Percentil" ya visible en pantalla no se encontraba —
`buscarBotonIniciarDePaciente` reportaba "no tiene cita" y creaba una
duplicada. Corregido con un `waitForTimeout(2000)` real explícito en
`buscarBotonIniciarDePaciente`, justo después de `asegurarCalendarioDashboard`.

**Efecto secundario:** antes de este segundo fix, una corrida sí dejó una
cita duplicada de "Percentil" en dev (11:35 y 11:40 el 2026-09-24). No se
borró — ambas terminaron confirmándose durante la verificación y no
molestan a los tests (ver hallazgo 3).

## `appointments.create.spec.ts` — test "Confirm scheduled appointment"

Tomaba `.first()` de las filas que matcheaban "Percentil" sin filtrar por
estado. Con la cita duplicada del punto anterior en dev, la primera fila a
veces era una **ya confirmada** de una corrida anterior — su modal no tiene
botón "Confirmar" (muestra Cancelar/No asistió/Asistió/Editar en su lugar),
y la aserción reventaba aunque sí hubiera una cita pendiente en la fila
siguiente.

Reescrito para recorrer **todas** las filas candidatas de la semana: si una
ya está confirmada (sin botón "Confirmar"), cierra su modal y prueba la
siguiente. Al cerrar, se encontró que el modal es un componente propio que
**no escucha Escape** (confirmado en vivo: el heading "Detalles de la cita"
seguía presente después de presionarlo, y el backdrop `div.fixed.inset-0`
seguía interceptando los clicks de la fila siguiente) — se usa el botón ×
real del modal en su lugar.

## Verificación final contra dev

- `doctor-consultation`: sigue fallando solo por el 404 conocido de
  `getFilledForm` (mismo resultado que antes de esta etapa) —
  `result.failedApiCalls.length` es lo único que revienta. Verificación
  post-Finalizar limpia (`Todo lo llenado sigue guardado y coincide
  exactamente tras Finalizar.`), incluyendo los 5 campos sin evidencia
  previa. Corrida final (tras todos los fixes de `e2e/`) también encontró y
  comenzó la consulta reutilizando una cita existente de "Percentil", sin
  crear una duplicada.
- `appointments-create`: pasó limpio 3/3 — encuentra la cita existente sin
  duplicar, salta la fila ya confirmada, confirma la pendiente.

Ambas citas de "Percentil" de hoy (11:35 y 11:40, 2026-09-24) quedaron
confirmadas en dev — no se limpiaron, no molestan a los tests tal como están
escritos ahora.

## Commit

`8ee24df` — `test(suite): Etapa 6 - auditar isVisible(timeout) en toda la suite`.
23 archivos (`e2e/citas/agenda.js`, `e2e/citas/crear.js`,
`e2e/consulta/navegacion.js`, `e2e/consulta/secciones.js`, 17 specs de
`tests/` y `tests/stress tests/`, más el script de diagnóstico nuevo).
