/**
 * produktionsbetrieb.test.ts — Abnahme T9/T10 (Etappe C).
 *
 * T9: Log schreibt, rotiert nach Datum, räumt >14 Tage auf.
 * T10: backupJetzt erzeugt git-Bundle je Fall; Bundle ist wieder
 *      herstellbar (git clone → Inhalt byte-identisch); Pruning hält
 *      24h/30d-Regel.
 *
 * log.ts/backup.ts importieren electron — Module._load-Stub wie in
 * datenkanaele.test.ts.
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

// --- electron-Stub ---------------------------------------------------------
const Loader = require('node:module') as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const origLoad = Loader._load;
let logDirOverride: string | null = null;
Object.defineProperty(Loader, '_load', {
  value: function (request: string, parent: unknown, isMain: boolean) {
    if (request === 'electron') {
      return {
        app: {
          getPath: () => logDirOverride ?? os.tmpdir(),
          getVersion: () => '0.1.0-test',
        },
        BrowserWindow: { getAllWindows: () => [] },
        powerMonitor: { on: () => {} },
        ipcMain: { handle: () => {} },
        shell: { openExternal: async () => {} },
      };
    }
    return origLoad.call(Loader, request, parent, isMain);
  },
  writable: true,
  configurable: true,
});

const log = require('../src/main/log');
const backup = require('../src/main/backup');

const VAULT = path.join(os.tmpdir(), `prod-vault-${Date.now()}`);
const ZIEL = path.join(os.tmpdir(), `prod-backup-${Date.now()}`);
process.env.MMC_VAULT = VAULT;

before(async () => {
  await fsp.mkdir(VAULT, { recursive: true });
  // Test-Identität (Rechner hat evtl. keine globale git-Config)
  process.env.GIT_AUTHOR_NAME = process.env.GIT_AUTHOR_NAME ?? 'MMC-Test';
  process.env.GIT_AUTHOR_EMAIL = process.env.GIT_AUTHOR_EMAIL ?? 'test@0711.io';
  process.env.GIT_COMMITTER_NAME = process.env.GIT_COMMITTER_NAME ?? 'MMC-Test';
  process.env.GIT_COMMITTER_EMAIL = process.env.GIT_COMMITTER_EMAIL ?? 'test@0711.io';
  // Ein echter Fall mit Commit (git nötig für bundle)
  const fallPfad = path.join(VAULT, 'steuern-2026');
  await fsp.mkdir(path.join(fallPfad, 'docs'), { recursive: true });
  await fsp.writeFile(path.join(fallPfad, 'docs', 'beleg.txt'), 'Umsatzsteuer 1.190,00 €');
  await execFileP('git', ['-C', fallPfad, 'init', '-b', 'main']);
  await execFileP('git', ['-C', fallPfad, 'add', '.']);
  await execFileP('git', ['-C', fallPfad, 'commit', '-m', 'initialer Fall: steuern-2026', '--allow-empty']);
  console.log('BEFORE OK, VAULT =', VAULT);
});

after(async () => {
  await fsp.rm(VAULT, { recursive: true, force: true }).catch(() => {});
  await fsp.rm(ZIEL, { recursive: true, force: true }).catch(() => {});
});

// T9 — Log
test('T9: log schreibt in userData/logs und rotiert nach Datum', async () => {
  logDirOverride = path.join(os.tmpdir(), `prod-logs-${Date.now()}`);
  log.log('info', 'test-meldung');
  const dir = logDirOverride;
  const dateien = await fsp.readdir(path.join(dir, 'logs'));
  const heute = dateien.find(f => f.match(/^app-\d{4}-\d{2}-\d{2}\.log$/));
  assert.ok(heute, 'heutige Log-Datei existiert');
  const inhalt = await fsp.readFile(path.join(dir, 'logs', heute), 'utf8');
  assert.match(inhalt, /\[info\] test-meldung/);
});

test('T9: altes Log (>14 Tage) wird aufgeräumt', async () => {
  logDirOverride = path.join(os.tmpdir(), `prod-logs-alt-${Date.now()}`);
  const alt = path.join(logDirOverride, 'logs', 'app-2020-01-01.log');
  await fsp.mkdir(path.dirname(alt), { recursive: true });
  await fsp.writeFile(alt, 'alt');
  log.logAufräumen();
  const rest = await fsp.readdir(path.join(logDirOverride, 'logs'));
  assert.ok(!rest.includes('app-2020-01-01.log'), '>14 Tage wird gelöscht');
});

// T10 — Backup
test('T10: backupJetzt erzeugt Bundle je Fall', async () => {
  const erg = await backup.backupJetzt(ZIEL);
  console.log('BACKUP ERG =', JSON.stringify(erg));
  assert.equal(erg.bundles, 1, 'ein Fall → ein Bundle');
  const fallDir = await fsp.readdir(ZIEL);
  assert.ok(fallDir.includes('steuern-2026'));
  const bundles = (await fsp.readdir(path.join(ZIEL, 'steuern-2026'))).filter(f => f.endsWith('.bundle'));
  assert.equal(bundles.length, 1);
});

test('T10: Bundle ist wiederherstellbar — Inhalt byte-identisch', async () => {
  const bundles = (await fsp.readdir(path.join(ZIEL, 'steuern-2026'))).filter(f => f.endsWith('.bundle'));
  const bundlePfad = path.join(ZIEL, 'steuern-2026', bundles[0]);
  const wieder = path.join(os.tmpdir(), `prod-restore-${Date.now()}`);
  // git clone aus Bundle
  await execFileP('git', ['clone', bundlePfad, wieder]);
  const inhalt = await fsp.readFile(path.join(wieder, 'docs', 'beleg.txt'), 'utf8');
  assert.equal(inhalt, 'Umsatzsteuer 1.190,00 €', 'byte-identisch wiederhergestellt');
  await fsp.rm(wieder, { recursive: true, force: true });
});
