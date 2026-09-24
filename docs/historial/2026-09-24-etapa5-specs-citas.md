# Etapa 5 — Specs de citas — 2026-09-24

> `docs/tarea-actual.md` hablaba de dos archivos, `appointments.create.spec.ts`
> y `appointments.verify.spec.ts` — el segundo **no existe**. Los dos
> problemas que describía viven en los dos `test()` de
> `appointments.create.spec.ts`.

## Qué tenía roto

**Test 1 ("Schedule appointment for a patient")**: creaba una cita para "el
primer paciente que aparezca" en el selector, sin paciente fijo y sin
verificar nada después de que el wizard mostrara su propio heading de éxito.
Cada corrida sumaba una cita más a dev, para siempre.

**Test 2 ("Confirm scheduled appointment from agenda")**: buscaba texto
`agendada`/`programada` en la vista de Agenda — **ese texto nunca aparece
ahí**. La fila de una cita solo muestra hora + nombre del paciente + tipo de
consulta; el estado ("Agendada") es un badge que solo se ve **dentro** del
modal "Detalles de la cita", tras clickear la fila. El test llevaba tiempo
sin encontrar nada, y como no había ningún `expect` al final, pasaba en verde
igual. Además, `citaEncontrada` se marcaba en `true` con solo clickear el
candidato, sin importar si la confirmación realmente funcionaba.

## Qué se cambió

- **Test 1** ahora usa `PACIENTE_BUSQUEDA` (el mismo `'Percentil'` que ya usa
  `consultation.full-flow.spec.js`, de `e2e/consulta/datos.js`). Antes de
  crear, revisa en Inicio si el paciente ya tiene una cita en los próximos 5
  días (`buscarBotonIniciarDePaciente`, mismo helper que usa
  `asegurarCitaDeHoy()`) — si ya hay una, no crea otra. Si crea una nueva,
  verifica después que aparece en Inicio. Termina con
  `expect(iniciarBtn).not.toBeNull()`.
- **Test 2** busca la fila por nombre del paciente (`PACIENTE_BUSQUEDA`) en
  vez del texto inexistente. Separa `citaEncontrada` (se encontró la fila) de
  `citaConfirmada` (el modal + botón "Confirmar" funcionaron de punta a
  punta) y termina con un `expect` duro sobre cada una.

## Hallazgo real encontrado al verificar: `isVisible({ timeout })` no espera

Confirmado en vivo, dos veces, con capturas de pantalla: `locator.isVisible({
timeout: N })` en esta versión de Playwright **no espera** — es
prácticamente instantáneo sin importar el valor de `timeout` (subirlo de
5000 a 10000ms no cambió nada, apenas ~130ms entre el chequeo y la
resolución). El código de esta sesión usaba ese patrón para esperar a que el
modal "Detalles de la cita" apareciera, y fallaba siempre aunque el modal
terminara abriendo bien un poco después — confirmado con la captura de la
falla, que mostraba el modal ya abierto.

**Corregido en los 2 sitios de este archivo** (espera del modal y del botón
"Confirmar"): reemplazado por `locator.waitFor({ state: 'visible', timeout
})`, que sí espera de verdad.

**No es un caso aislado.** El criterio de clasificación de la Etapa 2
(`docs/historial/2026-09-17-etapa2-clasificacion-catches.md`) era "¿la
operación lanza excepción?" — `isVisible()` fue clasificada correctamente
como "no lanza" bajo ese criterio, que sigue siendo cierto. Pero esa
clasificación nunca evaluó si el parámetro `timeout` hacía algo — pregunta
distinta que quedó fuera del alcance de esa etapa. Hay `isVisible({ timeout:
N })` repartido en buena parte de la suite, varios clasificados como
"opcional legítimo" en la Etapa 2 asumiendo que un chequeo instantáneo era
aceptable ahí — no se auditó si REALMENTE se necesitaba esperar en cada caso.

**Pendiente, no resuelto en esta sesión:** auditar los usos restantes de
`isVisible({ timeout })` que dependen de esperar contenido asíncrono en vez
de un chequeo instantáneo legítimo. Dos candidatos concretos ya identificados
en este mismo archivo (no se tocaron porque no se pudo confirmar que hoy
causen un problema real, y el timeout de 3000ms coincide con el patrón usado
en el resto de la suite):
- `nextWeekBtn.isVisible({ timeout: 3000 })` (línea ~79) — botón estático, no
  parece depender de una carga async, riesgo bajo.
- `filaCita.isVisible({ timeout: 3000 })` (línea ~90) — tras avanzar de
  semana, la tabla se recarga por API; si esto se ejecuta antes de que
  termine de cargar, podría dar un falso "no encontrado" en semanas donde SÍ
  hay cita. No se manifestó en la corrida de verificación (encontró la cita
  en la semana 1, primer intento), pero no se probó el camino de avanzar de
  semana.

## Verificación

`appointments-create` contra dev, 3 corridas iterando sobre el fix (encontrar
la fila → abrir modal → confirmar), hasta que las 3 pasaron limpio en la
última: reutilizó la cita existente de "Percentil" (no creó una duplicada),
encontró la fila en Agenda, abrió el modal y confirmó — 18.1s total, 0
`opcional()` disparados.
