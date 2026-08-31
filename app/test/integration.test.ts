/**
 * integration.test.ts — Integrationstests für den Ingress-Pfad
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { deutungAusOcr, type DeutungErgebnis } from '../src/main/deutung';
import type { OcrErgebnis } from '../src/main/services';
import * as vault from '../src/main/vault';

describe('Integration: deutungAusOcr', () => {
  test('extrahiert Beträge aus OCR-Ergebnis (Beispiel aus BUILD.md)', () => {
    // Beispiel-OCR-Ergebnis aus services.test.ts / BUILD.md
    // Steuerbescheinigung mit 729,23 · 640,00 · 21,82 · 1,20 · 1,96
    const ocrErgebnis: OcrErgebnis = {
      name: 'test-beleg.jpg',
      pagesTotal: 1,
      totalMs: 474.4,
      pages: [
        {
          index: 0,
          width: 1148,
          height: 2040,
          lines: [
            {
              bbox: [0.1, 0.5, 0.3, 0.02],
              text: 'Kapitalerträge 729,23',
              conf: 1.0
            },
            {
              bbox: [0.1, 0.48, 0.3, 0.02],
              text: 'Gezahlte Beträge 640,00',
              conf: 1.0
            },
            {
              bbox: [0.1, 0.46, 0.3, 0.02],
              text: 'Kapitalertragsteuer 21,82',
              conf: 1.0
            },
            {
              bbox: [0.1, 0.44, 0.3, 0.02],
              text: 'Solidaritätszuschlag 1,20',
              conf: 1.0
            },
            {
              bbox: [0.1, 0.42, 0.3, 0.02],
              text: 'Kirchensteuer 1,96',
              conf: 1.0
            }
          ]
        }
      ]
    };

    const ergebnis: DeutungErgebnis = deutungAusOcr(ocrErgebnis, 'test-beleg.jpg');

    // Prüfe Atoms
    assert.equal(ergebnis.atoms.length, 5, 'sollte 5 Beträge finden');

    const betraege = ergebnis.atoms.map(a => a.wert);
    assert.deepEqual(betraege, ['729,23', '640,00', '21,82', '1,20', '1,96']);

    // Prüfe Fundstellen
    assert.equal(ergebnis.atoms[0].fundstelle.doc, 'test-beleg.jpg');
    assert.equal(ergebnis.atoms[0].fundstelle.seite, 1);
    assert.deepEqual(ergebnis.atoms[0].fundstelle.bbox, [0.1, 0.5, 0.3, 0.02]);

    // Prüfe Felder
    assert.equal(ergebnis.atoms[0].feld, 'Kapitalerträge');
    assert.equal(ergebnis.atoms[2].feld, 'Kapitalertragsteuer');

    // Prüfe Konfidenz
    assert.equal(ergebnis.atoms[0].conf, 1.0);

    // Prüfe Kartentext
    assert.ok(ergebnis.atoms.length >= 5, 'fünf Atoms semantisch');
    assert.match(ergebnis.kartentext.frage, /729,23.*640,00.*21,82/);

    // Kein Zweifel bei hoher Konfidenz und Beträgen
    assert.equal(ergebnis.zweifel, false);
  });

  test('markiert Zweifel bei niedriger Konfidenz', () => {
    const ocrErgebnis: OcrErgebnis = {
      name: 'unscharfes-foto.jpg',
      pagesTotal: 1,
      totalMs: 500,
      pages: [
        {
          index: 0,
          width: 800,
          height: 600,
          lines: [
            {
              bbox: [0.2, 0.3, 0.4, 0.05],
              text: 'Betrag 12,34',
              conf: 0.6 // Niedrige Konfidenz
            }
          ]
        }
      ]
    };

    const ergebnis = deutungAusOcr(ocrErgebnis, 'unscharfes-foto.jpg');

    assert.equal(ergebnis.atoms.length, 1);
    assert.equal(ergebnis.zweifel, true, 'sollte Zweifel markieren bei conf < 0.7');
    assert.ok(ergebnis.atoms.length >= 1, 'mindestens ein Atom (semantisch)');
  });

  test('markiert Zweifel bei 0 Beträgen', () => {
    const ocrErgebnis: OcrErgebnis = {
      name: 'kein-beleg.jpg',
      pagesTotal: 1,
      totalMs: 300,
      pages: [
        {
          index: 0,
          width: 800,
          height: 600,
          lines: [
            {
              bbox: [0.1, 0.5, 0.8, 0.05],
              text: 'Nur Text ohne Zahlen',
              conf: 1.0
            }
          ]
        }
      ]
    };

    const ergebnis = deutungAusOcr(ocrErgebnis, 'kein-beleg.jpg');

    assert.equal(ergebnis.atoms.length, 0);
    assert.equal(ergebnis.zweifel, true);
    assert.ok(ergebnis.atoms.length === 0 || ergebnis.kartentext.titel, 'würdevoller Titel auch ohne Beträge');
    assert.match(ergebnis.kartentext.frage, /[mM]agst du selbst schauen/);
  });

  test('Fallback: standalone-Zeile mit fehlgelesenem Komma („21.82" → 21,82)', () => {
    // Gemessen am Stricker-Beleg: Vision liest die KapSt-Zelle als eigene
    // Zeile "21.82" (Punkt statt Komma). Der Fallback greift NUR, wenn die
    // ganze Zeile aus dem Betrag besteht — Datumsangaben wie "28.07" in
    // gemischten Zeilen dürfen NICHT matchen.
    const ocrErgebnis: OcrErgebnis = {
      name: 'stricker.jpg',
      pagesTotal: 1,
      totalMs: 400,
      pages: [
        {
          index: 0,
          width: 1148,
          height: 2040,
          lines: [
            { bbox: [0.1, 0.60, 0.3, 0.02], text: 'Kapitalertragsteuer', conf: 1.0 },
            { bbox: [0.5, 0.60, 0.1, 0.02], text: '21.82', conf: 1.0 },
            { bbox: [0.1, 0.55, 0.3, 0.02], text: 'Depotgebühr', conf: 1.0 },
            { bbox: [0.5, 0.55, 0.1, 0.02], text: '1.053.50', conf: 1.0 },
            { bbox: [0.1, 0.50, 0.5, 0.02], text: 'Datum 28.07 Eingang gebucht', conf: 1.0 }
          ]
        }
      ]
    };

    const ergebnis = deutungAusOcr(ocrErgebnis, 'stricker.jpg');

    const betraege = ergebnis.atoms.map(a => a.wert);
    assert.deepEqual(betraege, ['21,82', '1.053,50'], 'normalisiert Punkt-Fehllesungen, ignoriert Datum');

    // Feld kommt aus der Vorzeile (Betragsspalte steht allein)
    assert.equal(ergebnis.atoms[0].feld, 'Kapitalertragsteuer');
    assert.equal(ergebnis.atoms[1].feld, 'Depotgebühr');
  });
});

describe('Integration: Ende-zu-Ende-Pfad (Vault)', () => {
  let tempVaultRoot: string;
  let originalVaultEnv: string | undefined;

  beforeEach(async () => {
    // Temporäres Vault erstellen
    tempVaultRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mmc-test-vault-'));
    originalVaultEnv = process.env.MMC_VAULT;
    process.env.MMC_VAULT = tempVaultRoot;
  });

  afterEach(async () => {
    // Aufräumen
    await fs.rm(tempVaultRoot, { recursive: true, force: true });
    if (originalVaultEnv) {
      process.env.MMC_VAULT = originalVaultEnv;
    } else {
      delete process.env.MMC_VAULT;
    }
  });

  test('Ingress-Pfad: createFall → commitEingang → proposeDeutung → mergeVorschlag → fallErzaehlung', async () => {
    // 1. Fall anlegen
    const fall = await vault.createFall('test-fall');
    assert.equal(fall.id, 'test-fall');
    assert.equal(fall.offeneVorschlaege, 0);

    // 2. Eingang committen
    const testDatei = Buffer.from('fake-image-data');
    const { sha: eingangSha, docPfad } = await vault.commitEingang(
      'test-fall',
      { absender: 'Testabsender', kanal: 'whatsapp' },
      { name: 'test-beleg.jpg', bytes: testDatei }
    );

    assert.ok(eingangSha.length > 0, 'sollte Commit-SHA zurückgeben');
    assert.match(docPfad, /test-beleg\.jpg$/);

    // 3. Deutung vorschlagen
    const testAtoms = [
      {
        id: 'atom-1',
        feld: 'Kapitalerträge',
        wert: '729,23',
        fundstelle: {
          doc: 'test-beleg.jpg',
          seite: 1,
          bbox: [0.1, 0.5, 0.3, 0.02] as [number, number, number, number]
        },
        conf: 1.0
      }
    ];

    const { branch, sha: deutungSha } = await vault.proposeDeutung(
      'test-fall',
      'deutung-1',
      testAtoms,
      { titel: 'Test-Deutung', frage: 'Passt das?' }
    );

    assert.equal(branch, 'agent/deutung-1');
    assert.ok(deutungSha.length > 0);

    // 4. Vorschläge prüfen
    const vorschlaege = await vault.listVorschlaege('test-fall');
    assert.equal(vorschlaege.length, 1);
    assert.equal(vorschlaege[0].id, 'deutung-1');
    assert.equal(vorschlaege[0].kartentext.titel, 'Test-Deutung');
    assert.equal(vorschlaege[0].atoms.length, 1);

    // 5. Vorschlag mergen ([Ja])
    const { sha: mergeSha } = await vault.mergeVorschlag('test-fall', 'deutung-1');
    assert.ok(mergeSha.length > 0);

    // 6. Vorschläge sollten nun leer sein
    const vorschlaegeNachMerge = await vault.listVorschlaege('test-fall');
    assert.equal(vorschlaegeNachMerge.length, 0);

    // 7. Erzählung prüfen
    const erzaehlung = await vault.fallErzaehlung('test-fall');

    // Erwartung: 3 Commits (init, eingang, merge)
    assert.ok(erzaehlung.length >= 3, `sollte mindestens 3 Commits haben, hat ${erzaehlung.length}`);

    // Neuester Commit (letzter in der Liste, weil reverse() in fallErzaehlung)
    const neusterCommit = erzaehlung[erzaehlung.length - 1];
    assert.match(neusterCommit.satz, /bestätigt/, 'letzter Satz sollte Bestätigung sein');
    assert.match(neusterCommit.commitZeile, /bestaetigt.*sig ✓/);

    // Eingangs-Commit sollte vorhanden sein
    const eingangCommit = erzaehlung.find(e => e.satz.includes('kam'));
    assert.ok(eingangCommit, 'sollte Eingangs-Satz enthalten');
    assert.match(eingangCommit.satz, /test-beleg\.jpg.*Testabsender/);
  });
});
