// OsVereinbarung/OsUebernahme/OsUebergang — Test: signierte Fassung + Übergabe
'use strict';
const BASE = 'http://127.0.0.1:3361';
let pass = 0, fail = 0;
const check = (n, c) => { console.log((c ? '✓' : '✗ FEHLER') + '  ' + n); c ? pass++ : fail++; };
async function api(m, p, b) {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}

(async () => {
  await api('POST', '/api/v2/fall/vertrag-demo', {});
  const ATOMS = [
    { feld: 'leistung', wert: 'Dachabdichtung komplett', conf: 0.95, fundstelle: { art: 'anruf', wav: 'docs/anrufe/a.wav', minute: '27:50' } },
    { feld: 'preis', wert: '12.400 €', conf: 0.96, fundstelle: { art: 'anruf', wav: 'docs/anrufe/a.wav', minute: '31:12' } },
    { feld: 'fertigstellung', wert: '15.09.2026', conf: 0.94, fundstelle: { art: 'dokument', doc: 'docs/angebot-weber.pdf', seite: 1 } },
  ];

  // T1: Fassung ohne Fundstellen → abgelehnt (Fassung aus Meinungen = keine Fassung)
  const bad = await api('POST', '/api/v2/fall/vertrag-demo/fassung', { titel: 'X', atoms: [{ wert: 'meinung' }], beteiligte: ['did:key:A'] });
  check('T1 Fassung ohne Fundstellen abgelehnt', bad.status === 400);

  // T2: Draft-Fassung mit kanonischem Hash
  const f = await api('POST', '/api/v2/fall/vertrag-demo/fassung', { titel: 'Badrenovierung Weber', atoms: ATOMS, beteiligte: ['did:key:A', 'did:key:B'] });
  check('T2 Draft-Fassung erzeugt (fassungHash, 2 Beteiligte)', f.status === 201 && f.d.fassungHash && f.d.zustand === 'draft' && f.d.beteiligte.length === 2);

  // T3: Idempotenz: dieselben Atoms ⇒ dieselbe Fassung (Hash entscheidet)
  const f2 = await api('POST', '/api/v2/fall/vertrag-demo/fassung', { titel: 'Badrenovierung Weber', atoms: ATOMS, beteiligte: ['did:key:A', 'did:key:B'] });
  check('T3 Idempotent: gleicher Inhalt ⇒ gleiche Fassung', f2.d.id === f.d.id);

  // T4: Fremder kann nicht signieren
  const fremd = await api('POST', '/api/v2/fall/vertrag-demo/fassung-signieren', { fassungId: f.d.id, did: 'did:key:C' });
  check('T4 Nicht-Beteiligter kann nicht signieren', fremd.status === 400);

  // T5: Erste Signatur → läuft, wartet auf B
  const s1 = await api('POST', '/api/v2/fall/vertrag-demo/fassung-signieren', { fassungId: f.d.id, did: 'did:key:A' });
  check('T5 Erste Signatur: signiert_laufend, wartet auf B', s1.d.signiert === true && s1.d.zustand === 'signiert_laufend' && s1.d.warten_auf.includes('did:key:B'));

  // T6: Doppelsignatur abgelehnt (eine Stimme pro Seite)
  const doppelt = await api('POST', '/api/v2/fall/vertrag-demo/fassung-signieren', { fassungId: f.d.id, did: 'did:key:A' });
  check('T6 Doppelsignatur abgelehnt', doppelt.status === 400);

  // T7: Zweite Signatur → GÜLTIG (Multi-eyes komplett)
  const s2 = await api('POST', '/api/v2/fall/vertrag-demo/fassung-signieren', { fassungId: f.d.id, did: 'did:key:B' });
  check('T7 Beide Signaturen ⇒ Fassung GÜLTIG (gueltig_seit gesetzt)', s2.d.zustand === 'gueltig' && s2.d.gueltig_seit);

  // T8: Fassungs-Abruf mit Siegel-Zeilen (Screen-Daten)
  const abruf = await api('GET', `/api/v2/fall/vertrag-demo/${f.d.id}/fassung-uebersicht`);
  check('T8 Abruf: Siegel je Seite, alle signiert, keine offenen', abruf.d.siegel.length === 2 && abruf.d.siegel.every(x => x.signiert) && abruf.d.noch_offen.length === 0);

  // T9: Gültige Fassung ist gegen Änderungssignatur gesperrt
  const aendern = await api('POST', '/api/v2/fall/vertrag-demo/fassung-signieren', { fassungId: f.d.id, did: 'did:key:A' });
  check('T9 Gültige Fassung nimmt keine weiteren Signaturen', aendern.status === 400);

  // ── Übergabe (OsUebernahme/OsUebergang) ──
  // T10: Klon-Angebot starten
  const u = await api('POST', '/api/v2/fall/vertrag-demo/uebergabe', { fall: 'vertrag-demo', von: 'did:key:A', an: 'did:key:B', scope: { atoms: 'all', operationen: ['search', 'get-atom'] } });
  check('T10 Übergabe-Angebot erzeugt (zustand: angeboten)', u.status === 201 && u.d.zustand === 'angeboten');

  // T11: Nur der Adressat kann annehmen
  const fremdAn = await api('POST', '/api/v2/fall/vertrag-demo/uebergabe-annehmen', { uebergabeId: u.d.id, did: 'did:key:C' });
  check('T11 Nur Adressat kann annehmen', fremdAn.status === 400);

  // T12: Annehmen → Klon übernommen
  const an = await api('POST', '/api/v2/fall/vertrag-demo/uebergabe-annehmen', { uebergabeId: u.d.id, did: 'did:key:B' });
  check('T12 Übergabe angenommen — beide Seiten führen denselben Baum', an.d.zustand === 'angenommen');

  // T13: Übergaben-Liste (OsUebergang-Zustandsanzeige)
  const liste = await api('GET', '/api/v2/fall/vertrag-demo/uebergaben');
  check('T13 Übergaben abfragbar (Liste mit Zustand)', liste.d.uebergaben.length === 1 && liste.d.uebergaben[0].zustand === 'angenommen');

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
