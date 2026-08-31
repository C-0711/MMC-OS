/**
 * strom.test.ts — DoD 1 (AUFTRAG §7.1): Commit-pro-Eintrag, Reihenfolge,
 * Formen-Mapping für den geteilten Strom (Branch 'strom').
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as Module from 'node:module';

const execFileP = promisify(execFile);

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

const VAULT = path.join(os.tmpdir(), `strom-vault-${Date.now()}`);
process.env.MMC_VAULT = VAULT;
process.env.GIT_AUTHOR_NAME = 'MMC-Test';
process.env.GIT_AUTHOR_EMAIL = 'test@0711.io';
process.env.GIT_COMMITTER_NAME = 'MMC-Test';
process.env.GIT_COMMITTER_EMAIL = 'test@0711.io';

const vault = require('../src/main/vault');
const strom = require('../src/main/fall-strom');

const FALL = 'strom-testfall';

before(async () => {
  await fsp.mkdir(VAULT, { recursive: true });
  await vault.createFall(FALL);
});

after(async () => {
  await fsp.rm(VAULT, { recursive: true, force: true }).catch(() => {});
});

test('(1) Commit-pro-Eintrag: drei Texte = drei Commits auf strom', async () => {
  await strom.stromEintrag(FALL, { typ: 'text', inhalt: 'Werkstatttermin Freitag?', von: 'Du' });
  await strom.stromEintrag(FALL, { typ: 'text', inhalt: 'Der Ersatzwagen ist organisiert.', von: 'Lena Weber' });
  await strom.stromEintrag(FALL, { typ: 'text', inhalt: 'Alles klar.', von: 'Du' });

  const { stdout } = await execFileP('git', ['-C', path.join(VAULT, FALL), 'rev-list', '--count', 'strom']);
  assert.equal(parseInt(stdout.trim(), 10) >= 3, true, 'mindestens 3 Commits auf strom');
});

test('(2) Chronologische Nummerierung: 0001, 0002, 0003', async () => {
  const liste = await strom.listeStrom(FALL);
  assert.equal(liste.length, 3);
  assert.equal(liste[0].nummer, 1);
  assert.equal(liste[1].nummer, 2);
  assert.equal(liste[2].nummer, 3);
  assert.match(liste[0].inhalt, /Werkstatttermin/);
});

test('(3) Formen-Mapping: Wurf/Anruf als JSON, Text als md', async () => {
  const wurf = await strom.stromEintrag(FALL, {
    typ: 'wurf', inhalt: 'Foto vom Kotflügel', von: 'Du',
    payload: { dateien: ['kotfluegel.jpg'] },
  });
  assert.match(wurf.datei, /^strom\/\d{4}-.*\.json$/);

  const text = await strom.stromEintrag(FALL, { typ: 'text', inhalt: 'Kurz was.', von: 'Du' });
  assert.match(text.datei, /\.md$/);
});

test('(4) strom-Branch ist KEIN main: Working Tree nach Eintrag sauber', async () => {
  const { stdout } = await execFileP('git', ['-C', path.join(VAULT, FALL), 'branch', '--show-current']);
  assert.equal(stdout.trim(), 'main', 'nach stromEintrag ist main wieder ausgecheckt');
});

test('(5) syncWhitelist: nur strom (der Sync-Vertrag)', () => {
  const w = strom.syncWhitelist();
  assert.deepEqual(w, ['strom']);
  assert.ok(!w.includes('main'), 'main wird nie gesynct');
  assert.ok(!w.includes('privat'), 'privat ist nie in der Whitelist');
});
