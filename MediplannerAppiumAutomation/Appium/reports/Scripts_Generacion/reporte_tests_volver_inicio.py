from fpdf import FPDF

class ReportePDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Reporte de Tests - Volver a Inicio (Mediplanner)', 0, 1, 'C')
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
pdf.cell(0, 10, 'Reporte de Tests - Volver a Inicio (Mediplanner)', 0, 1, 'C')
pdf.cell(0, 8, 'Fecha de ejecucion: 21 de Abril de 2026', 0, 1, 'C')
pdf.cell(0, 8, 'Total de tests ejecutados: 1', 0, 1, 'C')
pdf.cell(0, 8, 'Resultado: 1/1 exitosos (100%)', 0, 1, 'C')
pdf.ln(10)

pdf.chapter_title('1. test_volver_inicio')
pdf.chapter_body('''Descripcion: Test simple de navegacion a Inicio. Verifica que se puede navegar correctamente a la pantalla de inicio.

Flujo de prueba:
1. Ejecutar funcion volver_inicio
2. Verificar que la navegacion fue exitosa
3. Tomar screenshot de confirmacion

Resultado: PASSED - Tiempo: 9 segundos''')

pdf.add_page()
pdf.chapter_title('Resumen Ejecutivo')
data = [('test_volver_inicio', 'PASSED', '9s')]
pdf.add_result_table(data)
pdf.set_font('Arial', 'B', 11)
pdf.cell(0, 8, 'Total: 1 test ejecutado', 0, 1, 'C')
pdf.cell(0, 8, 'Exito: 1/1 (100%)', 0, 1, 'C')
pdf.cell(0, 8, 'Tiempo total: 9 segundos', 0, 1, 'C')

output_path = r"C:\Users\carlo\OneDrive\00_Pedro_Quijada\03_RYM-Solutions\Mediplaner\VS Code testing\MediplannerAppiumAutomation\Appium\reports\Reportes PDFs\reporte_tests_volver_inicio.pdf"
pdf.output(output_path)
print(f"PDF generado: {output_path}")
