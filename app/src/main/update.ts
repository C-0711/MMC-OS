/**
 * update.ts — Auto-Update im OS-Ton (T12).
 *
 * electron-updater gegen den gitchain-Registry-Feed
 * (https://registry.gl.0711.io/updates/mmc-os/). Der Bürger wird gefragt:
 * „Eine neue Fassung liegt bereit — aufnehmen?" — NIE Auto-Download,
 * NIE Auto-Install. (Canvas-Gesetz: Aufnehmen statt Bestätigen.)
 *
 * Der Ja-Knopf im Overlay ruft window.mmc.update.ja() → IPC 'update:ja'.
 */

import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { log } from './log';

export function starteUpdatePruefung(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-available', (info) => {
    log('info', `Update ${info.version} gefunden`);
    frageBuerger(info.version);
  });

  autoUpdater.on('update-downloaded', () => {
    log('info', 'Update geladen — wird beim nächsten Start installiert.');
  });

  autoUpdater.on('error', (e) => {
    log('warn', `Update-Prüfung fehlgeschlagen: ${String(e)}`);
  });

  // Stille Prüfung: beim Start + alle 6h
  pruefe();
  setInterval(pruefe, 6 * 3600 * 1000).unref();
}

function pruefe(): void {
  autoUpdater.checkForUpdates().catch(() => {
    // kein Feed erreichbar — still, der Bürger merkt nichts
  });
}

/** Die Frage an den Bürger — leises Overlay im OS-Ton (30 s, dann still weg). */
function frageBuerger(version: string): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return;

  const v = JSON.stringify(version);
  win.webContents.executeJavaScript(`
    (function () {
      if (document.getElementById('update-frage')) return;
      var ov = document.createElement('div');
      ov.id = 'update-frage';
      ov.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100;' +
        'background:#fff;border:1px solid rgba(184,163,105,.22);border-radius:16px;' +
        'box-shadow:0 30px 80px -24px rgba(70,58,38,.45);padding:16px 22px;' +
        'display:flex;align-items:center;gap:16px;';
      var t = document.createElement('div');
      var titel = document.createElement('div');
      titel.style.fontSize = '15px';
      titel.textContent = 'Eine neue Fassung liegt bereit.';
      var sub = document.createElement('div');
      sub.style.cssText = 'font-size:11px;color:rgba(42,37,32,.55)';
      sub.textContent = 'Version ' + ${v} + ' · aufnehmen, wenn du es für gut hältst';
      t.append(titel, sub);
      var ja = document.createElement('button');
      ja.textContent = 'Aufnehmen';
      ja.style.cssText = 'border:none;border-radius:999px;min-height:36px;padding:0 20px;' +
        'background:#8FA98F;color:#fff;font-size:13px;font-weight:600;cursor:pointer';
      var nein = document.createElement('button');
      nein.textContent = 'später';
      nein.style.cssText = 'border:none;background:none;color:rgba(42,37,32,.55);font-size:13px;cursor:pointer';
      ja.onclick = function () { ov.remove(); window.mmc.update.ja(); };
      nein.onclick = function () { ov.remove(); };
      ov.append(t, ja, nein);
      document.body.appendChild(ov);
      setTimeout(function () { if (document.getElementById('update-frage')) ov.remove(); }, 30000);
    })();
  `).catch(() => {
    // Renderer noch nicht bereit — still
  });
}

/** IPC-Handler: der Bürger hat genickt — jetzt laden (Install beim Neustart). */
export function registriereUpdateIpc(): void {
  const { ipcMain } = require('electron');
  ipcMain.handle('update:ja', async () => {
    await autoUpdater.downloadUpdate().catch((e) => {
      log('warn', `Update-Download fehlgeschlagen: ${String(e)}`);
    });
    return { ok: true };
  });
}
