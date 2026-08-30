/**
 * gitchain-ref — Signaling als TCP-JSON (Zeilen-Protokoll, CALL C.2)
 * Gleiche Nachrichten wie signaling.js, aber ohne ws-Abhängigkeit:
 * jede Zeile = eine JSON-Nachricht. Der Stub sieht NIE Medien (Typ-Trennung).
 */
'use strict';
const crypto = require('crypto');

const ERLAUBTE_FELDER = new Set(['typ', 'anrufId', 'von', 'an', 'fall', 'sdp', 'kandidat', 'grund']);

function signalingErweiternTcp() {
  const klienten = new Map();   // did → sock
  const anrufe = new Map();     // anrufId → {von, fall, ziel}
  const senden = (sock, obj) => sock.write(JSON.stringify(obj) + '\n');

  function verarbeite(msg, sock) {
    if (!Object.keys(msg).every(k => ERLAUBTE_FELDER.has(k))) {
      return senden(sock, { typ: 'fehler', grund: 'Signaling sieht nie Medien/Inhalt — Feld verboten' });
    }
    switch (msg.typ) {
      case 'registrieren':
        klienten.set(msg.von, sock);
        return senden(sock, { typ: 'registriert', von: msg.von });
      case 'anruf-anstoss': {
        const ziel = [...klienten.keys()].find(d => d !== msg.von);
        if (!ziel) return senden(sock, { typ: 'fehler', grund: 'kein Gegenüber online' });
        const anrufId = 'anruf-' + crypto.randomBytes(6).toString('hex');
        anrufe.set(anrufId, { von: msg.von, fall: msg.fall, ziel });
        senden(klienten.get(ziel), { typ: 'klingeln', anrufId, von: msg.von, fall: msg.fall });
        return senden(sock, { typ: 'klingelt-bei', anrufId });
      }
      case 'annehmen': {
        const a = anrufe.get(msg.anrufId);
        if (a) { senden(klienten.get(a.von), { typ: 'verbunden', anrufId: msg.anrufId }); }
        return;
      }
      case 'sdp': case 'ice': {
        const ziel = klienten.get(msg.an);
        ziel?.write(JSON.stringify(msg) + '\n');
        return;
      }
      case 'auflegen': {
        const a = anrufe.get(msg.anrufId);
        if (a) {
          senden(klienten.get(a.von), { typ: 'aufgelegt', anrufId: msg.anrufId });
          senden(klienten.get(a.ziel), { typ: 'aufgelegt', anrufId: msg.anrufId });
          anrufe.delete(msg.anrufId);
        }
        return;
      }
    }
  }

  return {
    verbinde(sock) {
      let buffer = '';
      sock.setEncoding('utf8');
      sock.on('data', chunk => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const zeile = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          try { verarbeite(JSON.parse(zeile), sock); } catch {}
        }
      });
      sock.on('close', () => { for (const [did, s] of klienten) if (s === sock) klienten.delete(did); });
    },
  };
}

module.exports = { signalingErweiternTcp };
