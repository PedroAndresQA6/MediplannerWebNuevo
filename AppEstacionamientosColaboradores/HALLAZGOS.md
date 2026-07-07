# Hallazgos — AppEstacionamientosColaboradores

> Mismo formato que la sección "Hallazgo de QA" de `CONTEXTO.md` en la raíz
> del repo: cosas para reportar a devs, con estado de si ya se reportó.

---

## 🔧 Pedido a devs: identificadores estables en los widgets de la app (Flutter)

**Estado: pendiente de reportar.**

La app (`com.example.estacionamientos_mobile`) es Flutter, y sus widgets
interactivos (campos de texto, botones) **no exponen `resource-id` ni
`content-desc` propio** en el árbol de accesibilidad — solo `android.view.View`
genéricos. Appium/UiAutomator2 solo puede ubicarlos por estructura: el label
hermano que los precede (`//View[@content-desc="Contraseña"]/following-sibling::EditText`)
o por posición/índice entre los `EditText` de la pantalla.

**Por qué importa:** esta es exactamente la fragilidad que las guías de
automatización móvil marcan como la causa #1 de tests inestables ("usar
accessibility IDs o resource IDs, no XPath posicional"). Un cambio de layout
menor — reordenar un campo, agregar uno nuevo antes de otro — puede romper
selectores que hoy funcionan, sin que sea un bug real de la app.

**Pedido concreto:** envolver los widgets interactivos clave (campos de login,
botones de acción como "INICIAR TURNO"/"Cerrar turno") en un
`Semantics(label: "...", child: ...)` con un label único y estable, o
asignarles una `Key` explícita. Cualquiera de las dos opciones aparece en el
árbol de UiAutomator2 como `content-desc` o `resource-id` respectivamente, y
elimina la necesidad de selectores estructurales.

**Mitigación aplicada mientras tanto:** `BasePage.ingresar_texto_con_fallback`
prueba el selector por label hermano y, si falla, cae a un selector por
índice de posición — no es tan robusto como un id estable, pero reduce el
punto único de falla (ver `pages/login_page.py`).

---

## 🐛 Crash real de la app durante login (no reproducido aún de forma determinística)

**Estado: pendiente de reportar — falta reproducir con evidencia completa.**

Durante el recon inicial (2026-07-07, ~12:12), la app se cerró sola en medio
de un flujo de login normal (mismas credenciales, mismos pasos que corridas
que sí funcionaron antes y después). Logcat capturado por `crash_monitor`:

```
W ActivityTaskManager: Force finishing activity com.example.estacionamientos_mobile/.MainActivity
I ActivityManager: Process com.example.estacionamientos_mobile (pid 6016) has died: fg TOP
```

El buffer de logcat rotó antes de poder capturar el stack trace completo (fue
la razón por la que se agregó el volcado completo a
`reports/monitor/*_logcat_completo.txt` en cuanto se detecta un crash — ver
`conftest.py`). **No se volvió a reproducir** en corridas posteriores. Próxima
vez que ocurra, ese archivo va a tener el contexto completo para armar un
reporte de bug real.

---

## 🤔 Login intermitentemente lento (>20s) contra el backend de dev

**Estado: observado en varias corridas (2026-07-07 tarde) — bajo prioridad,
mitigado en los tests.**

Al automatizar los módulos Smoke y 3 (Splash/sesión), el tiempo entre tocar
"INICIAR TURNO" y que el Home termine de cargar varió fuerte entre corridas:
a veces ~2s, otras veces >30s con las mismas credenciales y el mismo build.
No hubo error visible en logcat (no es un crash) — el `finally` de cierre de
turno del test que falló por timeout igual pudo ejecutarse después, señal de
que el login sí había terminado, solo que tarde. Se subió el timeout de
`home_page.esta_cargado()` de 20s a 30s en los tests de Smoke y del módulo 3
como mitigación. Si se repite con timeouts más altos, reportar a devs como
posible lentitud del backend de dev (no del emulador, que en estas corridas
sí reportó buen estado — `app_state=4`, sin crash/ANR).

## 🤔 Card "Asignación de hoy" no aparece como paso posterior al login (checklist 4.4)

**Estado: observado en recon del módulo 4 (2026-07-07) — a confirmar con Pedro
si es un cambio de diseño intencional o un paso que falta implementar.**

El checklist QA describe, para el login exitoso (4.4): "Credenciales válidas
→ Iniciar → Card 'Asignación de hoy' (zona, turno, compañero); entra a Home"
— dando a entender una pantalla/card intermedia entre el login y Home. En
este build, esa card (con el texto "Sin asignación disponible por el
momento.") en realidad ya está renderizada **en la propia pantalla de
Login**, como preview antes de autenticar — no aparece como paso aparte
después de tocar "INICIAR TURNO": el login exitoso entra directo a Home. No
bloquea nada (el dato de asignación existe, solo que se muestra en otro
momento del flujo), pero difiere de lo que describe el checklist original.

## 🔧 Pedido a devs: pines del mapa sin identificador/estatus por accesibilidad

**Estado: pendiente de reportar.**

Los marcadores del mapa (Google Maps SDK) exponen TODOS el mismo
`content-desc="Marcador de mapa"` genérico — no hay forma de identificar por
accesibilidad ni el código de espacio ni el estatus (color) de un pin
específico, a diferencia de las filas de la Vista Lista (que sí incluyen el
código en su `content-desc`). Esto bloqueó automatizar 6.1 (colores por
estatus), 6.2 (leyenda vs. pines) y 6.3 (seleccionar un pin específico) — ver
`tests/test_6_mapa.py`. Además, tras 4 intentos de recon (click directo,
click con espera de estabilización, tap por coordenadas con bounds frescos)
no se logró reproducir de forma confiable que tocar un marcador abra el
sidebar, lo que sugiere que el hit-test del marcador podría ser más chico que
el bounding box reportado por accesibilidad, o requerir un estado de "mapa
idle" más estricto que el usado en el recon.

**Pedido concreto:** si es viable, exponer el código de espacio en el
`content-desc` de cada marcador (p.ej. vía `MarkerOptions.title` o un
`Semantics` custom sobre el marker), igual que ya se pidió para los widgets
de login/turno en el hallazgo de arriba.

**Nota adicional:** los marcadores cargan de forma ASÍNCRONA tras entrar a
Mapa (confirmado: 1 visible a los ~2s, 11 a los ~3.5s en la misma corrida) —
cualquier conteo debe esperar a que se estabilice, no leerlo apenas se
entra a la vista.

## 🤔 Diálogo de Filtros del mapa: sin botón "Limpiar" visible (checklist 6.7)

**Estado: observado en recon del módulo 6 (2026-07-07) — a confirmar con
Pedro.**

El checklist describe para 6.7 "Filtros → seleccionar tipo → Aplica
correctamente; 'Limpiar' restaura todo", pero el diálogo de Filtros mapeado
hoy (sección "Estatus": Libre/Vigente/Por vencer/Vencido; sección "Tipo de
vehículo": Civil/Discapacitados/Zona de Carga) no mostró ningún botón
"Limpiar" ni "Aplicar" — solo los botones de cada opción y un backdrop
"Sombreado" para cerrar. Tampoco se encontró un botón de "centrar ubicación"
(caso 6.10) en los dumps tomados. Podría ser que estos elementos no estén
implementados en este build, o que requieran un estado previo (algún filtro
ya activo) para aparecer — no investigado a fondo todavía.

## 🤔 Reloj del topbar 12h desfasado del reloj real del dispositivo (a confirmar)

**Estado: observado una vez en recon del módulo 7 (2026-07-07) — bajo
prioridad, sin investigar a fondo.**

En un screenshot tomado durante el recon, la barra de estado de Android
marcaba **10:12** (hora real del dispositivo, ya sincronizada por
`conftest.py`) pero el reloj del topbar de la app marcaba **22:12** — una
diferencia de exactamente 12 horas, compatible con un bug de conversión
12h/24h (p.ej. tratar una hora AM como si fuera PM o viceversa al formatear).
El turno mostraba "22:12 · Turno 06:06" en ese momento. No se investigó a
fondo porque no bloqueaba nada — el turno en cuestión llevaba abierto varias
horas por un problema de limpieza de la suite (ver housekeeping en
`CONTEXTO.md`), así que también podría ser un efecto secundario de esa
situación anómala y no representativo de un turno recién iniciado. Confirmar
con un turno fresco antes de reportarlo formalmente.

## 🤔 Contador de "Duración" del turno con valor inconsistente (a confirmar si es dato de prueba)

**Estado: observado una vez, sin investigar a fondo — bajo prioridad.**

Al cerrar un turno abierto hace ~2 minutos (12:05 → 12:07), la pantalla
"Cierre de turno" mostró **"Duración: 120:01:26"** (120 horas) en vez de algo
cercano a 00:02:xx. Podría ser un contador que no se resetea entre turnos en
el ambiente de dev, o un dato de prueba/seed no relacionado con el turno real.
No se investigó más porque no bloqueaba el flujo — señalarlo si se repite.
