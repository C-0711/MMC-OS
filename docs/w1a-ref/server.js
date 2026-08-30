'use strict';
// server.js — W1a "Der erste Eingang": HTTP-Server auf Port 3371.
//   POST /api/ingest/start  {quellen:[pfad], container?:id}  -> startet Worker
//   GET  /api/ingest/stream -> SSE-Live-Bericht
//   POST /api/ingest/ask    {frage} -> SSE-Antwort nur aus verarbeiteten Atomen
// Worker-Regeln (hart): Queue entkoppelt (Requests blockieren den Worker nie),
// kleine Dokumente zuerst (Byte-Größe), bericht_aktualisiert max 1 pro 500 ms.
// Kein npm — nur Node-Stdlib.

const http = require('http');
const fs = require('fs');
const path = require('path');
const lanes = require('./lanes');
const { frageVorschlaege, buildAntwort } = require('./fragen');

// Port über Env steuerbar, damit Tests ihren Server als Child spawnen können,
// ohne mit einem evtl. laufenden Default-Server (3371) zu kollidieren.
const PORT = process.env.W1A_PORT ? parseInt(process.env.W1A_PORT, 10) : 3371;

// ---------- Zustand ----------
const state = {
  phase: 'idle',            // idle | laeuft | fertig
  quellen: [],
  fertig: 0,
  total: 0,
  atome: [],                // bereits verarbeitete Atome (mit ref)
  namen: [],                // Namen aus Dokument-Inhalt (Absender-Zeilen)
  textSeiten: 0,
  ocrSeiten: 0,
  fragen: [],
  fragenGesendet: null,     // letzter gesendeter Fragen-Stand
  startedAt: null,
  doneEvent: null,
};

let atomCounter = 0;
const clients = new Set();

// ---------- SSE ----------
function send(res, typ, data) {
  try {
    res.write(`data: ${JSON.stringify(Object.assign({ typ }, data))}\n\n`);
  } catch (_) { /* Verbindung weg — ignoriert */ }
}

function broadcast(typ, data) {
  for (const res of clients) send(res, typ, data);
}

function zusammenfassung() {
  return `${state.fertig}/${state.total} Dokumente gelesen · ` +
    `${state.atome.length} Atome · Text-Lane: ${state.textSeiten} Seiten · ` +
    `OCR-Lane: ${state.ocrSeiten} Seiten`;
}

function bericht() {
  return {
    zusammenfassung: zusammenfassung(),
    namenAusDokumenten: state.namen.slice(0, 20),
  };
}

// Coalescing: dokument_fertig geht sofort raus, bericht_aktualisiert
// wird gesammelt und max. 1x pro 500 ms geflusht.
let berichtDirty = false;
function markiereBericht() { berichtDirty = true; }
setInterval(() => {
  if (berichtDirty) {
    berichtDirty = false;
    broadcast('bericht_aktualisiert', bericht());
  }
}, 500).unref();

// ---------- Worker (vollständig entkoppelt von Requests) ----------
async function worker(quellen) {
  const start = Date.now();
  state.phase = 'laeuft';
  state.startedAt = start;

  // Priorität: kleine Dokumente zuerst (nach Byte-Größe sortiert)
  const dateien = quellen
    .map((p) => {
      let size = 0;
      try { size = fs.statSync(p).size; } catch (_) {}
      return { pfad: p, size };
    })
    .sort((a, b) => a.size - b.size);

  for (const { pfad } of dateien) {
    let erg;
    try {
      erg = await lanes.processDoc(pfad);
    } catch (e) {
      erg = { lane: 'ocr', ms: 0, atome: [], fundstellen: 0, seiten: 0, fehler: String(e) };
    }
    const name = path.basename(pfad);

    // Atome global referenzieren (nur verarbeitete Atome antworten auf /ask)
    for (const a of erg.atome) {
      a.ref = 'atom-' + (++atomCounter);
      state.atome.push(a);
      if (a.typ === 'absender' && !state.namen.includes(a.wert)) {
        state.namen.push(a.wert);
      }
    }
    if (erg.lane === 'text') state.textSeiten += erg.seiten;
    if (erg.lane === 'ocr') state.ocrSeiten += erg.seiten;
    state.fertig++;

    broadcast('dokument_fertig', {
      name, lane: erg.lane, ms: erg.ms,
      atome: erg.atome.length, fundstellen: erg.fundstellen,
    });
    markiereBericht();

    // Fragen neu berechnen (Typ-Wechsel / neue Typen) — nur senden, wenn neu
    const neueFragen = frageVorschlaege(state.atome);
    if (JSON.stringify(neueFragen) !== JSON.stringify(state.fragen)) {
      state.fragen = neueFragen;
    }
    if (state.fragen.length > 0 &&
        JSON.stringify(state.fragen) !== state.fragenGesendet) {
      state.fragenGesendet = JSON.stringify(state.fragen);
      broadcast('fragen_bereit', { fragen: state.fragen });
    }
  }

  // Abschluss
  if (state.fragen.length > 0 && state.fragenGesendet !== JSON.stringify(state.fragen)) {
    broadcast('fragen_bereit', { fragen: state.fragen });
    state.fragenGesendet = JSON.stringify(state.fragen);
  }
  const totalMs = Date.now() - start;
  state.doneEvent = {
    typ: 'done', totalMs,
    textSeiten: state.textSeiten,
    ocrSeiten: state.ocrSeiten,
  };
  state.phase = 'fertig';
  berichtDirty = true;
  broadcast('done', { totalMs, textSeiten: state.textSeiten, ocrSeiten: state.ocrSeiten });
}

// ---------- Helfer ----------
function bodyLesen(req, cb) {
  let buf = '';
  req.on('data', (c) => { buf += c; });
  req.on('end', () => {
    try { cb(null, buf ? JSON.parse(buf) : {}); }
    catch (e) { cb(e); }
  });
}

function sseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(':\n\n'); // SSE-Kommentar: Verbindung sofort offen
}

// ---------- Server ----------
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'POST' && url === '/api/ingest/start') {
    return bodyLesen(req, (err, body) => {
      if (err) { res.writeHead(400); return res.end('ungültiges JSON'); }
      const quellen = (body.quellen || []).filter(Boolean);
      if (quellen.length === 0) {
        res.writeHead(400); return res.end('quellen fehlen');
      }
      if (state.phase === 'laeuft') {
        res.writeHead(409); return res.end('Ingest läuft bereits');
      }
      // Reset
      atomCounter = 0;
      Object.assign(state, {
        phase: 'laeuft', quellen, fertig: 0, total: quellen.length,
        atome: [], namen: [], textSeiten: 0, ocrSeiten: 0,
        fragen: [], fragenGesendet: null, startedAt: null, doneEvent: null,
      });
      // Worker entkoppelt starten — Request wartet NICHT auf den Worker
      setImmediate(() => worker(quellen).catch((e) => {
        broadcast('done', { totalMs: -1, textSeiten: state.textSeiten, ocrSeiten: state.ocrSeiten, fehler: String(e) });
        state.phase = 'fertig';
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, anzahl: quellen.length, container: body.container || null }));
    });
  }

  if (req.method === 'GET' && url === '/api/ingest/stream') {
    sseHeaders(res);
    clients.add(res);
    res.on('close', () => clients.delete(res));
    // Reconnect: aktuellen Zustand nachliefern, dann live weiter
    if (state.phase !== 'idle') {
      send(res, 'bericht_aktualisiert', bericht());
      if (state.fragen.length > 0) {
        send(res, 'fragen_bereit', { fragen: state.fragen });
      }
      if (state.doneEvent) send(res, 'done', state.doneEvent);
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/ingest/ask') {
    return bodyLesen(req, (err, body) => {
      if (err || !body.frage) {
        res.writeHead(400); return res.end('frage fehlt');
      }
      sseHeaders(res);
      // Antwort NUR aus bereits verarbeiteten Atomen.
      // Noch nicht durch: Ehrlichkeits-Satz statt Antwort.
      const ausstehend = Math.max(0, state.total - state.fertig);
      const antwort = buildAntwort(body.frage, state.atome, ausstehend ? ['x'] : []);

      // Token-Streaming {t:"..."}
      const tokens = antwort.text.match(/\S+\s*/g) || [antwort.text];
      let i = 0;
      const tick = setInterval(() => {
        if (res.destroyed || res.writableEnded) return clearInterval(tick);
        if (i >= tokens.length) {
          clearInterval(tick);
          send(res, 'antwort_fertig', { zitiert: antwort.zitiert, ehrlich: antwort.ehrlich });
          return res.end(); // SSE-Antwort deterministisch beenden
        }
        send(res, 'token', { t: tokens[i++] });
      }, 8);
      res.on('close', () => clearInterval(tick));
    });
  }

  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, phase: state.phase, fertig: state.fertig, total: state.total }));
  }

  res.writeHead(404);
  res.end('nicht gefunden');
});

server.listen(PORT, () => {
  console.log(`W1a-Eingang lauscht auf http://127.0.0.1:${PORT}`);
});
