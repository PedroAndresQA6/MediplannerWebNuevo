from fpdf import FPDF

class ReportePDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Reporte de Tests - Modulo Basico (Mediplanner)', 0, 1, 'C')
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
        self.cell(80, 8, 'Test', 1, 0, 'C', 1)
        self.cell(40, 8, 'Resultado', 1, 0, 'C', 1)
        self.cell(40, 8, 'Tiempo', 1, 1, 'C', 1)
        self.set_font('Arial', '', 10)
        for test, result, time in data:
            self.cell(80, 8, test, 1, 0, 'L')
            self.cell(40, 8, result, 1, 0, 'C')
            self.cell(40, 8, time, 1, 1, 'C')
        self.ln(5)

pdf = ReportePDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 15)
pdf.cell(0, 10, 'Reporte de Tests - Modulo Basico (Mediplanner)', 0, 1, 'C')
pdf.cell(0, 8, 'Fecha de ejecucion: 21 de Abril de 2026', 0, 1, 'C')
pdf.cell(0, 8, 'Total de tests ejecutados: 3', 0, 1, 'C')
pdf.cell(0, 8, 'Resultado: 3/3 exitosos (100%)', 0, 1, 'C')
pdf.ln(10)

pdf.chapter_title('1. test_login')
pdf.chapter_body('''Descripcion: Test de inicio de sesion. Verifica el flujo de login en la aplicacion.

Flujo de prueba:
1. Abrir aplicacion MediPlanner
2. Ingresar credenciales (email y password)
3. Click en boton de iniciar sesion
4. Verificar que el login fue exitoso

Resultado: PASSED - Tiempo: N/A''')

pdf.chapter_title('2. test_navegacion_tabs')
pdf.chapter_body('''Descripcion: Test de navegacion entre pestañas. Verifica que se puede navegar correctamente entre todas las pestañas de la aplicacion.

Flujo de prueba:
1. Verificar que el usuario este logueado
2. Navegar a Inicio
3. Navegar a Pestana Medicos
4. Navegar a Pestana Consultas
5. Navegar a Pestana Medicinas
6. Navegar a Pestana Estudios
7. Regresar a Inicio

Resultado: PASSED - Tiempo: N/A''')

pdf.chapter_title('3. test_doctor_search')
pdf.chapter_body('''Descripcion: Test de busqueda de doctores. Verifica la funcionalidad de busqueda por nombre de doctor.

Flujo de prueba:
1. Navegar a pestana Medicos
2. Ingresar nombre de doctor en campo de busqueda
3. Verificar resultados de busqueda
4. Seleccionar un doctor de los resultados
5. Ver detalles del doctor

Resultado: PASSED - Tiempo: N/A''')

pdf.add_page()
pdf.chapter_title('Resumen Ejecutivo')
data = [
    ('test_login', 'PASSED', 'N/A'),
    ('test_navegacion_tabs', 'PASSED', 'N/A'),
    ('test_doctor_search', 'PASSED', 'N/A'),
]
pdf.add_result_table(data)
pdf.set_font('Arial', 'B', 11)
pdf.cell(0, 8, 'Total: 3 tests ejecutados', 0, 1, 'C')
pdf.cell(0, 8, 'Exito: 3/3 (100%)', 0, 1, 'C')
pdf.cell(0, 8, 'Tiempo total: 72 segundos', 0, 1, 'C')

output_path = r"C:\Users\carlo\OneDrive\00_Pedro_Quijada\03_RYM-Solutions\Mediplaner\VS Code testing\MediplannerAppiumAutomation\Appium\reports\Reportes PDFs\reporte_tests_basico.pdf"
pdf.output(output_path)
print(f"PDF generado: {output_path}")
