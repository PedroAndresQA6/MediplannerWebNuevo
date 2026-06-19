from fpdf import FPDF
import os

class ReportePDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Reporte de Tests - Modulo Perfil (Mediplanner)', 0, 1, 'C')
        self.ln(5)

    def chapter_title(self, title):
        self.set_font('Arial', 'B', 12)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 10, title, 0, 1, 'L', 1)
        self.ln(2)

    def chapter_body(self, body):
        self.set_font('Arial', '', 10)
        self.multi_cell(0, 5, body)
        self.ln()

    def add_result_table(self, data):
        self.set_font('Arial', 'B', 10)
        self.set_fill_color(180, 180, 180)
        
        # Header
        self.cell(80, 8, 'Test', 1, 0, 'C', 1)
        self.cell(40, 8, 'Resultado', 1, 0, 'C', 1)
        self.cell(40, 8, 'Tiempo', 1, 1, 'C', 1)
        
        # Data
        self.set_font('Arial', '', 10)
        for test, result, time in data:
            self.cell(80, 8, test, 1, 0, 'L')
            self.cell(40, 8, result, 1, 0, 'C')
            self.cell(40, 8, time, 1, 1, 'C')
        
        self.ln(5)

pdf = ReportePDF()
pdf.add_page()

# Title
pdf.set_font('Arial', 'B', 15)
pdf.cell(0, 10, 'Reporte de Tests - Modulo Perfil (Mediplanner)', 0, 1, 'C')
pdf.cell(0, 8, 'Fecha de ejecucion: 21 de Abril de 2026', 0, 1, 'C')
pdf.cell(0, 8, 'Total de tests ejecutados: 6', 0, 1, 'C')
pdf.cell(0, 8, 'Resultado: 6/6 exitosos (100%)', 0, 1, 'C')
pdf.ln(10)

# Test 1
pdf.chapter_title('1. test_perfil_datos_personales')
pdf.chapter_body('''Descripcion: Test de validacion de datos personales del usuario. Verifica las validaciones de campos obligatorios y formatos correctos.

Flujo de prueba:
1. Navegar a Perfil -> Datos Personales
2. Limpiar campo Nombre y Apellido
3. Verificar boton deshabilitado sin datos
4. Ingresar nombre y apellido validos
5. Pruebas de CURP (letras/numeros invalidos, formato valido)
6. Click en Siguiente
7. Pruebas de correo (sin @, sin dominio, espacios)
8. Pruebas de telefono (letras, digitos invalidos)
9. Click en Guardar y Continuar

Resultado: PASSED - Tiempo: 37 segundos''')

# Test 2
pdf.chapter_title('2. test_perfil_cuenta')
pdf.chapter_body('''Descripcion: Test de gestion de suscripcion y cuenta.

Flujo de prueba:
1. Navegar a Perfil -> Cuenta
2. Ver todos los planes (4 encontrados)
3. Cambiar ciclo de facturacion
4. Cancelar suscripcion -> Mantener

Resultado: PASSED - Tiempo: 41 segundos''')

# Test 3
pdf.chapter_title('3. test_perfil_compartir')
pdf.chapter_body('''Descripcion: Test de comparticion de documentos con contactos.

Flujo de prueba:
1. Navegar a Perfil -> Compartir
2. VerificarCompartido Parcialmente
3. Click en contactos -> Verificar switches
4. Agregar nuevo contacto
5. Validaciones de telefono (letras, 9 digitos, 10 digitos)
6. Invitar y Compartir

Resultado: PASSED - Tiempo: 43 segundos''')

# Test 4
pdf.chapter_title('4. test_perfil_progreso')
pdf.chapter_body('''Descripcion: Test de seguimiento de progreso e insignias.

Flujo de prueba:
1. Navegar a Perfil -> Progreso
2. Click en Retos -> Insignias obtenidas
3. Click en badge Cliente #1
4. Regresar -> Medicamentos
5. Regresar a Inicio

Resultado: PASSED - Tiempo: 46 segundos''')

# Test 5
pdf.chapter_title('5. test_perfil_historial_medico')
pdf.chapter_body('''Descripcion: Test completo de historial medico.

Flujo de prueba:
1. Navegar a Perfil -> Historial Medico
2. Antecedentes patologicos (Formulario -> Asma -> Enviar)
3. Antecedentes Heredofamiliares (Formulario -> Miopia -> Enviar)
4. Alergias (Formulario -> Eliminar -> Agregar aleatorio -> Enviar)
5. Gineco-Obstetricos (Formulario -> Planificacion/Embarazos/Citologias -> No -> Enviar)

Resultado: PASSED - Tiempo: 104 segundos''')

# Test 6
pdf.chapter_title('6. test_perfil_documentos')
pdf.chapter_body('''Descripcion: Test de carga de documentos.

Flujo de prueba:
1. Navegar a Perfil -> Documentos
2. Agregar documento
3. Ingresar nombre (aleatorio)
4. Ingresar comentario (aleatorio)
5. Seleccionar archivo
6. Guardar

Resultado: PASSED - Tiempo: 47 segundos''')

# Resumen
pdf.add_page()
pdf.chapter_title('Resumen Ejecutivo')
data = [
    ('test_perfil_datos_personales', 'PASSED', '37s'),
    ('test_perfil_cuenta', 'PASSED', '41s'),
    ('test_perfil_compartir', 'PASSED', '43s'),
    ('test_perfil_progreso', 'PASSED', '46s'),
    ('test_perfil_historial_medico', 'PASSED', '104s'),
    ('test_perfil_documentos', 'PASSED', '47s'),
]
pdf.add_result_table(data)

pdf.set_font('Arial', 'B', 11)
pdf.cell(0, 8, 'Total: 6 tests ejecutados', 0, 1, 'C')
pdf.cell(0, 8, 'Exito: 6/6 (100%)', 0, 1, 'C')
pdf.cell(0, 8, 'Tiempo total: 6 minutos 10 segundos', 0, 1, 'C')

# Save
output_path = r"C:\Users\carlo\OneDrive\00_Pedro_Quijada\03_RYM-Solutions\Mediplaner\VS Code testing\MediplannerAppiumAutomation\Appium\reports\Reportes PDFs\reporte_tests_perfil.pdf"
pdf.output(output_path)
print(f"PDF generado: {output_path}")