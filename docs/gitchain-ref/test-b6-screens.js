// B6-Backend-Test: OsConnectorBeweis · OsDivergenz · OsRevision
'use strict';
const BASE = 'http://127.0.0.1:3361';
let pass = 0, fail = 0;
const check = (n, c) => { console.log((c ? '✓' : '✗ FEHLER') + '  ' + n); c ? pass++ : fail++; };
async function api(m, p, b) {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}

(async () => {
  // ── OsConnectorBeweis ──
  // T1: Widerspruch erzeugen → beide Artefakt-Hashes vorhanden
  const w = await api('POST', '/api/v2/connectors/widerspruch', { objekt: 'MNR-4711' });
  const wid = w.d.widersprueche[0];
  check('T1 Widerspruch liefert Artefakt-Hashes je Seite', wid.wertA.artefaktHash && wid.wertB.artefaktHash && wid.wertA.artefaktHash !== wid.wertB.artefaktHash);

  // T2: Fundstelle als zitierbares Artefakt abrufbar (hash-adressiert)
  const art = await api('GET', `/api/v2/connectors/fundstelle/${wid.wertA.artefaktHash}`);
  check('T2 Artefakt hash-adressiert abrufbar (OsConnectorBeweis-Daten)', art.status === 200 && art.d.system === 'teamcenter' && art.d.revision === 'C' && art.d.wert === '2,1 mm');

  // T3: Unbekannter Hash → 404
  const nf = await api('GET', '/api/v2/connectors/fundstelle/gibtsnicht');
  check('T3 Unbekannter Artefakt-Hash → 404', nf.status === 404);

  // ── OsDivergenz ──
  // T4: Auflösung OHNE Fundstelle → fail closed (nie Aussage ohne Beweis)
  const bad = await api('POST', '/api/v2/connectors/aufloesen', { objekt: 'MNR-0815', attribut: 'bautiefe', giltSystem: 'teamcenter' });
  check('T4 Auflösung ohne offenen Widerspruch abgelehnt', bad.status === 400);

  // T5: Signierte Auflösung: PIM-Wert gilt (die neuere Änderung, 25.08.)
  const auf = await api('POST', '/api/v2/connectors/aufloesen', {
    objekt: 'MNR-4711', attribut: 'wanddicke', giltSystem: 'pim', signiertVon: 'rolle:pim-team',
  });
  check('T5 Signierte Fassung erzeugt (PIM gilt: 2,3 mm)', auf.d.aufgeloest === true && auf.d.fassung.gilt.wert === '2,3 mm' && auf.d.fassung.gilt.system === 'pim');

  // T6: Gültigkeit abfragbar — der Zustand der Welt nach der Entscheidung
  const g = await api('GET', '/api/v2/connectors/gueltigkeit/MNR-4711');
  check('T6 Gültigkeit abfragbar (gilt_laut: pim)', g.d.gueltig.wanddicke && g.d.gueltig.wanddicke.gilt.system === 'pim' && g.d.gueltig.wanddicke.signiertVon === 'rolle:pim-team');

  // ── OsRevision ──
  // T7: Revisions-Historie je Objekt — was galt wann, sortiert, mit gilt_laut
  const rev = await api('GET', '/api/v2/connectors/revisionen/MNR-4711');
  const eintraege = rev.d.eintraege;
  check('T7 Revisions-Historie über alle Systeme', rev.status === 200 && eintraege.length >= 5); // TC:2 + PIM:2 + ERP:1
  check('T8 Sortierung nach Änderungszeitpunkt (neueste zuerst)', eintraege[0].geaendert >= eintraege[1].geaendert);
  const wand = eintraege.find(e => e.attribut === 'wanddicke');
  check('T9 Retrospektiv: wanddicke zeigt gültige Quelle (gilt_laut: pim)', wand.gilt_laut === 'pim' && wand.gilt_seit !== null);

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
