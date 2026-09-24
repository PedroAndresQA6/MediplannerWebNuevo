// Fachada (Etapa 4 de docs/tarea-actual.md, 2026-09-24): este archivo dejó de
// tener lógica propia. Cada responsabilidad vive ahora en su propio módulo;
// esto solo re-exporta todo con el mismo nombre de antes para no romper los
// imports existentes (`require('../e2e/utils.js')`) de un golpe.
//
//   e2e/modales.js       handleModals
//   e2e/consola.js       setupConsoleMonitor
//   e2e/auditoria.js     auditarPantalla
//   e2e/citas/crear.js   createAppointment
//   e2e/citas/agenda.js  asegurarCalendarioDashboard, irADiaEnCalendarioDashboard,
//                        checkNextDaysForIniciarButton, buscarBotonIniciarDePaciente,
//                        asegurarCitaDeHoy
const { handleModals } = require('./modales');
const { setupConsoleMonitor } = require('./consola');
const { auditarPantalla } = require('./auditoria');
const { createAppointment } = require('./citas/crear');
const {
  asegurarCalendarioDashboard,
  irADiaEnCalendarioDashboard,
  checkNextDaysForIniciarButton,
  buscarBotonIniciarDePaciente,
  asegurarCitaDeHoy,
} = require('./citas/agenda');

module.exports = {
  checkNextDaysForIniciarButton,
  createAppointment,
  handleModals,
  setupConsoleMonitor,
  asegurarCalendarioDashboard,
  irADiaEnCalendarioDashboard,
  auditarPantalla,
  buscarBotonIniciarDePaciente,
  asegurarCitaDeHoy,
};
