// Test: Korrektur-Lernen — der komplette Lernzyklus (Spec super-brain §4.1)
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
  // Setup: Ziel-Fall für die Korrektur
  await api('POST', '/api/v2/fall/ctax-projekt', {});

  // T1: Erste "Anders"-Antwort → Korrektur-Commit, noch KEIN Vorschlag
  const k1 = await api('POST', '/api/brain/korrektur', {
    absender: 'Gerd Meixner', gezogenNach: 'belege', korrigiertNach: 'ctax-projekt',
    deployRef: 'deploy-001', grund: 'gehört ins Projekt',
  });
  check('T1 1. Korrektur gespeichert (Memory-Commit mit learned_from)', k1.d.korrekturenZaehler === 1 && !k1.d.vorschlag);

  // T2-T3: Zweite Korrektur — immer noch kein Vorschlag
  await api('POST', '/api/brain/korrektur', { absender: 'Gerd Meixner', gezogenNach: 'belege', korrigiertNach: 'ctax-projekt', deployRef: 'deploy-002' });
  const k3 = await api('POST', '/api/brain/korrektur', { absender: 'Gerd Meixner', gezogenNach: 'belege', korrigiertNach: 'ctax-projekt', deployRef: 'deploy-003' });
  check('T2 Nach 3 Korrekturen: Policy-Anpassung wird selbst VORSCHLAG (four-eyes)', k3.d.korrekturenZaehler === 3 && k3.d.vorschlag && k3.d.vorschlag.status === 'offen');

  // T3: Vorschlag enthält die konkrete Regel + Beweis-Basis
  const basisOk = k3.d.vorschlag.basis && k3.d.vorschlag.basis.length === 3;
  check('T3 Vorschlag beweist seine Basis (3 Korrektur-Zeitpunkte)', basisOk);

  // T4: Lern-Historie einsehbar (was hat die KI gelernt?)
  const l = await api('GET', '/api/brain/lernen');
  check('T4 Lern-Historie lesbar (diffbar, jede Korrektur mit Quelle)', l.status === 200 && l.d.korrekturen.length >= 4);

  // T5: Signatur → Policy-Version steigt, gelernte Regel aktiv
  const alt = (await api('GET', '/api/brain/policy')).d;
  const s = await api('POST', '/api/brain/policy/annehmen', { vorschlagTs: k3.d.vorschlag.ts });
  const neu = (await api('GET', '/api/brain/policy')).d;
  check('T5 Unterschrift: Policy v' + alt.version + ' → v' + neu.version + ', gelernte Regel aktiv', s.d.neueVersion === alt.version + 1 && neu.regeln.some(r => r.gelernt));

  // T6: DER BEWEIS: neuer Deploy folgt jetzt der gelernten Regel
  const dep = await api('POST', '/api/brain/deploy', {
    absender: 'Gerd Meixner', kanal: 'mail',
    nutzlastB64: b64('Noch eine Nachricht von Gerd — sollte jetzt automatisch ins Projekt gehen.'),
  });
  check('T6 GELERNT: neuer Eingang von Gerd → ctax-projekt (ohne Rückfrage!)', dep.d.status === 'auto-deployed' && dep.d.fall === 'ctax-projekt' && dep.d.entscheidung.policyVersion === neu.version);

  // T7: Doppelter Vorschlag wird nicht erzeugt (kein Spam)
  const k4 = await api('POST', '/api/brain/korrektur', { absender: 'Gerd Meixner', gezogenNach: 'belege', korrigiertNach: 'ctax-projekt', deployRef: 'deploy-004' });
  check('T7 Kein zweiter Vorschlag für dieselbe Korrektur (kein Lern-Spam)', !k4.d.vorschlag);

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
