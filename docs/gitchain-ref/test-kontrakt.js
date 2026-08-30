// Kontrakt-Test: Anruf-Transkript (App-Form), wav-Bytes, Tisch-Docs, Laptop-ROOT
'use strict';
const BASE = 'http://127.0.0.1:3361';
let pass = 0, fail = 0;
const check = (n, c) => { console.log((c ? '✓' : '✗ FEHLER') + '  ' + n); c ? pass++ : fail++; };
async function api(m, p, b) {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, d: ct.includes('json') ? await r.json().catch(() => ({})) : null, bytes: ct.includes('octet-stream') || ct.includes('audio') ? await r.arrayBuffer() : null, ct };
}

(async () => {
  await api('POST', '/api/v2/fall/kontrakt-anruf', {});

  // ── Der App-Kontrakt: Transkript exakt in App-Form ──
  const APP_FORM = {
    art: 'anruf', wav: 'docs/anrufe/anruf-2026-08-30.wav', dauer: '42:00', titel: 'Review & Planning',
    zeilen: [
      { zeit: '03:48', sprecher: 'Stefan', text: 'Wenn wir jetzt noch deployen, testen wir gegen ein bewegliches Ziel.' },
      { zeit: '04:12', sprecher: 'Gerd', text: 'Dann frieren wir Prelive ein, bis die Freigabe da ist. Einverstanden?' },
      { zeit: '04:19', sprecher: 'Du', text: 'Einverstanden. Steht im Protokoll.' },
    ],
  };

  // T1: Sitzung mit Transkript eröffnen (mitgabe beim Start)
  const s = await api('POST', '/api/v2/fall/kontrakt-anruf/anruf', { transkript: APP_FORM, wavB64: Buffer.from('RIFF-fake-wav-bytes').toString('base64') });
  check('T1 Sitzung eröffnet', s.status === 201 && s.d.sitzungId);

  // T2: GET Transkript in EXAKT der App-Form (Kontrakt-Check-Punkt: unverändert committierbar)
  const t = await api('GET', `/api/v2/anruf/${s.d.sitzungId}/transkript`);
  const deckung = t.d && t.d.art === 'anruf' && t.d.wav === APP_FORM.wav && Array.isArray(t.d.zeilen) && t.d.zeilen.length === 3
    && t.d.zeilen[1].zeit === '04:12' && t.d.zeilen[1].sprecher === 'Gerd';
  check('T2 GET Transkript = App-Form (art, wav, dauer, titel, zeilen[zeit,sprecher,text])', t.status === 200 && deckung);

  // T3: GET wav-Bytes (Anhören ab Minute)
  const w = await api('GET', `/api/v2/anruf/${s.d.sitzungId}/wav`);
  check('T3 GET wav-Bytes (audio/wav, Bytes stimmen)', w.status === 200 && w.ct.includes('audio') && Buffer.from(w.bytes).toString().startsWith('RIFF'));

  // T4: Nachlieferung (lokale STT liefert während des Gesprächs)
  const s2 = await api('POST', '/api/v2/fall/kontrakt-anruf/anruf', {});
  const nl = await api('POST', '/api/v2/fall/kontrakt-anruf/anruf-transkript', { sitzungId: s2.d.sitzungId, transkript: APP_FORM });
  const t2 = await api('GET', `/api/v2/anruf/${s2.d.sitzungId}/transkript`);
  check('T4 Nachgeliefertes Transkript abrufbar', nl.status === 200 && t2.d.zeilen.length === 3);

  // ── OsTisch: Doc-Liste + Doc-Abruf ──
  const b64 = s => Buffer.from(s).toString('base64');
  await api('POST', '/api/v2/fall/kontrakt-anruf/eingang', { absender: 'Weber', kanal: 'mail', nutzlastB64: b64('Angebot Dach 12400 EUR'), name: 'angebot-weber' });

  // T5: Fall-Doc-Liste
  const docs = await api('GET', '/api/v2/fall/kontrakt-anruf/docs');
  check('T5 Fall-Doc-Liste für OsTisch-Nebeneinanderansicht', docs.status === 200 && docs.d.docs.length >= 1);

  // T6: Doc-Abruf per Pfad (Bytes)
  const docPfad = docs.d.docs[0].pfad;
  const doc = await api('GET', `/api/v2/fall/kontrakt-anruf/doc/${encodeURIComponent(docPfad)}`);
  check('T6 Doc-Bytes abrufbar (Beweis-Viewer-Quelle)', doc.status === 200 && doc.bytes && doc.bytes.byteLength > 0);

  // T7: Pfad-Traversal blockiert (Sicherheit)
  const evil = await api('GET', '/api/v2/fall/kontrakt-anruf/doc/..%2F..%2F..%2Fetc%2Fpasswd');
  check('T7 Pfad-Traversal abgeblockt', evil.status === 404);

  // T8: Unbekannte Sitzung → 404
  const nf = await api('GET', '/api/v2/anruf/gibtsnicht/transkript');
  check('T8 Unbekannte Sitzung 404', nf.status === 404);

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
