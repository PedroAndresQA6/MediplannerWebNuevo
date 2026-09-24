const { expect } = require('@playwright/test');
const { asegurarCitaDeHoy } = require('../utils.js');
const { opcional } = require('../opcional.js');
const { PACIENTE_NOMBRE, PACIENTE_BUSQUEDA, PERCENTIL_RUN } = require('./datos.js');

// Localiza el contenedor (card) de una sección por su heading h3, subiendo
// ancestros hasta encontrar uno con tamaño razonable (no solo el header).
// Necesario porque en "Modo Completo" las 10 secciones están en el DOM al
// mismo tiempo — sin esto, selectores genéricos ("todas las textareas
// visibles") de una sección contaminan a las demás.
async function sectionContainer(page, headingRegex, maxDepth = 10) {
  const heading = page.getByRole('heading', { level: 3, name: headingRegex }).first();
  // Precondición, no opcional (Etapa 2 de docs/tarea-actual.md, 2026-09-17):
  // si el heading nunca aparece, debe reventar acá con un mensaje claro en vez
  // de caer en silencio a los fallbacks de abajo (que terminarían fallando con
  // un mensaje genérico que oculta la causa real).
  await expect(heading, `sectionContainer: el heading "${headingRegex}" nunca apareció`).toBeVisible({ timeout: 15000 });

  // Estrategia principal: subir hasta el ancestro con class="card" (el mismo
  // patrón que ya usa con éxito auditConsultationIndicators()/
  // detectUnsavedSections() en e2e/utils.js para TODOS los apartados de la
  // consulta, "Exploración segmentaria"/"Aparatos y sistemas" incluidos).
  const cardAncestor = heading.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," card ")][1]');
  if (await cardAncestor.count() > 0) {
    const box = await opcional(cardAncestor.boundingBox(), 'sectionContainer:card-ancestor-boundingbox');
    if (box && box.height > 50) return cardAncestor;
  }

  // Fallback: el heurístico viejo de "primer ancestro con altura > 100px".
  // Confirmado en vivo 2026-09-10: para "Exploración segmentaria" este
  // heurístico solo NUNCA encontraba nada (los 10 niveles fallaban), y el
  // fallback de ese entonces (page.locator('body'), scope = página completa)
  // hacía que fillChecklistSection escribiera sus "Observaciones" en los
  // PRIMEROS <textarea> visibles de TODA la página — que resultaron ser los
  // de "General"/"Apariencia general" — pisándolos con texto de checklist
  // ("motivo" terminó con "Cabeza: sin alteraciones..."). Ver CONTEXTO.md.
  // Por eso ahora, si ni el ancestro .card ni este heurístico encuentran un
  // contenedor real, se prefiere TRONAR (el section no se llena y el test lo
  // reporta) antes que arriesgar contaminación cruzada silenciosa.
  for (let depth = 2; depth <= maxDepth; depth++) {
    const container = heading.locator(`xpath=ancestor::*[${depth}]`);
    if (await container.count() === 0) continue;
    const box = await opcional(container.boundingBox(), 'sectionContainer:fallback-ancestor-boundingbox');
    if (box && box.height > 100) return container;
  }
  throw new Error(`sectionContainer: no se pudo acotar "${headingRegex}" ni por .card ni por altura — abortando en vez de arriesgar contaminación cruzada con scope de página completa`);
}

// Dev puede caer en el wizard de "Configuración de tu cuenta" (6 pasos:
// perfil/credenciales/consultorios/horarios/tipos de cita/métodos de pago) o
// en el onboarding simple, en vez del Dashboard directo — ver CONTEXTO.md.
// Salir de cualquiera de los 2 si aparecen.
async function saltarOnboardingYWizardConfig(page) {
  const explorarLink = page.getByText(/prefiero explorar por mi cuenta/i);
  // isVisible({timeout}) no espera de verdad (confirmado en vivo, Etapa 5) —
  // el onboarding es contenido condicional que puede tardar más que un
  // instante en aparecer tras cargar el Dashboard.
  if (await opcional(explorarLink.waitFor({ state: 'visible', timeout: 3000 }).then(() => true), 'onboarding:link-explorar-visible')) {
    console.log('ℹ️ Onboarding detectado — clickeando "Prefiero explorar por mi cuenta"');
    // Precondición, no opcional (Etapa 2): el link ya se confirmó visible
    // arriba — si el click o la carga posterior revientan, es una falla real
    // (overlay que lo tapa, navegación rota), no algo "opcional".
    await explorarLink.click({ force: true });
    await page.waitForLoadState('load', { timeout: 20000 });
    await page.waitForTimeout(1500);
  }
  const configurarMasTardeLink = page.getByText(/configurar más tarde/i);
  if (await opcional(configurarMasTardeLink.waitFor({ state: 'visible', timeout: 3000 }).then(() => true), 'onboarding:link-configurar-mas-tarde-visible')) {
    console.log('ℹ️ Wizard de "Configuración de tu cuenta" detectado — clickeando "Configurar más tarde"');
    await configurarMasTardeLink.click({ force: true });
    await page.waitForLoadState('load', { timeout: 20000 });
    await page.waitForTimeout(1500);
  }
}

async function iniciarConsultaDelPaciente(page) {
  console.log('🏠 Yendo a Dashboard a revisar si ya hay una cita de hoy...');
  await page.goto('/Dashboard');
  // Precondición, no opcional (Etapa 2): sin esta carga, todo lo que sigue
  // (buscar/crear cita, iniciar consulta) actúa sobre un Dashboard a medio cargar.
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);
  await saltarOnboardingYWizardConfig(page);

  // Etapa 5 de docs/tarea-actual.md: la cita es una PRECONDICIÓN de este test,
  // no su objetivo — se reutiliza la de hoy si ya existe, en vez de crear una
  // nueva cada vez (createAppointment toma el PRIMER día de los próximos 5 con
  // horario libre si hace falta crear, no necesariamente hoy — confirmado en
  // vivo 2026-07-31 que dev puede tener la agenda llena los próximos 2-3 días).
  const { reutilizada, iniciarBtn } = await asegurarCitaDeHoy(page, PACIENTE_BUSQUEDA);
  console.log(reutilizada
    ? `📅 "${PACIENTE_NOMBRE}" ya tenía una cita de hoy — se reutiliza.`
    : `📅 No había cita de hoy para "${PACIENTE_NOMBRE}" — se creó una nueva.`);
  if (!iniciarBtn) {
    throw new Error(`No se encontró botón "Iniciar" para "${PACIENTE_NOMBRE}"`);
  }

  const overlay = page.locator('div.fixed.inset-0.bg-black.bg-opacity-50');
  if (await overlay.count() > 0 && await opcional(overlay.first().isVisible(), 'iniciar-consulta:overlay-modal-visible')) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }
  console.log(`▶️ Iniciando consulta de "${PACIENTE_NOMBRE}" (set #${PERCENTIL_RUN})...`);
  await iniciarBtn.click({ force: true });
}

module.exports = { sectionContainer, saltarOnboardingYWizardConfig, iniciarConsultaDelPaciente };
