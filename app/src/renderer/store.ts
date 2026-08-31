/**
 * store.ts — LiveStore: eine Quelle, alle Screens (Etappe B / T6).
 *
 * Der Store sammelt Vault, Anrufe, Themen, Ingest und baut daraus den
 * AppCtx für Router & Siegel-Menü. Screens lesen NUR über ctx.daten —
 * nie selbst fetchen (Vertrag INTERFACE.md).
 *
 * Ehrlichkeit (Negativ-Katalog): fehlende Daten = leere Listen, nie
 * erfundene. Leer-Zustände rendert der Screen, nicht der Store.
 */

import type { AppCtx } from './router.js';

// Datentypen (spiegeln preload.ts — der Renderer importiert es nicht direkt,
// weil preload nur im Main-Kontext läuft; die Formen sind identisch.)
export interface FallInfoLight {
  id: string;
  offeneVorschlaege: number;
}

export interface FallUebersicht {
  fallId: string;
  dinge: Array<{ titel: string; frage: string; quelle: string; proposalId: string | null }>;
  protokoll: Array<{ satz: string; commitZeile: string; sha: string }>;
  beteiligte: string[];
}

export interface AnrufInfo {
  id: string; fallId: string; doc: string;
  partner: string; dauer: string;
  zeilen: Array<{ zeit: string; sprecher: string; text: string }>;
  minuten: string[];
}

export interface IngestZustand {
  phase: string;
  fertig: number;
  total: number;
  atome: number;
  zusammenfassung: string;
  namen: string[];
  fragen: Array<{ text: string; atomRef: string }>;
}

export class LiveStore {
  faelle: FallInfoLight[] = [];
  uebersichten = new Map<string, FallUebersicht>();
  anrufe = new Map<string, AnrufInfo[]>();
  alleAnrufe: AnrufInfo[] = [];
  themen: Array<{ name: string; anzahl: number; fallId: string }> = [];
  kontakte: Array<{ slug: string; name: string; aktivitaet: number; letzterEintragIso: string | null }> = [];
  stapel: Array<{ fallId: string; satz: string; commitZeile: string }> = [];
  neuesThema: Array<{ fallIdVorschlag: string; titel: string; quelle: string; proposalId: string }> = [];
  ingest: IngestZustand = {
    phase: 'idle', fertig: 0, total: 0, atome: 0,
    zusammenfassung: '', namen: [], fragen: [],
  };
  letzterSuchtreffer: {
    frage: string; antwort: string; ehrlich: boolean;
    treffer: Array<{ fall: string; doc: string; seite: number; text: string }>;
  } | null = null;

  private ingestAbbestellen: (() => void) | null = null;

  /** Start: initial laden + Ingest-Events abonnieren. */
  async init(): Promise<void> {
    await this.refresh();
    if (this.ingestAbbestellen) this.ingestAbbestellen();
    this.ingestAbbestellen = window.mmc.daten.onIngestEvent((ev) => this.verarbeiteIngestEvent(ev));
    // Ingest-Stand nachfragen (falls ein Lauf vom letzten Mal lebt)
    const s = await window.mmc.daten.ingestStatus().catch(() => null);
    if (s && s.phase !== 'idle') {
      this.ingest.phase = s.phase;
      this.ingest.fertig = s.fertig;
      this.ingest.total = s.total;
      this.ingest.atome = s.atome;
    }
  }

  stopp(): void {
    this.ingestAbbestellen?.();
    this.ingestAbbestellen = null;
  }

  /** Nach jeder Aktion (Signatur, Aufnehmen, Merge): alles Neu lesen. */
  async refresh(fallId?: string): Promise<void> {
    try {
      this.faelle = (await window.mmc.vault.listFaelle()).map(f => ({
        id: f.id, offeneVorschlaege: f.offeneVorschlaege,
      }));
    } catch { this.faelle = []; }

    // Übersichten für die Fälle vorwarmen (OsFall/Heute zeigen sofort Daten)
    const ziel = fallId ?? this.faelle[0]?.id;
    if (ziel && !this.uebersichten.has(ziel)) {
      try {
        this.uebersichten.set(ziel, await window.mmc.daten.getFallUebersicht(ziel));
      } catch { /* still — Screen zeigt Leer-Zustand */ }
    }

    // Anrufe je Fall — für den Anrufe-Bereich über ALLE Fälle
    for (const f of this.faelle) {
      if (!this.anrufe.has(f.id)) {
        this.anrufe.set(f.id, await window.mmc.daten.listAnrufe(f.id).catch(() => []));
      }
    }
    // Aggregate über alle Fälle für den Anrufe-Screen (ohne ausgewählten Fall)
    this.alleAnrufe = [...this.anrufe.values()].flat().sort((a, b) => b.id.localeCompare(a.id));

    this.themen = await window.mmc.daten.themenAlle().catch(() => []);
    this.kontakte = await window.mmc.kontakte.list().catch(() => []);
    this.stapel = await window.mmc.daten.stapel().catch(() => []);
    this.neuesThema = await window.mmc.daten.neuesThema().catch(() => []);
  }

  private verarbeiteIngestEvent(ev: { typ: string } & Record<string, unknown>): void {
    const i = this.ingest;
    switch (ev.typ) {
      case 'bericht_aktualisiert':
        i.zusammenfassung = String(ev.zusammenfassung ?? '');
        i.namen = (ev.namenAusDokumenten as string[]) ?? [];
        i.atome = 0; // genaue Zahl kommt über status; Zusammenfassung reicht dem Screen
        break;
      case 'fragen_bereit':
        i.fragen = (ev.fragen as Array<{ text: string; atomRef: string }>) ?? [];
        break;
      case 'done':
        i.phase = 'fertig';
        break;
      case 'scan_bericht':
        i.phase = 'scan';
        break;
      default:
        break;
    }
  }

  /** Baut den AppCtx — Router & Siegel-Menü lesen NUR hieraus. */
  ctx(fallId?: string): AppCtx {
    const fall = fallId ?? this.faelle[0]?.id;
    const offen = this.faelle.reduce((s, f) => s + (f.offeneVorschlaege ?? 0), 0);
    return {
      faelle: this.faelle.map(f => ({ id: f.id, name: f.id })),
      kartenOffen: offen,
      fallId: fall,
      daten: {
        uebersicht: fall ? this.uebersichten.get(fall) : undefined,
        anrufe: fall ? (this.anrufe.get(fall) ?? []) : this.alleAnrufe,
        anrufeAlle: this.alleAnrufe,
        kontakte: this.kontakte,
        themen: this.themen,
        stapel: this.stapel,
        neuesThema: this.neuesThema,
        ingest: this.ingest,
        suche: this.letzterSuchtreffer,
        // Für Screens mit Fall-Wechsel: Übersicht nachladen, wenn fehlt
        ladeUebersicht: async (fid: string) => {
          if (!this.uebersichten.has(fid)) {
            try {
              this.uebersichten.set(fid, await window.mmc.daten.getFallUebersicht(fid));
            } catch { /* still */ }
          }
          return this.uebersichten.get(fid);
        },
      },
    };
  }
}
