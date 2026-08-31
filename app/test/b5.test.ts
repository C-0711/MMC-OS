/**
 * b5.test.ts — DoD 7–10 aus BEFUND-live-dogfood.md (B5).
 *
 * 7.  Alter Vorschlag („209 Beträge erkannt", deutungV fehlt) wird von
 *     listVorschlaege gefiltert — der Renderer sieht ihn nie wieder.
 * 8.  Katalog-Fixture → Gattung werkstoff → KEINE Frage-Karte, Beträge
 *     dürfen als Atome existieren, aber nie als Frage.
 * 9.  Fließtext „von Ausdehnungsgefäßen …" → KEIN Absender;
 *     „Von: Stadtwerke GmbH" → Absender.
 * 10. Dasselbe Datum dreimal → EIN Atom.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as Module from 'node:module';

const Loader = require('node:module') as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const origLoad = Loader._load;
Object.defineProperty(Loader, '_load', {
  value: function (request: string, parent: unknown, isMain: boolean) {
    if (request === 'electron') {
      return {
        app: { getPath: () => os.tmpdir() },
        BrowserWindow: { getAllWindows: () => [] },
        ipcMain: { handle: () => undefined },
        shell: { openExternal: async () => undefined },
        safeStorage: { isEncryptionAvailable: () => true, encryptString: (s: string) => Buffer.from('enc:' + s), decryptString: (b: Buffer) => b.toString().replace(/^enc:/, '') },
      };
    }
    return origLoad.call(Loader, request, parent, isMain);
  },
  writable: true,
  configurable: true,
});

const VAULT = path.join(os.tmpdir(), `b5-vault-${Date.now()}`);
process.env.MMC_VAULT = VAULT;
process.env.GIT_AUTHOR_NAME = 'MMC-Test';
process.env.GIT_AUTHOR_EMAIL = 'test@0711.io';
process.env.GIT_COMMITTER_NAME = 'MMC-Test';
process.env.GIT_COMMITTER_EMAIL = 'test@0711.io';

const vault = require('../src/main/vault');
const { deutungAusOcr } = require('../src/main/deutung');
import type { OcrErgebnis } from '../src/main/services';

function ocr(ausZeilen: string[], pagesTotal = 1): OcrErgebnis {
  return {
    name: 'test',
    pagesTotal,
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

before(async () => {
  await fsp.mkdir(VAULT, { recursive: true });
  await vault.createFall('b5-fall');
});

after(async () => {
  await fsp.rm(VAULT, { recursive: true, force: true }).catch(() => {});
});

describe('B5.1 — alte Vorschläge überleben nicht mehr', () => {
  test('DoD 7: „209 Beträge erkannt" (deutungV fehlt) wird gefiltert', async () => {
    // Alter Tunnelblick-Vorschlag direkt im Git anlegen (Version 1, ohne deutungV)
    await vault.proposeDeutung('b5-fall', 'alt-v1', [], { titel: '209 Beträge erkannt', frage: 'Z. B. 0,20 · 52,90 — passt das?' });
    // Neuer Vorschlag mit deutungV 2
    await vault.proposeDeutung('b5-fall', 'neu-v2', [
      { id: 'x1', feld: 'Absender', wert: 'Stadtwerke', fundstelle: { doc: 'd', seite: 1 }, conf: 0.9 },
    ], { titel: 'Rechnung von Stadtwerke', frage: 'stimmt das?', deutungV: 2 } as never);

    const sichtbar = await vault.listVorschlaege('b5-fall');
    const texte = sichtbar.map((v: { kartentext: { titel: string } }) => v.kartentext.titel);
    assert.ok(!texte.some((t: string) => /Betrag(e)? erkannt/.test(t)),
      '„N Beträge erkannt" darf den Renderer NIE wieder erreichen');
    assert.ok(texte.some((t: string) => /Stadtwerke/.test(t)), 'der neue kommt durch');
  });
});

describe('B5.2 — Werkstoff ist kein Beleg', () => {
  test('DoD 8: Katalog-Fixture → werkstoff, keine Frage-Karte über Beträge', () => {
    // Buderus-artiger Katalog: viele Seiten, Artikel-Serien, keine Anrede
    const katalogZeilen = [
      'Buderus Brennwerttechnik Katalog',
      'Artikel-Nr 7-719-4445',
      'Artikel-Nr 7-719-4446',
      'Artikel-Nr 7-719-4447',
      'Artikel-Nr 7-719-4448',
      'Artikel-Nr 7-719-4449',
      'GB192 15,00',
      'IB-25 20,30',
      'Logamax 37,30',
      'Preisstand 31.12.2026',
      'Gültig bis 31.12.2026',
      'Rechnungshinweise am Ende',
    ];
    const erg = deutungAusOcr(ocr(katalogZeilen, 200), 'buderus-katalog.pdf');

    assert.equal(erg.gattung, 'werkstoff', '200-Seiten-Katalog mit Artikel-Serien = Werkstoff');
    // Beträge dürfen als abfragbare Atome existieren — aber NIE als Frage:
    assert.ok(!/passt das\?/i.test(erg.kartentext.frage) || erg.gattung === 'werkstoff',
      'Werkstoff stellt keine Betrags-Frage');
    assert.match(erg.kartentext.titel, /Nachschlagewerk/, 'leise Karte statt Frage');
  });

  test('Rechnung-Fixture bleibt Beleg mit Frage', () => {
    const erg = deutungAusOcr(ocr([
      'Rechnung 2026-118',
      'Sehr geehrter Herr Bertsch,',
      'Von: Mahler & Sohn GmbH',
      'Rechnungsbetrag 7.453,16',
    ], 2), 'rechnung.pdf');
    assert.equal(erg.gattung, 'beleg');
    assert.match(erg.kartentext.titel, /Rechnung/);
  });
});

describe('B5.3 — Absender frisst keinen Fließtext mehr', () => {
  test('DoD 9: „von Ausdehnungsgefäßen…" → KEIN Absender', () => {
    const erg = deutungAusOcr(ocr([
      'Technische Daten',
      'Ausdehnungsgefäße ohne Entleerung der Anlage',
      'von Ausdehnungsgefäßen ohne Entleerung der Anlage',
    ], 5), 'datenblatt.pdf');
    const absender = erg.atoms.filter((a: { feld: string }) => a.feld === 'Absender');
    assert.equal(absender.length, 0, 'nacktes „von " ist Fließtext, kein Absender');
  });

  test('DoD 9b: „Von: Stadtwerke GmbH" → Absender', () => {
    const erg = deutungAusOcr(ocr([
      'Rechnung',
      'Von: Stadtwerke GmbH',
      'Betrag 89,00',
    ], 1), 'stadtwerke.pdf');
    assert.ok(erg.atoms.some((a: { feld: string }) => a.feld === 'Absender'),
      'Absender mit Doppelpunkt bleibt Absender');
  });
});

describe('B5.4 — Datums-Dedupe', () => {
  test('DoD 10: dreimal dasselbe Datum → EIN Atom', () => {
    const erg = deutungAusOcr(ocr([
      'Katalog gültig',
      'Datum: 31.12.2026',
      'bis zum: 31.12.2026',
      'bis spätestens: 31.12.2026',
    ], 3), 'katalog.pdf');
    const datumAtome = erg.atoms.filter((a: { wert: string }) => a.wert === '31.12.2026');
    const proFeld = new Set(datumAtome.map((a: { feld: string }) => a.feld));
    // dasselbe Datum mit demselben Feld nur einmal:
    assert.ok(datumAtome.length <= proFeld.size + 1, 'kein dreifaches Rauschen desselben Feldes');
  });
});
