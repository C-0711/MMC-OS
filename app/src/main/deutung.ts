/**
 * deutung.ts — OCR-Ergebnis → Atoms (reine Funktion, testbar ohne Electron)
 *
 * W1a-Geist (NACHTSCHICHTPAKET §2): „der Bericht nennt NAMEN aus deinen
 * Dokumenten in Sekunden" — Deutung ist SEMANTISCH, nicht nur Beträge:
 * - Absender/Von-Zeilen → Name (das Wichtigste: WER schreibt mir?)
 * - Geldbeträge mit Feld-Kontext (Rechnungsbetrag, Umsatzsteuer, …)
 * - Daten (TT.MM.JJJJ) mit Feld (Fällig am, …)
 * - Dokument-Art erkennen (Rechnung, Vertrag, Brief, Katalog, …) — nie
 *   pauschal „Beleg" wenn der Inhalt etwas anderes ist.
 * - Fundstelle = {doc, seite, bbox} — jede Aussage trägt ihre Stelle.
 */

import * as crypto from 'node:crypto';
import type { OcrErgebnis } from './services';
import type { Atom } from './vault';

// Regex für deutsche Geldbeträge: 1.234,56 oder 1234,56 oder 234,56
const GELDBETRAG_REGEX = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;

// Fallback für Vision-Fehllesungen des Dezimalkommas (CLAUDE.md §5).
// BEWUSST nur, wenn die GANZE Zeile aus dem Betrag besteht.
const GELDBETRAG_FALLBACK_REGEX = /^\d{1,3}(?:\.\d{3})*[.\s]\d{2}$/;

/** „21.82" → „21,82" · „1.053.50" → „1.053,50" */
function normalisiereBetrag(t: string): string {
  return t.slice(0, -3) + ',' + t.slice(-2);
}

// Datum: 15.09.2026 oder 15.09.26
const DATUM_REGEX = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;

// Absender-Zeilen — B5.3: DOPPELPUNKT pflicht. Ein nacktes „von " frisst
// deutschen Fließtext („von Ausdehnungsgefäßen ohne Entleerung der Anlage…").
const ABSENDER_REGEX = /^\s*(?:von|absender|from)\s*:\s*(.+)$/i;

// Dokument-Arten — B5.2: GEWICHTET statt first-match. Trefferzahl je
// Muster zählt; Werkstoff-Signale wiegen schwerer — ein einzelnes
// „Rechnung"-Wort in den Bestellhinweisen eines Katalogs verliert
// gegen die Artikel-Nummern-Serie.
const ART_MUSTER: Array<[RegExp, string, number]> = [
  [/rechnung|rechnungs?nr|kostenstelle|leistungszeitraum/i, 'Rechnung', 1],
  [/vertrag|mietvertrag|versicherungs(schein|vertrag)|laufzeit/i, 'Vertrag', 1],
  [/bescheid|finanzamt|steuer|vorauszahlung/i, 'Bescheid', 1],
  [/mahnu?ng|zahlungserinnerung/i, 'Mahnung', 1],
  [/angebot|kostenvoranschlag/i, 'Angebot', 1],
  [/police|versicherungsschein|beitrag/i, 'Police', 1],
  [/termin|einladung|besprechung/i, 'Termin', 1],
  [/brief|sehr geehrte|r?und freundlichen gr/i, 'Brief', 1],
  [/katalog|artikel-?nr|artikelnummer|materialnummer|\bart\.?-?nr/i, 'Katalog', 3],
  [/datenblatt|handbuch|brosch(ü|ue)re|technische daten/i, 'Datenblatt', 3],
];

export interface DeutungErgebnis {
  atoms: Atom[];
  kartentext: {
    titel: string;
    frage: string;
    /** B5.1: Deutungs-Version — alte Vorschläge werden neu gedeutet */
    deutungV?: number;
  };
  /** B5.2: Werkstoff erzeugt KEINE Frage-Karte (frühestens eine leise
   * Bestätigung) — der Renderer filtert daran. */
  gattung: Gattung;
  zweifel: boolean;
}

/**
 * B5.2 — die ZWEI Gattungen (B3-Tabelle): Beleg (an dich gerichtet) vs.
 * Werkstoff (über die Welt: Katalog, Handbuch, Datenblatt, Broschüre).
 * Werkstoff → Sanduhr: still committen, NULL „passt das?"-Fragen.
 */
export type Gattung = 'beleg' | 'werkstoff';

/** Heuristik (aus dem B3-Befund): viele Seiten · Preislisten in Serie ·
 * Artikel-Nummern-Serien · kein Adressat → Werkstoff. */
export function erkenneGattung(ocr: OcrErgebnis, zeilen: string[]): Gattung {
  const alles = zeilen.join('\n');
  const hatAdressat = /sehr geehrte|an\s+herrn|an\s+frau|kunden-?nr/i.test(alles);

  const artikelSerien = (alles.match(/(?:artikel|art|mat|material)[-\s.]*(?:nr|nummer)?[-\s.]?\d{3,}/gi) || []).length;
  const preisZeilen = zeilen.filter(z => /\d{1,3}(?:\.\d{3})*,\d{2}/.test(z)).length;

  if (!hatAdressat && (ocr.pagesTotal >= 8 || artikelSerien >= 5 || preisZeilen >= 15)) {
    return 'werkstoff';
  }
  return 'beleg';
}

/** Aktuelle Deutungs-Version (B5.1): Vorschläge tragen sie im kartentext
 * mit; beim Laden werden ältere still zurückgezogen und neu gedeutet. */
export const DEUTUNG_VERSION = 2;

/** Dokument-Art aus dem Gesamttext — gewichtet (B5.2): Treffer × Gewicht. */
function erkenneArt(zeilenText: string[]): string {
  const alles = zeilenText.join('\n');
  let beste: string | null = null;
  let bestePunkte = 0;
  for (const [muster, art, gewicht] of ART_MUSTER) {
    const treffer = (alles.match(new RegExp(muster.source, 'gi')) || []).length;
    const punkte = treffer * gewicht;
    if (punkte > bestePunkte) {
      beste = art;
      bestePunkte = punkte;
    }
  }
  return beste ?? 'Dokument';
}

/** Das semantisch beste Atom als Karten-Titel — Name > Betrag > Datum. */
function kartenTitel(art: string, atoms: Atom[]): string {
  const name = atoms.find(a => a.feld === 'Absender');
  if (name) return `${art} von ${name.wert}`;
  const betrag = atoms.find(a => a.feld.toLowerCase().includes('betrag'));
  if (betrag) return `${art} über ${betrag.wert} €`;
  const datum = atoms.find(a => a.feld === 'Datum');
  if (datum) return `${art} vom ${datum.wert}`;
  return art;
}

export function deutungAusOcr(ocr: OcrErgebnis, docName: string): DeutungErgebnis {
  const atoms: Atom[] = [];
  let minConf = 1.0;
  const alleZeilen: string[] = [];

  const push = (feld: string, wert: string, seite: number, bbox: [number, number, number, number], conf: number): void => {
    const atomId = crypto
      .createHash('sha256')
      .update(`${docName}:${seite}:${bbox.join(',')}:${feld}:${wert}`)
      .digest('hex')
      .substring(0, 12);
    atoms.push({ id: atomId, feld, wert, fundstelle: { doc: docName, seite, bbox }, conf });
    if (conf < minConf) minConf = conf;
  };

  for (const page of ocr.pages) {
    const seite = page.index + 1;

    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];
      const text = line.text;
      alleZeilen.push(text);

      // 1. Absender — WER schreibt mir? (W1a: NAMEN in Sekunden)
      const absender = text.match(ABSENDER_REGEX);
      if (absender?.[1] && absender[1].trim().length > 2) {
        push('Absender', absender[1].trim().slice(0, 80), seite, line.bbox, line.conf);
      }

      // 2. Geldbeträge — mit Feld-Kontext (nicht nur „Zeile N")
      let betraege = text.match(GELDBETRAG_REGEX);
      let fallback = false;
      if (!betraege && GELDBETRAG_FALLBACK_REGEX.test(text.trim())) {
        betraege = [normalisiereBetrag(text.trim())];
        fallback = true;
      }
      if (betraege) {
        for (const betrag of betraege) {
          const feldMatch = fallback ? '' : text.split(betrag)[0].trim();
          const vorzeile = i > 0 ? page.lines[i - 1].text.trim() : '';
          const feld = feldMatch || vorzeile || 'Betrag';
          push(feld.slice(0, 60) || 'Betrag', betrag, seite, line.bbox, line.conf);
        }
      }

      // 3. Daten — mit Feld wenn in derselben Zeile („Fällig am 15.09.2026")
      for (const m of text.matchAll(DATUM_REGEX)) {
        const vor = text.slice(0, m.index ?? 0).trim().toLowerCase();
        const feld = /(fällig|zahlbar|bis|frist|datum)/.test(vor)
          ? vor.split(/\s+/).slice(-2).join(' ').replace(/[:]?$/, '') || 'Datum'
          : 'Datum';
        push(feld.slice(0, 60), `${m[1]}.${m[2]}.${m[3]}`, seite, line.bbox, line.conf);
      }
    }
  }

  // B5.4 — Dedupe: derselbe Wert (Datum) nur EIN Atom, egal wie oft er
  // im Text steht („Datum: 31.12.2026 · bis zum: 31.12.2026 · …")
  const gesehen = new Set<string>();
  const deduped = atoms.filter(a => {
    const schluessel = `${a.feld}|${a.wert}`;
    if (gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });

  // B5.2 — Gattung VOR der Frage: Werkstoff bekommt NIE „passt das?"
  const gattung = erkenneGattung(ocr, alleZeilen);
  const art = erkenneArt(alleZeilen);

  if (gattung === 'werkstoff') {
    // Werkstoff: still einsortiert — Beträge dürfen als abfragbare Atome
    // existieren (Frag-mich: „was kostet die GB192?"), aber NIE als
    // Frage-Karte. Höchstens die EINE leise Karte (B3: im Zweifel).
    return {
      atoms: deduped,
      kartentext: {
        titel: `${art} als Nachschlagewerk einsortiert`,
        frage: `Ich lese das still ein — richtig so?`, // leise, ja/beleg-draus-machen
        deutungV: DEUTUNG_VERSION,
      },
      gattung,
      zweifel: false,
    };
  }

  const titel = kartenTitel(art, deduped);

  let frage: string;
  if (deduped.length === 0) {
    frage = `Ich habe ${art === 'Dokument' ? 'das Dokument' : 'die ' + art} gelesen — nichts Verbindliches gefunden. Magst du selbst schauen?`;
  } else if (deduped.length === 1) {
    frage = `${deduped[0].feld}: ${deduped[0].wert} — stimmt das?`;
  } else {
    const beispiel = deduped.slice(0, 3).map(a => `${a.feld}: ${a.wert}`).join(' · ');
    frage = `${beispiel}${deduped.length > 3 ? ' …' : ''} — stimmt das?`;
  }

  const zweifel = minConf < 0.7 || deduped.length === 0;
  return { atoms: deduped, kartentext: { titel, frage, deutungV: DEUTUNG_VERSION }, gattung, zweifel };
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
    kartentext: { titel, frage, deutungV: DEUTUNG_VERSION },
    gattung: 'beleg', // ein Gespräch, in dem du warst, ist dir gerichtet
    zweifel: atoms.length === 0
  };
}
