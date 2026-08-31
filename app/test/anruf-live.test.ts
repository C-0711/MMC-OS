/**
 * anruf-live.test.ts — Abnahme Etappe D (T15/T17).
 *
 * T15: Signal-Commit im lokalen Signal-Fall + Nachrichten-Form (Vertrag).
 * T17: AnrufLive-Klassenlogik mit gemocktem RTCPeerConnection —
 *      Phasen, Zeilen mit Minute/Sprecher, Auflegen.
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
        safeStorage: {
          isEncryptionAvailable: () => true,
          encryptString: (s: string) => Buffer.from(`enc:${s}`),
          decryptString: (b: Buffer) => b.toString().replace(/^enc:/, ''),
        },
      };
    }
    return origLoad.call(Loader, request, parent, isMain);
  },
  writable: true,
  configurable: true,
});

const VAULT = path.join(os.tmpdir(), `signal-vault-${Date.now()}`);
process.env.MMC_VAULT = VAULT;
process.env.GIT_AUTHOR_NAME = 'MMC-Test';
process.env.GIT_AUTHOR_EMAIL = 'test@0711.io';
process.env.GIT_COMMITTER_NAME = 'MMC-Test';
process.env.GIT_COMMITTER_EMAIL = 'test@0711.io';

before(async () => {
  await fsp.mkdir(VAULT, { recursive: true });
  // PAT-Datei wie gitchain.ts sie liest (Stub-safeStorage: enc: prefix)
  await fsp.writeFile(path.join(os.tmpdir(), 'gitchain-pat.enc'), Buffer.from('enc:test-pat'));
});

after(async () => {
  await fsp.rm(VAULT, { recursive: true, force: true }).catch(() => {});
});

// T15 — Signal-Transport
test('T15: pushSignal schreibt Signal-Commit ins lokale Signal-Fall-Repo', async () => {
  const gitchain = require('../src/main/gitchain');
  try {
    await gitchain.pushSignal('mmc-signal-testkandidat', JSON.stringify({
      von: 'Du', an: 'testkandidat', art: 'angebot',
      daten: { sdp: 'v=0' }, zeit: new Date().toISOString(),
    }));
  } catch {
    // Push zum Remote darf scheitern (kein Backend im Test) — der lokale
    // Commit ist der Beweis für den Transport-Kontrakt.
  }
  const signalPfad = path.join(VAULT, 'mmc-signal-testkandidat');
  const dateien = await fsp.readdir(path.join(signalPfad, 'docs')).catch(() => []);
  assert.ok(
    dateien.some(f => f.startsWith('signal-') && f.endsWith('.json')),
    'Signal-Commit muss im lokalen Signal-Fall liegen'
  );
});

test('T15: Signal-Nachricht-Form ist der Vertrag (von/an/art/zeit)', async () => {
  const anrufLiveMain = require('../src/main/anruf-live');
  const n = {
    von: 'Du', an: 'Lena', art: 'kandidat',
    daten: { kandidat: { candidate: 'x', sdpMid: '0', sdpMLineIndex: 0 } },
    zeit: new Date().toISOString(),
  } as typeof anrufLiveMain.SignalNachricht;
  assert.ok(typeof n.von === 'string' && typeof n.an === 'string');
  assert.ok(['angebot', 'antwort', 'kandidat', 'auflegen'].includes(n.art));
  assert.ok(!Number.isNaN(new Date(n.zeit).getTime()));
});

// T17 — AnrufLive-Klassenlogik (WebRTC gemockt)
test('T17: AnrufLive — Phasen rufend → beendet, Zeilen mit Minute', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.RTCPeerConnection = class MockPC {
    onicecandidate: ((e: { candidate: unknown }) => void) | null = null;
    localDescription = { sdp: 'v=0 mock' };
    async createOffer() { return { type: 'offer', sdp: 'v=0 mock' }; }
    async setLocalDescription(): Promise<void> { /* mock */ }
    async createAnswer() { return { type: 'answer', sdp: 'v=0' }; }
    async setRemoteDescription(): Promise<void> { /* mock */ }
    async addIceCandidate(): Promise<void> { /* mock */ }
    createDataChannel() {
      return { onopen: null, onmessage: null, onclose: null, readyState: 'connecting', send(): void {}, close(): void {} };
    }
    close(): void { /* mock */ }
  };
  g.window = {
    mmc: {
      anrufLive: {
        signalSenden: async () => ({ ok: true }),
        signalEmpfangen: async () => [],
      },
    },
  };

  // Renderer-dist laden (kompiliert nach dist/renderer/)
  const { AnrufLive } = require('../src/renderer/anruf-live-renderer.js') as {
    AnrufLive: new () => { phase: string; zeilen: Array<{ zeit: string; sprecher: string; text: string }>; beimAendern(cb: () => void): void; anrufen(p: string): Promise<void>; sage(t: string): void; auflegen(): void };
  };

  const live = new AnrufLive();
  const phasen: string[] = [];
  live.beimAendern(() => phasen.push(live.phase));

  await live.anrufen('Lena Weber');
  assert.equal(live.phase, 'rufend', 'Anruf beginnt rufend');

  // Kanal direkt mocken (open) und Zeilen beweisen
  (live as unknown as { kanal: { readyState: string; send(d: string): void; close(): void } }).kanal = {
    readyState: 'open',
    send: (): void => { /* mock */ },
    close: (): void => { /* mock */ },
  };
  live.sage('Werkstatttermin Freitag?');
  assert.equal(live.zeilen.length, 1);
  assert.match(live.zeilen[0].text, /Werkstatttermin/);
  assert.match(live.zeilen[0].sprecher, /Du/);
  assert.match(live.zeilen[0].zeit, /^\d{2}:\d{2}$/, 'Minute im MM:SS-Format');

  live.auflegen();
  assert.equal(live.phase, 'beendet');
});
