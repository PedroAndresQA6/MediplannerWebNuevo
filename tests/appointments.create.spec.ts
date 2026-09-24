import { test, expect } from '@playwright/test';
import { createAppointment } from '../e2e/utils.js';
import { buscarBotonIniciarDePaciente } from '../e2e/citas/agenda.js';
import { opcional, reporteOpcionales } from '../e2e/opcional.js';
const { PACIENTE_BUSQUEDA } = require('../e2e/consulta/datos.js');
const config = require('../e2e/config');
const logger = config.logger;

test.describe('Schedule Appointment Flow', () => {

  // Etapa 1 de docs/tarea-actual.md: volcar qué catch()es opcionales se
  // dispararon en esta corrida (y cuántas veces), para clasificarlos con
  // datos reales en la Etapa 2 — no a mano ni por intuición.
  test.afterAll(() => {
    const disparosOpcionales = reporteOpcionales();
    console.log(`\n📋 [OPCIONAL] ${disparosOpcionales.length} etiqueta(s) distinta(s) se dispararon en esta corrida:`);
    disparosOpcionales.forEach(([etiqueta, n]) => console.log(`   ${n}x — ${etiqueta}`));
  });

  test('Schedule appointment for a patient', async ({ page }) => {
    // Etapa 5 de docs/tarea-actual.md (2026-09-24): antes se creaba para "el
    // primer paciente que aparezca" en el selector, sin forma de confirmar
    // después que la cita realmente haya quedado agendada para alguien en
    // particular, y sin revisar si ya había una — cada corrida sumaba una
    // cita más de "Percentil" a dev, indefinidamente. Se usa el mismo
    // paciente de prueba que ya usa consultation.full-flow.spec.js
    // (PACIENTE_BUSQUEDA), y se revisa primero Inicio: si ya tiene una cita
    // en los próximos 5 días, no se crea otra (mismo criterio que ya usa
    // asegurarCitaDeHoy() para el flujo de consulta, pero mirando 5 días en
    // vez de solo hoy).
    await page.goto('/Dashboard');
    await page.waitForLoadState('load');
    let iniciarBtn = await buscarBotonIniciarDePaciente(page, PACIENTE_BUSQUEDA, { maxDiasOffset: 5 });

    if (iniciarBtn) {
      logger.success(`"${PACIENTE_BUSQUEDA}" ya tiene una cita en los próximos 5 días — no se crea una nueva.`);
    } else {
      logger.info(`"${PACIENTE_BUSQUEDA}" no tiene cita en los próximos 5 días — creando una nueva.`);
      await createAppointment(page, PACIENTE_BUSQUEDA);

      // Verificar que la cita realmente aparece en Inicio (Dashboard), no
      // solo confiar en el heading "¡Cita agendada!" del wizard. Confirmado
      // en vivo 2026-09-24: en Inicio, "Agenda de hoy" solo muestra el botón
      // "Iniciar" por cita (no hay acción de "Confirmar" ahí — esa vive en
      // Agenda, ver el test siguiente). createAppointment busca hueco libre
      // hasta 14 días adelante, por eso se vuelve a buscar con ese rango.
      iniciarBtn = await buscarBotonIniciarDePaciente(page, PACIENTE_BUSQUEDA, { maxDiasOffset: 14 });
    }

    expect(iniciarBtn, `No se encontró ninguna cita para "${PACIENTE_BUSQUEDA}" en Inicio`).not.toBeNull();
  });

  test('Confirm scheduled appointment from agenda', async ({ page }) => {

    await page.goto('/Citas');
    await expect(page).toHaveURL(/Citas/);
    await page.waitForTimeout(2000);

    // Explorar semana actual + siguientes hasta encontrar la fila de la cita
    // del paciente de prueba.
    //
    // Etapa 5 (2026-09-24): el criterio anterior buscaba texto
    // "agendada"/"programada" en la pantalla — confirmado en vivo que ESE
    // texto nunca aparece en la vista de Agenda (la fila solo muestra hora +
    // nombre del paciente + tipo de consulta; el estado "Agendada" es un
    // badge que solo aparece DENTRO del modal "Detalles de la cita", tras
    // clickear la fila). Por eso este test nunca encontraba nada en 4
    // semanas — no porque no hubiera citas, sino porque el selector nunca
    // pudo haber matcheado. Se busca ahora la fila por el nombre del
    // paciente, que sí es visible en la tabla.
    let citaEncontrada = false;
    let citaConfirmada = false;
    const maxSemanas = 4;

    for (let semana = 0; semana < maxSemanas && !citaEncontrada; semana++) {
      if (semana > 0) {
        // Dar click en "Semana siguiente" para avanzar
        const nextWeekBtn = page.locator('button.fc-next-button, button[title="Semana siguiente"]');
        if (await opcional(nextWeekBtn.isVisible({ timeout: 3000 }), 'citas:boton-semana-siguiente-visible')) {
          await nextWeekBtn.click();
          logger.info(`Avanzando a semana ${semana + 1}...`);
          await page.waitForTimeout(2000);
        } else {
          logger.warning('Botón "Semana siguiente" no encontrado');
          break;
        }
      }

      const filaCita = page.locator('tr', { hasText: PACIENTE_BUSQUEDA }).first();
      if (await opcional(filaCita.isVisible({ timeout: 3000 }), 'citas:fila-cita-visible')) {
        logger.success(`Fila de cita de "${PACIENTE_BUSQUEDA}" encontrada en semana ${semana + 1}`);
        citaEncontrada = true;

        // Abrir la cita
        await filaCita.click();

        // Esperar el modal "Detalles de la cita" con una espera REAL
        // (waitFor), no isVisible({timeout}) — confirmado en vivo 2026-09-24
        // que ese timeout es un no-op en esta versión de Playwright
        // (isVisible() resuelve casi instantáneo pase lo que pase). Además,
        // el selector genérico `.bg-white` (clase de Tailwind, matchea
        // cualquier cosa en la página) hacía que `.first()` probablemente
        // agarrara un elemento que NO era el modal — con waitFor real
        // esperó los 10s completos y venció, aunque el modal sí estaba
        // abierto en la captura de pantalla de la falla. Se espera ahora por
        // el texto único "Detalles de la cita" del propio modal.
        const modal = page.getByText('Detalles de la cita');
        let modalAbierto = true;
        try {
          await modal.waitFor({ state: 'visible', timeout: 10000 });
        } catch (e) {
          modalAbierto = false;
        }
        if (modalAbierto) {
          logger.info('Modal abierto');

          // Confirmar directamente la cita
          const confirmButton = page.getByRole('button', { name: /confirmar/i });
          let botonListo = true;
          try {
            await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
          } catch (e) {
            botonListo = false;
          }
          if (botonListo) {
            await confirmButton.click();
            logger.success('Cita confirmada exitosamente');
            citaConfirmada = true;
          } else {
            logger.warning('Botón "confirmar" no encontrado en el modal');
          }
        } else {
          logger.warning('Modal no se abrió');
        }
      } else {
        logger.info(`Sin cita de "${PACIENTE_BUSQUEDA}" en semana ${semana + 1}, continuando...`);
      }
    }

    // Etapa 5 (2026-09-24): antes, si no se encontraba/confirmaba ninguna
    // cita, solo se logueaba una advertencia y el test pasaba igual — pasaba
    // siempre, hubiera o no hubiera una cita para confirmar. Además,
    // "citaEncontrada" se marcaba en true apenas se clickeaba el candidato,
    // sin importar si el modal de confirmación realmente funcionaba —
    // separado acá en citaEncontrada (se encontró la fila) vs.
    // citaConfirmada (el modal + botón "Confirmar" funcionaron de punta a
    // punta).
    expect(citaEncontrada, `No se encontró ninguna cita de "${PACIENTE_BUSQUEDA}" en ${maxSemanas} semanas de agenda`).toBe(true);
    expect(citaConfirmada, 'Se encontró la cita pero no se pudo confirmar (el modal o el botón "Confirmar" no funcionaron)').toBe(true);

  });

});
