# Reporte de Tests - Módulo Perfil (Mediplanner)

**Fecha de ejecución:** 20 de Abril de 2026  
**Total de tests ejecutados:** 6  
**Resultado:** 6/6 exitosos (100%)

---

## 1. test_perfil_datos_personales

### Descripción
Test de validación de datos personales del usuario. Verifica las validaciones de campos obligatorios y formatos correctos.

### Flujo de prueba
1. Navegar a Perfil → Datos Personales
2. Limpiar campo Nombre
3. Limpiar campo Apellido
4. Verificar que botón "Siguiente" está deshabilitado
5. Ingresar nombre y apellido válidos
6. **Pruebas de CURP:**
   - Probar 18 letras → botón deshabilitado
   - Probar 18 números → botón deshabilitado
   - CURP válida → botón habilitado
7. Click en "Siguiente"
8. **Pruebas de Correo:**
   - Sin @ → botón deshabilitado
   - Sin dominio → botón deshabilitado
   - Con espacios → botón deshabilitado
   - Correo válido restaurado
9. **Pruebas de Teléfono:**
   - Con letras → botón deshabilitado
   - 11 dígitos → botón deshabilitado
   - Teléfono válido restaurado
10. Click en "Guardar y Continuar"

### Resultado
✅ **PASSED** - Tiempo: 36 segundos

---

## 2. test_perfil_cuenta

### Descripción
Test de gestión de suscripción y cuenta. Verifica las opciones de planes, ciclo de facturación y cancelación.

### Flujo de prueba
1. Navegar a Perfil → Cuenta
2. Click en "Ver todos los planes"
   - Verificar que aparecen planes disponibles (4 encontrados)
3. Scroll down → Click "Cambiar ciclo de facturación"
   - Click "Guardar cambios"
4. Scroll down → Click "Cancelar suscripción"
   - Click "Mantener Suscripción" para cancelar operación

### Resultado
✅ **PASSED** - Tiempo: 54 segundos

---

## 3. test_perfil_compartir

### Descripción
Test de compartición de documentos con contactos. Verifica permisos de compartir y validación de teléfono.

### Flujo de prueba
1. Navegar a Perfil → Compartir
2. Verificar sección "Compartido Parcialmente"
3. Click en contacto "Pedro Quijada Anaya"
   - Verificar switches: Medicamentos ON, Estudios ON, Documentos ON
4. Click en botón añadir (+) para agregar nuevo contacto
5. Click "Añadir manualmente"
6. **Pruebas de validación de teléfono:**
   - Ingresar nombre: "Juan Perez"
   - 10 letras → Invitar deshabilitado
   - 9 dígitos → Invitar deshabilitado
   - 10 dígitos válidos → Invitar habilitado
7. Click "Invitar y Compartir"
8. Click "Listo"

### Resultado
✅ **PASSED** - Tiempo: 47 segundos

---

## 4. test_perfil_progreso

### Descripción
Test de seguimiento de progreso y insignias. Verifica secciones de logros y medicamentos.

### Flujo de prueba
1. Navegar a Perfil → Progreso
2. Click en "Retos"
   - Verificar "Insignias obtenidas"
3. Click en badge "Cliente #1"
4. Regresar a Progreso
5. Scroll down → Click "Medicamentos"
6. Regresar a Inicio
7. Navegar a Perfil

### Resultado
✅ **PASSED** - Tiempo: 59 segundos

---

## 5. test_perfil_historial_medico

### Descripción
Test completo de historial médico. Verifica todas las secciones de antecedentes médicos.

### Flujo de prueba
1. Navegar a Perfil → Historial Médico

2. **Antecedentes patológicos:**
   - Click en sección
   - Click "Formulario"
   - Seleccionar opción "Asma"
   - Click "Enviar Reporte"
   - Cerrar dropdown

3. **Antecedentes Heredofamiliares:**
   - Scroll down
   - Click en sección
   - Click "Formulario"
   - Seleccionar opción "Miopía"
   - Click "Enviar Reporte"
   - Cerrar dropdown

4. **Alergias:**
   - Scroll down
   - Click en sección
   - Click "Formulario"
   - Eliminar alergia existente (si hay)
   - Agregar alergia aleatoria (seleccionado: random de 20 opciones)
   - Click "Agregar"
   - Cerrar dropdown

5. **Antecedentes Gineco-Obstétricos:**
   - Scroll down
   - Click en sección
   - Click "Formulario"
   - Click "Planificación" → seleccionar "No"
   - Click "Embarazos" → seleccionar "No"
   - Click "Citologías" → seleccionar "No"
   - Click "Enviar Reporte"

### Resultado
✅ **PASSED** - Tiempo: 94 segundos

---

## 6. test_perfil_documentos

### Descripción
Test de carga de documentos. Verifica el flujo completo para agregar documentos con archivo.

### Flujo de prueba
1. Navegar a Perfil → Documentos
2. Click en botón "+" (Agregar documento)
3. Ingresar nombre de documento (seleccionado aleatoriamente de 8 opciones)
4. Ingresar comentario (seleccionado aleatoriamente de 5 opciones)
5. Click en "Tomar foto o seleccionar archivo"
6. Click "Seleccionar Archivo (Foto o PDF)"
7. Seleccionar archivo de Recientes
8. Click "Guardar"

### Resultado
✅ **PASSED** - Tiempo: 45 segundos

---

## Resumen Ejecutivo

| Test | Estado | Tiempo |
|------|--------|--------|
| test_perfil_datos_personales | ✅ PASSED | 36s |
| test_perfil_cuenta | ✅ PASSED | 54s |
| test_perfil_compartir | ✅ PASSED | 47s |
| test_perfil_progreso | ✅ PASSED | 59s |
| test_perfil_historial_medico | ✅ PASSED | 94s |
| test_perfil_documentos | ✅ PASSED | 45s |

**Total:** 6 tests ejecutados  
**Éxito:** 6/6 (100%)  
**Tiempo total:** 5 minutos 35 segundos

---

## Notas

- Los tests utilizan selectores XPath exactos con bounds para mayor reliability
- Se implementan esperas explícitas entre interacciones para evitar errores de sincronización
- La selección aleatoria de datos (alergias, nombres de documentos) permite pruebas más diversas
- El servidor Appium puede presentar errores ocasionales ("instrumentation process not running") que requieren reinicio del servidor

---

*Reporte generado automáticamente el 20 de Abril de 2026*