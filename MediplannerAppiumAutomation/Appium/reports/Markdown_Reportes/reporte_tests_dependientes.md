# Reporte de Tests - Módulo Dependientes (Mediplanner)

**Fecha de ejecución:** 22 de Abril de 2026  
**Total de tests ejecutados:** 3  
**Resultado:** 3/3 exitosos (100%)

---

## 1. test_dependientes_agregar

### Descripción
Test de creación de nuevo dependiente. Verifica el flujo completo de agregar un dependiente desde el menú de perfil.

### Flujo de prueba
1. Navegar a Perfil → Agregar dependiente
2. Llenar formulario:
   - Nombre (aleatorio: hombre o mujer)
   - Apellido paterno: Garcia
   - Apellido materno: Perez
   - Fecha nacimiento: 15/08/1990
   - Sexo (Masculino/Femenino según nombre)
   - Parentesco (aleatorio: Hijo(a), Padre, Madre, etc.)
3. Click "Continuar"

### Resultado
✅ **PASSED** - Tiempo: ~110 segundos

---

## 2. test_dependientes_desvincular

### Descripción
Test de desvinculación de cotitular y cierre de sesión con re-login. Verifica que se pueda desvincular un dependiente y volver a la cuenta principal.

### Flujo de prueba
1. Navegar a Perfil → Dependiente → Menú (⋮)
2. Ir a Compartir
3. Manejar popup "Desbloquea acceso completo" (si aparece)
4. Seleccionar cotitular → Click "Desvincular"
5. Confirmar desvinculación
6. Volver al perfil → Scroll up → "Cerrar sesión"
7. Confirmar cierre de sesión
8. Re-ingresar credenciales: luis.morenoramos@icloud.com
9. Click "Entrar a Mediplanner"

### Resultado
✅ **PASSED** - Tiempo: ~55-101 segundos

---

## 3. test_dependientes_agregar_dos

### Descripción
Test de creación de dos dependientes desde el perfil de un dependiente. Verifica que se pueda agregar un segundo dependiente después de seleccionar el perfil primero.

### Flujo de prueba
1. Abrir formulario de agregar dependiente
2. Crear Dependiente 1 (nombre aleatorio)
3. Abrir formulario de agregar dependiente
4. Seleccionar perfil del Dependiente 1
5. Crear Dependiente 2 (nombre aleatorio diferente)

### Arquitectura de Tests
El test utiliza funciones helper reutilizables:
- `_abrir_formulario_agregar_dependiente()`: Abre el formulario
- `_completar_formulario_dependiente()`: Llena y envía
- `_seleccionar_perfil_dependiente()`: Selecciona perfil

### Resultado
✅ **PASSED** - Tiempo: ~110 segundos

---

## Resumen Ejecutivo

| Test | Estado | Tiempo |
|------|--------|--------|
| test_dependientes_agregar | ✅ PASSED | ~110s |
| test_dependientes_desvincular | ✅ PASSED | ~55-101s |
| test_dependientes_agregar_dos | ✅ PASSED | ~110s |

**Total:** 3 tests ejecutados  
**Éxito:** 3/3 (100%)  
**Tiempo total:** ~4-5 minutos

---

## Notas

- Los tests utilizan selectores XPath exactos con bounds para mayor estabilidad
- Se implementan esperas explícitas (time.sleep) entre interacciones
- La selección aleatoria de nombres y parentescos permite pruebas más diversas
- El test_dependientes_agregar_dos usa funciones helper para código reutilizable
- El test_dependientes_desvincular incluye flujo completo de re-login

---

*Reporte generado automáticamente el 22 de Abril de 2026*