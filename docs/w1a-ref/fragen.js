'use strict';
// fragen.js — Frage-Vorschläge aus Atomen + Antwort-Bau mit Beleg-Zitaten.
// Regeln (NACHTSCHICHTPAKET W1a §2.3): max 3 Vorschläge, je ein Typ pro Frage,
// jeder mit atomRef, Bürger-Ton. Antwort auf /ask: Beleg-Zitate "[1] datei · Seite N".

// frageVorschlaege(atome) -> [{text, atomRef}]
function frageVorschlaege(atome) {
  const fragen = [];

  const rechnung = atome.find((a) => a.typ === 'rechnung_betrag' || a.typ === 'rechnung_faellig');
  if (rechnung) {
    fragen.push({
      text: 'Welche Rechnungen sind noch offen und bis wann muss ich sie bezahlen?',
      atomRef: rechnung.ref,
    });
  }

  const kaution = atome.find((a) => a.typ === 'vertrag_geld' && /kaution/i.test(a.text || ''));
  const laufzeit = atome.find((a) => a.typ === 'vertrag_laufzeit');
  const vertragAtom = kaution || laufzeit || atome.find((a) => a.typ === 'vertrag_geld');
  if (vertragAtom) {
    fragen.push({
      text: kaution
        ? 'Was steht in meinem Vertrag zur Kaution?'
        : 'Wie lange läuft mein Vertrag noch?',
      atomRef: vertragAtom.ref,
    });
  }

  const absender = atome.find((a) => a.typ === 'absender');
  if (absender) {
    fragen.push({
      text: 'Wer ist der Absender dieser Post und wie erreiche ich ihn?',
      atomRef: absender.ref,
    });
  }

  return fragen.slice(0, 3);
}

// buildAntwort(frage, verarbeiteteAtome, ausstehendeDokumente)
// -> {text, zitiert, ehrlich}
// Antwortet NUR aus bereits verarbeiteten Atomen. Findet sich kein
// zutreffendes Atom, kommt der Ehrlichkeits-Satz statt einer Antwort.
function buildAntwort(frage, atome, ausstehendeNamen) {
  const q = (frage || '').toLowerCase();
  const woerter = new Set(q.split(/[^a-zäöüß0-9]+/i).filter((w) => w.length > 3));

  // Scoring: Overlap zwischen Frage und Atom-Text/Wert/Typ
  function score(atom) {
    const bag = `${atom.typ} ${atom.text || ''} ${atom.wert || ''} ${atom.datei}`.toLowerCase();
    let s = 0;
    for (const w of woerter) if (bag.includes(w)) s += 1;
    if (/rechnung|offen|bezahlen|betrag/.test(q) &&
        (atom.typ === 'rechnung_betrag' || atom.typ === 'rechnung_faellig')) s += 2;
    if (/vertrag|kaution|laufzeit|miete|versicherung/.test(q) &&
        (atom.typ.startsWith('vertrag_'))) s += 2;
    if (/absender|kontakt|erreichen|wer/.test(q) && atom.typ === 'absender') s += 2;
    return s;
  }

  const treffer = atome
    .map((a) => ({ a, s: score(a) }))
    .filter((x) => x.s >= 2)
    .sort((x, y) => y.s - x.s)
    .slice(0, 3)
    .map((x) => x.a);

  if (treffer.length === 0) {
    const rest = ausstehendeNamen && ausstehendeNamen.length
      ? ` Die restlichen ${ausstehendeNamen.length} Dokumente lese ich noch — sobald sie fertig sind, kann ich diese Frage beantworten.`
      : ' Ich habe zu dieser Frage noch nichts in deinen Dokumenten gefunden.';
    return {
      text: 'Das kann ich ehrlich noch nicht sagen — die Antwort steckt vermutlich in Dokumenten, die ich noch lese.' + rest,
      zitiert: false,
      ehrlich: true,
    };
  }

  const sätze = [];
  const zitate = [];
  treffer.forEach((a, i) => {
    let satz;
    if (a.typ === 'rechnung_betrag') {
      satz = `Es gibt eine Rechnung über ${a.wert} EUR`;
    } else if (a.typ === 'rechnung_faellig') {
      satz = `Die Fälligkeit ist der ${a.wert}`;
    } else if (a.typ === 'absender') {
      satz = `Als Absender ist "${a.wert}" vermerkt`;
    } else if (a.typ === 'vertrag_laufzeit') {
      satz = `Zur Laufzeit steht da: ${a.wert}`;
    } else {
      satz = `In deinem Vertrag steht: ${a.text}`;
    }
    sätze.push(satz);
    zitate.push(`[${i + 1}] ${a.datei} · Seite ${a.seite}`);
  });

  return {
    text: `${sätze.join('. ')}. ${zitate.join(' ')}`,
    zitiert: true,
    ehrlich: false,
    zitate,
  };
}

module.exports = { frageVorschlaege, buildAntwort };
