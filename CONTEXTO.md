# CONTEXTO — MediplannerWebNuevo

> **Qué es este archivo:** el estado vivo del proyecto, en corto. Es lo primero
> que lee una sesión nueva de Claude Code. Se mantiene breve a propósito —
> el detalle histórico vive en `docs/historial/`, los hallazgos con su
> evidencia en `docs/hallazgos-abiertos.md`.
>
> **Última actualización:** 2026-09-17 (tarde)
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

**Etapa 2 de `docs/tarea-actual.md` (clasificar los 160 `opcional()`) en
curso, pendiente de que Pedro revise antes de commitear** — detalle completo
en `docs/historial/2026-09-17-etapa2-clasificacion-catches.md`:
- Clasificados los 160 sitios por familia (A: no lanza / B: sí lanza) y por
  precondición vs. opcional legítimo, leyendo código, no por lo que se
  disparó en las 3 corridas de la Etapa 1.
- Hallazgo no anticipado: 58 de los 85 sitios de `e2e/utils.js` (68%) vivían
  en funciones que ningún spec activo llamaba (`fillTabFields`,
  `detectUnsavedSections`, `auditConsultationIndicators`,
  `scanResidualIndicators` y sus helpers privados). Decisión de Pedro: borrar
  — `e2e/utils.js` bajó de 1338 a 879 líneas.
- Las 15 precondiciones confirmadas (13 en `consultation.full-flow.spec.js`,
  2 en `e2e/utils.js`) ya están endurecidas (waits/asserts duros con mensaje
  explícito, en vez de `opcional()`) **y verificadas contra dev**. Quedan
  pendientes: 6 sitios en zona gris ("hueco de cobertura") y confirmar en vivo
  `irADiaEnCalendarioDashboard:250` antes de decidir.
- **Al verificar, el endurecimiento de la precondición de `doctorId` encontró
  un bug real preexistente** (no de esta sesión): el listener que captura
  `doctor_id` desde `getProfile` estaba mal ubicado en el código — registrado
  después de que `getProfile` ya se había llamado — así que `doctorId` quedaba
  `null` siempre desde que se introdujo (2026-07-30). Corregido. Con
  `doctorId` real, la verificación post-Finalizar pasó limpia sin
  reintentos — esto pone en duda la medición de "~100s de retraso de
  propagación" del hallazgo de `getFilledForm` de abajo, contaminada por este
  bug. Detalle en `docs/hallazgos-abiertos.md`.
- Etapa 1 (instrumentar) sigue completa y ya revisada antes de esto:
- `e2e/opcional.js` (nuevo helper `opcional()`/`reporteOpcionales()`).
- 160 sitios instrumentados (71 en `consultation.full-flow.spec.js`, 85 en
  `e2e/utils.js`, 4 en `appointments.create.spec.ts`) — más de los 112
  estimados originalmente en `docs/tarea-actual.md`, que resultó una
  subestimación.
- 3 corridas limpias de `doctor-consultation` contra dev: en todas se disparó
  **una sola etiqueta** (`auditarPantalla:elemento-inputvalue`, 3x cada vez) —
  el resto de los 160 nunca se disparó. Dato clave para la Etapa 2: la mayoría
  de los `.isVisible().catch(() => false)` no tiran excepción nunca (Playwright
  resuelve a `false` sin error), así que el catch casi no actúa.
- De paso, se adelantó la Etapa 5 para `consultation.full-flow.spec.js`:
  `asegurarCitaDeHoy()` en `e2e/utils.js`, ya en uso — revisa la agenda de hoy
  antes de crear una cita nueva. `appointments.create.spec.ts` sigue creando
  siempre (correcto, es su objetivo).

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

Pendiente de que Pedro revise antes de commitear (Etapa 2, sesión del
2026-09-17 tarde/noche):
- `e2e/utils.js`: borrado el código muerto (−459 líneas) + 2 precondiciones
  endurecidas.
- `tests/consultation.full-flow.spec.js`: 13 precondiciones endurecidas.
- `docs/historial/2026-09-17-etapa2-clasificacion-catches.md` (nuevo):
  clasificación completa de los 160 `opcional()`.
- Este archivo (`CONTEXTO.md`).

Los tres commits del 2026-09-17 (mañana): `74f22cd` (reorganización de la
raíz), `7b38f99` (instrumentación Etapa 1 + investigación de
`getFilledForm`) y `22e0ecf` (credenciales sin default, selectores
desactualizados de reportes/subir-estudios, y limpieza/endurecimiento de la
suite Appium — este último revisado y confirmado por Pedro antes de subir, no
era de esta sesión).
