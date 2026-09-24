# CONTEXTO — MediplannerWebNuevo

> **Qué es este archivo:** el estado vivo del proyecto, en corto. Es lo primero
> que lee una sesión nueva de Claude Code. Se mantiene breve a propósito —
> el detalle histórico vive en `docs/historial/`, los hallazgos con su
> evidencia en `docs/hallazgos-abiertos.md`.
>
> **Última actualización:** 2026-09-24
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

**Las 5 etapas de `docs/tarea-actual.md` completas y commiteadas — encargo
completo.** Detalle por etapa en `docs/historial/`:
- Etapa 1-2 (`5c604d9`): los 160 `opcional()` clasificados; 58 sitios de
  código muerto borrados (`e2e/utils.js`: 1338 → 879 líneas); 15
  precondiciones endurecidas y verificadas contra dev; 5/6 huecos de
  cobertura cerrados. De paso se encontró y corrigió un bug real: el listener
  de `doctor_id` (desde `getProfile`) estaba mal ubicado desde 2026-07-30 y
  `doctorId` quedaba siempre `null` — pone en duda la medición de "~100s" del
  hallazgo de `getFilledForm` de abajo. Detalle:
  `docs/historial/2026-09-17-etapa2-clasificacion-catches.md`.
- Etapa 3 (`287ddcb`, 2026-09-23): los 15 helpers de consulta movidos a
  `e2e/consulta/`. Spec: 1165 → 466 líneas. Mismo resultado contra dev.
  Detalle: `docs/historial/2026-09-23-etapa3-extraccion-helpers.md`.
- Etapa 4 (`227a469`, 2026-09-24): `e2e/utils.js` partido en
  `e2e/modales.js`, `e2e/consola.js`, `e2e/auditoria.js`,
  `e2e/citas/crear.js`, `e2e/citas/agenda.js` — quedó como fachada de 35
  líneas. Mismo resultado contra dev (verificación limpia, falla solo por el
  404 de `getFilledForm`). Detalle:
  `docs/historial/2026-09-24-etapa4-split-utils.md`.
- Etapa 5 (`cb12c9b`, 2026-09-24): `docs/tarea-actual.md` hablaba de
  un `appointments.verify.spec.ts` que **no existe** — los dos problemas
  vivían en los dos tests de `appointments.create.spec.ts`. Corregidos:
  ahora usa un paciente fijo (`PACIENTE_BUSQUEDA`), no crea una cita
  duplicada si el paciente ya tiene una en los próximos 5 días, y el test de
  "confirmar" busca la fila por nombre de paciente en vez de un texto
  ("agendada"/"programada") que nunca aparece en esa vista — antes nunca
  encontraba nada y pasaba en verde igual por falta de `expect`. Detalle:
  `docs/historial/2026-09-24-etapa5-specs-citas.md`.
- **Hallazgo real de la Etapa 5:** `locator.isVisible({ timeout })` no espera
  en esta versión de Playwright (el `timeout` es un no-op, confirmado en vivo
  con capturas) — afecta a más lugares de la suite que solo este archivo,
  pendiente de auditar (ver "Pendientes sueltos" en `docs/tarea-actual.md`).
- Pendientes sueltos de la Etapa 2 (no bloquean, ver `docs/tarea-actual.md`):
  confirmar en vivo `irADiaEnCalendarioDashboard:250`; decidir qué hacer con
  dosis/vía/unidad/frecuencia/duración/tiempo/indicaciones del medicamento
  (único hueco de cobertura sin cerrar).
- **Con la Etapa 5 commiteada, terminaron todas las etapas planeadas de
  `docs/tarea-actual.md` — encargo completo.** Queda decidir el próximo
  encargo.

**Limpieza de repo (2026-09-24, commiteada en `Trabajando`/`main`/
`Normalization`):**
- Las 3 ramas espejo, que habían quedado desincronizadas (una rama
  `etapa-3-extract-helpers` local sin pushear, `Trabajando` 10 commits
  adelante de `origin`), se volvieron a sincronizar al mismo commit.
- Destrackeados 6 archivos (`Mediplanner produccion/test-results/*`,
  `logs/test-results-staging-fullflow*.log`) que ya estaban cubiertos por
  `.gitignore` pero habían quedado trackeados de antes.
- Movidos 9 scripts sueltos de `Mediplanner Staging/`/`Mediplanner
  produccion/` a sus `scripts-diagnostico/` (mismo patrón que la raíz de dev).
- **Hallazgo de seguridad real:** 2 de esos scripts y
  `Mediplanner produccion/Tests_Produccion/auth.setup.ts` (este último ya
  commiteado desde antes) tenían el email/password de **producción**
  hardcodeados. Corregidos para leer de `.env`, mismo criterio que
  `tests/auth.setup.ts` (dev) desde el 2026-09-17.
  **La contraseña que quedó en el historial de git NO se rotó** — decisión
  explícita de Pedro (2026-09-24), no un olvido. Ver "Decisiones abiertas".

**Credenciales:** desde 2026-09-17, `tests/auth.setup.ts` (dev) y desde
2026-09-24 `Mediplanner produccion/Tests_Produccion/auth.setup.ts` ya no
tienen valores por defecto — las toman solo de `.env` y fallan con mensaje
claro si faltan.

## Hallazgos abiertos

Detalle completo en `docs/hallazgos-abiertos.md`.

| # | Hallazgo | Estado |
| --- | --- | --- |
| 1 | Carrera de datos: escribir en "General"/"Apariencia general" mientras el overlay "Recuperando datos del paciente..." sigue activo pierde lo tipeado | Causa raíz confirmada. Falta confirmación manual de Pedro antes de reportar a devs |
| D | Botón "Quitar fecha" de Vacunación inclickeable en vacunas de 4+ dosis (11 de 32 botones) | Cerrado y listo para reportar |
| — | `getFilledForm` 404 tras Finalizar pese a `registerAnswers` 200 | Reproducido de nuevo 2026-09-17 noche, ya sin el confound de `doctorId` (ver abajo): 2 llamadas internas de la app en 404, resuelven solas ~3s después. La medición previa de "~100s" queda en duda |
| — | `saveService`/`getServices`: el bug histórico no reprodujo el 2026-09-10 | En observación, no cerrado |

## Decisiones abiertas

- La contraseña de producción que quedó hardcodeada en el historial de git
  (`Mediplanner produccion/Tests_Produccion/auth.setup.ts`, ya corregida en
  el código pero no en el historial) **no se rotó** — decisión explícita de
  Pedro el 2026-09-24, confirmando que la contraseña era/es real. Revisar
  este archivo si en algún momento se decide rotarla y reescribir el
  historial de git.
- Confirmar el Hallazgo 1 a mano antes de reportarlo formalmente a devs.
- Re-confirmar el comportamiento real de borrado de dosis en Vacunación con el
  selector ya corregido (`button.btn-clear.text-danger`), para separar qué era
  test roto y qué era regresión de la app.
- Evaluar si `recetas` y `reportes` deberían tener asserts duros contra errores
  de API — hoy no detectan por sí solos una falla de backend de fondo.
- Decidir si arrancar la fase de exploración de bugs nuevos en dev, o terminar
  primero la reorganización de `docs/tarea-actual.md`.

## Pendientes de commit

Nada pendiente. Todo commiteado y pusheado a `Trabajando`/`main`/
`Normalization` (todas sincronizadas en `cb12c9b`): los cuatro commits del
2026-09-17 (`74f22cd`, `7b38f99`, `22e0ecf`, `5c604d9`), `287ddcb`+`bec5332`
(Etapa 3, 2026-09-23) y, del 2026-09-24: destrackeo de test-results/logs
viejos, mudanza de los 9 scripts sueltos a `scripts-diagnostico/`, el fix de
credenciales hardcodeadas de producción, `227a469` (Etapa 4) y `cb12c9b`
(Etapa 5 — encargo de `docs/tarea-actual.md` completo).

Nota operativa: git en esta carpeta de OneDrive falla al cambiar de
rama/commitear ("unable to append to .git/logs/HEAD") — se resuelve por
comando con `git -c windows.appendAtomically=false ...`.
