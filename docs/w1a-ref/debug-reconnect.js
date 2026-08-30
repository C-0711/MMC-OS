'use strict';
// debug-reconnect.js — manuelle Prüfung des SSE-Reconnect (Snapshot + live).
const http = require('http');
const fs = require('fs');

function verbindeStream(onEvent) {
  return http.get({ host: '127.0.0.1', port: 3371, path: '/api/ingest/stream' }, (res) => {
    let b = '';
    res.on('data', (c) => {
      b += c;
      let i;
      while ((i = b.indexOf('\n\n')) >= 0) {
        const blk = b.slice(0, i);
        b = b.slice(i + 2);
        for (const l of blk.split('\n')) {
          if (l.startsWith('data: ')) {
            try { onEvent(JSON.parse(l.slice(6))); } catch (_) {}
          }
        }
      }
    });
  });
}
function post(p, body) {
  return new Promise((r) => {
    const q = http.request({ host: '127.0.0.1', port: 3371, path: p, method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => r(d)); });
    q.end(JSON.stringify(body));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dateien = fs.readdirSync('/tmp/w1a-testdaten').map((f) => '/tmp/w1a-testdaten/' + f);

  // 1) Snapshot nach (bereits fertigen) vorherigen Läufen?
  verbindeStream((ev) => console.log('[nach-done] ' + ev.typ + (ev.totalMs !== undefined ? ' totalMs=' + ev.totalMs : '')));
  await sleep(1000);

  // 2) Neuer Lauf, Stream nach 7 s abbrechen, neu verbinden, auf done warten
  console.log('--- Neuer Lauf mit Reconnect nach 7 s ---');
  await post('/api/ingest/start', { quellen: dateien });
  const t0 = Date.now();
  let s1 = verbindeStream((ev) => {
    if (ev.typ === 'dokument_fertig' && state.fertigS1 === undefined) state.fertigS1 = 0;
  });
  const state = {};
  await sleep(7000);
  s1.destroy();
  console.log('stream1 abgebrochen bei t=' + (Date.now() - t0) + ' ms');
  await sleep(500);
  let done = null;
  verbindeStream((ev) => {
    if (ev.typ === 'done') done = ev;
  });
  const deadline = Date.now() + 60000;
  while (!done && Date.now() < deadline) await sleep(200);
  console.log(done ? 'done erhalten nach Reconnect: totalMs=' + done.totalMs : 'done FEHLT nach Reconnect');
  process.exit(done ? 0 : 1);
}
main();
