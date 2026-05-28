const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generatePDF(moduleName, sections, totalStrong, totalVulnerable) {
  const outputDir = path.join(__dirname, 'PDFs Reportes');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const safeModuleName = moduleName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const outputPath = path.join(outputDir, `reporte_errores_${safeModuleName}.pdf`);
  
  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);
  
  doc.fontSize(24).fillColor('#1a1a1a').text('REPORTE DE VALIDACIÓN', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(18).fillColor('#333').text(`MediPlanner - Módulo: ${moduleName}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#666').text('Fecha: ' + new Date().toLocaleDateString('es-MX', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  }), { align: 'center' });
  doc.moveDown(1);
  
  doc.fontSize(14).fillColor('#cc0000').text('RESUMEN EJECUTIVO', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#333');
  doc.text(`Se encontraron ${totalVulnerable} vulnerabilidades y ${totalStrong} validaciones correctas en el módulo de ${moduleName}.`);
  doc.moveDown(1);
  
  doc.fontSize(14).fillColor('#cc0000').text('RESUMEN POR SECCIÓN', { underline: true });
  doc.moveDown(0.5);
  
  doc.fontSize(11).fillColor('#333');
  sections.forEach(sec => {
    doc.text(`• ${sec.name}: ${sec.strong} validaciones correctas, ${sec.vulnerable} vulnerabilidades.`);
  });
  
  doc.moveDown(1);
  doc.fontSize(12).fillColor('#cc0000').text(`TOTAL: ${totalStrong} validaciones correctas | ${totalVulnerable} vulnerabilidades`, { align: 'center' });
  doc.moveDown(1);
  
  sections.forEach((sec, index) => {
    if (sec.details && sec.details.length > 0) {
      doc.addPage();
      doc.fontSize(14).fillColor('#cc0000').text(`${index + 1}. ${sec.name.toUpperCase()}`, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#333');
      
      sec.details.forEach(detail => {
        const estado = detail.acepto ? '❌ VULNERABLE' : '✅ PROTEGIDO';
        doc.text(`${estado} - ${detail.campo}: ${detail.tipo} (input: "${detail.valor}")`);
      });
    }
  });
  
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text('Reporte generado automáticamente por MediPlanner Automation Tests', { align: 'center' });
  
  doc.end();
  
  return new Promise((resolve) => {
    stream.on('finish', () => {
      console.log(`✅ PDF generado: ${outputPath}`);
      resolve(outputPath);
    });
  });
}

module.exports = { generatePDF };

if (require.main === module) {
  const args = process.argv.slice(2);
  const moduleName = args[0] || 'Consulta';
  
  const sections = [
    { name: 'General', vulnerable: 10, strong: 0 },
    { name: 'Exploración', vulnerable: 5, strong: 0 },
    { name: 'Diagnóstico', vulnerable: 10, strong: 0 },
    { name: 'Tratamiento', vulnerable: 4, strong: 0 },
    { name: 'Medicamentos', vulnerable: 15, strong: 6 },
    { name: 'Notas del Médico', vulnerable: 2, strong: 0 },
    { name: 'Servicios', vulnerable: 5, strong: 0 }
  ];
  
  const totalVulnerable = sections.reduce((sum, s) => sum + s.vulnerable, 0);
  const totalStrong = sections.reduce((sum, s) => sum + s.strong, 0);
  
  generatePDF(moduleName, sections, totalStrong, totalVulnerable);
}
