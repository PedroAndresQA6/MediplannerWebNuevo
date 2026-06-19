from fpdf import FPDF
import os

base_path = r"C:\Users\pandr\OneDrive\00_Pedro_Quijada\03_RYM-Solutions\Mediplaner\VS Code testing\MediplannerAppiumAutomation\Appium\reports\Reportes PDFs"

# Test FAILED: test_basico (SKIPPED)
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_basico', 0, 1, 'L')
pdf.set_font('Arial', '', 11)
pdf.cell(0, 8, 'Result: SKIPPED', 0, 1, 'L')
pdf.cell(0, 8, 'Reason: Sin permisos', 0, 1, 'L')
pdf.output(f"{base_path}\\test_basico.pdf")
print("Generado: test_basico.pdf")

# Test FAILED: test_home_medicamento_no_tomado
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_home_medicamento_no_tomado', 0, 1, 'L')
pdf.set_font('Arial', '', 11)
pdf.cell(0, 8, 'Result: FAILED', 0, 1, 'L')
pdf.cell(0, 8, 'Error: NoSuchElementError', 0, 1, 'L')
pdf.cell(0, 8, 'Needs fix: XPath boton Registrar', 0, 1, 'L')
pdf.output(f"{base_path}\\test_home_medicamento_no_tomado.pdf")
print("Generado: test_home_medicamento_no_tomado.pdf")

# Test FAILED: test_estudios_ver_lista_detalles
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_estudios_ver_lista_detalles', 0, 1, 'L')
pdf.set_font('Arial', '', 11)
pdf.cell(0, 8, 'Result: FAILED', 0, 1, 'L')
pdf.cell(0, 8, 'Error: Appium crash', 0, 1, 'L')
pdf.output(f"{base_path}\\test_estudios_ver_lista_detalles.pdf")
print("Generado: test_estudios_ver_lista_detalles.pdf")

# Test FAILED: test_medicamento
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_medicamento', 0, 1, 'L')
pdf.set_font('Arial', '', 11)
pdf.cell(0, 8, 'Result: FAILED', 0, 1, 'L')
pdf.cell(0, 8, 'Error: NoSuchElementError', 0, 1, 'L')
pdf.output(f"{base_path}\\test_medicamento.pdf")
print("Generado: test_medicamento.pdf")

# Test FAILED: test_consultas_programadas
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_consultas_programadas', 0, 1, 'L')
pdf.set_font('Arial', '', 11)
pdf.cell(0, 8, 'Result: FAILED', 0, 1, 'L')
pdf.cell(0, 8, 'Error: Appium crash', 0, 1, 'L')
pdf.output(f"{base_path}\\test_consultas_programadas.pdf")
print("Generado: test_consultas_programadas.pdf")

# Test FALTANTE: test_medicinas
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_medicinas', 0, 1, 'L')
pdf.set_font('Arial', '', 11)
pdf.cell(0, 8, 'Result: PENDING', 0, 1, 'L')
pdf.cell(0, 8, 'Not executed yet', 0, 1, 'L')
pdf.output(f"{base_path}\\test_medicinas.pdf")
print("Generado: test_medicinas.pdf")

# Test FALTANTE: test_volver_inicio
pdf = FPDF()
pdf.add_page()
pdf.set_font('Arial', 'B', 14)
pdf.cell(0, 10, 'Test: test_volver_inicio', 0, 1, 'L')
pdf.set_font('Arial', '', 11)
pdf.cell(0, 8, 'Result: PENDING', 0, 1, 'L')
pdf.cell(0, 8, 'Not executed yet', 0, 1, 'L')
pdf.output(f"{base_path}\\test_volver_inicio.pdf")
print("Generado: test_volver_inicio.pdf")

print("=== PDFReports adicionales generados ===")