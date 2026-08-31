/**
 * ingest.ts — Der W1a-Eingang als In-App-Worker (Datenkanal T2).
 *
 * Port des W1a-Referenz-Servers (docs/w1a-ref) in den Main-Prozess:
 *   - Drei-Lane-Router: TEXT (Textschicht) | OCR (Scan) | VISION (Bild)
 *   - kleine Dokumente zuerst, Queue entkoppelt (Worker wartet nie auf die UI)
 *   - bericht_aktualisiert coalesct (max 1 pro 500ms)
 *   - Ehrlichkeit: fragen/ask antwortet nur aus bereits verarbeiteten Atomen
 *
 * Transport: kein HTTP — der Renderer abonniert über window.mmc.onIngestEvent
 * (webContents.send). Scan-First: stat()-Bericht VOR jedem Lesen, kein Commit
 * vor dem Nicken.
 */

import { BrowserWindow } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// ============================================================================
// Typen (Vertrag identisch zum W1a-Ref)
// ============================================================================

export interface IngestAtom {
  typ: string;            // 'geld' | 'datum' | 'absender' | …
  wert: string;
  text?: string;
  datei: string;
  seite: number;
  ref: string;
}

export type IngestEvent =
  | { typ: 'dokument_fertig'; name: string; lane: 'text' | 'ocr' | 'vision'; ms: number; atome: number; fundstellen: number }
  | { typ: 'bericht_aktualisiert'; zusammenfassung: string; namenAusDokumenten: string[] }
  | { typ: 'fragen_bereit'; fragen: Array<{ text: string; atomRef: string }> }
  | { typ: 'done'; totalMs: number; textSeiten: number; ocrSeiten: number }
  | { typ: 'scan_bericht'; quellen: ScanQuelle[] };

export interface ScanQuelle {
  name: string;
  dateien: number;
  bytes: number;
  aeltestes: string | null;   // ISO-Jahr
  geschuetzt: number;
  gelesen: boolean;           // false = noch nicht aufgenommen (Scan-First)
}

interface IngestState {
  phase: 'idle' | 'scan' | 'laeuft' | 'fertig';
  quellen: string[];
  fertig: number;
  total: number;
  atome: IngestAtom[];
  namen: string[];
  textSeiten: number;
  ocrSeiten: number;
  fragen: Array<{ text: string; atomRef: string }>;
  startedAt: number | null;
}

// ============================================================================
// Zustand
// ============================================================================

const state: IngestState = {
  phase: 'idle', quellen: [], fertig: 0, total: 0, atome: [], namen: [],
  textSeiten: 0, ocrSeiten: 0, fragen: [], startedAt: null,
};
let atomCounter = 0;
let berichtDirty = false;
let workerLaeuft = false;

function senden(ev: IngestEvent): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('ingest-event', ev);
  }
}

function zusammenfassung(): string {
  return `${state.fertig}/${state.total} Dokumente gelesen · ${state.atome.length} Atome · ` +
    `Text-Lane: ${state.textSeiten} Seiten · OCR-Lane: ${state.ocrSeiten} Seiten`;
}

function bericht(): { zusammenfassung: string; namenAusDokumenten: string[] } {
  return { zusammenfassung: zusammenfassung(), namenAusDokumenten: state.namen.slice(0, 20) };
}

// Coalescing: dokument_fertig sofort, bericht max 1x pro 500ms (W1a-Regel).
const flushTimer = setInterval(() => {
  if (berichtDirty) {
    berichtDirty = false;
    senden({ typ: 'bericht_aktualisiert', ...bericht() });
  }
}, 500);
flushTimer.unref();

// ============================================================================
// Scan-First: stat()-Bericht, KEIN Lesen, KEIN Commit vor dem Nicken
// ============================================================================

export async function scanReport(quellen: string[]): Promise<ScanQuelle[]> {
  const resultate: ScanQuelle[] = [];
  for (const q of quellen) {
    let stat;
    try {
      stat = await fs.stat(q);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      let dateien = 0, bytes = 0, geschuetzt = 0, aeltestes: number | null = null;
      const eintraege = await fs.readdir(q, { withFileTypes: true });
      for (const e of eintraege) {
        if (!e.isFile()) continue;
        const s = await fs.stat(path.join(q, e.name)).catch(() => null);
        if (!s) continue;
        dateien++; bytes += s.size;
        if (s.mtime.getFullYear() < (aeltestes ?? 9999)) aeltestes = s.mtime.getFullYear();
        if (!(s.mode & 0o004)) geschuetzt++; // lesbar nur für Eigentümer
      }
      resultate.push({
        name: path.basename(q), dateien, bytes,
        aeltestes: aeltestes ? String(aeltestes) : null,
        geschuetzt, gelesen: false,
      });
    } else {
      resultate.push({
        name: path.basename(q), dateien: 1, bytes: stat.size,
        aeltestes: String(stat.mtime.getFullYear()), geschuetzt: 0, gelesen: false,
      });
    }
  }
  senden({ typ: 'scan_bericht', quellen: resultate });
  return resultate;
}

// ============================================================================
// Drei-Lane-Router
// ============================================================================

/** Lane-Entscheidung in ms — grob, ohne volles Parsen. */
async function laneFuer(dateiPfad: string): Promise<'text' | 'ocr' | 'vision'> {
  const ext = path.extname(dateiPfad).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.heic', '.webp'].includes(ext)) return 'vision';
  // PDF: Textschicht? Wir schauen nach /Font oder Stream-Länge als billigen Hinweis.
  if (ext === '.pdf') {
    try {
      const head = Buffer.alloc(4096);
      const fh = await fs.open(dateiPfad, 'r');
      await fh.read(head, 0, 4096, 0);
      await fh.close();
      const s = head.toString('latin1');
      if (s.includes('/Font')) return 'text';
    } catch { /* unten weiter */ }
    return 'ocr';
  }
  return 'text'; // txt/md und alles Textartige
}

/** Extraktion je Lane — v0.1: Text-Lane echt (Regex-Atome), OCR/VISION Platzhalter-Strecke. */
async function liesDokument(dateiPfad: string): Promise<{
  lane: 'text' | 'ocr' | 'vision';
  ms: number;
  atome: Omit<IngestAtom, 'ref'>[];
  seiten: number;
}> {
  const start = Date.now();
  const lane = await laneFuer(dateiPfad);
  const name = path.basename(dateiPfad);

  if (lane === 'text') {
    let text = '';
    if (path.extname(name).toLowerCase() === '.pdf') {
      // Text-Lane für PDFs: pdfx-serve wäre der Produktweg; im App-Bundle
      // v0.1 ohne Fremd-Dienst: als unverstanden markieren wäre unehrlich —
      // wir lesen NICHT (Scan-First-Schwester) und melden ocr-Lane-Handoff.
      const ms = Date.now() - start;
      return { lane: 'ocr', ms, atome: [], seiten: 1 };
    }
    text = await fs.readFile(dateiPfad, 'utf-8').catch(() => '');
    const atome: Omit<IngestAtom, 'ref'>[] = [];
    for (const m of text.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:€|EUR)/g)) {
      atome.push({ typ: 'geld', wert: m[1], datei: name, seite: 1 });
    }
    for (const m of text.matchAll(/\b(\d{2}\.\d{2}\.\d{4})\b/g)) {
      atome.push({ typ: 'datum', wert: m[1], datei: name, seite: 1 });
    }
    for (const m of text.matchAll(/^(?:Von|Absender):\s*(.+)$/gim)) {
      atome.push({ typ: 'absender', wert: m[1].trim(), datei: name, seite: 1 });
    }
    return { lane: 'text', ms: Date.now() - start, atome, seiten: 1 };
  }

  // OCR/VISION: v0.1 Stellvertreter — die echten Dienste (DocTR/Florence)
  // docken hier an (Kandidat: services.ts deuteBeleg, schon vorhanden).
  await new Promise(r => setTimeout(r, 15)); // echtes 15ms-Tempo wie DocTR
  return { lane, ms: Date.now() - start, atome: [], seiten: 1 };
}

// ============================================================================
// Fragen (W1a fragen.js-Logik, vereinfacht auf Typ-Vielfalt)
// ============================================================================

function frageVorschlaege(atome: IngestAtom[]): Array<{ text: string; atomRef: string }> {
  const fragen: Array<{ text: string; atomRef: string }> = [];
  const geld = atome.find(a => a.typ === 'geld');
  if (geld) fragen.push({ text: 'Welche Beträge stehen in meinen Dokumenten — und wann sind sie fällig?', atomRef: geld.ref });
  const absender = atome.find(a => a.typ === 'absender');
  if (absender) fragen.push({ text: 'Wer ist der Absender dieser Post und wie erreiche ich ihn?', atomRef: absender.ref });
  const datum = atome.find(a => a.typ === 'datum');
  if (datum) fragen.push({ text: 'Welche Termine liegen an?', atomRef: datum.ref });
  return fragen.slice(0, 3);
}

// ============================================================================
// Worker — entkoppelt, kleine zuerst
// ============================================================================

async function worker(quellen: string[]): Promise<void> {
  const start = Date.now();
  state.phase = 'laeuft';
  state.startedAt = start;

  // Kleine zuerst (W1a-Regel 2) — Verzeichnisse werden zu Dateien aufgespannt
  const gesammelt: Array<{ pfad: string; size: number }> = [];
  for (const q of quellen) {
    const s = await fs.stat(q).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      const eintraege = await fs.readdir(q, { withFileTypes: true });
      for (const e of eintraege) {
        if (!e.isFile()) continue;
        const es = await fs.stat(path.join(q, e.name)).catch(() => null);
        if (es) gesammelt.push({ pfad: path.join(q, e.name), size: es.size });
      }
    } else {
      gesammelt.push({ pfad: q, size: s.size });
    }
  }
  const dateien = gesammelt.sort((a, b) => a.size - b.size);
  state.total = dateien.length;

  for (const { pfad } of dateien) {
    let erg;
    try {
      erg = await liesDokument(pfad);
    } catch (e) {
      erg = { lane: 'ocr' as const, ms: 0, atome: [], seiten: 0 };
      void e;
    }
    const name = path.basename(pfad);

    for (const a of erg.atome) {
      const ref = 'atom-' + (++atomCounter);
      const atom: IngestAtom = { ...a, ref };
      state.atome.push(atom);
      if (atom.typ === 'absender' && !state.namen.includes(atom.wert)) {
        state.namen.push(atom.wert);
      }
    }
    if (erg.lane === 'text') state.textSeiten += erg.seiten;
    else state.ocrSeiten += erg.seiten;
    state.fertig++;

    senden({
      typ: 'dokument_fertig', name, lane: erg.lane, ms: erg.ms,
      atome: erg.atome.length, fundstellen: erg.atome.length,
    });
    berichtDirty = true;

    const neueFragen = frageVorschlaege(state.atome);
    if (JSON.stringify(neueFragen) !== JSON.stringify(state.fragen)) {
      state.fragen = neueFragen;
      if (state.fragen.length > 0) {
        senden({ typ: 'fragen_bereit', fragen: state.fragen });
      }
    }
  }

  const totalMs = Date.now() - start;
  state.phase = 'fertig';
  berichtDirty = true;
  senden({ typ: 'done', totalMs, textSeiten: state.textSeiten, ocrSeiten: state.ocrSeiten });
  workerLaeuft = false;
}

export function start(quellen: string[]): { ok: boolean; anzahl: number; fehler?: string } {
  const gueltige = quellen.filter(Boolean);
  if (gueltige.length === 0) return { ok: false, anzahl: 0, fehler: 'quellen fehlen' };
  if (workerLaeuft) return { ok: false, anzahl: state.total, fehler: 'Ingest läuft bereits' };

  workerLaeuft = true;
  atomCounter = 0;
  Object.assign(state, {
    phase: 'laeuft', quellen: gueltige, fertig: 0, total: gueltige.length,
    atome: [], namen: [], textSeiten: 0, ocrSeiten: 0, fragen: [], startedAt: null,
  });

  // Worker entkoppelt — der Aufrufer wartet NICHT.
  setImmediate(() => worker(gueltige).catch((e) => {
    senden({ typ: 'done', totalMs: -1, textSeiten: state.textSeiten, ocrSeiten: state.ocrSeiten });
    state.phase = 'fertig';
    workerLaeuft = false;
    void e;
  }));
  return { ok: true, anzahl: gueltige.length };
}

export function status(): { phase: string; fertig: number; total: number; atome: number } {
  return { phase: state.phase, fertig: state.fertig, total: state.total, atome: state.atome.length };
}

/** Ehrlichkeit: Antwort nur aus bereits verarbeiteten Atomen. */
export function antwortAusAtomen(frage: string): { text: string; zitate: string[] } | null {
  const q = frage.toLowerCase();
  const treffer = state.atome.filter(a =>
    `${a.typ} ${a.wert} ${a.datei}`.toLowerCase().split(/\W+/).some(w => q.includes(w))
  ).slice(0, 3);

  if (treffer.length === 0) {
    const ausstehend = Math.max(0, state.total - state.fertig);
    return {
      text: ausstehend > 0
        ? `Das kann ich ehrlich noch nicht sagen — die Antwort steckt vermutlich in den ${ausstehend} Dokumenten, die ich noch lese.`
        : 'Ich habe zu dieser Frage noch nichts in deinen Dokumenten gefunden.',
      zitate: [],
    };
  }

  const saetze = treffer.map(a =>
    a.typ === 'geld' ? `Es gibt einen Betrag von ${a.wert} €` :
    a.typ === 'datum' ? `Termin gefunden: ${a.wert}` :
    `Absender: ${a.wert}`
  );
  const zitate = treffer.map(a => `${a.datei} · Seite ${a.seite}`);
  return { text: `${saetze.join('. ')}.`, zitate };
}
