# CONTEXTO — MediplannerWebNuevo

> **Qué es este archivo:** documento vivo de contexto del proyecto. Sirve para (a) comunicar en qué estamos trabajando y (b) poner al tanto a una sesión nueva de Claude Code (en esta u otra computadora). **Mantenerlo actualizado y commitearlo** cada vez que cambie el estado del trabajo.
>
> **Última actualización:** 2026-07-30, cuarta pasada (**📐 NUEVA NORMA PERMANENTE: metodología de pruebas anti-racionalización, ver `CLAUDE.md` §0.** Se agregó tras un error real: la misma evidencia de un problema (checklists sin cargar en la consulta finalizada) se descartó 3 veces en la misma sesión con una hipótesis benigna sin verificarla. Reglas: inventario completo antes de probar, centinelas automáticos (`auditarPantalla()` en `e2e/utils.js`) en TODA prueba sin importar el foco, verificar todo el estado final y preguntar por otras vistas del mismo dato, prohibido racionalizar anomalías sin evidencia de esa corrida, auditar excepciones ya existentes, lectura estructurada de screenshots. Aplicando la regla de inmediato: se corrigió `consultation.full-flow.spec.js` (el caso de `getFilledForm` en blanco tras Finalizar, antes silenciado como "no bloqueante" sin reintentos reales, ahora reintenta de verdad con esperas largas ~65s) y, al correrlo, **el formulario de Exploración segmentaria/Aparatos y sistemas SIGUIÓ EN BLANCO tras los 65s completos** — ya no es un caso descartable sin más. Investigación en curso (script `_investigar_getfilledform_blanco_dev.js`, monitoreo de 5 min por API y UI) para determinar si resuelve más tarde (la nota original de 2026-07-28 afirmaba "1-2 minutos" sin haberlo esperado dentro de un test) o si es un bug real persistente — ver sección "🔬 Investigación: ¿getFilledForm en blanco es transitorio o real?" más abajo (completar tras el resultado). Anterior, misma sesión: (**⚠️ RETRACTADO: el hallazgo de "carrera de búsqueda en CIE-10" no se reproduce con timing realista.** A pedido de Pedro, se re-corrió con tecleo humano real (80-140ms/tecla), una pausa de reconsideración de 600ms y espera generosa a que cargara la búsqueda final — el combobox se resolvió correctamente al código final tipeado, y se confirmó vía API que el diagnóstico correcto quedó guardado tras Finalizar. La corrida anterior usaba un hueco de solo 150ms con `fill()` instantáneo, un ritmo no representativo de una persona real — **se retracta el hallazgo, no reportar a devs tal como estaba planteado.** Ver sección "⚠️ Retractado tras re-prueba con timing realista". Anterior, misma sesión: (**🐛 hallazgo NUEVO confirmado con impacto clínico persistente: carrera de búsqueda en el combobox CIE-10 de Diagnóstico** — escribir un código y cambiarlo rápido antes de que resuelva deja seleccionado el código ANTERIOR, no el final tipeado; se completó el flujo real hasta Finalizar Consulta y se confirmó vía API (`getConsultation`) que el diagnóstico equivocado ("TOS" en vez del código buscado) queda guardado PERMANENTEMENTE en la consulta ya finalizada, sin ninguna advertencia — mismo patrón ya conocido en Medicamento/Laboratorio, ahora confirmado también en CIE-10 con persistencia real — ver sección "🐛 Segunda tanda... — 1 hallazgo NUEVO confirmado". El mismo patrón probado en el combobox de Servicios NO reprodujo (filtra localmente, sin ventana de carrera). También se probó sin hallazgos el monto de pago en Ingresos (sobrepago ignorado silenciosamente por el backend — ojo, hay que revisar el body real de la request, no solo el status 2xx) y se dejó sin profundizar la doble reserva de horario en Agenda (requeriría 2 sesiones en paralelo). A pedido de Pedro, esta tanda se enfocó en áreas NUEVAS en vez de reverificar hallazgos ya conocidos, y se evitó deliberadamente el wizard de onboarding "Configuración de tu cuenta" (Pedro lo prueba a mano). Anterior, misma sesión: (**sesión de error guessing en dev buscando 3 clases de bug a pedido de Pedro: valores incorrectos, avance con campos obligatorios vacíos, pérdida de progreso al navegar sin guardar** — ver sección "🎯 Error guessing en DEV — 2026-07-30" más abajo. Resultado: la mayoría de las pantallas probadas (alta de paciente nuevo, ficha del paciente con CP→Colonia/CURP/fecha de nacimiento, signos vitales) están **bien validadas, sin hallazgos nuevos**; sí se **reprodujo 2/2 veces** un 404 de `getFilledForm` justo tras Finalizar una consulta (posible reaparición en dev de un bug ya "solucionado" en staging). También se corrió por primera vez el `consultation.full-flow.spec.js` reescrito el 2026-07-28 (checklist Normal/Anormal + verificación dura post-Finalizar) — la verificación dura pasó limpia las 2 veces. A media sesión Pedro pidió priorizar bugs nuevos sobre reverificar los ya conocidos (memoria `feedback-priorizar-bugs-nuevos-sobre-reverificar`), así que no se insistió en volver a confirmar el bug del botón "Consulta" del 2026-07-28 más allá de 1 corrida adicional (que esta vez, con un paciente distinto, no llegó a navegar a la consulta — variabilidad no investigada). Anterior: 2026-07-28 (**bug real confirmado: el botón "Consulta" (atajo en el perfil del paciente) permite crear la consulta con Tipo de Cita y Hospital vacíos** — a diferencia del wizard completo "Agendar cita" (que sí bloquea "Continuar" si faltan esos campos), el modal del botón "Consulta" deja "Crear consulta" habilitado con los 2 selects en su valor por defecto ("Sin cita"/"Seleccione un hospital") y crea la consulta igual; el error real ("Se necesita asignar el tipo de la consulta") aparece recién más tarde y desconectado, al apretar "Guardar cambios" YA DENTRO de la consulta creada — ver sección "🐛 Bug confirmado: botón 'Consulta' crea con Tipo/Hospital vacíos" más abajo. Se investigó primero la hipótesis del wizard "Agendar cita" como posible vector (descartada: si bloquea correctamente) antes de aislar el botón "Consulta" como el causante real. Mismo día: **`consultation.full-flow.spec.js` endurecido significativamente** — ahora marca y verifica **todos** los checkboxes de Exploración segmentaria/Aparatos y sistemas (no solo 3 al azar), completa el sub-formulario Normal/Anormal + Observaciones que revela cada checkbox (antes no se tocaba), llena también "Otros medicamentos"/"Agrega tratamiento diferente" en Tratamiento, y agrega una **verificación dura post-Finalizar** que relee la consulta completa vía API (`getConsultation`/`getTreatments`/`getForms`/`getFilledForm`) y hace fallar el test si algún campo llenado no coincide exactamente con lo guardado — ver sección "🔧 Endurecimiento de `consultation.full-flow.spec.js`" más abajo (mecanismos descubiertos en el camino: `getFilledForm` puede devolver el formulario en blanco por un rato justo tras Finalizar por retraso de propagación del backend, no pérdida real; hay que usar `page.request` y no `fetch()` de la propia página para leer datos frescos tras finalizar). También se exploró (solo mapeo, sin hallazgo aún) el wizard de **alta de paciente nuevo** (`/Pacientes` → "Agregar paciente" → "Crear perfil de paciente nuevo") — queda como candidato pendiente para probar campos obligatorios/selects dependientes (ver Decisiones abiertas). **Nota:** esta sesión no llegó a ejecutar el full-flow reescrito contra dev todavía — queda pendiente para la próxima corrida confirmar que la nueva verificación dura pasa limpia. Anterior: 2026-07-27 (**corrida completa de la suite Appium de `MediplannerAppiumAutomation/` — app móvil de Mediplanner para PACIENTES** (dependientes, consultas, médicos, medicinas, perfil, bitácora, etc.), a pedido de Pedro — **26 passed, 16 failed, 5 errors** de 42 tests (excluyendo los marcados `destructivo`), en ~26 min contra el emulador ya corriendo. La mayoría de los fallos tiene indicios claros de ser el emulador/infraestructura flaky (ya documentado) y no bugs reales — ver sección "📱 Suite Appium — Mediplanner pacientes" más abajo para el detalle y la lista de candidatos que sí ameritan revisión antes de reportarlos como bugs (el más sospechoso: `test_consultas_reprogramar_cita`, "no hay tipos de consulta disponibles"). Anterior, mismo día: **se intentó reproducir los 2 hallazgos de error guessing en DEV, a pedido de Pedro, para confirmar si son de la plataforma en general o específicos de producción** — resultado mixto: el **Hallazgo 1 (consulta colgada al navegar fuera y volver) SE REPRODUJO igual en dev**, confirmando que es un bug de la plataforma, no de producción específicamente. El **Hallazgo 2 (Finalizar sin re-guardar pierde el cambio) NO se pudo verificar en dev** pese a 6+ intentos — el entorno resultó considerablemente más inestable que producción para este flujo: la cuenta de dev usada cae de forma **intermitente** (a veces sí, a veces no, dentro de la misma sesión ya autenticada) en un wizard extendido de "Configuración de tu cuenta" (6 pasos: perfil/credenciales/consultorios/horarios/tipos de cita/métodos de pago, distinto del onboarding simple ya visto en producción) que bloquea el acceso al Dashboard real de forma no determinística. Se corrigieron varios problemas de timing en el camino (espera robusta de "Cargando...", manejo del wizard de configuración, espera específica de que "Agenda de hoy" termine de poblarse) pero el último bloqueo (el wizard reapareciendo) no se llegó a resolver con más reintentos — se decidió no seguir iterando indefinidamente. Ver sección "🐛 Error guessing — reproducción en DEV" más abajo. Anterior, mismo día: **"error guessing" contra PRODUCCIÓN, a pedido de Pedro: agendar cita nueva e intentar provocar errores reales de médico dentro de la consulta** — 2 hallazgos reales confirmados con evidencia: (1) navegar fuera de una consulta en curso (a Pacientes) y volver por URL directa la deja colgada PERMANENTEMENTE en "Cargando información de consulta" — ni un F5 la recupera, confirmado en 2 corridas independientes; (2) editar un campo (ej. Impresión diagnóstica) DESPUÉS de haber apretado "Guardar cambios" y luego "Finalizar Consulta" sin volver a guardar **pierde ese último cambio en silencio, sin ninguna advertencia**. Ver sección "🐛 Error guessing en PRODUCCIÓN" más abajo para el detalle completo, incluidos 4 escenarios que SÍ pasaron limpio (typo corregido, carrera al cambiar de medicamento buscado, doble-click en "Guardar Respuestas" de checklist, doble-click en "Guardar cambios" global — este último dispara llamadas de red duplicadas pero el backend no duplica los datos). Anterior, mismo día: **prueba manual completa de consulta contra PRODUCCIÓN, con el paciente dedicado "Prueba DE Codigo"** — confirmó que producción YA tiene el nuevo "Modo Completo" (igual que dev desde el 2026-07-23) y que el flujo completo guarda todo correctamente: 0 errores de API en signos vitales + 9 secciones + guardado global (7 endpoints) + finalización, y cada campo llenado coincide exactamente con lo devuelto por la API tras guardar. Ver sección "🟢 Prueba completa en PRODUCCIÓN" más abajo para el detalle, incluidos 2 hallazgos técnicos nuevos (no bugs de la app): los `relacion_id` de formulario de checkboxes son **distintos por entorno** (dev: 116/115, producción: 7/6 — hay que descubrirlos con `getForms` en vez de asumirlos) y `getProceduresList`/`getFilledForm` requieren `doctor_id` en el body además de `paciente_id`/`consulta_id` (si falta, el primero responde error explícito pero el segundo responde 200 con el formulario **vacío en blanco**, sin avisar — riesgo de falso negativo al verificar). Anterior: 2026-07-23 (**segunda ronda de verificación manual, quedó A MEDIAS a pedido de Pedro** — encontró y corrigió otro bug real del test: selección de medicamento/laboratorio en Tratamiento/Laboratorios no comprobaba que la opción clickeada coincidiera con lo buscado, y el log mentía mostrando el término buscado en vez de lo realmente clickeado. Corregido y parcialmente reverificado. Quedó pendiente terminar de verificar el nombre exacto de medicamento/laboratorio guardado y las selecciones de checkboxes de Exploración/Aparatos y sistemas — ver sección "🔍 Segunda ronda de verificación manual". **Hay un script sin terminar:** `_verificar_ultima_consulta.js` en la raíz del repo (no trackeado) — retomar desde ahí, no borrar). Anterior, mismo día: verificación manual post-reescritura encontró y corrigió el bug de "Motivo de consulta" (ver sección "🔍 Verificación manual post-reescritura"). Anterior, mismo día: **`consultation.full-flow.spec.js` reescrito y verificado** para el nuevo "Modo Completo" de la pantalla de Consulta — ver sección "🚨 Rediseño de la pantalla de Consulta" → "✅ Reescritura completada y verificada" más abajo para el detalle completo. Backup de la versión de pestañas en `tests/consultation.full-flow.spec.js.backup`. Anterior, mismo día: hallazgo del rediseño en sí (la pantalla pasó de pestañas clickeables a una sola página con las 10 secciones visibles a la vez), detectado corriendo el full-flow "semi manualmente" apartado por apartado a pedido de Pedro. Anterior: 2026-07-21 (nuevo spec `tests/consultation.user-errors.spec.js` con 6 tests de "error guessing" — errores humanos reales, no fuzzing de seguridad — pero **escrito y sin verificar aún contra dev** (ver sección "🧪 Pendiente: verificar consultation.user-errors.spec.js" más abajo); a pedido de Pedro se dejó documentado como pendiente para retomarlo después, sin correr las 6 corridas todavía). Anterior, mismo día: re-verificación del bug 422 "relacion_id" con 3 corridas limpias de `doctor-consultation` → se baja a "no reproduce", ver sección "🔁 Re-verificación del bug 422". Anterior, mismo día: limpieza de archivos muertos + fix del selector roto de la lista de Pacientes en dev + 2 bugs de test encontrados y corregidos al verificar el fix en los 7 specs afectados (ver sección "🔧 Fix selector de Pacientes" más abajo). Anterior: 2026-07-21 (`8c358b2`, en `AppEstacionamientosColaboradores/` — sesión de reverificación de los bugs de plataforma de Estacionamientos antes de reportarlos formalmente a devs. Resultado: **se retractó el hallazgo de prioridad ALTA "'Cancelar' libera el espacio igual"** — recon manual con coordenadas exactas de los botones y capturas en cada paso probó que la app SÍ se comporta bien; el bug real estaba en el propio harness (`codigos_de_espacios_visibles()` matcheaba el título del sidebar, que queda abierto tras cancelar, como si fuera una fila real de la tabla). Se corrigió el helper (exige contenido multilínea) y se quitó el `xfail` de `test_9_4_liberar_espacio_cancelar`, que ahora pasa limpio. También se **corrigió y acotó** el hallazgo del chip "En línea" (módulo 13): una prueba controlada (verde estable → cortar red real confirmada por `dumpsys` → rojo a los 15s → reconectar → verde de nuevo) mostró que el **color del punto sí refleja la conectividad real** — el bug queda reducido a que el *texto* se queda fijo en "En línea", bajando de prioridad media a cosmético. Se reconfirmaron en vivo (con evidencia nueva, no solo pytest) los 5 hallazgos del portal web (sin evidencia fotográfica obligatoria, duplicidad silenciosa, pérdida de datos sin red, "Levantar falta" sin motivo preseleccionado, copy "obligatorio"/"obligatoria") y los 2 de app móvil que siguen en pie (crash del SDK de Maps confirmado con tombstone nuevo, permiso de ubicación silencioso reconfirmado). Detalle completo en `AppEstacionamientosColaboradores/HALLAZGOS.md`. Anterior: 2026-07-20 (tres commits. Dos en `AppEstacionamientosColaboradores/`, proyecto de estacionamientos "Querétaro con Futuro" — no Mediplanner: `9759a01` completó los módulos 8-13 del checklist de operador en la suite Appium — check-in, espacio ocupado, reporte/infracción, cierre de turno, permisos del sistema y resiliencia/ciclo de vida — más un fix de encoding en `conftest.py`; `f168d89` agregó una nueva suite **Playwright** para el portal web admin del mismo proyecto, con un test combinado Appium+Playwright y 5 hallazgos nuevos de plataforma — detalle completo en el `CONTEXTO.md`/`HALLAZGOS.md` propios de esa carpeta, no duplicado acá. El tercero, `0665923`, es de `MediplannerAppiumAutomation/` — módulo de bitácora + fix de espera en `test_perfil.py`; commiteado directo en este repo porque se confirmó que esa carpeta **ya no tiene su propio `.git`** pese a lo que decía la sección "Repos separados" — ver esa sección, corregida y marcada como pendiente de resolver con Pedro). Anterior: 2026-07-14 (se corrieron en **staging** los mismos tests adaptados en dev el 2026-07-09/10 — `doctor-consultation` y `ingresos` — para confirmar que el porteo, que había quedado sin commitear, funciona; commiteado en `807fe43`/`62e285c`. Ver sección STAGING abajo). Anterior: 2026-07-09 (re-verificación de los 2 bugs de plataforma pendientes: 422 relacion_id sigue vivo con otro endpoint, indicador "sin guardar" de Laboratorios ya no reproduce — ver sección homónima abajo). Mismo día, antes: rediseño de Ingresos + fix del wizard "Agendar cita" + paciente parametrizable. Anterior: 2026-07-07 (verificación de pendientes vs. código + corridas reales; + nueva suite Appium independiente en `AppEstacionamientosColaboradores/`)

---

## 🎯 Error guessing en DEV — 2026-07-30 (a pedido de Pedro: valores incorrectos, bypass de campos obligatorios, pérdida de progreso sin guardar)

Sesión dedicada a buscar activamente las 3 clases de bug que pidió Pedro: (a) el usuario ingresa valores incorrectos, (b) se puede avanzar/guardar con campos obligatorios vacíos, (c) se puede avanzar/navegar sin guardar y el progreso se pierde. A media sesión, Pedro aclaró que prefiere que se priorice encontrar **bugs nuevos** por sobre re-confirmar hallazgos ya conocidos (ver memoria `feedback-priorizar-bugs-nuevos-sobre-reverificar`) — el resto de la sesión se reorientó en consecuencia.

**1. `doctor-consultation` full-flow reescrito (ver sección de endurecimiento más abajo) — corrido 2 veces contra dev:**
- ✅ La verificación dura nueva (post-Finalizar, compara todo lo llenado contra la API) **pasó limpia las 2 veces** — confirma que el endurecimiento del checklist Normal/Anormal funciona correctamente.
- 🐛 **Hallazgo reproducido 2/2 corridas, idéntico:** justo después de "Finalizar Consulta" (+95-103s), la propia app dispara 2 llamadas a `getFilledForm` que responden **404** `"No se encontró el formulario asignado al paciente"` (consola: "Error fetching formularios paciente: undefined" ×2) — esto hace fallar el assert `expect(failedApiCalls.length).toBe(0)` del test. Es la reaparición, en DEV, del mismo síntoma que ya se había documentado como "solucionado por devs" en **STAGING** el 2026-07-21 (404 `getFilledForm` al finalizar consulta) — o bien nunca se corrigió en dev, o es una variante nueva relacionada. **Pendiente:** identificar cuál formulario específico intenta pedir la app en ese momento (probablemente el panel "Expediente" del lateral) y confirmar con devs si el fix de staging llegó a dev.

**2. Alta de paciente nuevo (`/Pacientes` → "Agregar paciente" → "Crear perfil de paciente nuevo") — sin hallazgos, bien validado:**
- Nombre vacío, nombre solo espacios, y correo vacío: **bloqueados en el front**, 0 requests al backend.
- Correo con formato inválido: dispara una búsqueda en vivo contra `searchPatients` (probablemente para detectar duplicados) que el backend rechaza con 400 "El correo electrónico no es válido" — el guardado real nunca llega a dispararse.
- Teléfono con letras (`abcXYZ!!`): el input lo sanea a **vacío** (rechaza los caracteres no numéricos mientras se escribe) y, si se envía vacío, el backend responde 400 "El formato del teléfono 1 no es correcto" — el paciente no se crea.
- Conclusión: este formulario está bien defendido tanto en front como en backend.

**3. Ficha del paciente ("Información General") — sin hallazgos, sin embargo se cerró un candidato pendiente de memoria:**
- **CP → Colonia (select dependiente, candidato marcado como "sin probar" en memoria):** CP inexistente ("00000") no puebla ninguna colonia ni ciudad (correcto). CP válido (76000 = Querétaro) resuelve bien. **Carrera CP→Colonia** (escribir 76000, cambiар a 44100 sin esperar): el resultado final coincide correctamente con el ÚLTIMO CP (Guadalajara/Jalisco, colonia "Guadalajara Centro") — **no hay bug de carrera aquí**, a diferencia del patrón ya confirmado en el botón "Consulta".
- **Fecha de nacimiento en el futuro (2099-01-01):** bloqueada por validación nativa HTML5 (`max` = fecha de hoy), con mensaje visible "El valor debe ser igual o anterior a 30/07/2026". 0 requests, no persiste.
- **CURP con formato inválido ("12345INVALIDO"):** bloqueada también, 0 requests, no persiste.

**4. Signos vitales con valores clínicamente imposibles (peso -15, talla -50, temperatura -40, FC -80):** el botón "Guardar" del modal "Capturar signos vitales" queda **deshabilitado**, 0 requests al backend. Bien validado.

**5. Antecedentes — pérdida de progreso al navegar sin guardar:** no se pudo probar tal cual (la pantalla usa formularios dinámicos por pregunta, mismo patrón que los checklists de Consulta, no textareas simples como se asumió). Se descartó una falsa alarma en el camino: el texto "Cargando preguntas" que aparece en cada apartado resuelve en ~2s, no se queda colgado (no es el patrón "Hallazgo 1" de Consulta). Queda pendiente repetir esta prueba con los selectores correctos si se retoma.

**Scripts nuevos de esta sesión** (raíz del repo, no trackeados, mismo criterio que los anteriores): `_error_guessing_alta_paciente_dev.js`, `_error_guessing_alta_paciente_dev2.js`, `_error_guessing_alta_paciente_dev3.js`, `_error_guessing_ficha_paciente_dev.js`, `_error_guessing_ficha_paciente_dev2.js`, `_error_guessing_signos_vitales_dev.js`, `_error_guessing_antecedentes_sin_guardar_dev.js`, `_diagnostico_antecedentes_cargando_dev.js`, `_crear_paciente_para_repro2.js`.

**Pacientes de prueba creados en dev:** `QARepro2_1785431740113` (usado para ficha/CP/CURP/fecha), más varios `QA_*`/`QATipo*` de la sesión anterior (2026-07-28) que ya existían.

### 🐛 Segunda tanda (misma sesión, 2026-07-30) — 1 hallazgo NUEVO confirmado: carrera de búsqueda en CIE-10

Pedro pidió explícitamente seguir buscando errores de validación en áreas **nuevas** (no re-verificar lo ya encontrado) y aclaró que el wizard de onboarding "Configuración de tu cuenta" no hace falta probarlo — una vez que se hace clic en "Finalizar" no vuelve a aparecer, y Pedro lo prueba a mano (ver memoria `feedback-no-probar-wizard-configuracion-cuenta`).

**🐛 HALLAZGO NUEVO CONFIRMADO: carrera de búsqueda en el combobox CIE-10 de Diagnóstico — con impacto clínico persistente confirmado.** Mismo patrón ya conocido en Medicamento/Laboratorio (2026-07-23), nunca antes probado en CIE-10 pese a estar identificado como candidato en memoria. Escribir "R05" (Tos), esperar solo 150ms, y cambiar a "A09" (Diarrea y gastroenteritis) sin esperar a que resuelva: el combobox deja seleccionado **"R05X - TOS"** (el código ANTERIOR, obsoleto), no "A09" — confirmado visualmente en captura (`test-results/eg-carrera-cie10.png`), el chip de diagnóstico elegido muestra "R05X - TOS" pese a que el texto final tipeado fue "A09".

A pedido de Pedro, se completó el flujo real (no solo hasta la selección del combobox): se llenó Impresión diagnóstica, se clickeó **"Guardar cambios"** (`addDiagnosis` → 200 OK) y se **finalizó la consulta** (`finishConsultation` → 200 OK, `consulta_id=37`, paciente "Percentil Prueba Prueba"). Se revisó toda la información presentada tras Finalizar (estatus "Finalizada", Expediente/Consultas, signos vitales, General) y se verificó **vía API (`getConsultation`)** el diagnóstico realmente guardado: **`{"diagnostico_id": 8145, "nombre": "TOS", ...}`** — confirma que el diagnóstico equivocado de la carrera **quedó guardado PERMANENTEMENTE en la consulta ya finalizada**, no algo que se corrija en un paso posterior. El paciente queda con un diagnóstico clínico incorrecto en su expediente, sin ninguna advertencia en ningún punto del flujo. Un médico que escriba rápido y cambie de idea sobre el código a buscar puede terminar finalizando una consulta con un diagnóstico completamente distinto al que creía haber elegido.

Script: `_error_guessing_carrera_cie10_dev.js` (incluye la carrera + guardado + finalización + verificación por API).

### ⚠️ Retractado tras re-prueba con timing realista (misma sesión, mismo día)

Pedro pidió correrlo de nuevo asegurando que los tiempos usados no fueran exagerados (ni el hueco de la carrera ni las esperas de carga) — con buena razón: la primera corrida usaba un hueco de solo **150ms** entre escribir "R05" y cambiar a "A09" (`fill()` instantáneo, sin tecleo real), un ritmo prácticamente imposible para una persona.

Se reescribió el escenario con timing representativo de un médico real: tecleo carácter por carácter con `page.keyboard.type` (80-140ms por tecla, con variación aleatoria), una pausa de "reconsideración" de 600ms antes de corregir, borrado con `Backspace` real (no `fill('')` instantáneo), y una espera generosa (con `waitForResponse` + margen de 1.5s) para que la búsqueda final termine de resolver antes de evaluar. Timeline real capturado contra `searchDiagnoses` (ver script): las búsquedas de "R05" resolvieron con normalidad, y la búsqueda final de "A09" resolvió última y correcta (3 resultados, todos de diarrea/gastroenteritis) — el combobox quedó con **"A09X - DIARREA..."**, el código correcto. Se completó el flujo hasta Finalizar y se confirmó vía API (`getConsultation`, `consulta_id=38`) que el diagnóstico guardado fue el correcto (`"DIARREA Y GASTROENTERITIS DE PRESUNTO ORIGEN INFECCIOSO"`), no el equivocado.

**Conclusión: se retracta el hallazgo.** Bajo un ritmo de tecleo y una pausa de reconsideración representativos de una persona real, el combobox de CIE-10 **se comporta bien** — no hay pérdida de sincronización entre búsquedas. El comportamiento incorrecto de la corrida anterior parece ser un artefacto de una ventana de carrera artificialmente extrema (150ms, `fill()` instantáneo), no reproducible con timing humano creíble. **No se debe reportar este hallazgo a devs tal como estaba planteado.** Si se quiere seguir investigando, valdría la pena probar huecos intermedios (300-400ms) para acotar el punto exacto donde empieza a fallar, si es que existe alguno relevante en la práctica.

**Candidato pareja probado sin hallazgo:** la misma técnica de carrera en el combobox **"Agregar servicios"** ("Consulta" → "Certificado" sin esperar) se resolvió correctamente al término final ("Certificado Médico $100"). Diferencia de fondo: Servicios parece filtrar una lista ya cargada localmente (sin llamada a API por cada tecleo), mientras que CIE-10/Medicamento consultan una API por cada tecleo — la ventana de carrera solo existe donde hay ese round-trip async. Script: `_error_guessing_carrera_servicios_dev.js`.

**Otras áreas nuevas probadas, sin hallazgos:**
- **Monto de pago en Ingresos** (`_error_guessing_monto_pago_dev.js`, `_error_guessing_monto_pago_negativo_dev.js`): el campo "Monto" (`input[name="subtotal"]`) es editable, pero un sobrepago (999999 sobre un adeudo de 500) fue **ignorado silenciosamente** — el backend recibió el monto REAL correcto ($500) en el body de `registerPayment`, no lo inyectado en el input (¡ojo al verificar este tipo de manipulación en el futuro: hay que revisar el body real de la request, no solo si el status fue 2xx, porque el primer intento pareció un hallazgo y no lo era!). Monto negativo (-100) deshabilita el botón "Registrar pago" en el front. Efecto colateral: se generó un pago real de $500 en dev sobre un ingreso de "Carla Perez Rojas".
- **Doble reserva de horario en Agenda:** no se profundizó — el wizard "Agendar cita" ya solo lista horas filtradas como disponibles, y probar una carrera real de doble-booking requeriría 2 sesiones de navegador enviando la misma hora en paralelo (queda como candidato futuro de mayor esfuerzo).

**Scripts nuevos de esta segunda tanda** (raíz, no trackeados): `_recon_ingresos_monto_dev.js`, `_recon_sidebar_dev.js`, `_error_guessing_monto_pago_dev.js`, `_error_guessing_monto_pago_negativo_dev.js`, `_error_guessing_carrera_cie10_dev.js`, `_error_guessing_carrera_servicios_dev.js`.

---

## 🔬 Investigación: ¿getFilledForm en blanco tras Finalizar es transitorio o real? (2026-07-30, EN CURSO)

Contexto completo del error metodológico que motivó la nueva norma (`CLAUDE.md` §0): una sesión anterior (2026-07-28) documentó que `getFilledForm` puede devolver el formulario de un checklist (Exploración segmentaria/Aparatos y sistemas) en blanco justo tras Finalizar una consulta, y asumió — **sin verificarlo dentro de un test, solo por haber revisado "1-2 minutos después con un script aparte"** — que era un simple retraso de propagación del backend, no pérdida de datos. Esa hipótesis se propagó sin cuestionarse durante toda la sesión del 2026-07-30 (aparece 3 veces: como "advertencia no bloqueante" en el full-flow, como hallazgo suelto del 404, y como "Cargando preguntas" en un screenshot) hasta que Pedro lo señaló.

**Corrección aplicada:** `consultation.full-flow.spec.js` ya no acepta la hipótesis sin evidencia — reintenta `getFilledForm` con esperas reales y crecientes (5s/10s/15s/15s/20s = 65s totales) y solo si TODAVÍA está en blanco después de eso lo cuenta como inconsistencia real (antes: se descartaba con el primer reintento en blanco).

**Resultado de la corrida con el fix (`consulta_id=39`, paciente "Percentil Prueba Prueba", `paciente_id=903`):** con los 65s completos de reintentos reales, **Exploración segmentaria Y Aparatos y sistemas siguieron devolviendo el formulario en blanco** — el test ahora falla con 2 inconsistencias reales en vez de silenciarlas.

**Pendiente resolver (investigación en curso, script `_investigar_getfilledform_blanco_dev.js`):** ¿65s todavía es insuficiente (la nota vieja hablaba de "1-2 minutos", ~120s) y sigue siendo un retraso de propagación, o es que el dato de checklist genuinamente nunca se puede releer por esta vía y es un bug real? Se está monitoreando la MISMA consulta (`consulta_id=39`) cada 15s hasta 5 minutos, por API (`getFilledForm` directo) y por UI (recargando el perfil del paciente y viendo si "Cargando preguntas" alguna vez muestra datos reales) — **completar esta sección con el resultado antes de sacar conclusiones.**

**Nota clave para la próxima sesión, sea cual sea el resultado:** aunque resulte ser "solo" un retraso de propagación más largo de lo pensado, la reacción correcta NO es volver a silenciarlo como advertencia — es subir el tiempo de espera del reintento a lo que realmente se necesite y dejar que el test lo verifique cada vez, no asumirlo.

---

## 🐛 Bug confirmado (2026-07-28): botón "Consulta" crea la consulta con Tipo de Cita/Hospital vacíos

En el perfil de un paciente hay 2 caminos para iniciar una consulta: el wizard completo **"Agendar cita"** (varios pasos, valida bien) y un atajo más corto, el botón **"Consulta"**, que abre un modal "Seleccionar Tipo de Cita y Hospital" con 2 selects dependientes (Tipo de Cita → Hospital) y un botón "Crear consulta".

**Confirmado con `_reproducir_tipo_consulta_boton_consulta.js` (1 corrida):** dejando ambos selects en su valor por defecto ("Sin cita" / "Seleccione un hospital") — es decir, sin elegir nada — el botón **"Crear consulta" queda habilitado igual** y la consulta se crea. El error real solo aparece más tarde, de forma desconectada: al entrar a la consulta recién creada y apretar "Guardar cambios", el sistema responde **"Se necesita asignar el tipo de la consulta"**. Confirmado también por API (`_verificar_consulta_creada_boton.js`): la consulta creada por este camino queda con `hospital_id`/`tipo_cita_id` vacíos.

Se había investigado antes la hipótesis alternativa de que el wizard "Agendar cita" (no el botón "Consulta") fuera el vector — descartada con `_reproducir_tipo_consulta_faltante_dev.js`: ese wizard sí bloquea correctamente "Continuar" si Tipo/Hospital están vacíos.

**Impacto real:** un usuario que use el atajo "Consulta" en vez del wizard completo puede terminar con una consulta ya creada y en curso, sin poder guardar nada dentro de ella, sin que el modal donde realmente faltó el dato le haya avisado nada — mismo patrón de la clase de bug ya documentada para selects dependientes (ver `[[feedback-probar-siempre-campos-dependientes-race]]` en memoria).

**Rigor:** confirmado con 1 sola corrida por script (no 3 como es el criterio habitual de este proyecto antes de reportar formalmente a devs) — vale la pena una segunda corrida de confirmación antes de reportarlo.

**Scripts:** `_explorar_wizard_paciente_nuevo.js`, `_explorar_alta_paciente_nuevo.js`–`4.js` (reconocimiento del camino hasta el perfil del paciente), `_reproducir_tipo_consulta_faltante_dev.js` (descarta el wizard), `_reproducir_tipo_consulta_boton_consulta.js` (reproduce en el botón "Consulta"), `_verificar_consulta_creada_boton.js` (confirma por API). Todos en la raíz, no trackeados salvo que se decida commitearlos como referencia.

---

## 🔧 Endurecimiento de `consultation.full-flow.spec.js` (2026-07-28)

A partir de reconocer la estructura real de los checklists (`_reconocer_estructura_checklist.js`/`2.js`): cada checkbox de **Exploración segmentaria** y **Aparatos y sistemas**, al marcarlo, revela un sub-formulario propio (par de botones "Normal"/"Anormal" vía `div.simpleSelect label` + un `<textarea>` de Observaciones) que el spec **no estaba llenando ni verificando** hasta ahora.

**Cambios aplicados a `fillChecklistSection`:**
- Marca **todos** los checkboxes del apartado (antes: 3 al azar de todo el scope).
- Por cada ítem marcado, resuelve su Normal/Anormal (alternado determinístico, no azar) y llena su Observaciones con un texto que incluye el nombre del ítem (permite rastrear cuál es cuál al verificar).
- Devuelve `{ total, marcados, items }` para que el test pueda verificarlo después.

**Nueva verificación dura post-Finalizar** (antes no existía ninguna): tras finalizar la consulta, el test relee todo vía API (`getConsultation`, `getTreatments`, `getForms`, `getFilledForm`) y compara campo por campo contra lo que se llenó — `expect(inconsistencias).toEqual([])` hace fallar el test si algo no coincide. Cubre: motivo, padecimiento, notas de evolución, nombre referido, apariencia, impresión diagnóstica, indicaciones (Tratamiento/Laboratorios), diagnósticos, servicios, estatus final, medicamentos, y cada ítem de los 2 checklists (Normal/Anormal + Observaciones exactos).

**2 gotchas técnicos descubiertos al construir esta verificación** (documentados en comentarios del propio spec):
1. **`getFilledForm` puede responder 200 con el formulario en blanco (todo en 0) justo después de Finalizar**, por un retraso de propagación/caché del backend — no es pérdida real de datos (la misma consulta, revisada 1-2 min después con un script aparte, siempre mostró el valor correcto). El spec detecta este patrón específico (ítem #0 en 0 pese a que se esperaba un valor) y lo registra como **advertencia no bloqueante**, no como fallo, para no reportar falsos positivos.
2. **Leer datos recién guardados con `fetch()` desde la misma pestaña que acaba de finalizar puede devolver el formulario vacío de forma persistente** (ni reintentos ni `cache:'no-store'` lo evitan), mientras que la misma llamada con `page.request` (HTTP directo, fuera del JS de la página) o desde una pestaña nueva sí trae el valor real — algo a nivel de estado/interceptor de la propia página, no caché HTTP. El spec ahora usa `page.request` para esta verificación.

Además: se agregó el llenado de **"Otros medicamentos"** (botón "Agrega tratamiento diferente" en Tratamiento, antes se dejaba vacío) y se corrigió selección de medicamento/laboratorio para que confirme que la opción clickeada realmente contiene el término buscado (mismo patrón que el bug de test corregido el 2026-07-23, ahora más robusto).

**Estado: reescrito pero NO EJECUTADO todavía contra dev en esta sesión.** Próximo paso obligatorio: correr `doctor-consultation` y confirmar que la nueva verificación dura pasa limpia (o ver qué inconsistencias reales aparecen).

---

## 🟢 Prompt para una sesión nueva (copiar/pegar)

```
Lee CONTEXTO.md en la raíz del repo MediplannerWebNuevo y ponte al tanto del estado
del proyecto. Soy Pedro, Test Automation Tester (no developer); los tests son mi
responsabilidad. Trabajamos en español. Continúa desde la sección "Estado actual" y
las "Decisiones abiertas". Antes de correr tests confirma que tengo .env y
storageState.json localmente (no están en git).
```

---

## Proyecto

- **Qué es:** suite de automatización E2E con **Playwright** para la web admin de Mediplanner (entorno dev: `https://admin-dev.mediplanner.mx/`).
- **Repo:** https://github.com/PedroAndresQA6/MediplannerWebNuevo
- **Rama de trabajo:** `Normalization`
- **Rol:** Pedro = Test Automation Tester. Detecta bugs y los reporta a devs. Los tests son su responsabilidad.

### Stack / entorno (verificado 2026-06-17 en PC principal)
- Node **v24.16.0**, npm **11.13.0**
- Playwright **1.58.2**
- Navegador: el config ya **NO** hardcodea la ruta. `executablePath` es **condicional** a la variable `PW_CHROMIUM_PATH`. En esta PC, `.env` la define apuntando a `chromium-1223`; en otra PC sin esa variable, Playwright usa su Chromium por defecto (`npx playwright install chromium`). Config portable.
- `playwright.config.js`: solo Chromium, viewport **1366x768**, `headless: false`, `workers: 1` (serial)
- Archivos locales necesarios para correr: `.env` (BASE_URL + credenciales + `PW_CHROMIUM_PATH`) y `storageState.json` (sesión auth).
  - ⚠️ **OJO seguridad:** `.env` actualmente **SÍ está trackeado en git** (con credenciales). Pendiente sacarlo del repo (`git rm --cached .env` + `.gitignore`). Por eso el cambio local de `PW_CHROMIUM_PATH` NO se commitea (es ruta de esta máquina).

---

## Estado actual (git)

- **Trabajo más reciente (desde el 2026-06-25, no reflejado antes en este doc):** `git rm --cached` de `.env`/`storageState`/`test-results` (`38b6ce6`); reintento robusto de selección de paciente en citas + spec de percentil, portado a staging/producción (`f6a4c78`, `7dce115`); login directo sin Google OAuth + specs de vacunación en producción (`0911ac1`); trabajo en Appium (robustez, reactivación de app, separación de tests); calendario nuevo del Dashboard + validación de bug de Servicios (`ad9f921`); mapeo exploratorio de Dashboard/Reportes/Ajustes (`3b20037`).
- Commits clave previos: `1bb9cd7` (9 stress tests + monitor + facturacion opción B), `b3efb22` (limpieza de tests muertos de vacunación, incluida en este trabajo), más `feat(consultation)` y `test(vacunacion)` que llegaron del otro equipo.
- Se mantiene sincronizado en las **3 ramas** (`main`, `Trabajando`, `Normalization`) — apuntan al mismo commit.
- *(excluidos de git a propósito:* `storageState.json` = refresco de sesión; cambio local de `PW_CHROMIUM_PATH` en `.env` = ruta de esta máquina; `MediplannerAppiumAutomation/` = repo aparte)*
- **`AppEstacionamientosColaboradores/`** (2026-07-07, en curso): suite de automatización para el sistema de estacionamientos "Querétaro con Futuro" — **completamente independiente** de Mediplanner (paquete/producto distinto), vive en este mismo repo por conveniencia. Ya tiene DOS suites: **Appium/pytest** para la app Flutter del operador de campo (los 13 módulos del checklist de 74 casos ya están escritos, commit `9759a01`) y, desde el 2026-07-17, **Playwright** para el portal web de administración (login/sesión, dashboard, disponibilidad, estacionamientos, infracciones — más un test combinado que valida consistencia de datos entre la app móvil y el portal; commit `f168d89`). No comparte page objects, credenciales ni fixtures con Mediplanner. Tiene su propio `CONTEXTO.md`/`CLAUDE.md`/`HALLAZGOS.md` — no duplicar ese detalle acá, solo esta referencia.

> ✅ El estado está en GitHub: en otra computadora basta `git clone` + `git checkout main` (o cualquiera de las 3 ramas) + `npm install` + (navegador: `npx playwright install chromium` o `PW_CHROMIUM_PATH` en `.env`).

---

## En qué estamos trabajando (historia reciente)

1. **Ya commiteado y pusheado (`564cb92`)**
   - Fix `waitForLoadState('networkidle')` → esperas específicas en `ingresos.spec.ts` (el `networkidle` nunca se cumplía porque GA/Zendesk/Clarity mantienen la red activa).
   - `ingresos` desacoplado de `doctor-consultation` (depende solo de `setup`): correr ingresos ya no corre la consulta primero (1.8m vs 5.3m).
   - Rename `Consultation.stress.test.spec.ts` → `consultation.inputs-validation.spec.ts`.

2. **Mejoras a los 9 stress tests (commit `1bb9cd7`)** — `tests/stress tests/`
   - A los 9: fix `networkidle`→`load` + `setupConsoleMonitor(page)` + `printSummary()`.
   - Bug corregido en `pacientes.stress.test.ts`: `formInputs` → `allInputs` (ReferenceError).
   - `playwright.config.js`: agregados proyectos **`stress-antecedentes`** y **`stress-diagnosticos`** (no existían, esos 2 no se podían correr); proyecto huérfano `stress-test` (apuntaba al archivo renombrado) → **`consultation-inputs-validation`**.
   - **Suite completa corrida en serie: 8/9 pasan.** Solo falla `facturacion` (determinista, por un bug de la app — ver abajo).

3. **`facturacion.stress.test.ts` — opción B aplicada (commit `1bb9cd7`)**
   - `fillFacturacion` ahora hace `selectOption(..., {timeout:5000})` dentro de `try/catch` y lanza un mensaje claro (`🐛 No se pudo seleccionar tipo de persona...`) en vez del `TimeoutError` genérico de 15s.
   - El test **sigue fallando a propósito** porque señala un bug real de la app (no es falso positivo).

---

## 🐛 Hallazgo de QA (reportar a devs)

Al abrir el formulario de **Facturación** de un paciente, `POST /api/patients/getFilledForm` responde **422 `{"status":"ERROR","message":"El campo relacion_id es requerido"}`**.

- Efecto en UI: el front loguea *"Error fetching form elements or invalid response structure"* + `TypeError: Cannot read properties of undefined (reading 'vacunas')` y `(reading 'map')` (bundle `vacunacion-*.js`).
- El select `tipo_persona_id` queda **inestable** (alterna habilitado/deshabilitado por re-render) → no se puede seleccionar tipo de persona.
- El mismo 422 aparece en antecedentes/diagnosticos/vacunacion (esos pasan porque no tienen asserts duros).
- El **DevTools monitor** (agregado a los tests) fue lo que destapó esto.

*Nota:* el entorno dev también es **flaky**: a veces aborta el bundle `index-*.js` (`net::ERR_ABORTED`), causando fallos distintos no relacionados con los tests.

### 🐛 Indicador "sin guardar" (triángulo) que no se limpia — *Laboratorios y Procedimientos*

Cada apartado de la consulta muestra un **triángulo de advertencia** (FontAwesome `triangle-exclamation`, naranja, en el `card-header`) cuando hay cambios sin guardar. **Confirmado (Pedro):** en **Tratamiento › Laboratorios y Procedimientos**, tras llenar y guardar:
- El API responde OK: `POST /api/procedures/setProceduresConsultation → 200 "Procedimientos de consulta actualizados exitosamente"`.
- **Pero el triángulo NO se limpia** → la data se persiste en el servidor, pero el indicador client-side de "sin guardar" se queda. Es un **bug de front**.
- Verificado con doble verificación (no es timing): el triángulo persiste en dos pasadas.

*Cómo se detecta automáticamente:* helper **`scanResidualIndicators(page, tabName)`** en `e2e/utils.js` — tras el guardado real de una pestaña (sin salir de ella; el triángulo es client-side y navegar lo descarta), escanea los apartados visibles y reporta los que conservan el triángulo. Cableado en `tests/consultation.full-flow.spec.js` para Exploración/Tratamiento/Notas/Servicios (General y Diagnóstico se excluyen: guardan con "Continuar", no con botón propio). Log-and-continue: registra + screenshot `test-results/indicador-residual-*.png` + resumen final, sin tumbar el test.

*Falso positivo descartado:* "Aparatos y sistemas" (Exploración) **NO** es bug de la app — era bug del **test**: el guardado de Exploración usaba `.first()` y solo guardaba el primer apartado. Corregido: ahora `fillExplorationSection` llena todo y guarda **cada apartado una vez al final** (se quitó el guardado por-checkbox). Exploración quedó limpia.

---

## 💉 Vacunación — UI NUEVA mapeada + automatización consolidada (2026-06-17)

⚠️ **La UI de Vacunación cambió por completo.** Los tests viejos `tests/vacunacion.registro.spec.ts`, `tests/vacunacion.ciclo.spec.ts` y `tests/stress tests/vacunacion.stress.test.ts` usan el flujo **MUERTO** (react-calendar, `div.cursor-pointer`, botón "Vacuna diferente") → **obsoletos, pendiente borrarlos**.

**Cómo funciona la UI nueva** (mapeada con `tests/vacunacion.explorar.spec.ts`, proyecto `vacunacion-explorar`):
- Cada dosis de la **Cartilla** es un `<input type="date">` inline → selector `table.table-compact input[type="date"]`. Llenar la fecha **AUTO-GUARDA**: dispara `POST /api/vaccines/saveVaccinesUser → 200` solo, sin botón. (Confirmado.)
- Ícono **lápiz** (`button.btn-secondary` con svg `data-icon="pencil"`) = editar folio/obs de esa dosis → abre `input[placeholder="Opcional"]` (folio) + `textarea[placeholder="Notas..."]`. Disponible tras poner la fecha.
- **Borrar** una dosis: `button.btn-secondary` cuyo **texto es "×"** (las de dosis vacías están `hidden`). OJO: lápiz y × comparten la clase `btn-secondary`.
- Sección **"Otra vacuna"** (abajo, fuera de la tabla): filas inline `input[name="vacuna_nombre"]`, `input[name="dosis_nombre"]`, `input[placeholder="Fecha"]`, `input[placeholder="Folio"]`, `textarea[placeholder="Comentarios"]`. Hay 2 filas-plantilla siempre presentes.
- Botón **"Guardar cambios"** = guarda **TODO el apartado de Vacunación** (cartilla + otra vacuna), no solo la otra vacuna.
- Al cargar lanza ~20 errores JS de consola (TypeErrors `'vacunas'`/`'map'` del bundle de vacunación) = bug de la app, NO rompen el flujo. 0 errores de API.

**Automatización consolidada nueva:** `tests/vacunacion.ciclo-completo.spec.ts` (proyecto **`vacunacion-ciclo-completo`**), paciente **Agustin Tapia**. Flujo: ir → borrar todas las dosis (× auto-save) + filas otra-vacuna → refrescar y **verificar 0** → registrar dosis (fecha auto-save, cap **`MAX_DOSES`**) + 1 otra vacuna → refrescar y **verificar persistencia**.
- ✅ **Corrida OK:** borró 2, verificó vacío (0), registró 6, verificó 6 tras refrescar. El bug viejo de "pierde interactividad tras guardar" **ya NO aplica** (el auto-save lo resolvió).

**Pendiente en vacunación:**
- [x] ~~Subir `MAX_DOSES` (actual 6 → 999)~~ — **hecho.** Verificado en código: `MAX_DOSES = 999` en `tests/vacunacion.ciclo-completo.spec.ts` y en las copias de Staging/Producción.
- [ ] Completar borrado + verificación real de filas **"otra vacuna"** (al iniciar solo había plantillas vacías; mi corrida dejó una guardada, así que la próxima ya puede probar el borrado). Ajustar el selector del × rojo (`button[class*="hover:text-red"]`). — **sigue pendiente**, sin cambios en el spec.
- [x] ~~Borrar los 3 tests viejos de vacunación (UI muerta) y su(s) proyecto(s) en el config~~ — **hecho.** `vacunacion.registro.spec.ts`, `vacunacion.ciclo.spec.ts` y el stress de vacunación ya no existen (borrados en commit `b3efb22`, 2026-06-23); `stress-vacunacion` ya no aparece como proyecto en `playwright.config.js`.

---

## Cómo correr los tests

```powershell
cd C:\Users\pandr\MediplannerWebNuevo

# Consulta full-flow
npx dotenv -e .env -- playwright test --project=doctor-consultation

# Ingresos
npx dotenv -e .env -- playwright test --project=ingresos

# Dashboard (KPIs, calendario, corte de hoy, agenda, nuevos estudios)
npx dotenv -e .env -- playwright test --project=dashboard

# Consulta — errores humanos reales (6 tests, PENDIENTE DE VERIFICAR - ver sección homónima)
npx dotenv -e .env -- playwright test --project=consultation-user-errors

# Un stress test puntual (ej. facturacion)
npx dotenv -e .env -- playwright test --project=stress-facturacion

# Todos los stress tests (serie, ~20-40 min)
npx dotenv -e .env -- playwright test "stress tests"

# Listar/validar parseo sin correr
npx playwright test "stress tests" --list

# Vacunación — ciclo completo (borrar todo → registrar → verificar)
npx dotenv -e .env -- playwright test --project=vacunacion-ciclo-completo

# Vacunación — mapeador de la UI (exploratorio)
npx dotenv -e .env -- playwright test --project=vacunacion-explorar
```

**Proyectos de stress disponibles:** `stress-login`, `stress-citas`, `stress-pacientes`, `stress-ingresos`, `stress-informacion-paciente`, `stress-facturacion`, `stress-vacunacion`, `stress-antecedentes`, `stress-diagnosticos`.

**Modo de corrida (preferencia):** test puntual que se quiere observar → primer plano (foreground, el navegador se abre por `headless:false`). Suite larga → background.

---

## Setup para reproducir en otra computadora

1. Instalar **Node 24.x** y **git** (y opcionalmente **GitHub CLI `gh`** — no está instalado en la PC principal).
2. `git clone https://github.com/PedroAndresQA6/MediplannerWebNuevo.git` y `git checkout Normalization`.
3. `npm install`.
4. Navegador: `npx playwright install chromium` (usa el bundled). Si prefieres uno ya instalado, pon su ruta en `.env` como `PW_CHROMIUM_PATH=...` (el config la respeta; sin esa variable usa el bundled).
5. Crear **`.env`** localmente (BASE_URL + credenciales) — **no está en git**, pedírselo a Pedro / copiarlo de la PC principal.
6. `storageState.json` se regenera solo al correr el proyecto `setup` (auth), o copiarlo de la PC principal.
7. (Si los cambios de stress tests aún no están en `Normalization`) hacer `git pull` después de que se hayan pusheado.

---

## Repos separados (importante) — ⚠️ desactualizado, corregir con Pedro

`MediplannerAppiumAutomation/` (dentro de la carpeta de MediplannerWebNuevo) **debería ser** su propio repo git independiente, con remote propio: https://github.com/PedroAndresQA6/MediplannerAppiumAutomation. Es un framework Appium/pytest para la app móvil Android de Mediplanner (POM: `pages/`, `tests/`, `conftest.py`).

**Confirmado 2026-07-20: esa carpeta YA NO tiene su propio `.git`** — `git remote -v` ejecutado adentro resuelve al remote de `MediplannerWebNuevo` (no hay `.git` propio, sube al del padre). En la práctica quedó fusionada dentro de este repo en algún punto, contradiciendo la nota original de "NO fusionarlo". El commit `0665923` (módulo de bitácora + fix en `test_perfil.py`) se hizo directo en `MediplannerWebNuevo` por esta razón — no había otro repo real al cual subirlo.

**Pendiente de decidir con Pedro:** si se re-inicializa `MediplannerAppiumAutomation/` como repo propio (y se migra el historial reciente para allá) o si directamente se acepta que ahora vive dentro de `MediplannerWebNuevo` y se actualiza esta nota en consecuencia. Mientras tanto, cualquier cambio ahí se commitea en este mismo repo.

---

## 🟣 STAGING — porteo de automatizaciones y hallazgos (2026-06-25)

**Entorno:** `https://admin-staging.mediplanner.mx/` · carpeta **`Mediplanner Staging/`** (config propio, `baseURL` staging, NO usa `.env`; credenciales staging por fallback en `Tests_Staging/auth.setup.ts`: `dr@rym-solutions.com`). Se corre con CWD = `Mediplanner Staging/` (usa `node_modules` y Chromium de la raíz). No hay `package.json` ni `node_modules` propios.

**Patrón de porteo dev → staging** (lo aplicado con consulta y vacunación): copiar el spec **idéntico** de `tests/` a `Tests_Staging/`; `e2e/utils.js` y `e2e/config.js` ya están copiados idénticos en `Mediplanner Staging/e2e/`; agregar el proyecto al `Mediplanner Staging/playwright.config.js`; ajustar datos propios de staging (p.ej. el nombre del paciente). El `auth.setup.ts` de staging ya está adaptado.

- **Consulta** (`doctor-consultation`): porteada y verificada. Arranca desde "Inicio" (no depende de paciente por nombre). Corrida 3× el 2026-06-25, todas PASAN.
- **Vacunación** (`vacunacion-explorar`, `vacunacion-ciclo-completo`): porteada el 2026-06-25. Paciente fijado en ambos specs = **`Pedro Quijada Anaya`** (Agustin Tapia es de dev, NO existe en staging). `vacunacion-explorar` corrió OK (no destructivo). ✅ `vacunacion-ciclo-completo` **SÍ se ejecutó** — evidencia: `Mediplanner Staging/test-results/vac-ciclo-01-vacio.png` y `vac-ciclo-02-registrado.png`, generadas 2026-06-25 11:24-11:25 (poco después de escribirse esta sección, nunca se actualizó el estado aquí).
  - ⚠️ **Hallazgo sin documentar hasta ahora:** el mismo test destructivo también dejó evidencia de haberse corrido en **Producción** (`Mediplanner produccion/test-results/vac-ciclo-01-vacio.png` y `vac-ciclo-02-registrado.png`, generadas 2026-06-29 11:52, sobre el paciente **Agustin Tapia**). No estaba planeado en este documento — confirmar con Pedro si fue intencional, dado que borra dosis reales.

### ~~🐛 Hallazgos de consulta en STAGING~~ — solucionados por devs (confirmado por Pedro, 2026-07-21)
~~422 `getFilledForm` "relacion_id es requerido"~~ y ~~404 `getFilledForm` "No se encontró el formulario asignado al paciente" al finalizar consulta~~ — ambos resueltos. El indicador "sin guardar" (triángulo) de Lab/Procedimientos **NO se reproduce en staging** (en dev sí). Resto del flujo sólido.
- 📄 Reporte original: `Reporte_QA_Consulta_Staging_2026-06-25.pdf` (raíz).

### 🔁 Actualización 2026-07-14 — porteo del fix de wizard + rediseño de Ingresos verificado en staging

Una sesión anterior (2026-07-09/10) ya había adaptado `Mediplanner Staging/e2e/utils.js` y los specs de `Tests_Staging/` al mismo rediseño de UI que se arregló en dev (wizard "Agendar cita" → "Confirmar cita" sin modal OK; calendario nuevo del Dashboard; dashboard de Ingresos con `rdt_TableRow`/"Registrar pago"), pero esos cambios habían quedado **sin commitear** y sin correr contra staging real. Hoy se corrieron ambas suites contra staging para confirmarlos:

- **`doctor-consultation`: 2/2 pasan (3.1m).** Cita creada + consulta completa (signos vitales → exploración → diagnóstico → tratamiento → laboratorios → notas → servicios → finalización) de punta a punta. En su momento confirmó el 404 `getFilledForm` (ver arriba, ya solucionado); el indicador "sin guardar" de Laboratorios sigue sin reproducirse.
- **`ingresos`: 3/3 pasan (1.1m).** Conteo de pendientes/pagados correcto con los selectores nuevos. El paso "Registrar pago" **no llegó a ejecutarse de punta a punta**: los 2 ingresos pendientes del ciclo resultaron "ya pagados" al abrir el detalle (mismo síntoma de flakiness ya documentado en dev — no es bug del test).
- Se corrigió además un detalle del propio código de **dev** descubierto al portar: `irADiaEnCalendarioDashboard()` usaba `.first()` del botón "siguiente mes" (hay 2 en el DOM, el primero es decorativo) y el loop de días arrancaba en `dayOffset=1` asumiendo que "hoy" ya estaba visible. Corregido en ambos entornos.
- **Commiteado:** `807fe43` (fix de calendario en dev) y `62e285c` (porteo completo a staging).

**Plan ejecutado para generar un adeudo real:** se corrió `doctor-consultation` una 2ª vez (paciente Percentil Prueba Prueba, misma corrida ✅ 2/2) específicamente para dejar un nuevo cargo pendiente, y se corrió `ingresos` a continuación para procesarlo. Confirmado manualmente por Pedro (captura de la pantalla real de Ingresos en staging): sí hay adeudos reales sin pagar (2× $1,800.00, estatus "Pendiente", método "-") y el ícono del ojo lleva a su detalle — coincide con lo que hace `eyeButton` en el spec.

### ~~🐛 `DetallePagos` crasheaba con TypeError cuando el paciente no tenía datos fiscales~~ — solucionado por devs (confirmado por Pedro, 2026-07-21)
Crasheaba con `TypeError: Cannot read properties of undefined (reading 'cp')` cuando `getFiscalData` devolvía vacío, ocultando el botón "Registrar pago". Ya resuelto — no bloquea más el flujo de ingresos.

### 🔍 Corrección — el flujo real de "Registrar pago" tiene selección de CONCEPTO (no un formulario directo de 1 cargo)

Pedro confirmó con una captura real de staging que el botón "Registrar pago" SÍ aparece con normalidad en ingresos con adeudo real, y que al hacer clic te lleva a un formulario con: radios de **Concepto** (uno por cada cargo del ingreso — ej. "Consulta General" + "Certificado Médico", cada uno con su propio monto pendiente), un campo **Monto** (prellenado al máximo del concepto elegido), tarjetas-botón de **Método de pago** (Efectivo/Transferencia/Tarjeta…) y un botón final **Registrar pago** que **paga solo el concepto seleccionado**. Para saldar un ingreso con varios cargos hay que repetir el envío una vez por concepto; solo cuando ya no queda ninguno con saldo desaparece el botón "Registrar pago".

Explorando esto de punta a punta contra staging (pagando de verdad un ingreso real de $1,800 = Consulta General $1,500 + Certificado Médico $300, en dos pagos con métodos distintos) se confirmó: `POST /api/payments/registerPayment → 200 "Pago registrado correctamente"` por cada concepto; el ingreso terminó con `Pagado: $1,800.00 / Adeudo: $0.00` y status **"Pagado"** en el historial; el botón queda momentáneamente en estado "Registrando…" (deshabilitado) durante el request — leer el DOM en ese instante hace ver "no hay botón" en falso.

**Causa real de casi todos los falsos "ya pagado" en `ingresos.spec.ts` (dev y staging):** el spec nunca seleccionaba un concepto explícitamente (dependía del radio default) y no manejaba ingresos con 2+ cargos ni el estado "Registrando…", más un timeout de 8s insuficiente para que el detalle terminara de cargar. **Corregido y verificado (commit `bb480b8`):** nueva función `pagarConceptosPendientes()` que paga cada concepto con saldo > 0 uno por uno hasta saldar el ingreso; timeout del botón "Registrar pago" en el detalle subido a 12s; espera explícita a que "Registrando…" desaparezca antes de releer el formulario. El crash de `DetallePagos` (TypeError `reading 'cp'`) ya fue solucionado por devs (ver nota arriba).

---

## 🚨 Rediseño de la pantalla de Consulta — 2026-07-23 (hallazgo mayor, `consultation.full-flow.spec.js` roto)

Pedro pidió correr `doctor-consultation` "semi manualmente" (observando cada apartado, no solo el resultado final) para detectar cambios de la app y compararlos contra el comportamiento documentado. Resultado: **la pantalla de consulta se rediseñó de raíz.**

### Qué cambió (antes → ahora)

**Antes:** pestañas clickeables — General | Exploración | Diagnóstico | Tratamiento | Notas del Médico | Servicios. Solo una visible a la vez; cada una con su propio botón "Guardar cambios"/"Guardar" que dispara su propio endpoint (`registerAnswers`/`editConsultation`, `addDiagnosis`, `setTreatments`, etc.).

**Ahora ("Modo Completo"):** **una sola página scrolleable** con las **10 secciones visibles al mismo tiempo** como cards colapsables (ícono de flecha en cada header, no confirmado si colapsan de verdad):

1. **General** — Fecha y hora / Hospital / Tipo consulta (los 3 de solo lectura), Motivo de consulta, Padecimiento actual, Notas evolución, Nombre referido (los 4 editables). Sin botón de guardado propio.
2. **Signos vitales** — mismos campos de siempre (presión, oxigenación, temperatura, peso, talla, FC, FR, perímetro cefálico) + IMC calculado. Sin botón de guardado propio (se llenan en el modal previo "Capturar signos vitales", como antes).
3. **Apariencia general** — un textarea. Sin botón propio.
4. **Exploración segmentaria** — checkboxes (Cabeza/Cuello/Torax/Abdomen/Columna vertebral/Miembros superiores/Genitales/Miembros inferiores) + **botón propio "Guardar Respuestas"**.
5. **Aparatos y sistemas** — checkboxes (15 sistemas) + **botón propio "Guardar Respuestas"**. (Antes "Exploración" y "Aparatos y sistemas" vivían juntos bajo la pestaña "Exploración"; ahora son 2 cards separadas, cada una con su propio guardado.)
6. **Diagnóstico** — CIE-10 + impresión diagnóstica + observaciones, igual que antes. Muestra "Cargando datos diagnósticos..." un momento al entrar (resuelve solo, no es un bug). Sin botón de guardado propio visible.
7. **Tratamiento** — medicamentos + indicaciones generales (Jodit) + botón "Vista previa". Sin botón "Guardar cambios" propio (antes SÍ lo tenía: `button[type="submit"]:has-text("Guardar cambios")`, endpoint `setTreatments`).
8. **Laboratorios y Procedimientos** — **ahora es una card separada**, ya no vive anidada dentro de "Tratamiento" (relevante: ahí vivía el hallazgo del indicador "sin guardar" documentado en 2026-06/07 — hay que revisar si sigue aplicando en esta nueva ubicación). Sin botón propio.
9. **Notas del Médico (Privado)** — editor Jodit. Sin botón propio.
10. **Servicios** — agregar servicios. Sin botón propio; junto a esta card está el botón global verde "Finalizar Consulta".

**De los ~10 botones de guardado que existían antes (uno por pestaña/apartado), ahora solo quedan 3 en toda la pantalla:**
- "Guardar Respuestas" (Exploración segmentaria)
- "Guardar Respuestas" (Aparatos y sistemas)
- **"Guardar cambios"** — un único botón global, en un panel lateral fijo a la derecha, junto con "Finalizar Consulta", "Agendar Próxima Cita" y "REGRESAR A DATOS DEL PACIENTE". Arriba de esos botones hay un indicador "Modo Completo" / "Sin cambios pendientes" (parece trackear cambios pendientes de forma global, ya no por apartado con el triángulo de antes — **pendiente confirmar si el triángulo "sin guardar" sigue existiendo en algún lado**).

**Nuevo también:** un toggle arriba a la derecha "Expediente" / "Consultas" (no se investigó a fondo qué hace cada uno), y en el panel lateral un acceso rápido a "Expediente" (Antecedentes gineco-obstétricos, Alergias, Laboratorios y Procedimientos, Percentil, Vacunación) y a "Consultas" anteriores del paciente (lista de fechas).

### Por qué `consultation.full-flow.spec.js` falla ahora

El spec recorre `tabs = [General, Exploración, Diagnóstico, Tratamiento, Notas del Médico, Servicios]` haciendo, por cada una: buscar un elemento con ese texto, **clickearlo**, y `await page.waitForLoadState('networkidle')`. Como ya no hay pestañas — el "click" cae sobre un heading inerte que no dispara ninguna navegación — ese `networkidle` nunca tiene un motivo real para tardar, pero tampoco puede resolver rápido porque los beacons de GA/Zendesk/Clarity mantienen la red "ocupada" indefinidamente (mismo problema de fondo ya documentado y corregido en `ingresos.spec.ts` y en el toggle de observaciones de Diagnóstico — ver secciones anteriores). Antes, cuando el click SÍ disparaba una navegación real, había trabajo legítimo de por medio que absorbía parte de esa espera; ahora el click no hace nada, así que los 30s del timeout se consumen enteros esperando una "calma de red" que nunca llega. Confirmado en logs: falla exactamente en `tests/consultation.full-flow.spec.js:1603` (`await page.waitForLoadState('networkidle')`, dentro del loop genérico de pestañas), consistentemente en el segundo apartado (Exploración) — el primero (General) alcanza a pasar antes de que la falta de "calma de red" se note.

**Apartados verificados como funcionando ANTES de la falla (General):** creación de cita, signos vitales, carga de la consulta — todo con 0 errores de API, igual que antes. `registerAnswers` y `editConsultation` (guardado de General) responden 200 OK, aunque con un gap de ~22s entre uno y otro (mismo síntoma de `networkidle` desperdiciando tiempo, sin llegar a fallar duro en este punto).

**No se llegó a verificar Diagnóstico, Tratamiento, Laboratorios, Notas del Médico ni Servicios** en esta corrida (el test se cae antes). Pendiente para cuando se reescriba el spec.

### ✅ Reescritura completada y verificada (2026-07-23, misma sesión)

Se reescribió `consultation.full-flow.spec.js` para el nuevo "Modo Completo". **Backup de la versión anterior (modelo de pestañas) guardado en `tests/consultation.full-flow.spec.js.backup`** antes de tocar nada.

**Cambios de fondo:**
- Se eliminó el loop de "click pestaña + esperar `networkidle`" — ya no hay pestañas, las 10 secciones están todas en el DOM desde que carga la página.
- Nuevo helper `sectionContainer(page, headingRegex)`: ubica el card de una sección subiendo ancestros desde su heading `h3`, hasta encontrar un contenedor con tamaño razonable. **Necesario** porque con las 10 secciones visibles a la vez, un selector genérico como "todas las textareas visibles" (que antes era seguro porque solo una pestaña estaba montada) ahora agarra campos de *otras* secciones si no se acota — se confirmó en vivo que `fillNotasMedicoSection`, `fillDiagnosticoSection` y las de checkboxes hubieran contaminado entre sí sin este scope.
- **Mecanismo de guardado confirmado en vivo (recon con `page.on('response')` antes de escribir el spec):**
  - "Exploración segmentaria" y "Aparatos y sistemas" (los 2 apartados con checkboxes) mantienen su propio botón **"Guardar Respuestas"** — no los cubre el guardado global. Se guardan uno por uno, inmediatamente después de llenarlos.
  - Todo lo demás (General, Diagnóstico, Tratamiento, Laboratorios y Procedimientos, Notas del Médico, Servicios) se persiste con **un único botón global "Guardar cambios"** (panel lateral derecho), clickeado **una sola vez al final**, después de llenar todas las secciones. Dispara — según qué se haya tocado — `editConsultation`, `addDiagnosis`, `setTreatments`, `setFreeTreatmentsConsultation`, `setProceduresConsultation`, `addServices` y `addNote` en un solo golpe.
  - Ya no existen los botones "Guardar cambios" específicos por pestaña que había antes para Tratamiento (`type="submit"`) ni para Laboratorios (`type="button"`) — ambos fueron reemplazados por el global.
  - Hay **2 botones "Finalizar Consulta"** en la página (panel lateral + al pie de Servicios) — se usa `.first()`.

**✅ Verificado con 2 corridas limpias contra dev:** `2 passed` ambas veces, recorriendo las 9 secciones de contenido (General → Apariencia general → Exploración segmentaria → Aparatos y sistemas → Diagnóstico → Tratamiento → Laboratorios y Procedimientos → Notas del Médico → Servicios) sin ningún error, **los 7 endpoints de guardado global responden 200 OK en ambas corridas** (mismo set exacto las dos veces), y `finishConsultation` también 200 OK. **0 responses con error de API.**

**Bonus de performance:** al eliminar los `waitForLoadState('networkidle')` por pestaña (la causa raíz del fallo original), la corrida completa bajó de **~167s a ~67s** — más del doble de rápida — sin sacrificar cobertura.

### 🔍 Verificación manual post-reescritura (2026-07-23) — 1 bug de test encontrado y corregido

A pedido de Pedro, tras las 2 corridas limpias se hizo una verificación adicional: correr el test una vez más y luego **entrar manualmente al perfil del paciente → pestaña "Consultas" → abrir la consulta recién creada**, comparando cada valor guardado (vía la respuesta real de `getConsultations`, no solo la UI) contra lo que el test dice haber llenado.

**Resultado:** todo coincidía exactamente — `padecimiento`, `apariencia`, `notas_evolucion`, `diagnosticos` (CIE-10 elegido), `impresion_diagnostico`, `servicios`, `indicaciones_general` (Tratamiento) e `indicaciones_procedimiento` (Laboratorios) — **excepto** `"motivo": ""` (vacío).

**Causa encontrada:** bug del propio test (no de la plataforma). `fillGeneralSection` usaba `input[name="visitaPaciente"]` para "Motivo de consulta" (selector heredado del spec viejo sin re-verificar), pero el campo real es un **`<textarea name="visitaPaciente">`**, no un `<input>` — el selector nunca matcheaba nada, así que el `if (isVisible)` fallaba en silencio y el campo se saltaba sin ningún error ni advertencia. Corregido a `textarea[name="visitaPaciente"]` (agregado también un log de advertencia por si vuelve a no encontrarse).

**✅ Reverificado tras el fix:** nueva corrida (`appointment_id 542`) → `getConsultations` confirma `"motivo": "Paciente acude a consulta por cefalea persistente..."` completo y correcto.

**Pendiente (no bloqueante, quedó fuera de esta reescritura):**
- [ ] Confirmar si el indicador "sin guardar" (triángulo, `scanResidualIndicators`/`detectUnsavedSections` en `e2e/utils.js`) sigue aplicando en algún lado con este rediseño, o si el nuevo indicador global "Sin cambios pendientes" lo reemplazó del todo — no se instrumentó en la reescritura.
- [ ] Confirmar qué hace el toggle "Expediente" / "Consultas" arriba a la derecha (no investigado).
- [x] ~~Este mismo rediseño probablemente afecta... no verificado aún si staging/producción ya tienen el nuevo diseño~~ — **producción CONFIRMADO con el nuevo "Modo Completo"** (2026-07-27, ver sección "🟢 Prueba completa en PRODUCCIÓN" más abajo). Sigue pendiente: (a) portar la reescritura de `tests/consultation.full-flow.spec.js` a `Mediplanner produccion/Tests_Produccion/consultation.full-flow.spec.js` (el spec oficial de ahí sigue con el modelo viejo de pestañas, quedaría roto si se corre tal cual); (b) confirmar si **staging** también migró ya (no probado).

### 🔍 Segunda ronda de verificación manual (2026-07-23, misma sesión) — 1 bug más encontrado y corregido; verificación de Tratamiento/Laboratorios/checkboxes quedó a medias

Pedro pidió ir más a fondo: confirmar también el medicamento/laboratorio específicos elegidos en Tratamiento/Laboratorios y las selecciones de checkboxes de Exploración segmentaria/Aparatos y sistemas (los 2 puntos que habían quedado sin verificar al mismo nivel que el resto).

**🐛 Bug encontrado (del test, no de la plataforma): selección de medicamento/laboratorio no verificaba que la opción clickeada coincidiera con lo buscado.** `fillTratamientoSection`/`fillLaboratoriosSection` tipeaban el término de búsqueda (ej. "Ibuprofeno") y clickeaban `.first()` de las opciones del dropdown **sin comprobar que esa opción realmente contuviera el término** — y el log imprimía el término buscado, no el texto real clickeado, ocultando el problema. Confirmado en vivo: buscando "Ibuprofeno" se guardó **"CAXICUM Tabletas"** (verificado contra `getTreatments` real). El dropdown no filtra tan estricto como se asumía.

**Corregido:** ambas funciones ahora recorren las opciones visibles buscando una cuyo texto contenga el término (case-insensitive) antes de clickear, loguean el texto REAL clickeado junto con lo buscado, y avisan explícitamente si no hubo ninguna coincidencia real. Reverificado: `Medicamento seleccionado: "TAMEX Tabletas...LORATADINA..." (buscado: "Loratadina")` y `Laboratorio seleccionado: "PERFIL BÁSICO" (buscado: "Perfil")` — ambos con coincidencia real confirmada.

**Método de verificación aprendido (útil para el futuro):** abrir una consulta pasada por click en la lista del perfil del paciente **no es confiable** — la lista no muestra la hora de creación y con varias consultas del mismo día es fácil abrir la equivocada (pasó dos veces). La forma confiable: llamar los endpoints **directo por API** dentro de la página autenticada (`page.evaluate` + `fetch`), usando:
- El **`id` interno** de la consulta (no el `relacion_id`/`appointment_id` de la cita) — se obtiene de `getConsultations` tomando el de **mayor `id`** (no el primero de la lista ni el que "parece" más reciente por fecha visible).
- Header **`x-rym-token-app`** obligatorio en cada request (se captura de cualquier request real de la app en curso, ej. vía el listener `page.on('request', ...)`).
- `paciente_id` obligatorio en el body de `getTreatments`/`getProceduresList`/`getFilledForm`, además de `consulta_id`.

**Estado: quedó a medias.** Con este método ya se re-confirmó General/Diagnóstico/Servicios/indicaciones de Tratamiento y Laboratorios para la consulta más reciente (`id=26`, `appointment_id=544`) — todo coincide. **Faltó terminar de verificar:**
- [ ] El **nombre específico del medicamento/laboratorio** guardado en `getTreatments`/`getProceduresList` para esta misma consulta (las llamadas fallaron por faltar `paciente_id`, se corrigió pero no se volvió a ejecutar).
- [ ] Las selecciones de checkboxes de **Exploración segmentaria** (`relacion_id` de formulario = 116) y **Aparatos y sistemas** (`relacion_id` = 115) vía `getFilledForm` — quedó armado pero sin ejecutar.
- Script de investigación en `_verificar_ultima_consulta.js` (raíz del repo, no trackeado, no borrar — retomar desde ahí).

---

## 🟢 Prueba completa en PRODUCCIÓN — 2026-07-27 (paciente dedicado "Prueba DE Codigo")

A pedido de Pedro, se corrió una consulta completa de punta a punta contra **producción real** (`https://admin.mediplanner.mx/`), aprovechando una cita ya agendada y visible en el Dashboard con botón "Iniciar" para el paciente **"Prueba DE Codigo"** (`paciente_id=1778`, consulta `id=1`, su primera consulta) — no el paciente default del spec (`Pedro Andrés Quijada Anaya`).

**Antes de esto, la sesión de producción (`Mediplanner produccion/storageState.json`) se regeneró** corriendo `auth.setup.ts` (que ya soportaba `MEDIPLANNER_EMAIL`/`MEDIPLANNER_PASSWORD` por variable de entorno, con fallback a `dr@rym-solutions.com`) vía un `.env` nuevo en `Mediplanner produccion/.env` (no trackeado, mismo criterio que el `.env` de dev) que Pedro completó él mismo con sus credenciales — no se manejaron contraseñas en texto plano en ningún momento de la sesión de Claude. **Nota técnica:** el proyecto `setup` de Playwright autentica correctamente (`storageState.json` se guarda bien) pero el *teardown* del contexto excede el timeout de 30s configurado y Playwright lo reporta como `1 failed`/`1 did not run` — falso negativo; correr el proyecto dependiente con `--no-deps` una vez que `storageState.json` ya está fresco evita el problema.

**Script dedicado** (no el spec oficial, que sigue apuntando a `Pedro Andrés Quijada Anaya` y crea su propia cita): `_prueba_consulta_prueba_de_codigo.js` en la raíz (no trackeado), adaptado de `tests/consultation.full-flow.spec.js` (dev) + `Mediplanner produccion/e2e/utils.js`. Reconocimiento previo con `_reconocer_diseno_consulta_produccion.js` (no trackeado).

**Hallazgos de entorno (no bugs de la app, pero relevantes para automatizar contra producción):**
- La cuenta usada llega a una pantalla de **onboarding** ("Pongamos tu consulta a punto") en vez del Dashboard directo — hay que clickear el link "Prefiero explorar por mi cuenta" primero.
- El Dashboard puede quedarse en **"Cargando..." indefinidamente** si no se espera explícitamente (`waitForFunction` a que desaparezca el texto) — un `waitForTimeout` fijo corto no alcanza.

**✅ Resultado — 0 errores de API en todo el flujo:**
- Diseño confirmado: producción **YA tiene el "Modo Completo"** (5/5 headings de sección detectados) — resuelve el pendiente de portar la reescritura de dev; el spec oficial de producción (`Tests_Produccion/consultation.full-flow.spec.js`, modelo de pestañas viejo) **quedaría roto** si se corriera tal cual, igual que pasó en dev el 2026-07-23.
- Signos vitales → `registerVitalSigns` 200 OK. Confirmado además visualmente en el perfil del paciente (peso 70kg, talla 170cm, FC 80, FR 18, temp 36.7 — coinciden exactos).
- 9 secciones llenadas (General, Apariencia general, Exploración segmentaria, Aparatos y sistemas, Diagnóstico, Tratamiento, Laboratorios y Procedimientos, Notas del Médico, Servicios) + guardado global: **7/7 endpoints 200 OK** (`editConsultation`, `addDiagnosis`, `setTreatments`, `setFreeTreatmentsConsultation`, `setProceduresConsultation`, `addServices`, `addNote`) + `finishConsultation` 200 OK (estatus final: `Terminada`).
- **Verificado campo por campo vía API** (mismo método de la sesión anterior: `getConsultation`/`getTreatments`/`getProceduresList`/`getFilledForm` directo por `fetch` autenticado): motivo, padecimiento, notas de evolución, apariencia, diagnóstico (CIE-10 `M542 - CERVICALGIA`, buscado "M54"), impresión diagnóstica, servicio (`Analisis Estrucutral $699`), medicamento (`VULCACID Cápsulas`, buscado "Omeprazol", con dosis/frecuencia/duración exactas) y laboratorio (`PERFIL BÁSICO`, buscado "Perfil") — **todo coincide exactamente**.

**🔧 2 hallazgos técnicos para automatizar verificación por API (no bugs, pero costaron reintentos):**
1. **Los `relacion_id` de formulario de checkboxes son específicos de cada entorno/base de datos** — los usados en dev para Exploración segmentaria/Aparatos y sistemas (116/115, ver sección anterior) **no existen en producción**, donde son **7 y 6** respectivamente. La forma robusta de descubrirlos en cualquier entorno: `POST /api/consultations/getForms` con `{paciente_id, consulta_id}` devuelve la lista de formularios de esa consulta con su `relacion_id` real — usar esto en vez de asumir un valor fijo.
2. **`getProceduresList` y `getFilledForm` requieren `doctor_id` en el body**, además de `paciente_id`/`consulta_id`(/`relacion_id`). Sin él, `getProceduresList` responde error explícito (`"El campo doctor_id es requerido"`, fácil de notar), pero **`getFilledForm` responde 200 OK con el formulario en blanco** (`"valor": []`/`0` en todos los campos) **sin ningún aviso** — un falso negativo real: la primera verificación de los checkboxes de esta misma sesión pareció mostrar que el guardado no había persistido, hasta agregar `doctor_id` (capturado de `getProfile`) y confirmar que sí: Exploración segmentaria guardó 3 valores, Aparatos y sistemas guardó 3 valores, cantidad exacta a lo marcado.

**Scripts sueltos nuevos de esta sesión** (raíz del repo, no trackeados, mismo criterio que `_verificar_ultima_consulta.js` — conservar como referencia): `_reconocer_diseno_consulta_produccion.js`, `_prueba_consulta_prueba_de_codigo.js`, `_verificar_getforms.js`, `_verificar_checkboxes_final.js`, `_verificar_procedimientos_checkboxes.js`, `_capturar_relacion_id_checkboxes.js`.

---

## 🐛 Error guessing en PRODUCCIÓN — 2026-07-27 (misma sesión, a continuación de la prueba completa)

A pedido de Pedro: agendar una cita **nueva** para "Prueba DE Codigo" e intentar provocar deliberadamente errores humanos reales dentro de esa consulta (misma técnica que `tests/consultation.user-errors.spec.js`, escrito en su momento para el modelo viejo de pestañas y nunca corrido — ver sección "🧪 Pendiente" más abajo). Los 6 escenarios de ese spec se adaptaron al "Modo Completo" actual. Script: `_error_guessing_consulta_produccion.js` (raíz, no trackeado); agenda su propia cita con un `crearCitaProduccion` local que replica el fix del wizard ya confirmado en dev (`e2e/utils.js`) — **el `createAppointment` de `Mediplanner produccion/e2e/utils.js` sigue con el selector viejo del wizard (`div.bg-white.shadow-md.rounded.p-5`) y esperando un botón "OK" que ya no existe tras el rename a "Confirmar cita" — quedaría roto si se usara tal cual contra producción hoy.**

### 🐛 Hallazgo 1 — Navegar fuera de una consulta en curso y volver la deja colgada PERMANENTEMENTE

Escenario: escribir en Notas del Médico sin guardar → `goto('/Pacientes')` → `goto('/Consulta/ConsultaGeneral')` (simula un médico que va a revisar otro paciente y vuelve, o usa atrás/adelante del navegador). **Resultado, confirmado en 2 corridas independientes con el mismo resultado exacto:** la página se queda mostrando **"Cargando información de consulta" indefinidamente, nunca resuelve** — ninguna sección del "Modo Completo" llega a renderizarse (confirmado con selectores de Motivo y del buscador de medicamento, ambos "resueltos pero hidden" en el DOM).

**Se probó recuperar con un F5 (`page.reload()`) y NO funcionó** — el reload de una página ya colgada sigue sin mostrar el contenido. Pero en un diagnóstico aislado (`_diagnostico_reload_consulta.js`), un **F5 hecho DURANTE el uso normal (sin haber navegado fuera primero) sí recarga la consulta con total normalidad** (mismos datos, Motivo visible). Conclusión: el problema no es "cualquier recarga rompe la consulta" — es específicamente que **navegar a otra sección de la app y volver por URL directa pierde algún estado de navegación (probablemente pasado por `location.state` de React Router al hacer clic en "Iniciar" desde el Dashboard, no reconstruible desde la URL sola) de forma irrecuperable para esa pestaña.**

**Impacto real:** un médico que, a mitad de una consulta sin finalizar, navega a "Pacientes" (por ejemplo para revisar a otro paciente) y luego intenta volver a su consulta (con el botón atrás del navegador, un marcador, o retecleando la URL) se quedaría con la pantalla colgada sin poder continuar — tendría que volver a Inicio y reabrir la cita desde ahí (no confirmado si el sistema se lo permite sin duplicar la consulta).

### 🐛 Hallazgo 2 — Un cambio hecho después de "Guardar cambios" se pierde en silencio si se Finaliza sin re-guardar

Escenario: completar la consulta normalmente → clic en "Guardar cambios" (global, todo OK) → **modificar la Impresión diagnóstica** (cambio nuevo, no guardado) → clic directo en **"Finalizar Consulta"** sin volver a apretar "Guardar cambios". **Resultado confirmado vía API (`getConsultation`):** el valor final guardado es el **anterior** (el que había antes del último cambio) — el cambio hecho tras el último guardado **se perdió completamente**, sin ningún mensaje de advertencia ("tienes cambios sin guardar", confirmación, o bloqueo del botón "Finalizar").

**Impacto real:** si un médico hace un último ajuste (a cualquier campo del área "Modo Completo" que se guarda con el botón global — Diagnóstico, Tratamiento, Notas, Servicios, General) justo antes de finalizar, sin darse cuenta de que hace falta volver a apretar "Guardar cambios" primero, ese dato se pierde silenciosamente y la consulta queda finalizada con información desactualizada. Vale la pena confirmar con devs si es el comportamiento intencional (quizás "Finalizar" fue diseñado asumiendo que todo ya está guardado) o si debería auto-guardar/advertir.

### Otros 4 escenarios probados — comportamiento correcto, sin hallazgos

- **Typo + corrección en Motivo antes de guardar:** el valor final guardado es el corregido, no el error de tipeo original. OK.
- **Carrera al cambiar de medicamento buscado** (buscar "Paracetamol", cambiar a "Ibuprofeno" antes de que carguen las opciones): quedó guardado un medicamento que sí contiene ibuprofeno ("DUALGOS Tabletas", combinado ibuprofeno+paracetamol) — el sistema no se quedó pegado con la primera búsqueda. OK.
- **Doble-click en "Guardar Respuestas"** de un checklist (Exploración segmentaria): solo se disparó **1** llamada de guardado real pese al doble-click (protegido a nivel de UI) y el valor final tiene exactamente los 3 checkboxes marcados, sin duplicar. OK.
- **Doble-click en "Guardar cambios" GLOBAL:** a diferencia del anterior, **este botón SÍ disparó llamadas de red duplicadas** (`editConsultation`×2, `addDiagnosis`×2, `setProceduresConsultation`×2, `addServices`×2 — no está protegido a nivel de UI/deshabilitado tras el primer click), **pero el backend fue idempotente**: verificado vía API que diagnóstico, servicio y medicamento quedaron guardados **una sola vez cada uno**, sin duplicados reales. No es un bug de datos, pero sí una falta de protección en el frontend (carga de red innecesaria) — vale la pena como mejora menor si se reporta.

---

## 🐛 Error guessing — reproducción en DEV — 2026-07-27 (misma sesión, a pedido de Pedro)

Objetivo: confirmar si los 2 hallazgos de producción son de la **plataforma en general** o específicos de ese entorno. Paciente usado: **Daniela Jiménez Durán** (ya existente en dev, mismo paciente del `consultation.user-errors.spec.js` original). Scripts: `_error_guessing_consulta_dev.js` (Hallazgo 1) y `_hallazgo2_finalizar_sin_guardar_dev.js` (Hallazgo 2), ambos en la raíz, no trackeados.

**✅ Hallazgo 1 — REPRODUCIDO en dev, igual que en producción.** Escribir en Notas sin guardar → ir a `/Pacientes` → volver a `/Consulta/ConsultaGeneral` por URL directa dejó la página colgada en "Cargando información de consulta" indefinidamente, y un F5 (`reload()`) posterior **tampoco la recuperó** — mismo comportamiento exacto que en producción. Esto sube la confianza de que es un bug real del frontend/manejo de estado de navegación (no algo específico de la configuración de producción).

**❓ Hallazgo 2 — NO SE PUDO VERIFICAR en dev** (ni confirmado ni descartado) tras 6+ intentos, todos bloqueados **antes** de llegar siquiera a poder probarlo. Causa: la cuenta de dev usada (`storageState.json` de la raíz, perfil "Walter Hartwell White") cae de forma **intermitente** en un wizard extendido de **"Configuración de tu cuenta"** (6 pasos: Tu perfil / Credenciales / Consultorios / Horarios / Tipos de cita / Métodos de pago — con un link "Configurar más tarde" para salir) — distinto del onboarding simple de una sola pantalla visto en producción ("Pongamos tu consulta a punto" / "Prefiero explorar por mi cuenta"). Lo intermitente es justamente el problema: a veces navegar a `/Dashboard` cae ahí, a veces no, **dentro de la misma sesión ya autenticada**, sin un patrón claro. Se fueron resolviendo capas sucesivas de esto en el camino (espera robusta de "Cargando...", manejo del wizard con clicks `force:true` por elementos inestables/desprendidos del DOM, espera explícita a que "Agenda de hoy" termine de poblarse antes de buscar el botón "Iniciar" — esa sección depende de una llamada async más lenta que el resto del layout) pero el wizard volvió a interponerse una vez más y se decidió **no seguir iterando indefinidamente**.

**Nota aparte, no relacionada a los hallazgos:** en el camino se crearon **~7 citas de prueba para "Daniela Jiménez Durán" en dev, el mismo día (2026-07-27)**, a las 12:15/12:20/12:25/12:30/12:35/12:40/12:45/12:50 — subproducto de los reintentos (cada corrida de `createAppointment` agenda una cita nueva). No se limpiaron; son datos de prueba en dev, no debería ser un problema, pero queda anotado por si se nota un volumen inusual de citas para esa paciente ese día.

**Conclusión práctica:** dev es notablemente **más inestable que producción** para completar este flujo de punta a punta con automatización (consistente con lo ya documentado — "el entorno dev también es flaky" — pero esta vez el obstáculo fue un wizard de onboarding intermitente, no solo los bundles de analytics abortando). Si se quiere insistir en confirmar el Hallazgo 2 en dev, probablemente convenga que Pedro verifique manualmente primero por qué esa cuenta de dev cae en el wizard de "Configuración de tu cuenta" de forma intermitente (¿cuenta con onboarding genuinamente incompleto? ¿bug de la app que muestra el wizard al azar?) antes de retomar la automatización.

---

## 📱 Suite Appium — Mediplanner pacientes — 2026-07-27 (misma sesión, a pedido de Pedro)

Corrida completa de `MediplannerAppiumAutomation/Appium/` (app móvil Android de Mediplanner **para pacientes** — no confundir con la web admin para doctores que es el resto de este documento). Setup: emulador `emulator-5554` ya estaba corriendo: Appium server levantado en `:4723` (puerto verificado libre antes), `adb`/`ANDROID_HOME` resueltos vía `$LOCALAPPDATA/Android/Sdk`. Comando: `pytest tests/ -m "not destructivo"` (42 tests recolectados, se excluyeron a propósito los marcados `destructivo` — "modifica o borra datos del paciente de prueba", según `pytest.ini`).

**Resultado: 26 passed, 16 failed, 5 errors, 1580s (~26 min).** Al terminar se detuvo el servidor Appium — **`TaskStop` NO mató el proceso `node.exe` hijo** (advertencia que ya está en el propio `CLAUDE.md` del subproyecto), hubo que confirmar con `netstat` y forzar con `taskkill //F //PID`.

**Clasificación de los 16 fallos (primera corrida, sin re-verificar — no tratar como bugs confirmados todavía):**

Con indicios claros de ser el emulador/infraestructura flaky, no la app:
- `test_login` → `test_navegacion_tabs` → `test_doctor_search`: fallan en cascada. El primero encontró la sesión ya activa (`no_reset=True`), no pudo cerrar sesión ("No se encontró el icono de menú"), y quedó en un estado roto que arrastró a los otros dos.
- `test_volver_inicio`: "la app salió de foreground; reactivando" **12 veces seguidas** antes de rendirse.
- Los 5 `ERROR` de teardown (`[MONITOR][CRASH] la app no quedó en foreground`) son el crash-monitor detectando exactamente esos mismos 5 tests — no son fallos adicionales.
- `test_perfil_datos_personales`: `StaleElementReferenceException` (error técnico de Appium/caché de elementos, no de la UI — ya había validado 3 pasos con éxito: carga de datos reales, CURP inválida deshabilita "Siguiente", CURP restaurada la rehabilita).
- `test_medicos_flujo_completo`: "no se listó ningún médico en la pantalla inicial" — sospechoso porque **otro test de la misma corrida sí encontró médicos** ("Dr. Fernando Salinas Baylón", en `test_consultas_reprogramar_cita`).
- `test_dependientes_agregar` (33s de espera antes de fallar) y `test_dependientes_desvincular` (42s) — tiempos inusualmente largos previos al timeout.

Candidatos a revisar con más cuidado antes de descartarlos o confirmarlos (podrían ser bugs reales, datos del paciente de prueba, o aún timing):
- `test_consultas_reprogramar_cita` — el más sospechoso de ser real: tras elegir un doctor y "Solicitar cita", "Selecciona el tipo de consulta" no lista ningún tipo (`assert tipos, "No hay tipos de consulta disponibles"`).
- `test_perfil_cuenta` — no encontró "Cancelar suscripción" (los 3 pasos previos en esa misma pantalla — "Ver todos los planes" con 4 planes, cambiar ciclo de facturación, "Guardar cambios" — sí funcionaron).
- `test_perfil_compartir` — no encontró los campos "Nombre completo"/"10 dígitos" del formulario "Añadir manualmente" (el propio test ya tiene un comentario de un ajuste de timing previo en este mismo paso).
- `test_medicinas_ver_lista_detalles` — sin medicamentos en lista Y sin el mensaje de estado vacío esperado ("No hay medicamentos").
- `test_agregar_medicamento_personal` — búsqueda "Amlo" (prefijo de "Amlodipino", elegido al azar por el test) sin resultados en el catálogo.
- `test_bitacora_registrar_deposicion` — no encontró la opción "Tipo 4" de la escala de Bristol.
- `test_bitacora_buscador_lista` — buscar "Temp" en categoría Medición no devolvió ítems.
- `test_estudios_ver_lista_detalles` — el paciente de prueba no tiene estudios cargados (podría ser solo dato, no bug).

**Pendiente:** decidir con Pedro si vale la pena reverificar `test_consultas_reprogramar_cita` (el candidato más fuerte) con 2-3 corridas limpias antes de reportarlo, siguiendo el mismo criterio riguroso ya usado en este proyecto para la web (no reportar hallazgos sin re-confirmar).

---

## Decisiones abiertas / pendientes

- [x] ~~Commit + push de stress tests + config + fix facturacion~~ — hecho (commit `1bb9cd7`, pusheado a main/Trabajando/Normalization el 2026-06-17).
- [ ] Bug 422 "relacion_id"/"campos obligatorios" en dev — **NO reproduce ya** (3/3 corridas limpias de `doctor-consultation` el 2026-07-21, ver sección "🔁 Re-verificación del bug 422" arriba). Estuvo vigente desde antes de 2026-06-17 hasta al menos el 2026-07-09 (cambiando de endpoint: `getFilledForm` → `getFilteredAppointments`/`getAppointmentCount`). No hace falta reportarlo ya si sigue sin reproducir en próximas corridas; no se cierra del todo, solo se baja de prioridad.
- [x] ~~Reportar a devs: indicador "sin guardar" no se limpia en Tratamiento › Laboratorios y Procedimientos~~ — **no se reprodujo en 3 corridas del full-flow el 2026-07-09** (2 pacientes distintos). Probablemente arreglado; dejar de tratarlo como bug confirmado, pero sin cerrarlo del todo (ver sección de verificación).
- [x] ~~Arreglar fallback de `fillTabFields` en `e2e/utils.js`~~ — hecho: usa `load` en vez de networkidle, solo rellena campos obligatorios (`required`/`aria-required`), valores numéricos realistas por campo, log de resumen.
- [x] ~~Aplicar mejoras a Staging/Producción: propagar `scanResidualIndicators` y el fix de guardado de Exploración~~ — **hecho.** Verificado en código: `scanResidualIndicators` está en `Mediplanner Staging/e2e/utils.js` y `Mediplanner produccion/e2e/utils.js`; el fix de Exploración (`fillExplorationSection`, guarda una vez al final) está en los 3 `consultation.full-flow.spec.js` (dev/staging/producción).
- [x] ~~Reportar a devs (staging): 422 `getFilledForm` "relacion_id es requerido" y 404 "No se encontró el formulario asignado al paciente" al finalizar consulta~~ — **solucionados por devs**, confirmado por Pedro el 2026-07-21.
- [x] ~~Reportar a devs: `DetallePagos` no maneja `getFiscalData` vacío (TypeError `reading 'cp'`)~~ — **solucionado por devs**, confirmado por Pedro el 2026-07-21.
- [x] ~~Ejecutar en staging `vacunacion-ciclo-completo` (destructivo) sobre `Pedro Quijada Anaya`~~ — **hecho** el 2026-06-25 (ver sección STAGING). También se ejecutó, sin haber quedado planeado aquí, en **producción** sobre Agustin Tapia el 2026-06-29 — confirmar con Pedro si fue intencional.
- [x] ~~Correr `doctor-consultation` reescrito (2026-07-28, verificación dura post-Finalizar) contra dev~~ — **hecho el 2026-07-30, 2 corridas**: la verificación dura pasa limpia las 2 veces; encontró en el camino el 404 reproducible de `getFilledForm` post-Finalizar (ver sección "🎯 Error guessing en DEV — 2026-07-30").
- [ ] Re-confirmar con una 2ª corrida limpia el bug del botón "Consulta" (Tipo/Hospital vacíos) antes de reportarlo formalmente a devs — la única corrida adicional intentada (2026-07-30, paciente distinto) no llegó a navegar a la consulta, variabilidad sin investigar.
- [x] ~~Probar campos obligatorios y selects dependientes en el wizard de alta de paciente nuevo~~ — **hecho el 2026-07-30, sin hallazgos** (bien validado en front y backend, ver sección "🎯 Error guessing en DEV — 2026-07-30").
- [ ] Investigar el 404 `getFilledForm` post-Finalizar reproducido 2/2 el 2026-07-30 — identificar qué formulario específico pide la app y confirmar con devs si el fix de staging (2026-07-21) llegó a dev.
- [ ] Repetir la prueba de "navegar sin guardar" en **Antecedentes** con los selectores correctos (es un formulario dinámico por pregunta, no textareas simples) — intento del 2026-07-30 no aplicó.
- [x] ~~Reportar formalmente a devs: carrera de búsqueda en CIE-10~~ — **retractado.** Re-corrido con timing humano realista (2026-07-30): no reproduce. Ver sección "⚠️ Retractado tras re-prueba con timing realista".

---

## 🔧 Fix selector de Pacientes + limpieza de archivos muertos — 2026-07-21

**⚠️ Fix de seguridad — sesión de producción destrackeada.** `Mediplanner produccion/storageState.json` estaba **trackeado en git** desde el commit `7732ff7` (2026-06-15), pese a que `.gitignore` tiene `**/storageState.json` (esa regla se agregó después y nunca se hizo el `git rm --cached` correspondiente). Contenía cookies/tokens de sesión reales de producción, expuestos en el historial de GitHub. Se hizo `git rm --cached` (el archivo local NO se tocó, sigue existiendo para correr tests). **Pendiente:** evaluar si conviene invalidar/rotar esa sesión dado que ya estuvo expuesta en el historial remoto (el `git rm --cached` no borra el commit viejo donde ya se subió).

**Archivos muertos eliminados del repo** (`git rm`, sin reemplazo — ya no se usaban, `.bak`/`.backup` no son recogidos por Playwright):
- `playwright.config.ts.bak` (versión TS vieja del config, superada por `playwright.config.js`).
- `tests/consultation.start.spec.js.backup` y `Mediplanner produccion/Tests_Produccion/consultation.start.spec.js.backup` (versión pre-rediseño de la consulta, superada por `consultation.full-flow.spec.js`).
- `tests_copy.bat` (script de porteo dev→producción vía robocopy) se mantiene, sigue en uso.

**Selector roto de la lista de Pacientes — CONFIRMADO Y CORREGIDO.** Documentado desde el 2026-07-07 (bloqueaba 7 specs). Se inspeccionó el DOM real de `/Pacientes` en dev con un script Playwright puntual (sesión ya autenticada vía `storageState.json`): el nombre del paciente pasó de `<a class="font-semibold text-sm text-gray-900">` a `<span class="font-semibold text-sm text-gray-900 hover:text-primary truncate">` dentro de una celda de `react-data-table-component` (`div.rdt_TableRow` → celda con `data-tag="allowRowEvents"`). Se verificó en vivo que un click en ese `<span>` sigue navegando al detalle del paciente (el evento hace bubbling hasta el handler del row). Corregido el selector (`a.font-semibold...` → `span.font-semibold...`) en los 7 archivos afectados:
- `tests/recetas.explorar.spec.ts`, `tests/recetas.spec.ts`
- `tests/stress tests/antecedentes.stress.test.ts`, `tests/stress tests/facturacion.stress.test.ts`, `tests/stress tests/pacientes.stress.test.ts`
- `tests/vacunacion.ciclo-completo.spec.ts`, `tests/vacunacion.explorar.spec.ts`

✅ **Verificado con 2 corridas reales contra dev tras el fix:**
- `stress-facturacion`: **2 passed**, 0 responses con error de API — por primera vez en semanas la suite llega hasta el formulario de Facturación. **No se observó el 422 `relacion_id`/"campos obligatorios"** en esta corrida (ni `getFilledForm` ni ningún 4xx). Nota: no es la misma ruta donde se documentó originalmente el bug (ese se vio en `getFilteredAppointments`/`getAppointmentCount` durante `doctor-consultation`) — no se puede dar por cerrado con una sola corrida en esta pantalla, pero es la primera vez que se puede validar Facturación directamente.
- `vacunacion-explorar`: **2 passed**, 0 responses con error de API — confirma que el fix generaliza a otro spec (no solo facturación).

**✅ Confirmado en los 5 specs restantes (misma sesión, 2026-07-21):**
- `recetas-explorar`: 2 passed, limpio.
- `recetas`: 2 passed — pero encontró un **bug de test nuevo** (no de la app): el contador de paginación real es `"1–10 de 82"` con **guión largo "–"** (no un guión ASCII `-`), y el regex `/\d+\s*-\s*\d+\s+de\s+\d+/` nunca lo matcheaba → el test comparaba `""` contra `""` y fallaba siempre en "Paginación avanza". Corregido a `/\d+\s*[-–]\s*\d+\s+de\s+\d+/`. Re-corrida: **"1–10 de 82" → "11–20 de 82"**, pasa limpio.
- `stress-antecedentes`: 2 passed — otro **bug de test nuevo**: la sub-pestaña "Antecedentes" (scrollspy dentro de Información) también pasó de `<a>` a `<button>`, igual que ya se había parchado para "Información" en este mismo archivo, pero no se replicó para "Antecedentes". Corregido: `button:has-text("Antecedentes"), a:has-text("Antecedentes")`.
- `stress-pacientes`: 2 passed, limpio.
- `vacunacion-ciclo-completo` (destructivo, patient default de dev): 2 passed — borró y re-registró **41 dosis** correctamente (verificado tras refrescar). 2 hallazgos blandos sin severidad: no aparece "Guardar cambios" tras borrar dosis, y no hay fila de "otra vacuna" para llenar en este paciente (no bloquean el test).

**Selector de Pacientes: fix confirmado end-to-end en los 7 specs afectados.** 0 responses con error de API en ninguna corrida (ninguna mostró el 422 de `relacion_id`, pero — como ya se anotó — no es la misma pantalla donde se documentó originalmente ese bug). Pendiente real: re-verificar el 422 con 2-3 corridas de `doctor-consultation`/`getFilteredAppointments` antes de considerarlo resuelto o no reproducido.

### 🔁 Re-verificación del bug 422 "relacion_id"/"campos obligatorios" — 2026-07-21 (misma sesión)

Se corrió `doctor-consultation` **3 veces seguidas** contra dev, específicamente para reverificar este bug en su ruta original (`getFilteredAppointments`/`getAppointmentCount`, documentado como "SIGUE VIVO" el 2026-07-09 — ver esa sección más abajo). Resultado: **las 3 corridas pasaron limpias (2 passed cada una) con 0 responses con error de API.** Se confirmó explícitamente en los logs que `getFilteredAppointments`, `getAppointmentCount` y `getFilledForm` respondieron **200 OK** en las tres corridas, sin ningún 422 ni otro 4xx.

Con 3/3 corridas limpias (mismo criterio ya usado para bajar el hallazgo del indicador "sin guardar" el 2026-07-09), **se baja este bug de "confirmado/vigente" a "no reproduce"**. No se cierra del todo por si vuelve a aparecer — mantenerlo documentado como referencia histórica (ver detalle original en la sección de re-verificación 2026-07-09 y en "🐛 Hallazgo de QA" arriba) y volver a chequear si se ve algo raro en consultas/citas a futuro.

### 🧪 Pendiente: verificar `consultation.user-errors.spec.js` (6 tests de "error guessing", sin correr aún)

Analizando qué más automatizar en Mediplanner, se decidió atacar una categoría distinta a la ya cubierta: no fuzzing de seguridad (eso ya lo hace `consultation.inputs-validation.spec.ts` — XSS/SQLi/campos inválidos), sino **errores humanos reales pero legítimos** durante una consulta (técnica formal: *Error Guessing*, complementada con la dimensión "Operations" del modelo HTSM/SFDPOT de James Bach). Investigación previa en internet sobre la técnica y sobre errores típicos de captura de datos en software clínico/EHR (ver fuentes citadas en el chat de esa sesión: error guessing, race conditions en autosave/debounce, doble-submit, errores de identificación de paciente).

Se creó `tests/consultation.user-errors.spec.js` (proyecto **`consultation-user-errors`** ya agregado a `playwright.config.js`) con **6 tests**, cada uno simulando un error concreto y verificando el **estado real guardado en el servidor** (vía la respuesta de la API), no solo la UI:

1. **Timing/carrera:** cambiar de pestaña (Diagnóstico→Tratamiento) justo tras seleccionar un CIE-10, sin esperar el autosave — el dato no debe perderse al volver.
2. **Corrección de datos:** escribir una dosis con typo ("250"), corregirla ("25") antes de guardar — debe persistir el valor corregido, no el original (inspirado directamente en el ejemplo real de la literatura de EHR).
3. **Identificación de paciente:** se descubrió en el camino que en dev existen **2 pacientes dependientes reales con nombre idéntico** ("Juan Garcia Perez", ids `853` y `861`) con el **mismo correo, teléfono y fecha de nacimiento** — indistinguibles en la lista para un humano. El test no asume cuál "debería" abrirse; verifica que el sistema abre el `id` real correspondiente a la fila clickeada (no confunde uno por otro), y loguea como hallazgo blando la falta de un campo distintivo en la UI.
4. **Flujo interrumpido:** escribir en Notas del Médico sin guardar, navegar a Pacientes, volver — el texto no guardado no debe reaparecer (no debe haber autosave silencioso no documentado).
5. **Duplicación accidental:** doble-click en "Guardar cambios" de Tratamiento — no debe duplicar el medicamento agregado.
6. **Orden no lineal:** llenar y guardar Tratamiento ANTES que Diagnóstico (saltando el orden esperado) — ninguno de los dos debe pisar al otro.

**Estado real: escrito pero NUNCA corrido contra dev.** Los selectores (formulario de medicamento, tabs, CIE-10) están basados en los mismos patrones ya confirmados en `consultation.full-flow.spec.js`, pero el archivo es nuevo y self-contained (no comparte código con el spec insignia, a propósito, para no arriesgarlo) — es esperable que la primera corrida encuentre selectores rotos o timing a ajustar, como pasó con cada spec nuevo de esta sesión. Paciente usado: **Daniela Jiménez Durán** (`PACIENTE_BUSQUEDA = 'Daniela Jiménez'`), crea una cita nueva para HOY en cada test.

**Pendiente real (próxima sesión o cuando Pedro retome esto):**
- [ ] Correr `npx dotenv -e .env -- playwright test --project=consultation-user-errors` contra dev y arreglar lo que rompa (esperable: selectores del formulario de medicamento, timing de `waitForResponse`, posible ajuste del test 3 si ya no existen los 2 "Juan Garcia Perez" duplicados).
- [ ] Si el test 3 confirma que los 2 pacientes duplicados siguen sin campo distintivo en la lista, evaluar reportarlo como hallazgo de UX/seguridad de datos (no es exactamente un "bug" de código, pero es un riesgo real de identificación de paciente).
- [x] ~~Escenarios 1, 2, 4, 5, 6 (timing, corrección de datos, flujo interrumpido, duplicación, orden no lineal)~~ — **adaptados al "Modo Completo" y corridos contra PRODUCCIÓN el 2026-07-27** (no contra dev, y con un script aparte — no se tocó/actualizó este `.spec.js`, que sigue con los selectores del modelo viejo de pestañas). Ver sección "🐛 Error guessing en PRODUCCIÓN" más arriba: 2 hallazgos reales confirmados (navegar fuera de la consulta la cuelga permanentemente; Finalizar sin re-guardar pierde el último cambio) y 4 escenarios que pasaron limpio. **Este `.spec.js` en sí sigue sin correr y necesitaría reescribirse para el Modo Completo** (mismo trabajo pendiente que ya tiene `consultation.full-flow.spec.js` en `Mediplanner produccion/`) si se quiere formalizar como test automatizado repetible en vez de script exploratorio suelto. El escenario 3 (pacientes duplicados) no se adaptó — es independiente de la consulta en sí.

### 🆕 Nueva automatización: `dashboard.spec.js` — el Dashboard pasó de 0 asserts a verificación real de datos

Analizando dónde más generar valor en Mediplanner, se identificó que **el Dashboard** (primera pantalla que ve cualquier usuario al loguear) tenía **0 asserts duros** — `dashboard.explorar.spec.js` es puramente exploratorio/de mapeo, así que nada avisaba si se rompía. Se creó `tests/dashboard.spec.js` (proyecto **`dashboard`** en `playwright.config.js`), que captura en vivo las respuestas de `getDashboardData`/`getDashboardPayments`/`getFilteredAppointments`/`getLastProceduresFilesByDoctorId` y verifica que la UI las refleje correctamente:
- Las 4 tarjetas KPI (Consultas/Recurrentes/Nuevas/Pacientes) muestran el número real de `getDashboardData` (`monthConsultations`, `recurring`, `patientsMonth`, `patientsTotal`).
- El calendario (react-day-picker, `table[role="grid"]` con `aria-label="<mes> <año>"` en minúsculas, celdas `[data-day="YYYY-MM-DD"]`) muestra el mes/año real y la celda de hoy existe y no está deshabilitada.
- "Corte de hoy" coincide con `encabezado_actual` de `getDashboardPayments` (total recaudado + consultas del día).
- "Agenda de hoy" muestra el estado vacío/con-citas correcto según `getFilteredAppointments` de hoy.
- "Nuevos estudios" lista contenido cuando `getLastProceduresFilesByDoctorId` trae datos.
- 0 responses con error de API durante toda la carga.

**Gotcha de selectores descubierto en el camino:** las etiquetas de las tarjetas KPI se ven en MAYÚSCULAS pero en el DOM real son texto normal ("Consultas", no "CONSULTAS") — es solo CSS `text-transform`. `page.locator('text="CONSULTAS"')` (case-sensitive, exact) no matcheaba nada. Se resolvió con `getByText(regex, 'i')`. Además, el label "Pacientes" de la tarjeta KPI colisiona con el link "Pacientes" del sidebar (mismo texto) — se acotó la búsqueda a `page.locator('main')` para evitar falsos positivos.

✅ **Verificado con 2 corridas limpias contra dev:** 2/2 passed ambas veces, 0 errores de API, todos los valores coinciden con las respuestas reales de la API.

### ⏱️ Fix de performance — ~30s perdidos en el toggle "Agregar observaciones" de Diagnóstico

Mientras se investigaba por qué el paso de Diagnóstico tardaba tanto en avanzar (pregunta de Pedro viendo la corrida en pantalla, captura del campo "Observaciones*" vacío con "Guardado hace 27s · pendiente de guardar"), se instrumentó `consultation.full-flow.spec.js` con timers `Date.now()` y se aisló la causa exacta: `obsCheckbox.check({ force: true })` sobre el checkbox oculto (`<input class="sr-only peer">` del toggle "Agregar observaciones") tardaba **30140ms** — Playwright reintenta el click esperando que la propiedad `checked` cambie, pero el truco `sr-only` (posición absoluta, tamaño casi nulo) nunca se lo confirma, así que agota el timeout (~15s), cae al fallback (`label.click({force:true})`), que repite el mismo problema (~15s más) = ~30s perdidos en cada corrida, sin ningún beneficio: el textarea de observaciones (ahora "Notas adicionales") ya estaba en el DOM en los 3 textareas encontrados, independientemente del estado del toggle.

**Fix aplicado en `fillDiagnosticoSection`:** ahora primero busca un textarea visible que no sea Impresión diagnóstica ni el combobox CIE-10; si lo encuentra, lo llena directo sin tocar el checkbox. Solo si NO aparece ningún textarea intenta el toggle, y con `timeout: 3000` explícito en vez del default de 15s (tope real ahora: ~6s en el peor caso, no 30s).

✅ **Verificado:** una corrida donde el textarea sí necesitó el toggle (mismo camino que antes) bajó de ~167s a **142.6s** (~24s más rápida), con `addDiagnosis.observaciones` guardándose correctamente igual que antes. Cuando el campo ya está visible de entrada (pasó en corridas anteriores de esta misma sesión), el ahorro sería aún mayor (los ~30s completos). No se pudo determinar la condición exacta que hace que a veces el campo ya esté visible y a veces no (podría depender del CIE-10 elegido al azar, o de estado previo del paciente) — no bloqueante, el fix cubre ambos casos.

---

## 🔍 Verificación de pendientes — 2026-07-07

Sesión dedicada a comparar este documento contra el estado real del código y de la app (dev), analizando código + corriendo automatizaciones. Resumen arriba (items tachados); dos hallazgos nuevos:

1. ~~**🐛 Selector roto en la lista de Pacientes (bloquea validar el bug de facturación por automatización).**~~ — **corregido el 2026-07-21**, ver sección "🔧 Fix selector de Pacientes" arriba. Corrí `stress-facturacion` 2 veces contra dev — ambas fallaron **en el mismo punto exacto**, antes de llegar siquiera al formulario de Facturación: `page.waitForSelector('a.font-semibold.text-sm.text-gray-900')` agota el timeout de 25s. El screenshot del fallo muestra la lista de Pacientes cargada correctamente (35 pacientes, paginado bien) — pero el snapshot de accesibilidad confirma que el nombre del paciente **ya no es un `<a>`**, es un `<div>` (`generic [cursor=pointer]`). La app cambió la estructura de esa celda. Esto rompía el selector en **7 specs**: `recetas.explorar.spec.ts`, `recetas.spec.ts`, `tests/stress tests/antecedentes.stress.test.ts`, `tests/stress tests/facturacion.stress.test.ts`, `vacunacion.ciclo-completo.spec.ts`, `vacunacion.explorar.spec.ts`, `tests/stress tests/pacientes.stress.test.ts`.
2. **Ejecución de `vacunacion-ciclo-completo` en producción no documentada** (ver checklist arriba) — screenshots del 2026-06-29 muestran que corrió sobre Agustin Tapia en `Mediplanner produccion/`. Vale confirmar con Pedro si fue una corrida intencional o quedó pendiente de revisar el resultado.

---

## 🐛 Wizard de "Agendar cita" roto + fix, paciente parametrizable — 2026-07-09

Se quiso correr `doctor-consultation` (full-flow) contra dev con la paciente **Carla Perez Rojas** (no la default). Para eso, `tests/consultation.full-flow.spec.js` ahora soporta `PACIENTE_NOMBRE`/`PACIENTE_BUSQUEDA` por variable de entorno (mismo patrón que `PERCENTIL_RUN`); sin esas variables sigue usando el default `Percentil Prueba Prueba`.

Al correrlo, aparecieron **2 selectores rotos por un cambio de UI en el wizard de "Agendar cita"** — bloqueaban CUALQUIER corrida del full-flow (no es algo específico de Carla):

1. **Contenedor del wizard** (`e2e/utils.js` línea ~319): perdió sus clases Tailwind `bg-white shadow-md rounded p-5` (ya no existen en el DOM). Fix: ubicarlo por el heading "Agendar cita" (estable) + el ancestro más cercano que contenga un input (`xpath=ancestor::div[.//input][1]`), en vez de fijar otro set de clases que puede volver a romperse con un rediseño.
2. **Botón de confirmación final se renombró de "Agendar cita" a "Confirmar cita"**, y ya no aparece un modal "OK" después — la app navega directo a la pantalla de éxito "¡Cita agendada!". Este era el bug real que rompía el flujo: el código esperaba 15s un botón que ya no existe, fallaba, y el `catch` pasaba al siguiente día del loop de fechas — pero como el step 3 (fecha) queda colapsado tras avanzar al step 4 (confirmación), el input de fecha ya no es visible y todos los días siguientes fallan igual con "element is not visible", hasta agotar el loop y tirar "No se pudo registrar una cita en los próximos 5 días" (aun cuando a veces una cita SÍ llegaba a crearse a medias).

✅ **Corrida completa verificada tras el fix:** `2 passed (3.2m)` para Carla Perez Rojas en dev — cita agendada, consulta completa (signos vitales, exploración, tratamiento, notas, servicios, finalización). Los 3 errores 422 del resumen del DevTools monitor (`getFilteredAppointments`, `getAppointmentCount`, `setProceduresConsultation`) son el bug de plataforma ya conocido (`relacion_id`/campos obligatorios, ver hallazgo de QA arriba), no relacionados con este fix.

**Pendiente:** no se volvió a correr el full-flow para el paciente default (`Percentil Prueba Prueba`) tras este fix — sería bueno confirmar que también sigue pasando.

---

## 🐛 Rediseño de Ingresos + adaptación de `ingresos.spec.ts` — 2026-07-09

La pantalla de **Ingresos** cambió por completo: pasó de una tabla simple con filtro de estatus a un **dashboard** con tarjetas resumen (Citas del período, Total del período, Total cobrado), un panel "Filtrar registros" (Paciente, Consultorio, Estatus, Periodo) y un "Historial de ingresos" ahora renderizado con **react-data-table-component** (clases `rdt_Table`/`rdt_TableRow`/`rdt_TableCell`, no una `<table>` nativa). El flujo de registrar un pago también cambió de raíz. Se adaptó `tests/ingresos.spec.ts` en consecuencia:

1. **Selectores rotos por el rediseño:**
   - `select#estatus` perdió su `id` → ahora solo `select[name="estatus"]`.
   - El botón de filtro sin texto (identificado por clases CSS) ahora es un botón **"Buscar"** con nombre accesible propio.
   - El locator de filas (`'tr, [class*="row"]'`) matcheaba de más — cualquier div con "row" en la clase, no solo filas reales — e inflaba los conteos. Se cambió a `.rdt_TableRow` (clase estable de la librería de tabla).
   - El ícono de "Ver" (ojo) vive dentro de un `<button class="menu-link">` real; `.locator('..')` (un solo nivel) caía en un `<span>` intermedio, no el botón. Se sube por `xpath=ancestor::button[1]`.
2. **Flujo de pago simplificado — pasos "Abonar" y "Seleccionar concepto" ya NO EXISTEN:** el detalle del ingreso muestra directo el único cargo pendiente y un botón **"Registrar pago"** que lleva al formulario (monto prellenado con el adeudo + botones de método de pago, ya no radios). El endpoint sigue siendo `POST /api/payments/registerPayment` (sin cambios) y ya **no hay modal "OK"** de confirmación — navega directo de vuelta a "Detalle de ingreso" mostrando el cargo como Pagado.
3. **"Paypal" ya no es una opción** de método de pago (quedan: Efectivo, Transferencia, Tarjeta de crédito, Tarjeta de débito) — se quitó de `METODOS_PAGO`.
4. **Timing:** el conteo de "Contar estados de ingresos" corría antes de que la tabla terminara de cargar (carrera con la petición `getFiltered` inicial), dando 0/0 aunque había datos reales. Se agregó un `waitForResponse('getFiltered')` dentro de `navegarAIngresos`.

✅ **Verificado en vivo:** conteo real correcto (3 pendientes / 2 pagados en una corrida), y el flujo completo de registrar pago (abrir detalle → "Registrar pago" → elegir método → confirmar) se probó manualmente de punta a punta con éxito (`POST registerPayment → 200`, el cargo pasa a Pagado). En las corridas del spec oficial, la fila que le tocaba procesar en el ciclo resultó "ya pagada" al abrir el detalle un par de veces seguidas — se investigó y **no es un bug del test ni de la app**, es la flakiness ya conocida del entorno dev (ver hallazgo de QA arriba): la misma fila, reintentada momentos después, sí mostró "Registrar pago" con normalidad. El test ahora maneja ese caso sin romperse (loggea y salta al siguiente ciclo en vez de fallar a ciegas contra la pantalla equivocada).

**Pendiente:** no quedó una corrida del spec oficial que registrara un pago real de punta a punta (las 2 corridas de "Registrar ingreso pendiente" cayeron en el caso "ya pagado" por la flakiness mencionada) — solo se confirmó ese camino feliz con un script manual. Vale la pena volver a correrlo cuando el entorno esté menos cargado para verlo pasar por el camino completo dentro del spec mismo.

---

## 🔍 Re-verificación de los 2 bugs de plataforma pendientes — 2026-07-09

Se corrieron pruebas reales contra dev para confirmar si los 2 bugs de plataforma documentados hace semanas seguían vivos.

**1. 422 "relacion_id"/"campos obligatorios" — SIGUE VIVO, pero cambió de endpoint.** Se reprodujo en las 3 corridas de hoy (`doctor-consultation` ×2, más las corridas de ayer): `POST /api/appointments/getFilteredAppointments` y `POST /api/appointments/getAppointmentCount` responden **422** `{"status":"ERROR","message":"Verifica que los campos obligatorios no estén vacíos"}`. Ya no se vio en `getFilledForm` (donde estaba documentado originalmente) — es el mismo bug de fondo, pero manifestándose en otros endpoints de listado. No se pudo confirmar puntualmente en la pantalla de **Facturación** porque el selector roto de Pacientes (ver hallazgo del 2026-07-07, sigue exactamente igual) bloquea `stress-facturacion` antes de llegar ahí.

**2. Indicador "sin guardar" en Laboratorios y Procedimientos — NO SE REPRODUJO.** Se corrió el full-flow 3 veces (Carla Perez Rojas + paciente default `Percentil Prueba Prueba` ×2); las 3 veces Laboratorios guardó 200 OK (`setProceduresConsultation`) y el escaneo de indicadores residuales (`scanResidualIndicators`) reportó limpio: *"Ningún apartado conservó el triángulo tras guardar."* Con 3/3 corridas limpias, es razonable asumir que **ya lo arreglaron** — se baja de "confirmado pendiente" a "no reproduce". No cerrar del todo el hallazgo original (queda documentado arriba) por si vuelve a aparecer.

**Pendiente:** arreglar el selector roto de Pacientes (`a.font-semibold.text-sm.text-gray-900` → ahora `<div>`) en los 7 specs afectados para poder validar el bug 1 directamente en Facturación.
