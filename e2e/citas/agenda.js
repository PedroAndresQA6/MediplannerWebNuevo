const config = require('../config');
const { opcional } = require('../opcional');
const { createAppointment } = require('./crear');

const logger = config.logger;

// Asegura estar en /Dashboard con su calendario (react-day-picker, desde el
// rediseño de dev de 2026-07) realmente renderizado. Ya no existe un
// input[type="date"] ni el FullCalendar viejo (fc-next-button).
async function asegurarCalendarioDashboard(page) {
  if (!page.url().includes('/Dashboard')) {
    await page.goto('/Dashboard');
    await opcional(page.waitForLoadState('load', { timeout: 15000 }), 'asegurarCalendarioDashboard:load-inicial');
  }
  // Esperar a que el calendario esté realmente renderizado antes de tocarlo;
  // sin esto, en dev (flaky, a veces se cuelga en "Cargando...") un loop
  // corre en unos pocos ms y no encuentra ninguna celda porque el widget aún
  // no montó. Reintenta con reload si hace falta.
  for (let intento = 0; intento < 3; intento++) {
    if (await opcional(page.locator('td[data-day]').first().isVisible({ timeout: 8000 }), 'asegurarCalendarioDashboard:celda-visible')) return true;
    logger.warning(`Calendario del Dashboard no renderizó (intento ${intento + 1}/3), recargando...`);
    await page.reload();
    await opcional(page.waitForLoadState('load', { timeout: 15000 }), 'asegurarCalendarioDashboard:load-tras-reload');
    await page.waitForTimeout(1500);
  }
  logger.warning('El calendario del Dashboard no llegó a renderizar (td[data-day])');
  return false;
}

// Clickea la celda del calendario del Dashboard para `dateStr` (YYYY-MM-DD),
// avanzando de mes con el botón "›" (rdp-button_next) si hace falta. Espera
// la respuesta de getFilteredAppointments para esa fecha (filtra "Agenda de
// hoy" in-place, sin navegar). Devuelve true si logró clickear la celda.
async function irADiaEnCalendarioDashboard(page, dateStr) {
  // El botón de día no tiene la clase "rdp-day_button" (verificado contra la
  // app real 2026-07-10) — el <td data-day> existe, pero adentro hay un
  // <button> sin esa clase. Se usa un selector genérico (hay un solo botón
  // por celda) en vez de depender de esa clase.
  let celda = page.locator(`td[data-day="${dateStr}"] button`);
  for (let avance = 0; avance < 2 && !(await opcional(celda.isVisible({ timeout: 1000 }), 'irADia:celda-visible-loop')); avance++) {
    // Hay 2 botones "rdp-button_next" en el DOM: uno dentro de un
    // <nav class="rdp-nav"> decorativo/no funcional (siempre el primero) y el
    // real dentro del header visible del calendario (el segundo). .first()
    // no avanza de mes; .last() sí.
    const nextBtn = page.locator('button.rdp-button_next').last();
    if (!(await opcional(nextBtn.isVisible({ timeout: 1000 }), 'irADia:boton-siguiente-visible'))) break;
    // El header sticky a veces intercepta el click (el botón queda muy cerca
    // del borde superior); force:true evita el reintento de 15s en vano.
    await nextBtn.click({ force: true });
    await page.waitForTimeout(500);
    celda = page.locator(`td[data-day="${dateStr}"] button`);
  }
  if (!(await opcional(celda.isVisible({ timeout: 1000 }), 'irADia:celda-visible-final'))) {
    logger.warning(`No se encontró la celda del calendario para ${dateStr}`);
    return false;
  }
  const respPromise = opcional(page.waitForResponse(
    r => /\/api\/appointments\/getFilteredAppointments/.test(r.url()),
    { timeout: 8000 }
  ), 'irADia:espera-response-getfilteredappointments');
  await celda.click();
  await respPromise;
  await page.waitForTimeout(1000);
  return true;
}

async function checkNextDaysForIniciarButton(page) {
  logger.info('Buscando botón Iniciar en los próximos 5 días...');
  await asegurarCalendarioDashboard(page);

  for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];

    logger.info(`Revisando fecha: ${dateStr}`);

    // dayOffset 0 (hoy) ya viene seleccionado al cargar el Dashboard; para el
    // resto, clickear la celda del calendario correspondiente.
    if (dayOffset > 0 && !(await irADiaEnCalendarioDashboard(page, dateStr))) continue;

    // Buscar botones Iniciar visibles (no ocultos en modales) tras filtrar por esa fecha.
    const iniciarButtons = page.getByRole('button', { name: /iniciar/i });
    const count = await iniciarButtons.count();
    let visibleCount = 0;
    for (let i = 0; i < count; i++) {
      if (await opcional(iniciarButtons.nth(i).isVisible(), 'checkNextDaysForIniciarButton:boton-iniciar-visible')) visibleCount++;
    }
    if (visibleCount > 0) {
      logger.success(`Encontrados ${visibleCount} botones Iniciar visibles en ${dateStr}`);
      await iniciarButtons.first().click();
      return true;
    }
  }

  return false;
}

// Igual que checkNextDaysForIniciarButton, pero filtrando el botón "Iniciar"
// por el nombre del paciente en su fila — necesario cuando el Dashboard
// puede mostrar citas de OTROS pacientes el mismo día (ej. "Carla Perez
// Rojas" ya agendada) y createAppointment cae en un día futuro (no
// necesariamente hoy: agarra el primer día de los próximos 5 con horario
// libre). Agregado 2026-07-31 tras encontrar que 3 specs distintos
// (`consultation.full-flow.spec.js`, `consultation.user-errors.spec.js`,
// `consultation.inputs-validation.spec.ts`) tenían su propia reimplementación
// de "buscar Iniciar tras crear cita" que solo miraba la vista de HOY (o, en
// el caso de inputs-validation, buscaba botones "+N días" que no existen en
// el calendario real) — todas fallaban en cuanto el día con horario libre no
// era hoy, algo que pasa seguido en dev (agenda ya llena los próximos días).
async function buscarBotonIniciarDePaciente(page, patientSearch, { maxDiasOffset = 5 } = {}) {
  logger.info(`Buscando botón Iniciar para "${patientSearch}" en los próximos ${maxDiasOffset} días...`);
  await asegurarCalendarioDashboard(page);

  for (let dayOffset = 0; dayOffset <= maxDiasOffset; dayOffset++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dateStr = targetDate.toISOString().split('T')[0];

    if (dayOffset > 0 && !(await irADiaEnCalendarioDashboard(page, dateStr))) continue;

    const botones = page.getByRole('button', { name: /iniciar/i });
    const total = await botones.count();
    for (let i = 0; i < total; i++) {
      const btn = botones.nth(i);
      if (!(await opcional(btn.isVisible(), 'buscarBotonIniciarDePaciente:boton-visible'))) continue;
      const fila = btn.locator('xpath=ancestor::*[self::div or self::tr][1]');
      // Precondición, no opcional (Etapa 2): esta lectura decide si la fila
      // es la del paciente buscado. Tragarla en silencio puede hacer que la
      // función reporte "no hay cita de hoy" cuando en realidad sí la había,
      // y que asegurarCitaDeHoy() cree una cita duplicada — el bug exacto
      // que la Etapa 5 existe para evitar. Se loguea fuerte en vez de tratar
      // el fallo como "esta fila no es" sin dejar rastro.
      let texto = '';
      try {
        texto = (await fila.textContent()) || '';
      } catch (e) {
        logger.warning(`buscarBotonIniciarDePaciente: no se pudo leer el texto de una fila (${e.message}) — se omite sin poder confirmar si era "${patientSearch}"`);
      }
      if (texto.toLowerCase().includes(patientSearch.toLowerCase())) {
        logger.success(`Botón Iniciar de "${patientSearch}" encontrado en ${dateStr}`);
        return btn;
      }
    }
  }

  return null;
}

// Etapa 5 de docs/tarea-actual.md — problema reportado por Pedro: el flujo de
// consulta creaba una cita nueva aunque el paciente ya tuviera una agendada
// para hoy. Para `consultation.full-flow.spec.js` la cita es una
// PRECONDICIÓN (no el objetivo del test), así que corresponde reutilizar: se
// revisa primero la agenda de HOY en Inicio (Dashboard) y solo si no hay
// ninguna cita programada se crea una. Distinto de `appointments.create.spec.ts`,
// cuyo objetivo ES verificar que crear una cita funciona — ese sigue creando
// siempre, no usa este helper.
// Devuelve { reutilizada, iniciarBtn }.
async function asegurarCitaDeHoy(page, patientSearch) {
  logger.info(`asegurarCitaDeHoy: revisando si "${patientSearch}" ya tiene una cita de hoy en Inicio...`);
  let iniciarBtn = await buscarBotonIniciarDePaciente(page, patientSearch, { maxDiasOffset: 0 });
  if (iniciarBtn) {
    logger.success(`asegurarCitaDeHoy: "${patientSearch}" ya tiene cita de hoy — se reutiliza, no se crea una nueva.`);
    return { reutilizada: true, iniciarBtn };
  }

  logger.info(`asegurarCitaDeHoy: "${patientSearch}" no tiene cita de hoy — creando una nueva.`);
  await createAppointment(page, patientSearch);
  await page.goto('/Dashboard');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);
  iniciarBtn = await buscarBotonIniciarDePaciente(page, patientSearch);
  if (!iniciarBtn) {
    throw new Error(`asegurarCitaDeHoy: no se encontró botón "Iniciar" para "${patientSearch}" tras crear la cita nueva`);
  }
  logger.info('asegurarCitaDeHoy: cita nueva creada y localizada.');
  return { reutilizada: false, iniciarBtn };
}

module.exports = {
  asegurarCalendarioDashboard,
  irADiaEnCalendarioDashboard,
  checkNextDaysForIniciarButton,
  buscarBotonIniciarDePaciente,
  asegurarCitaDeHoy,
};
