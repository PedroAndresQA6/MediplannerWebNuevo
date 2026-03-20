// Configuración centralizada para tests de Mediplaner
module.exports = {
  // URLs y endpoints
  urls: {
    baseUrl: process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/',
    dashboard: '/Dashboard',
    appointments: '/Citas',
    consultation: '/Consulta/ConsultaGeneral',
  },

  // Timeouts
  timeouts: {
    navigation: 30000,
    action: 15000,
    selector: 10000,
    waitBetweenActions: 2000,
    waitAfterClick: 1000,
  },

  // Selectores comunes
  selectors: {
    // Login
    emailInput: 'input[type="email"], input[name*="email"], input[placeholder*="mail"]',
    passwordInput: 'input[type="password"]',
    loginButton: 'button:has-text("Entrar"), button:has-text("Login")',

    // Navegación
    dashboardLink: 'a[href*="Dashboard"], a:has-text("Inicio")',
    appointmentsLink: 'a[href*="Citas"], a:has-text("Citas")',
    consultationLink: 'a[href*="Consulta"]',

    // Formularios genéricos
    textareas: 'textarea:not([disabled]):not([readonly])',
    inputs: 'input[type="text"]:not([disabled]):not([readonly]), input[type="number"]:not([disabled]):not([readonly]), input[type="email"]:not([disabled]):not([readonly]), input:not([type]):not([disabled]):not([readonly])',
    selects: 'select:not([disabled])',
    checkboxes: 'input[type="checkbox"]:not([disabled])',

    // Botones comunes
    saveButton: 'button:has-text("Guardar"), button:has-text("Save")',
    continueButton: 'button:has-text("Continuar"), button:has-text("Continue")',
    confirmButton: 'button:has-text("Confirmar"), button:has-text("Aceptar")',
    closeButton: 'button:has-text("Cerrar"), button:has-text("Close")',

    // Modales
    modal: '[role="dialog"], .modal, .popup, .swal2-popup',
    modalConfirm: '.swal2-confirm, button:has-text("OK")',
    modalClose: '.swal2-cancel, button:has-text("Cancelar")',

    // Citas
    createAppointmentButton: 'button:has-text("Agendar cita"), button:has-text("Nueva cita")',
    startButton: 'button:has-text("Iniciar")',
    appointmentTime: 'text=/\\d{2}:\\d{2}/',

    // Consulta
    captureVitalsButton: 'button:has-text("Capturar signos vitales")',
    finalizeButton: 'button:has-text("Finalizar"), button:has-text("Finalizar consulta")',
  },

  // Datos de prueba
  testData: {
    vitalSigns: {
      weight: '70',
      height: '170',
      bloodPressure: '120/80',
      temperature: '36.6',
      heartRate: '72',
      oxygenSaturation: '98',
      respiratoryRate: '16',
      glucose: '95',
    },
    
    medications: ['Paracetamol', 'Ibuprofeno', 'Omeprazol', 'Metformina', 'Losartán'],
    
    administrationRoutes: ['Cutánea', 'Inhalatoria', 'Intradérmica', 'Intramuscular', 'Intravenosa', 'Nasal', 'Ocular', 'Oral', 'Ótica', 'Rectal', 'Subcutánea', 'Sublingual', 'Transdérmica', 'Vaginal'],
    
    units: ['miligramos', 'mililitros', 'gotas'],
    
    frequencies: ['6', '8', '12', '24'],
    
    durations: ['5', '7', '10', '14', '30'],
    
    timeUnits: ['día', 'semana', 'mes'],

    observations: [
      'Sin alteraciones en la exploración',
      'Dentro de límites normales',
      'Exploración sin hallazgos significativos',
      'Paciente sin síntomas de alarma',
      'Revisión por sistemas sin particularidades',
      'Sin signos de alarma',
      'Exploración normal',
      'Sin datos de enfermedad actual',
    ],

    treatments: [
      'Mantener medidas de higiene y alimentación balanceada',
      'Tratamiento sintomático',
      'Reposo relativo',
      'Seguimiento en una semana',
    ],
  },

  // Configuración de screenshots y reports
  reports: {
    screenshotDir: 'test-results',
    videoDir: 'test-results',
    traceDir: 'test-results',
  },

  // Funciones helper para logging
  logger: {
    info: (message, data = null) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ℹ️  ${message}`;
      console.log(logMessage);
      if (data) console.log('   ', JSON.stringify(data, null, 2));
    },
    
    success: (message, data = null) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ✅ ${message}`;
      console.log(logMessage);
      if (data) console.log('   ', JSON.stringify(data, null, 2));
    },
    
    warning: (message, data = null) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ⚠️  ${message}`;
      console.warn(logMessage);
      if (data) console.warn('   ', JSON.stringify(data, null, 2));
    },
    
    error: (message, error = null) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ❌ ${message}`;
      console.error(logMessage);
      if (error) {
        console.error('   Error:', error.message);
        if (error.stack) console.error('   Stack:', error.stack);
      }
    },
    
    debug: (message, data = null) => {
      if (process.env.DEBUG === 'true') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] 🔍 ${message}`;
        console.log(logMessage);
        if (data) console.log('   ', JSON.stringify(data, null, 2));
      }
    },
  },
};