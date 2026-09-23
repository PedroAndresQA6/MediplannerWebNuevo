# Tarea actual — Reorganización de la suite

> Encargo vigente. Cuando se complete, este archivo se reemplaza por el
> siguiente encargo y lo hecho se resume en `CONTEXTO.md`.
> Definido el 2026-09-17 · Actualizado el 2026-09-22 con medidas reales del repo
> · Actualizado el 2026-09-23 al completar la Etapa 3.

## Estado

| Etapa | Estado |
| --- | --- |
| 0. Reorganización de la raíz | ✅ Completa (`74f22cd`) |
| 1. Instrumentar los `catch` silenciosos | ✅ Completa (`7b38f99`) |
| 2. Clasificar por lo que envuelve | ✅ Completa (`5c604d9`) |
| 3. Extraer los helpers de consulta | ✅ Completa (`287ddcb`) |
| 4. Partir `e2e/utils.js` | ⬅ **Siguiente** |
| 5. `asegurarCitaDeHoy()` y endurecer los specs de citas | Parcial |

Detalle de la Etapa 2 en `docs/historial/2026-09-17-etapa2-clasificacion-catches.md`.
Detalle de la Etapa 3 en `docs/historial/2026-09-23-etapa3-extraccion-helpers.md`.

## Por qué

El trabajo sobre los `catch` silenciosos (Etapas 1 y 2) ya está hecho: de 160
sitios instrumentados quedan 77 `opcional()` vivos (52 en el full-flow, 25 en
`utils.js`), todos clasificados como opcionales legítimos. Las 15
precondiciones se endurecieron y 58 sitios desaparecieron con el código muerto
que los contenía.

La Etapa 3 sacó los quince helpers de `tests/consultation.full-flow.spec.js`
(1165 → 466 líneas). Queda partir `e2e/utils.js` y endurecer los specs de
citas.

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

## Etapa 4 — Partir `e2e/utils.js` ⬅ SIGUIENTE

`e2e/utils.js` quedó en **893 líneas con 9 exports** tras el borrado del código
muerto de la Etapa 2 (antes: 1338 líneas, 16 exports). Ya no es el monolito que
era, pero sigue mezclando responsabilidades:

```
e2e/citas/crear.js       createAppointment (187, ~350 líneas)
e2e/citas/agenda.js      asegurarCalendarioDashboard (47),
                         irADiaEnCalendarioDashboard (71),
                         checkNextDaysForIniciarButton (104),
                         buscarBotonIniciarDePaciente (148),
                         asegurarCitaDeHoy (537)
e2e/consola.js           setupConsoleMonitor (563, ~264 líneas)
e2e/auditoria.js         auditarPantalla (827)
e2e/modales.js           handleModals (7)
```

Nota: `auditoria.js` queda con una sola función. Las otras cuatro que iban a
acompañarla (`detectUnsavedSections`, `auditConsultationIndicators`,
`scanResidualIndicators`, `collectFlaggedApartados`) se borraron en la Etapa 2
por código muerto. Si `auditarPantalla` y `handleModals` quedan demasiado
sueltas por sí solas, agruparlas es aceptable — decidirlo al llegar, no antes.

Mantener `e2e/utils.js` como fachada que re-exporta todo, para no romper los
imports existentes de un golpe.

---

## Etapa 5 — Specs de citas

> **Parcialmente hecha.** `asegurarCitaDeHoy()` existe y está en uso en
> `consultation.full-flow.spec.js` (adelantada en la sesión de la Etapa 1).
> Vive en `e2e/utils.js:537`; al llegar la Etapa 4 se mueve a
> `e2e/citas/agenda.js`.

Lo que falta:

**`appointments.create.spec.ts`** debe crear siempre —es su objetivo verificar
que crear una cita funciona— pero debe **fallar** si la cita no aparece
después. Hoy el test de confirmar cita recorre cuatro semanas y, si no
encuentra nada, registra `logger.warning` y termina en verde. Ese test pasa
siempre, encuentre o no encuentre. Endurecerlo con un assert duro.

**`appointments.verify.spec.ts`**: si no hay cita para verificar, crea una — con
lo cual dejó de verificar que la creación funcionó y pasó a garantizar que va a
pasar. Separar la precondición (usar `asegurarCitaDeHoy()`) de la verificación.

---

## Pendientes sueltos de la Etapa 2

No bloquean la Etapa 4, pero conviene no perderlos:

- Confirmar en vivo `irADiaEnCalendarioDashboard:250` antes de decidir si es
  precondición u opcional. Fue el único sitio que quedó marcado "revisar en
  vivo".
- Inspeccionar el shape completo (no truncado) de `getTreatments` para poder
  verificar dosis, vía, unidad, frecuencia, duración, tiempo e indicaciones del
  medicamento. Es el único hueco de cobertura que quedó sin cerrar de los 6.
- Decidir si existe algún endpoint de lectura para "Otros medicamentos"
  (tratamientos libres).

## Criterio de aceptación del encargo completo

- ✅ `consultation.full-flow.spec.js` por debajo de 500 líneas, con los helpers en
  `e2e/consulta/`, corriendo con el mismo resultado que antes de la mudanza.
- `e2e/utils.js` convertido en fachada, con los módulos de la Etapa 4 creados.
- Ninguna de las 15 precondiciones endurecidas vuelve a quedar silenciada.
- `appointments.create.spec.ts` falla si la cita no aparece tras crearla.
- `appointments.verify.spec.ts` verifica en lugar de garantizar.

## Recordatorios de la norma

Aplica el punto 7 de `CLAUDE.md`: auditar antes de correr, no después. Antes de
ejecutar cualquier spec modificado, revisarlo contra los puntos 2 y 5.

No commitear sin que Pedro revise.
