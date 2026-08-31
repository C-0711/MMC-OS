/**
 * anruf-live.ts — Anruf-Live: Klon zu Klon, kein Anbieter dazwischen (Etappe D, T15).
 *
 * Der Weg (Canvas-Gesetz „Klon zu Klon"):
 *   Signaling: gitchain-Registry (OCP) — Angebot/Antwort/Kandidaten laufen
 *   als Container-Einträge über die eigene Registry, NIEMALS über einen
 *   Drittanbieter. Kein TURN konfigurierbar (STUN: публичliche Google-Server
 *   wären Drittanbieter — wir lassen STUN leer: im LAN klappt host-Kandidat,
 *   sonst scheitert der Anruf ehrlich).
 *   Medien: WebRTC DataChannel im Renderer (Audio folgt in T16-Verkabelung).
 *
 * v0.1-Scope (ehrlich):
 *   - DataChannel-Chat als Anruf-Rückgrat (Nachricht = Commit, Zitat = Referenz)
 *   - Signaling-Poll gegen die Registry (alle 2 s — kein WebSocket im Backend-Vertrag)
 *   - Offer/Answer/Candidates als JSON-Einträge mit Präfix mmc-signal/
 *
 * Was NICHT behauptet wird: Audio/Video läuft — der DataChannel beweist den
 * Klon-zu-Klon-Pfad; STT/Audio dockt in T16 an.
 */

import * as gitchain from './gitchain';
import { log } from './log';

// ============================================================================
// Signaling-Einträge (Registry als Ankerpunkt)
// ============================================================================

export interface SignalNachricht {
  von: string;            // Absender-Klon-ID (Fall-Baum-Besitzer)
  an: string;             // Empfänger-Klon-ID
  art: 'angebot' | 'antwort' | 'kandidat' | 'auflegen';
  daten: unknown;         // SDP / Kandidat / {}
  zeit: string;
}

/** Signal-Nachricht als Container-Eintrag-Signal pushen (Registry-Push). */
export async function signalSenden(nachricht: SignalNachricht): Promise<void> {
  // Die Registry akzeptiert Container-Push (pushFall) — Signal-Einträge
  // nutzen den selben git-Transport mit eigenem Signal-Fall-Namen.
  const signalFall = `mmc-signal-${nachricht.an}`;
  try {
    await gitchain.pushSignal(signalFall, JSON.stringify(nachricht));
  } catch (e) {
    log('warn', `Signal-Versand an ${nachricht.an} fehlgeschlagen: ${String(e)}`);
    throw e;
  }
}

/** Neue Signale für mich abholen (Poll, 2 s im Renderer getaktet). */
export async function signalEmpfangen(meineId: string, seitIso: string | null): Promise<SignalNachricht[]> {
  const signalFall = `mmc-signal-${meineId}`;
  try {
    const roh = await gitchain.pullSignal(signalFall, seitIso);
    return roh
      .map(zeile => { try { return JSON.parse(zeile) as SignalNachricht; } catch { return null; } })
      .filter((s): s is SignalNachricht =>
        !!s && typeof s.von === 'string' && typeof s.art === 'string');
  } catch (e) {
    log('warn', `Signal-Empfang fehlgeschlagen: ${String(e)}`);
    return [];
  }
}
