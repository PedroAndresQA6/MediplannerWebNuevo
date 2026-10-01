// Reporter de Playwright que vuelca cada corrida a reportes/corrida.json,
// para alimentar el generador de reportes PDF (Python) de Pedro.
//
// Una entrada por intento (onTestEnd se dispara una vez por reintento); el
// resumen de onEnd cuenta por prueba, con el resultado final de cada una.
//
// "Primer paso fallido": NO es el primer step con `error` — un step de
// Playwright (pw:api) queda con `error` aunque el spec lo haya atrapado a
// propósito (ej. los `opcional()` de e2e/opcional.js). Tomar ese sería
// reportar como causa un timeout que el test manejó. Se busca el step cuyo
// error es el mismo que hizo fallar la prueba (result.errors), y se reporta
// junto con la cadena de test.step() que lo contiene.

const fs = require('fs');
const path = require('path');

const ANSI = /\u001b\[[0-9;]*m/g;
const limpiar = (s) => String(s ?? '').replace(ANSI, '');
const primeraLinea = (s) => limpiar(s).split('\n').map(l => l.trim()).find(Boolean) ?? null;

class ReporterQA {
  constructor(opciones = {}) {
    this.salida = opciones.salida ?? path.join('reportes', 'corrida.json');
    this.aplicacion = opciones.aplicacion ?? 'Mediplanner Web Admin';
    this.plataforma = opciones.plataforma ?? 'Web';
    this.pruebas = [];
  }

  printsToStdio() {
    return false;
  }

  onBegin(config, suite) {
    this.config = config;
    this.suite = suite;
    this.inicio = new Date();
    // Raíz del repo = carpeta de playwright.config.js (config.rootDir es el testDir).
    this.raiz = config.configFile ? path.dirname(config.configFile) : process.cwd();
  }

  onTestEnd(test, result) {
    const fallido = result.status === 'passed' || result.status === 'skipped'
      ? null
      : this.pasoFallido(result);

    this.pruebas.push({
      titulo: test.title,
      archivo: path.relative(this.raiz, test.location.file).split(path.sep).join('/'),
      linea: test.location.line,
      proyecto: test.parent.project()?.name ?? null,
      estado: result.status,
      duracion_ms: result.duration,
      reintento: result.retry,
      paso_fallido: fallido,
      error: result.errors.length ? primeraLinea(result.errors[0].message ?? result.errors[0].value) : null,
      captura: this.adjuntos(result, 'image/'),
      video: this.adjuntos(result, 'video/'),
      traza: result.attachments.filter(a => a.name === 'trace' && a.path).map(a => a.path),
    });
  }

  onEnd(fullResult) {
    // Resultado final por prueba (no por intento): una prueba que falló y
    // pasó al reintentar cuenta como "flaky", no como fallida.
    const tests = this.suite.allTests().filter(t => t.results.length > 0);
    const resumen = { total: tests.length, pasaron: 0, fallaron: 0, flaky: 0, omitidas: 0 };
    for (const t of tests) {
      const o = t.outcome();
      if (o === 'expected') resumen.pasaron++;
      else if (o === 'unexpected') resumen.fallaron++;
      else if (o === 'flaky') resumen.flaky++;
      else if (o === 'skipped') resumen.omitidas++;
    }

    const primerProyecto = this.config.projects[0];
    const datos = {
      aplicacion: this.aplicacion,
      plataforma: this.plataforma,
      ambiente: primerProyecto?.use?.baseURL ?? null,
      fecha: this.inicio.toISOString(),
      duracion_ms: fullResult.duration,
      estado_corrida: fullResult.status,
      ...resumen,
      pruebas: this.pruebas,
    };

    // Sin try/catch a propósito: si no se puede escribir el JSON, que la
    // corrida lo diga fuerte en vez de dejar un corrida.json viejo.
    const destino = path.resolve(this.raiz, this.salida);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify(datos, null, 2), 'utf8');
    console.log(`\n📝 [reporter-qa] ${destino}`);
  }

  adjuntos(result, prefijoTipo) {
    return result.attachments
      .filter(a => a.path && a.contentType?.startsWith(prefijoTipo))
      .map(a => a.path);
  }

  pasoFallido(result) {
    const mensajes = new Set(result.errors.map(e => limpiar(e.message ?? e.value)).filter(Boolean));

    // Profundidad primero: el step más profundo cuyo error es el de la prueba.
    const buscar = (steps, cadena) => {
      for (const s of steps) {
        if (!s.error) continue;
        const ruta = s.category === 'test.step' ? [...cadena, s.title] : cadena;
        const hondo = buscar(s.steps, ruta);
        if (hondo) return hondo;
        if (mensajes.has(limpiar(s.error.message ?? s.error.value))) return { step: s, ruta };
      }
      return null;
    };
    const hallado = buscar(result.steps, []);

    if (hallado) {
      const { step, ruta } = hallado;
      return {
        paso: ruta.length ? ruta[ruta.length - 1] : null,
        ruta_pasos: ruta,
        accion: step.title,
        categoria: step.category,
        linea: step.location?.line ?? null,
        origen: 'error-de-la-prueba',
      };
    }

    // Sin coincidencia exacta (típico de un timeout de la prueba: ningún step
    // lleva ese error). Se reporta el último test.step iniciado, marcado como
    // aproximación para que no se lea como dato exacto.
    const pasos = [];
    const juntar = (steps, cadena) => {
      for (const s of steps) {
        if (s.category !== 'test.step') { juntar(s.steps, cadena); continue; }
        const ruta = [...cadena, s.title];
        pasos.push({ s, ruta });
        juntar(s.steps, ruta);
      }
    };
    juntar(result.steps, []);
    const ultimo = pasos.sort((a, b) => a.s.startTime - b.s.startTime).pop();
    return {
      paso: ultimo?.ruta.at(-1) ?? null,
      ruta_pasos: ultimo?.ruta ?? [],
      accion: null,
      categoria: null,
      linea: ultimo?.s.location?.line ?? null,
      origen: 'ultimo-paso-iniciado',
    };
  }
}

module.exports = ReporterQA;
