import { contextBridge, ipcRenderer } from 'electron';

/**
 * window.mmc API — IPC-Bridge zwischen Renderer und Main-Prozess
 */

// Type definitions (matching vault.ts, services.ts)
export interface FallInfo {
  id: string;
  pfad: string;
  offeneVorschlaege: number;
  letzterCommitIso: string;
}

// Fundstelle: dokument (Rechteck) ODER anruf (Zeitmarke). Fehlendes art = dokument.
export interface Fundstelle {
  art?: 'dokument' | 'anruf';
  doc: string;
  seite?: number;
  bbox?: [number, number, number, number];
  wav?: string;
  minute?: string; // "04:12"
  dauer?: string;
}

export interface Atom {
  id: string;
  feld: string;
  wert: string;
  fundstelle: Fundstelle;
  conf: number;
}

export interface Vorschlag {
  id: string;
  kartentext: {
    titel: string;
    frage: string;
  };
  atoms: Atom[];
  branch: string;
}

export interface ErzaehlSatz {
  satz: string;
  commitZeile: string;
  sha: string;
  datumIso: string;
}

export interface OcrLine {
  bbox: [number, number, number, number];
  text: string;
  conf: number;
}

export interface OcrPage {
  index: number;
  width: number;
  height: number;
  lines: OcrLine[];
}

export interface OcrErgebnis {
  name: string;
  pagesTotal: number;
  totalMs: number;
  pages: OcrPage[];
}

export interface DeutungErgebnis {
  atoms: Atom[];
  kartentext: {
    titel: string;
    frage: string;
  };
  zweifel: boolean;
}

export interface ZitatKontext {
  fall: string;
  doc: string;
  seite: number;
  text: string;
}

export interface MMCVaultAPI {
  listFaelle(): Promise<FallInfo[]>;
  createFall(id: string): Promise<FallInfo>;
  commitEingang(
    fallId: string,
    quelle: { absender: string; kanal: string },
    datei: { name: string; bytes: ArrayBuffer }
  ): Promise<{ sha: string; docPfad: string }>;
  proposeDeutung(
    fallId: string,
    proposalId: string,
    atoms: Atom[],
    kartentext: { titel: string; frage: string }
  ): Promise<{ branch: string; sha: string }>;
  listVorschlaege(fallId: string): Promise<Vorschlag[]>;
  listAtomsMain(fallId: string): Promise<Array<{ titel: string; atoms: Atom[] }>>;
  mergeVorschlag(fallId: string, proposalId: string): Promise<{ sha: string }>;
  rejectVorschlag(fallId: string, proposalId: string, grund?: string): Promise<void>;
  fallErzaehlung(fallId: string): Promise<ErzaehlSatz[]>;
  readDocAsDataUrl(fallId: string, docRelPath: string): Promise<string>;
}

// Anruf-Transkript (kanal: "anruf") — Deutung fundiert auf Minuten
export interface TranskriptZeile {
  zeit: string; // "04:12"
  sprecher: string;
  text: string;
}

export interface Transkript {
  art: 'anruf';
  titel?: string;
  wav: string;
  dauer?: string;
  zeilen: TranskriptZeile[];
}

export interface MMCOCR_API {
  health(): Promise<boolean>;
  deuteBeleg(datei: { name: string; bytes: ArrayBuffer; mime?: string }): Promise<OcrErgebnis>;
  deutungAusOcr(ocr: OcrErgebnis, docName: string): Promise<DeutungErgebnis>;
  deutungAusTranskript(transkript: Transkript, docName: string): Promise<DeutungErgebnis>;
}

export interface MMCLLM_API {
  fragMich(frage: string, kontext: ZitatKontext[]): Promise<{ antwort: string }>;
}

// gitchain-Anbindung (0711-Backend)
export interface GitchainStatus {
  apiUrl: string;
  angemeldet: boolean;
  user: string | null;
}

export interface GitchainDeviceStart {
  userCode: string;
  deviceCode: string;
  verifyUrl: string;
  intervalSek: number;
  expiresInSek: number;
}

export type GitchainPollErgebnis =
  | { status: 'ok'; user: string | null }
  | { status: 'wartet' }
  | { status: 'fehler'; meldung: string };

export type GitchainWhoami =
  | { ok: true; user: string; raw: Record<string, unknown> }
  | { ok: false; meldung: string };

export interface GitchainPushErgebnis {
  ok: boolean;
  remoteUrl: string;
  meldung: string;
  remoteRefs: string[];
}

export interface MMCGitchainAPI {
  status(): Promise<GitchainStatus>;
  loginStart(): Promise<GitchainDeviceStart>;
  loginPoll(deviceCode: string): Promise<GitchainPollErgebnis>;
  whoami(): Promise<GitchainWhoami>;
  logout(): Promise<void>;
  pushFall(fallId: string): Promise<GitchainPushErgebnis>;
  registry(): Promise<{ version: string; count: number; ids: string[] }>;
}

export interface MMCUebersichtAPI {
  getFallUebersicht(fallId: string): Promise<FallUebersicht>;
}

export interface FallUebersicht {
  fallId: string;
  dinge: Array<{ titel: string; frage: string; quelle: string; proposalId: string | null }>;
  protokoll: ErzaehlSatz[];
  beteiligte: string[];
}

export interface AnrufInfo {
  id: string;
  fallId: string;
  doc: string;
  partner: string;
  dauer: string;
  zeilen: Array<{ zeit: string; sprecher: string; text: string }>;
  minuten: string[];
}

export interface ThemaInfo {
  name: string;
  anzahl: number;
  fallId: string;
}

export interface StapelEintrag {
  fallId: string;
  satz: string;
  commitZeile: string;
}

export interface ThemaVorschlag {
  fallIdVorschlag: string;
  titel: string;
  quelle: string;
  proposalId: string;
}

export interface SuchErgebnis {
  frage: string;
  antwort: string;
  treffer: Array<{ fall: string; doc: string; seite: number; text: string; feld: string; wert: string }>;
  ehrlich: boolean;
}

export interface IngestStatus {
  phase: string;
  fertig: number;
  total: number;
  atome: number;
}

export type IngestEvent =
  | { typ: 'dokument_fertig'; name: string; lane: string; ms: number; atome: number; fundstellen: number }
  | { typ: 'bericht_aktualisiert'; zusammenfassung: string; namenAusDokumenten: string[] }
  | { typ: 'fragen_bereit'; fragen: Array<{ text: string; atomRef: string }> }
  | { typ: 'done'; totalMs: number; textSeiten: number; ocrSeiten: number }
  | { typ: 'scan_bericht'; quellen: Array<{ name: string; dateien: number; bytes: number; aeltestes: string | null; geschuetzt: number; gelesen: boolean }> };

export interface MMCDatenAPI {
  getFallUebersicht(fallId: string): Promise<FallUebersicht>;
  listAnrufe(fallId: string): Promise<AnrufInfo[]>;
  themenAlle(): Promise<ThemaInfo[]>;
  stapel(): Promise<StapelEintrag[]>;
  neuesThema(): Promise<ThemaVorschlag[]>;
  fragAlles(frage: string): Promise<SuchErgebnis>;
  ingestStart(quellen: string[]): Promise<{ ok: boolean; anzahl: number; fehler?: string }>;
  ingestScanReport(quellen: string[]): Promise<Array<{ name: string; dateien: number; bytes: number; aeltestes: string | null; geschuetzt: number; gelesen: boolean }>>;
  ingestStatus(): Promise<IngestStatus>;
  ingestAsk(frage: string): Promise<{ text: string; zitate: string[] } | null>;
  onIngestEvent(cb: (ev: IngestEvent) => void): () => void;
}

export interface MMCAPI {
  vault: MMCVaultAPI;
  ocr: MMCOCR_API;
  llm: MMCLLM_API;
  gitchain: MMCGitchainAPI;
  daten: MMCDatenAPI;
}

// Helper: ArrayBuffer → Number-Array für IPC
function arrayBufferToNumbers(ab: ArrayBuffer): number[] {
  return Array.from(new Uint8Array(ab));
}

const api: MMCAPI = {
  vault: {
    listFaelle: () => ipcRenderer.invoke('vault:listFaelle'),
    createFall: (id: string) => ipcRenderer.invoke('vault:createFall', id),
    commitEingang: (fallId: string, quelle: { absender: string; kanal: string }, datei: { name: string; bytes: ArrayBuffer }) =>
      ipcRenderer.invoke('vault:commitEingang', fallId, quelle, {
        name: datei.name,
        bytes: arrayBufferToNumbers(datei.bytes)
      }),
    proposeDeutung: (fallId: string, proposalId: string, atoms: Atom[], kartentext: { titel: string; frage: string }) =>
      ipcRenderer.invoke('vault:proposeDeutung', fallId, proposalId, atoms, kartentext),
    listVorschlaege: (fallId: string) => ipcRenderer.invoke('vault:listVorschlaege', fallId),
    listAtomsMain: (fallId: string) => ipcRenderer.invoke('vault:listAtomsMain', fallId),
    mergeVorschlag: (fallId: string, proposalId: string) => ipcRenderer.invoke('vault:mergeVorschlag', fallId, proposalId),
    rejectVorschlag: (fallId: string, proposalId: string, grund?: string) =>
      ipcRenderer.invoke('vault:rejectVorschlag', fallId, proposalId, grund),
    fallErzaehlung: (fallId: string) => ipcRenderer.invoke('vault:fallErzaehlung', fallId),
    readDocAsDataUrl: (fallId: string, docRelPath: string) => ipcRenderer.invoke('vault:readDocAsDataUrl', fallId, docRelPath)
  },
  ocr: {
    health: () => ipcRenderer.invoke('ocr:health'),
    deuteBeleg: (datei: { name: string; bytes: ArrayBuffer; mime?: string }) =>
      ipcRenderer.invoke('ocr:deuteBeleg', {
        name: datei.name,
        bytes: arrayBufferToNumbers(datei.bytes),
        mime: datei.mime
      }),
    deutungAusOcr: (ocr: OcrErgebnis, docName: string) =>
      ipcRenderer.invoke('deutung:ausOcr', ocr, docName),
    deutungAusTranskript: (transkript: Transkript, docName: string) =>
      ipcRenderer.invoke('deutung:ausTranskript', transkript, docName)
  },
  llm: {
    fragMich: (frage: string, kontext: ZitatKontext[]) => ipcRenderer.invoke('llm:fragMich', frage, kontext)
  },
  gitchain: {
    status: () => ipcRenderer.invoke('gitchain:status'),
    loginStart: () => ipcRenderer.invoke('gitchain:loginStart'),
    loginPoll: (deviceCode: string) => ipcRenderer.invoke('gitchain:loginPoll', deviceCode),
    whoami: () => ipcRenderer.invoke('gitchain:whoami'),
    logout: () => ipcRenderer.invoke('gitchain:logout'),
    pushFall: (fallId: string) => ipcRenderer.invoke('gitchain:pushFall', fallId),
    registry: () => ipcRenderer.invoke('gitchain:registry')
  },
  daten: {
    getFallUebersicht: (fallId: string) => ipcRenderer.invoke('vault:getFallUebersicht', fallId),
    listAnrufe: (fallId: string) => ipcRenderer.invoke('anruf:list', fallId),
    themenAlle: () => ipcRenderer.invoke('themen:alle'),
    stapel: () => ipcRenderer.invoke('themen:stapel'),
    neuesThema: () => ipcRenderer.invoke('themen:neuesThema'),
    fragAlles: (frage: string) => ipcRenderer.invoke('suche:fragAlles', frage),
    ingestStart: (quellen: string[]) => ipcRenderer.invoke('ingest:start', quellen),
    ingestScanReport: (quellen: string[]) => ipcRenderer.invoke('ingest:scanReport', quellen),
    ingestStatus: () => ipcRenderer.invoke('ingest:status'),
    ingestAsk: (frage: string) => ipcRenderer.invoke('ingest:ask', frage),
    onIngestEvent: (cb: (ev: IngestEvent) => void) => {
      const handler = (_e: unknown, ev: IngestEvent) => cb(ev);
      ipcRenderer.on('ingest-event', handler);
      return () => ipcRenderer.removeListener('ingest-event', handler);
    }
  }
};

contextBridge.exposeInMainWorld('mmc', api);

// Type-Definition für TypeScript im Renderer
declare global {
  interface Window {
    mmc: MMCAPI;
  }
}
