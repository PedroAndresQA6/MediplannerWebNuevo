# CONTEXTO — MediplannerWebNuevo

> **Qué es este archivo:** el estado vivo del proyecto, en corto. Es lo primero
> que lee una sesión nueva de Claude Code. Se mantiene breve a propósito —
> el detalle histórico vive en `docs/historial/`, los hallazgos con su
> evidencia en `docs/hallazgos-abiertos.md`.
>
> **Última actualización:** 2026-09-17 (noche)
>
> **Regla de mantenimiento:** cuando algo se resuelve o se cierra, sale de este
> archivo y se archiva. Si una entrada crece más de un párrafo, su detalle va a
> `docs/hallazgos-abiertos.md` y aquí queda solo la línea.

---

## Dónde está cada cosa

| Archivo | Qué contiene | Cuándo leerlo |
| --- | --- | --- |
| `CLAUDE.md` | Normas permanentes de metodología de pruebas | Siempre (carga automática) |
| `CONTEXTO.md` | Este archivo: estado vivo y qué sigue | Al empezar cualquier sesión |
| `docs/tarea-actual.md` | El encargo en curso, con criterio de aceptación | Al empezar a trabajar |
| `docs/hallazgos-abiertos.md` | Hallazgos vivos: repro, evidencia, estado | Al tocar el área de un hallazgo |
| `docs/historial/` | Sesiones cerradas y hallazgos resueltos | Solo si hace falta el antecedente |

## Entornos

| Entorno | Ubicación en el repo | URL |
| --- | --- | --- |
| dev | raíz, `tests/` | `admin-dev.mediplanner.mx` |
| staging | `Mediplanner Staging/` | `admin-staging.mediplanner.mx` |
| producción | `Mediplanner produccion/` | — |

Tres ramas espejo (`Trabajando` por defecto, `main`, `Normalization`) que Pedro
mantiene sincronizadas al mismo commit. `.env` y `storageState.json` son
locales y no están versionados.

Pedro es Test Automation Tester, no developer; los tests son su
responsabilidad. Se trabaja en español.

## Estado actual

La suite corre contra dev. Los specs de confianza Alta/Media se reauditaron el
2026-09-10 (detalle en `docs/historial/2026-09-10-reauditoria.md`). Hay una
iniciativa en curso de reorganización de la suite, descrita en
`docs/tarea-actual.md` — la reorganización de la raíz (scripts a
`scripts-diagnostico/`, logs a `logs/`) ya está commiteada
(`74f22cd`).

**Etapas 1 y 2 de `docs/tarea-actual.md` completas y commiteadas
(`5c604d9`)** — detalle completo en
`docs/historial/2026-09-17-etapa2-clasificacion-catches.md`:
- Los 160 `opcional()` instrumentados en la Etapa 1 (71 en
  `consultation.full-flow.spec.js`, 85 en `e2e/utils.js`, 4 en
  `appointments.create.spec.ts`) quedaron clasificados por familia y por
  precondición vs. opcional legítimo, leyendo código en vez de guiarse por lo
  que se disparó en las 3 corridas de la Etapa 1.
- Borrados 58 sitios que vivían en funciones muertas de `e2e/utils.js`
  (`fillTabFields`, `detectUnsavedSections`, `auditConsultationIndicators`,
  `scanResidualIndicators` y sus helpers) — ningún spec activo las llamaba.
  `e2e/utils.js`: 1338 → 879 líneas.
- Endurecidas y verificadas contra dev (4 corridas) las 15 precondiciones
  confirmadas, y cerrados 5 de los 6 "huecos de cobertura" (logs +
  verificación post-Finalizar nueva para Laboratorios/Procedimientos y Notas
  del Médico, antes sin ninguna).
- **Al verificar, se encontró y corrigió un bug real preexistente** (no de
  esta sesión): el listener que captura `doctor_id` desde `getProfile`
  estaba mal ubicado — registrado después de la única llamada real a ese
  endpoint — así que `doctorId` quedaba `null` siempre desde que se introdujo
  (2026-07-30). Esto pone en duda la medición de "~100s de retraso" del
  hallazgo de `getFilledForm` de abajo. Detalle en `docs/hallazgos-abiertos.md`.
- De paso, se adelantó la Etapa 5 para `consultation.full-flow.spec.js`:
  `asegurarCitaDeHoy()` en `e2e/utils.js`, ya en uso — revisa la agenda de hoy
  antes de crear una cita nueva. `appointments.create.spec.ts` sigue creando
  siempre (correcto, es su objetivo).
- Pendiente antes de pasar a la Etapa 3: confirmar en vivo
  `irADiaEnCalendarioDashboard:250` y decidir qué hacer con dosis/vía/unidad/
  frecuencia/duración/tiempo/indicaciones del medicamento (único hueco de
  cobertura que quedó sin verificación, por no tener confirmado el shape
  completo de `getTreatments`).

**Credenciales:** desde 2026-09-17, `tests/auth.setup.ts` ya no tiene valores
por defecto — las toma solo de `.env` y falla con mensaje claro si faltan. La
contraseña anterior quedó en el historial de Git; pendiente rotarla.

## Hallazgos abiertos

Detalle completo en `docs/hallazgos-abiertos.md`.

| # | Hallazgo | Estado |
| --- | --- | --- |
| 1 | Carrera de datos: escribir en "General"/"Apariencia general" mientras el overlay "Recuperando datos del paciente..." sigue activo pierde lo tipeado | Causa raíz confirmada. Falta confirmación manual de Pedro antes de reportar a devs |
| D | Botón "Quitar fecha" de Vacunación inclickeable en vacunas de 4+ dosis (11 de 32 botones) | Cerrado y listo para reportar |
| — | `getFilledForm` 404 tras Finalizar pese a `registerAnswers` 200 | Reproducido de nuevo 2026-09-17 noche, ya sin el confound de `doctorId` (ver abajo): 2 llamadas internas de la app en 404, resuelven solas ~3s después. La medición previa de "~100s" queda en duda |
| — | `saveService`/`getServices`: el bug histórico no reprodujo el 2026-09-10 | En observación, no cerrado |

## Decisiones abiertas

- Confirmar el Hallazgo 1 a mano antes de reportarlo formalmente a devs.
- Re-confirmar el comportamiento real de borrado de dosis en Vacunación con el
  selector ya corregido (`button.btn-clear.text-danger`), para separar qué era
  test roto y qué era regresión de la app.
- Evaluar si `recetas` y `reportes` deberían tener asserts duros contra errores
  de API — hoy no detectan por sí solos una falla de backend de fondo.
- Decidir si arrancar la fase de exploración de bugs nuevos en dev, o terminar
  primero la reorganización de `docs/tarea-actual.md`.

## Pendientes de commit

Nada pendiente por el momento. Los cuatro commits del 2026-09-17: `74f22cd`
(reorganización de la raíz), `7b38f99` (instrumentación Etapa 1 +
investigación de `getFilledForm`), `22e0ecf` (credenciales sin default,
selectores desactualizados de reportes/subir-estudios, y limpieza/
endurecimiento de la suite Appium — revisado y confirmado por Pedro antes de
subir, no era de esta sesión) y `5c604d9` (Etapa 2: clasificación,
endurecimiento y hallazgo de `doctorId`, detalle arriba).
