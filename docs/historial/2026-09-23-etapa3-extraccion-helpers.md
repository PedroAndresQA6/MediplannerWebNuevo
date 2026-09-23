# Etapa 3 — Extracción de los helpers de consulta — 2026-09-23

> Mudanza, no reescritura: las quince funciones auxiliares de
> `tests/consultation.full-flow.spec.js` se movieron tal cual a
> `e2e/consulta/`. No se cambió lógica ni se re-juzgó ningún `opcional()`
> (ya clasificados en la Etapa 2).

## Resultado

| | Antes | Después |
| --- | --- | --- |
| `tests/consultation.full-flow.spec.js` | 1165 líneas | **466 líneas** (meta: < 500) |
| Helpers en el spec | 15 funciones (líneas 75–734) | 0 |

## Qué fue a cada archivo

| Archivo | Contenido | `opcional()` | Precondiciones Etapa 2 |
| --- | --- | --- | --- |
| `e2e/consulta/navegacion.js` (104) | `sectionContainer`, `saltarOnboardingYWizardConfig`, `iniciarConsultaDelPaciente` | 5 | 6 |
| `e2e/consulta/secciones.js` (551) | `fillPerimetroCefalico` + las 8 `fill*Section` | 40 | 4 |
| `e2e/consulta/guardado.js` (69) | `guardarCambiosGlobal`, `waitForFinalizarButton` | 1 | 0 |
| `e2e/consulta/datos.js` (61) | `DATOS_CLINICOS`, los 10 `TEXTO_*`, `PACIENTE_*`, `PERCENTIL_*`, `MEDIDAS` | 0 | — |
| `e2e/consulta/util.js` (5) | `pick()` | 0 | — |
| spec (queda) | solo el test | 6 | 3 |

Totales: **52 `opcional()`** (igual que antes) y **13 precondiciones** sin
`opcional()` (igual que antes).

**`datos.js` no estaba en el plan original de `docs/tarea-actual.md`** —
aprobado por Pedro antes de mover. Motivo: las constantes las usan a la vez
los helpers (`secciones.js`, `navegacion.js`) y la verificación post-Finalizar
del spec; sin un módulo compartido, la única forma de moverlas habría sido
pasarlas por parámetro (refactor, no mudanza). Además, sin moverlas el spec
quedaba en ~505 líneas, por encima de la meta.

**Comentarios de contexto:** cada comentario encima de una función viajó con
ella. La cabecera del spec se repartió: el párrafo del rediseño a "Modo
Completo" va al inicio de `secciones.js`, el del mecanismo de guardado al
inicio de `guardado.js`, y la línea del backup quedó en el spec. El comentario
del typo y el regex `/^Exploración segmentar[ií]a\s*$/i` viven en el cuerpo
del test y no se movieron.

## Cómo se verificó la mudanza

1. Hecha con un script que corta rangos de líneas exactos del original (no a
   mano), con chequeos de que cada límite de rango cayera donde se esperaba.
2. Cada bloque movido se comparó contra el original: **idénticos byte a
   byte**. Las únicas líneas no-vacías del original que no aparecen en el
   resultado son los 3 imports viejos y 2 separadores `//` de la cabecera.
3. `node --check` en los 6 archivos; carga de cada módulo sin exports
   `undefined`; ningún identificador usado sin importar.
4. Auditoría del punto 7 de `CLAUDE.md` antes de correr: la mudanza no
   introdujo ningún `.catch()` nuevo. Los `try/catch` que loguean ⚠️ y siguen
   dentro de las 8 `fill*Section` son preexistentes y viajaron tal cual.
5. `opcional.js` sigue siendo un único registro compartido (caché de módulos
   de Node), así que `reporteOpcionales()` sigue viendo los disparos de todos
   los módulos.

## Corrida contra dev — `doctor-consultation`

Log: `logs/etapa3-doctor-consultation.log`. Comparada contra la última corrida
de la Etapa 2 (`logs/2026-09-17-doctor-consultation-post-etapa2-v4.log`):

| | Etapa 2 (v4, 2026-09-17) | Etapa 3 (2026-09-23) |
| --- | --- | --- |
| Falla en | `failedApiCalls = 2` — 404 `getFilledForm` | igual |
| Verificación post-Finalizar | "Todo lo llenado sigue guardado" | igual, 0 inconsistencias |
| Laboratorios/Procedimientos, Notas del Médico | ✅ | ✅ (1 procedimiento, nota encontrada) |
| Checklists | ✅ | ✅ Exploración 8/8, Aparatos 15/15 |
| `opcional()` disparados | `3x auditarPantalla:elemento-inputvalue` | igual |
| `a[c] is not a function` / `data-stepper-next` | 9 / 1 | 9 / 1 |
| Errores de consola totales | 34 | **41** |

**Única diferencia: 7 `net::ERR_ABORTED` más** (2 → 9). No hay ninguna
aserción sobre ellos. Todos tienen timestamp +3.20s y +5.11s, que coinciden
con las recargas "Calendario del Dashboard no renderizó (intento 1/3, 2/3)" de
`asegurarCitaDeHoy` (`e2e/utils.js`, no tocado en esta etapa): son requests
del Dashboard en vuelo que el navegador cancela al recargar. Cuántos quedan
en vuelo en ese instante depende del timing de dev. Evidencia de esta corrida:
la coincidencia de timestamps; no se hizo una segunda corrida para confirmar
que el número varía entre corridas — queda como observación abierta, no como
descartada.

**Conclusión:** la mudanza no cambió el resultado del test. Sigue en rojo por
el mismo hallazgo abierto de `getFilledForm` (ver
`docs/hallazgos-abiertos.md`).
