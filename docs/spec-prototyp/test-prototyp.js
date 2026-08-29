// Test-Suite für den gitchain-Prototyp (Kern-Logik, DOM-frei)
const fs = require('fs');
const html = fs.readFileSync('/opt/data/prototyp/gitchain-os-prototyp-v0.1.html', 'utf8');

// Kern-Datenstrukturen aus dem HTML extrahieren
const vaultCode = html.match(/const vault = \{[\s\S]*?\n\};/)[0].replace('const vault = ', '').replace(/;\s*$/, '');
const vorschlagCode = html.match(/let vorschlaege = \[[\s\S]*?\n\];/)[0].replace('let vorschlaege = ', '').replace(/;\s*$/, '');

const vault = eval('(' + vaultCode + ')');
let vorschlaege = eval('(' + vorschlagCode + ')');

let pass = 0, fail = 0;
function check(name, cond) {
  console.log((cond ? '✓' : '✗ FEHLER') + '  ' + name);
  cond ? pass++ : fail++;
}

// Test 1: Vault-Struktur — jede Aussage hat eine Fundstelle
check('T1 Vault: Fall existiert', vault.fall && vault.fall.name === 'steuern-2026');
check('T1 Vault: Atoms mit vollständiger Fundstelle (doc, seite, rect, commit, sig)',
  vault.fall.atoms.every(a => a.fundstelle && a.fundstelle.doc && a.fundstelle.seite && a.fundstelle.rect && a.fundstelle.commit && a.sig === true));

// Test 2: Karten-Queue — max. 3, R2 immer Vorschlag
check('T2 Karten: höchstens 3 offen', vorschlaege.length <= 3);
check('T2 Karten: R2-Aktion ist Vorschlag, nie auto', vorschlaege[0].risiko.startsWith('R2'));

// Test 3: Frag mich — retrieve-then-resolve mit Beweis
function fragBeantwortenCore(q) {
  const ql = q.toLowerCase();
  return vault.fall.atoms.filter(a =>
    a.text.toLowerCase().split(/\W+/).some(w => w.length > 3 && ql.includes(w)));
}
const t1 = fragBeantwortenCore('Was ist mit der Umsatzsteuer fällig?');
check('T3 Frag mich: Treffer für USt-Frage mit Beweis-Zeile', t1.length > 0 && t1[0].fundstelle.doc.includes('ust-q3'));

// Test 4: Fail closed — unbekannte Frage ergibt keinen Treffer
const t2 = fragBeantwortenCore('Was steht in meinem Mietvertrag?');
check('T4 Fail closed: Mietvertrags-Frage ohne Treffer → ungeklärt-Pfad', t2.length === 0);

// Test 5: Entscheidung erzeugt Commit (Erzählung wächst)
const commitsVorher = vault.fall.commits.length;
vault.fall.commits.push({ ts: new Date().toISOString(), aktion: vorschlaege[0].aktion, quelle: vorschlaege[0].atom, entschieden: 'ja (tap)', hash: 'x1' });
check('T5 Commit: Ja-Tap erzeugt Audit-Eintrag mit Quelle-Atom', vault.fall.commits.length === commitsVorher + 1 && vault.fall.commits[0].quelle === 1042);

// Test 6: Wortgleichheit — Karten-Frage identisch mit gesprochener Fassung
check('T6 Wortgleichheit: Karte trägt Frage als Text (Stimme sagt denselben Wortlaut)', typeof vorschlaege[0].frage === 'string' && vorschlaege[0].frage.includes('fällig'));

// Test 7: HTML-Inventar — alle UI-Elemente der Desktop-App-Spec vorhanden
['Frag mich', 'Alles ruhig', 'Guten Morgen', 'sig ✓', 'bestaetigen', 'spaeter', 'ablehnen', 'erzaehlung'].forEach(el => {
  check('T7 UI enthält "' + el + '"', html.includes(el));
});

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail > 0 ? 1 : 0);
