/**
 * deutung.test.ts — Unit-Tests für deutungAusTranskript + istTranskript
 * (Etappe 4, Arbeit A: kanal "anruf" — die Zeitmarke ist der Beweis)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  deutungAusTranskript,
  istTranskript,
  type Transkript
} from '../src/main/deutung';

const beispielTranskript: Transkript = {
  art: 'anruf',
  titel: 'Review & Planning',
  wav: 'anruf-2026-08-27.wav',
  dauer: '42:00',
  zeilen: [
    { zeit: '00:12', sprecher: 'Gerd', text: 'Guten Morgen, dann fangen wir an.' },
    { zeit: '04:12', sprecher: 'Stefan', text: 'Den Scope frieren wir bis zum 28.07. ein, einverstanden.' },
    { zeit: '11:03', sprecher: 'Gerd', text: 'Das Budget liegt bei 12.500,00 für die erste Phase.' },
    { zeit: '17:40', sprecher: 'Stefan', text: 'Die Abnahme machen wir bis Ende September.' },
    { zeit: '41:50', sprecher: 'Gerd', text: 'Gut, dann bis nächste Woche.' }
  ]
};

describe('deutungAusTranskript', () => {
  test('Zusagen und Fristen werden auf Minuten fundiert', () => {
    const erg = deutungAusTranskript(beispielTranskript, 'anruf-2026-08-27.json');

    // Zeile 04:12 ist Zusage (einverstanden) — nicht zusätzlich Frist
    const zusagen = erg.atoms.filter(a => a.feld === 'Zusage');
    const zusage0412 = zusagen.find(a => a.fundstelle.minute === '04:12');
    assert.ok(zusage0412, 'Zusage bei Minute 04:12 erwartet');
    assert.match(zusage0412.wert, /Stefan: /);
    assert.match(zusage0412.wert, /frieren wir bis zum 28\.07\. ein/);

    // Keine Doppel-Fundstelle: 04:12 nur EIN Atom (Zusage schlägt Frist)
    const atome0412 = erg.atoms.filter(a => a.fundstelle.minute === '04:12');
    assert.equal(atome0412.length, 1);

    // Zeile 17:40 ist ebenfalls Zusage („machen wir")
    const zusage1740 = zusagen.find(a => a.fundstelle.minute === '17:40');
    assert.ok(zusage1740, 'Zusage bei Minute 17:40 erwartet');
  });

  test('Fundstelle trägt art/wav/minute/dauer — kein Rechteck', () => {
    const erg = deutungAusTranskript(beispielTranskript, 'anruf-2026-08-27.json');
    assert.ok(erg.atoms.length > 0);

    for (const atom of erg.atoms) {
      assert.equal(atom.fundstelle.art, 'anruf');
      assert.equal(atom.fundstelle.doc, 'anruf-2026-08-27.json');
      assert.equal(atom.fundstelle.wav, 'anruf-2026-08-27.wav');
      assert.equal(atom.fundstelle.dauer, '42:00');
      assert.match(atom.fundstelle.minute ?? '', /^\d{2}:\d{2}$/);
      assert.equal(atom.fundstelle.bbox, undefined, 'Anruf-Atom trägt kein Rechteck');
      assert.equal(atom.fundstelle.seite, undefined);
      assert.equal(atom.conf, 1.0, 'Transkript ist Text — keine OCR-Unsicherheit');
    }
  });

  test('Beträge im Gespräch werden zu Betrag-Atoms', () => {
    const erg = deutungAusTranskript(beispielTranskript, 'anruf-2026-08-27.json');
    const betrag = erg.atoms.find(a => a.feld.startsWith('Betrag'));
    assert.ok(betrag, 'Betrag-Atom erwartet');
    assert.equal(betrag.wert, '12.500,00');
    assert.equal(betrag.fundstelle.minute, '11:03');
    assert.equal(betrag.feld, 'Betrag (Gerd)');
  });

  test('Kartentext nennt die Minuten', () => {
    const erg = deutungAusTranskript(beispielTranskript, 'anruf-2026-08-27.json');
    assert.match(erg.kartentext.titel, /„Review & Planning"/);
    assert.match(erg.kartentext.titel, /Stellen erkannt/);
    assert.match(erg.kartentext.frage, /Minute/);
    assert.equal(erg.zweifel, false);
  });

  test('leeres Transkript → zweifel, keine Atoms', () => {
    const leer: Transkript = {
      art: 'anruf',
      wav: 'leer.wav',
      zeilen: [{ zeit: '00:01', sprecher: 'Gerd', text: 'Hallo?' }]
    };
    const erg = deutungAusTranskript(leer, 'leer.json');
    assert.equal(erg.atoms.length, 0);
    assert.equal(erg.zweifel, true);
    assert.match(erg.kartentext.titel, /nichts Verbindliches/);
  });

  test('Atom-IDs sind deterministisch (Hash aus doc+zeit+feld+wert)', () => {
    const a = deutungAusTranskript(beispielTranskript, 'anruf-2026-08-27.json');
    const b = deutungAusTranskript(beispielTranskript, 'anruf-2026-08-27.json');
    assert.deepEqual(a.atoms.map(x => x.id), b.atoms.map(x => x.id));
    assert.match(a.atoms[0].id, /^[0-9a-f]{12}$/);
  });
});

describe('istTranskript', () => {
  test('erkennt gültiges Transkript', () => {
    assert.equal(istTranskript(beispielTranskript), true);
  });

  test('lehnt fremde Formen ab', () => {
    assert.equal(istTranskript(null), false);
    assert.equal(istTranskript('anruf'), false);
    assert.equal(istTranskript({}), false);
    assert.equal(istTranskript({ art: 'anruf' }), false); // wav fehlt
    assert.equal(istTranskript({ art: 'anruf', wav: 'x.wav' }), false); // zeilen fehlen
    assert.equal(
      istTranskript({ art: 'dokument', wav: 'x.wav', zeilen: [] }),
      false
    );
    assert.equal(
      istTranskript({ art: 'anruf', wav: 'x.wav', zeilen: [{ zeit: 1, text: 'x' }] }),
      false // zeit muss string sein
    );
  });
});
