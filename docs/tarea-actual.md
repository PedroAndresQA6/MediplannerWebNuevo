# Tarea actual — Reorganización de la suite

> Encargo vigente. Cuando se complete, este archivo se reemplaza por el
> siguiente encargo y lo hecho se resume en `CONTEXTO.md`.
> Definido el 2026-09-17.

## Por qué

Dos problemas concretos, medidos sobre el repo:

1. `tests/consultation.full-flow.spec.js` son 1050 líneas, de las cuales 686
   (65%) son catorce funciones auxiliares definidas antes del test. El test en
   sí son 364 líneas y ya está bien estructurado en `test.step()`. Cuando algo
   falla, el reporte no dice en qué sección.
2. Hay **112 `catch(() => {})` silenciosos**: 58 en
   `tests/consultation.full-flow.spec.js`, 50 en `e2e/utils.js`, 4 en
   `tests/appointments.create.spec.ts`. Cada uno es un lugar donde una falla
   real se traga sin ruido — exactamente lo que el punto 5 de `CLAUDE.md`
   señala como escondite de bugs.

Se atacan juntos porque al mover cada helper hay que leerlo completo de todos
modos; juzgar su `catch` de paso cuesta casi nada.

## Orden de ejecución

Las etapas son secuenciales. Al terminar cada una, la suite debe correr igual
que antes: mismo resultado, mismos hallazgos. Si una etapa cambia el resultado
de un test, eso es un hallazgo y se documenta antes de seguir.

### Etapa 1 — Instrumentar antes de decidir

No juzgar los 112 `catch` a mano. Primero convertirlos en dato.

Crear en `e2e/opcional.js` un helper compartido:

```js
// Envuelve una operación que PUEDE fallar legítimamente.
// Sigue atrapando la excepción, pero deja registro de que se disparó.
const _disparos = new Map();

async function opcional(promesa, etiqueta) {
  try {
    return await promesa;
  } catch (e) {
    const n = (_disparos.get(etiqueta) || 0) + 1;
    _disparos.set(etiqueta, n);
    console.log(`[OPCIONAL] ${etiqueta} — atrapado (${n}): ${e.message.split('\n')[0]}`);
    return undefined;
  }
}

function reporteOpcionales() {
  return [..._disparos.entries()].sort((a, b) => b[1] - a[1]);
}

module.exports = { opcional, reporteOpcionales };
```

Reemplazar cada `catch(() => {})` por una llamada a `opcional()` con una
etiqueta única y descriptiva (`'citas:modal-confirmar'`,
`'consulta:overlay-recuperando'`). **No quitar ninguno todavía** — en esta etapa
solo se instrumenta.

Correr la suite completa tres veces contra dev y volcar el reporte de
`reporteOpcionales()` al final de cada corrida. El resultado es la lista de qué
se dispara, cuántas veces, y qué nunca se dispara.

### Etapa 2 — Clasificar con el dato en la mano

Con las tres corridas, clasificar cada uno de los 112:

| Si el `catch`... | Acción |
| --- | --- |
| Envuelve una **aserción** | Quitar siempre. Una aserción atrapada no existe. |
| Envuelve la espera de una **precondición** (que cargue una pantalla, que aparezca un botón sin el cual el resto no tiene sentido) | Debe fallar. Convertir en espera dura con mensaje claro. |
| Envuelve un elemento **genuinamente opcional** (aparece a veces) | Se queda como `opcional()`, con un comentario de una línea que diga por qué es opcional. |
| **Nunca se disparó** en las 3 corridas y no es precondición | Quitar: es una red de seguridad muerta. |

Documentar la clasificación en `docs/historial/` cuando termine, con la cuenta
final de cada categoría.

Estimación: de los 112, probablemente unos 20 requieren decisión real.

### Etapa 3 — Extraer los helpers de consulta

Mover las catorce funciones de `tests/consultation.full-flow.spec.js`:

```
e2e/consulta/
  secciones.js     fillGeneralSection, fillApenrienciaGeneralSection,
                   fillChecklistSection, fillDiagnosticoSection,
                   fillTratamientoSection, fillLaboratoriosSection,
                   fillNotasMedicoSection, fillServiciosSection,
                   fillPerimetroCefalico
  navegacion.js    sectionContainer, saltarOnboardingYWizardConfig,
                   iniciarConsultaDelPaciente
  guardado.js      guardarCambiosGlobal, waitForFinalizarButton
```

El spec debe quedar en ~380 líneas. Conservar los comentarios de contexto que
ya tiene (el del rediseño de la pantalla de Consulta y el del mecanismo de
guardado) — moverlos junto al código que describen.

Preservar el typo real de la app: el regex de "Exploración segmentaria" debe
seguir siendo `/^Exploración segmentar[ií]a\s*$/i`.

### Etapa 4 — Partir `e2e/utils.js`

Son 1338 líneas con 16 exports que mezclan responsabilidades distintas:

```
e2e/citas/crear.js       createAppointment (342 líneas)
e2e/citas/agenda.js      asegurarCalendarioDashboard, irADiaEnCalendarioDashboard,
                         checkNextDaysForIniciarButton, buscarBotonIniciarDePaciente
e2e/auditoria.js         auditarPantalla, auditConsultationIndicators,
                         scanResidualIndicators, detectUnsavedSections,
                         collectFlaggedApartados
e2e/consola.js           setupConsoleMonitor
```

Mantener `e2e/utils.js` como fachada que re-exporta todo, para no romper los
imports existentes de un golpe.

### Etapa 5 — `asegurarCitaDeHoy()`

Problema reportado por Pedro: a veces `consultation.full-flow` o
`appointments.create` crean una cita nueva cuando ya hay una activa.

Los dos casos se resuelven distinto, y esto importa:

**`consultation.full-flow.spec.js`** necesita una cita como *precondición*, no
como objetivo. Ahí sí corresponde reutilizar. Crear en `e2e/citas/agenda.js`:

```js
// Devuelve { reutilizada: boolean, ... } y lo deja en el log.
async function asegurarCitaDeHoy(page) { ... }
```

Debe revisar primero la agenda de hoy en Inicio; solo si no hay ninguna cita
programada, crear una. Aprovechar lo que ya existe en
`buscarBotonIniciarDePaciente` y `checkNextDaysForIniciarButton`.

**`appointments.create.spec.ts`** es el caso opuesto: su trabajo es verificar
que crear una cita funciona, así que **debe crear siempre**. Y hoy tiene el
problema inverso — si no encuentra la cita después, registra
`logger.warning('No se encontraron citas agendadas en 4 semanas')` y **termina
en verde**. Ese test pasa siempre, encuentre o no encuentre. Hay que endurecerlo
con un assert duro.

Mismo problema en `appointments.verify.spec.ts`: si no hay cita para verificar,
crea una — con lo cual dejó de verificar que la creación funcionó. Separar la
precondición de la verificación.

## Criterio de aceptación

- `consultation.full-flow.spec.js` en ~380 líneas o menos, corriendo con el
  mismo resultado que antes de la reorganización.
- Los 112 `catch` clasificados, con la cuenta de cada categoría documentada.
- Ninguna aserción atrapada queda en el código.
- Ningún `catch` sobre una precondición queda silencioso.
- `appointments.create.spec.ts` falla si la cita no aparece tras crearla.
- `consultation.full-flow.spec.js` reutiliza una cita existente en lugar de
  crear una nueva cuando ya hay una programada para hoy.

## Recordatorios de la norma

Aplica el punto 7 de `CLAUDE.md`: auditar antes de correr, no después. Antes de
ejecutar cualquier spec modificado, revisarlo contra los puntos 2 y 5 de la
norma.

No commitear sin que Pedro revise. Quedan pendientes de commit los fixes de
selectores del 2026-09-10 y ~15 scripts de diagnóstico sueltos en la raíz.
