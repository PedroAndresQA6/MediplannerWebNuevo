# Etapa 4 — Partir `e2e/utils.js` — 2026-09-24

> Mudanza tal cual, sin cambios de lógica (mismo criterio que la Etapa 3).
> Plan original en `docs/tarea-actual.md`.

## Qué se movió

`e2e/utils.js` tenía 893 líneas y 9 exports tras el borrado de código muerto
de la Etapa 2. Quedó como fachada de 35 líneas; la lógica se repartió en:

| Archivo | Contenido |
| --- | --- |
| `e2e/modales.js` | `handleModals` |
| `e2e/consola.js` | `setupConsoleMonitor` |
| `e2e/auditoria.js` | `auditarPantalla` |
| `e2e/citas/crear.js` | `createAppointment` (incluye `selectReactOption` anidada) |
| `e2e/citas/agenda.js` | `asegurarCalendarioDashboard`, `irADiaEnCalendarioDashboard`, `checkNextDaysForIniciarButton`, `buscarBotonIniciarDePaciente`, `asegurarCitaDeHoy` |

Dependencias entre los nuevos módulos: `e2e/citas/agenda.js` importa
`createAppointment` de `./crear` (lo usa `asegurarCitaDeHoy` para crear una
cita cuando no hay ninguna de hoy); `e2e/citas/crear.js` importa `handleModals`
de `../modales`. El resto (`consola.js`, `auditoria.js`) solo dependen de
`opcional()`.

`e2e/utils.js` quedó como fachada pura — re-exporta los mismos 9 nombres, en
el mismo orden que antes, para que ningún `require('../e2e/utils.js')`
existente se rompa.

## Verificación

- `node --check` limpio en los 6 archivos nuevos/tocados.
- `node -e "require('./e2e/utils.js')"` resuelve los 9 exports sin error de
  ciclo ni de nombre.
- `npx playwright test --list` (las 4 projects que consumen `utils.js` +
  el listado completo de las 43 tests / 27 archivos) sin errores de
  require-time.
- `doctor-consultation` contra dev: mismo resultado que antes de la mudanza
  — verificación post-Finalizar limpia (`✅ Todo lo llenado sigue guardado y
  coincide exactamente tras Finalizar`, incluidas las verificaciones de
  laboratorios/procedimientos y notas_medico agregadas en la Etapa 2), falla
  solo por el hallazgo ya abierto de `getFilledForm` 404. Log completo en
  `logs/2026-09-24-etapa4-verificacion-doctor-consultation.log`.

## Pendiente

No commiteado — queda para que Pedro revise antes de subir (a diferencia de
las Etapas 2 y 3, no se pidió commitear en esta sesión).

Sigue sin tocar el `e2e/modales.js` propuesto vs. agruparlo con
`auditoria.js` (la nota del plan decía "decidirlo al llegar, no antes") — se
mantuvieron separados, uno por responsabilidad, ya que ninguno quedó
demasiado chico para justificar fusionarlos.
