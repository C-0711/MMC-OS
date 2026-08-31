/**
 * log.ts — Stilles, rotierendes Log (T9). KEIN crashReporter (Telemetrie-Verbot),
 * kein Versand. Schreibt in userData/logs/app-YYYY-MM-DD.log, räumt >14 Tage auf.
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MAX_TAGE = 14;

function logDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

function heutigeDatei(): string {
  const d = new Date();
  const name = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return path.join(logDir(), `app-${name}.log`);
}

/** Einmal beim Start: altes Log aufräumen. */
export function logAufräumen(): void {
  try {
    const dir = logDir();
    if (!fs.existsSync(dir)) return;
    const schwelle = Date.now() - MAX_TAGE * 24 * 3600 * 1000;
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^app-(\d{4})-(\d{2})-(\d{2})\.log$/);
      if (!m) continue;
      const iso = `${m[1]}-${m[2]}-${m[3]}`;
      if (new Date(iso).getTime() < schwelle) {
        fs.rmSync(path.join(dir, f), { force: true });
      }
    }
  } catch { /* Logging darf nie die App werfen */ }
}

export function log(stufe: 'info' | 'warn' | 'error', meldung: string): void {
  try {
    fs.mkdirSync(logDir(), { recursive: true });
    const zeit = new Date().toISOString();
    fs.appendFileSync(heutigeDatei(), `${zeit} [${stufe}] ${meldung}\n`);
  } catch { /* still */ }
}

/** Globaler Sicherheitsnetz: Fehler fangen, loggen, Fenster neu laden —
 *  die App bleibt da (der Vault ist Git, nichts geht verloren). */
export function installiereCrashNetz(winFactory: () => void): void {
  process.on('uncaughtException', (err) => {
    log('error', `uncaughtException: ${String(err?.stack ?? err)}`);
    try {
      const { BrowserWindow } = require('electron') as typeof import('electron');
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) win.reload(); // still neu laden
      else winFactory();
    } catch { winFactory(); }
  });

  process.on('unhandledRejection', (grund) => {
    log('error', `unhandledRejection: ${String(grund)}`);
  });
}
