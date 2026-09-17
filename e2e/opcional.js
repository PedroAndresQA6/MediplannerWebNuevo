// Envuelve una operación que PUEDE fallar legítimamente.
// Sigue atrapando la excepción, pero deja registro de que se disparó.
// Etapa 1 de docs/tarea-actual.md: instrumentar antes de decidir. No juzgar
// todavía si cada catch es legítimo — eso se hace en la Etapa 2, con datos de
// tres corridas reales contra dev.
const _disparos = new Map();

async function opcional(promesa, etiqueta) {
  try {
    return await promesa;
  } catch (e) {
    const n = (_disparos.get(etiqueta) || 0) + 1;
    _disparos.set(etiqueta, n);
    console.log(`[OPCIONAL] ${etiqueta} — atrapado (${n}): ${e.message.split('\n')[0]}`);
    return undefined;
  }
}

function reporteOpcionales() {
  return [..._disparos.entries()].sort((a, b) => b[1] - a[1]);
}

module.exports = { opcional, reporteOpcionales };
