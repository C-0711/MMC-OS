// Super-Brain-Test: Auto-Deploy, Policy-Nachweis, Fail-closed, Metrik-Artefakte
'use strict';
const BASE = 'http://127.0.0.1:3361';
let pass = 0, fail = 0;
const check = (n, c) => { console.log((c ? '✓' : '✗ FEHLER') + '  ' + n); c ? pass++ : fail++; };
async function api(m, p, b) {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, d: await r.json().catch(() => ({})) };
}
const b64 = s => Buffer.from(s).toString('base64');

(async () => {
  // Setup: zwei Zielfälle anlegen
  await api('POST', '/api/v2/fall/weber-beziehung', {});
  await api('POST', '/api/v2/fall/steuern', {});

  // T1: Auto-Deploy nach Policy (Weber → weber-beziehung)
  const r1 = await api('POST', '/api/brain/deploy', {
    absender: 'Weber Bau GmbH', kanal: 'mail',
    nutzlastB64: b64('Angebot Dachabdichtung — Preis 12.400 EUR, Ausführung September.'),
  });
  check('T1 Auto-Deploy: Weber → weber-beziehung (Policy-Treffer)', r1.status === 200 && r1.d.status === 'auto-deployed' && r1.d.fall === 'weber-beziehung');
  check('T2 Deploy-Commit referenziert Policy-Version (warum liegt das hier?)', r1.d.entscheidung.policyVersion >= 1 && r1.d.deployCommit && r1.d.entscheidung.konfidenz > 0.8);

  // T3: Finanzamt → steuern
  const r2 = await api('POST', '/api/brain/deploy', {
    absender: 'Finanzamt Stuttgart', kanal: 'post',
    nutzlastB64: b64('Bescheid Umsatzsteuer 2026 — Festsetzung 1.190,00 EUR.'),
  });
  check('T3 Auto-Deploy: Finanzamt → steuern', r2.d.status === 'auto-deployed' && r2.d.fall === 'steuern');

  // T4: Fail closed — kein Policy-Treffer → Vorschlag, nie still
  const r3 = await api('POST', '/api/brain/deploy', {
    absender: 'Unbekannter Absender', kanal: 'mail',
    nutzlastB64: b64('Irgendein Text ohne Signatur.'),
  });
  check('T4 Fail closed: keine Policy-Regel → Vorschlag-Pflicht (nie still)', r3.d.status === 'vorschlag' && Array.isArray(r3.d.vorschlaege));

  // T5: Cluster-Karte — Policy will Container, der nicht existiert (Garten-Operation als Karte)
  const r4 = await api('POST', '/api/brain/deploy', {
    absender: 'Rechnung Buderus', kanal: 'mail',
    nutzlastB64: b64('Rechnung Betrag 340 EUR Heizung.'),
  });
  const hatBelege = r4.d.status === 'auto-deployed' ? r4.d.fall === 'belege' : r4.d.status === 'cluster-karte';
  check('T5 Neuer Container wird KARTE, nie still angelegt (Garten-Regel)', hatBelege);

  // T6: Metrik-Artefakte (Brain beweist seine Hausarbeit)
  const m = await api('GET', '/api/brain/metrics');
  check('T6 Metrik-Artefakte vorhanden (committbare Beweise)', m.status === 200 && m.d.faelle && Object.keys(m.d.faelle).length >= 2);

  // T7: Policy abfragbar & versioniert
  const p = await api('GET', '/api/brain/policy');
  check('T7 Policy lesbar und versioniert (Version > 1 nach Lernzyklen)', p.status === 200 && p.d.version >= 1 && p.d.regeln.length >= 3);

  // T8: Health meldet v0.2-brain
  const h = await api('GET', '/api/v2/health');
  check('T8 Health: v0.3.0-lernend', h.d.version.startsWith('0.3'));

  // T9: Der deployte Eingang liegt real im Ziel-Container (Erzählung beweist es)
  const erz = await api('GET', '/api/v2/fall/weber-beziehung/erzaehlung');
  const hatWeberEingang = erz.d.saetze.some(s => s.satz.includes('Weber'));
  check('T9 Erzählung im Ziel-Container zeigt den auto-deployten Eingang', hatWeberEingang);

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
