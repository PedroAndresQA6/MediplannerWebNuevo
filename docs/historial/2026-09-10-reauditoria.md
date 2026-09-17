# Reauditoría de specs Alta/Media confianza — 2026-09-10

> Narrativa completa de la sesión, movida aquí desde `CONTEXTO.md` el
> 2026-09-17. Los hallazgos que siguen vivos están en
> `docs/hallazgos-abiertos.md`; aquí queda el antecedente y el método.

Antes de salir a explorar bugs nuevos, Pedro pidió reauditar —código más
corrida real contra dev, no solo leer el historial— los specs que en agosto se
habían clasificado como confianza Alta o Media, siguiendo el punto 5 de la
norma de `CLAUDE.md`. Se corrieron uno por uno contra
`admin-dev.mediplanner.mx`: `ajustes.servicios` (×2), `auth.setup`,
`consultation.full-flow`/`doctor-consultation` (×3), `dashboard`, `recetas`,
`reportes`, `vacunacion.ciclo-completo` (×2), `ingresos`, `system-health`.

---

## Hallazgo 1 — las dos vueltas en falso

Se dejan documentadas a propósito: son el origen de las normas §0.4 y §0.7 de
`CLAUDE.md`.

**Primera versión (incorrecta).** El tab "General" de una consulta finalizada
"pierde sus datos": `getConsultation` devolvía `motivo`, `padecimiento`,
`notas_evolucion`, `nombre_referido` y `apariencia` vacíos tras Finalizar,
reproducido 2/2 veces y sostenido 5 minutos de polling. Pedro probó lo mismo a
mano y le funcionó perfecto. Esa contradicción obligó a investigar el mecanismo
real en vez de quedarse con cualquiera de las dos versiones.

**Segunda versión (también incorrecta).** Una repro
(`_diagnostico_general_editconsultation_payload_dev.js`) pareció mostrar que
elegir un CIE-10 en Diagnóstico, sin guardar antes, vaciaba los campos de
General al instante. Se escribió como "causa raíz confirmada" — error: el
script usaba el mismo patrón de espera débil que tenía
`consultation.full-flow.spec.js`
(`!body.innerText.includes('Cargando información de consulta')` +
`.catch(() => {})`), copiado sin auditar. Pedro, mirando la corrida en
pantalla, notó que el script arrancaba a interactuar antes de que la consulta
terminara de cargar y preguntó por qué no se había detectado. Un screenshot lo
confirmó: hay un **segundo overlay independiente** ("Recuperando datos del
paciente...", con blur sobre toda la pantalla) que ese chequeo no cubría.

**Repro correcta.** Con `waitForResponse(getConsultation)` + campo Motivo
visible y habilitado + overlay "Recuperando..." ausente, confirmado con
screenshot: elegir el CIE-10 ya no vacía nada. Se retracta el hallazgo del
CIE-10 por completo.

**Causa raíz real:** la carrera contra el overlay. Detalle y repro en
`docs/hallazgos-abiertos.md`.

---

## Hallazgo 2 — `getProfile` 500 en dev ✅ RESUELTO

`GET /api/profile/getProfile` respondió `500 {"message":"Server Error"}` en
todas las corridas del día excepto `ingresos`.
`POST /api/hospitals/getDrHospitals` también devolvió 500 al menos 2 veces, con
un "Error fetching usuarios: undefined" asociado en consola.

**No era intermitente:** se contaron todas las respuestas del día — **88
llamadas, las 88 con 500**. Cero 200 en dev en toda la sesión.

**Específico de dev.** Staging: 7 llamadas, las 7 con 200 OK. Producción (cuenta
QA `pedroandresqa6@gmail.com`): 3 llamadas, las 3 con 200 OK. Eso descartó un
bug de código compartido — era infraestructura/config de dev.

**Impacto por pantalla:** en Dashboard la UI se degradaba con gracia; en
`recetas`/`reportes` el test no lo notaba porque no hace assert duro sobre
errores de API; en **Ajustes → Servicios rompía la navegación** (la app quedaba
varada en `/perfil/Usuario` con un modal "Error – No responde el servidor").
`system-health.spec.ts` y `dashboard.spec.js` fallaban por esto.

**Resolución:** el devteam lo confirmó y corrigió el mismo día. Reverificado de
forma independiente con `_diagnostico_servicios_dropdown_vacio_dev.js` sin
cambios: 5/5 llamadas con 200 OK, y las 70 llamadas `/api/` de la corrida
completa respondieron 200.

**Nota operativa:** al probar en producción, un `storageState.json` viejo
llevaba a una cuenta distinta ("Stephen Strange"). Un login limpio confirmó que
`pedroandresqa6@gmail.com` corresponde a "Pedro Andrés Quijada Anaya", la cuenta
con el paciente QA "Prueba DE Codigo". No reusar un `storageState.json` viejo
sin verificar a qué cuenta corresponde.

**Transparencia:** se creó una cita/consulta real de prueba en producción con
"Prueba DE Codigo" (10/09/2026 13:15); no se borró nada, mismo patrón ya usado
con ese paciente QA dedicado.

---

## Hallazgo 3 — dropdown de Servicios vacío ✅ RESUELTO

En la sección "Servicios" de la consulta, el combobox mostraba 0 opciones ("No
se encontraron elementos"), a diferencia de Medicamentos y Laboratorios, que sí
disparaban su propia llamada de red.

Capturando toda la red desde el inicio de la sesión: al abrir el combobox **no
se disparaba ninguna llamada nueva**. Las 2 respuestas de `getCatalogs` no
traían nada de servicios, y no aparecía ningún equivalente de `getServices` en
las 69 llamadas `/api/` de la corrida.

Se descartó "faltan datos configurados": Pedro confirmó tener 2 servicios
configurados por consultorio y el comportamiento no cambió.

**Causa confirmada con evidencia cruzada de los 3 entornos.** Con `getProfile`
sano, staging devolvía 2 opciones y producción 1, ambas con `200
services/getServices`. El combobox depende de que `getProfile` responda bien
antes de siquiera pedir el catálogo. **No era un bug independiente: era
consecuencia directa del Hallazgo 2.**

Al arreglarse `getProfile`, el dropdown volvió a funcionar solo, sin ningún
cambio de test: 2 opciones, con `POST /api/services/getServices` disparándose
con payload `{"doctor_id":"467","hospital_id":2,"activos":1}` — confirmando la
dependencia de `doctor_id` que se había planteado como hipótesis.

---

## Selectores desactualizados corregidos

Confirmados contra el DOM real antes de tocar el código.

**`tests/consultation.full-flow.spec.js`**

1. El input de Frecuencia Respiratoria tiene `name="frecuencia_respiratoria"`
   (snake_case), no `frecuenciaRespiratoria`. El selector viejo dejaba el campo
   vacío en silencio y, al ser obligatorio, "Guardar" nunca se habilitaba —
   rompía la corrida completa antes de llegar a signos vitales.

2. `sectionContainer` falló de varias formas encadenadas. Primero un `return
   page` roto (`page` no tiene `.elementHandle()`). Corregido a
   `page.locator('body')` como fallback, ese fallback resultó peligroso: con
   scope de página completa, `fillChecklistSection` escribía sus
   "Observaciones" en los primeros `<textarea>` de toda la página —los de
   General y Apariencia general— pisándolos, que es lo que había hecho parecer
   el Hallazgo 1 un problema de backend. Se agregó prioridad al ancestro
   `.card`, que funcionó para "Aparatos y sistemas" pero no para "Exploración
   segmentaria".

   **Causa raíz real**, encontrada con `_reconocer_sectioncontainer_checklist_dev.js`
   volcando `page.getByRole('heading', {level:3}).allTextContents()`: el `<h3>`
   real dice **"Exploración segmentaría"**, con acento en la "í" — un typo de
   la app. El regex nunca matcheaba. Corregido a
   `/^Exploración segmentar[ií]a\s*$/i` para tolerar ambas variantes.

   Verificado end-to-end: "Exploración segmentaria" encuentra sus 8 checkboxes,
   los 5 campos de General/Apariencia general pasan la verificación dura
   post-Finalizar.

3. El comentario del spec sobre que "Exploración segmentaria y Aparatos y
   sistemas tienen su propio botón Guardar Respuestas" está desactualizado —
   ese botón ya no aparece. Cada respuesta se autoguarda vía
   `POST /api/patients/registerAnswers` (200 OK confirmado). Comentario
   corregido.

**`tests/vacunacion.ciclo-completo.spec.ts`**

El botón de borrar dosis ya no es `button.btn-secondary` con texto "×" (0
matches) — ahora es un ícono trash con `title="Quitar fecha"` y clases
`btn-clear text-danger`. El `waitForFunction` que esperaba a que bajara el
conteo usaba el selector viejo, así que su condición (`0 < n`) era `true` desde
el principio y resolvía al instante. El bucle hacía 100 clics contra el mismo
botón sin dejar re-renderizar React, y el conteo nunca bajaba de 32.

Esto retrata como **test roto**, no regresión de la app, el hallazgo de
vacunación documentado el 2026-08-17. Queda pendiente re-confirmar el
comportamiento real con el selector corregido.

---

## Specs que pasaron limpio

`ingresos` (3/3), `recetas` (2/2) y `reportes` (2/2) — los dos últimos con el
500 de `getProfile` de fondo, que sus asserts no son lo bastante duros como
para detectar por sí solos.

## Nota de método

La sesión se ejecutó con 2 agentes en paralelo por un error de coordinación
(uno quedó corriendo de más sin que se lo pidiera). No debería haber afectado
la validez de los hallazgos —los specs se corrieron de a uno contra el mismo
entorno, sin corridas simultáneas superpuestas en los logs— pero se deja
anotado por transparencia.
