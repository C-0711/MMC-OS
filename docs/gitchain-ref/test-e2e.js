// E2E-Test der gitchain-ref Referenz-Instanz — prüft die Spec-Regeln live
'use strict';
const BASE = 'http://127.0.0.1:3361';
let pass = 0, fail = 0;
const check = (name, cond) => { console.log((cond ? '✓' : '✗ FEHLER') + '  ' + name); cond ? pass++ : fail++; };

async function api(method, pfad, body) {
  const res = await fetch(BASE + pfad, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, daten: await res.json().catch(() => ({})) };
}

(async () => {
  // 1. Health
  const h = await api('GET', '/api/v2/health');
  check('T1 /api/v2/health ok (service lebt)', h.status === 200 && h.daten.status === 'ok' && h.daten.service === '@gitchain/ref');

  // 2. Fall anlegen (Kapsel)
  const f = await api('POST', '/api/v2/fall/test-steuern', {});
  check('T2 Fall angelegt (Kapsel)', f.status === 201);

  // 3. Doppelanlegung verweigert
  const f2 = await api('POST', '/api/v2/fall/test-steuern', {});
  check('T3 Doppel-Fall abgelehnt', f2.status === 400);

  // 4. EINGANG: Commit vor Deutung
  const rechnung = Buffer.from('RECHNUNG 2026-118\nMahler & Sohn GmbH\nNetto: 6.263,16 EUR\nUSt 19%: 1.190,00 EUR\nBrutto: 7.453,16 EUR\nZahlbar bis 14.09.2026\nIBAN DE44 *** 7031').toString('base64');
  const e = await api('POST', '/api/v2/fall/test-steuern/eingang', { absender: 'Mahler & Sohn GmbH', kanal: 'mail', nutzlastB64: rechnung, name: 'rechnung-2026-118' });
  check('T4 Eingang committet (sha + doc + commit)', e.status === 201 && e.daten.sha && e.daten.doc && e.daten.commit);
  const docPfad = e.daten.doc;

  // 5. DEUTUNG: mit Fundstelle
  const d = await api('POST', '/api/v2/fall/test-steuern/deutung', {
    proposalId: 'ust-august',
    atoms: [
      { feld: 'ust-betrag', wert: '1.190,00 €', conf: 0.96, fundstelle: { doc: docPfad, zeile: 'USt 19%: 1.190,00 EUR', art: 'dokument' } },
      { feld: 'faellig', wert: '2026-09-14', conf: 0.94, fundstelle: { doc: docPfad, zeile: 'Zahlbar bis 14.09.2026', art: 'dokument' } },
    ],
    kartentext: { titel: 'Umsatzsteuer August', frage: 'Soll ich die USt-Voranmeldung vorbereiten? 1.190,00 €, fällig 14.09.' },
  });
  check('T5 Deutung als Branch-Vorschlag (nie main)', d.status === 201 && d.daten.branch && d.daten.branch.startsWith('vorschlag/'));

  // 6. Atom ohne Fundstelle → abgelehnt (fail closed)
  const dBad = await api('POST', '/api/v2/fall/test-steuern/deutung', { proposalId: 'ohne-quelle', atoms: [{ feld: 'x', wert: 'meinung' }] });
  check('T6 Atom ohne Fundstelle abgelehnt (keine Aussage ohne Beweis)', dBad.status === 400);

  // 7. Zweifel-Spur: niedrige Konfidenz wird markiert
  const dZweifel = await api('POST', '/api/v2/fall/test-steuern/deutung', {
    proposalId: 'zweifel-test', atoms: [{ feld: 'was-auch-immer', wert: 'unsicher', conf: 0.3, fundstelle: { doc: docPfad, zeile: '?' } }],
  });
  const zweifelDatei = `/opt/data/gitchain-ref/vault/test-steuern/.git`; // Existenz-Check Vault
  // Atoms liegen auf dem Branch (branch-only!) — vom Branch lesen:
  const { execFileSync } = require('child_process');
  const branchInhalt = execFileSync('git', ['show', dZweifel.daten.branch + ':atoms/zweifel-test.jsonl'], { cwd: '/opt/data/gitchain-ref/vault/test-steuern', encoding: 'utf8' });
  const atoms = branchInhalt.trim().split('\n').map(JSON.parse);
  check('T7 Zweifel sichtbar markiert (fail closed, nie still)', dZweifel.status === 201 && atoms[0].zweifel === true);

  // 8. Erzählung
  const erz = await api('GET', '/api/v2/fall/test-steuern/erzaehlung');
  check('T8 Erzählung vorhanden (Historie als Sätze — Fall+Eingang auf main, Deutungen als Branches)', erz.status === 200 && erz.daten.saetze.length >= 2);

  // 9. Unbekannter Fall → 404
  const nf = await api('GET', '/api/v2/fall/gibtsnicht/erzaehlung');
  check('T9 Unbekannter Fall 404', nf.status === 404);

  // 10. chain/status ehrlich (kein Chain in der Referenz)
  const cs = await api('GET', '/api/chain/status');
  check('T10 chain/status ehrlich (Referenz ohne Verankerung)', cs.status === 200 && cs.daten.signaturErzwungen === false);

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST-FEHLER:', e.message); process.exit(1); });
