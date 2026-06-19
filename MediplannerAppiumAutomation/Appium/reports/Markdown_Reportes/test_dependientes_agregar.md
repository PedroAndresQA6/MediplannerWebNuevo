# Reporte Individual de Test
**Test:** test_dependientes_agregar  
**Fecha:** 22/04/2026  
**Resultado:** ✅ PASSED  
**Tiempo:** ~110 segundos

---

## Descripción
Test de creación de nuevo dependiente. Verifica el flujo completo de agregar un dependiente desde el menú de perfil.

## Flujo Ejecutado
1. Abrir menú de perfil
2. Click en "Agregar dependiente"
3. Llenar formulario:
   - Nombre (aleatorio: hombre o mujer)
   - Apellido paterno: Garcia
   - Apellido materno: Perez
   - Fecha nacimiento: 15/08/1990
   - Sexo (Masculino/Femenino según nombre)
   - Parentesco (aleatorio)
4. Click "Continuar" → Dependent creado

## Datos Generados (ejemplo)
- Nombre: Aleatorio de lista predefinida
- Apellidos: Garcia Perez (fijos)
- Fecha: 15/08/1990
- Sexo: Basado en nombre elegido
- Parentesco: Aleatorio (Hijo(a), Padre, Madre, etc.)

## Resultado
✅ PASSED - Dependiente creado exitosamente

---

*Reporte generado automáticamente - 22 Abril 2026*