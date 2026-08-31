/**
 * kontakte.test.ts — Abnahme Spec 21: Kontakte, Issuing, Verlauf.
 *
 * Beweist: (a) Issuing erzeugt den Container beim ersten Wort, (b) Anruf/
 * Text/Datei landen als Commits in EINEM Verlauf, (c) kontaktHistorie mischt
 * alle Typen nach Zeit, (d) listKontakte zählt Aktivität.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as Module from 'node:module';

// --- electron-Stub ---------------------------------------------------------
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

const VAULT = path.join(os.tmpdir(), `kontakt-vault-${Date.now()}`);
process.env.MMC_VAULT = VAULT;
process.env.GIT_AUTHOR_NAME = 'MMC-Test';
process.env.GIT_AUTHOR_EMAIL = 'test@0711.io';
process.env.GIT_COMMITTER_NAME = 'MMC-Test';
process.env.GIT_COMMITTER_EMAIL = 'test@0711.io';

const kontakte = require('../src/main/kontakte');

before(async () => {
  await fsp.mkdir(VAULT, { recursive: true });
});

after(async () => {
  await fsp.rm(VAULT, { recursive: true, force: true }).catch(() => {});
});

test('(a) Issuing: erster Text erzeugt den Kontakt-Container', async () => {
  const slug = await kontakte.findeOderIssue('Lena Weber');
  assert.equal(slug, 'lena-weber');
  const pfad = path.join(VAULT, 'kontakt-lena-weber');
  const meta = JSON.parse(await fsp.readFile(path.join(pfad, 'docs', 'meta.json'), 'utf8'));
  assert.equal(meta.name, 'Lena Weber');
  assert.equal(meta.slug, 'lena-weber');
});

test('(a2) Issuing ist idempotent — zweiter Aufruf findet denselben Container', async () => {
  const s1 = await kontakte.findeOderIssue('Lena Weber');
  const s2 = await kontakte.findeOderIssue('Lena Weber');
  assert.equal(s1, s2);
});

test('(b) Anruf, Text und Datei landen als Commits im selben Verlauf', async () => {
  const slug = await kontakte.findeOderIssue('Lena Weber');

  await kontakte.commAnruf(slug, {
    zeilen: [{ zeit: '04:12', sprecher: 'Du', text: 'Termin?' }, { zeit: '27:50', sprecher: 'Lena Weber', text: 'Eingefroren.' }],
    dauer: '27:50', partner: 'Lena Weber',
  });
  await kontakte.commText(slug, 'Der Gutachter kommt morgen.', 'Lena Weber');
  await kontakte.commDatei(slug, { name: 'kostenvoranschlag.pdf', bytes: Buffer.from('%PDF-1.4 test') });

  const hist = await kontakte.kontaktHistorie(slug) as Array<{ typ: string; zeitIso: string }>;
  const typen = hist.map((h: { typ: string }) => h.typ);
  assert.ok(typen.includes('anruf'), 'Anruf im Verlauf');
  assert.ok(typen.includes('text'), 'Text im Verlauf');
  assert.ok(typen.includes('datei'), 'Datei im Verlauf');
  assert.ok(hist.length >= 4, 'Initial + 3 Commits'); // + Kontakt-Entstehen
});

test('(c) Verlauf ist nach Zeit gemischt (neueste zuerst)', async () => {
  const hist = await kontakte.kontaktHistorie('lena-weber') as Array<{ zeitIso: string }>;
  const zeiten = hist.map((h: { zeitIso: string }) => h.zeitIso);
  const sortiert = [...zeiten].sort((a, b) => b.localeCompare(a));
  assert.deepEqual(zeiten, sortiert, 'Historie muss absteigend nach Zeit laufen');
});

test('(d) listKontakte zählt Aktivität und findet den Kontakt', async () => {
  await kontakte.findeOderIssue('Stefan Muster');
  await kontakte.commText('stefan-muster', 'Abnahmeprotokoll folgt.', 'Stefan Muster');

  const liste = await kontakte.listKontakte() as Array<{ slug: string; aktivitaet: number; name: string }>;
  const lena = liste.find((k: { slug: string }) => k.slug === 'lena-weber');
  const stefan = liste.find((k: { slug: string }) => k.slug === 'stefan-muster');
  assert.ok(lena, 'Lena in der Liste');
  assert.ok(stefan, 'Stefan in der Liste');
  assert.ok(lena.aktivitaet >= 4, `Lena: ${lena.aktivitaet} Commits erwartet`);
  assert.ok(stefan.aktivitaet >= 2, 'Stefan: Initial + Text');
  assert.equal(lena.name, 'Lena Weber');
});

test('(e) createKontakt manuell + Umlaut-Slug', async () => {
  const k = await kontakte.createKontakt('Dr. Börgen-Müller');
  assert.equal(k.slug, 'dr-boergen-mueller');
  assert.equal(k.name, 'Dr. Börgen-Müller');
});
