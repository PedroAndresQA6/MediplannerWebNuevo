from fpdf import FPDF
import os

class ReportePDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Reporte de Test - Mediplaner', 0, 1, 'C')
        self.ln(5)

output_path = r"C:\Users\carlo\OneDrive\00_Pedro_Quijada\03_RYM-Solutions\Mediplaner\VS Code testing\MediplannerAppiumAutomation\Appium\reports\Reportes PDFs\test_agregar_medicamento_personal.pdf"

pdf = ReportePDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_agregar_medicamento_personal', 0, 1, 'L')
pdf.set_font('Arial', '', 11)
pdf.cell(0, 8, 'Resultado: PASSED', 0, 1, 'L')
pdf.cell(0, 8, 'Tiempo: 44 segundos', 0, 1, 'L')
pdf.cell(0, 8, 'Fecha: 23/04/2026', 0, 1, 'L')
pdf.ln(5)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Descripcion:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, 'Test de automatizacion para agregar un medicamento personal en la app Mediplaner. El flujo cubre toda la secuencia de registro: busqueda de medicamento, seleccion de presentacion, unidad, via de administracion, frecuencia, dosis y duracion del tratamiento.')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Flujo Ejecutado:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '1. Navegar a pestana Medicinas\n2. Click en boton Agregar\n3. Ingresar nombre del medicamento (aleatorio)\n4. Seleccionar medicamento de la lista\n5. Seleccionar presentacion (Tabletas/Suspension/Capsulas/Ampolleta)\n6. Seleccionar unidad de dosis (miligramos/mililitros/gotas)\n7. Seleccionar via de administracion (scroll)\n8. Seleccionar frecuencia (Una vez al dia)\n9. Ajustar dosis de forma coherente con unidad seleccionada\n10. Click en Siguiente\n11. Establecer duracion del tratamiento\n12. Seleccionar fecha de inicio\n13. Seleccionar duracion del tratamiento\n14. Click en Finalizar')
pdf.ln(3)
pdf.set_font('Arial', 'B', 12)
pdf.cell(0, 8, 'Logica Implementada:', 0, 1, 'L')
pdf.set_font('Arial', '', 10)
pdf.multi_cell(0, 5, '- Seleccion aleatoria de presentacion y unidad\n- Memoria de seleccion para dosis coherente:\n  * miligramos: 500-1000mg\n  * mililitros: 5-15ml\n  * gotas: 10-20 gotas')

pdf.output(output_path)
print(f"Generado: {output_path}")