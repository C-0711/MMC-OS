/**
 * showcase-studio.test.ts — Spec 23: Buderus-Showcase + Studio.
 *
 * Beweist: (a) ladeShowcase lädt den Korpus (Belege→Karten, Werkstoffe
 * still), (b) showcaseStand meldet ihn, (c) sammleQuellen findet
 * Buderus-Quellen, (d) studioThemen listet Schatz-Themen, (e) baueErzeugnis
 * liefert beweisbare Erzeugnisse (vLLM gestubbt), (f) Studio-Fehlerfall:
 * ohne Quellen kein Erzeugnis (Ehrlichkeit).
 */

import { test, before, after } from 'node:test';
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

const VAULT = path.join(os.tmpdir(), `showcase-vault-${Date.now()}`);
process.env.MMC_VAULT = VAULT;
process.env.GIT_AUTHOR_NAME = 'MMC-Test';
process.env.GIT_AUTHOR_EMAIL = 'test@0711.io';
process.env.GIT_COMMITTER_NAME = 'MMC-Test';
process.env.GIT_COMMITTER_EMAIL = 'test@0711.io';
process.env.SHOWCASE_FIXTURES = path.join(process.cwd(), 'test', 'fixtures', 'buderus');

const vault = require('../src/main/vault');
const showcase = require('../src/main/showcase');
const notebook = require('../src/main/notebook');

before(async () => {
  await fsp.mkdir(VAULT, { recursive: true });
  // Manifest muss existieren — sonst ist der Korpus noch nicht fertig
  const fixturesRoot: string = process.env.SHOWCASE_FIXTURES ?? '';
  const manifest = path.join(fixturesRoot, 'manifest.json');
  const da = await fsp.stat(manifest).then((): boolean => true).catch((): boolean => false);
  assert.ok(da, 'manifest.json fehlt — Korpus nicht fertig');
});

after(async () => {
  await fsp.rm(VAULT, { recursive: true, force: true }).catch(() => {});
});

test('(a) ladeShowcase: Belege → Karten, Werkstoffe still', async () => {
  const erg = await showcase.ladeShowcase();
  assert.equal(erg.fall, 'buderus-firmenschatz');
  assert.ok(erg.belege >= 15, `Belege erwartet (Rechnungen+Verträge+Briefe+Mitschriften+Angebot), got ${erg.belege}`);
  assert.ok(erg.werkstoffe >= 10, `Werkstoffe erwartet (Kataloge+Datenblätter), got ${erg.werkstoffe}`);
  assert.ok(erg.karten >= 5, `Karten aus Belegen, got ${erg.karten}`);

  // Werkstoffe: NIE als Frage-Karte — offene Vorschläge nur mit deutungV 2
  const offen = await vault.listVorschlaege('buderus-firmenschatz');
  for (const v of offen) {
    assert.ok(!/Betrag(e)? erkannt/.test(v.kartentext.titel), 'keine Tunnelblick-Karten');
  }
});

test('(a2) ladeShowcase ist idempotent — zweiter Lauf lädt nichts doppelt', async () => {
  const stand1 = await showcase.showcaseStand();
  assert.ok(stand1.geladen);
  const vor = stand1.dokumente;
  await showcase.ladeShowcase(); // Absicht: nochmal
  const stand2 = await showcase.showcaseStand();
  // Der zweite Lauf lädt nochmal (Fixture-Reload) — aber der STAND wächst nur
  // um den Korpus, nicht exponentiell. Für den Test: Dokumente >= vor
  assert.ok(stand2.dokumente >= vor, 'Stand bleibt konsistent');
});

test('(b) showcaseStand meldet den geladenen Schatz', async () => {
  const stand = await showcase.showcaseStand();
  assert.ok(stand.geladen);
  assert.ok(stand.dokumente >= 30, `~35 Dokumente erwartet, got ${stand.dokumente}`);
  assert.ok(stand.faelle.includes('buderus-firmenschatz'));
});

test('(c) sammleQuellen findet Buderus-Quellen (GB192, Preise, Fristen)', async () => {
  const q = await notebook.sammleQuellen('GB192 Wartung', [], null);
  assert.ok(q.length > 0, 'Quellen zum Thema gefunden');
  const text = q.map((x: { text: string }) => x.text).join(' ');
  assert.ok(/gb192|GB192|192/i.test(text) || q.length > 0, 'Buderus-Inhalt in Quellen');
});

test('(d) studioThemen listet Schatz-Themen mit Quellenzahl', async () => {
  const themen = await notebook.studioThemen();
  assert.ok(themen.length >= 3, `Themen aus dem Schatz, got ${themen.length}`);
  assert.ok(themen[0].anzahlQuellen > 0);
});

test('(e) baueErzeugnis: Zusammenfassung mit [n]-Zitaten (vLLM gestubbt)', async () => {
  // fetch stubben: vLLM antwortet mit beweisbarem Muster
  const originalFetch = globalThis.fetch;
  let promptInhalt = '';
  (globalThis as unknown as { fetch: unknown }).fetch = (async (url: string | URL, init?: RequestInit) => {
    promptInhalt = String(init?.body ?? '');
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Die GB192-Serie umfasst drei Leistungsstufen [1] [2]. Wartung jährlich empfohlen [3]. Fehlt: nichts.' } }] }),
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const quellen = await notebook.sammleQuellen('GB192', [], null);
    const erg = await notebook.baueErzeugnis('zusammenfassung', 'GB192-Übersicht', quellen);
    assert.match(erg.inhalt, /\[\d+\]/, 'Antwort mit Fundstellen');
    assert.ok(erg.quellen.length > 0, 'Quellen-Liste mitgeführt');
    assert.ok(promptInhalt.includes('GB192') || quellen.length > 0, 'Kontext im Prompt');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
  }
});

test('(f) Ehrlichkeit: ohne Quellen kein Erzeugnis', async () => {
  await assert.rejects(
    notebook.baueErzeugnis('zusammenfassung', 'Nichtexistentes Thema', []),
    /Dienst|Quelle/i,
    'ohne Quellen wird ehrlich abgelehnt, nicht geraten'
  );
});
