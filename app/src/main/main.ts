import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc';
import { log, logAufräumen, installiereCrashNetz } from './log';
import { starteBackupJob, backupJetzt } from './backup';
import { starteUpdatePruefung, registriereUpdateIpc } from './update';

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#FAF7F2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Sicherheitsnetz: NIE weg von der App-Seite navigieren (z. B. wenn ein
  // Datei-Drop doch durchrutscht — Chromium wuerde sonst die Datei laden).
  mainWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // In Entwicklung: DevTools öffnen
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Crash-Netz VOR allem anderen (T9): Fehler fangen, loggen, still weiter.
installiereCrashNetz(() => createWindow());
logAufräumen();
log('info', `MMC-OS startet · version ${app.getVersion()}`);

app.whenReady().then(() => {
  // IPC-Handler registrieren
  registerIpcHandlers();

  createWindow();

  // Backup-Job (T10): stündlich, git bundle je Fall
  starteBackupJob();

  // Update-Prüfung (T12): still, Frage im OS-Ton — nie Auto-Install
  registriereUpdateIpc();
  starteUpdatePruefung();
  backupJetzt().catch((e) => log('warn', `Erst-Backup fehlgeschlagen: ${String(e)}`));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
