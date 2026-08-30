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
