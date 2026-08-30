import { contextBridge } from 'electron';

/**
 * window.mmc API — IPC-Bridge zwischen Renderer und Main-Prozess
 *
 * Wird in Etappe 2 (Vault) und Etappe 3 (Ingress + LLM) gefüllt.
 */

export interface MMCVaultAPI {
  // TODO Etappe 2: Fall-Repos anlegen/lesen, Eingang-Commit, Branch-Vorschlag, Merge
  // createFall(name: string): Promise<string>;
  // commitEingang(fallId: string, file: ArrayBuffer, meta: object): Promise<string>;
  // listFaelle(): Promise<Array<{name: string, path: string}>>;
}

export interface MMCOCR_API {
  // TODO Etappe 3: belegsrv /v1/ocr aufrufen
  // deuteBeleg(file: ArrayBuffer): Promise<{zeilen: Array<{text: string, conf: number, bbox: [number, number, number, number]}>, secs: number}>;
}

export interface MMCLLM_API {
  // TODO Etappe 3: vLLM :11435 (OpenAI-kompatibel) für Frag-mich-Antworten
  // ask(frage: string, context: string[]): Promise<{antwort: string, zitate: Array<{text: string, quelle: object}>}>;
}

export interface MMCAPI {
  vault: MMCVaultAPI;
  ocr: MMCOCR_API;
  llm: MMCLLM_API;
}

const api: MMCAPI = {
  vault: {
    // Platzhalter — wird in Etappe 2 mit ipcRenderer.invoke(...) gefüllt
  },
  ocr: {
    // Platzhalter — wird in Etappe 3 mit ipcRenderer.invoke(...) gefüllt
  },
  llm: {
    // Platzhalter — wird in Etappe 3 mit ipcRenderer.invoke(...) gefüllt
  }
};

contextBridge.exposeInMainWorld('mmc', api);

// Type-Definition für TypeScript im Renderer
declare global {
  interface Window {
    mmc: MMCAPI;
  }
}
