# Etapa 2 — Clasificación de los 160 `opcional()` — 2026-09-17

> Lectura pura, sin ejecutar nada, siguiendo el criterio corregido de
> `docs/tarea-actual.md` (por qué envuelve cada sitio, no por qué se disparó en
> las 3 corridas de la Etapa 1). Cubre los 160 sitios: 71 en
> `tests/consultation.full-flow.spec.js`, 85 en `e2e/utils.js`, 4 en
> `tests/appointments.create.spec.ts`.

## Resumen ejecutivo

| Categoría | Sitios |
| --- | --- |
| Familia A (`isVisible`/`count`/`isEnabled`/`isChecked`/`isDisabled` — no lanza) | 83 |
| Familia B (`waitFor*`, `click`/`fill`/`selectOption`/`boundingBox`/`textContent`/`inputValue`/`getAttribute`/`evaluate`/`json()`/`screenshot` — sí lanza) | 77 |
| **Total instrumentado** | **160** |
| De los cuales, en **código muerto** (función exportada de `e2e/utils.js` que ningún spec activo importa) | **58** |
| Precondición confirmada (debe endurecerse) | **9** (+ 7 con hueco de cobertura, ver abajo) |
| Opcional legítimo (se queda, con comentario) | resto |

El dato más importante de esta etapa **no estaba en la pregunta original**: de
los 85 sitios de `e2e/utils.js`, **58 (68%) viven en funciones que ningún spec
activo llama hoy** (`fillTabFields`, `detectUnsavedSections`,
`auditConsultationIndicators`, `scanResidualIndicators`, y los helpers
privados que solo ellas usan: `hasWarningTriangle`, `triggerEdit`,
`cardBodyVisible`, `ensureExpanded`, `findOwnSaveButton`,
`collectFlaggedApartados`). Explica por qué la Etapa 1 solo vio dispararse UNA
etiqueta en 3 corridas: la mayoría del código instrumentado ni siquiera se
ejecuta. Detalle en la sección "Código muerto" más abajo — es una decisión
para Pedro antes de seguir clasificando esos 58 como si fueran a proteger algo
real.

---

## 1. Código muerto — 58 de 160 sitios (36% del total)

Verificado con grep de `require(...utils.js)` / `import ... from '../e2e/utils.js'`
sobre `tests/*.spec.{js,ts}` (lo único que `playwright.config.js` matchea):
ningún spec activo importa `fillTabFields`, `detectUnsavedSections`,
`auditConsultationIndicators` ni `scanResidualIndicators`. Los únicos lugares
que los llaman son `tests/consultation.full-flow.spec.js.backup` (extensión
`.backup`, no matchea ningún `testMatch` del config) y un comentario. Dato
curioso: `consultation.inputs-validation.spec.ts` tiene **su propia**
`fillTabFields` local (línea 1515) — no importa la de `utils.js` — así que hay
dos funciones con el mismo nombre y responsabilidades solapadas, una viva y
una muerta.

| Función | Sitios (línea) | Family A | Family B |
| --- | --- | --- | --- |
| `fillTabFields` | 22,54,55,58,63,104,105,108,143,149 | 54,55,104,105,143 (5) | 22,58,63,108,149 (5) |
| `detectUnsavedSections` | 972,976,983,993 | 972 (1) | 976,983,993 (3) |
| `hasWarningTriangle` | 1023,1026,1027 | 1023,1026 (2) | 1027 (1) |
| `triggerEdit` | 1038×2,1039,1041,1043,1044,1050×2,1051,1052,1057×2,1058 | 1038×2,1050×2,1057×2 (6) | 1039,1041,1043,1044,1051,1052,1058 (7) |
| `cardBodyVisible` | 1066,1068 | 1066,1068 (2) | 0 |
| `ensureExpanded` | 1075,1076 | 1075 (1) | 1076 (1) |
| `findOwnSaveButton` | 1092×2,1093 | 1092×2 (2) | 1093 (1) |
| `auditConsultationIndicators` | 1110,1113,1126×2,1129×2,1131,1132,1141,1144,1145,1152,1154,1159,1184,1187,1208 | 1110,1126×2,1129×2,1141,1144,1152,1159,1184 (10) | 1113,1131,1132,1145,1154,1187,1208 (7) |
| `collectFlaggedApartados` | 1255,1259,1261,1265 | 1255,1259,1261 (3) | 1265 (1) |
| **Total** | **58** | **32** | **26** |

**Decisión de Pedro (2026-09-17): borrar.** Eliminadas de `e2e/utils.js` las 4
funciones exportadas (`fillTabFields`, `detectUnsavedSections`,
`auditConsultationIndicators`, `scanResidualIndicators`) y sus 6 helpers
privados (`escapeRegExp`, `hasWarningTriangle`, `triggerEdit`,
`cardBodyVisible`, `ensureExpanded`, `findOwnSaveButton`,
`collectFlaggedApartados`) — 459 líneas (1338 → 879) y los 58 sitios
`opcional()` correspondientes. Verificado tras el borrado:
- `e2e/utils.js` quedó en 27 sitios `opcional()` (85 − 58), coincide con el
  conteo de "vivos" de este documento.
- Ningún spec activo (`tests/*.spec.{js,ts}` que matchea `playwright.config.js`)
  quedó con un import roto — los únicos hits restantes de esos nombres son el
  comentario de `consultation.full-flow.spec.js:99-100` (texto, no código), la
  `fillTabFields` **local** (no importada de `utils.js`) de
  `consultation.inputs-validation.spec.ts:1515`, y el archivo
  `.backup` (no corre).
- `module.exports` de `e2e/utils.js` actualizado, ya no expone las 4 funciones
  borradas.

No se conserva ninguna versión: si en el futuro hace falta un auditor de
"triángulo sin guardar" por apartado, se rediseña desde cero contra el DOM
real vigente en ese momento, en vez de revivir código que nunca se corrió
contra la app actual.

---

## 2. Sitios vivos — juicio uno por uno

### 2.1 `tests/consultation.full-flow.spec.js`

#### `sectionContainer()` (líneas 94–126)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 96 | `heading.waitFor({visible},15s)` | **PRECONDICIÓN — endurecer** | Es el único punto que confirma que la sección existe antes de intentar acotarla. Hoy, si nunca aparece, el catch lo traga y el código sigue directo a leer `cardAncestor`/fallbacks sobre un heading que Playwright nunca esperó — casi seguro termina en el `throw` de la línea 125, pero con un mensaje genérico ("no se pudo acotar... ni por .card ni por altura") que oculta la causa real (el heading nunca apareció). Quitar `opcional()`, dejar que reviente con su propio mensaje de timeout, o envolver en un mensaje explícito. |
| 104 | `cardAncestor.boundingBox()` | Opcional legítimo | Parte de la cadena de fallback ya diseñada a propósito (comentario líneas 98–118): si esto falla, el loop de profundidad (línea 119) lo intenta de otra forma, y el `throw` final (línea 125) es el guardia real. |
| 122 | `container.boundingBox()` (dentro del loop de profundidad) | Opcional legítimo | Mismo razonamiento: cada profundidad es un intento más de la cadena, no una precondición aislada. |

#### `saltarOnboardingYWizardConfig()` (líneas 132–147)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 136 | `explorarLink.click({force:true})` | **PRECONDICIÓN** | El link ya se confirmó visible un `if` antes (134). Si el click revienta después de eso (overlay que lo tapa, elemento removido), es una falla real, no algo "opcional". |
| 137 | `waitForLoadState('load',20s)` tras ese click | **PRECONDICIÓN** | Si nunca carga, el resto del test corre sobre una página en estado indeterminado. |
| 143 | `configurarMasTardeLink.click({force:true})` | **PRECONDICIÓN** | Mismo razonamiento que 136. |
| 144 | `waitForLoadState('load',20s)` tras ese click | **PRECONDICIÓN** | Mismo razonamiento que 137. |

#### `iniciarConsultaDelPaciente()` (líneas 149–176)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 152 | `waitForLoadState('load')` tras `goto('/Dashboard')` | **PRECONDICIÓN** | Carga inicial de la que depende todo el flujo (buscar/crear cita, iniciar consulta). |
| 170 (Familia A) | `overlay.first().isVisible()` | Opcional legítimo | Un modal de overlay que "a veces" tapa la pantalla — exactamente el caso de "modal que aparece a veces" del propio criterio de `tarea-actual.md`. |

#### `fillGeneralSection()` / `fillApenrienciaGeneralSection()` (Familia A: 188,198,203,211,227; Familia B: 189)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 188,198,203,211,227 | `*.isVisible()` de cada campo | Opcional legítimo | Cada campo (`motivo`, `padecimiento`, `notas_evolucion`, `nombre_referido`, `apariencia`) está cubierto por `chequear()` en la verificación post-Finalizar (líneas 924–928) — si el campo no se llenó, el `expect(inconsistencias,...)` final lo atrapa igual. |
| 189 | `motivoInput.inputValue()` | Opcional legítimo (borderline) | Solo se usa para decidir "¿ya tiene contenido, no lo piso?". Si falla, se trata como vacío (`?? ''`) y el `fill()` inmediatamente después (sin `opcional()`) es quien de verdad revienta si el campo tiene un problema real — el catch acá no esconde nada que no vaya a salir a la luz una línea después. |
| **Hallazgo aparte** | — | — | `padecimiento` (198), `notas_evolucion` (203) y `apariencia` (227) no loguean nada en su rama `else` cuando el campo no aparece (a diferencia de `motivo` y `nombre_referido`, que sí avisan). No es un catch silencioso de los 160, pero es la misma familia de problema — inconsistencia menor a prolijar de paso. |

#### `fillChecklistSection()` (Exploración segmentaria / Aparatos y sistemas) — líneas 241–359

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 250 | `page.waitForFunction(...'cargando'...)` | Opcional legítimo | Best-effort: si el timeout vence, el código sigue con `checkboxes.first().waitFor(...)` (251) que sí es una espera real y con su propio manejo. |
| 256 | `checkboxes.first().waitFor({attached},8s)` | **PRECONDICIÓN** | Si ningún checkbox llega a "attached", `total = checkboxes.count()` va a dar 0 sin aviso y toda la sección se reporta como "0/0 marcados" sin que nadie note que en realidad el checklist nunca cargó. Debería fallar con mensaje explícito ("el checklist de {nombreLog} nunca renderizó ningún checkbox"). |
| 293 | `cb.click({force:true})` (1er intento) | Opcional legítimo | Hay un mecanismo de reintento explícito documentado en el comentario (líneas 283–290): el primer intento puede fallar por una carrera de renderizado conocida, para eso existe el reintento de la línea 296. |
| 296 | `cb.click({force:true})` (reintento) | Opcional legítimo, con reserva | Es el último recurso; si también falla, el checkbox queda sin marcar, pero esto SÍ se detecta (`marcados < total`, línea 302) — **hoy solo se loguea como advertencia, no hace fallar el test**. Recomiendo subir `marcados < total` a un `inconsistencias.push(...)` (hoy ese array sí hace fallar el test al final) en vez de un `console.log` suelto — es la señal más temprana y clara de que el checklist completo podría haber quedado desalineado. |
| 309,310 (Familia A) | `botones.count()`, `textareas.count()` | Opcional legítimo | Solo alimentan un log informativo (`botonesCount`/`textareasCount` se comparan más abajo contra `total*2`/`total`, y si no alcanzan, cada ítem individual ya cae en su propia rama de "no tiene botones/observaciones disponibles"). |
| 319 | `botones.nth(...).click({force:true})` | Opcional legítimo | `botonResuelto = true` se marca igual después de este click (no depende de si tuvo éxito) — pero eso está bien porque la verificación post-Finalizar (línea 1020) compara `valorEsperado` contra el valor real vía API: si el click no pegó, la comparación lo atrapa como inconsistencia real y el test falla al final. |
| 332 | `textareas.nth(i).fill(...)` | Opcional legítimo | Mismo razonamiento que 319: la comparación de `observacionEsperada` contra `obsReal` (línea 1023) es la red de seguridad real. |
| 346 (Familia A) | `guardarBtn.isVisible({timeout:3000})` | Opcional legítimo, pero **código obsoleto** | El comentario del encabezado del archivo (líneas 15–22) dice explícitamente que este botón "Guardar Respuestas" **ya no existe** en ninguna de las dos secciones (autoguardado confirmado en vivo). Este bloque entero (345–353) busca algo que la propia documentación del archivo dice que no está. Inofensivo (cae siempre al `else` con su log), pero es candidato a **eliminar en la Etapa 3** en vez de mantenerlo clasificado. |

#### `fillDiagnosticoSection()` — líneas 361–415

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 368 (A) | `cie10Input.isVisible()` | Opcional legítimo | `diagnosticos` (array) se verifica downstream (línea 939). |
| 377 | `options.first().textContent()` | Opcional legítimo | Solo alimenta el mensaje de log; el `.click()` de la misma opción ocurre en la línea siguiente, sin protección — si falla la lectura del texto, el click igual se ejecuta. |
| 388 (A) | `impresion.isVisible({timeout:2000})` | Opcional legítimo | `impresion_diagnostico` se verifica downstream (línea 929). |
| 389 | `impresion.inputValue()` | Opcional legítimo | Mismo patrón que la línea 189: decide si pisar o no, y el `fill()` inmediato después queda sin protección igual. |
| **403** | `ta.getAttribute('placeholder')` | **PRECONDICIÓN** | Se usa para decidir si ESTE textarea es el de "Impresión diagnóstica" (a excluir) o uno de Observaciones (a llenar). Si la lectura falla y se trata como `''` en vez de reventar, el código puede **creer que el textarea de Impresión diagnóstica es candidato a Observaciones** y pisarlo con `TEXTO_OBSERVACIONES_DIAGNOSTICO` — el mismo tipo de contaminación cruzada que ya causó un hallazgo real documentado en este archivo (comentario líneas 108–118). |
| **404** | `ta.inputValue()` | **PRECONDICIÓN** | Se usa para decidir si el textarea "ya tiene contenido" (se salta) — si falla y se trata como vacío, puede pisar contenido real de otro campo ya llenado por el usuario/flujo. Mismo riesgo de clasificación errónea que 403, más leve pero misma familia. |
| **406** | `ta.fill(TEXTO_OBSERVACIONES_DIAGNOSTICO)` | **PRECONDICIÓN** | A diferencia de "Observaciones" en `fillChecklistSection`, este campo **no tiene verificación downstream** (no aparece en `chequear()` ni en ningún otro chequeo de la Etapa de verificación post-Finalizar). Si este `fill()` falla, no hay red de seguridad — hoy desaparece sin dejar rastro. |

#### `fillTratamientoSection()` — líneas 417–507

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 424 (A) | `indicacionesEditor.isVisible()` | Opcional legítimo | `indicaciones_general` (no vacío) se verifica downstream (línea 934). |
| 432 (A) | `medicamentoInput.isVisible({timeout:3000})` | Opcional legítimo | `numMedicamentos` se verifica downstream (línea 947). |
| 436 | `page.waitForSelector([role=option],10s)` | Opcional legítimo | Respaldado por el mismo chequeo de `numMedicamentos === 0` downstream — si nunca aparecen opciones, no se agrega medicamento y esa verificación lo atrapa como inconsistencia real. |
| 446 | `options.nth(i).textContent()` (buscando coincidencia) | Opcional legítimo, impacto bajo | Si falla la lectura de una opción, esa opción simplemente no matchea y se sigue probando las demás; en el peor caso cae a "se tomó la primera disponible" (línea 452). La verificación downstream solo cuenta medicamentos, no valida cuál se eligió, así que el impacto de elegir el medicamento "equivocado" por este motivo es bajo. |
| 450 | `target.textContent()` | Opcional legítimo | Solo alimenta el log (línea 453); el `.click()` de esa misma opción ya ocurrió en la línea anterior sin protección. |
| 455 | `waitForLoadState('load')` tras elegir medicamento | Opcional legítimo, con reserva | Le sigue un `waitForTimeout(1500)` fijo (línea 456) que amortigua el caso en que esto no resuelva; y los campos de dosis/vía/etc que siguen ya están todos guardados tras `isVisible()` individuales, así que un timeout acá no bloquea el resto. |
| 459,461,463,465,467,469,471 (A) | `isVisible()` de dosis/vía/unidad/frecuencia/duración/tiempo/indicaciones del medicamento | **Hueco de cobertura, no "debe fallar" tajante** | Ninguno de estos 7 campos tiene log en su rama `else` (a diferencia de casi todo el resto del archivo) NI verificación downstream específica (solo se verifica que `numMedicamentos > 0`, no que el medicamento tenga dosis/vía/frecuencia cargadas). Si la UI cambia y alguno deja de aparecer, hoy no hay forma de enterarse. No los marco como "precondición dura" porque no tengo evidencia de que sean obligatorios en la UI real — pero recomiendo, como mínimo, loguear cuando no se encuentran (igual que ya hace el resto del archivo), y evaluar si conviene verificarlos en el chequeo post-Finalizar. |
| 482,487,493 (A) | `isVisible()` de "Agrega tratamiento diferente" / sus 2 inputs | Opcional legítimo | Sí tienen log en su rama `else` (496,500). Mismo hueco de cobertura downstream que arriba (no se verifica "otros medicamentos" tras Finalizar), pero al menos queda registrado en el log si no aparece. |

#### `fillLaboratoriosSection()` — líneas 509–560

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 516 (A) | `indicacionesEditor.isVisible()` | Opcional legítimo | `indicaciones_procedimiento` (no vacío) se verifica downstream (línea 936). |
| 524 (A) | `labSelect.isVisible({timeout:3000})` | Opcional legítimo, hueco de cobertura | No hay verificación downstream de que se haya agregado un laboratorio (a diferencia de medicamentos, no hay `getLabs`/similar en la verificación). Ni siquiera hay log en el `else` de este `if` puntual. |
| 537 | `labOptions.nth(i).textContent()` | Opcional legítimo | Mismo patrón que línea 446 (impacto bajo, sin verificación de identidad downstream). |
| 541 | `target.textContent()` | Opcional legítimo | Solo log, click ya ocurre después sin protección. |
| 551 (A) | `procedimientoInput.isVisible({timeout:2000})` | Opcional legítimo, hueco de cobertura | Mismo caso que 524: sin log en `else`, sin verificación downstream de `TEXTO_PROCEDIMIENTO`. |

#### `fillNotasMedicoSection()` — líneas 562–578

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 567 (A) | `editor.isVisible({timeout:5000})` | Opcional legítimo, **hueco de cobertura real** | Tiene log en `else` (573), pero **`notas_medico` no aparece en ningún `chequear()` de la verificación post-Finalizar** — es la única de las 10 secciones cuyo contenido no se re-verifica de ninguna forma tras Finalizar. Si este `fill()` (línea 570, ya sin `opcional()`, Family B pero no instrumentado) falla o el texto no persiste, nada lo detecta hoy. |

#### `fillServiciosSection()` — líneas 580–636

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 602 (A) | `sinElementos.isVisible({timeout:1000})` | Opcional legítimo, bien diseñado | Alimenta `sinOpcionesDisponibles`, que se verifica con un `expect(...).toBe(false)` duro al final (línea 1055) — este es el patrón correcto: detectar + hard assert. |
| 605 | `page.screenshot(...)` | Opcional legítimo | Es evidencia adicional de un bug ya detectado por el `expect` de arriba; que el screenshot falle no debe tumbar el test que ya va a fallar por el motivo real. |
| 612 | `option.textContent()` | Opcional legítimo | Solo decide el texto para comparar con "certificado"; si falla, esa opción se descarta como candidata (no hay click perdido, ver línea 613-618 donde el click depende de la comparación). Impacto: en el peor caso no encuentra "certificado" y cae al fallback de "primera opción" (línea 620-624), que sigue completando la sección. |
| 622 | `first.textContent()` | Opcional legítimo | Solo log, el `.click()` ocurre en la siguiente línea sin protección. |

#### `guardarCambiosGlobal()` / `waitForFinalizarButton()` — líneas 640–685

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 682 (A) | `finalizarBtn.isEnabled()` | Opcional legítimo | Solo alimenta un log ("encontrado y habilitado" vs "DESHABILITADO"); si de verdad está deshabilitado, el `.click()` posterior (sin protección) va a reventar por su cuenta. |

#### Signos vitales, navegación y Finalizar (test principal) — líneas 696–862

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 722 (A) | `presionInput.isVisible()` | Opcional legítimo, hueco de cobertura menor | Sin log en `else`; signos vitales se verifican solo por el status 2xx de `registerVitalSigns`, no campo por campo — igual que otros campos de signos vitales del mismo bloque que ni siquiera pasan por `opcional()`. Prioridad baja. |
| 744 | `waitForResponse(registerVitalSigns,15s)` | Opcional legítimo | Ya está respaldado por un `expect(resp?.status(),...).toBeLessThan(300)` duro inmediatamente después (línea 747) — si el response nunca llega, `resp` es `undefined` y ese `expect` revienta solo. |
| 752 (A) | `cerrarButton.isVisible()` | Opcional legítimo | Caso de manual "modal que aparece a veces" — igual al ejemplo textual de `tarea-actual.md`. |
| 766 | `waitForLoadState('load')` tras navegación manual a `/Consulta/ConsultaGeneral` | **PRECONDICIÓN** | Es la ruta de recuperación cuando `waitForURL` (línea 761) ya falló una vez — si esta segunda carga tampoco resuelve, todo el resto del test opera sobre una página que puede no estar lista, y no hay ninguna otra verificación de "llegamos a la consulta" antes de seguir (la siguiente línea es `auditarPantalla`, que es un centinela de mejor esfuerzo, no una aserción). |
| **801** | `r.json()` (listener de `getProfile`, captura `doctorId`) | **PRECONDICIÓN** | El propio comentario del archivo (líneas 787–790) documenta que `getFilledForm` devuelve 200 con el formulario **vacío, sin avisar**, si falta `doctor_id` — exactamente el riesgo que se genera si este `.json()` falla silenciosamente. Es un listener asíncrono (no se puede simplemente "no atrapar" sin crear una unhandled rejection), pero como mínimo debería loguear fuerte si falla, y agregar una verificación explícita de `doctorId !== null` antes de usarlo en `fetchApi(...)` en vez de descubrirlo indirectamente cuando el formulario aparece en blanco. |
| **840** | `waitForRequest(finishConsultation,15s)` | Opcional legítimo | Solo se usa para loguear el payload (`consulta_id`/`paciente_id`, líneas 844-848); si falla, esos IDs quedan `null` y la sección de verificación completa se salta con un mensaje claro (línea 869-872, ya es parte del array `inconsistencias` que hace fallar el test). |
| **841** | `waitForResponse(finishConsultation,15s)` | **PRECONDICIÓN** | A diferencia de `registerVitalSigns` (744), acá el código NO revienta si `resp` es `undefined`: solo loguea `"⚠️ No se detectó la llamada finishConsultation (revisar manualmente)"` (línea 854) y sigue. Es el patrón textual que CLAUDE.md §0.4 prohíbe — una anomalía real (no se pudo confirmar que Finalizar respondió 2xx) que se degrada a advertencia sin evidencia de que sea inocua. Hoy queda parcialmente cubierto porque la verificación post-Finalizar chequea `estatus_id !== 4` (línea 943) — pero depende de que `consultaId`/`pacienteId` se hayan podido capturar (línea 840), y el mensaje de fallo sería "estatus incorrecto" en vez de "no se pudo confirmar Finalizar", perdiendo la causa real. Debería, como mínimo, sumarse a `inconsistencias` en vez de solo un `console.log`. |
| 858 (A) | `confirmBtn.isVisible({timeout:3000})` | Opcional legítimo | Respaldado por el chequeo de `estatus_id`/`estatus` downstream (línea 943) — si la confirmación era necesaria y no se clickeó, el estatus no llegaría a "Terminada" y el test fallaría igual ahí. |

#### Verificación post-Finalizar — líneas 867–1041

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 899 | `resp.json()` dentro de `fetchApi()` | Opcional legítimo, mensaje confuso | Si el JSON no parsea, `result` queda `undefined`, `result?.status !== 'OK'` dispara los reintentos y, si nunca resuelve, todos los `chequear()`/comparaciones posteriores van a fallar por "todo vacío" — SÍ termina en un `expect` duro al final (línea 1057), pero con un mensaje que sugiere "se perdieron los datos" en vez de "no se pudo parsear la respuesta". Vale un comentario, no un endurecimiento estructural (ya es imposible que falle en silencio). |

### 2.2 `e2e/utils.js` — solo los 27 sitios vivos (fuera del código muerto de la sección 1)

#### `asegurarCalendarioDashboard()` (líneas 203–221)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 206 | `waitForLoadState('load',15s)` tras `goto('/Dashboard')` | Opcional legítimo | La función tiene su propio mecanismo de reintento explícito (loop de 3 intentos con `reload()`, líneas 212-218) que YA es el endurecimiento — no hace falta duplicarlo acá. |
| 213 (A) | `td[data-day]).first().isVisible(8s)` | Opcional legítimo | Es la condición misma del loop de reintento — "no visible" es un resultado esperado que dispara el siguiente intento, no una anomalía oculta. |
| 216 | `waitForLoadState('load',15s)` tras `reload()` | Opcional legítimo | Mismo razonamiento que 206, dentro del mismo mecanismo de reintento. |

#### `irADiaEnCalendarioDashboard()` (líneas 227–258)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 233 (A) | `celda.isVisible(1s)` (condición del loop de avance de mes) | Opcional legítimo | Resultado esperado antes de avanzar de mes. |
| 239 (A) | `nextBtn.isVisible(1s)` | Opcional legítimo, marginal | Si no está, corta el loop de avance (`break`) y cae al chequeo final (246) que si también falla, reporta con `logger.warning` y `return false` — hay reporte, no silencio total. |
| 246 (A) | `celda.isVisible(1s)` (chequeo final) | Opcional legítimo | Es la rama de "no lo encontré, lo reporto" ya funcionando como está diseñada. |
| **250** | `waitForResponse(getFilteredAppointments,8s)` | **Para revisar con Pedro** | Si esto nunca resuelve, la función igual hace `celda.click()` y `return true` (línea 254-257) como si hubiera tenido éxito, sin confirmar que los datos de esa fecha realmente se refrescaron. Un caller que confía en el `true` podría estar mirando datos del día anterior. No lo marco como "debe fallar" tajante porque no tengo evidencia de que la app dispare ese endpoint en el 100% de los clics (podría venir de caché), pero es el candidato más claro a confirmar en vivo antes de decidir. |

#### `checkNextDaysForIniciarButton()` (líneas 260–290)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 280 (A) | `iniciarButtons.nth(i).isVisible()` | Opcional legítimo | Solo filtra cuáles de los botones matcheados están realmente visibles (vs. ocultos en un modal cerrado); un fallo puntual solo genera un subconteo benigno. |

#### `buscarBotonIniciarDePaciente()` (líneas 304–330) — usada por `asegurarCitaDeHoy()`, que decide si reutilizar o crear una cita nueva (Etapa 5)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 319 (A) | `btn.isVisible()` | Opcional legítimo | Mismo filtro benigno que la línea 280. |
| **321** | `fila.textContent()` (compara contra `patientSearch`) | **PRECONDICIÓN** | Es el corazón de la reutilización de cita: si la lectura del texto de la fila falla y se trata como `''`, esa fila NUNCA va a matchear el nombre del paciente buscado, aunque fuera la correcta — la función puede terminar devolviendo `null` ("no hay cita de hoy") cuando en realidad SÍ había una, y `asegurarCitaDeHoy()` crearía una cita duplicada. Es exactamente el bug que la Etapa 5 fue creada para evitar. |

#### `createAppointment()` (líneas 332–~674, function `selectReactOption` incluida)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 348 (A) | `sidebarAgendar.isVisible(5s)` | Opcional legítimo | Ruta de recuperación tras un `try/catch` de navegación fallida; si tampoco funciona, el paso siguiente (`agendarButton`) tiene su propio `throw` explícito si no aparece (línea 364). |
| 358 (A) | `agendarButton.isVisible(5s)` | Opcional legítimo | Parte de una cadena con `throw new Error('No se encontró el botón "Agendar cita"')` explícito si el fallback tampoco funciona (línea 364) — ya está endurecido. |
| 361 (A) | `altBtn.isVisible(3s)` | Opcional legítimo | Mismo `throw` de respaldo. |
| 421 | `opciones.nth(k).textContent()` (buscando coincidencia con `searchText`) | Opcional legítimo | Si nunca encuentra coincidencia tras 5 reintentos, hay un `throw new Error(...)` explícito (línea 435) — ya endurecido. |
| 425 | `elegido.textContent()` | Opcional legítimo | Solo alimenta el log de éxito; el `.click()` ocurre en la siguiente línea sin protección. |
| **502** | `continueBtn2.isVisible(5s)` | **PRECONDICIÓN** | A diferencia de los otros pasos del wizard, este `if` no tiene `else`, ni log de advertencia, ni backstop explícito más adelante. Si el botón "Continuar" del paso 2 no aparece, el código sigue de largo a buscar el input de fecha (línea 507+) asumiendo que el wizard avanzó, cuando puede seguir clavado en el paso 2. Es candidato a una de las causas de la flakiness ya conocida de `createAppointment` (el propio archivo documenta reintentos en varios puntos por errores intermitentes de dev). |

#### `setupConsoleMonitor()` (línea 798)

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 798 | `response.json()` | Opcional legítimo | Uso puramente diagnóstico: alimenta un preview de body para el log de consola, no afecta ninguna decisión de test. |

#### `auditarPantalla()` (líneas 1302–1367) — el centinela obligatorio de CLAUDE.md §0.2/0.6

| Líneas | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 1327, 1335 | `page.locator('body').innerText()` (poll + lectura final) | Opcional legítimo, por diseño | Es un helper de mejor esfuerzo llamado sin `try/catch` por el caller (`consultation.full-flow.spec.js:779`) — si reventara acá, abortaría el test entero por un fallo del propio auditor, no del flujo real que se está probando. |
| 1343 (A) | `elementos.count()` | Opcional legítimo, por diseño | Mismo razonamiento — es el inventario, no una aserción. |
| 1346–1350, 1353, 1355 | `evaluate()`/`getAttribute()`/`textContent()`/`inputValue()` por cada elemento inventariado | Opcional legítimo, por diseño | Si un elemento individual falla al leerse, esa fila del inventario queda incompleta (`'?'`, `null`), no se aborta el resto del inventario ni el test — es exactamente el comportamiento buscado para un centinela de "leer TODO, sin perseguir un único campo" (CLAUDE.md §0.6). |

### 2.3 `tests/appointments.create.spec.ts` (4 sitios, todos Familia A)

Test `'Confirm scheduled appointment from agenda'` (el que `tarea-actual.md` ya
marca para endurecer en la Etapa 5: hoy termina en verde encuentre o no
encuentre nada).

| Línea | Envuelve | Veredicto | Por qué |
| --- | --- | --- | --- |
| 45 | `nextWeekBtn.isVisible(3s)` | Relacionado con Etapa 5, no aislado | Si falta, corta la exploración de semanas con solo un `logger.warning`. Hoy es inofensivo únicamente porque el test nunca falla por no encontrar nada — en cuanto la Etapa 5 le agregue un assert duro, hay que decidir junto con eso si "no se pudo ni buscar" debe contar como fallo. |
| 60 | `candidate.isVisible(3s)` | Opcional legítimo | Prueba 2 textos candidatos (`'agendada'`, `'programada'`) — patrón de escaneo legítimo. |
| 69 | `modal.first().isVisible(5s)` | Opcional legítimo (el catch), pero **hallazgo aparte** | `citaEncontrada = true` (línea 84) se marca **incondicionalmente** apenas se hace click en un candidato, sin importar si el modal llegó a abrirse ni si la confirmación tuvo éxito — el test puede reportar "cita encontrada" (y dejar de buscar en más semanas) aunque la confirmación real haya fallado. No es parte de los 160 `opcional()`, pero es exactamente el tipo de lógica que hace que este test "siempre dé verde" que ya señala `tarea-actual.md`. |
| 74 | `confirmButton.isVisible(5s)` | Opcional legítimo (el catch) | Mismo comentario que 69: el catch en sí está bien, el problema es que su fallo no afecta el resultado final del test. |

---

## Conteo final por categoría (criterio de aceptación de la etapa)

| Categoría | Familia A | Familia B | Total |
| --- | --- | --- | --- |
| Código muerto (no clasificable como precondición real hoy) | 32 | 26 | 58 |
| Opcional legítimo (confirmado, se queda con comentario de 1 línea) | 45 | 38 | 83 |
| **Precondición confirmada → debe endurecerse** | 0 | **15** | **15** |
| Hueco de cobertura (ni precondición dura ni verificación downstream — zona gris, requiere decisión de Pedro) | 6 | 0 | 6 |
| Para revisar en vivo antes de decidir | 0 | 1 | 1 |
| Relacionado con Etapa 5 (no se resuelve en Etapa 2) | 0* | 1** | (subconjunto, no suma aparte) |

\* `appointments.create.spec.ts:45` ya está contado dentro de "opcional legítimo" de familia A arriba; se marca aparte solo como nota.
\*\* `full-flow.spec.js:841` está contado dentro de las 15 precondiciones.

**Corrección (2026-09-17, tras recontar la tabla en vez de confiar en el
primer conteo):** la primera versión de este documento decía "9
precondiciones" pero solo listaba 7 sitios agrupados — al recontar cada fila
marcada **PRECONDICIÓN** en las tablas de la sección 2 aparecen **15**, no 9:
la primera versión se había olvidado de `fillChecklistSection:256`,
`buscarBotonIniciarDePaciente:321` y `createAppointment:502` (las tres viven
en funciones distintas a las otras 12, por eso se cayeron del resumen aunque
sí estaban correctamente marcadas en su tabla). Exactamente el tipo de error
que CLAUDE.md §0.4 pide no dejar pasar sin verificar dos veces.

**Las 15 precondiciones confirmadas:**

En `tests/consultation.full-flow.spec.js` (13):
`sectionContainer:96`, `saltarOnboardingYWizardConfig:136/137/143/144`,
`iniciarConsultaDelPaciente:152`, `fillChecklistSection:256`,
`fillDiagnosticoSection:403/404/406`, `consulta (navegación manual):766`,
`consulta (getProfile→doctorId):801`, `finalizar (finishConsultation):841`.

En `e2e/utils.js` (2):
`buscarBotonIniciarDePaciente:321`, `createAppointment:502`.

Ninguna aserción atrapada (`expect(...)` dentro de un `opcional()`) apareció
en los 160 — ese caso de la tabla de `tarea-actual.md` no tuvo sitios reales.

## Siguiente paso

1. ✅ Código muerto de `e2e/utils.js` borrado (ver sección 1).
2. ✅ Las 15 precondiciones endurecidas (2026-09-17, ver sección 3).
3. Pendiente: decidir los 6 huecos de cobertura (loguear como mínimo, evaluar
   verificación downstream) y revisar en vivo
   `irADiaEnCalendarioDashboard:250` antes de decidir.

## 3. Precondiciones endurecidas — 2026-09-17

Las 15 precondiciones de la sección 2 quedaron endurecidas (se quitó
`opcional()` y se reemplazó por una espera/aserción dura con mensaje
explícito, o por un log fuerte donde abortar todo el flujo habría sido
desproporcionado — ver el caso puntual de `buscarBotonIniciarDePaciente:321`
abajo). Verificado tras el cambio:

- `node --check` sobre ambos archivos: sin errores de sintaxis.
- `tests/consultation.full-flow.spec.js`: 71 → 58 sitios `opcional()` (−13,
  coincide exacto con las 13 precondiciones de ese archivo).
- `e2e/utils.js`: 27 → 25 sitios `opcional()` (−2, coincide con las 2
  precondiciones de ese archivo: `buscarBotonIniciarDePaciente:321` y
  `createAppointment:502`).

Detalle de cómo se endureció cada una:

| Sitio | Cambio |
| --- | --- |
| `sectionContainer:96` | `heading.waitFor()` envuelto en `opcional()` → `expect(heading,...).toBeVisible({timeout:15000})` con mensaje que nombra el `headingRegex`. |
| `saltarOnboardingYWizardConfig:136/137/143/144` | Los 2 `click({force:true})` y los 2 `waitForLoadState('load',20s)` posteriores dejaron de estar envueltos — revientan directo si fallan (los `isVisible()` que deciden SI entrar al `if` siguen `opcional()`, sin cambios, son legítimos). |
| `iniciarConsultaDelPaciente:152` | `waitForLoadState('load')` tras `goto('/Dashboard')` sin `opcional()`. |
| `fillChecklistSection:256` | `checkboxes.first().waitFor({attached})` → `expect(checkboxes.first(),...).toBeAttached({timeout:8000})` con mensaje que nombra `nombreLog`. |
| `fillDiagnosticoSection:403/404/406` | `getAttribute('placeholder')`, `inputValue()` y `fill()` del textarea de Observaciones sin `opcional()` — un fallo ahora revienta en vez de arriesgar confundir el textarea de Impresión diagnóstica con el de Observaciones. |
| `consulta (navegación manual):766` | `waitForLoadState('load')` tras el `goto` de respaldo sin `opcional()`. |
| `consulta (getProfile→doctorId):801` | El listener sigue sin poder "reventar el test" (es un handler de evento), pero ahora loguea fuerte si `r.json()` falla, y se agregó `doctorId` al guard de la verificación post-Finalizar (línea ~870) — si falta, ahora es una inconsistencia real que hace fallar el test, no un formulario en blanco sin explicación. |
| `finalizar (finishConsultation):841` | `waitForResponse()` sin `opcional()` — si nunca llega, el `await Promise.all(...)` revienta con el timeout de Playwright en vez de loguear "revisar manualmente" y seguir en verde. Se simplificó el `if(resp)/else` porque `resp` ya no puede ser `undefined` en este punto. |
| `buscarBotonIniciarDePaciente:321` | **No se convirtió en espera dura** — a diferencia de los demás, esto vive dentro de un loop que escanea varias filas/días; abortar todo el escaneo por una fila individual sería desproporcionado. Se envolvió en `try/catch` local con `logger.warning` explícito en vez de tragarlo con `opcional()` — el comportamiento (se omite esa fila) no cambió, pero ahora queda registrado en vez de desaparecer en silencio. |
| `createAppointment:502` | `continueBtn2.isVisible()` → `expect(continueBtn2,...).toBeVisible({timeout:5000})`, mismo patrón que ya usan los otros pasos del wizard en esta función. |

No se tocaron los 6 huecos de cobertura ni el sitio para revisar en vivo
(`irADiaEnCalendarioDashboard:250`) — quedan para una decisión aparte con
Pedro.

## 4. Verificación contra dev — 2026-09-17

Corrida 1 (`doctor-consultation`, tras endurecer las 15 precondiciones):
falló inmediatamente en la precondición nueva —
`doctorId=FALTA`. Investigado: no es un bug introducido por el
endurecimiento, sino uno preexistente que el endurecimiento recién dejó ver.
El listener que captura `doctor_id` desde `getProfile` estaba registrado
DESPUÉS de `iniciarConsultaDelPaciente()`, pero `getProfile` solo se dispara
DURANTE esa función (carga del Dashboard) — nunca después. Con esa posición,
`doctorId` quedaba `null` siempre, desde que el mecanismo se introdujo
(`git blame` → commit `4bc4072`, 2026-07-30). Corregido moviendo el
registro del listener a antes de `iniciarConsultaDelPaciente()`. Detalle
completo y su cruce con el hallazgo de `getFilledForm` en
`docs/hallazgos-abiertos.md`.

Corrida 2 (mismo test, con el listener ya corregido): `doctorId=467`
capturado correctamente. La verificación post-Finalizar —el bloque completo
que las precondiciones de esta etapa protegen— **pasó limpio, sin ninguna
inconsistencia** y sin necesitar reintentos de `getFilledForm`. El test
**igual falló**, pero por un motivo distinto y ya documentado desde antes de
esta sesión: la propia app dispara 2 llamadas internas a `getFilledForm`
justo tras Finalizar que responden 404 (resuelven solas ~3s después) — el
hallazgo abierto "`getFilledForm` en blanco/404 tras Finalizar", que ya
fallaba este mismo assert (`result.failedApiCalls.length === 0`) antes de
esta sesión. No es una regresión de la Etapa 2.

**Conclusión:** las 15 precondiciones quedaron correctamente endurecidas y
verificadas en vivo. El test sigue en rojo, pero por el mismo hallazgo ya
abierto de antes — no por algo nuevo de esta etapa.

## 5. Huecos de cobertura — 2026-09-17

De los 6 sitios en zona gris de la sección 2, se resolvieron 5:

| Sitio | Qué se hizo |
| --- | --- |
| `fillTratamientoSection` (7 campos del medicamento: dosis/vía/unidad/frecuencia/duración/tiempo/indicaciones) | Se agregó log `⚠️` por campo no encontrado (antes no logueaban nada) y se corrigió el mensaje final, que decía "llenado" sin importar cuántos de los 7 campos realmente aparecieron — ahora dice `(N/7 campos)`. **No se agregó verificación downstream**: no se confirmó la forma exacta del campo de detalle en `getTreatments` (el body real no se inspeccionó completo, solo un preview truncado a 120 caracteres) — falta esa inspección antes de poder escribir una aserción real en vez de adivinar nombres de campo. |
| `fillTratamientoSection` ("Otros medicamentos") | Mismo problema del mensaje final incondicional ("llenado" pasara lo que pasara) — corregido para reportar honestamente si algún input no apareció. Sin verificación downstream: no hay endpoint de lectura de "tratamientos libres" en la verificación actual. |
| `fillLaboratoriosSection` (`labSelect`) | Agregado log `⚠️` cuando no aparece (antes, silencio total). **Verificación downstream agregada**: `procedures/getConsultationProcedures` tras Finalizar debe devolver ≥1 elemento. |
| `fillLaboratoriosSection` (`procedimientoInput`) | Mismo log agregado. **Verificación downstream agregada**: el mismo `getConsultationProcedures` — se confirma que algún elemento tenga `indicaciones` conteniendo `TEXTO_PROCEDIMIENTO`. |
| `fillNotasMedicoSection` (`editor`) | Ya tenía log. **Verificación downstream agregada** (era la única de las 10 secciones sin ninguna): `consultations/getNotes` tras Finalizar — se confirma que alguna nota contenga `TEXTO_NOTAS_MEDICO` (comparación "contiene", no igualdad exacta, porque el editor jodit envuelve el texto en `<p>`). |
| Signos vitales (`presionInput`) | Agregado log `⚠️` cuando no aparece. Sin verificación downstream (prioridad baja — signos vitales solo se verifica por el status 2xx de `registerVitalSigns`, no campo por campo, y así queda). |

Las dos verificaciones nuevas se probaron en vivo antes de darlas por
buenas (exactamente lo que pide el punto 7 de CLAUDE.md): `getConsultationProcedures`
funcionó con `{ paciente_id, consulta_id }` igual que `getConsultation`/
`getTreatments`/`getForms`, pero `getNotes` **no** — respondió
`{"status":"ERROR","message":"El campo doctor_id es requerido"}` hasta que se
le agregó `doctor_id: doctorId` (mismo dato ya capturado para
`getFilledForm`). Sin esta corrida de prueba, la verificación de notas_medico
habría quedado con un `fetchApi` que siempre falla — un hueco "cerrado" que en
realidad habría sido una inconsistencia falsa positiva permanente.

**Pendiente real, no resuelto hoy:** confirmar el shape completo (no
truncado) de `getTreatments` para poder verificar dosis/vía/unidad/
frecuencia/duración/tiempo/indicaciones del medicamento, y decidir si existe
algún endpoint de lectura para "Otros medicamentos" (tratamientos libres).

**Confirmado contra dev (última corrida, 2026-09-17 noche):** con el fix de
`doctor_id` en `getNotes` aplicado, las dos verificaciones nuevas pasan
limpio (`✅ laboratorios/procedimientos guardados: 1`, `✅ notas_medico:
encontrada`) y `"Todo lo llenado sigue guardado y coincide exactamente tras
Finalizar."` — ninguna inconsistencia. El test sigue fallando por el mismo
hallazgo preexistente de `getFilledForm` (404 en las 2 llamadas internas de
la app, sección 4) — nada nuevo introducido por el cierre de estos huecos.
