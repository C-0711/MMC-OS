'use strict';
// test-w1a.js — E2E-Test, der die W1a-DoD beweist:
//  (a) erster NAME aus Dokument-Inhalt (nicht Dateiname!) < 10 s
//  (b) fragen_bereit ≤ 30 s mit 3 Fragen
//  (c) eine /ask-Antwort mit "[n]"-Zitat, während done noch nicht kam
//  (d) SSE-Reconnect: Stream abbrechen und neu verbinden — der Worker
//      lief durch, das done-Event kommt trotzdem
// Nur Node-Stdlib.
//
// Port-Logik: Der Test sucht sich einen freien Port, spawnt den Server
// als eigenes Kind (child_process) mit W1A_PORT und killt ihn am Ende
// deterministisch. EADDRINUSE durch parallel laufende Server ist damit
// ausgeschlossen.

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');
const { generateDocs, ZIEL } = require('./make-docs');

let PORT = 3371; // wird in main() auf einen freien Port gesetzt

function freienPortSuchen() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: url, method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

function waitForHealth(tries = 50) {
  return new Promise((resolve, reject) => {
    const t = () => {
      http.get({ host: '127.0.0.1', port: PORT, path: '/health' }, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (tries-- <= 0) reject(new Error('Server nicht erreichbar'));
        else setTimeout(t, 200);
      });
    };
    t();
  });
}

// SSE-Verbindung, die Events an einen onEvent-Callback liefert.
// Liefert {close} zum Abbrechen.
function verbindeStream(onEvent) {
  const req = http.get({
    host: '127.0.0.1', port: PORT, path: '/api/ingest/stream',
    headers: { Accept: 'text/event-stream' },
  }, (res) => {
    let buf = '';
    res.on('data', (chunk) => {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of block.split('\n')) {
          if (line.startsWith('data: ')) {
            try { onEvent(JSON.parse(line.slice(6))); } catch (_) {}
          }
        }
      }
    });
    res.on('error', () => {});
  });
  req.on('error', () => {});
  return { close: () => req.destroy() };
}

// /ask abfragen und Token-Antwort zusammensetzen.
// Sicherheitsnetz: resolve auch nach Timeout, damit der Test nie hängt.
function ask(frage, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const fertig = (val) => { if (!finished) { finished = true; clearTimeout(w); resolve(val); } };
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: '/api/ingest/ask', method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    }, (res) => {
      let text = '';
      let meta = null;
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of block.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.typ === 'token') text += ev.t;
              if (ev.typ === 'antwort_fertig') meta = ev;
            } catch (_) {}
          }
        }
      });
      res.on('end', () => fertig({ text, meta }));
      res.on('error', () => fertig({ text, meta }));
    });
    const w = setTimeout(() => fertig({ text: '', meta: null, timeout: true }), timeoutMs);
    req.on('error', (e) => { finished = true; clearTimeout(w); reject(e); });
    req.end(JSON.stringify({ frage }));
  });
}

async function main() {
  const ergebnisse = [];
  const ok = (id, bedingung, messung) =>
    ergebnisse.push({ id, pass: !!bedingung, messung });

  console.log('== W1a E2E-Test ==');
  console.log('[setup] Erzeuge 50 Testdokumente …');
  const dateien = generateDocs();
  console.log(`[setup] ${dateien.length} Dokumente in ${ZIEL}`);

  PORT = await freienPortSuchen();
  console.log(`[setup] Freier Port: ${PORT}`);

  const server = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    stdio: 'inherit',
    env: Object.assign({}, process.env, { W1A_PORT: String(PORT) }),
  });
  // Kind deterministisch killen — auch bei Testfehler oder Timeout-Wächter.
  const killServer = () => {
    if (server.exitCode !== null || server.signalCode) return;
    server.kill('SIGKILL');
  };
  process.on('exit', killServer);
  const t = setTimeout(() => { console.error('Timeout-Wächter'); killServer(); process.exit(1); }, 120000);

  try {
    await waitForHealth();
    console.log('[setup] Server auf :' + PORT + ' bereit');

    const t0 = Date.now();
    const startRes = await post('/api/ingest/start', {
      quellen: dateien.map((f) => path.join(ZIEL, f)),
      container: 'w1a-test',
    });
    console.log(`[start] /api/ingest/start -> ${startRes.status} ${startRes.body}`);

    // ---- Kriterien-Tracker über den ersten Stream ----
    let ersterNameMs = null;
    let fragen3Ms = null;
    let fragen3 = null;
    let doneGesehen = false;

    const stream1 = verbindeStream((ev) => {
      if (ev.typ === 'bericht_aktualisiert' && ersterNameMs === null) {
        const namen = ev.namenAusDokumenten || [];
        const dateinamen = new Set(dateien);
        const echterName = namen.find((n) =>
          !dateinamen.has(n) && !dateien.some((d) => d.includes(n)) &&
          /Stadtwerke|Hausverwaltung|Nordlicht|Rechnungsstelle/.test(n));
        if (echterName) {
          ersterNameMs = Date.now() - t0;
          console.log(`  (a) erster Name aus Inhalt: "${echterName}" nach ${ersterNameMs} ms`);
        }
      }
      if (ev.typ === 'fragen_bereit' && fragen3Ms === null && (ev.fragen || []).length === 3) {
        fragen3Ms = Date.now() - t0;
        fragen3 = ev.fragen;
        console.log(`  (b) fragen_bereit mit 3 Fragen nach ${fragen3Ms} ms`);
        ev.fragen.forEach((f) => console.log(`      - ${f.text} [${f.atomRef}]`));
      }
      if (ev.typ === 'done') {
        doneGesehen = true;
        console.log(`  done: totalMs=${ev.totalMs} textSeiten=${ev.textSeiten} ocrSeiten=${ev.ocrSeiten}`);
      }
    });

    // ---- (c) fragen abwarten, dann /ask VOR done ----
    const fragenDeadline = Date.now() + 30000;
    while (fragen3Ms === null && Date.now() < fragenDeadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    // Erste echte Frage aus fragen_bereit nehmen (Fallback: bekannter Text)
    const fragenText = (fragen3 && fragen3[0] && fragen3[0].text) ||
      'Welche Rechnungen sind noch offen und bis wann muss ich sie bezahlen?';
    const askStart = Date.now();
    const antwort = await ask(fragenText);
    const askMs = Date.now() - askStart;
    const zitiert = /\[\d+\]/.test(antwort.text);
    const doneNochAus = !doneGesehen;
    console.log(`  (c) /ask nach ${fragen3Ms} ms gestellt, Antwort in ${askMs} ms, done=${doneGesehen}`);
    console.log(`      Antwort: ${antwort.text}`);

    // ---- (d) Stream abbrechen, neu verbinden, done muss trotzdem kommen ----
    stream1.close();
    console.log('  (d) SSE-Stream abgebrochen — warte 1 s — neu verbinden …');
    await new Promise((r) => setTimeout(r, 1000));
    let doneNachReconnect = null;
    const stream2 = verbindeStream((ev) => {
      if (ev.typ === 'done') {
        doneNachReconnect = ev;
        console.log(`  (d) done nach Reconnect erhalten: totalMs=${ev.totalMs}`);
      }
    });
    const reconnectDeadline = Date.now() + 60000;
    while (doneNachReconnect === null && Date.now() < reconnectDeadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    stream2.close();

    // ---- Bewerten ----
    ok('(a) erster NAME aus Dokument-Inhalt < 10 s',
      ersterNameMs !== null && ersterNameMs < 10000,
      ersterNameMs !== null ? `${ersterNameMs} ms` : 'kein Name aus Inhalt empfangen');
    ok('(b) fragen_bereit ≤ 30 s mit 3 Fragen',
      fragen3Ms !== null && fragen3Ms <= 30000,
      fragen3Ms !== null ? `${fragen3Ms} ms` : 'fragen_bereit(3) nie empfangen');
    ok('(c) /ask mit "[n]"-Zitat, während done noch ausstand',
      zitiert && doneNochAus,
      `zitiert=${zitiert}, doneNochAus=${doneNochAus}, antwortNach=${askMs} ms`);
    ok('(d) SSE-Reconnect — Worker lief durch, done kam trotzdem',
      doneNachReconnect !== null && doneNachReconnect.totalMs > 0,
      doneNachReconnect ? `totalMs=${doneNachReconnect.totalMs}` : 'done fehlt nach Reconnect');

  } finally {
    clearTimeout(t);
    server.kill('SIGKILL'); // deterministisch: Kind wird auf jeden Fall beendet
  }

  console.log('\n== Ergebnis ==');
  let pass = 0;
  for (const e of ergebnisse) {
    console.log(`${e.pass ? 'PASS' : 'FAIL'}  ${e.id}  [${e.messung}]`);
    if (e.pass) pass++;
  }
  console.log(`\n${pass}/${ergebnisse.length} Kriterien erfüllt.`);
  process.exit(pass === ergebnisse.length ? 0 : 1);
}

main().catch((e) => {
  console.error('Testlauf-Fehler:', e);
  process.exit(1);
});
