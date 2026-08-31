/**
 * suche.ts — Frag alles: der Brain über ALLE Fälle (Datenkanal T5).
 *
 * OsSuche/OsMixAntwort brauchen eine Suche, die nicht in einem Fall bleibt:
 * Frage rein → Atom-Kontext über alle Fälle sammeln → vLLM (fragMich) →
 * Antwort mit Zitaten + Ehrlichkeitszeile.
 *
 * Ehrlichkeit (Canvas-Gesetz): fehlender Kontext wird benannt, nie still
 * entschieden. Wenn der vLLM nicht erreichbar ist, sagen wir das — der
 * Renderer zeigt den Leer-/Fehler-Satz statt zu raten.
 */

import * as vault from './vault';
import * as services from './services';

export interface SuchTreffer {
  fall: string;
  doc: string;
  seite: number;
  text: string;
  feld: string;
  wert: string;
}

export interface SuchErgebnis {
  frage: string;
  antwort: string;          // vLLM-Antwort mit [n]-Belegen
  treffer: SuchTreffer[];   // die Fundstellen (Renderer baut Quellzeilen daraus)
  ehrlich: boolean;         // true = unvollständig/kein Dienst — Antwort sagt es selbst
}

/** Atome aller Fälle → Suchtreffer (max ~40, gewichtet nach Fragen-Overlap). */
async function sammleKontext(frage: string): Promise<SuchTreffer[]> {
  const faelle = await vault.listFaelle();
  const woerter = new Set(
    frage.toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w => w.length > 3)
  );

  const treffer: Array<SuchTreffer & { score: number }> = [];
  for (const fall of faelle) {
    const atomDateien = await vault.listAtomsMain(fall.id).catch(() => []);
    for (const { atoms } of atomDateien) {
      for (const a of atoms) {
        const bag = `${a.feld} ${a.wert}`.toLowerCase();
        let score = 0;
        for (const w of woerter) if (bag.includes(w)) score += 1;
        treffer.push({
          fall: fall.id,
          doc: a.fundstelle.doc,
          seite: a.fundstelle.seite ?? 1,
          text: `${a.feld}: ${a.wert}`,
          feld: a.feld,
          wert: a.wert,
          score,
        });
      }
    }
  }

  // B4 — Kontext-Deckelung: Top-k nach Relevanz + Token-Budget.
  // Hunderte Betrag-Atoms aus einem Katalog reißen den 30s-Timeout —
  // Fundstellen mit Score 0 (kein Fragen-Overlap) fliegen zuerst raus,
  // dann kürzt das Token-Budget von hinten (niedrigste Relevanz zuerst).
  const MAX_TREFFER = 25;
  const MAX_TOKEN_SCHAETZ = 6000; // ~4 Zeichen/Token, großzügig gegen Prompt-Limit
  const gereiht = treffer.sort((x, y) => y.score - x.score);

  // 1. Ohne Überlappung raus (außer ganz wenige als Kontext-Farbe)
  const relevante = gereiht.filter(t => t.score > 0);
  const rest = gereiht.filter(t => t.score === 0);

  // 2. Top-k der relevanten, Rest als maximal 5 stille Beigaben
  const top = relevante.slice(0, MAX_TREFFER);
  const beigaben = rest.slice(0, Math.max(0, MAX_TREFFER - top.length));

  // 3. Token-Budget von hinten abschneiden (niedrigste Relevanz zuerst weg)
  const ausgewaehlt: Array<SuchTreffer & { score: number }> = [];
  let budget = MAX_TOKEN_SCHAETZ;
  for (const t of [...top, ...beigaben]) {
    const kosten = Math.ceil((t.text.length + t.doc.length + 20) / 4);
    if (kosten > budget && ausgewaehlt.length >= 8) break; // Mindest-Kontext behalten
    ausgewaehlt.push(t);
    budget -= kosten;
  }

  return ausgewaehlt.map(({ score: _s, ...t }) => t);
}

/** Frag alles — über alle Fälle, mit Zitat-Pflicht. */
export async function fragAlles(frage: string): Promise<SuchErgebnis> {
  const treffer = await sammleKontext(frage);

  const kontext: services.ZitatKontext[] = treffer.map(t => ({
    fall: t.fall,
    doc: t.doc,
    seite: t.seite,
    text: t.text,
  }));

  let antwort: string;
  let ehrlich = false;
  try {
    const r = await services.fragMich(frage, kontext);
    antwort = r.antwort;
    // Der System-Prompt erzwingt die "Fehlt:"-Zeile — wir erkennen sie,
    // damit der Renderer die Ehrlichkeitszeile hervorheben kann.
    ehrlich = /Fehlt:/.test(antwort) || kontext.length === 0;
  } catch (err) {
    // Kein vLLM (VPN weg, Dienst unten): ehrlich bleiben, nicht raten.
    return {
      frage,
      antwort: 'Das kann ich ehrlich gerade nicht beantworten — der Dienst für belegte Antworten ist nicht erreichbar. Deine Dokumente liegen vollständig bei dir; sobald der Dienst wieder da ist, antworte ich mit Beleg.',
      treffer,
      ehrlich: true,
      fehler: String(err),
    } as SuchErgebnis & { fehler: string };
  }

  return { frage, antwort, treffer, ehrlich };
}
