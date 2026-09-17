# Hallazgos abiertos — Mediplanner

> Hallazgos vivos con su repro y evidencia. Uno resuelto sale de aquí y se
> archiva en `docs/historial/`. El resumen de una línea de cada uno está en
> `CONTEXTO.md`.

---

## Hallazgo 1 — Carrera de datos en "General" / "Apariencia general"

**Severidad:** alta · **Estado:** causa raíz confirmada, falta confirmación manual de Pedro

Si se escribe en "General" o "Apariencia general" mientras el overlay
"Recuperando datos del paciente..." sigue activo, el fetch de fondo pisa el
formulario al resolver y lo tipeado se pierde sin aviso. Son los dos únicos
apartados sin botón de guardado propio, y los primeros que se llenan en el
flujo típico.

**Repro determinística:** `scripts-diagnostico/_diagnostico_general_race_recuperando_dev.js`. Llena
los 4 campos de "General" con el overlay visible a propósito, sin tocar ninguna
otra sección, y deja que el fetch termine solo.

```
Overlay "Recuperando datos del paciente..." visible AL ESCRIBIR: true
Justo después de escribir:  motivo = "RACE-REPRO: motivo escrito mientras..."
Después de que el overlay terminara: motivo = "" (vacío)
```

**Por qué no lo ve una persona:** un humano no escribe en la milésima exacta en
que el overlay sigue activo. La automatización rellena apenas el campo es
técnicamente interactuable, así que cae en la ventana casi siempre.

**Mitigación aplicada en la suite:** `consultation.full-flow.spec.js` usa
`auditarPantalla()` —extendido para reconocer también "recuperando...", no solo
"cargando..."— antes de llenar General.

**Pendiente:** que Pedro escriba rápido en Motivo apenas se abre la consulta y
confirme el mecanismo a mano, para tener evidencia no automatizada antes de
reportarlo.

**Dos pistas falsas descartadas en el camino** (se conservan porque explican la
norma §0.4 y §0.7 de `CLAUDE.md`): no es pérdida de datos del backend tras
Finalizar, y no es el CIE-10 de Diagnóstico. Detalle en
`docs/historial/2026-09-10-reauditoria.md`.

---

## Hallazgo D — Botón "Quitar fecha" inclickeable en Vacunación

**Severidad:** media/alta · **Estado:** cerrado, listo para reportar

En la tabla de Vacunación, el `<input type="date">` de una dosis desborda su
celda y tapa por completo la caja del botón "Quitar fecha" de la columna
siguiente. El clic nunca llega al botón.

**Alcance preciso:** afecta solo a vacunas de **4 o más dosis**, y en esas, a
todas las columnas **excepto la última**. Son 11 de 32 botones (34%).

| Vacuna | Columnas de dosis | Resultado |
| --- | --- | --- |
| Hexavalente (4), Influenza (6), Pentavalente (4) | 4 o más | Todas tapadas excepto la última |
| Meningococo, Neumocócica, Rotavirus, VPH, SRP (3), COVID (2) | 3 o menos | Libres, el clic funciona |

La tabla reparte el ancho disponible entre las columnas de *cada fila* según
cuántas dosis tenga esa vacuna. Con 4+ columnas cada una queda demasiado
angosta y el campo de fecha se superpone al botón de la siguiente.

**Geometría medida:** el `<input>` va de x=972 a x=1100.8 (128.8px); el botón de
x=979.6 a x=1011.6 (32px) — el botón completo queda dentro de la caja
interactiva del input. La celda mide 160.8px, pero input + 2 botones +
separación necesitan ~200px.

**No es artefacto de Playwright.** Confirmado con `document.elementsFromPoint()`
(devuelve el input, no el botón) y con `page.mouse.click` nativo por
coordenadas (el conteo de dosis no bajó: 32 antes, 32 después). Reproducido
también al viewport real del monitor de Pedro (1536×912, `devicePixelRatio=1`,
zoom 100%).

**Evidencia:** `scripts-diagnostico/_diagnostico_vacunacion_click_geometria_dev.js`,
`scripts-diagnostico/_diagnostico_vacunacion_click_stack_dev.js`,
`scripts-diagnostico/_diagnostico_vacunacion_click_stack_dev_fullres.js`,
`scripts-diagnostico/_diagnostico_vacunacion_todas_las_filas_dev.js` (el barrido de los 32 botones,
que reveló el patrón).

**Nota:** el botón de basurero solo aparece cuando la dosis tiene fecha
registrada. Eso es comportamiento esperado, no parte del problema.

---

## `getFilledForm` en blanco/404 tras Finalizar

**Estado:** confirmado a nivel API (3/3 corridas limpias, 2026-09-17) — sin
impacto visible confirmado en la UI real, verificado a fondo la misma fecha.
**Actualización 2026-09-17 (noche): factor de confusión real encontrado en el
propio test, sin confirmar aún cuánto explica del hallazgo.**

Al endurecer la precondición de `doctorId` en la Etapa 2 de
`docs/tarea-actual.md` (dejar de tragar en silencio el fallo de captura), el
test empezó a fallar con `doctorId=FALTA` en el 100% de las corridas. Causa:
el listener `page.on('response', ...)` que captura `doctor_id` desde
`getProfile` se registraba DESPUÉS de que `getProfile` ya se hubiera llamado
(ocurre solo durante la carga del Dashboard, dentro de
`iniciarConsultaDelPaciente`, nunca durante la carga de la página de
Consulta) — con lo cual `doctorId` quedaba SIEMPRE `null` desde que este
mecanismo se introdujo (`git blame`: commit `4bc4072`, 2026-07-30), y todas
las llamadas a `getFilledForm` de la verificación post-Finalizar se hicieron
siempre con `doctor_id: null`.

**Esto es exactamente el escenario que el propio comentario del código ya
documentaba** ("getFilledForm responde 200 con el formulario VACÍO en
blanco, sin avisar, si falta doctor_id") — pero nunca se había confirmado que
`doctorId` realmente estuviera faltando en las corridas reales hasta ahora.
Se corrigió moviendo el registro del listener a antes de
`iniciarConsultaDelPaciente()` (ver `tests/consultation.full-flow.spec.js`).

**Lo que falta confirmar antes de tocar este hallazgo:** si las 3 corridas
limpias de la Etapa 1 (2026-09-17 mañana) y la investigación de 2026-07-30
(`_investigar_getfilledform_blanco_dev.js`, que concluyó "retraso de
propagación transitorio, ~100s") corrieron también con `doctor_id: null` —
de ser así, esa investigación pudo haber estado midiendo el efecto de
`doctor_id` faltante (que causaría 200-en-blanco de forma consistente, no un
retraso transitorio) en vez de, o además de, un retraso real del backend. No
se reescribe la conclusión anterior sin volver a correr con `doctorId`
realmente capturado y comparar — exactamente lo que pide CLAUDE.md §0.4: no
racionalizar sin evidencia de la corrida correcta.

**Corrida de confirmación con `doctorId` real (2026-09-17, ya con el listener
corregido):** con `doctorId=467` correctamente capturado, la propia
verificación del test (`fetchApi('patients/getFilledForm', ...)`, la que
tiene reintentos) **resolvió a la primera, sin ningún reintento**, para las
dos secciones ("Exploracion segmentaria" y "Aparatos y sistemas") — 17 y 31
elementos respectivamente, todos los valores comparados correctos. Esto
apoya la hipótesis de arriba: con `doctor_id` correcto, la propia
verificación ya no necesita esperar nada.

**Pero el hallazgo del 404 sigue reproduciendo, ahora limpio y sin el
confound de `doctor_id`:** el test igual falló, esta vez por
`result.failedApiCalls` — la propia app (no el test) dispara **sus dos
llamadas internas** a `getFilledForm` (parte de su ráfaga normal de refetch
tras Finalizar) a los +73.56s, y ambas responden **404** ("No se encontró el
formulario asignado al paciente") a los +75.35s. Esas dos llamadas internas
de la app usan su propio `doctor_id` de sesión (no el que captura nuestro
test), así que el bug de captura de arriba no las explica. Confirmado que
resuelven solas ~3s después: el test vuelve a pedir los mismos formularios a
los +76.25s y esta vez responden 200 con datos correctos a los +78.09s.

**Conclusión provisoria (con evidencia de ESTA corrida, no de las
anteriores):** hay dos fenómenos distintos mezclados en las investigaciones
previas — (1) `doctor_id` faltante en la verificación del propio test
(bug de test, ya corregido) y (2) un race condition real y propio de la app,
donde sus llamadas internas a `getFilledForm` piden el formulario antes de
que el backend haya terminado de propagar los datos recién guardados, y
resuelve solo en <5s (no ~100s como se documentó en 2026-07-30 con
evidencia contaminada por (1)). Falta una corrida dedicada, sin el bug de
`doctor_id` de por medio desde el principio, para remedir cuánto tarda
realmente (2) — la medición de "~100s" queda en duda, no confirmada ni
descartada.

`getFilledForm` de "Exploración segmentaria" y "Aparatos y sistemas" devuelve
**404** ("No se encontró el formulario asignado al paciente") tras Finalizar,
pese a que `POST /api/patients/registerAnswers` responde `200 {"status":"OK"}`
durante el llenado. Reproducido limpio 3 veces seguidas el 2026-09-17 (Etapa 1
de `docs/tarea-actual.md`, corriendo `doctor-consultation` sin tocar nada),
**sin resolver ni tras 260s de reintentos** (peor que lo medido el
2026-07-30, que resolvía en ~100s) — hay una corrida donde tampoco resolvió
para "Aparatos y sistemas" tras otros 130s adicionales.

**Verificación de impacto real en UI (2026-09-17, con evidencia de screenshot,
no solo texto):** se revisó si esto se traduce en una sección vacía/rota
cuando se reabre la consulta por los dos caminos que existen (punto 3 de
`CLAUDE.md`) —

- Vista completa "Ver consulta" desde perfil del paciente → Consultas →
  seleccionar la consulta: datos completos y correctos, confirmado a 1s de
  Finalizar y de nuevo a los 392s.
- Las 5 sub-pestañas de esa misma vista (General, Exploración, Diagnóstico,
  Tratamiento, Notas del Médico (Privado)): las 5 muestran el dato completo y
  correcto — incluyendo los 23 ítems del checklist (8 + 15) con Normal/Anormal
  y Observaciones exactos.

**No se encontró ningún lugar de la UI donde este 404 se vea reflejado.** El
bug de API es real y reproducible, pero no bloquea el guardado real ni se
pudo confirmar que afecte a un doctor navegando por los caminos normales de
la app. Podría ser una llamada interna sin una pantalla real asociada — no
identificado. Reevaluar si aparece evidencia de otra ruta de UI que sí lo
use.

**Evidencia:** las 3 corridas de `doctor-consultation` con
`scripts-diagnostico/_run-all-dev-3x.sh` (adaptado a solo 2 proyectos),
`scripts-diagnostico/_diagnostico_getfilledform_ui_real_dev.js` (repro
completa con tag único + revisión repetida en el tiempo) y
`scripts-diagnostico/_diagnostico_getfilledform_subpestanas_dev.js` (barrido
de las 5 sub-pestañas de una consulta ya finalizada). Screenshots en
`logs/getfilledform-uireal-screenshots/` y
`logs/getfilledform-subpestanas-screenshots/`.

---

## `saveService` / `getServices` — no reprodujo

**Estado:** en observación, no cerrado

El bug documentado el 2026-08-03 y reconfirmado el 2026-08-17 (`saveService`
responde 200 con un `id_servicio` nuevo que después no aparece en
`getServices`) no reprodujo el 2026-09-10: se creó `QA_REPRO3_REAUDIT_...`
(`id_servicio=22`) y tras recargar sí apareció
(`scripts-diagnostico/_diagnostico_getservices_persistencia_dev.js`).

Una sola corrida limpia no alcanza para cerrarlo — podría ser intermitente. Se
deja como "no reprodujo esta vez".
