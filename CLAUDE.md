# MediplannerWebNuevo — guía de trabajo

Suite de automatización E2E con Playwright para la web admin de Mediplanner.
Pedro es Test Automation Tester (no developer); los tests son su
responsabilidad. Trabajamos en español. Ver `CONTEXTO.md` en la raíz para el
estado vivo del proyecto — leerlo al empezar cualquier sesión.

`.env` y `storageState.json` son locales, no están versionados (ver
`.gitignore`); pedírselos a Pedro o copiarlos de otra máquina si hace falta
correr tests.

## 0. Metodología de pruebas — NORMA PERMANENTE (agregada 2026-07-30)

Se agrega esta sección tras un error real: durante una sesión de error
guessing se encontró evidencia de un problema (checklists de una consulta
mostrando "Cargando preguntas" sin resolver, un 404 de `getFilledForm` justo
tras Finalizar, un `getFilledForm` que devolvía el formulario en blanco) **tres
veces en la misma sesión**, y las tres veces se descartó con una explicación
benigna sin investigarlo a fondo — hasta que Pedro señaló el patrón. La causa
de fondo no fue falta de habilidad técnica: fue **mirar cada pantalla
buscando solo lo que se estaba probando en ese momento**, en vez de revisarla
completa. Estas reglas son la norma permanente para que no se repita.

### 1. Inventario obligatorio antes de probar

Antes de interactuar con una pantalla nueva (o una ya conocida pero que no se
ha vuelto a mapear recientemente), enumerar programáticamente **todos** sus
elementos interactivos: inputs, selects, textareas, checkboxes/radios,
editores de texto enriquecido, botones, links, comboboxes. No alcanza con
mirar un screenshot — volcar el DOM (`name`/`placeholder`/`type`/`required`)
a un log, igual que ya se hace en los scripts `_explorar_*`/`_reconocer_*` de
sesiones anteriores.

**Se llena todo lo que se puede llenar, no una muestra representativa.** Si
una sección o campo queda sin llenar a propósito, se declara explícitamente
por qué (ej. "Familiar Responsable" solo aplica a pacientes menores, no se
llenó porque el paciente de prueba es adulto).

### 2. Centinelas automáticos en toda prueba, sin importar el foco

Cualquier prueba, sin importar qué esté verificando puntualmente, debe correr
(o al menos revisar el resultado de) estos chequeos generales:

- **Texto de carga persistente** ("Cargando…", spinners, skeletons) —
  esperar de forma realista (varios segundos, no un `waitForTimeout` corto) y
  solo entonces decidir si resolvió o quedó colgado. Nunca tomar un
  screenshot y concluir "está colgado" sin haber esperado lo suficiente
  primero (ver punto 6).
- **Responses de API con error** (4xx/5xx) — ya se hace en varios scripts,
  pero hay que *revisar* la lista, no solo imprimirla.
- **Errores nuevos de consola JS.**
- **Secciones que deberían tener datos y aparecen vacías.**
- **Campos llenados que no reaparecen tras recargar la página** (F5) o tras
  volver a entrar por otro camino (ver punto 3).

### 3. Verificar TODO el estado final, no solo el campo bajo prueba

Después de cualquier guardado y, sobre todo, después de **Finalizar** un
flujo (una consulta, un alta, un pago): releer **toda** la pantalla —por UI
y, cuando aplique, por API— contra un manifiesto de lo que se llenó. No basta
con verificar el campo que era el objetivo de esa prueba puntual.

**Preguntar por más lugares donde la misma información se presenta.** Un
mismo dato puede mostrarse en más de una vista, y un bug puede estar en una
sin estar en la otra. Ejemplo confirmado por Pedro: una consulta finalizada
se ve completa justo al terminarla, pero **también** se puede llegar a ella
desde el perfil del paciente → pestaña "Consultas" → seleccionar la consulta
→ moverse entre sus sub-pestañas (ahí aparece una vista preliminar con un
botón para ver la consulta completa, igual a como se ve recién finalizada).
Cuando haya duda sobre si una pantalla está bien cubierta, preguntar
explícitamente: *"¿hay otro lugar donde esta información también debería
aparecer?"* — no asumir que ya se vio todo con una sola vista.

### 4. Regla anti-racionalización (la más importante)

**Prohibido explicar una anomalía con una hipótesis benigna sin evidencia *de
esa misma corrida*.** Nada de "esto ya se sabe que es retraso del backend"
solo porque `CONTEXTO.md` documentó algo parecido antes — cada corrida nueva
se evalúa con evidencia propia (esperar más, recargar, revisar la respuesta
real de la API) antes de descartarla.

Ninguna advertencia se degrada a "no bloqueante" sin una prueba explícita, en
esa corrida, de que es inocua (ej.: se esperó 15s más y sí resolvió; se
recargó y el dato sí estaba). Si no se pudo probar que es inocua, se
documenta como hallazgo abierto, no como advertencia descartada.

### 5. Auditar las excepciones ya existentes en el código de tests

Cada `catch(() => {})` silencioso, cada "advertencia no bloqueante", cada
`{ optional: true }` en el código existente (`e2e/utils.js`,
`tests/*.spec.js`) es un lugar donde un bug real puede estar escondido hoy.
Al tocar un spec por otro motivo, de paso revisar si sus silenciamientos
siguen bien justificados.

### 6. Lectura estructurada de screenshots y páginas

Nunca mirar una captura o el texto de una página buscando una sola cosa.
Recorrerla **sección por sección** contra el inventario del punto 1, y volcar
el texto completo de la página (`body.innerText()`) al log para poder
revisarlo después con calma, no solo lo que parece relevante en el momento.

---

## Estructura del repo

Ver `CONTEXTO.md` para el detalle vivo (hallazgos, pendientes, decisiones
abiertas). Resumen de entornos: **dev** (raíz, `tests/`) → `admin-dev.mediplanner.mx`;
**staging** (`Mediplanner Staging/`) → `admin-staging.mediplanner.mx`;
**producción** (`Mediplanner produccion/`). 3 ramas espejo (`Trabajando`
default, `main`, `Normalization`) que Pedro mantiene sincronizadas al mismo
commit.

Scripts sueltos en la raíz (prefijo `_`) son exploración/error-guessing
puntual, conservados como referencia — no son parte de la suite oficial de
`tests/`.
