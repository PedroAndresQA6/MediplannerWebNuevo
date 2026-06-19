from fpdf import FPDF
import os

# Portada e Indice
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 15)
pdf.cell(0, 10, 'Directorio de Tests - Mediplaner Appium', 0, 1, 'C')
pdf.ln(10)

pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Descripcion del Documento', 0, 1, 'L')
pdf.ln(5)
pdf.set_font('Arial', '', 10)
descripcion = '''Este documento contiene el directorio completo de pruebas automatizadas (tests) 
desarrolladas para la aplicacion Mediplaner utilizando Appium y Python.

Cada test esta documentado con su descripcion y el flujo de pasos que ejecuta durante 
su ejecucion. Este directorio sirve como referencia para entender que funcionalidades 
estan siendo probadas y como es el proceso de prueba en cada caso.

Las pruebas cubren las siguientes areas de la aplicacion:
- Login y autenticacion
- Navegacion entre pestanas
- Gestion de medicamentos (tomas, registro, no tomados)
- Lista de medicamentos y detalles
- Filtros de medicos (especialidad, estado)
- Perfil de usuario (datos personales, cuenta, historial medico, 
  progreso, documentos, compartir)
- Gestion de dependientes (agregar, desvincular)
- Consultas (programadas, previas)
- Estudios medicos
'''
pdf.multi_cell(0, 5, descripcion)
pdf.ln(10)

# Indice
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Indice de Tests', 0, 1, 'L')
pdf.ln(5)
pdf.set_font('Arial', '', 10)

indice = [
    ('test_login', 'Test de flujo basico de login'),
    ('test_navegacion_tabs', 'Test de navegacion entre todas las pestanas'),
    ('test_doctor_search', 'Test de busqueda de doctores por nombre'),
    ('test_home_medicamento_no_tomado', 'Test para marcar un medicamento como NO TOMADO'),
    ('test_medicamento_registro_de_toma', 'Test para registrar la toma de un medicamento'),
    ('test_medicinas_ver_lista_detalles', 'Test para ver la lista de medicamentos'),
    ('test_perfil_datos_personales', 'Test de validacion de datos personales'),
    ('test_perfil_cuenta', 'Test de gestion de suscripcion y cuenta'),
    ('test_perfil_historial_medico', 'Test completo de historial medico'),
    ('test_perfil_progreso', 'Test de seguimiento de progreso e insignias'),
    ('test_perfil_documentos', 'Test de carga de documentos'),
    ('test_perfil_compartir', 'Test de comparticion con contactos'),
    ('test_dependientes_agregar', 'Test para agregar un nuevo dependiente'),
    ('test_dependientes_desvincular', 'Test para desvincular cotitular'),
    ('test_dependientes_agregar_dos', 'Test para agregar dos dependientes'),
    ('test_consultas_programadas', 'Test de consultas programadas'),
    ('test_consultas_previas', 'Test de consultas previas'),
    ('test_estudios_ver_lista_detalles', 'Test de estudios medicos'),
    ('test_medicos_flujo_completo', 'Test completo de filtros de medicos'),
    ('test_volver_inicio', 'Test simple para navegar a Inicio'),
]

pagina_actual = 3
for test, desc in indice:
    pdf.cell(0, 7, f'{pagina_actual:2d}. {test}', 0, 1, 'L')
    pagina_actual += 1

pdf.ln(10)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Total de Tests: 19', 0, 1, 'L')


# Segunda parte - Tests
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_login', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de flujo basico de login en la aplicacion.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Tomar screenshot inicial\n2. Ejecutar iniciar_sesion con email y password\n3. Esperar 3 segundos\n4. Tomar screenshot final')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_navegacion_tabs', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de navegacion entre todas las pestanas de la aplicacion.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Verificar si ya esta logueado, si no hacer login\n2. Tomar screenshot en Inicio\n3. Navegar a Medicos\n4. Navegar a Consultas\n5. Navegar a Medicinas\n6. Navegar a Estudios\n7. Regresar a Inicio')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_doctor_search', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de busqueda de doctores por nombre.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Verificar si ya esta logueado, si no hacer login\n2. Navegar pestana Medicos\n3. Buscar doctor por nombre "Fernando"\n4. Tomar screenshot')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_home_medicamento_no_tomado', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para marcar un medicamento como NO TOMADO con comentario.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Volver a Inicio\n2. Scroll hacia abajo 5 veces\n3. Buscar ultimo medicamento\n4. Click en el medicamento\n5. Click en boton "No Tomado"\n6. Ingresar comentario aleatorio\n7. Click en boton Aceptar')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_medicamento_registro_de_toma', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para registrar la toma de un medicamento con emoji y comentario.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Volver a Inicio\n2. Scroll hacia abajo para encontrar medicamentos\n3. Click en el ultimo medicamento\n4. Click en boton "Tomado"\n5. Seleccionar emoji aleatorio\n6. Ingresar comentario\n7. Click en "Registrar toma"')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_medicinas_ver_lista_detalles', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para ver la lista de medicamentos y sus detalles.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Volver a Inicio\n2. Navegar a pestana Medicinas\n3. Buscar medicamentos con content-desc que contenga mg o ml\n4. Mostrar informacion de las primeras 3 medicines\n5. Click en la ultima medicina\n6. Verificar detalles de medicina (Dosis, Frecuencia, Duracion, Instrucciones)\n7. Regresar a lista de medicines')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_perfil_datos_personales', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de validacion de datos personales del usuario.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Navegar a Perfil\n2. Click en Datos Personales\n3. Obtener valores originales de Nombre, Apellido, CURP\n4. Re-ingresar Nombre y Apellido\n5. Pruebas de validacion CURP (puras letras, puras numeros)\n6. Click en Siguiente (Datos de Contacto)\n7. Scroll para ver correo y telefono\n8. Pruebas de correo (sin @, sin dominio)\n9. Pruebas de telefono (con letras)\n10. Click en Guardar y Continuar')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_perfil_cuenta', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de gestion de suscripcion y cuenta.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Navegar a Perfil\n2. Click en Cuenta\n3. Scroll para ver opciones\n4. Click en "Ver todos los planes"\n5. Verificar planes (buscar $)\n6. Cerrar\n7. Click en "Cambiar ciclo de facturacion"\n8. Click en Guardar cambios\n9. Regresar\n10. Click en "Cancelar suscripcion"\n11. Click en "Mantener Suscripcion"')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_perfil_historial_medico', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test completo de historial medico con antecedentes.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Navegar a Perfil\n2. Click en menu\n3. Click en Historial Medico\n4. Click en Antecedentes patologicos\n5. Click en Formulario\n6. Seleccionar opcion (Asma)\n7. Click en Enviar Reporte\n8. Click boton atras\n9. Cerrar dropdown\n10. Scroll down\n11. Click en Antecedentes Heredofamiliares\n12. Seleccionar opcion (Miopia)\n13. Enviar Reporte\n14. Scroll down\n15. Click en Alergias\n16. Eliminar allergy existente\n17. Agregar nueva alergia aleatoria\n18. Enviar\n19. Click en Antecedentes Gineco-Obstetricos\n20. Toggle opciones -> No\n21. Enviar Reporte\n22. Regresar a Perfil')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_perfil_progreso', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de seguimiento de progreso e insignias.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Navegar a Perfil usando swipe\n2. Scroll para ver Progreso\n3. Click en Progreso\n4. Click en Retos\n5. Verificar insignias obtenidas\n6. Click en insignia\n7. Regresar a Retos\n8. Regresar a Progreso\n9. Scroll para ver Medicamentos\n10. Click en Medicamentos\n11. Click en pestana Inicio')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_perfil_documentos', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de carga de documentos con archivo.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Navegar a Perfil\n2. Click en menu\n3. Click en Documentos\n4. Click en boton agregar documento\n5. Ingresar nombre aleatorio\n6. Ingresar comentario aleatorio\n7. Click en "Tomar foto o seleccionar archivo"\n8. Click en "Seleccionar Archivo"\n9. Seleccionar archivo del explorador\n10. Click en Guardar\n11. Regresar a Perfil')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_perfil_compartir', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de comparticion de documentos con contactos.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Navegar a Perfil\n2. Click en menu\n3. Click en Compartir\n4. Verificar "Compartido Parcialmente"\n5. Click en contacto existente\n6. Verificar switches\n7. Regresar\n8. Click en boton agregar\n9. Click en "Anadir manualmente"\n10. Validaciones de telefono\n11. Click en "Invitar y compartir"\n12. Click en "Listo"')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_dependientes_agregar', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para agregar un nuevo dependiente.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Click en menu de perfil\n2. Click en "Agregar dependiente"\n3. Generar nombre aleatorio\n4. Ingresar nombre\n5. Ingresar apellido paterno\n6. Ingresar apellido materno\n7. Click en campo fecha\n8. Seleccionar ano 1990\n9. Seleccionar dia 15\n10. Click en ACEPTAR\n11. Seleccionar sexo\n12. Seleccionar parentesco aleatorio\n13. Click en Continuar')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_dependientes_desvincular', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para desvincular cotitular y cerrar sesion.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Click en menu de perfil\n2. Click en dependiente\n3. Click en menu de perfil\n4. Click en Compartir\n5. Verificar si hay popup de acceso\n6. Click en cotitular\n7. Click en Desvincular\n8. Confirmar desvincular\n9. Click boton atras\n10. Scroll down\n11. Click en Cerrar sesion\n12. Confirmar cerrar sesion\n13. Hacer login con nueva cuenta')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_dependientes_agregar_dos', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para agregar dos dependientes desde perfil de dependiente.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Generar nombre aleatorio 1\n2. Abrir formulario agregar dependiente\n3. Completar formulario dependiente 1\n4. Abrir formulario nuevamente\n5. Seleccionar perfil dependiente\n6. Completar formulario dependiente 2\n7. Verificar ambos creados')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_consultas_programadas', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para ver consultas programadas, confirmar cita o agendar nueva.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Volver a Inicio\n2. Navegar a pestana Consultas\n3. Asegurar pestana Programadas\n4. Scroll para ver citas\n5. Buscar cita "Agendada"\n6. Click en cita agendada\n7. Click en Confirmar en modal\n8. Si no hay cita agendada, navegar a Medicos\n9. Seleccionar doctor\n10. Click en Solicitar cita\n11. Seleccionar tipo de consulta\n12. Seleccionar fecha\n13. Seleccionar horario\n14. Click en Solicitar cita\n15. Regresar a Consultas y confirmar nueva cita')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_consultas_previas', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para ver consultas previas con estado Terminada.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Navegar a Consultas -> Previas\n2. Buscar citas con estado "Terminada"\n3. Click en cita terminada\n4. Cambiar a pestana Receta\n5. Click en "Iniciar tratamiento" si existe\n6. Regresar a detalles\n7. Cambiar a pestana Exploracion\n8. Cambiar a pestana Estudios\n9. Click en "Cargar resultados"\n10. Click en Siguiente (date picker)\n11. Click en "Tomar foto o seleccionar archivo"\n12. Click en Galeria\n13. Seleccionar imagen\n14. Escribir descripcion\n15. Click en Finalizar')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_estudios_ver_lista_detalles', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test para ver lista de estudios y detalles, agregar nuevo estudio.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Esperar a que la app este lista\n2. Navegar a pestana Estudios\n3. Buscar estudios\n4. Mostrar informacion de estudios encontrados\n5. Seleccionar estudio aleatorio\n6. Click en estudio para ver detalles\n7. Verificar detalles\n8. Regresar a lista\n9. Click en boton + para agregar estudio\n10. Buscar estudio por palabra clave aleatoria\n11. Seleccionar resultado\n12. Click en Siguiente\n13. Click en "Tomar foto o seleccionar archivo"\n14. Seleccionar archivo\n15. Click en Siguiente\n16. Escribir comentarios\n17. Click en Finalizar\n18. Buscar estudio registrado\n19. Verificar estudio\n20. Regresar a Inicio')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_medicos_flujo_completo', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test completo de filtros por especialidad y estado.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Seleccionar especialidad aleatoria\n2. Volver a Inicio\n3. Navegar a pestana Medicos\n4. Resetear filtros inicial\n5. Abrir modal de filtros\n6. Ingresar texto de especialidad\n7. Click en Buscar\n8. Entrar en perfil de doctor\n9. Resetear filtros\n10. Aplicar filtro por estado Queretaro\n11. Entrar en perfil de doctor\n12. Resetear filtros\n13. Abrir modal\n14. Aplicar filtro texto + estado\n15. Entrar en perfil de doctor\n16. Resetear filtros final')

pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_volver_inicio', 0, 1, 'L')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test simple para navegar a la pantalla de Inicio.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo de Pasos:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Ejecutar funcion volver_inicio()\n2. Tomar screenshot')

# Guardar PDF
output = r"C:\Users\carlo\OneDrive\00_Pedro_Quijada\03_RYM-Solutions\Mediplaner\VS Code testing\MediplannerAppiumAutomation\Appium\reports\Reportes PDFs\directorio_tests.pdf"
pdf.output(output)
print(f"Generado: {output}")
print(f"Paginas totales: {pdf.page_no()}")