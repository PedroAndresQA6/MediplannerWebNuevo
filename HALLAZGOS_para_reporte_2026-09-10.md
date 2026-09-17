# Hallazgos para reporte — Mediplanner — 2026-09-10

> Documento de trabajo, no es el reporte final. Junta los hallazgos confirmados hoy con el contexto y la evidencia necesaria para armar el reporte formal a devs. El detalle crudo (logs completos, scripts) vive en `CONTEXTO.md` y en los scripts `_diagnostico_*` de `scripts-diagnostico/` (y de `Mediplanner Staging/` y `Mediplanner produccion/`) — este documento es el resumen ejecutivo con lo mínimo necesario para escribir el reporte.
>
> **✅ Actualización (2026-09-10, más tarde):** el devteam confirmó y corrigió el problema de `getProfile` en dev. Se reverificó de forma independiente (misma prueba, sin cambios): 5/5 llamadas con 200 OK, y el dropdown de Servicios (Hallazgo B) volvió a funcionar solo. **Los Hallazgos A y B ya están resueltos** — se dejan documentados igual por historial, pero no hace falta incluirlos como pendientes en el reporte formal (podés mencionarlos como "detectado y ya corregido" si querés dejar constancia del trabajo de QA).

---

## Contexto de esta ronda de trabajo

Se reauditaron los specs de automatización (`tests/`) clasificados como confianza Alta/Media, corriéndolos de nuevo contra **dev** (`admin-dev.mediplanner.mx`) para confirmar que seguían siendo válidos. En el camino aparecieron 3 hallazgos que se investigaron a fondo y se confirmaron corriendo la misma prueba en los 3 entornos (**dev**, **staging** — `admin-staging.mediplanner.mx`, y **producción** — `admin.mediplanner.mx`) para saber si son bugs de la aplicación en general o algo puntual de un entorno.

Paciente de prueba usado en cada entorno: "Percentil Prueba Prueba" (dev y staging), "Prueba DE Codigo" (producción, cuenta `pedroandresqa6@gmail.com`).

---

## Hallazgo A — `getProfile` responde error 500 en dev de forma consistente (no intermitente) — ✅ RESUELTO

**Qué se observó:** el endpoint `GET /api/profile/getProfile` devuelve `500 {"message":"Server Error"}` en dev.

**Qué tan seguido pasa:** se contaron todas las respuestas de `getProfile` capturadas a lo largo de toda la sesión de pruebas de hoy (specs oficiales + scripts de diagnóstico, muchas pantallas distintas: Dashboard, Ajustes, Consulta, Reportes, Recetas): **88 de 88 llamadas fallaron con 500. Cero respuestas exitosas.** No es una falla ocasional — está caído de forma consistente en este momento.

**Impacto observado en la UI:**
- En Dashboard: se degrada con gracia, los KPIs igual muestran datos correctos (parecen venir de otro lado).
- En Ajustes → Servicios: rompe la navegación — la app queda varada en `/perfil/Usuario` en vez de `/perfil/Servicios`, con un modal "Error – No responde el servidor".
- Es probablemente la causa raíz del Hallazgo B (ver abajo).

**Comparación entre entornos (misma prueba, mismo día):**

| Entorno | Llamadas a `getProfile` | Resultado |
|---|---|---|
| dev | 88 | **88 con error 500** |
| staging | 7 | 7 con 200 OK |
| producción | 3 | 3 con 200 OK |

**Conclusión:** el problema era específico del entorno dev — no un bug de código que estuviera en staging o producción. Probablemente algo de infraestructura/configuración puntual de dev.

**✅ Reverificado tras el aviso del devteam:** se corrió la misma prueba de nuevo, sin cambiar nada — **5/5 llamadas a `getProfile` con 200 OK**, y las 70 llamadas `/api/` de la corrida completa respondieron bien, sin ningún error. Confirmado resuelto.

**Evidencia técnica disponible:** `scripts-diagnostico/_diagnostico_getprofile_500_dev.js`, `_diagnostico_getprofile_staging.js` (en `Mediplanner Staging/`), `scripts-diagnostico/_diagnostico_servicios_dropdown_vacio_dev.js` (la corrida de reverificación tras el fix), y los logs de las corridas oficiales de los specs (`logs/test-results-reaudit-2026-09-*.log`), todos en el repo.

---

## Hallazgo B — El combobox "Agregar servicios" de la pantalla de Consulta no muestra ninguna opción en dev — ✅ RESUELTO

**Qué se observó:** al llegar a la sección "Servicios" dentro de una consulta y abrir el combobox "Agregar servicios", en dev aparece "No se encontraron elementos" — 0 opciones, siempre, incluso después de confirmar que hay servicios reales configurados y activos para el consultorio (verificado manualmente).

**Investigación de la causa:** se capturó absolutamente toda la actividad de red desde el inicio de la sesión hasta llegar a esa pantalla (69 llamadas a `/api/` en una corrida completa). **En ningún momento se dispara una llamada para pedir el catálogo de servicios** — a diferencia de "Agregar Medicamentos" y "Agregar Procedimiento/Laboratorio" en la misma pantalla, que sí llaman a su propio endpoint de búsqueda y sí muestran opciones con normalidad.

**Comparación entre entornos (misma prueba, mismo día):**

| Entorno | Opciones en el dropdown | Llamada de red al abrirlo |
|---|---|---|
| dev | 0 ("No se encontraron elementos") | **Ninguna** |
| staging | 2 ("Vacunación", "Certificado Médico") | `200 services/getServices` |
| producción | 1 ("Análisis Estructural") | `200 services/getServices` |

**Conclusión:** este combobox dependía de que `getProfile` (Hallazgo A) respondiera correctamente antes de siquiera intentar pedir el catálogo de servicios. Como en dev `getProfile` fallaba el 100% de las veces, el pedido de servicios nunca llegaba a dispararse — **no era un bug independiente, era consecuencia directa del Hallazgo A.**

**✅ Reverificado tras el fix de `getProfile`:** sin ningún cambio en el test, el combobox volvió a funcionar solo — 2 opciones ("Certificado Médico $15", "Examen De la vista $150"), con `POST /api/services/getServices` disparándose con payload `{"doctor_id":"467","hospital_id":2,"activos":1}` — confirma exactamente la dependencia de `doctor_id` planteada como hipótesis. Confirmado resuelto.

**Evidencia técnica disponible:** `scripts-diagnostico/_diagnostico_servicios_dropdown_vacio_dev.js` (incluye la corrida de reverificación), `_diagnostico_servicios_dropdown_staging.js`, `_diagnostico_servicios_dropdown_produccion.js` (uno por entorno, mismo patrón de prueba).

---

## Hallazgo C — Escribir en "General"/"Apariencia general" de una consulta, antes de que termine de cargar del todo, pierde el texto sin avisar

**Qué se observó:** al iniciar una consulta, la pantalla muestra un overlay "Recuperando datos del paciente..." mientras trae datos en segundo plano. Si se escribe en los campos "Motivo de consulta", "Padecimiento actual", "Notas de evolución", "Nombre referido" o "Apariencia general" **mientras ese overlay todavía está activo**, el texto tipeado desaparece en cuanto ese fetch de fondo termina — sin ningún aviso al usuario, y sin que haya ocurrido ningún guardado de por medio.

**Por qué es un hallazgo real y no un problema de la prueba automatizada:** se aisló específicamente esta variable con una repro mínima que NO toca ninguna otra sección de la consulta — solo llena esos campos mientras el overlay sigue visible, y espera a que desaparezca solo. El resultado es 100% reproducible: el texto se pierde siempre.

**Por qué en una prueba manual normal esto no se nota tan fácil:** una persona que llena el formulario a mano normalmente no empieza a escribir en la fracción de segundo exacta en que ese overlay sigue activo — pero un médico apurado, o cualquier automatización que llene el formulario de corrido, sí puede caer en esa ventana.

**Severidad:** alta — es pérdida real de información clínica tipeada, sin ningún aviso.

**Estado:** confirmado con evidencia automatizada (reproducible al 100%). Falta la confirmación manual de Pedro para reforzar el hallazgo antes de reportarlo formalmente (repetir el mismo escenario a mano: escribir en Motivo apenas se abre la consulta, sin esperar a que la pantalla termine de asentarse, y ver si el texto desaparece).

**Evidencia técnica disponible:** `scripts-diagnostico/_diagnostico_general_race_recuperando_dev.js` (la repro aislada y determinística).

---

## Hallazgo D — El botón "Quitar fecha" de una dosis en Vacunación no se puede clickear en vacunas de 4 o más dosis

**Qué se observó:** en la cartilla de vacunación de un paciente, cada dosis con fecha registrada muestra un ícono de basurero ("Quitar fecha") al lado del campo de fecha. En vacunas que requieren **4 o más dosis** (ej. Hexavalente, Influenza, Pentavalente), el botón de las primeras columnas no responde al clic — solo el de la ÚLTIMA columna funciona. En vacunas de 3 dosis o menos (ej. Meningococo, Neumocócica, Rotavirus, VPH, SRP, COVID) todos los botones funcionan bien.

**Cómo se descubrió el alcance real:** la primera repro automatizada encontró el problema probando solo el primer botón de la tabla (que resultó ser de una fila de 4 dosis) y concluyó que el bug era general. Pedro probó a mano con una vacuna de 2 dosis (COVID) y **sí pudo borrar sin problema** — una contradicción real que llevó a revisar **los 32 botones de la cartilla uno por uno**, no solo el primero. El patrón que apareció:

| Vacuna (ejemplo) | Nº de dosis | Resultado |
|---|---|---|
| Hexavalente (4), Influenza (6), Pentavalente (4) | 4 o más | Todas las columnas tapadas, **excepto la última** |
| Meningococo, Neumocócica, Rotavirus, VPH, SRP (3), COVID (2) | 3 o menos | Todas funcionan bien |

Total: **11 de 32 botones afectados (34%)** en la cartilla más completa probada, todos en filas de 4+ dosis.

**Investigación de la causa (no es un problema del selector ni de Playwright):**
1. Se midió la posición real de los elementos: en las filas de 4+ dosis, el campo de fecha de cada columna ocupa una franja más ancha que el espacio real que le corresponde, y **tapa por completo** la caja del botón de borrar de esa misma columna.
2. Se confirmó con `document.elementsFromPoint()` (consulta directa al navegador, no a Playwright) que el elemento que recibe el clic ahí es el campo de fecha, no el botón.
3. Un clic real por coordenadas de mouse (no la lógica de "click inteligente" de Playwright) en esos puntos tampoco disparó el borrado.
4. Se repitió fijando la resolución real del monitor principal de Pedro (1536×912) con el zoom de la página confirmado al 100% — reprodujo idéntico, descartando que sea un efecto del tamaño de ventana de la automatización.

**Causa técnica:** la tabla reparte el ancho disponible entre las columnas de cada fila según cuántas dosis tenga esa vacuna (no es una grilla fija para toda la tabla). Con 4 o más columnas, cada una queda demasiado angosta y el campo de fecha se superpone al botón de la columna siguiente; con 3 o menos hay ancho de sobra y no pasa nada.

**Severidad:** media — impide borrar una dosis mal cargada, pero solo en vacunas con esquemas de 4+ dosis.

**Estado:** ✅ **confirmado por completo, listo para reportar**, con el alcance exacto delimitado (vacunas de 4+ dosis, no todas).

**Evidencia técnica disponible:** `scripts-diagnostico/_diagnostico_vacunacion_click_geometria_dev.js`, `scripts-diagnostico/_diagnostico_vacunacion_click_stack_dev.js`, `scripts-diagnostico/_diagnostico_vacunacion_click_stack_dev_fullres.js`, `scripts-diagnostico/_diagnostico_vacunacion_todas_las_filas_dev.js` (el barrido completo que reveló el patrón real por número de dosis).

---

## Qué quedó fuera de este reporte (a propósito)

- El histórico "`getFilledForm` devuelve el formulario en blanco tras Finalizar una consulta" (Exploración segmentaria/Aparatos y sistemas) — se investigó, hay evidencia de que el guardado sí llega al backend pero la lectura posterior no lo refleja ni después de 130s de reintentos. **Se dejó de lado a pedido explícito de Pedro** porque no bloquea el guardado real de la consulta. Documentado en `CONTEXTO.md` por si se retoma más adelante.
- El viejo "bug de Servicios" (`saveService` responde 200 pero el servicio nuevo no aparece en `getServices`) — no reprodujo en la corrida de hoy. No se cierra del todo (podría ser intermitente) pero no es candidato a reportar por ahora.

## Pendiente antes de reportar formalmente

- Confirmación manual de Pedro del Hallazgo C (carrera de "Recuperando datos del paciente..."). Es el único de los 4 que todavía no se probó a mano.
