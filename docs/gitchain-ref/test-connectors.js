// W1.5 + C.7 — Test: Connector-Pull, Widerspruchs-Engine, Anruf-Sitzung
'use strict';
const BASE = 'http://127.0.0.1:3361';
let pass = 0, fail = 0;
const check = (n, c) => { console.log((c ? '✓' : '✗ FEHLER') + '  ' + n); c ? pass++ : fail++; };
async function api(m, p, b) {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}

(async () => {
  // ── Setup: System-Fälle für die Connector-Pulls ──
  await api('POST', '/api/v2/fall/systeme-teamcenter', {});
  await api('POST', '/api/v2/fall/systeme-pim', {});
  await api('POST', '/api/v2/fall/demo-beziehung', {});

  // T1: Mock-Inventar lesbar
  const inv = await api('GET', '/api/v2/connectors/mocks');
  check('T1 Mock-Inventar (teamcenter, pim, erp)', inv.status === 200 && inv.d.teamcenter && inv.d.pim && inv.d.erp);

  // T2: Connector-Pull wird committeter Eingang mit Fundstellen (Commit vor Deutung)
  const pull = await api('POST', '/api/v2/connectors/pull', { system: 'teamcenter', objekt: 'MNR-4711' });
  check('T2 TC-Pull committet im Fall systeme-teamcenter', pull.status === 200 && pull.d.fall === 'systeme-teamcenter' && pull.d.commit);
  check('T3 Pull liefert Fundstellen je Attribut (zitierbar)', Array.isArray(pull.d.sidecar.fundstellen) && pull.d.sidecar.fundstellen.length >= 2 && pull.d.sidecar.fundstellen[0].art === 'connector' && pull.d.sidecar.fundstellen[0].revision === 'C');

  // T4: DER WIDERSPRUCH (Demo-Kern): TC 2,1 vs. PIM 2,3 — Karte mit ZWEI Fundstellen
  const w = await api('POST', '/api/v2/connectors/widerspruch', { systemA: 'teamcenter', systemB: 'pim', objekt: 'MNR-4711' });
  const wid = w.d.widersprueche[0];
  check('T4 Widerspruch erkannt: wanddicke 2,1 vs. 2,3', w.status === 200 && w.d.widersprueche.length === 1 && wid.attribut === 'wanddicke');
  check('T5 Karte mit ZWEI Fundstellen (beide Systeme zitierbar)', wid.wertA.fundstelle.system === 'teamcenter' && wid.wertB.fundstelle.system === 'pim' && wid.wertA.fundstelle.revision === 'C' && wid.karte.frage.includes('2,1') && wid.karte.frage.includes('2,3'));

  // T6: Übereinstimmung wird kein Widerspruch (material: AlMg3 in beiden)
  check('T6 material (AlMg3 beide) NICHT als Widerspruch', !w.d.widersprueche.some(x => x.attribut === 'material'));

  // T7: Anruf-Sitzung eröffnen (C.7)
  const anruf = await api('POST', '/api/v2/fall/demo-beziehung/anruf', {});
  check('T7 Anruf-Sitzung mit sitzungId', anruf.status === 201 && anruf.d.sitzungId.startsWith('anruf-'));

  // T8: Deutung mit Anruf-Fundstelle (Minute statt Seite) — branch-only
  const d = await api('POST', '/api/v2/fall/demo-beziehung/deutung', {
    proposalId: 'anruf-vereinbarung',
    atoms: [
      { feld: 'zusage', wert: 'Dachfertigstellung 15.09.', conf: 0.93, fundstelle: { art: 'anruf', wav: 'docs/anrufe/anruf-2026-08-30.wav', minute: '27:50' } },
    ],
    kartentext: { titel: 'Vereinbart im Anruf', frage: 'Weber zugesagt am 15.09. — übernehmen als Fassung?' },
  });
  check('T8 Anruf-Atom mit Minuten-Fundstelle als Branch', d.status === 201 && d.d.branch && d.d.branch.startsWith('vorschlag/'));
  // Fundstellen-Typ prüfen (vom Branch lesen):
  const { execFileSync } = require('child_process');
  const inhalt = execFileSync('git', ['show', d.d.branch + ':atoms/anruf-vereinbarung.jsonl'], { cwd: '/opt/data/gitchain-ref/vault/demo-beziehung', encoding: 'utf8' });
  const atom = JSON.parse(inhalt.trim());
  check('T9 fundstelle.art=anruf mit wav+minute committet', atom.fundstelle.art === 'anruf' && atom.fundstelle.minute === '27:50' && atom.fundstelle.wav.includes('anruf-2026-08-30.wav'));

  // T10: Unbekanntes System → fail closed
  const badPull = await api('POST', '/api/v2/connectors/pull', { system: 'gibtsnicht', objekt: 'X' });
  check('T10 Unbekanntes System abgelehnt (fail closed)', badPull.status === 400);

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
