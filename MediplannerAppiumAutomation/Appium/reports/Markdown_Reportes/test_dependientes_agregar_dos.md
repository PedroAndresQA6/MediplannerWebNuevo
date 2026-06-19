# Reporte Individual de Test
**Test:** test_dependientes_agregar_dos  
**Fecha:** 22/04/2026  
**Resultado:** ✅ PASSED  
**Tiempo:** ~110 segundos

---

## Descripción
Test de creación de dos dependientes desde el perfil de un dependiente. Verifica que se pueda agregar un segundo dependiente después de seleccionar el perfil.

## Flujo Ejecutado
1. Abrir formulario de agregar dependiente
2. Llenar formulario Dependiente 1:
   - Nombre (aleatorio)
   - Apellidos: Garcia Perez
   - Fecha: 15/08/1990
   - Sexo y Parentesco (aleatorios)
3. Click "Continuar" → Dependiente 1 creado
4. Abrir formulario de agregar dependiente
5. Seleccionar perfil del dependiente (Dependiente 1)
6. Llenar formulario Dependiente 2:
   - Nombre (aleatorio diferente)
   - Apellidos: Garcia Perez
   - Fecha: 15/08/1990
   - Sexo y Parentesco (aleatorios)
7. Click "Continuar" → Dependiente 2 creado

## Datos Generados (ejemplo)
- Dependiente 1: Aleatorio de lista
- Dependiente 2: Aleatorio de lista (diferente)

## Arquitectura de Tests
El test utiliza funciones helper reutilizables:
- `_abrir_formulario_agregar_dependiente()`: Abre el formulario
- `_completar_formulario_dependiente()`: Llena y envía
- `_seleccionar_perfil_dependiente()`: Selecciona perfil

## Resultado
✅ PASSED - Dos dependientes creados exitosamente

---

*Reporte generado automáticamente - 22 Abril 2026*