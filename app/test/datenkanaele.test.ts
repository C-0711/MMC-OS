/**
 * datenkanaele.test.ts — Abnahme T1-T5 (Etappe A: Anbindung).
 *
 * T1 getFallUebersicht · T2 ingest (W1a-DoD als Tests) · T3 listAnrufe ·
 * T4 themen/stapel/neuesThema · T5 fragAlles (vLLM gestubbt).
 *
 * Läuft gegen ein echtes Vault-Testverzeichnis (MMC_VAULT env).
 * electron wird für den Ingest-Import per Module._load gestubbt.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as Module from 'node:module';

const TESTVAULT = path.join(os.tmpdir(), `mmc-testvault-${Date.now()}`);
process.env.MMC_VAULT = TESTVAULT;

// --- electron-Stub VOR dem Laden von ingest/vault --------------------------
// Node 26: Module._load ist getter-only — über Object.defineProperty am
// CJS-Loader (require.extensions Weg geht nicht mehr, Loader-Hack hier):
const Loader = require('node:module') as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const origLoad = Loader._load;
Object.defineProperty(Loader, '_load', {
  value: function (request: string, parent: unknown, isMain: boolean) {
    if (request === 'electron') {
      return {
        BrowserWindow: { getAllWindows: () => [] },
        ipcMain: { handle: () => undefined },
        shell: { openExternal: async () => undefined },
        app: { getPath: () => os.tmpdir() },
      };
    }
    return origLoad.call(Loader, request, parent, isMain);
  },
  writable: true,
  configurable: true,
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vault = require('../src/main/vault');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const uebersicht = require('../src/main/uebersicht');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const anrufMod = require('../src/main/anruf');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const themenMod = require('../src/main/themen');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sucheMod = require('../src/main/suche');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ingest = require('../src/main/ingest');

const originalFetch = globalThis.fetch;

let testFall = '';

before(async () => {
  await fs.mkdir(TESTVAULT, { recursive: true });
  testFall = 'denkanaele-test';

  await vault.createFall(testFall);
  await vault.commitEingang(testFall, { absender: 'Stadtwerke', kanal: 'post' }, {
    name: 'rechnung.txt',
    bytes: Buffer.from('Rechnung Stadtwerke\nVon: Stadtwerke Musterstadt\nFällig am 15.09.2026\nBetrag: 89,00 €\n', 'utf-8'),
  });
  await vault.proposeDeutung(testFall, 'vorschlag-1', [
    { id: 'a1', feld: 'betrag', wert: '89,00 €', fundstelle: { art: 'dokument', doc: 'rechnung.txt', seite: 1 }, conf: 0.9 },
    { id: 'a2', feld: 'absender', wert: 'Stadtwerke Musterstadt', fundstelle: { art: 'dokument', doc: 'rechnung.txt', seite: 1 }, conf: 0.9 },
  ], { titel: 'Rechnung Stadtwerke', frage: 'Rechnung Stadtwerke, 89 € — stimmt das?', deutungV: 2 });

  await vault.commitEingang(testFall, { absender: 'Lena Weber', kanal: 'anruf' }, {
    name: 'mitschrift-2026-08-27.json',
    bytes: Buffer.from(JSON.stringify({
      zeilen: [
        { zeit: '04:12', sprecher: 'Du', text: 'Werkstatttermin Freitag?' },
        { zeit: '27:50', sprecher: 'Lena Weber', text: 'Prelive bleibt eingefroren.' },
      ],
    })),
  });

  // Merge hier, nicht erst in T4 — T1 braucht die Atome auf main.
  await vault.mergeVorschlag(testFall, 'vorschlag-1');

  // Zweiter offener Vorschlag — T1 braucht eine offene Ding-Karte.
  await vault.proposeDeutung(testFall, 'vorschlag-2', [
    { id: 'a3', feld: 'betrag', wert: '89,00 €', fundstelle: { art: 'dokument', doc: 'rechnung.txt', seite: 1 }, conf: 0.9 },
  ], { titel: 'Rechnung Stadtwerke', frage: 'Rechnung Stadtwerke, 89 € — stimmt das?', deutungV: 2 });
});

after(async () => {
  await fs.rm(TESTVAULT, { recursive: true, force: true }).catch(() => {});
  (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
});

// T1
test('T1: getFallUebersicht liefert dinge/protokoll/beteiligte', async () => {
  const u = await uebersicht.getFallUebersicht(testFall);
  assert.ok(u.dinge.length >= 1, 'offene Vorschläge sollten Ding-Karten ergeben');
  assert.equal(u.dinge[0].titel, 'Rechnung Stadtwerke');
  assert.match(u.dinge[0].quelle, /rechnung\.txt · Seite 1/);
  assert.ok(u.protokoll.length >= 1, 'Erzähl-Sätze vorhanden');
  assert.ok(u.beteiligte.includes('Stadtwerke Musterstadt'));
});

// T2
test('T2: ingest läuft entkoppelt durch — done kommt', async () => {
  const dir = path.join(os.tmpdir(), `ingest-src-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  for (let i = 0; i < 5; i++) {
    await fs.writeFile(path.join(dir, `doc-${i}.txt`),
      `Von: Sender${i}\nBetrag: ${i + 10},00 €\nDatum: 01.0${i + 1}.2026\n`);
  }
  const startRes = ingest.start([dir]);
  assert.ok(startRes.ok);
  const t0 = Date.now();
  while (ingest.status().phase !== 'fertig' && Date.now() - t0 < 5000) {
    await new Promise(r => setTimeout(r, 100));
  }
  assert.equal(ingest.status().phase, 'fertig');
  assert.equal(ingest.status().fertig, 5, 'Verzeichnis muss zu 5 Dateien aufgespannt werden');
  assert.ok(ingest.status().atome >= 3, 'Atome aus den Dokumenten');
});

test('T2: ask antwortet ehrlich nur aus verarbeiteten Atomen', () => {
  const erg = ingest.antwortAusAtomen('Sender3');
  assert.ok(erg);
  assert.match(erg.text, /Sender3|ehrlich/);
});

test('T2: scanReport öffnet NICHTS (Scan-First)', async () => {
  const dir = path.join(os.tmpdir(), `scan-src-${Date.now()}`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'a.txt'), 'x');
  await fs.writeFile(path.join(dir, 'b.txt'), 'y');
  const bericht = await ingest.scanReport([dir]);
  assert.equal(bericht.length, 1);
  assert.equal(bericht[0].dateien, 2);
  assert.equal(bericht[0].gelesen, false, 'nichts gelesen vor dem Nicken');
});

// T3
test('T3: listAnrufe findet Mitschrift mit Partner und Dauer', async () => {
  const anrufe = await anrufMod.listAnrufe(testFall);
  assert.equal(anrufe.length, 1);
  assert.equal(anrufe[0].partner, 'Lena Weber');
  assert.equal(anrufe[0].dauer, '27:50');
  assert.equal(anrufe[0].zeilen.length, 2);
});

// T4
test('T4: themenFuerFall zählt nach Lesefluss', async () => {
  await vault.mergeVorschlag(testFall, 'vorschlag-1').catch(() => {});
  const t = await themenMod.themenFuerFall(testFall);
  assert.ok(t.length >= 1, 'Themen nach Merge');
  assert.ok(t.some((x: { name: string }) => x.name === 'Rechnungen' || x.name === 'Kontakte'));
});

test('T4: stapel zeigt letzten Commit-Satz je Fall', async () => {
  const s = await themenMod.stapel();
  assert.ok(s.length >= 1);
  assert.equal(s[0].fallId, testFall);
  assert.ok(typeof s[0].satz === 'string');
});

// T5
test('T5: fragAlles sammelt Kontext und ruft vLLM mit Zitaten', async () => {
  let gefragt = '';
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: string | URL, init?: RequestInit) => {
    gefragt = String(init?.body ?? '');
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Es gibt eine Rechnung über 89,00 € [1].' } }] }),
    } as unknown as Response;
  }) as typeof fetch;

  await vault.mergeVorschlag(testFall, 'vorschlag-1').catch(() => {});
  const erg = await sucheMod.fragAlles('Was zahle ich für die Stadtwerke?');
  assert.ok(!erg.ehrlich, 'Antwort mit Fundstellen');
  assert.match(erg.antwort, /89,00 €/);
  assert.match(gefragt, /89,00 €/, 'Fundstellen müssen im Prompt stehen');
  assert.ok(erg.treffer.length >= 1, 'Treffer-Liste für Quellzeilen');
});
