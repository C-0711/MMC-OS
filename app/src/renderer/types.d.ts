/**
 * types.d.ts — Globale Type-Definitionen für Renderer-Prozess
 *
 * Alles liegt im `declare global`-Block: die Datei ist durch `export {}` ein
 * Modul, ohne den Block wären die Interfaces nur modul-lokal sichtbar.
 */

declare global {
  // Fundstelle: dokument (Rechteck) ODER anruf (Zeitmarke im Transkript).
  // Fehlendes `art` = dokument — bestehende Atoms bleiben gültig.
  interface Fundstelle {
    art?: 'dokument' | 'anruf';
    doc: string;
    seite?: number;
    bbox?: [number, number, number, number];
    wav?: string;
    minute?: string; // "04:12"
    dauer?: string;
  }

  // Atom-Definition
  interface Atom {
    id: string;
    feld: string;
    wert: string;
    fundstelle: Fundstelle;
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

  // Anruf-Transkript (kanal: "anruf")
  interface TranskriptZeile {
    zeit: string; // "04:12"
    sprecher: string;
    text: string;
  }

  interface Transkript {
    art: 'anruf';
    titel?: string;
    wav: string;
    dauer?: string;
    zeilen: TranskriptZeile[];
  }

  interface MMCOCR_API {
    health(): Promise<boolean>;
    deuteBeleg(datei: { name: string; bytes: ArrayBuffer; mime?: string }): Promise<OcrErgebnis>;
    deutungAusOcr(ocr: OcrErgebnis, docName: string): Promise<DeutungErgebnis>;
    deutungAusTranskript(transkript: Transkript, docName: string): Promise<DeutungErgebnis>;
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

  // Datentypen für die Datenkanäle (Etappe A, spiegeln preload.ts)
  interface FallUebersicht {
    fallId: string;
    dinge: Array<{ titel: string; frage: string; quelle: string; proposalId: string | null }>;
    protokoll: ErzaehlSatz[];
    beteiligte: string[];
  }

  interface AnrufInfo {
    id: string;
    fallId: string;
    doc: string;
    partner: string;
    dauer: string;
    zeilen: Array<{ zeit: string; sprecher: string; text: string }>;
    minuten: string[];
  }

  interface ThemaInfo {
    name: string;
    anzahl: number;
    fallId: string;
  }

  interface StapelEintrag {
    fallId: string;
    satz: string;
    commitZeile: string;
  }

  interface ThemaVorschlag {
    fallIdVorschlag: string;
    titel: string;
    quelle: string;
    proposalId: string;
  }

  interface SuchErgebnis {
    frage: string;
    antwort: string;
    treffer: Array<{ fall: string; doc: string; seite: number; text: string; feld: string; wert: string }>;
    ehrlich: boolean;
  }

  interface IngestStatus {
    phase: string;
    fertig: number;
    total: number;
    atome: number;
  }

  type IngestEvent =
    | { typ: 'dokument_fertig'; name: string; lane: string; ms: number; atome: number; fundstellen: number }
    | { typ: 'bericht_aktualisiert'; zusammenfassung: string; namenAusDokumenten: string[] }
    | { typ: 'fragen_bereit'; fragen: Array<{ text: string; atomRef: string }> }
    | { typ: 'done'; totalMs: number; textSeiten: number; ocrSeiten: number }
    | { typ: 'scan_bericht'; quellen: Array<{ name: string; dateien: number; bytes: number; aeltestes: string | null; geschuetzt: number; gelesen: boolean }> };

  interface MMCDatenAPI {
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

  interface MMCUpdateAPI {
    ja(): Promise<{ ok: boolean }>;
  }

  interface MMCAPI {
    vault: MMCVaultAPI;
    ocr: MMCOCR_API;
    llm: MMCLLM_API;
    gitchain: MMCGitchainAPI;
    daten: MMCDatenAPI;
    update: MMCUpdateAPI;
  }

  interface Window {
    mmc: MMCAPI;
  }
}

export {};
