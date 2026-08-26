# CONTEXTO — MediplannerWebNuevo

> **Qué es este archivo:** documento vivo de contexto del proyecto. Sirve para (a) comunicar en qué estamos trabajando y (b) poner al tanto a una sesión nueva de Claude Code (en esta u otra computadora). **Mantenerlo actualizado y commitearlo** cada vez que cambie el estado del trabajo. Este documento se limpió a fondo el 2026-08-18 (a pedido de Pedro): lo viejo/resuelto quedó condensado en "Histórico resuelto" al final; acá arriba solo queda lo activo o accionable.
>
> **Última actualización:** 2026-08-24. Re-verificación de los 5 bugs de app (misma metodología del 20/08: scripts Playwright standalone contra dev, video + screenshots + payloads reales). **Resultado: 2 arreglados, 1 parcialmente arreglado, 2 sin cambios:**
> - ✅ **`cdnjs.cloudflare.com` — ARREGLADO.** El header CSP ahora incluye `https://cdnjs.cloudflare.com` en `script-src`. Confirmado en vivo: 0 errores de consola al abrir Vacunación (antes eran 2, uno por cada recurso bloqueado).
> - ✅ **Cruce Tratamiento/Notas del Médico — ARREGLADO, confirmado 2/2.** Mismo procedimiento que encontró el bug (marcador distinto en cada editor, payload real capturado): esta vez `setFreeTreatmentsConsultation` y `addNote` llegaron cada uno con su propio texto, sin cruce, en las 2 corridas.
> - 🟡 **`saveService` (falso registro) — PARCIALMENTE arreglado.** Apareció un campo nuevo `activo_servicio` (además del viejo `activo`) que sí refleja el checkbox correctamente al guardar. Pero la lista visible de Servicios sigue leyendo el campo viejo `activo` (que queda hardcodeado en `false`) — un servicio creado con "activo" marcado se sigue viendo como "Inactivo" en la UI, aunque ya no desaparece del catálogo (el caso más grave del 20/08 sí se resolvió).
> - 🟡 **Signos vitales — PARCIALMENTE mejorado.** Ahora el modal muestra un texto "Rango permitido: X - Y" debajo de cada campo (ej. "Oxigenación: 1-100%", "Frecuencia Cardiaca: 20-300 lpm") — se ve que los devs tocaron este componente (hasta renombraron `frecuenciaCardiaca`→`frecuencia_cardiaca` y `frecuenciaRespiratoria`→`frecuencia_respiratoria`). Pero el mecanismo de falla en sí sigue igual: tecleando se sigue recortando el dígito en silencio, y pegando/autocompletando un valor fuera de rango sigue vaciando el campo por completo, sin ningún mensaje reactivo.
> - ⬜ **CSP bloquea Clarity (`img-src`) — SIN CAMBIOS.** `img-src` sigue exactamente igual, sin ningún dominio `clarity.ms`. `c.clarity.ms/c.gif` se sigue bloqueando.
>
> **🆕 Bug nuevo encontrado en esta sesión (a pedido de Pedro, que vio el toast en vivo):** al iniciar una consulta y darle "Guardar cambios" sin haber tocado ningún otro campo, aparece un toast de error: **"Se necesita asignar el tipo de la consulta"**. Confirmado y capturado en pantalla. Causa raíz identificada: el wizard de "Agendar cita" SÍ manda el tipo correctamente (`"tipo_cita":"2"` en el payload real de `createAppointment`), pero ese valor nunca se copia a la Consulta que se crea al hacer clic en "Iniciar" — `getConsultation` devuelve `tipo_consulta:0, tipo_consulta_nombre:""` en el 100% de los casos probados hoy (9 consultas distintas, id 72 a 84, los 3 tipos de consulta). No bloquea el guardado real (todas las llamadas de guardado siguieron devolviendo 200), pero le muestra al doctor un error sin ninguna forma de resolverlo — la sección "General" de la consulta ya ni siquiera tiene un campo visible de "Tipo consulta" para asignarlo manualmente. Detalle completo en el nuevo hallazgo más abajo.
>
> Pendiente: decidir con Pedro si esto ya se reporta a devs (la [decisión abierta](#decisiones-abiertas--pendientes) ya estaba anotada desde el 18) y si se commitea/pushea este cambio de CONTEXTO.md.
>
> ---
>
> **Actualización anterior (2026-08-20).** Sesión de profundización sobre los 5 bugs de app ya reportados (CSP Clarity, CSP cdnjs, `saveService` falso registro, signos vitales, cruce Tratamiento/Notas) — se reprodujo cada uno en vivo contra dev con scripts Playwright standalone (fuera del test runner), capturando video + screenshots anotados + payloads/respuestas crudas de red. Reporte visual completo entregado a Pedro como Artifact. 2 hallazgos se refinaron significativamente respecto al 18:
> - **Bug de signos vitales — re-caracterizado.** No es "sin validación de rango": los 7 campos SÍ tienen un límite máximo real, pero falla en silencio y de forma inconsistente según cómo llega el valor. Tecleado letra por letra, el dígito que excede el límite simplemente no aparece (ej. "999" en FC queda en "99"). Puesto de una sola vez (`fill()`, equivalente a un paste/autocompletado) con un valor apenas fuera de rango (ej. Oxigenación=101, el máximo real es 100), el campo se **vacía por completo** — sin aviso, sin borde rojo, sin mensaje.
> - **Cruce Tratamiento/Notas del Médico — confirmado con payload real.** Se capturó el request HTTP exacto de `setFreeTreatmentsConsultation`: el campo `indicaciones` (Tratamiento) llegó con el texto literal de Notas del Médico. Confirmado 3/3 en "Consulta Express".
>
> Todo lo del 20 quedó sin commitear (igual que lo del 24). Lo del 18 sí está commiteado y pusheado a `origin/claude/test-consulta-staging-9b8e3c`.
>
> ---
>
> **Actualización anterior (2026-08-18).** Sesión larga, 3 frentes (el más reciente primero):
> 1. **Plan de 26 proyectos — Fase 0 + Batch 1 completo (12/12)**, corrido con un subagente "observador" por proyecto. 2 bugs de app nuevos confirmados (CSP bloquea Microsoft Clarity y `cdnjs.cloudflare.com`; `saveService` a veces no persiste el servicio creado — falso registro), 2 bugs de test arreglados y verificados (`reportes.spec.ts`, `percentil.explorar.spec.js`), 1 parcial (`subir-estudios.spec.ts`). Detalle en "🗺️ Plan: corrida completa de la suite dev con observador". **Pendiente: retomar desde Batch 2** (`appointments-create`).
> 2. **A pedido de Pedro: nuevo spec `consultation.tipos-consulta.spec.ts`** — prueba los 3 tipos reales de consulta (Completa/Exprés/Exprés Médico) llenando todo y verificando campo por campo contra la API. Confirmó que los signos vitales SÍ rechazan letras, pero encontró 2 bugs reales: sin validación de rango fisiológico, y un cruce de datos entre Tratamiento y Notas del Médico (2/2 en Exprés/Exprés Médico). Detalle en "🐛 Hallazgos nuevos durante la corrida del plan".
> 3. **Porteo de `consultation.full-flow.spec.js` a Staging/Producción** — Staging confirmado funcionando end-to-end; Producción con el fix del wizard aplicado pero bloqueado por credenciales pendientes de Pedro. Detalle en "🎯 Staging/Producción" abajo.
>
> Todo lo del 18 está commiteado y pusheado a `origin/claude/test-consulta-staging-9b8e3c`.

---

## 🟢 Prompt para una sesión nueva (copiar/pegar)

```
Lee CONTEXTO.md en la raíz del repo MediplannerWebNuevo y ponte al tanto del estado
del proyecto. Soy Pedro, Test Automation Tester (no developer); los tests son mi
responsabilidad. Trabajamos en español. Continúa desde "Decisiones abiertas" y el
plan marcado "SIN TERMINAR" ("🗺️ Plan: corrida completa de la suite dev con
observador") — retómalo desde la tabla de progreso en vez de re-planear. Antes de
correr tests confirma que tengo .env y storageState.json localmente (no están en
git) — aunque hay credenciales default hardcodeadas en cada *.setup.ts si no hay .env.
```

---

## 🎯 Staging/Producción: porteo de `consultation.full-flow.spec.js` (Producción bloqueada, retomar aquí ⏸️)

Contexto: `consultation.full-flow.spec.js` se reescribió en dev el 2026-07-23 para el nuevo "Modo Completo" de Consulta (commit `a1a1486`), pendiente portar a Staging/Producción.

### Staging — CONFIRMADO Y VERIFICADO ✅
- `tests/consultation.full-flow.spec.js` copiado sin tocar selectores a `Mediplanner Staging/Tests_Staging/` (backup del spec viejo en la misma carpeta). Staging **ya tiene el mismo "Modo Completo"** — no necesitó ajustes.
- Flujo completo punta a punta contra staging real: signos vitales → 10 secciones → guardado por sección → guardado global (7 endpoints) → "Finalizar Consulta" — **todos 200 OK**.
- El único "failed" es ruido ya investigado a fondo con Playwright+CDP: `404 POST /api/wizard/getActiveStep`, se dispara en TODA carga de `/Dashboard`, sin relación con Consulta. Decisión de Pedro: dejar el test así, no whitelistear ese endpoint.
- Commiteado: `b261184`.

### Producción — BLOQUEADA A MEDIAS, retomar aquí ⏸️
- Mismo procedimiento de porteo (`Mediplanner produccion/Tests_Produccion/`). Login con `dr@rym-solutions.com` funciona bien contra `https://admin.mediplanner.mx/`.
- **Bug de test real encontrado y corregido:** `Mediplanner produccion/e2e/utils.js` nunca había recibido el fix del wizard "Agendar cita" (ver "Referencia: wizard 'Agendar cita'" más abajo) — bloqueaba `createAppointment()` desde el primer paso. Ya corregido y verificado (llega hasta la búsqueda de paciente). Commiteado: `47a2716`.
- **Bloqueado en:** el paciente pedido, "Pedro Pruebas Rym Solutions", pertenece a otra cuenta (`pedro.quijada229217@potros.itson.edu.mx`), no a `dr@rym-solutions.com`. Esa credencial la compartió Pedro por screenshot — **nunca se ingresó ni se manejó**, por regla de seguridad.
- **Para retomar:** Pedro debe correr él mismo, desde `Mediplanner produccion/`:
  ```powershell
  $env:MEDIPLANNER_EMAIL='pedro.quijada229217@potros.itson.edu.mx'; $env:MEDIPLANNER_PASSWORD='@RyM2026'; npx playwright test --project=setup
  ```
  Luego, con `storageState.json` de esa cuenta ya generado:
  ```powershell
  $env:PACIENTE_NOMBRE='Pedro Pruebas Rym Solutions'; $env:PACIENTE_BUSQUEDA='Pedro Pruebas'; npx playwright test --project=doctor-consultation
  ```
  No hace falta repetir el fix del wizard, ya está aplicado y commiteado en `e2e/utils.js`.

---

## 🗺️ Plan: corrida completa de la suite dev con observador — SIN TERMINAR (Batch 1 de 4 completo)

**Objetivo:** correr los 26 proyectos de `playwright.config.js` (raíz, dev) contra `https://admin-dev.mediplanner.mx/`, con un subagente "observador" por corrida (recibe SOLO el output crudo, sin el resto de la conversación) que clasifica cada resultado antes de avanzar — para no perder bugs reales diluidos en el volumen, ni re-reportar ruido ya conocido.

### Fase 0 — Prerrequisitos ✅ (hecho)
`npm install` al día · Chromium en caché · `.env` no hizo falta (credenciales default de `auth.setup.ts`) · `storageState.json` generado.

### Los 26 proyectos, agrupados por riesgo
- **Batch 1** (exploratorios/read-only, bajo riesgo) — ✅ **12/12 completo**: `system-health`, `dashboard-explorar`, `dashboard`, `reportes-explorar`, `reportes`, `ajustes-explorar`, `ajustes-servicios`, `percentil-explorar`, `recetas-explorar`, `recetas`, `vacunacion-explorar`, `subir-estudios`.
- **Batch 2** (flujo de citas/consulta, mutación moderada): `appointments-create`, `doctor-consultation`, `consultation-inputs-validation` (🟡 corrido, ver hallazgos), `ingresos`.
- **Batch 3** (nunca corrido, se esperan selectores rotos): `consultation-user-errors` (6 tests de "error guessing", escritos 2026-07-21, nunca ejecutados contra dev — paciente `Daniela Jiménez Durán`).
- **Batch 4** (stress — cobertura exhaustiva de formularios, no load testing): `stress-citas`, `stress-pacientes`, `stress-ingresos`, `stress-login`, `stress-informacion-paciente`, `stress-facturacion`, `stress-antecedentes`, `stress-diagnosticos`. ⚠️ Antes de correr: confirmar caso por caso que ninguno crea cantidad desproporcionada de registros basura (parece que no, pero no verificado a fondo).
- **Checkpoint manual, NO incluir en un batch automático:** `vacunacion-ciclo-completo` — **destructivo** (borra y re-registra TODAS las dosis de un paciente real de dev, ~10 min). Requiere confirmación explícita de Pedro antes de correrlo.

### El loop "correr → observar → actuar"
1. `npx playwright test --project=<nombre>`.
2. Delegar a un subagente observador **solo** el output crudo (stdout + resumen del monitor + screenshot si falló), pidiendo veredicto: **PASA LIMPIO** / **PASA CON RUIDO CONOCIDO** / **BUG DE TEST** (con fix propuesto) / **BUG DE APP** (documentar, no tocar código de la app).
3. Bug de test → arreglar → re-correr ese proyecto → confirmar limpio. Bug de app → documentar en este archivo, seguir con el resto. Ruido conocido → anotar y seguir.
4. Actualizar la tabla de progreso antes de pasar al siguiente — así una sesión cortada retoma exactamente donde quedó.

### Ruido conocido (no reportar de nuevo)
- `net::ERR_ABORTED` en `google-analytics.com` y `mediplanner-atencion.zendesk.com` — beacons de analytics/chat.
- `404 POST /api/wizard/getActiveStep` — se dispara en cualquier carga de `/Dashboard`, causa raíz confirmada (ver sección Staging arriba).
- CSP bloquea Microsoft Clarity — confirmado bug de app esta sesión, ver hallazgos abajo (no volver a reportar como "nuevo").
- Bug 422 `relacion_id`/"campos obligatorios" en dev — no reproduce (3/3 limpias). Detalle en Histórico.
- Indicador "sin guardar" en Laboratorios y Procedimientos — no reproduce en dev; **sigue confirmado como bug real en Staging**.

### Tabla de progreso

| # | Proyecto | Batch | Estado | Notas |
|---|----------|-------|--------|-------|
| 0 | setup | Fase 0 | ✅ | storageState.json generado |
| 1 | system-health | 1 | 🐛 bug de app | CSP bloquea Clarity (script+beacon) |
| 2 | dashboard-explorar | 1 | ✅ ruido conocido | 4 passed, 0 hallazgos nuevos |
| 3 | dashboard | 1 | ✅ ruido conocido | 2 passed, KPIs/corte-de-hoy/agenda/estudios coinciden con API |
| 4 | reportes-explorar | 1 | ✅ ruido conocido | 2 passed, sin hallazgos |
| 5 | reportes | 1 | ✅ bug de test arreglado | 4 selectores/asunciones desactualizados, ver hallazgo abajo. Re-corrida: 2 passed |
| 6 | ajustes-explorar | 1 | ✅ ruido conocido | 9 passed (exploratorio) |
| 7 | ajustes-servicios | 1 | 🐛 bug de app confirmado | `saveService` a veces no persiste el servicio (falso registro), ver hallazgo abajo. Test queda en rojo a propósito |
| 8 | percentil-explorar | 1 | ✅ bug de test arreglado | Placeholder desactualizado. Re-corrida: 2 passed |
| 9 | recetas-explorar | 1 | ✅ ruido conocido | 2 passed, 12/12 APIs OK |
| 10 | recetas | 1 | ✅ ruido conocido | 2 passed, contador y paginación correctos |
| 11 | vacunacion-explorar | 1 | 🐛 bug de app (CSP) | 2 passed, 20/20 APIs OK. CSP bloquea `cdnjs.cloudflare.com`, ver hallazgo abajo |
| 12 | subir-estudios | 1 | 🟡 parcial | 3 bugs de test arreglados, ya no crashea, pero no llega a probar el upload real — gap de fondo, ver hallazgo abajo |
| 13 | appointments-create | 2 | ⬜ pendiente | |
| 14 | doctor-consultation | 2 | ⬜ pendiente | ya verificado limpio antes; re-confirmar sin regresión |
| 15 | consultation-inputs-validation | 2 | 🟡 corrido, 2 hallazgos | Letras SÍ se rechazan en signos vitales (7/7), pero sin validación de rango. Mitad del fuzzing del archivo es código muerto. Ver hallazgos abajo |
| 16 | ingresos | 2 | ⬜ pendiente | |
| 17 | consultation-user-errors | 3 | ⬜ pendiente | nunca corrido, esperar selectores rotos |
| 18-25 | stress-* (8 proyectos) | 4 | ⬜ pendiente | |
| — | vacunacion-ciclo-completo | checkpoint | ⬜ pendiente | requiere confirmación explícita de Pedro |

**Cómo retomar:** pegar el prompt de "sesión nueva". Seguir la tabla en orden desde la primera fila ⬜ (fila 13, `appointments-create`).

**Aceleración con `Workflow` (pipeline correr→observar→actuar):** solo si Pedro lo pide explícitamente en la sesión — no usar por defecto.

### 🐛 Hallazgos re-caracterizados con evidencia nueva (2026-08-20)

**Signos vitales — el límite SÍ existe, pero falla en silencio (re-caracteriza el hallazgo del 18).** Investigado campo por campo con Playwright standalone (fuera del test runner, con video + overlay de evidencia). Los 7 campos son `<input type="text">` con `maxlength` (3-7 según el campo) — no tienen `min`/`max`/`step` en el HTML, el límite vive en un handler de JS. Comparando `.fill()` (bulk-set, equivalente a un paste) contra tipeo real letra por letra sobre el mismo campo:
- **Tecleado real:** el dígito que haría que el valor supere el máximo real no llega a mostrarse — el campo se queda en el último valor válido. Ej.: "999" tecleado en Frecuencia Cardiaca → queda "99". "200" en Frecuencia Respiratoria → queda "20". Sin borde rojo, sin mensaje, sin tooltip.
- **Puesto de una sola vez (`.fill()`/paste):** un valor apenas fuera de rango vacía el campo POR COMPLETO, sin importar qué tan cerca del límite estuviera. Oxigenación=101 (el máximo real es 100) → el campo queda `""`. Mismo resultado con 150 y 500. Con 98 (válido) sí queda "98". Mismo patrón en Peso (99999→vacío, pero 250 sí queda), Talla (999→vacío) y FC/FR.
- El recorte NO es por longitud de texto: "999" (3 caracteres) se vacía en Talla (maxlength=5) igual que en Oxigenación (maxlength=3) — es un chequeo de valor máximo, no de cantidad de dígitos.
- Con Oxigenación vacía (tras el vaciado silencioso) y el resto de los campos válidos, el botón "Guardar" quedó **deshabilitado** en esta cuenta — la app si bloquea el envío con un campo obligatorio vacío, pero nada en pantalla explica *por qué* está deshabilitado ni que el valor pegado desapareció.
- Para reportar a devs: no es "agregar validación de rango" (ya existe) — es (a) mostrar feedback visible cuando un valor se recorta o se rechaza, en vez de fallar en silencio, y (b) decidir si un valor fuera de rango debería recortarse/clampearse en vez de vaciar el campo por completo.

**Cruce Tratamiento ↔ Notas del Médico — confirmado con el payload real capturado (iguala/supera el hallazgo del 18).** Se instrumentó el request HTTP real en vez de solo comparar el guardado final. Escribiendo un marcador distinto en Tratamiento, Laboratorios y Notas del Médico (en ese orden) en una "Consulta Express": el editor Jodit de Tratamiento quedó **vacío** apenas se terminó de tipear en Notas (confirmado leyendo el DOM en vivo, antes de cualquier guardado explícito), y el guardado automático de la app (dispara solo, ~30s después de cargar la página — hay un config `time_save` que lo controla) mandó este payload real a `setFreeTreatmentsConsultation`:
```
{ "paciente_id": 903, "consulta_id": 73, "tratamientos": [],
  "indicaciones": "<p>Seguimiento de evolución clínica favorable [NOTASMEDICO-MARCA-...]</p>" }
```
El campo `indicaciones` (que es "Indicaciones Generales" de **Tratamiento**) llegó con el texto literal de **Notas del Médico**. Una screenshot del estado final confirma lo mismo visualmente: el cuadro de Tratamiento muestra el texto de Notas, mientras que el cuadro de Laboratorios (con su propio editor Jodit), justo debajo, sí muestra su texto correcto — descarta que sea un problema de guardado en general. Confirmado 3/3 en total (2/2 sesiones anteriores + esta). Sigue sin confirmarse en "Consulta Completa". **Hipótesis técnica para devs:** el patrón (el editor tipeado *al final* "gana" y termina en el campo de Tratamiento, cuyo propio editor queda vacío) es consistente con que los 3 editores Jodit de la página compartan alguna referencia global al "contenido activo", y que el guardado de Tratamiento la lea en vez de leer su propio editor — a confirmar por los devs con el código fuente.

Reporte completo con screenshots + video de las 5 reproducciones (incluye también CSP Clarity, CSP cdnjs y `saveService`, reproducidos de nuevo con evidencia más precisa) entregado a Pedro como Artifact el 2026-08-20.

### 🔁 Re-verificación de los 5 (2026-08-24)

A pedido de Pedro ("corre las automatizaciones de nuevo y fíjate si los bugs fueron arreglados"), se corrió el mismo procedimiento del 20/08 otra vez contra dev, prestando atención fina a cada corrida (incluye 2 reintentos por selectores que cambiaron de nombre — ver debajo). Resultado, bug por bug:

1. **CSP Clarity (`img-src`): sin cambios.** Header idéntico al del 20/08, sin ningún dominio `clarity.ms` en `img-src`. `c.clarity.ms/c.gif` se sigue bloqueando.
2. **CSP `cdnjs.cloudflare.com`: ARREGLADO.** `script-src` ahora incluye `https://cdnjs.cloudflare.com`. Confirmado en vivo abriendo Vacunación: 0 errores de consola (antes eran 2).
3. **`saveService` falso registro: PARCIALMENTE arreglado.** Apareció un campo nuevo en la respuesta de `getServices`: **`activo_servicio`** (antes solo existía `activo`). Al crear un servicio con el checkbox "activo" marcado, `activo_servicio` ahora sí queda en `true` (correcto) — pero `activo` sigue quedando hardcodeado en `false` siempre. Como la lista visible de "Servicios" en la UI sigue mostrando el estatus según el campo viejo `activo`, un servicio recién creado con "activo" marcado se sigue viendo como "**Inactivo**" en la pantalla, aunque ya no desaparece del catálogo (eso sí se arregló). **Para reportar a devs:** falta que la UI lea `activo_servicio` en vez de (o además de) `activo`, o unificar ambos campos.
4. **Signos vitales: PARCIALMENTE mejorado.** El modal ahora muestra "**Rango permitido: X - Y**" debajo de cada campo (Oxigenación 1-100%, FC 20-300 lpm, FR 10-70 rpm, Temperatura 10-46°C, Talla 1-246cm, Peso 1-635kg) — un cambio real y reciente (también renombraron los inputs `frecuenciaCardiaca`→`frecuencia_cardiaca` y `frecuenciaRespiratoria`→`frecuencia_respiratoria`, rompiendo selectores viejos que asuman camelCase). Pero el mecanismo de falla silenciosa en sí no cambió: tecleando, el dígito que excede el máximo se sigue recortando sin avisar; pegando/autocompletando un valor fuera de rango, el campo se sigue vaciando por completo sin ningún mensaje.
5. **Cruce Tratamiento/Notas del Médico: ARREGLADO, confirmado 2/2.** Mismo procedimiento que originalmente lo encontró (marcador distinto en Tratamiento/Notas, payload real capturado): en las 2 corridas de hoy, `setFreeTreatmentsConsultation` y `addNote` llegaron cada uno con su propio texto — sin ningún cruce. `getConsultation` posterior confirma lo mismo. No se volvió a probar en "Consulta Completa" (igual que antes, sigue sin confirmarse ahí, aunque nunca se reprodujo en ese tipo de consulta).

**Nota técnica para la próxima sesión:** si se vuelve a tocar el modal de signos vitales con scripts standalone, usar `input[name="frecuencia_cardiaca"]` / `input[name="frecuencia_respiratoria"]` (snake_case) — los nombres viejos en camelCase ya no existen. `input[name*="card" i]` sigue funcionando por casualidad (matchea el substring "card" dentro de "frecuencia_c**ard**iaca").

### 🆕 Bug 6 — "Se necesita asignar el tipo de la consulta" (2026-08-24)

Pedro vio este toast en vivo mientras yo corría las re-verificaciones y pidió investigarlo puntualmente. Reproducido y con causa raíz identificada:

**Cómo reproducirlo (100% confirmado):**
1. Agendar una cita de cualquier tipo (Completa / Express / Express Médico) — no importa cuál.
2. Iniciar la consulta, capturar signos vitales y guardarlos (paso obligatorio, no se puede saltar).
3. Ya en la página de Consulta (Modo Completo), **sin tocar ningún otro campo**, hacer clic en **"Guardar cambios"** (el botón azul global).
4. ~5.5 segundos después aparece un toast de error arriba a la derecha: **"Se necesita asignar el tipo de la consulta"**.

Con otros campos ya llenados antes de guardar (motivo, diagnóstico, etc.) el toast no se vio en varios intentos — parece disparar específicamente cuando "Guardar cambios" no tiene nada nuevo que persistir y termina revalidando/refrescando el estado completo de la consulta (se observan varias llamadas GET en cadena: `getConsultationProcedures`, `getForms`, `getNotes`, `getConsultations`, `getConfigConsultation`, `getDiagnosis`, `getProceduresList` — ninguna de escritura).

**Causa raíz:** el wizard de "Agendar cita" manda el tipo de consulta correctamente — payload real capturado de `createAppointment`:
```
{"doctor_id":"467","paciente_id":903,"hospital_id":"2","tipo_cita":"2",
 "fecha_inicio":"2026-08-24 16:45:00","fecha_fin":"2026-08-24 16:50:00"}
```
(`"tipo_cita":"2"` = Consulta Express, seleccionada en el `<select>` del paso 2 del wizard). Pero ese valor **nunca se copia** a la Consulta que se crea al hacer clic en "Iniciar": `getConsultation` devolvió `tipo_consulta: 0, tipo_consulta_nombre: ""` en **las 9 consultas creadas hoy** (ids 72, 73, 74, 78, 79, 81, 82, 83, 84), sin excepción, para los 3 tipos de consulta. El toast del frontend está detectando correctamente un dato real que falta — el bug no es el toast, es que el backend/frontend nunca traspasa `tipo_cita` (de la Cita) a `tipo_consulta` (de la Consulta).

**Impacto:** no bloquea nada — todas las llamadas de guardado (`setTreatments`, `addNote`, `finishConsultation`, etc.) siguieron devolviendo 200 con el toast presente. Pero (a) todas las consultas quedan con su tipo sin clasificar, lo que rompería cualquier reporte/filtro que agrupe por tipo de consulta, y (b) la sección "General" de la consulta ya no muestra ningún campo "Tipo consulta" (existía como solo-lectura el 2026-08-18, según el spec de esa fecha) — el doctor ve el error pero no tiene ninguna forma de corregirlo desde la UI.

**Para reportar a devs:** revisar el flujo `createAppointment` → "Iniciar consulta" para confirmar por qué `tipo_cita` de la Cita no se está copiando a `tipo_consulta` de la Consulta recién creada.

### 🐛 Hallazgos nuevos de esta sesión (2026-08-18)

**"Indicaciones Generales" de Tratamiento se guarda con el texto de "Notas del Médico" — cruce de datos entre editores, `consultation.tipos-consulta.spec.ts`.** En 2/2 corridas de "Consulta Express" y "Consulta Express Medico", el campo `indicaciones_general` (rich-text de Tratamiento) terminó guardado con el texto de "Notas del Médico". Se descartó activamente que fuera timing del test (verificación de relectura del DOM confirmó que el texto correcto SÍ estaba en pantalla antes de guardar, sin necesitar reintento). Apunta a un bug de la app: los editores de texto enriquecido de la página "Modo Completo" (Tratamiento/Laboratorios/Notas del Médico) parecen compartir o confundir estado al guardar. Alcance no confirmado del todo: 1/1 en "Consulta Completa" pasó limpio, pero un 2do intento de re-verificar chocó con ruido propio de la sesión (demasiadas citas de prueba ya creadas hoy), no con el bug. **Pendiente:** confirmar con una cuenta más limpia si es específico de Exprés/Exprés Médico. El test queda en rojo a propósito cuando esto reproduce — no se lo "arregla" para que pase.

**Signos vitales aceptan valores fuera de rango fisiológico — `consultation-inputs-validation` / `consultation-tipos-consulta`.** Buena noticia confirmada: las letras SÍ se rechazan correctamente en los 7 campos de signos vitales. Pero 6 de esos campos (todos menos Temperatura) aceptan valores médicamente imposibles sin ninguna advertencia: Peso=99999, Talla=999cm, Presión=999/999mmHg, FC=999lpm, Oxigenación=500% (máximo real 100%), FR=200rpm. Para reportar a devs: agregar validación de rango (min/max), no solo de tipo de dato.

**Gran parte del fuzzing de `consultation.inputs-validation.spec.ts` es código muerto, nunca se ejecuta.** El archivo (1993 líneas) tiene funciones bien construidas para probar XSS/SQLi (`runSectionValidation`) y validación numérica de medicamentos (`testMedicacionValidation`), pero el loop principal del test llama en cambio a versiones "solo llenar con datos válidos, sin tests". Resultado real: "0 protecciones ✅ | 0 vulnerabilidades ❌" — no porque todo esté seguro, sino porque no se probó nada. **Pendiente:** reconectar `runSectionValidation` (con selectores reales por sección) y `fillTreatmentSection`/`testMedicacionValidation` en el loop principal.

**`subir-estudios.spec.ts` — 3 bugs de test arreglados, gap real de fondo sin resolver.** Nunca se había corrido desde que se escribió. Arreglados: selector de Pacientes (a→span, era un 8vo archivo que se había quedado afuera del fix general), tab "Consultas" (a→button), lista de consultas (li→button, ahora por contenido de fecha en vez de clases), y un bug de control de flujo que crasheaba el test (`continue` seguía el for equivocado tras navegar de pantalla — corregido a `break`). **Pendiente real:** tras los fixes ya no crashea, pero nunca llega a probar el upload real — toda consulta "Terminada" resulta en "No se encontró pestaña Tratamiento", casi seguro el mismo síntoma del "Modo Completo" (ver Referencia técnica abajo) aplicado a la vista de detalle "Ver consulta". Requeriría una reescritura similar en alcance a la de `consultation.full-flow.spec.js` — fuera de alcance de esta sesión.

**`saveService` (catálogo de Servicios) reporta éxito pero a veces no persiste — falso registro confirmado, `ajustes-servicios`.** Investigado a fondo con 3 scripts Playwright standalone antes de concluirlo: `saveService → 200 "guardado correctamente"` con un ID nuevo válido, pero la siguiente llamada a `getServices` no incluye ese ID (reproducido 2/2 desmarcando "activo" antes de guardar). Con "activo" sin tocar, el servicio sí aparece pero queda persistido como `activo:false` de todas formas. El checkbox "activo" del modal "Nuevo Tipo" está roto de algún modo. Es un bug real de la app, no del test — no se modifica el test, queda en rojo a propósito.

**4 bugs de test en `reportes.spec.ts` (copy/comportamiento desactualizado desde 2026-07-06).** KPI "Número de consultas" → real es "Citas del período"; opción de combo "Últimos mes" → real es "Último mes"; opción de Estatus "Todos los estatus" → real es "Todos"; faltaba clic en "Buscar" tras cambiar el filtro de fecha (el panel "Filtrar registros" no auto-aplica, mismo patrón que Ingresos) + el locator del rango de fechas nunca matcheaba nada (formato real `DD-MM-YYYY – DD-MM-YYYY`, no "Desde:/Hasta:"). Los 4 fixes verificados juntos: 2 passed, 0 errores.

**CSP bloquea Microsoft Clarity (script + beacon) — `system-health`.** La CSP whitelistea `www.clarity.ms` en `script-src` pero el script real se sirve desde `scripts.clarity.ms` (subdominio distinto, no matchea); `img-src` no incluye ningún dominio `clarity.ms`. Es first-party (la política la define la app), no ruido de tercero. Para reportar a devs: agregar `scripts.clarity.ms`/`*.clarity.ms` a `script-src` y `clarity.ms` a `img-src`, o quitar el snippet si no es intencional.

**CSP bloquea `cdnjs.cloudflare.com` (Ace Editor + js-beautify) — `vacunacion-explorar`.** Origen completo ausente de la whitelist (no es solo un subdominio, como con Clarity). Los recursos (editor de código + formateador) no deberían tener relación con la pantalla de Vacunación — probablemente viene de algún bundle/layout global. Para reportar a devs: además de la whitelist, entender por qué se intenta cargar un editor de código ahí.

---

## Proyecto

- **Qué es:** suite de automatización E2E con **Playwright** para la web admin de Mediplanner (dev: `https://admin-dev.mediplanner.mx/`).
- **Repo:** https://github.com/PedroAndresQA6/MediplannerWebNuevo · **Rama de trabajo:** `Normalization`.
- **Rol:** Pedro = Test Automation Tester (no developer). Detecta bugs y los reporta a devs. Los tests son su responsabilidad. Trabajamos en español.
- **Stack:** Node v24.x, Playwright 1.58.2. Solo Chromium, viewport 1366x768, `headless:false`, `workers:1` (serial). `executablePath` condicional a `PW_CHROMIUM_PATH` (si no está, usa el Chromium bundled — config portable entre PCs).
- Archivos locales necesarios (no están en git): `.env` (BASE_URL + credenciales + `PW_CHROMIUM_PATH`) y `storageState.json`.
- ⚠️ **Pendiente de seguridad:** `.env` sigue trackeado en git (con credenciales) — falta `git rm --cached .env` + confirmar `.gitignore`.

## Estado actual (git)

- Sincronizado en las 3 ramas (`main`, `Trabajando`, `Normalization`) — apuntan al mismo commit.
- Excluidos de git a propósito: `storageState.json`, `PW_CHROMIUM_PATH` local en `.env`, `MediplannerAppiumAutomation/` (ver "Repos separados" abajo).
- **`AppEstacionamientosColaboradores/`**: suite de automatización para un producto **completamente distinto** ("Querétaro con Futuro", estacionamientos), vive en este repo por conveniencia. Tiene su propio `CONTEXTO.md`/`HALLAZGOS.md` — no se duplica ese detalle acá.

## Cómo correr los tests

```powershell
cd C:\Users\pandr\MediplannerWebNuevo

# Consulta full-flow
npx dotenv -e .env -- playwright test --project=doctor-consultation

# Consulta — los 3 tipos reales (Completa/Exprés/Exprés Médico) con verificación contra la API
npx dotenv -e .env -- playwright test --project=consultation-tipos-consulta

# Consulta — fuzzing de campos (XSS/SQLi + signos vitales) — ver hallazgo de código muerto arriba
npx dotenv -e .env -- playwright test --project=consultation-inputs-validation

# Ingresos
npx dotenv -e .env -- playwright test --project=ingresos

# Dashboard (KPIs, calendario, corte de hoy, agenda, nuevos estudios)
npx dotenv -e .env -- playwright test --project=dashboard

# Consulta — errores humanos reales (6 tests, nunca corrido contra dev)
npx dotenv -e .env -- playwright test --project=consultation-user-errors

# Un stress test puntual (ej. facturacion)
npx dotenv -e .env -- playwright test --project=stress-facturacion

# Todos los stress tests (serie, ~20-40 min)
npx dotenv -e .env -- playwright test "stress tests"

# Vacunación — ciclo completo (DESTRUCTIVO: borra todo → registra → verifica)
npx dotenv -e .env -- playwright test --project=vacunacion-ciclo-completo

# Vacunación — mapeador de la UI (exploratorio)
npx dotenv -e .env -- playwright test --project=vacunacion-explorar
```

**Proyectos de stress disponibles:** `stress-login`, `stress-citas`, `stress-pacientes`, `stress-ingresos`, `stress-informacion-paciente`, `stress-facturacion`, `stress-antecedentes`, `stress-diagnosticos`.

**Modo de corrida:** test puntual a observar → primer plano (`headless:false`). Suite larga → background.

## Setup para reproducir en otra computadora

1. Node 24.x + git (+ opcionalmente GitHub CLI `gh`).
2. `git clone` + `git checkout Normalization`.
3. `npm install`.
4. Navegador: `npx playwright install chromium`, o `PW_CHROMIUM_PATH=...` en `.env` si preferís uno ya instalado.
5. Crear `.env` localmente (pedírselo a Pedro) — no está en git.
6. `storageState.json` se regenera corriendo el proyecto `setup`.

## Repos separados — ⚠️ pendiente de decidir con Pedro

`MediplannerAppiumAutomation/` (framework Appium/pytest para la app móvil Android) debería ser su propio repo (`MediplannerAppiumAutomation` en GitHub), pero **ya no tiene su propio `.git`** — quedó fusionado dentro de `MediplannerWebNuevo` en algún punto. Pendiente decidir: ¿re-inicializarlo como repo propio, o aceptar que vive acá y actualizar la documentación en consecuencia? Mientras tanto, cualquier cambio ahí se commitea en este mismo repo.

---

## Referencias técnicas (para no re-investigar lo ya mapeado)

### Consulta — "Modo Completo" (rediseño 2026-07-23)

La pantalla de Consulta pasó de pestañas clickeables a **una sola página scrolleable con las 10 secciones visibles al mismo tiempo**: General, Signos vitales, Valoración (antes "Apariencia general" — mismo campo/placeholder, solo cambió el título visible), Exploración segmentaria, Aparatos y sistemas, Diagnóstico, Tratamiento, Laboratorios y Procedimientos, Notas del Médico, Servicios.

**Mecanismo de guardado:** Exploración segmentaria y Aparatos y sistemas tienen su propio botón "Guardar Respuestas" cada uno. Todo lo demás se persiste con un único botón global "Guardar cambios" (panel lateral derecho), clickeado una sola vez al final — dispara `editConsultation`/`addDiagnosis`/`setTreatments`/`setFreeTreatmentsConsultation`/`setProceduresConsultation`/`addServices`/`addNote` según qué se haya tocado. Hay 2 botones "Finalizar Consulta" en la página (panel lateral + al pie de Servicios) — usar `.first()`.

**Selectores clave ya probados en vivo** (ver `consultation.full-flow.spec.js` y `consultation.tipos-consulta.spec.ts` para el código completo): `sectionContainer(page, headingRegex)` ubica el card de una sección subiendo ancestros desde su heading `h3` — necesario porque con las 10 secciones en el DOM a la vez, selectores genéricos ("todas las textareas visibles") contaminan entre secciones sin acotar. Motivo de consulta es `textarea[name="visitaPaciente"]` (no input). Signos vitales: `input[name="peso"]`, `input[name*="talla" i]`, `input[placeholder="000/000 mmHg"]`, `input[name*="temp" i]`, `input[name*="card" i]`, `input[name="oxigenacion"]`, `input[name="frecuenciaRespiratoria"]`.

**Pendiente:** confirmar si el indicador "sin guardar" (triángulo, ver más abajo) sigue aplicando en algún lado con este rediseño. Confirmar qué hace el toggle "Expediente"/"Consultas" arriba a la derecha (no investigado).

### Indicador "sin guardar" (triángulo) — Laboratorios y Procedimientos

Bug de front reportado: el triángulo de "cambios sin guardar" no se limpia tras un guardado exitoso (200 OK) en Tratamiento › Laboratorios y Procedimientos. **Ya no reproduce en dev** (3/3 corridas limpias), **pero sigue confirmado como bug real en Staging**. Se detecta automáticamente con `scanResidualIndicators(page, tabName)` en `e2e/utils.js`.

### Wizard "Agendar cita" — patrón de bug recurrente entre entornos

El wizard cambió de UI (perdió las clases Tailwind de su contenedor; el botón final pasó de "Agendar cita"+modal "OK" a "Confirmar cita" sin modal) y esto rompió `createAppointment()` en dev, luego en Staging, y most recientemente (2026-08-18) se encontró que Producción **nunca había recibido el fix**. Fix estable: ubicar el wizard por el heading "Agendar cita" + ancestro más cercano con un input (no por clases CSS, que pueden volver a cambiar); confirmar con el botón "Confirmar cita" + esperar el heading "¡Cita agendada!". **Si se porta este spec a un entorno nuevo, revisar primero si `e2e/utils.js` de ese entorno ya tiene este fix.**

### Vacunación — UI (cartilla + auto-guardado)

Cada dosis es un `<input type="date">` inline (`table.table-compact input[type="date"]`) — llenar la fecha **auto-guarda** (`POST /api/vaccines/saveVaccinesUser`), sin botón. Lápiz = editar folio/notas; "×" = borrar dosis (ambos comparten la clase `btn-secondary`, cuidado). Sección "Otra vacuna" (fuera de la tabla) tiene sus propias filas inline. Botón "Guardar cambios" guarda TODO el apartado (cartilla + otra vacuna). `MAX_DOSES=999` ya aplicado en `vacunacion.ciclo-completo.spec.ts` (dev/Staging/Producción). **Pendiente real:** completar borrado + verificación de filas "otra vacuna" (selector del × rojo: `button[class*="hover:text-red"]`).

### Ingresos — flujo real de "Registrar pago"

El detalle de un ingreso con adeudo muestra: radios de **Concepto** (uno por cada cargo, ej. "Consulta General" + "Certificado Médico"), campo **Monto** prellenado al máximo del concepto, tarjetas de **Método de pago**, y "Registrar pago" que **paga solo el concepto seleccionado** — hay que repetir el envío una vez por concepto hasta saldar el ingreso completo. El botón queda en "Registrando…" (deshabilitado) durante el request. Función `pagarConceptosPendientes()` en el spec ya maneja esto (paga cada concepto con saldo > 0 uno por uno). Selectores post-rediseño: `select[name="estatus"]` (perdió su id), filas `.rdt_TableRow` (react-data-table-component), botón "Ver" sube por `xpath=ancestor::button[1]`. "Paypal" ya no es un método de pago disponible.

### Selector de lista de Pacientes — patrón de cambio recurrente

El nombre del paciente en la lista de `/Pacientes` pasó de `<a class="font-semibold...">` a `<span class="font-semibold text-sm text-gray-900 hover:text-primary truncate">` (dentro de `div.rdt_TableRow`). Ya corregido en 8 specs (7 el 2026-07-21 + `subir-estudios.spec.ts` el 2026-08-18, que se había quedado afuera). **Si un spec nuevo o poco usado falla buscando un paciente por nombre, revisar primero si usa el selector viejo (`a.font-semibold`).**

---

## Decisiones abiertas / pendientes

- [ ] **Producción — retomar full-flow de Consulta:** Pedro debe correr el login manualmente con `pedro.quijada229217@potros.itson.edu.mx` (comando en "🎯 Staging/Producción" arriba).
- [ ] **Ejecutar el plan de 26 proyectos desde Batch 2** (`appointments-create` en adelante) — ver tabla de progreso arriba.
- [ ] **Reconectar el fuzzing muerto de `consultation.inputs-validation.spec.ts`** (`runSectionValidation` + `fillTreatmentSection`/`testMedicacionValidation`) — ver hallazgo arriba.
- [ ] **Confirmar con Pedro** si reportar ya los 5 bugs de app encontrados hoy (CSP Clarity, CSP cdnjs, `saveService` falso registro, rango fisiológico de signos vitales, cruce Tratamiento/Notas) o esperar a acumular más antes de mandarlos a devs.
- [ ] Sacar `.env` del tracking de git (`git rm --cached .env`, confirmar `.gitignore`).
- [ ] Evaluar si conviene rotar la sesión de `Mediplanner produccion/storageState.json` (estuvo expuesta en el historial de git hasta el 2026-07-21, ya destrackeada pero el commit viejo sigue en el historial remoto).
- [ ] Decidir el futuro de `MediplannerAppiumAutomation/` (ver "Repos separados" arriba).
- [ ] Completar borrado + verificación de filas "otra vacuna" (ver Referencias técnicas).
- [ ] Correr `consultation-user-errors` contra dev por primera vez (batch 3 del plan) y arreglar lo que rompa.

---

## Histórico resuelto (condensado — detalle completo en el historial de git de este archivo si hace falta)

- **2026-07-23**: hallazgo y reescritura completa del rediseño "Modo Completo" de Consulta (ver Referencias técnicas arriba). 1 bug de test encontrado y corregido en la verificación manual post-reescritura (motivo de consulta usaba `input` en vez de `textarea`, se guardaba vacío en silencio).
- **2026-07-21**: fix del selector de Pacientes (a→span) en 7 specs + 2 bugs de test nuevos encontrados al verificar (paginación con guión largo "–", sub-pestaña Antecedentes a→button). Re-verificación del bug 422 `relacion_id`: 3/3 corridas limpias → bajado a "no reproduce". `dashboard.spec.js` creado (antes 0 asserts duros). Fix de performance: ~24-30s ahorrados en el toggle de observaciones de Diagnóstico. Limpieza de seguridad: `Mediplanner produccion/storageState.json` destrackeado de git (contenía sesión real de producción). Bugs de Staging confirmados como **solucionados por devs**: 422/404 de `getFilledForm`, crash de `DetallePagos` con `getFiscalData` vacío.
- **2026-07-20/21**: trabajo en `AppEstacionamientosColaboradores/` (proyecto de estacionamientos, no Mediplanner — ver su propio `HALLAZGOS.md`) y en `MediplannerAppiumAutomation/` (módulo de bitácora).
- **2026-07-14**: porteo a Staging del fix de wizard + rediseño de Ingresos, verificado con corridas reales (`807fe43`/`62e285c`). Confirmado con captura real que "Registrar pago" funciona con adeudos reales.
- **2026-07-09**: rediseño de Ingresos mapeado y `ingresos.spec.ts` adaptado. Wizard "Agendar cita" roto y arreglado por primera vez (ver Referencias técnicas). Re-verificación: bug 422 seguía vivo en ese momento (cambiando de endpoint), indicador "sin guardar" de Laboratorios no reprodujo esa vez.
- **2026-07-07**: verificación de pendientes vs. código real; hallazgo original del selector roto de Pacientes (bloqueaba 7 specs).
- **2026-06-17 a 2026-06-25**: 9 stress tests mejorados + monitor de consola (`1bb9cd7`); UI nueva de Vacunación mapeada y automatizada; porteo inicial a Staging de Consulta y Vacunación; `.env`/`storageState`/`test-results` destrackeados de git (`38b6ce6`).
