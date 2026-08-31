/**
 * privat.test.ts — DoD 3 (AUFTRAG §7.3): DER härteste Test des Systems.
 *
 * (a) private Commits existieren NUR auf dem Ref — nicht auf strom, nicht main
 * (b) Sync-Simulation (push nur whitelist) lässt refs/privat unberührt
 * (c) PRIVAT-GREP-TEST: 3 private Suchen → rev-list --all + cat-file + grep
 *     über den simulierten Remote-Klon = 0 Treffer
 * (d) teilePrivat EINER → genau diese eine auf strom, mit Teilungs-Zeitpunkt
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

const VAULT = path.join(os.tmpdir(), `privat-vault-${Date.now()}`);
const REMOTE = path.join(os.tmpdir(), `privat-remote-${Date.now()}.git`);
const B_KLON = path.join(os.tmpdir(), `privat-b-klon-${Date.now()}`);
process.env.MMC_VAULT = VAULT;
process.env.GIT_AUTHOR_NAME = 'MMC-Test';
process.env.GIT_AUTHOR_EMAIL = 'test@0711.io';
process.env.GIT_COMMITTER_NAME = 'MMC-Test';
process.env.GIT_COMMITTER_EMAIL = 'test@0711.io';

const vault = require('../src/main/vault');
const strom = require('../src/main/fall-strom');

const FALL = 'privat-testfall';
const DID = 'did:test:anna';

async function sh(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP('git', ['-C', cwd, ...args], { maxBuffer: 64 * 1024 * 1024 });
  return stdout;
}

before(async () => {
  await fsp.mkdir(VAULT, { recursive: true });
  await vault.createFall(FALL);
  await strom.stromEintrag(FALL, { typ: 'text', inhalt: 'Geteilter Alltag beginnt.', von: 'Du' });
});

after(async () => {
  for (const p of [VAULT, REMOTE, B_KLON]) {
    await fsp.rm(p, { recursive: true, force: true }).catch(() => {});
  }
});

test('(a) private Commits NUR auf dem Ref — nicht auf strom, nicht main', async () => {
  const { sha } = await strom.privatEintrag(DID, FALL, {
    art: 'suche', inhalt: 'Suche: Kontaktdaten aller Beteiligten',
    ergebnis: 'police S. 2, gutachten S. 6',
  });

  // Ref existiert und trägt den Commit (Ref-Name gesluggt wie in Produktion)
  const REF = 'refs/privat/did-test-anna';
  const refSha = (await sh(path.join(VAULT, FALL), ['rev-parse', REF])).trim();
  assert.equal(refSha, sha);

  // Auf strom und main: der Commit darf NICHT erreichbar sein
  const stromCommits = await sh(path.join(VAULT, FALL), ['rev-list', 'strom']);
  assert.ok(!stromCommits.includes(sha), 'privater Commit darf nicht auf strom erreichbar sein');
  const mainCommits = await sh(path.join(VAULT, FALL), ['rev-list', 'main']);
  assert.ok(!mainCommits.includes(sha), 'privater Commit darf nicht auf main erreichbar sein');
});

test('(b) Sync-Simulation: push nur whitelisteter Branch — refs/privat unberührt', async () => {
  const fallPfad = path.join(VAULT, FALL);

  // Bare-Remote als Registry-Stellvertreter
  await execFileP('git', ['init', '--bare', REMOTE]);
  // A pusht NUR strom (whitelist)
  for (const branch of strom.syncWhitelist()) {
    await sh(fallPfad, ['push', REMOTE, branch]);
  }

  // B klont — sieht nur strom und main
  await execFileP('git', ['clone', REMOTE, B_KLON]);
  const bRefs = await sh(B_KLON, ['for-each-ref', '--format=%(refname)']);
  assert.ok(!bRefs.includes('privat'), 'B darf NIE einen privat-Ref sehen');
});

test('(c) PRIVAT-GREP-TEST: 3 private Suchen → 0 Treffer im Remote-Klon', async () => {
  // Noch zwei private Suchen (erste ist aus (a))
  await strom.privatEintrag(DID, FALL, {
    art: 'suche', inhalt: 'Suche: was schulde ich der Werkstatt',
    ergebnis: 'rechnung S. 1: 1.198,00 €',
  });
  await strom.privatEintrag(DID, FALL, {
    art: 'frage', inhalt: 'Frage: Kann ich die Frist Ende September halten?',
    ergebnis: 'Ja — laut Schreiben vom 12.08. [2]',
  });

  // A pusht erneut (nur strom) — B pulled
  const fallPfad = path.join(VAULT, FALL);
  await strom.stromEintrag(FALL, { typ: 'text', inhalt: 'Zweiter geteilter Eintrag.', von: 'Du' });
  await sh(fallPfad, ['push', REMOTE, 'strom', '--force']);
  // B: frischer Klon statt pull (main existiert im Remote nicht — Absicht)
  await fsp.rm(B_KLON, { recursive: true, force: true }).catch(() => {});
  await execFileP('git', ['clone', REMOTE, B_KLON]);

  // Der Grep: ALLE Objekte im B-Klon entpacken und nach den privaten
  // Suchbegriffen grepen — ein einziger Treffer = private Spur ist eine Lüge
  const begriffe = ['Kontaktdaten aller Beteiligten', 'was schulde ich der Werkstatt', 'Kann ich die Frist'];
  for (const begriff of begriffe) {
    // rev-list --all + cat-file über jeden Commit-Baum
    const commits = (await sh(B_KLON, ['rev-list', '--all'])).trim().split('\n').filter(Boolean);
    for (const c of commits) {
      const baum = (await sh(B_KLON, ['rev-parse', `${c}^{tree}`])).trim();
      const inhalt = await sh(B_KLON, ['ls-tree', '-r', baum]).catch(() => '');
      void inhalt;
      // Alle Blobs des Baums holen und grepen
      const zeilen = inhalt.split('\n').filter(z => z.includes('\t'));
      for (const z of zeilen) {
        const blobSha = z.split(' ')[2]?.split('\t')[0];
        if (!blobSha) continue;
        const blob = await sh(B_KLON, ['cat-file', '-p', blobSha]).catch(() => '');
        assert.ok(
          !blob.includes(begriff),
          `LECK! '${begriff}' gefunden in Blob ${blobSha} — die private Spur wäre eine Lüge`
        );
      }
    }
  }
  // Kein Treffer in allen Objekten: Test bestanden = private Spur ist echt
});

test('(d) teilePrivat: genau EINE geteilt — mit Teilungs-Zeitpunkt auf strom', async () => {
  const privateListe = await strom.listePrivat(DID, FALL);
  assert.equal(privateListe.length, 3, 'drei private Einträge vor dem Teilen');
  // git log liefert neueste zuerst — die älteste ist die LETZTE im Array
  const eine = privateListe[privateListe.length - 1]; // die Kontaktdaten-Suche

  const ergebnis = await strom.teilePrivat(DID, FALL, eine.sha);
  assert.ok(ergebnis.geteiltIso, 'Teilungs-Zeitpunkt gesetzt');
  assert.ok(new Date(ergebnis.geteiltIso).getTime() > 0);

  // Auf strom: genau der geteilte Eintrag ist jetzt sichtbar
  const stromListe = await strom.listeStrom(FALL);
  const geteilter = stromListe.find((e: { inhalt: string }) => /Kontaktdaten aller Beteiligten/.test(e.inhalt));
  assert.ok(geteilter, 'der geteilte Eintrag ist auf strom');
  assert.match(geteilter.inhalt, /Geteilt aus dem Privaten/, 'ehrlicher Teilungs-Marker');

  // Die anderen beiden bleiben unsichtbar
  assert.ok(!stromListe.some((e: { inhalt: string }) => /was schulde ich der Werkstatt/.test(e.inhalt)),
    'nicht geteilt = nicht auf strom');
  assert.ok(!stromListe.some((e: { inhalt: string }) => /Kann ich die Frist/.test(e.inhalt)),
    'Frage nicht geteilt = nicht auf strom');

  // Privat-Ref bleibt vollständig — Teilen nimmt nichts weg
  const nachher = await strom.listePrivat(DID, FALL);
  assert.equal(nachher.length, 3, 'Teilen lässt die private Spur unberührt');
});
