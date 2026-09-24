# Tarea actual — Reorganización de la suite

> Encargo vigente. Cuando se complete, este archivo se reemplaza por el
> siguiente encargo y lo hecho se resume en `CONTEXTO.md`.
> Definido el 2026-09-17 · Actualizado el 2026-09-22 con medidas reales del repo
> · Actualizado el 2026-09-23 al completar la Etapa 3.
> · Actualizado el 2026-09-24 al completar y commitear las Etapas 4 y 5
>   (`227a469`, `cb12c9b`) — encargo completo.

## Estado

| Etapa | Estado |
| --- | --- |
| 0. Reorganización de la raíz | ✅ Completa (`74f22cd`) |
| 1. Instrumentar los `catch` silenciosos | ✅ Completa (`7b38f99`) |
| 2. Clasificar por lo que envuelve | ✅ Completa (`5c604d9`) |
| 3. Extraer los helpers de consulta | ✅ Completa (`287ddcb`) |
| 4. Partir `e2e/utils.js` | ✅ Completa (`227a469`) |
| 5. `asegurarCitaDeHoy()` y endurecer los specs de citas | ✅ Completa (`cb12c9b`) |

Detalle de la Etapa 2 en `docs/historial/2026-09-17-etapa2-clasificacion-catches.md`.
Detalle de la Etapa 3 en `docs/historial/2026-09-23-etapa3-extraccion-helpers.md`.
Detalle de la Etapa 4 en `docs/historial/2026-09-24-etapa4-split-utils.md`.
Detalle de la Etapa 5 en `docs/historial/2026-09-24-etapa5-specs-citas.md`.

## Por qué

El trabajo sobre los `catch` silenciosos (Etapas 1 y 2) ya está hecho: de 160
sitios instrumentados quedan 77 `opcional()` vivos (52 en el full-flow, 25 en
`utils.js`), todos clasificados como opcionales legítimos. Las 15
precondiciones se endurecieron y 58 sitios desaparecieron con el código muerto
que los contenía.

La Etapa 3 sacó los quince helpers de `tests/consultation.full-flow.spec.js`
(1165 → 466 líneas). La Etapa 4 partió `e2e/utils.js` en módulos por
responsabilidad. La Etapa 5 endureció los specs de citas. Con esto se
completan todas las etapas planeadas del encargo — queda pendiente que Pedro
revise y commitee la Etapa 5, y los pendientes sueltos que no bloquean nada.

---

## Etapa 3 — Extraer los helpers de consulta ✅ COMPLETA (2026-09-23, `287ddcb`)

Mudanza tal cual, sin cambios de lógica. El spec quedó en **466 líneas** y los
helpers en `e2e/consulta/`:

```
e2e/consulta/
  navegacion.js    sectionContainer, saltarOnboardingYWizardConfig,
                   iniciarConsultaDelPaciente
  secciones.js     fillPerimetroCefalico + las 8 fill*Section
  guardado.js      guardarCambiosGlobal, waitForFinalizarButton
  datos.js         DATOS_CLINICOS, TEXTO_*, PACIENTE_*, PERCENTIL_*, MEDIDAS
  util.js          pick()
```

`datos.js` no estaba en el plan original: las constantes las comparten los
helpers y la verificación post-Finalizar del spec (aprobado por Pedro). Se
conservaron los 52 `opcional()`, las 13 precondiciones (ninguna volvió a
`opcional()`), el regex `/^Exploración segmentar[ií]a\s*$/i` y los comentarios
de contexto junto a su código. `doctor-consultation` contra dev dio el mismo
resultado que antes de la mudanza (falla solo por el 404 de `getFilledForm`,
verificación post-Finalizar limpia).

---

## Etapa 4 — Partir `e2e/utils.js` ✅ COMPLETA (2026-09-24, `227a469`)

Mudanza tal cual, sin cambios de lógica. `e2e/utils.js` quedó como fachada de
**35 líneas**; la lógica se repartió en:

```
e2e/citas/crear.js       createAppointment (349 líneas)
e2e/citas/agenda.js      asegurarCalendarioDashboard,
                         irADiaEnCalendarioDashboard,
                         checkNextDaysForIniciarButton,
                         buscarBotonIniciarDePaciente,
                         asegurarCitaDeHoy (186 líneas)
e2e/consola.js           setupConsoleMonitor (256 líneas)
e2e/auditoria.js         auditarPantalla (86 líneas)
e2e/modales.js           handleModals (42 líneas)
```

`auditoria.js` y `modales.js` quedaron cada uno con una sola función —
evaluado al llegar (como decía la nota anterior) y se mantuvieron separados
por responsabilidad en vez de fusionarlos, ninguno resultó demasiado chico
para justificarlo.

`doctor-consultation` contra dev dio el mismo resultado que antes de la
mudanza (verificación post-Finalizar limpia, falla solo por el 404 de
`getFilledForm`). Detalle en
`docs/historial/2026-09-24-etapa4-split-utils.md`.

---

## Etapa 5 — Specs de citas ✅ COMPLETA (2026-09-24, `cb12c9b`)

> Corrección de alcance: el doc original hablaba de un
> `appointments.verify.spec.ts` que **no existe** — los dos problemas
> descritos vivían en los dos `test()` de `appointments.create.spec.ts`.

`asegurarCitaDeHoy()` ya vive en `e2e/citas/agenda.js` (movida en la Etapa 4)
y sigue en uso en `consultation.full-flow.spec.js`.

**Test "Schedule appointment for a patient"**: ahora usa un paciente fijo
(`PACIENTE_BUSQUEDA`), revisa primero en Inicio si ya tiene una cita en los
próximos 5 días (no crea otra si ya hay) y, si crea una, verifica que
realmente aparece en Inicio antes de terminar.

**Test "Confirm scheduled appointment from agenda"**: buscaba texto
`agendada`/`programada` que **nunca aparece** en la vista de Agenda (el
estado es un badge dentro del modal de detalles, no en la fila) — por eso
nunca encontraba nada, sin que ningún `expect` lo hiciera fallar. Reescrito
para buscar la fila por nombre del paciente, abrir el modal y confirmar con
un `expect` duro sobre "se encontró" y "se confirmó" por separado.

**Hallazgo real al verificar:** `locator.isVisible({ timeout })` no espera en
esta versión de Playwright (confirmado en vivo con capturas) — el `timeout`
es un no-op. Corregido acá con `waitFor({ state: 'visible', timeout })` real.
Es un patrón usado en el resto de la suite; queda pendiente auditarlo en
otros lugares (detalle y candidatos concretos en
`docs/historial/2026-09-24-etapa5-specs-citas.md`).

---

## Pendientes sueltos

No bloquean la siguiente etapa, pero conviene no perderlos:

- De la Etapa 2: confirmar en vivo `irADiaEnCalendarioDashboard:250` antes de
  decidir si es precondición u opcional. Fue el único sitio que quedó marcado
  "revisar en vivo".
- De la Etapa 2: inspeccionar el shape completo (no truncado) de
  `getTreatments` para poder verificar dosis, vía, unidad, frecuencia,
  duración, tiempo e indicaciones del medicamento. Es el único hueco de
  cobertura que quedó sin cerrar de los 6.
- De la Etapa 2: decidir si existe algún endpoint de lectura para "Otros
  medicamentos" (tratamientos libres).
- ~~De la Etapa 5: `locator.isVisible({ timeout })` no espera en esta versión
  de Playwright — auditar los demás usos de ese patrón en la suite.~~
  **Cerrado en la Etapa 6** (`8ee24df`, 2026-09-24, fuera de este documento —
  ver `docs/historial/2026-09-24-etapa6-auditoria-isvisible-timeout.md`).

## Criterio de aceptación del encargo completo

- ✅ `consultation.full-flow.spec.js` por debajo de 500 líneas, con los helpers en
  `e2e/consulta/`, corriendo con el mismo resultado que antes de la mudanza.
- ✅ `e2e/utils.js` convertido en fachada, con los módulos de la Etapa 4
  creados, corriendo con el mismo resultado que antes de la mudanza.
- Ninguna de las 15 precondiciones endurecidas vuelve a quedar silenciada.
- ✅ `appointments.create.spec.ts` falla si la cita no aparece tras crearla
  (y ya no crea una duplicada si el paciente de prueba ya tiene una).
- ✅ El test de confirmar cita (dentro de `appointments.create.spec.ts`, ver
  nota de alcance de la Etapa 5) verifica en lugar de garantizar.

## Recordatorios de la norma

Aplica el punto 7 de `CLAUDE.md`: auditar antes de correr, no después. Antes de
ejecutar cualquier spec modificado, revisarlo contra los puntos 2 y 5.

No commitear sin que Pedro revise.
