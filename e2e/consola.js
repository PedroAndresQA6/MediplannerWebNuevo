const { opcional } = require('./opcional');

// ─────────────────────────────────────────────────────────────────────────────
// CONSOLE & NETWORK MONITOR — DevTools Protocol integration
// Captura logs de consola y tráfico de red en tiempo real durante el test.
// ─────────────────────────────────────────────────────────────────────────────

function setupConsoleMonitor(page) {
  const session = {
    consoleLogs: [],
    networkEvents: [],
    errors: [],
    warnings: [],
    apiCalls: [],
    startTime: Date.now(),
    // Marca de inicio por request (para calcular latencia request→response).
    reqStart: new Map(),
    // Marcas de fase/pestaña: { label, t } con t en segundos desde startTime.
    marks: [],
  };

  // ── Consola del navegador ──────────────────────────────────────────────────
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);
    const entry = { type, text, timestamp };

    session.consoleLogs.push(entry);

    if (type === 'error') {
      session.errors.push(entry);
      console.log(`🔴 [DEVTOOLS ERROR +${timestamp}s] ${text}`);
    } else if (type === 'warning') {
      session.warnings.push(entry);
      console.log(`🟡 [DEVTOOLS WARN  +${timestamp}s] ${text}`);
    } else if (type === 'log') {
      // Solo imprimir logs de la app que contengan palabras clave útiles
      const keywords = ['error', 'fail', 'success', 'saved', 'guardado', 'api', 'fetch', 'token', 'unauthorized', '401', '403', '500'];
      if (keywords.some(k => text.toLowerCase().includes(k))) {
        console.log(`🔵 [DEVTOOLS LOG   +${timestamp}s] ${text}`);
      }
    }
  });

  // ── Errores de JS no capturados ───────────────────────────────────────────
  page.on('pageerror', (error) => {
    const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);
    const entry = { type: 'pageerror', text: error.message, stack: error.stack, timestamp };
    session.errors.push(entry);
    console.log(`💥 [JS ERROR       +${timestamp}s] ${error.message}`);
  });

  // ── Requests salientes ────────────────────────────────────────────────────
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    const isApi = url.includes('/api/') || url.includes('/v1/') || url.includes('/graphql');

    if (isApi) {
      const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);
      session.reqStart.set(request, Date.now());
      // Capturar el payload de escrituras (POST/PUT/PATCH) para auditar QUÉ se envió,
      // no solo el status. Permite distinguir "falso registro" (payload vacío) de
      // "bug de app" (payload correcto pero no persiste).
      let postData = null;
      if (method !== 'GET') {
        try { postData = request.postData(); } catch (_) {}
      }
      const entry = { direction: 'REQUEST', method, url, timestamp, postData };
      session.apiCalls.push(entry);
      console.log(`📤 [API REQUEST    +${timestamp}s] ${method} ${url}`);
    }
  });

  // ── Responses entrantes ───────────────────────────────────────────────────
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const isApi = url.includes('/api/') || url.includes('/v1/') || url.includes('/graphql');

    if (isApi || status >= 400) {
      const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);

      // Latencia request→response (ms). Usa la marca propia; cae a request.timing() si falta.
      let latencyMs = null;
      const t0 = session.reqStart.get(response.request());
      if (t0) {
        latencyMs = Date.now() - t0;
        session.reqStart.delete(response.request());
      } else {
        try {
          const tm = response.request().timing();
          if (tm && tm.responseEnd >= 0) latencyMs = Math.round(tm.responseEnd);
        } catch (_) {}
      }

      let bodyPreview = '';
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const body = await opcional(response.json(), 'setupConsoleMonitor:response-json-preview');
          if (body) bodyPreview = JSON.stringify(body).substring(0, 120);
        }
      } catch (_) {}

      const entry = { direction: 'RESPONSE', method: response.request().method(), status, url, bodyPreview, timestamp, latencyMs };
      session.networkEvents.push(entry);
      session.apiCalls.push(entry);

      const icon = status >= 500 ? '🔴' : status >= 400 ? '🟠' : '✅';
      const lat = latencyMs != null ? ` (${latencyMs}ms)` : '';
      console.log(`${icon} [API RESPONSE   +${timestamp}s]${lat} ${status} ${url}${bodyPreview ? ` → ${bodyPreview}` : ''}`);
    }
  });

  // ── Requests fallidos (sin respuesta: red caída, CORS, etc.) ─────────────
  page.on('requestfailed', (request) => {
    const timestamp = ((Date.now() - session.startTime) / 1000).toFixed(2);
    const failure = request.failure()?.errorText || 'unknown';
    const entry = { direction: 'FAILED', url: request.url(), failure, timestamp };
    session.networkEvents.push(entry);
    session.errors.push(entry);
    console.log(`❌ [REQUEST FAILED +${timestamp}s] ${request.url()} — ${failure}`);
  });

  // ── Resumen final ─────────────────────────────────────────────────────────
  session.printSummary = () => {
    const totalTime = ((Date.now() - session.startTime) / 1000).toFixed(1);
    const apiRequests = session.apiCalls.filter(e => e.direction === 'REQUEST').length;
    const apiResponses = session.apiCalls.filter(e => e.direction === 'RESPONSE');
    const successResponses = apiResponses.filter(e => e.status >= 200 && e.status < 300).length;
    const failedResponses = apiResponses.filter(e => e.status >= 400).length;

    console.log('\n' + '═'.repeat(70));
    console.log('📊  RESUMEN DEVTOOLS MONITOR');
    console.log('═'.repeat(70));
    console.log(`⏱️  Duración total:         ${totalTime}s`);
    console.log(`📤  API Requests enviados:  ${apiRequests}`);
    console.log(`✅  Responses exitosas:     ${successResponses}`);
    console.log(`🟠  Responses con error:    ${failedResponses}`);
    console.log(`🔴  Errores de JS/consola:  ${session.errors.length}`);
    console.log(`🟡  Warnings de consola:    ${session.warnings.length}`);

    if (session.errors.length > 0) {
      console.log('\n── Errores detectados ──────────────────────────────────────────────');
      session.errors.forEach((e, i) => {
        console.log(`  [${i + 1}] +${e.timestamp}s → ${e.text || e.failure}`);
      });
    }

    if (failedResponses > 0) {
      console.log('\n── API calls fallidas ──────────────────────────────────────────────');
      apiResponses
        .filter(e => e.status >= 400)
        .forEach((e, i) => {
          console.log(`  [${i + 1}] +${e.timestamp}s → ${e.status} ${e.url}`);
          if (e.bodyPreview) console.log(`       Body: ${e.bodyPreview}`);
        });
    }

    console.log('═'.repeat(70) + '\n');

    return {
      passed: session.errors.length === 0 && failedResponses === 0,
      errors: session.errors,
      failedApiCalls: apiResponses.filter(e => e.status >= 400),
      totalApiCalls: apiRequests,
    };
  };

  // Marca una fase del flujo (p.ej. inicio/fin de pestaña) para medir su duración.
  session.mark = (label) => {
    session.marks.push({ label, t: +((Date.now() - session.startTime) / 1000).toFixed(2) });
  };

  // Normaliza una URL de API a "METHOD /ruta" (sin host ni query) para agrupar.
  const normalize = (method, url) => {
    let path = url;
    try { path = new URL(url).pathname; } catch (_) {}
    return `${method || 'GET'} ${path}`;
  };

  // Agrega métricas de latencia por endpoint y devuelve el objeto de métricas.
  session.getMetrics = (extra = {}) => {
    const totalTime = +((Date.now() - session.startTime) / 1000).toFixed(1);
    const responses = session.apiCalls.filter(e => e.direction === 'RESPONSE');
    const byEndpoint = {};
    for (const r of responses) {
      const key = normalize(r.method, r.url);
      (byEndpoint[key] = byEndpoint[key] || { count: 0, statuses: {}, latencies: [] });
      byEndpoint[key].count++;
      byEndpoint[key].statuses[r.status] = (byEndpoint[key].statuses[r.status] || 0) + 1;
      if (typeof r.latencyMs === 'number') byEndpoint[key].latencies.push(r.latencyMs);
    }
    const stat = (arr) => {
      if (!arr.length) return null;
      const s = [...arr].sort((a, b) => a - b);
      const sum = s.reduce((a, b) => a + b, 0);
      return {
        n: s.length,
        min: s[0],
        max: s[s.length - 1],
        avg: Math.round(sum / s.length),
        p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
      };
    };
    const endpoints = Object.entries(byEndpoint).map(([endpoint, v]) => ({
      endpoint,
      count: v.count,
      statuses: v.statuses,
      latencyMs: stat(v.latencies),
    })).sort((a, b) => (b.latencyMs?.avg || 0) - (a.latencyMs?.avg || 0));

    // Payloads de escritura: qué se envió realmente en cada POST/PUT/PATCH.
    const writePayloads = session.apiCalls
      .filter(e => e.direction === 'REQUEST' && e.method && e.method !== 'GET' && e.postData)
      .map(e => ({ endpoint: normalize(e.method, e.url), t: e.timestamp, postData: String(e.postData).substring(0, 2000) }));

    const allLatencies = responses.map(r => r.latencyMs).filter(x => typeof x === 'number');
    return {
      totalDurationSec: totalTime,
      writePayloads,
      api: {
        requests: session.apiCalls.filter(e => e.direction === 'REQUEST').length,
        responses: responses.length,
        success2xx: responses.filter(r => r.status >= 200 && r.status < 300).length,
        error4xx5xx: responses.filter(r => r.status >= 400).length,
        latencyOverallMs: stat(allLatencies),
      },
      consoleErrors: session.errors.length,
      consoleWarnings: session.warnings.length,
      failedApiCalls: responses.filter(r => r.status >= 400).map(r => ({ status: r.status, url: r.url, body: r.bodyPreview })),
      slowestEndpoints: endpoints.slice(0, 10),
      endpoints,
      marks: session.marks,
      ...extra,
    };
  };

  // Escribe el objeto de métricas a un archivo JSON (baseline para comparar).
  session.dumpMetrics = (filePath, extra = {}) => {
    const fs = require('fs');
    const path = require('path');
    const metrics = session.getMetrics(extra);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
    console.log(`\n📈 Métricas guardadas en: ${filePath}`);
    console.log(`   ⏱️  Duración: ${metrics.totalDurationSec}s | API ok: ${metrics.api.success2xx} | API err: ${metrics.api.error4xx5xx} | latencia media: ${metrics.api.latencyOverallMs?.avg ?? 'n/a'}ms (p95 ${metrics.api.latencyOverallMs?.p95 ?? 'n/a'}ms)`);
    return metrics;
  };

  return session;
}

module.exports = { setupConsoleMonitor };
