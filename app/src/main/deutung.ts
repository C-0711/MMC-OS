/**
 * deutung.ts — OCR-Ergebnis → Atoms (reine Funktion, testbar ohne Electron)
 *
 * Heuristik für Steuerbelege:
 * - Zeilen mit Geldbeträgen (/\d{1,3}(\.\d{3})*,\d{2}/) werden zu Atoms
 * - Feld = vorangehender Zeilentext oder Zeilenlabel
 * - Fundstelle = {doc, seite, bbox}
 * - conf aus Vision
 */

import * as crypto from 'node:crypto';
import type { OcrErgebnis } from './services';
import type { Atom } from './vault';

// Regex für deutsche Geldbeträge: 1.234,56 oder 1234,56 oder 234,56
const GELDBETRAG_REGEX = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;

// Fallback für Vision-Fehllesungen des Dezimalkommas (gemessen: „21.82" statt
// „21,82", historisch auch „1.053.50" und „25.300 00" — siehe CLAUDE.md §5).
// BEWUSST nur, wenn die GANZE Zeile aus dem Betrag besteht (Betragsspalten
// stehen als eigene Zeile) — sonst würden Datumsangaben wie „28.07" matchen.
const GELDBETRAG_FALLBACK_REGEX = /^\d{1,3}(?:\.\d{3})*[.\s]\d{2}$/;

/** „21.82" → „21,82" · „1.053.50" → „1.053,50" · „25.300 00" → „25.300,00" */
function normalisiereBetrag(t: string): string {
  return t.slice(0, -3) + ',' + t.slice(-2);
}

export interface DeutungErgebnis {
  atoms: Atom[];
  kartentext: {
    titel: string;
    frage: string;
  };
  zweifel: boolean; // true, wenn niedrige Conf oder 0 Beträge
}

export function deutungAusOcr(ocr: OcrErgebnis, docName: string): DeutungErgebnis {
  const atoms: Atom[] = [];
  let betragsZaehler = 0;
  let minConf = 1.0;

  // Über alle Seiten iterieren
  for (const page of ocr.pages) {
    const seite = page.index + 1; // Seite 1-basiert

    // Über alle Zeilen iterieren
    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];
      let betraege = line.text.match(GELDBETRAG_REGEX);
      let fallback = false;

      // Fallback: die ganze Zeile ist ein Betrag mit fehlgelesenem Komma
      if (!betraege && GELDBETRAG_FALLBACK_REGEX.test(line.text.trim())) {
        betraege = [normalisiereBetrag(line.text.trim())];
        fallback = true;
      }

      if (betraege) {
        for (const betrag of betraege) {
          betragsZaehler++;

          // Feld: Text vor dem Betrag; steht der Betrag allein in der Zeile
          // (auch im Fallback), trägt die VORZEILE das Label (Betragsspalten)
          const feldMatch = fallback ? '' : line.text.split(betrag)[0].trim();
          const vorzeile = i > 0 ? page.lines[i - 1].text.trim() : '';
          const feld = feldMatch || vorzeile || `Zeile ${seite}`;

          // Atom-ID: Hash aus doc + seite + bbox + wert
          const atomId = crypto
            .createHash('sha256')
            .update(`${docName}:${seite}:${line.bbox.join(',')}:${betrag}`)
            .digest('hex')
            .substring(0, 12);

          atoms.push({
            id: atomId,
            feld,
            wert: betrag,
            fundstelle: {
              doc: docName,
              seite,
              bbox: line.bbox
            },
            conf: line.conf
          });

          // Niedrigste Konfidenz tracken
          if (line.conf < minConf) {
            minConf = line.conf;
          }
        }
      }
    }
  }

  // Kartentext generieren
  let titel: string;
  let frage: string;

  if (betragsZaehler === 0) {
    titel = 'Kein Geldbetrag erkannt';
    frage = 'Ich finde keine Beträge — magst du selbst schauen?';
  } else if (betragsZaehler === 1) {
    titel = `Ein Betrag erkannt: ${atoms[0].wert}`;
    frage = 'Passt das?';
  } else {
    const beispiel = atoms.slice(0, 3).map(a => a.wert).join(' · ');
    titel = `${betragsZaehler} Beträge erkannt`;
    frage = `Z. B. ${beispiel}${betragsZaehler > 3 ? ' …' : ''} — passt das?`;
  }

  // Zweifel, wenn minConf < 0.7 oder 0 Beträge
  const zweifel = minConf < 0.7 || betragsZaehler === 0;

  return {
    atoms,
    kartentext: { titel, frage },
    zweifel
  };
}

// ============================================================================
// Anruf-Transkripte (kanal: "anruf") — Fristen/Zusagen auf Minuten fundieren
// ============================================================================

export interface TranskriptZeile {
  zeit: string; // "04:12"
  sprecher: string; // "Gerd"
  text: string;
}

export interface Transkript {
  art: 'anruf';
  titel?: string; // "Review & Planning"
  wav: string; // "anruf-2026-08-27.wav"
  dauer?: string; // "42:00"
  zeilen: TranskriptZeile[];
}

/** Erkennt, ob geparstes JSON ein Anruf-Transkript ist (Eingangs-Weiche). */
export function istTranskript(x: unknown): x is Transkript {
  if (typeof x !== 'object' || x === null) return false;
  const t = x as Record<string, unknown>;
  return (
    t.art === 'anruf' &&
    typeof t.wav === 'string' &&
    Array.isArray(t.zeilen) &&
    t.zeilen.every(
      (z: unknown) =>
        typeof z === 'object' && z !== null &&
        typeof (z as TranskriptZeile).zeit === 'string' &&
        typeof (z as TranskriptZeile).text === 'string'
    )
  );
}

// Zusagen: Sätze, in denen jemand etwas verbindlich macht
const ZUSAGE_REGEX = /\b(einverstanden|zugesagt|vereinbart|versprochen|machen wir|frieren wir .* ein|sage ich zu|geht klar|steht im protokoll)\b/i;
// Fristen: Datum (28.07. / 28.07.2026) oder „bis <Wort>"-Formulierungen
const FRIST_REGEX = /\b(\d{1,2}\.\d{1,2}\.(?:\d{2,4})?|bis (?:zum |zur |Ende |nächsten |kommenden )?\p{L}+)\b/iu;

/**
 * Deutung eines Anruf-Transkripts: Zusagen, Fristen und Beträge werden zu
 * Atoms — jede Fundstelle trägt {art:'anruf', wav, minute}. Kein Rechteck:
 * die Zeitmarke ist der Beweis (OsAnrufBeweis).
 */
export function deutungAusTranskript(t: Transkript, docName: string): DeutungErgebnis {
  const atoms: Atom[] = [];

  const pushAtom = (feld: string, wert: string, zeile: TranskriptZeile): void => {
    const atomId = crypto
      .createHash('sha256')
      .update(`${docName}:${zeile.zeit}:${feld}:${wert}`)
      .digest('hex')
      .substring(0, 12);
    atoms.push({
      id: atomId,
      feld,
      wert,
      fundstelle: {
        art: 'anruf',
        doc: docName,
        wav: t.wav,
        minute: zeile.zeit,
        dauer: t.dauer
      },
      conf: 1.0 // Transkript ist Text — keine OCR-Unsicherheit
    });
  };

  for (const zeile of t.zeilen) {
    const sprecher = zeile.sprecher ? `${zeile.sprecher}: ` : '';

    // Beträge zuerst (präzisester Wert)
    const betraege = zeile.text.match(GELDBETRAG_REGEX);
    if (betraege) {
      for (const betrag of betraege) pushAtom(`Betrag (${zeile.sprecher || 'Anruf'})`, betrag, zeile);
    }

    // Zusage: der ganze Satz ist der Wert (die Formulierung zählt)
    if (ZUSAGE_REGEX.test(zeile.text)) {
      pushAtom('Zusage', `${sprecher}${zeile.text}`, zeile);
      continue; // eine Zeile ist entweder Zusage ODER Frist-Kandidat, nicht doppelt
    }

    // Frist: Datum oder „bis …"
    const frist = zeile.text.match(FRIST_REGEX);
    if (frist) {
      pushAtom('Frist', `${sprecher}${zeile.text}`, zeile);
    }
  }

  let titel: string;
  let frage: string;
  const anrufName = t.titel ? `„${t.titel}"` : 'Anruf';
  if (atoms.length === 0) {
    titel = `${anrufName}: nichts Verbindliches erkannt`;
    frage = 'Ich finde keine Zusagen oder Fristen — magst du selbst hören?';
  } else if (atoms.length === 1) {
    titel = `${anrufName}: ${atoms[0].feld} bei Minute ${atoms[0].fundstelle.minute}`;
    frage = 'Stimmt das so?';
  } else {
    titel = `${anrufName}: ${atoms.length} Stellen erkannt`;
    const minuten = atoms.slice(0, 3).map(a => a.fundstelle.minute).join(' · ');
    frage = `Bei Minute ${minuten}${atoms.length > 3 ? ' …' : ''} — stimmt das so?`;
  }

  return {
    atoms,
    kartentext: { titel, frage },
    zweifel: atoms.length === 0
  };
}
