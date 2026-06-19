# Reporte de Funcionalidad Cubierta — Mediplanner Android

---

## 1. Información general

| Campo | Valor |
|---|---|
| **Aplicación** | Mediplanner (Android) |
| **Fecha del reporte** | 2026-05-25 |
| **Tipo de reporte** | Funcionalidad cubierta por tests automatizados |
| **Severidad sugerida** | N/A |

---

## 2. Descripción general

La suite de pruebas automatizadas `MediplannerAppiumAutomation` cubre los flujos funcionales críticos de la aplicación Mediplanner para Android. A continuación se detallan los 12 archivos de test, los módulos que ejercitan y las funcionalidades validadas.

---

## 3. Funcionalidades cubiertas

### 3.1 ✅ `test_basico.py` — Navegación básica y estructura

Valida que la aplicación responde a interacciones fundamentales:

- Navegación entre pestallas de la barra inferior
- Retroceso y avance entre pantallas
- Visibilidad de elementos estructurales (toolbar, títulos)

### 3.2 ✅ `test_volver_inicio.py` — Retorno a pantalla de inicio

Valida que el helper `volver_inicio()` retorna correctamente desde cualquier pantalla a la pestalla Inicio, confirmando que la navegación global es consistente.

### 3.3 ✅ `test_home.py` — Interacciones en pantalla de inicio

Cubre la interacción con elementos de la pantalla principal:

- Scroll vertical para explorar contenido
- Localización y clic en botones de acción rápida
- Manejo del modal "No Tomado" con botón "Aceptar" mediante localizadores alternativos cuando `content-desc` no está presente

### 3.4 ✅ `test_medicamento.py` — Registro de toma de medicamento

Flujo completo de registro de una toma:

1. Selección de un medicamento **sin registro previo** en el día (evita aquellos con historial "Lo tomé tarde" / "Tomado a las...")
2. Presionar "Tomado"
3. Selección aleatoria de emoji de estado de ánimo
4. Ingreso de comentario opcional
5. Presionar "Registrar toma" en el popup de confirmación
6. Captura de screenshot como evidencia

### 3.5 ✅ `test_agregar_medicamento.py` — Agregar nuevo medicamento

Flujo de creación de medicamento:

- Presionar botón `+` en pantalla de inicio
- Escritura de dosis en campo de texto que aparece tras el clic
- Confirmación de creación

### 3.6 ✅ `test_medicinas.py` — Listado de medicinas

Valida que la vista de listado de medicinas carga correctamente y muestra elementos esperados.

### 3.7 ✅ `test_consultas.py` — Gestión de citas

Flujo completo de gestión de consultas médicas:

1. Navegar a pestalla de consultas
2. Identificar citas en estado "Agendada"
3. Reprogramar cita (modal con 3 opciones: "Confirmar asistencia", "Reprogramar", "No confirmaré mi asistencia")
4. Confirmar asistencia
5. Manejar popup de confirmación posterior
6. Si no existen citas "Agendada", agenda una nueva automáticamente desde el módulo Médicos

### 3.8 ✅ `test_estudios.py` — Estudios clínicos

Valida que la sección de estudios carga y muestra datos correctamente.

### 3.9 ✅ `test_medicos_filtros.py` — Filtros de búsqueda de médicos

Cubre la funcionalidad de filtros en la búsqueda de médicos:

- Aplicación de filtros por especialidad, ubicación u otros criterios
- Verificación de resultados filtrados

### 3.10 ✅ `test_dependientes.py` — Gestión de dependientes

Tres tests que cubren el flujo completo de gestión de dependientes:

- **Agregar dependiente**: navegación a perfil, selección de opción, formulario de alta
- **Agregar segundo dependiente**: verifica que el flujo funciona con múltiples dependientes
- **Desvincular dependiente**: selección de dependiente existente, presionar "Desvincular", confirmación en popup con segundo botón "Desvincular"

Incluye creación automática de dependiente si no existe ninguno, uso de `driver.back()` para retornar a Inicio, y re-selección del perfil titular.

### 3.11 ✅ `test_perfil.py` — Perfil de usuario

Seis tests que cubren la sección de perfil del titular:

- Visualización de datos personales
- Edición de información
- Navegación a secciones internas
- Cierre de sesión (con manejo de redirección a pantalla de registro/login)
- Re-login mediante `login_page.iniciar_sesion()`

---

## 4. Pasos para ejecutar la suite

1. Posicionarse en el directorio `Appium/`
2. Ejecutar: `python -m pytest tests/ -v --tb=short`
3. Los tests se ejecutan en orden alfabético por archivo
4. Cada test usa los fixtures definidos en `conftest.py`: `driver`, `home_page`, `login_page`, `credenciales`

---

## 5. Módulos y frameworks utilizados

| Componente | Tecnología |
|---|---|
| Automatización | Appium Python Client |
| Framework de pruebas | Pytest 9.0.3 |
| Localización de elementos | AppiumBy (XPATH, content-desc, bounds) |
| Navegación | Helper `volver_inicio()` en `utils/navegacion.py` |
| Page Objects | `home_page`, `login_page` |
| Reporting | Allure, pytest-html |
| Drivers | Android (WebDriver vía Appium) |

---

## 6. Contexto adicional

| Aplicación | Módulo probado | Archivo de test |
|---|---|---|
| Mediplanner Android | Navegación global | `test_basico.py`, `test_volver_inicio.py` |
| Mediplanner Android | Inicio | `test_home.py` |
| Mediplanner Android | Medicamento — Registro de toma | `test_medicamento.py` |
| Mediplanner Android | Medicamento — Agregar | `test_agregar_medicamento.py` |
| Mediplanner Android | Medicinas | `test_medicinas.py` |
| Mediplanner Android | Consultas / Citas | `test_consultas.py` |
| Mediplanner Android | Estudios | `test_estudios.py` |
| Mediplanner Android | Médicos — Filtros | `test_medicos_filtros.py` |
| Mediplanner Android | Dependientes | `test_dependientes.py` |
| Mediplanner Android | Perfil | `test_perfil.py` |

---

## 7. Anexos

*(No aplica en la versión actual del reporte. Insertar capturas de pantalla o evidencia de ejecución de cada test.)*

| Test | Archivo | Screenshot |
|---|---|---|
| test_basico | `test_basico.py` | — |
| test_volver_inicio | `test_volver_inicio.py` | — |
| test_home | `test_home.py` | — |
| test_medicamento | `test_medicamento.py` | `04_medicamento_registrado.png` |
| test_agregar_medicamento | `test_agregar_medicamento.py` | — |
| test_medicinas | `test_medicinas.py` | — |
| test_consultas | `test_consultas.py` | — |
| test_estudios | `test_estudios.py` | — |
| test_medicos_filtros | `test_medicos_filtros.py` | — |
| test_dependientes | `test_dependientes.py` | — |
| test_perfil | `test_perfil.py` | — |

---

## 8. Resumen

**Cobertura funcional de Mediplanner Android — 12 archivos de test, 11 módulos cubiertos**

La suite automatizada cubre los flujos principales de la aplicación: navegación, registro de toma de medicamentos, gestión de citas, administración de dependientes, perfil de usuario, filtros de médicos, y visualización de estudios y medicinas. Todos los tests están corregidos y pasan individualmente. Queda pendiente la ejecución de la suite completa en orden para verificar ausencia de interferencias entre tests.
