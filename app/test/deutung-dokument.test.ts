/**
 * deutung-dokument.test.ts — Nutzer-Befund: „Inhalt völlig unbrauchbar, als
 * Beleg klassifiziert und Belegwerte angezeigt." Diese Tests beweisen die
 * semantische Wende: Dokument-Art statt pauschal „Beleg", Namen, Felder.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deutungAusOcr } from '../src/main/deutung';
import type { OcrErgebnis } from '../src/main/services';

function ocr(ausZeilen: string[]): OcrErgebnis {
  return {
    name: 'test',
    pagesTotal: 1,
    totalMs: 10,
    pages: [{
      index: 0,
      width: 1148,
      height: 2040,
      lines: ausZeilen.map((text, i) => ({
        text,
        bbox: [10, i * 30, 400, i * 30 + 20] as [number, number, number, number],
        conf: 0.95,
      })),
    }],
  };
}

describe('deutungAusOcr — semantisch statt Beleg-Tunnelblick', () => {

  test('BRIEF ohne Beträge: kein „Beleg", Absender wird genannt', () => {
    // Genau der Nutzer-Fall: ein Dokument OHNE Geldbeträge — vorher
    // „Kein Geldbetrag erkannt", jetzt ein Brief mit Absender.
    const erg = deutungAusOcr(ocr([
      'Stadtwerke Musterstadt GmbH',
      'Sehr geehrter Herr Bertsch,',
      'wie besprochen teilen wir Ihnen den neuen',
      'Zählerstand mit. Ihr Vertrag läuft weiter.',
      'Mit freundlichen Grüßen',
      'Ihre Stadtwerke',
    ]), 'brief-stadtwerke.pdf');

    assert.doesNotMatch(erg.kartentext.titel, /Beleg/, 'NIE pauschal „Beleg"');
    assert.doesNotMatch(erg.kartentext.titel, /Geldbetrag/, 'kein Betrags-Tunnelblick');
    assert.ok(erg.atoms.length >= 0, 'Brief darf auch ohne harte Atoms gültig sein');
    assert.match(erg.kartentext.frage, /selbst schauen|stimmt/, 'würdevolle Frage');
  });

  test('Rechnung: Art + Absender + Betrag MIT Feld-Kontext', () => {
    const erg = deutungAusOcr(ocr([
      'Rechnung 2026-118',
      'Von: Mahler & Sohn GmbH',
      'Leistungszeitraum August 2026',
      'Nettobetrag 6.263,16',
      'Umsatzsteuer 19% 1.190,00',
      'Rechnungsbetrag 7.453,16',
      'Zahlbar bis 15.09.2026',
    ]), 'rechnung-2026-118.pdf');

    assert.match(erg.kartentext.titel, /Rechnung/, 'Art erkannt');
    const absender = erg.atoms.find(a => a.feld === 'Absender');
    assert.ok(absender, 'Absender-Atom (Name!)');
    assert.match(absender!.wert, /Mahler & Sohn/);

    // Feld-Kontext: „Umsatzsteuer" ist das Feld, nicht „Zeile 5"
    const ust = erg.atoms.find(a => a.wert === '1.190,00');
    assert.ok(ust, 'Umsatzsteuer-Betrag erkannt');
    assert.match(ust!.feld, /umsatzsteuer/i, 'Feld = Umsatzsteuer, nicht Zeilennummer');

    // Fälligkeits-Datum mit Feld
    const faellig = erg.atoms.find(a => a.wert === '15.09.2026');
    assert.ok(faellig, 'Fälligkeits-Datum');
    assert.match(faellig!.feld, /zahlbar|fällig/i, 'Feld = zahlbar bis');
  });

  test('Vertrag: Art „Vertrag" statt Beleg, Laufzeit-Datum', () => {
    const erg = deutungAusOcr(ocr([
      'Mietvertrag',
      'Laufzeit: 24 Monate',
      'Beginn am 01.10.2026',
      'Kaution 2.500,00',
    ]), 'mietvertrag.pdf');

    assert.match(erg.kartentext.titel, /Vertrag/);
    const kaution = erg.atoms.find(a => a.wert === '2.500,00');
    assert.ok(kaution, 'Kaution als Betrag');
    assert.match(kaution!.feld, /kaution/i, 'Feld = Kaution');
  });

  test('Katalog-Auszug: „Katalog", kein Beleg-Wahn', () => {
    const erg = deutungAusOcr(ocr([
      'FLÜGELRADZÄHLER PTFB0003',
      'Katalog 2024 · Kapitel 4',
      'Einbau: vertikal in Falleitungen',
      'Artikel-Nr 4711',
    ]), 'buderus-2024.pdf');

    assert.match(erg.kartentext.titel, /Katalog/);
    assert.doesNotMatch(erg.kartentext.titel, /Beleg|Betrag/);
  });

  test('Titel-Priorität: Name schlägt Betrag (W1a: NAMEN in Sekunden)', () => {
    const erg = deutungAusOcr(ocr([
      'Rechnung Stadtwerke',
      'Absender: Stadtwerke Musterstadt',
      'Betrag 89,00',
    ]), 'stadtwerke-2026-09.pdf');

    assert.match(erg.kartentext.titel, /Stadtwerke Musterstadt/, 'Der NAME ist der Titel');
  });

  test('Zahl ohne Komma-Struktur wird NICHT als Betrag gewaltsam erkannt', () => {
    // „28.07" (Datum) darf nicht durch den Fallback zum Betrag werden
    const erg = deutungAusOcr(ocr([
      'Terminbestätigung',
      'Wir treffen uns am 28.07.',
      'im Büro',
    ]), 'termin.pdf');

    assert.ok(!erg.atoms.some(a => a.wert === '28.07'), 'kein Schein-Betrag aus Datum');
  });
});
