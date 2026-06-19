# Reporte de Funcionalidad Faltante — Mediplanner Android

---

## 1. Información general

| Campo | Valor |
|---|---|
| **Aplicación** | Mediplanner (Android) |
| **Fecha del reporte** | 2026-05-25 |
| **Tipo de reporte** | Funcionalidad faltante / Defectos de UI |
| **Severidad sugerida** | Media |

---

## 2. Descripción general

Durante la automatización de pruebas funcionales de la aplicación Mediplanner para Android se identificaron múltiples puntos donde la UI carece de atributos de accesibilidad, presenta comportamientos inconsistentes entre estados, o requiere pasos adicionales no documentados para completar flujos críticos. A continuación se detallan los hallazgos.

---

## 3. Hallazgos

### 3.1 ❌ Botón de perfil sin `content-desc` accesible

El botón de acceso al perfil de usuario no se identifica mediante `content-desc`. Se detectó como un `android.widget.ImageView` con el atributo `tooltip-text='Mostrar menú'`, lo cual no es un estándar de accesibilidad en Android.

### 3.2 ❌ Cuadro de diálogo "Desvincular" con identificador duplicado

Al desvincular un dependiente, aparece un popup de confirmación que contiene un segundo botón con el texto "Desvincular". Ambos botones (el inicial y el de confirmación) carecen de `content-desc` diferenciado, lo que impide distinguirlos mediante selectores estándar.

### 3.3 ❌ Flujo de cierre de sesión redirige a pantalla de registro

Al cerrar sesión, la aplicación redirige a una pantalla de registro/login. El usuario debe presionar un elemento adicional (`android.view.View` con `content-desc='Inicia sesión'`) para acceder al formulario de inicio de sesión. No existe un flujo directo a la pantalla de login.

### 3.4 ❌ Botón "Aceptar" en modal "No Tomado" sin `content-desc`

El modal de confirmación para la opción "No Tomado" contiene un botón "Aceptar" que no posee el atributo `content-desc`. No es localizable mediante `@content-desc='Aceptar'`, lo que obliga al uso de localizadores alternativos (bounds, XPATH con posición).

### 3.5 ❌ Estado de medicamento ambiguo en vista de inicio

En la pantalla de inicio, los medicamentos pueden presentar dos estructuras distintas:

- Medicamentos **sin registro previo** en el día: muestran botones "Tomado" / "No Tomado".
- Medicamentos **con registro previo** en el día: muestran texto como "Lo tomé tarde" o "Tomado a las XX:XX".

No hay un indicador visual diferenciado en el elemento principal (nombre/dosis del medicamento) que permita saber en qué estado se encuentra antes de hacer clic. Al hacer clic en un medicamento con registro previo, se navega al historial en lugar de mostrar las opciones de "Tomado" / "No Tomado".

### 3.6 ❌ Campo de dosis oculto hasta interacción

El campo para ingresar la dosis de un medicamento no es visible inicialmente. Solo aparece después de hacer clic en el botón `+`. Esto agrega un paso no evidente para el usuario que intenta registrar un nuevo medicamento.

---

## 4. Pasos para reproducir

### 4.1 Perfil sin `content-desc`

1. Iniciar sesión en Mediplanner.
2. Navegar a la pantalla de inicio.
3. Inspeccionar el botón de perfil/avatar en la parte superior.
4. Verificar que no posee `content-desc`.

### 4.2 Confirmación "Desvincular" duplicada

1. Ir a la sección de Dependientes.
2. Seleccionar un dependiente existente.
3. Presionar "Desvincular".
4. Observar el popup de confirmación con un segundo botón "Desvincular".

### 4.3 Cierre de sesión con paso extra

1. Estando logueado, navegar a Perfil.
2. Presionar "Cerrar sesión".
3. Observar que la app redirige a pantalla de registro.
4. Presionar "Inicia sesión" para acceder al formulario de login.

### 4.4 Botón "Aceptar" sin `content-desc`

1. En la pantalla de inicio, seleccionar un medicamento sin registro previo.
2. Presionar "No Tomado".
3. Inspeccionar el botón "Aceptar" del modal de confirmación.
4. Verificar ausencia de `content-desc`.

### 4.5 Estado ambiguo de medicamento

1. Ir a la pantalla de inicio.
2. Hacer clic en un medicamento que muestra "Lo tomé tarde" o "Tomado a las...".
3. Observar que navega al historial de tomas.
4. Regresar.
5. Hacer clic en un medicamento que no tiene registro previo.
6. Observar que muestra opciones "Tomado" / "No Tomado".

### 4.6 Campo de dosis oculto

1. Ir a la pantalla de inicio.
2. Presionar el botón `+` para agregar un medicamento.
3. Verificar que el campo de texto para la dosis solo aparece después del clic.

---

## 5. Comportamiento actual vs. esperado

| Ítem | Comportamiento actual ❌ | Comportamiento esperado ✅ |
|---|---|---|
| Botón de perfil | `tooltip-text='Mostrar menú'`, sin `content-desc` | `content-desc='Mostrar menú'` o equivalente |
| Popup Desvincular | Dos botones "Desvincular" sin diferenciación | Botón de confirmación con `content-desc` único (ej. "Confirmar desvinculación") |
| Cierre de sesión | Redirige a pantalla de registro; requiere clic extra en "Inicia sesión" | Redirige directamente al formulario de inicio de sesión |
| Botón Aceptar (No Tomado) | Sin `content-desc`, requiere fallback por bounds | `content-desc='Aceptar'` presente |
| Estado de medicamento | Misma apariencia visual para medicamentos con y sin registro; comportamiento diferente al hacer clic | Indicador visual que distinga si el medicamento tiene registro hoy |
| Campo de dosis | Invisible hasta presionar `+` | Visible desde la carga de la pantalla, o al menos indicado con placeholder |

---

## 6. Contexto adicional

| Aplicación | Módulo afectado | Hallazgo |
|---|---|---|
| Mediplanner Android | Navegación global | Botón de perfil sin `content-desc` |
| Mediplanner Android | Dependientes | Popup Desvincular con identificador duplicado |
| Mediplanner Android | Autenticación | Redirección login/registro después de cerrar sesión |
| Mediplanner Android | Home — Medicamento | Botón Aceptar en modal No Tomado sin `content-desc` |
| Mediplanner Android | Home — Medicamento | Estados de medicamento no distinguibles visualmente |
| Mediplanner Android | Home — Medicamento | Campo de dosis oculto |

---

## 7. Anexos

*(No aplica en la versión actual del reporte. Insertar capturas de pantalla de cada hallazgo para ilustrar los puntos anteriores.)*

| Hallazgo | Captura |
|---|---|
| Perfil sin `content-desc` | — |
| Popup Desvincular duplicado | — |
| Pantalla registro después de logout | — |
| Modal No Tomado sin Aceptar detectable | — |
| Medicamento con historial vs. sin registro | — |
| Campo dosis oculto | — |

---

## 8. Resumen

**Funcionalidad faltante en UI de Mediplanner Android — Atributos de accesibilidad, consistencia de estados y navegación**

Se identificaron 6 hallazgos en la aplicación Mediplanner para Android que afectan la capacidad de automatizar pruebas y, en varios casos, la experiencia de usuario: botones sin `content-desc` (perfil, Aceptar en modal), identificadores duplicados en popups de confirmación, redirección con paso extra al cerrar sesión, estados de medicamento indistinguibles visualmente, y campo de dosis oculto. Se recomienda corregir los atributos de accesibilidad y revisar el flujo de navegación post-logout.
