/**
 * notebook.ts — NotebookAI auf dem eigenen Schatz (Spec 23).
 *
 * Drei Fähigkeiten, alle NUR aus den eigenen Dokumenten (Beweis-Pflicht):
 *   1. fragen        — wie die Suche, aber antwort-orientiert (schon da: suche.ts)
 *   2. sammeln       — der Nutzer wählt Quellen an (Dokumente/Themen/Treffer)
 *   3. bauen         — aus der Auswahl entstehen Erzeugnisse: Zusammenfassung,
 *                      Vergleichstabelle, Datenblatt-Sammlung, Arbeitsblatt.
 *                      Jedes Erzeugnis trägt [n]-Fundstellen — beweisbar oder
 *                      es entsteht nicht.
 *
 * Formen (Canvas FallStudio/FallErzeugnis): Das Erzeugnis erscheint als
 * Form-5-Ding im Strom mit EINEM Öffnen-Griff.
 */

import * as vault from './vault';
import * as services from './services';

export interface Quelle {
  fall: string;
  doc: string;
  seite: number;
  text: string;        // Atom-Text als Kontext
  feld: string;
  wert: string;
}

export interface Erzeugnis {
  art: 'zusammenfassung' | 'vergleich' | 'datensammlung' | 'arbeitsblatt';
  titel: string;
  inhalt: string;         // Markdown mit [n]-Zitaten
  quellen: string[];       // „fall · doc · Seite N"
  zeitIso: string;
}

/** Quellen sammeln: nach Frage ODER explizite Dokument-Liste. */
export async function sammleQuellen(
  frage: string | null,
  fallIds: string[],
  docs: string[] | null
): Promise<Quelle[]> {
  const alleFaelle = await vault.listFaelle();
  const alle = fallIds.length > 0
    ? fallIds.filter(id => alleFaelle.some(f => f.id === id))
    : alleFaelle.map(f => f.id);

  const woerter = frage
    ? new Set(frage.toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w => w.length > 3))
    : null;

  const quellen: Array<Quelle & { score: number }> = [];
  const gesehen = new Set<string>();
  const pushAtom = (fid: string, a: vault.Atom, unbestaetigt: boolean): void => {
    if (docs && !docs.some(d => a.fundstelle.doc.includes(d))) return;
    const key = `${fid}|${a.fundstelle.doc}|${a.feld}|${a.wert}`;
    if (gesehen.has(key)) return;
    gesehen.add(key);

    const text = unbestaetigt
      ? `${a.feld}: ${a.wert} (unbestätigt)`
      : `${a.feld}: ${a.wert}`;
    let score = 0;
    if (woerter) {
      const bag = text.toLowerCase();
      for (const w of woerter) if (bag.includes(w)) score += 1;
    }
    quellen.push({
      fall: fid,
      doc: a.fundstelle.doc,
      seite: a.fundstelle.seite ?? 1,
      text,
      feld: a.feld,
      wert: a.wert,
      score,
    });
  };

  for (const fid of alle) {
    // Bestätigtes Wissen zuerst (gemergt auf main), danach offene
    // Vorschläge als unbestätigt — beide sind echte Fundstellen aus
    // den eigenen Dokumenten (Beweis-Pflicht bleibt).
    const atomDateien = await vault.listAtomsMain(fid).catch(() => []);
    for (const { atoms } of atomDateien) {
      for (const a of atoms) pushAtom(fid, a, false);
    }
    const vorschlaege = await vault.listVorschlaege(fid).catch(() => []);
    for (const v of vorschlaege) {
      for (const a of v.atoms) pushAtom(fid, a, true);
    }
  }

  const gereiht = quellen.sort((x, y) => y.score - x.score);
  // Top-k + Budget (gleiche Deckel wie suche.ts — kein Timeout-Riss)
  const top = woerter ? gereiht.filter(q => q.score > 0).slice(0, 25) : gereiht.slice(0, 40);
  return top.map(({ score: _s, ...q }) => q);
}

// ============================================================================
// Bauen — Erzeugnisse mit Zitat-Pflicht
// ============================================================================

const STUDIO_PROMPT = `Du bist der Studio-Partner von gitchain OS. Deutsch, sachlich, präzise.

Regeln:
1. Stütze dich AUSSCHLIESSLICH auf die mitgegebenen Fundstellen [n]. Nichts erfinden, keine Weltwissen-Werte.
2. Jede Aussage trägt ihre Fundstellen-Nummer in Klammern — eine Aussage ohne [n] zählt nicht.
3. Baue das geforderte Erzeugnis in der geforderten Form (Markdown):
   - zusammenfassung: fließender Text mit Abschnitten
   - vergleich: Markdown-Tabelle, Zeilen = Objekte, Spalten = Eigenschaften, jede Zelle mit [n]
   - datensammlung: Liste der Fakten je Objekt, mit [n]
   - arbeitsblatt: Checkliste mit Kontrollkästchen (- [ ]), jede Aufgabe mit [n]
4. Zahlen exakt wie in der Fundstelle (deutsches Format).
5. Was fehlt, sagst du in einer Schlusszeile "Fehlt: …". Rate nie.`;

export async function baueErzeugnis(
  art: Erzeugnis['art'],
  thema: string,
  quellen: Quelle[]
): Promise<Erzeugnis> {
  const fundstellen = quellen
    .map((q, i) => `[${i + 1}] Fall "${q.fall}", ${q.doc}, Seite ${q.seite}:\n${q.text}`)
    .join('\n\n');

  const artBeschreibung: Record<Erzeugnis['art'], string> = {
    zusammenfassung: 'eine Zusammenfassung',
    vergleich: 'eine Vergleichstabelle',
    datensammlung: 'eine Datensammlung',
    arbeitsblatt: 'ein Arbeitsblatt (Checkliste)',
  };

  try {
    const r = await services.fragMich(
      `Erzeuge ${artBeschreibung[art]} zum Thema: ${thema}. Nutze dafür ausschließlich die Fundstellen.`,
      quellen.map((q, i) => ({ fall: q.fall, doc: q.doc, seite: q.seite, text: `[${i + 1}] ${q.text}` }))
    );

    return {
      art,
      titel: thema,
      inhalt: r.antwort,
      quellen: quellen.map(q => `${q.fall} · ${q.doc} · Seite ${q.seite}`),
      zeitIso: new Date().toISOString(),
    };
  } catch (err) {
    // Ehrlichkeit statt Raten (Canvas-Gesetz): ohne Dienst kein Erzeugnis.
    throw new Error(`Dienst nicht erreichbar: ${String((err as Error).message || err).slice(0, 120)}`);
  }
}

// ============================================================================
// Studio-Brief: was liegt im Schatz? (Themen-Vorschläge zum Bauen)
// ============================================================================

export interface StudioThema {
  name: string;
  anzahlQuellen: number;
  beispiele: string[];   // bis 3 Atom-Werte als Vorschau
}

/** Die Bausteine-Themen aus dem eigenen Schatz — wofür sich Bauen lohnt. */
export async function studioThemen(): Promise<StudioThema[]> {
  const faelle = await vault.listFaelle();
  const themen = new Map<string, { n: number; beispiele: string[] }>();

  const zaehle = (fid: string, atoms: vault.Atom[]): void => {
    for (const a of atoms) {
      const stamm = a.fundstelle.doc.replace(/^\d{4}-\d{2}-\d{2}T[\d-]+Z-/, '').replace(/\.[^.]+$/, '');
      const key = stamm.replace(/[-_]/g, ' ').slice(0, 40);
      const eintrag = themen.get(key) ?? { n: 0, beispiele: [] };
      eintrag.n += 1;
      if (eintrag.beispiele.length < 3) eintrag.beispiele.push(a.wert.slice(0, 40));
      themen.set(key, eintrag);
    }
  };
  for (const fall of faelle) {
    const atomDateien = await vault.listAtomsMain(fall.id).catch(() => []);
    for (const { atoms } of atomDateien) zaehle(fall.id, atoms);
    const vorschlaege = await vault.listVorschlaege(fall.id).catch(() => []);
    for (const v of vorschlaege) zaehle(fall.id, v.atoms);
  }

  return [...themen.entries()]
    .map(([name, t]) => ({ name, anzahlQuellen: t.n, beispiele: t.beispiele }))
    .sort((x, y) => y.anzahlQuellen - x.anzahlQuellen)
    .slice(0, 12);
}
