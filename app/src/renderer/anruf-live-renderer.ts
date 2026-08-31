/**
 * anruf-live-renderer.ts — Klon-zu-Klon im Renderer (Etappe D, T15/T16).
 *
 * WebRTC ohne Drittanbieter: keine öffentlichen STUN-Server (das wären
 * Anbieter); host-Kandidaten reichen im LAN/VPN — sonst scheitert der
 * Anruf ehrlich mit einem Satz, nie still.
 *
 * Ablauf (Anrufer-Seite):
 *   1. RTCPeerConnection + DataChannel 'mmc' öffnen
 *   2. Angebot (SDP) → Main → Registry (pushSignal)
 *   3. Poll auf eigene Signale → Antwort/Kandidaten → Verbindung
 *   4. Jede DataChannel-Nachricht = eine Mitschrift-Zeile (→ Commit via vault)
 *
 * Angerufenen-Seite: Poll auf eigene Signale → Angebot → Antwort → Kandidaten.
 *
 * Ehrlichkeit: Fehlerzustände (kein Peer, Timeout 30 s, kein PAT) werden
 * als Satz gemeldet — der Anruf-Haupt-Screen zeigt ihn still.
 */

export type AnrufPhase = 'idle' | 'rufend' | 'klingelt' | 'laeuft' | 'beendet' | 'gescheitert';

export interface AnrufLiveZeile {
  zeit: string;       // MM:SS ab Verbindungsstart
  sprecher: string;
  text: string;
}

interface SignalPayload {
  art: 'antwort' | 'kandidat';
  sdp?: string;
  kandidat?: RTCIceCandidateInit;
}

export class AnrufLive {
  phase: AnrufPhase = 'idle';
  zeilen: AnrufLiveZeile[] = [];
  private pc: RTCPeerConnection | null = null;
  private kanal: RTCDataChannel | null = null;
  private startZeit = 0;
  private meinName = 'Du';
  private partner = '';
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private letzteSignalZeit: string | null = null;

  private onAenderung: (() => void) | null = null;

  /** UI-Callback: bei jeder Phasen-/Zeilen-Änderung. */
  beimAendern(cb: () => void): void {
    this.onAenderung = cb;
  }

  private meldung(phase: AnrufPhase, zeile?: AnrufLiveZeile): void {
    this.phase = phase;
    if (zeile) this.zeilen.push(zeile);
    this.onAenderung?.();
  }

  private minute(): string {
    const s = Math.floor((Date.now() - this.startZeit) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // -------------------------------------------------------------------------
  // Anrufen
  // -------------------------------------------------------------------------

  async anrufen(partner: string): Promise<void> {
    this.partner = partner;
    this.zeilen = [];
    this.startZeit = Date.now();
    this.meldung('rufend');

    const pc = new RTCPeerConnection({ iceServers: [] }); // kein Drittanbieter
    this.pc = pc;
    const kanal = pc.createDataChannel('mmc');
    this.kanal = kanal;
    this.verdrahteKanal(kanal);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void window.mmc.anrufLive.signalSenden({
          von: this.meinName, an: partner,
          art: 'kandidat', daten: { kandidat: e.candidate.toJSON() },
          zeit: new Date().toISOString(),
        });
      }
    };

    // 30 s ohne Verbindung: ehrlich scheitern (unref — hält den Prozess nicht)
    const wachmann = setTimeout(() => {
      if (this.phase === 'rufend') this.meldung('gescheitert', {
        zeit: this.minute(), sprecher: 'System',
        text: 'Niemand hat abgenommen — der Anruf endet, nichts geht verloren.',
      });
    }, 30_000);
    (wachmann as unknown as { unref(): void }).unref?.();

    kanal.onopen = () => {
      clearTimeout(wachmann);
      this.startZeit = Date.now();
      this.meldung('laeuft');
      this.startePoll(partner); // Antworten/Kandidaten further
    };

    const angebot = await pc.createOffer();
    await pc.setLocalDescription(angebot);
    await window.mmc.anrufLive.signalSenden({
      von: this.meinName, an: partner,
      art: 'angebot', daten: { sdp: pc.localDescription?.sdp },
      zeit: new Date().toISOString(),
    });

    this.startePoll(partner);
  }

  // -------------------------------------------------------------------------
  // Angerufenen-Seite (Poll liefert ein Angebot)
  // -------------------------------------------------------------------------

  async annehmen(angebotSdp: string, von: string): Promise<void> {
    this.partner = von;
    this.zeilen = [];
    this.startZeit = Date.now();
    this.meldung('laeuft');

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    pc.ondatachannel = (e) => {
      this.kanal = e.channel;
      this.verdrahteKanal(e.channel);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void window.mmc.anrufLive.signalSenden({
          von: this.meinName, an: von,
          art: 'kandidat', daten: { kandidat: e.candidate.toJSON() },
          zeit: new Date().toISOString(),
        });
      }
    };

    await pc.setRemoteDescription({ type: 'offer', sdp: angebotSdp });
    const antwort = await pc.createAnswer();
    await pc.setLocalDescription(antwort);
    await window.mmc.anrufLive.signalSenden({
      von: this.meinName, an: von,
      art: 'antwort', daten: { sdp: antwort.sdp },
      zeit: new Date().toISOString(),
    });
  }

  // -------------------------------------------------------------------------
  // DataChannel: Nachricht = Mitschrift-Zeile
  // -------------------------------------------------------------------------

  private verdrahteKanal(kanal: RTCDataChannel): void {
    kanal.onmessage = (e) => {
      try {
        const n = JSON.parse(String(e.data)) as { text: string; sprecher?: string };
        this.zeilen.push({
          zeit: this.minute(),
          sprecher: n.sprecher ?? this.partner,
          text: n.text,
        });
        this.onAenderung?.();
      } catch { /* kein JSON — still */ }
    };
    kanal.onclose = () => {
      this.meldung('beendet');
    };
  }

  /** Sende eine Zeile (Vermutung/Text) — landet bei beiden als Mitschrift. */
  sage(text: string, sprecher = this.meinName): void {
    if (this.kanal?.readyState !== 'open') return;
    this.kanal.send(JSON.stringify({ text, sprecher }));
    this.zeilen.push({ zeit: this.minute(), sprecher, text });
    this.onAenderung?.();
  }

  auflegen(): void {
    this.kanal?.close();
    this.pc?.close();
    this.stoppePoll();
    this.meldung('beendet');
  }

  // -------------------------------------------------------------------------
  // Signaling-Poll (Main liefert Signale aus der Registry)
  // -------------------------------------------------------------------------

  private startePoll(meineId: string): void {
    this.stoppePoll();
    const timer = setInterval(async () => {
      try {
        const signale = await window.mmc.anrufLive.signalEmpfangen(meineId, this.letzteSignalZeit);
        for (const s of signale) {
          this.letzteSignalZeit = s.zeit;
          const d = s.daten as SignalPayload;
          if (s.art === 'antwort' && d.sdp) {
            await this.pc?.setRemoteDescription({ type: 'answer', sdp: d.sdp });
          } else if (s.art === 'kandidat' && d.kandidat) {
            await this.pc?.addIceCandidate(d.kandidat);
          }
        }
      } catch { /* Poll-Fehler still — nächster Takt kommt */ }
    }, 2000);
    (timer as unknown as { unref(): void }).unref?.();
    this.pollTimer = timer;
  }

  private stoppePoll(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
