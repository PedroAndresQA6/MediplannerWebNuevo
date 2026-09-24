const { opcional } = require('./opcional');

// ─────────────────────────────────────────────────────────────────────────────
// AUDITORÍA GENERAL DE PANTALLA — centinela obligatorio (ver CLAUDE.md §0.2)
//
// Se agregó tras un error real (2026-07-30): una sesión de error guessing vio
// evidencia de un problema (checklists mostrando "Cargando preguntas" sin
// resolver) tres veces y la descartó las tres con una hipótesis benigna sin
// evidencia de esa corrida. Este helper es el chequeo que debería haberse
// corrido cada vez: espera de forma REALISTA (no un timeout corto) a que
// cualquier texto de carga desaparezca, y vuelca un inventario completo de
// los elementos interactivos visibles — para no depender de mirar un
// screenshot buscando solo lo que se estaba probando en ese momento.
//
// Uso recomendado: llamar después de cada guardado/Finalizar, y siempre que
// se entre a una pantalla nueva, sin importar cuál sea el foco puntual de la
// prueba.
// ─────────────────────────────────────────────────────────────────────────────
async function auditarPantalla(page, etiqueta, opts = {}) {
  const maxWaitMs = opts.maxWaitMs ?? 20000;
  const pollMs = opts.pollMs ?? 2000;
  // 2026-09-10: la lista traía solo "cargando"/"loading..." — un repro real
  // (ver CONTEXTO.md, hallazgo de "General" vaciado) encontró un overlay
  // separado con el texto "Recuperando datos del paciente..." que ninguno de
  // los 2 patrones matcheaba, dejando pasar por alto exactamente el tipo de
  // carga en segundo plano que este helper existe para detectar. Se agregan
  // otros verbos de carga usados en la app en vez de perseguir cada string
  // nuevo uno por uno cuando aparezca.
  const patronesCarga = opts.patronesCarga || [/cargando[^"]*/i, /recuperando[^"]*/i, /procesando[^"]*/i, /loading\.\.\./i];

  const reporte = {
    etiqueta,
    cargasPendientes: [],
    tardoEnResolver: false,
    inventario: [],
    textoCompleto: '',
  };

  // 1. Esperar de forma realista (polling, no un solo waitForTimeout corto) a
  // que cualquier texto de "Cargando..."/"Loading..." desaparezca.
  const inicio = Date.now();
  let vueltas = 0;
  while (Date.now() - inicio < maxWaitMs) {
    const texto = (await opcional(page.locator('body').innerText(), 'auditarPantalla:body-innertext-poll')) ?? '';
    const matches = patronesCarga.flatMap(re => (texto.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []));
    if (matches.length === 0) break;
    vueltas++;
    await page.waitForTimeout(pollMs);
  }
  if (vueltas > 0) reporte.tardoEnResolver = true;

  const textoFinal = (await opcional(page.locator('body').innerText(), 'auditarPantalla:body-innertext-final')) ?? '';
  reporte.textoCompleto = textoFinal;
  reporte.cargasPendientes = patronesCarga.flatMap(re => (textoFinal.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []));

  // 2. Inventario completo de elementos interactivos visibles — no una
  // muestra: TODOS, para poder declarar explícitamente qué quedó sin llenar
  // y por qué, en vez de asumir que "ya se probó lo importante".
  const elementos = page.locator('input:visible, select:visible, textarea:visible, button:visible, [role="combobox"]:visible, [contenteditable="true"]:visible');
  const n = (await opcional(elementos.count(), 'auditarPantalla:elementos-count')) ?? 0;
  for (let i = 0; i < n; i++) {
    const el = elementos.nth(i);
    const tag = (await opcional(el.evaluate(e => e.tagName.toLowerCase()), 'auditarPantalla:elemento-tag')) ?? '?';
    const type = await opcional(el.getAttribute('type'), 'auditarPantalla:elemento-type');
    const name = await opcional(el.getAttribute('name'), 'auditarPantalla:elemento-name');
    const placeholder = await opcional(el.getAttribute('placeholder'), 'auditarPantalla:elemento-placeholder');
    const required = await opcional(el.evaluate(e => e.required === true || e.getAttribute('aria-required') === 'true'), 'auditarPantalla:elemento-required');
    let value = null;
    if (tag === 'button' || tag === 'a') {
      value = ((await opcional(el.textContent(), 'auditarPantalla:elemento-textcontent')) || '').trim().substring(0, 50);
    } else {
      value = await opcional(el.inputValue(), 'auditarPantalla:elemento-inputvalue');
    }
    reporte.inventario.push({ i, tag, type, name, placeholder, required, value });
  }

  const estadoCarga = reporte.cargasPendientes.length > 0
    ? `⚠️ ${reporte.cargasPendientes.length} texto(s) de carga SIN resolver tras ${maxWaitMs}ms: ${JSON.stringify(reporte.cargasPendientes)}`
    : (reporte.tardoEnResolver ? `✅ resolvió, pero tardó (${vueltas * pollMs}ms+)` : '✅ sin textos de carga pendientes');
  console.log(`\n🔍 [auditarPantalla: "${etiqueta}"] ${estadoCarga}`);
  console.log(`   ${reporte.inventario.length} elemento(s) interactivo(s) inventariados.`);

  return reporte;
}

module.exports = { auditarPantalla };
