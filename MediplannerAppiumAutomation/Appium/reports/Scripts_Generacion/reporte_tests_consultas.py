from fpdf import FPDF
import os

class ReportePDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Reporte de Tests - Modulo Consultas (Mediplanner)', 0, 1, 'C')
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
pdf.cell(0, 10, 'Reporte de Tests - Modulo Consultas (Mediplanner)', 0, 1, 'C')
pdf.cell(0, 8, 'Fecha de ejecucion: 21 de Abril de 2026', 0, 1, 'C')
pdf.cell(0, 8, 'Total de tests ejecutados: 2', 0, 1, 'C')
pdf.cell(0, 8, 'Resultado: 2/2 exitosos (100%)', 0, 1, 'C')
pdf.ln(10)

pdf.chapter_title('1. test_consultas_programadas')
pdf.chapter_body('''Descripcion: Test de consultas programadas. Verifica la pestana de consultas proximas/programadas.

Flujo de prueba:
1. Navegar a Inicio -> Consultas
2. Click en pestana Programadas
3. Verificar citas encontradas
4. Seleccionar una cita
5. Ver detalles de la cita
6. Ver opciones disponibles

Resultado: PASSED - Tiempo: 36 segundos''')

pdf.chapter_title('2. test_consultas_previas')
pdf.chapter_body('''Descripcion: Test de consultas previas. Verifica la pestana de consultas previas y carga de estudios.

Flujo de prueba:
1. Navegar a Inicio -> Consultas -> Previas
2. Verificar citas encontradas (4 encontradas)
3. Seleccionar consulta Terminada
4. Navegar entre pestanas: Receta -> Exploracion -> Estudios
5. Click Cargar resultados
6. Seleccionar fecha -> Tomar foto o seleccionar archivo
7. Seleccionar imagen de galeria
8. Escribir descripcion -> Finalizar

Resultado: PASSED - Tiempo: 82 segundos''')

pdf.add_page()
pdf.chapter_title('Resumen Ejecutivo')
data = [
    ('test_consultas_programadas', 'PASSED', '36s'),
    ('test_consultas_previas', 'PASSED', '82s'),
]
pdf.add_result_table(data)

pdf.set_font('Arial', 'B', 11)
pdf.cell(0, 8, 'Total: 2 tests ejecutados', 0, 1, 'C')
pdf.cell(0, 8, 'Exito: 2/2 (100%)', 0, 1, 'C')
pdf.cell(0, 8, 'Tiempo total: 1 minuto 58 segundos', 0, 1, 'C')

output_path = r"C:\Users\carlo\OneDrive\00_Pedro_Quijada\03_RYM-Solutions\Mediplaner\VS Code testing\MediplannerAppiumAutomation\Appium\reports\Reportes PDFs\reporte_tests_consultas.pdf"
pdf.output(output_path)
print(f"PDF generado: {output_path}")