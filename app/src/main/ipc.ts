/**
 * ipc.ts — IPC-Handler für Vault, OCR und LLM
 * Vermittelt zwischen Renderer-Prozess und Main-Logik
 */

import { ipcMain, shell } from 'electron';
import * as vault from './vault';
import * as services from './services';
import * as gitchain from './gitchain';
import * as uebersicht from './uebersicht';
import * as anruf from './anruf';
import * as themen from './themen';
import * as suche from './suche';
import * as ingest from './ingest';
import * as anrufLive from './anruf-live';
import { deutungAusOcr, deutungAusTranskript, type Transkript } from './deutung';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function registerIpcHandlers(): void {
  // ============================================================================
  // Vault-API
  // ============================================================================

  ipcMain.handle('vault:listFaelle', async () => {
    return await vault.listFaelle();
  });

  ipcMain.handle('vault:createFall', async (_event, id: string) => {
    return await vault.createFall(id);
  });

  ipcMain.handle(
    'vault:commitEingang',
    async (
      _event,
      fallId: string,
      quelle: { absender: string; kanal: string },
      datei: { name: string; bytes: number[] }
    ) => {
      // ArrayBuffer → Buffer (über Number-Array)
      const buffer = Buffer.from(datei.bytes);
      return await vault.commitEingang(fallId, quelle, {
        name: datei.name,
        bytes: buffer
      });
    }
  );

  ipcMain.handle(
    'vault:proposeDeutung',
    async (
      _event,
      fallId: string,
      proposalId: string,
      atoms: vault.Atom[],
      kartentext: { titel: string; frage: string }
    ) => {
      return await vault.proposeDeutung(fallId, proposalId, atoms, kartentext);
    }
  );

  ipcMain.handle('vault:listVorschlaege', async (_event, fallId: string) => {
    return await vault.listVorschlaege(fallId);
  });

  ipcMain.handle('vault:listAtomsMain', async (_event, fallId: string) => {
    return await vault.listAtomsMain(fallId);
  });

  ipcMain.handle('vault:mergeVorschlag', async (_event, fallId: string, proposalId: string) => {
    return await vault.mergeVorschlag(fallId, proposalId);
  });

  ipcMain.handle('vault:rejectVorschlag', async (_event, fallId: string, proposalId: string, grund?: string) => {
    await vault.rejectVorschlag(fallId, proposalId, grund);
  });

  ipcMain.handle('vault:fallErzaehlung', async (_event, fallId: string) => {
    return await vault.fallErzaehlung(fallId);
  });

  ipcMain.handle('vault:readDocAsDataUrl', async (_event, fallId: string, docRelPath: string) => {
    const vaultRoot = process.env.MMC_VAULT ?? path.join(require('os').homedir(), 'MMC-Vault');
    const fallPfad = path.join(vaultRoot, fallId);
    const docPfad = path.join(fallPfad, docRelPath);

    // Sicherheitscheck: docPfad muss innerhalb von fallPfad liegen
    const normalizedFall = path.normalize(fallPfad);
    const normalizedDoc = path.normalize(docPfad);
    if (!normalizedDoc.startsWith(normalizedFall)) {
      throw new Error('Sicherheitsfehler: Pfad außerhalb des Falls');
    }

    const bytes = await fs.readFile(docPfad);
    const base64 = bytes.toString('base64');

    // Detect mime type by extension
    const ext = path.extname(docRelPath).toLowerCase();
    let mime = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.png') mime = 'image/png';
    else if (ext === '.pdf') mime = 'application/pdf';

    return `data:${mime};base64,${base64}`;
  });

  // ============================================================================
  // OCR-API
  // ============================================================================

  ipcMain.handle('ocr:health', async () => {
    return await services.ocrHealth();
  });

  ipcMain.handle('ocr:deuteBeleg', async (_event, datei: { name: string; bytes: number[]; mime?: string }) => {
    const buffer = Buffer.from(datei.bytes);
    return await services.deuteBeleg({
      name: datei.name,
      bytes: buffer,
      mime: datei.mime
    });
  });

  // ============================================================================
  // Deutung-API (Heuristik läuft NUR hier — eine Quelle der Wahrheit)
  // ============================================================================

  ipcMain.handle('deutung:ausOcr', async (_event, ocr: services.OcrErgebnis, docName: string) => {
    return deutungAusOcr(ocr, docName);
  });

  ipcMain.handle('deutung:ausTranskript', async (_event, transkript: Transkript, docName: string) => {
    return deutungAusTranskript(transkript, docName);
  });

  // ============================================================================
  // LLM-API
  // ============================================================================

  ipcMain.handle('llm:fragMich', async (_event, frage: string, kontext: services.ZitatKontext[]) => {
    return await services.fragMich(frage, kontext);
  });

  // ============================================================================
  // gitchain-API (0711-Backend: Device-Login, Introspection, Push, Registry)
  // ============================================================================

  ipcMain.handle('gitchain:status', async () => {
    return await gitchain.status();
  });

  ipcMain.handle('gitchain:loginStart', async () => {
    const start = await gitchain.deviceStart();
    // verify_url wurde in gitchain.ts gegen die Auth-Basis validiert (Bau-Regel 5)
    await shell.openExternal(start.verifyUrl);
    return start;
  });

  ipcMain.handle('gitchain:loginPoll', async (_event, deviceCode: string) => {
    return await gitchain.devicePoll(deviceCode);
  });

  ipcMain.handle('gitchain:whoami', async () => {
    return await gitchain.whoami();
  });

  ipcMain.handle('gitchain:logout', async () => {
    gitchain.vergissPat();
  });

  ipcMain.handle('gitchain:pushFall', async (_event, fallId: string) => {
    return await gitchain.pushFall(fallId);
  });

  ipcMain.handle('gitchain:registry', async () => {
    return await gitchain.registry();
  });

  // ============================================================================
  // Fall-Übersicht (T1) — OsFall & Heute
  // ============================================================================
  ipcMain.handle('vault:getFallUebersicht', async (_event, fallId: string) => {
    return await uebersicht.getFallUebersicht(fallId);
  });

  // ============================================================================
  // Anrufe (T3) — Anrufe & Texte
  // ============================================================================
  ipcMain.handle('anruf:list', async (_event, fallId: string) => {
    return await anruf.listAnrufe(fallId);
  });

  // ============================================================================
  // Themen & Stapel (T4) — Themen-Bereich
  // ============================================================================
  ipcMain.handle('themen:alle', async () => {
    return await themen.alleThemen();
  });

  ipcMain.handle('themen:stapel', async () => {
    return await themen.stapel();
  });

  ipcMain.handle('themen:neuesThema', async () => {
    return await themen.neuesThema();
  });

  // ============================================================================
  // Suche (T5) — Frag alles über alle Fälle
  // ============================================================================
  ipcMain.handle('suche:fragAlles', async (_event, frage: string) => {
    return await suche.fragAlles(frage);
  });

  // ============================================================================
  // Ingest (T2) — W1a-Worker in der App (SSE → webContents.send)
  // ============================================================================
  ipcMain.handle('ingest:start', async (_event, quellen: string[]) => {
    return ingest.start(quellen);
  });

  ipcMain.handle('ingest:scanReport', async (_event, quellen: string[]) => {
    return await ingest.scanReport(quellen);
  });

  ipcMain.handle('ingest:status', async () => {
    return ingest.status();
  });

  ipcMain.handle('ingest:ask', async (_event, frage: string) => {
    return ingest.antwortAusAtomen(frage);
  });

  // ============================================================================
  // Anruf-Live (Etappe D, T15) — Signaling über die gitchain-Registry
  // ============================================================================
  ipcMain.handle('anrufLive:signalSenden', async (_event, nachricht: anrufLive.SignalNachricht) => {
    await anrufLive.signalSenden(nachricht);
    return { ok: true };
  });

  ipcMain.handle('anrufLive:signalEmpfangen', async (_event, meineId: string, seitIso: string | null) => {
    return await anrufLive.signalEmpfangen(meineId, seitIso);
  });
}
