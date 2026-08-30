/**
 * types.d.ts — Globale Type-Definitionen für Renderer-Prozess
 */

// Atom-Definition
interface Atom {
  id: string;
  feld: string;
  wert: string;
  fundstelle: {
    doc: string;
    seite: number;
    bbox: [number, number, number, number];
  };
  conf: number;
}

// Vorschlag-Definition
interface Vorschlag {
  id: string;
  kartentext: {
    titel: string;
    frage: string;
  };
  atoms: Atom[];
  branch: string;
}

// Fall-Info
interface FallInfo {
  id: string;
  pfad: string;
  offeneVorschlaege: number;
  letzterCommitIso: string;
}

// Erzähl-Satz
interface ErzaehlSatz {
  satz: string;
  commitZeile: string;
  sha: string;
  datumIso: string;
}

// OCR-Typen
interface OcrLine {
  bbox: [number, number, number, number];
  text: string;
  conf: number;
}

interface OcrPage {
  index: number;
  width: number;
  height: number;
  lines: OcrLine[];
}

interface OcrErgebnis {
  name: string;
  pagesTotal: number;
  totalMs: number;
  pages: OcrPage[];
}

// Deutungs-Ergebnis (Heuristik im Main-Prozess, deutung.ts)
interface DeutungErgebnis {
  atoms: Atom[];
  kartentext: {
    titel: string;
    frage: string;
  };
  zweifel: boolean;
}

// Zitat-Kontext
interface ZitatKontext {
  fall: string;
  doc: string;
  seite: number;
  text: string;
}

// window.mmc API-Definitionen
interface MMCVaultAPI {
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

interface MMCOCR_API {
  health(): Promise<boolean>;
  deuteBeleg(datei: { name: string; bytes: ArrayBuffer; mime?: string }): Promise<OcrErgebnis>;
  deutungAusOcr(ocr: OcrErgebnis, docName: string): Promise<DeutungErgebnis>;
}

interface MMCLLM_API {
  fragMich(frage: string, kontext: ZitatKontext[]): Promise<{ antwort: string }>;
}

// gitchain-Anbindung (0711-Backend)
interface GitchainStatus {
  apiUrl: string;
  angemeldet: boolean;
  user: string | null;
}

interface GitchainDeviceStart {
  userCode: string;
  deviceCode: string;
  verifyUrl: string;
  intervalSek: number;
  expiresInSek: number;
}

type GitchainPollErgebnis =
  | { status: 'ok'; user: string | null }
  | { status: 'wartet' }
  | { status: 'fehler'; meldung: string };

type GitchainWhoami =
  | { ok: true; user: string; raw: Record<string, unknown> }
  | { ok: false; meldung: string };

interface GitchainPushErgebnis {
  ok: boolean;
  remoteUrl: string;
  meldung: string;
  remoteRefs: string[];
}

interface MMCGitchainAPI {
  status(): Promise<GitchainStatus>;
  loginStart(): Promise<GitchainDeviceStart>;
  loginPoll(deviceCode: string): Promise<GitchainPollErgebnis>;
  whoami(): Promise<GitchainWhoami>;
  logout(): Promise<void>;
  pushFall(fallId: string): Promise<GitchainPushErgebnis>;
  registry(): Promise<{ version: string; count: number; ids: string[] }>;
}

interface MMCAPI {
  vault: MMCVaultAPI;
  ocr: MMCOCR_API;
  llm: MMCLLM_API;
  gitchain: MMCGitchainAPI;
}

declare global {
  interface Window {
    mmc: MMCAPI;
  }
}

export {};
