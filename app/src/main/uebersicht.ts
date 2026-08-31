/**
 * uebersicht.ts — Fall-Übersicht für OsFall & Heute (Datenkanal T1).
 *
 * Baut aus bestehenden Vault-Strecken (fallErzaehlung, listAtomsMain,
 * listVorschlaege) eine Screen-taugliche Übersicht:
 *   dinge       — offene Karten („Ein Ding wartet.")
 *   protokoll   — Erzähl-Sätze (Fall-Geschichte)
 *   beteiligte  — Absender/Partner aus Atomen („Gerd · Stefan · extern")
 *
 * Alles NUR im Main-Prozess — der Renderer fragt über IPC.
 */

import * as vault from './vault';

export interface Ding {
  titel: string;
  frage: string;
  quelle: string;        // „mitschrift-… · Minute 27:50" | „rechnung-… · Seite 1"
  proposalId: string | null;  // null = nur Erinnerung, kein bestätigbarer Vorschlag
}

export interface FallUebersicht {
  fallId: string;
  dinge: Ding[];
  protokoll: vault.ErzaehlSatz[];
  beteiligte: string[];
}

/** Fundstelle als menschliche Zeile („datei · Seite N" | „datei · Minute MM:SS"). */
function fundstelleZeile(f: vault.Fundstelle): string {
  if (f.art === 'anruf' && f.minute) return `${f.doc} · Minute ${f.minute}`;
  return `${f.doc} · Seite ${f.seite ?? 1}`;
}

export async function getFallUebersicht(fallId: string): Promise<FallUebersicht> {
  // Protokoll: die Fall-Geschichte (wirft, wenn der Fall nicht existiert)
  const protokoll = await vault.fallErzaehlung(fallId);

  // Offene Vorschläge → Ding-Karten („stimmt das?"-Fragen)
  const vorschlaege = await vault.listVorschlaege(fallId);
  const dinge: Ding[] = vorschlaege.slice(0, 5).map(v => {
    const atom = v.atoms[0];
    const quelle = atom ? fundstelleZeile(atom.fundstelle) : 'Fall';
    return {
      titel: v.kartentext?.titel ?? 'Karte',
      frage: v.kartentext?.frage ?? '',
      quelle,
      proposalId: v.id,
    };
  });

  // Beteiligte: Absender-Werte aus den Atomen auf main, dedupliziert, max 6
  const atomDateien = await vault.listAtomsMain(fallId);
  const namen = new Set<string>();
  for (const { atoms } of atomDateien) {
    for (const a of atoms) {
      if (/absender|partner|sprecher/i.test(a.feld) && a.wert) {
        namen.add(String(a.wert));
      }
      if (namen.size >= 6) break;
    }
    if (namen.size >= 6) break;
  }
  const beteiligte = [...namen];
  if (beteiligte.length === 0) beteiligte.push('extern');

  return { fallId, dinge, protokoll, beteiligte };
}
