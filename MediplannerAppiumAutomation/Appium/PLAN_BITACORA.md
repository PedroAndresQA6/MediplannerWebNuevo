# Plan de ataque — Bitácora + botón flotante "+Registrar" (Home)

> Mapeo hecho el 2026-07-14 sobre dev, emulador 1344x2992, perfil titular **Carla Perez Rojas**.
> Todos los selectores de abajo salen de dumps reales de uiautomator (no adivinados).
> Objetivo: implementar los tests de una pasada, sin re-explorar la app.

## 1. Mapa de la funcionalidad

### Home (pestaña Inicio)
- **Carrusel superior** (4 dots): el slide de bitácora es un `android.view.View`
  `clickable=true` que contiene descendientes con `content-desc="Ver mi bitácora"`
  y `content-desc="Racha de N día · ..."`. OJO: el contenido del carrusel depende
  del perfil (en un dependiente el slide 1 era percentiles, no bitácora) → localizar
  por descendiente `Ver mi bitácora` + `xpath=ancestor` clickable, NUNCA por posición
  de slide; si no está visible puede requerir swipe del carrusel.
- **Botón flotante**: `android.widget.Button` con `content-desc="Registrar"`
  (bounds ~[902,2443][1296,2611], flota sobre la lista de medicamentos del día).
- ⚠️ Home tarda: hay spinner central mientras carga la lista; el FAB ya existe antes,
  pero conviene esperar el FAB con espera explícita, no asumir render inmediato.
- ⚠️ PELIGRO: el chip "Carla P." (esq. sup. izq.) abre el drawer de dependientes.
  NO tocarlo (pedido explícito de Pedro). Si un test lo abre por accidente, cerrarlo
  tocando fuera del panel (p.ej. tap en x=1100,y=1400), jamás seleccionando un perfil.

### Pantalla "Mi bitácora"
- Título: `content-desc="Mi bitácora"`.
- Back: Button superior izq. SIN content-desc (NAF) → usar `tap_esquina_sup_izquierda`
  de base_page (posicional). No usar driver.back() como primera opción.
- Botón **"+"**: Button superior der. SIN content-desc (NAF), bounds [1200,171][1344,315]
  → `tap_esquina_sup_derecha("android.widget.Button")`.
- Sección `content-desc="TENDENCIAS"`: tarjetas clickeables tipo
  `content-desc="Peso\n80 kg\n67.0"` (nombre + último valor + delta).
- Sección `content-desc="REGISTROS"`: headers de fecha (`"Ayer"`, `"jueves 9 jul"`) y
  filas NO clickeables con content-desc multilínea:
  `"Peso\nMedición\n80 kg\n12:10"` / `"Presión arterial\nMedición\n125/080 mmHg\n11:08"`.
  Formato general: `"{nombre}\n{categoría}\n{valor unidad}\n{HH:MM}"` → ideal para
  verificar persistencia con contains().

### Modal "Agregar entrada única" (bottom sheet)
- Se abre **idéntico** desde el FAB "Registrar" de Home y desde el "+" de Mi bitácora
  (mismo componente, 2 entradas → un solo page object).
- Opciones (Buttons por content-desc): `Medicamento`, `Medición`,
  `Valores de laboratorio`, `Actividad`, `Lactancia`, `Deposición`,
  `Control de síntomas`, `Estado mental`, y botón `Cancelar`.

### Pantalla "Seleccionar de la lista" (tras elegir categoría)
- Título: `content-desc="Seleccionar de la lista"`; buscador `EditText hint="Buscar"`.
- Secciones `Comunes` y `Todas` (los comunes se repiten en Todas).
- Ítems = Buttons `content-desc="{nombre}\n{unidad}"`, p.ej. `"Peso\nkg"`,
  `"Presión arterial\nmmHg"`, `"Temperatura\n°C"`.
- Medición trae: Peso, Frecuencia cardíaca en reposo, Presión arterial,
  Glucosa (antes/después de la comida), Temperatura. Lactancia trae: Toma al pecho,
  Pañal, Extracción de leche, Biberón (fórmula), Peso del bebé, Talla,
  Perímetro cefálico, Temperatura del bebé, Vitamina D…
- ⚠️ Tocar el buscador abre el teclado y puede tapar ítems → si se usa, cerrar con
  keyevent 111 (ESC) tras escribir, o tocar ítems por content-desc (scrollea solo).

### Formulario de captura (ej. Peso)
- Título: `content-desc="Peso"`; display del valor `content-desc="0"`; unidad `"kg"`.
- Filas `content-desc="Fecha\nHoy"` y `content-desc="Hora\n18:45"` (clickeables,
  abren pickers — para v1 dejarlas en default, los pickers nativos son frágiles).
- **Teclado numérico IN-APP** (no el de Android): Buttons `content-desc` `"1".."9"`,
  `"."`, `"0"` y borrar (sin desc). Ingresar 80 = click "8" + click "0".
- Botón `content-desc="Guardar"`: **deshabilitado** (`enabled=false`) con valor 0 →
  se habilita al teclear valor > 0. Validación negativa gratis.
- ⚠️ **Verificado al implementar:** al guardar, el flujo NO regresa a "Mi bitácora"
  sino al punto de entrada (si el modal se abrió desde el FAB de Home, guardar
  regresa a Home). Para verificar persistencia hay que entrar a Mi bitácora
  explícitamente después de guardar, no asumir que ya estás ahí.
- ⚠️ Las categorías del modal ("Medicamento", "Medición", etc.) y las teclas del
  teclado numérico ("0"-"9", ".") son `android.view.View`, NO `Button` (solo
  "Cancelar" y los ítems de "Seleccionar de la lista" son `Button`). Las teclas
  del teclado numérico necesitan filtro `@clickable='true'` porque el display
  grande del valor actual comparte el mismo content-desc (p.ej. "8") pero no es
  clickeable.
- ⚠️ "Seleccionar de la lista" es un push-screen, no un modal apilado sobre el
  bottom sheet: un solo `driver.back()` desde ahí regresa directo a Home/Mi
  bitácora (el sheet ya se "consumió" al elegir la categoría). Un back de más
  saca la app entera al launcher de Android (reproducido durante la
  implementación) — no dar más de un back sin verificar dónde se está.
- Presión arterial probablemente tiene 2 displays (sistólica/diastólica) — verificar
  en implementación; el resto de mediciones son de 1 valor.

## 2. Tests propuestos (orden de implementación)

Nuevo page object `pages/bitacora_page.py` (hereda BasePage) con:
`abrir_desde_home()` (card del carrusel), `abrir_modal_registrar()` (FAB o "+"),
`elegir_categoria(nombre)`, `elegir_item(nombre)`, `teclear_valor("80")`,
`guardar()`, `registro_visible(nombre, valor)` (contains sobre content-desc de filas).

1. **test_bitacora_ver** (read-only, smoke): Home → card "Ver mi bitácora" →
   assert título + secciones TENDENCIAS/REGISTROS + ≥1 fila de registro con formato
   esperado → volver a Home. Sin escritura.
2. **test_bitacora_modal_desde_ambas_entradas** (read-only): abrir modal desde FAB
   "Registrar", assert las 8 categorías + Cancelar, cancelar; abrir desde "+" de
   Mi bitácora, assert mismas opciones, cancelar. Valida la equivalencia de entradas.
3. **test_bitacora_registrar_medicion** (escritura, dato desechable): FAB →
   Medición → Peso → assert Guardar deshabilitado con 0 → teclear "80" →
   assert Guardar habilitado → Guardar → en Mi bitácora verificar fila nueva de hoy
   `contains "Peso"` y `contains "80 kg"`. (Peso 80 = valor ya usado por el paciente,
   no distorsiona tendencias.)
4. **test_bitacora_buscador_lista** (read-only): en "Seleccionar de la lista" de
   Medición escribir "Temp" → assert solo Temperatura visible → limpiar → back.
5. (Opcional, v2) smoke de categorías: loop por las 8 categorías, assert que
   "Seleccionar de la lista" carga con ≥1 ítem, back. Barato y detecta categorías rotas.
6. (Opcional, v2) tendencia: tocar la tarjeta "Peso" de TENDENCIAS y mapear/validar
   el detalle (pantalla aún no explorada — único punto sin mapear).

## 3. Reglas para la implementación (ahorro y estabilidad)

- Selectores SIEMPRE por content-desc de arriba; posicionales solo para back y "+"
  (helpers existentes de base_page). Cero bounds hardcodeados.
- Esperas con `esta_visible`/`buscar_elementos`/`assert_visible` (nunca find_elements
  crudo tras una transición — fue la causa del fallo de compartir).
- No usar `driver.back()` para navegar (memoria del proyecto); back in-app posicional.
- No tocar el chip de perfil/drawer de dependientes bajo ninguna circunstancia.
- Tests chicos e independientes; marcar 1-2 como `smoke`. Reusar `volver_inicio`.
- Todo se corre sobre el perfil titular (Carla). El único test que escribe (nº3)
  agrega una medición inocua; no hay flujo de borrado mapeado aún, así que no se
  intenta limpiar (documentarlo en el docstring).
