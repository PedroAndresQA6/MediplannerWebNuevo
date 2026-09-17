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
impacto visible confirmado en la UI real, verificado a fondo la misma fecha

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
