// CALL C.2 — Signaling-Test: zwei Clients, Klingeln mit Fall-Kontext, Typ-Trennung
'use strict';
const net = require('net');
const PORT = 3362;
let pass = 0, fail = 0;
const check = (n, c) => { console.log((c ? '✓' : '✗ FEHLER') + '  ' + n); c ? pass++ : fail++; };

function klient() {
  return new Promise((ok) => {
    const sock = net.connect(PORT, '127.0.0.1', () => ok(sock));
    sock.setEncoding('utf8');
    sock.queue = [];
    sock.wartenAuf = (typ, timeout = 3000) => new Promise((res, rej) => {
      const start = Date.now();
      const poll = setInterval(() => {
        const i = sock.queue.findIndex(m => m.typ === typ);
        if (i >= 0) { clearInterval(poll); res(sock.queue.splice(i, 1)[0]); }
        else if (Date.now() - start > timeout) { clearInterval(poll); rej(new Error('timeout auf ' + typ)); }
      }, 50);
    });
    sock.on('data', chunk => {
      sock.buffer = (sock.buffer || '') + chunk;
      let i;
      while ((i = sock.buffer.indexOf('\n')) >= 0) {
        const z = sock.buffer.slice(0, i); sock.buffer = sock.buffer.slice(i + 1);
        try { sock.queue.push(JSON.parse(z)); } catch {}
      }
    });
    sock.senden = (obj) => sock.write(JSON.stringify(obj) + '\n');
  });
}

(async () => {
  const A = await klient();
  const B = await klient();

  // T1: Registrierung beider
  A.senden({ typ: 'registrieren', von: 'did:key:A' });
  B.senden({ typ: 'registrieren', von: 'did:key:B' });
  await A.wartenAuf('registriert'); await B.wartenAuf('registriert');
  check('T1 beide Clients registriert', true);

  // T2: DER SICHERHEITS-BEWEIS — Medien-Feld im Signaling → abgelehnt
  A.senden({ typ: 'sdp', an: 'did:key:B', sdp: 'x', audio: 'FAKE-MEDIEN-DATEN' });
  const fehler = await A.wartenAuf('fehler');
  check('T2 Typ-Trennung: Medien-Feld abgelehnt (Signaling sieht nie Inhalt)', fehler.grund.includes('nie Medien'));

  // T3: Anruf-Anstoss MIT Fall-Kontext — B klingelt mit Fall-Infos
  A.senden({ typ: 'anruf-anstoss', von: 'did:key:A', fall: 'demo-beziehung' });
  const klingeln = await B.wartenAuf('klingeln');
  check('T3 B klingelt MIT Fall-Kontext (kein anonymer Anruf)', klingeln.fall === 'demo-beziehung' && klingeln.von === 'did:key:A');
  const klingeltBei = await A.wartenAuf('klingelt-bei');
  check('T4 A erhält anrufId', klingeltBei.anrufId.startsWith('anruf-'));

  // T5: Annehmen → verbunden
  B.senden({ typ: 'annehmen', anrufId: klingeln.anrufId });
  const verbunden = await A.wartenAuf('verbunden');
  check('T5 Annehmen → verbunden', verbunden.anrufId === klingeln.anrufId);

  // T6: SDP-Weiterleitung (opake Strings — der Stub versteht nichts)
  B.senden({ typ: 'sdp', an: 'did:key:A', anrufId: klingeln.anrufId, sdp: 'v=0 o=- 2890844526 IN IP4 127.0.0.1' });
  const sdp = await A.wartenAuf('sdp');
  check('T6 SDP wird weitergeleitet (Stub = opaker Vermittler)', sdp.sdp.startsWith('v=0'));

  // T7: ICE-Weiterleitung
  A.senden({ typ: 'ice', an: 'did:key:B', anrufId: klingeln.anrufId, kandidat: 'candidate:1 1 UDP 2130706431 192.168.1.4 8998 typ host' });
  const ice = await B.wartenAuf('ice');
  check('T7 ICE-Kandidat fließt ans Gegenüber', ice.kandidat.includes('typ host'));

  // T8: Auflegen → BEIDE erfahren es
  B.senden({ typ: 'auflegen', anrufId: klingeln.anrufId });
  const aufgelegtA = await A.wartenAuf('aufgelegt');
  check('T8 Auflegen → beide Seiten informiert', aufgelegtA.anrufId === klingeln.anrufId);

  A.destroy(); B.destroy();
  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
