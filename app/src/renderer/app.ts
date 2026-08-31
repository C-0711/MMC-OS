/**
 * app.ts — UI-Shell mit vollem Lebenszyklus (Etappe 3)
 *
 * Drei Zustände: ruhig | fragend | antwortend
 * Sechs Flächen: Heute, Karte, Beweis, Frag-mich-Dialog, Fall-Ansicht, Seitenbrett
 */

import {
  renderBeweis,
  renderAnrufBeweis,
  type BeweisOptions,
  type TranskriptAnzeigeZeile
} from './beweis.js';
import {
  renderVereinbarung,
  renderTisch,
  renderGruppe,
  renderEinladen,
  renderRueckruf,
  renderObSiegel,
  renderObRettung,
  renderObErfolg,
  type VereinbarungPosition
} from './screens.js';
import { navigate, type AppCtx } from './router.js';
import { SiegelMenue, siegelmenueCss } from './siegelmenue.js';
import { onboardingCss, sanduhrStarten } from './screens-onboarding.js';
import { osCss } from './screens-os.js';

type AppZustand = 'ruhig' | 'fragend' | 'antwortend' | 'fall-ansicht';

interface Karte {
  fallId: string;
  vorschlagId: string;
  titel: string;
  frage: string;
  beweisDoc?: string;
  beweisSeite?: number;
  fussnote: string;
  zweifel: boolean;
}

class App {
  private zustand: AppZustand = 'ruhig';
  private karten: Karte[] = [];
  private aktuellerFall: string | null = null;
  private dropZoneActive = false;
  private siegelMenue: SiegelMenue | null = null;
  private faelleCache: FallInfo[] = [];

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.renderBegruessung();

    // Siegel-Menü (der fehlende Menübereich): Siegel oben rechts wird
    // zum Eingang für alle Bereiche — Anrufe, Themen, Fälle, Suche …
    const style = document.createElement('style');
    style.textContent = siegelmenueCss() + onboardingCss() + osCss();
    document.head.appendChild(style);
    this.siegelMenue = new SiegelMenue(() => this.appCtx());
    this.siegelMenue.oeffnen(document.querySelector('.siegel'));

    await this.ladeVorschlaege();
    this.renderZustand();
    this.setupFragMich();
    this.setupDropZone();
    this.setupSeitenbrett();

    // Null-Fragen-Onboarding (Etappe 4 C): nur beim ersten Start.
    if (localStorage.getItem('mmc-onboarding') !== 'done') {
      this.zeigeOnboarding(1);
    }
  }

  /** Kontext für Router & Siegel-Menü — echte Daten, wo vorhanden. */
  private appCtx(): AppCtx {
    return {
      faelle: this.faelleCache?.map(f => ({ id: f.id, name: f.id })),
      kartenOffen: this.karten.length,
      fallId: this.aktuellerFall ?? undefined,
    };
  }

  // ============================================================================
  // Begrüßung
  // ============================================================================

  private renderBegruessung(): void {
    const stunde = new Date().getHours();
    let gruss = 'Guten Morgen';
    if (stunde >= 12 && stunde < 18) gruss = 'Guten Tag';
    if (stunde >= 18) gruss = 'Guten Abend';

    const grussEl = document.getElementById('gruss');
    if (grussEl) {
      grussEl.textContent = `${gruss}.`;
    }
  }

  // ============================================================================
  // Vorschläge laden
  // ============================================================================

  private async ladeVorschlaege(): Promise<void> {
    try {
      const faelle = await window.mmc.vault.listFaelle();
      this.faelleCache = faelle;
      this.renderFussleiste(faelle);

      this.karten = [];
      let maxKarten = 3;

      for (const fall of faelle) {
        if (this.karten.length >= maxKarten) break;

        const vorschlaege = await window.mmc.vault.listVorschlaege(fall.id);

        for (const v of vorschlaege) {
          if (this.karten.length >= maxKarten) break;

          // Erstes Atom mit Fundstelle für Beweis-Link
          const erstesAtom = v.atoms[0];
          const beweisDoc = erstesAtom?.fundstelle.doc;
          const beweisSeite = erstesAtom?.fundstelle.seite;

          // Fussnote: dokument → Seite, anruf → wav + Minute
          const commitKurz = v.branch.substring(0, 8);
          const fussnote = erstesAtom?.fundstelle.art === 'anruf'
            ? `fall: ${fall.id} · ${erstesAtom.fundstelle.wav ?? beweisDoc} · Minute ${erstesAtom.fundstelle.minute ?? '?'} · ${commitKurz} · sig ✓`
            : `fall: ${fall.id} · ${beweisDoc || '?'} · Seite ${beweisSeite || '?'} · ${commitKurz} · sig ✓`;

          // Zweifel: prüfen, ob niedrige Konfidenz
          const minConf = v.atoms.length > 0 ? Math.min(...v.atoms.map(a => a.conf)) : 1.0;
          const zweifel = minConf < 0.7 || v.atoms.length === 0;

          this.karten.push({
            fallId: fall.id,
            vorschlagId: v.id,
            titel: v.kartentext.titel,
            frage: v.kartentext.frage,
            beweisDoc,
            beweisSeite,
            fussnote,
            zweifel
          });
        }
      }

      // Zustand aktualisieren
      if (this.karten.length > 0 && this.zustand === 'ruhig') {
        this.zustand = 'fragend';
      }
    } catch (err) {
      console.error('Fehler beim Laden der Vorschläge:', err);
    }
  }

  // ============================================================================
  // Fußzeile (Etappe 4 D): Schlüssel-Zeile aus echten Fall-Daten
  // ============================================================================

  private renderFussleiste(faelle: FallInfo[]): void {
    const schluesselEl = document.getElementById('fuss-schluessel');
    if (!schluesselEl) return;

    const anzahl = faelle.length;
    let text = `Dein Schlüssel liegt hier · ${anzahl} ${anzahl === 1 ? 'Fall' : 'Fälle'} versiegelt`;

    // Letzter Anker: jüngster Commit über alle Fälle (ISO sortiert lexikographisch korrekt)
    const letzterIso = faelle
      .map(f => f.letzterCommitIso)
      .filter(iso => !!iso)
      .sort()
      .pop();
    if (letzterIso) {
      const d = new Date(letzterIso);
      if (!Number.isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        text += ` · zuletzt geankert ${dd}.${mm}.${d.getFullYear()}`;
      }
    }

    schluesselEl.textContent = text;
  }

  // ============================================================================
  // Zustand rendern
  // ============================================================================

  private renderZustand(): void {
    const zustandEl = document.getElementById('zustand-text');
    const kartenEl = document.getElementById('karten-container');
    const ruhigEl = document.getElementById('alles-ruhig');
    const dialogEl = document.getElementById('dialog-container');
    const fallAnsichtEl = document.getElementById('fall-ansicht-container');

    if (!zustandEl || !kartenEl || !ruhigEl || !dialogEl || !fallAnsichtEl) return;

    // Zustand-Anzeige oben rechts
    if (this.zustand === 'ruhig') {
      zustandEl.textContent = 'heute · alles ruhig';
      ruhigEl.style.display = 'block';
      kartenEl.style.display = 'none';
      dialogEl.style.display = 'none';
      fallAnsichtEl.style.display = 'none';
    } else if (this.zustand === 'fragend') {
      const anzahl = this.karten.length;
      zustandEl.textContent = `heute · ${anzahl} ${anzahl === 1 ? 'offen' : 'offen'}`;
      ruhigEl.style.display = 'none';
      kartenEl.style.display = 'block';
      dialogEl.style.display = 'none';
      fallAnsichtEl.style.display = 'none';
      this.renderKarten();
    } else if (this.zustand === 'antwortend') {
      zustandEl.textContent = 'heute · frag-mich';
      ruhigEl.style.display = 'none';
      kartenEl.style.display = 'none';
      dialogEl.style.display = 'block';
      fallAnsichtEl.style.display = 'none';
    } else if (this.zustand === 'fall-ansicht') {
      zustandEl.textContent = `fall · ${this.aktuellerFall || '?'}`;
      ruhigEl.style.display = 'none';
      kartenEl.style.display = 'none';
      dialogEl.style.display = 'none';
      fallAnsichtEl.style.display = 'block';
    }
  }

  // ============================================================================
  // Karten rendern
  // ============================================================================

  private renderKarten(): void {
    const container = document.getElementById('karten-container');
    if (!container) return;

    container.innerHTML = '';
    this.karten.forEach(karte => {
      container.appendChild(this.renderKarte(karte));
    });
  }

  private renderKarte(karte: Karte): HTMLElement {
    const div = document.createElement('div');
    div.className = 'karte';
    if (karte.zweifel) {
      div.style.borderColor = 'rgba(217,166,160,.4)'; // Rosé-Akzent bei Zweifel
    }

    const titel = document.createElement('div');
    titel.className = 'serif';
    titel.style.fontSize = '22px';
    titel.style.marginBottom = '6px';
    titel.textContent = karte.titel;
    div.appendChild(titel);

    const frage = document.createElement('div');
    frage.className = 't13 sub';
    frage.textContent = karte.frage;
    if (karte.zweifel) {
      frage.textContent += ' (Ich bin unsicher — magst du selbst schauen?)';
      frage.style.color = '#9c6a63'; // Rosé-Ton
    }
    div.appendChild(frage);

    // Beweis-Link
    if (karte.beweisDoc) {
      const beweisLink = document.createElement('div');
      beweisLink.className = 't13';
      beweisLink.style.cssText = `
        margin-top: 10px;
        color: var(--os-olivgold);
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      `;
      beweisLink.textContent = 'Woher weißt du das?';
      beweisLink.onclick = () => this.zeigeBeweis(karte);
      div.appendChild(beweisLink);
    }

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 10px; margin-top: 16px;';

    const btnJa = document.createElement('button');
    btnJa.textContent = 'Ja';
    btnJa.className = 'pill-salbei';
    btnJa.onclick = () => this.handleJa(karte);
    btnRow.appendChild(btnJa);

    const btnSpaeter = document.createElement('button');
    btnSpaeter.textContent = 'Später';
    btnSpaeter.className = 'pill-still';
    btnSpaeter.onclick = () => this.handleSpaeter(karte);
    btnRow.appendChild(btnSpaeter);

    const btnNein = document.createElement('button');
    btnNein.textContent = 'Nein';
    btnNein.className = 'pill-still';
    btnNein.style.cssText += 'background: rgba(217,166,160,.16); color: #9c6a63;';
    btnNein.onclick = () => this.handleNein(karte);
    btnRow.appendChild(btnNein);

    div.appendChild(btnRow);

    // Fussnote
    const details = document.createElement('details');
    details.style.marginTop = '12px';
    const summary = document.createElement('summary');
    summary.className = 'quelle';
    summary.style.cursor = 'pointer';
    summary.textContent = '▸ Fundstelle';
    details.appendChild(summary);

    const p = document.createElement('p');
    p.className = 'quelle';
    p.style.cssText = 'margin-top: 8px; padding-left: 12px;';
    p.textContent = karte.fussnote;
    details.appendChild(p);
    div.appendChild(details);

    // Zeugen-Zeile (Etappe 4 D): unter jedem gelesenen Atom
    const zeuge = document.createElement('div');
    zeuge.className = 'zeugen-zeile';
    zeuge.style.cssText = 'margin-top: 8px; font-size: 11px; color: rgba(42,37,32,.45);';
    zeuge.textContent = 'gelesen auf diesem Gerät · bezeugt';
    div.appendChild(zeuge);

    return div;
  }

  // ============================================================================
  // Karten-Aktionen
  // ============================================================================

  private async handleJa(karte: Karte): Promise<void> {
    try {
      await window.mmc.vault.mergeVorschlag(karte.fallId, karte.vorschlagId);

      // Karte entfernen mit Salbei-Animation
      this.entferneKarte(karte);

      this.showToast('Bestätigt — erledigt.');
    } catch (err) {
      console.error('Fehler beim Mergen:', err);
      this.showToast('Fehler beim Bestätigen.');
    }
  }

  private handleSpaeter(karte: Karte): void {
    // Karte bleibt im Vorschlag-Branch, wird nur visuell eingeklappt
    this.entferneKarte(karte);
    this.showToast('Später — die Karte kehrt zurück.');
  }

  private async handleNein(karte: Karte): Promise<void> {
    try {
      await window.mmc.vault.rejectVorschlag(karte.fallId, karte.vorschlagId);

      this.entferneKarte(karte);

      this.showToast('Abgelehnt.');
    } catch (err) {
      console.error('Fehler beim Ablehnen:', err);
      this.showToast('Fehler beim Ablehnen.');
    }
  }

  private entferneKarte(karte: Karte): void {
    this.karten = this.karten.filter(k => k.vorschlagId !== karte.vorschlagId || k.fallId !== karte.fallId);

    if (this.karten.length === 0) {
      this.zustand = 'ruhig';
    }

    this.renderZustand();
  }

  // ============================================================================
  // Beweis zeigen
  // ============================================================================

  private async zeigeBeweis(karte: Karte): Promise<void> {
    if (!karte.beweisDoc) return;

    try {
      // Vorschlag holen (für Atoms/bbox bzw. Minuten)
      const vorschlaege = await window.mmc.vault.listVorschlaege(karte.fallId);
      const vorschlag = vorschlaege.find(v => v.id === karte.vorschlagId);
      if (!vorschlag) return;

      const container = document.getElementById('beweis-overlay');
      if (!container) return;

      container.innerHTML = '';
      container.style.display = 'flex';

      const commitKurz = vorschlag.branch.substring(0, 8);

      // Weiche: Anruf-Beweis (Zeitmarke im Transkript) oder Dokument (Rechteck)
      const erstesAtom = vorschlag.atoms[0];
      if (erstesAtom?.fundstelle.art === 'anruf') {
        await this.zeigeAnrufBeweis(karte, vorschlag, container, commitKurz);
        return;
      }

      // Bild laden
      const docRelPath = `docs/${karte.beweisDoc}`;
      const bildUrl = await window.mmc.vault.readDocAsDataUrl(karte.fallId, docRelPath);

      // Rechtecke aus Atoms (nur solche mit bbox — Anruf-Atoms tragen keins)
      const rechtecke = vorschlag.atoms
        .filter(a => a.fundstelle.seite === karte.beweisSeite && a.fundstelle.bbox)
        .map(a => ({
          bbox: a.fundstelle.bbox as [number, number, number, number],
          art: 'beweis' as const
        }));

      // Quellzeile (Muster OsBeweis.dc.html)
      const quellzeile = `Fall ${karte.fallId} · ${karte.beweisDoc} · Seite ${karte.beweisSeite} · Commit ${commitKurz} · Signatur ✓`;

      const opts: BeweisOptions = {
        bildUrl,
        seite: {
          width: 1148, // Vision-Breite (wird von bbox skaliert)
          height: 2040
        },
        rechtecke,
        quellzeile,
        onStimmt: () => {
          container.style.display = 'none';
          this.handleJa(karte);
        },
        onOriginal: () => {
          container.style.display = 'none';
        },
        onFalsch: () => {
          container.style.display = 'none';
          this.handleNein(karte);
        }
      };

      container.appendChild(renderBeweis(opts));
    } catch (err) {
      console.error('Fehler beim Laden des Beweises:', err);
      this.showToast('Beweis konnte nicht geladen werden.');
    }
  }

  /**
   * Anruf-Beweis (OsAnrufBeweis): Transkript laden, Fundstellen-Minuten
   * markieren, Timeline statt Rechteck. Die Zeitmarke ist der Beweis.
   */
  private async zeigeAnrufBeweis(
    karte: Karte,
    vorschlag: Vorschlag,
    container: HTMLElement,
    commitKurz: string
  ): Promise<void> {
    // Transkript (JSON) aus dem Vault laden und dekodieren
    const dataUrl = await window.mmc.vault.readDocAsDataUrl(karte.fallId, `docs/${karte.beweisDoc}`);
    const base64 = dataUrl.split(',')[1] ?? '';
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const transkript = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as Transkript;

    // Fundstellen-Minuten aus den Vorschlags-Atoms
    const minuten = new Set(
      vorschlag.atoms.map(a => a.fundstelle.minute).filter((m): m is string => !!m)
    );

    const zeilen: TranskriptAnzeigeZeile[] = transkript.zeilen.map(z => ({
      zeit: z.zeit,
      sprecher: z.sprecher,
      text: z.text,
      markiert: minuten.has(z.zeit)
    }));

    const wav = vorschlag.atoms[0]?.fundstelle.wav ?? transkript.wav;
    const minute = vorschlag.atoms[0]?.fundstelle.minute ?? '00:00';
    const dauer = vorschlag.atoms[0]?.fundstelle.dauer ?? transkript.dauer;

    // Header: ANRUF · <TITEL> · <42 MIN>
    const headerTeile = ['ANRUF'];
    if (transkript.titel) headerTeile.push(transkript.titel.toUpperCase());
    if (dauer) headerTeile.push(`${parseInt(dauer, 10)} MIN`);
    const header = headerTeile.join(' · ');

    const quellzeile = `Fall ${karte.fallId} · ${wav} · Minute ${minute} · Commit ${commitKurz} · Signatur ✓`;

    container.appendChild(
      renderAnrufBeweis({
        header,
        zeilen,
        minute,
        quellzeile,
        onStimmt: () => {
          container.style.display = 'none';
          this.handleJa(karte);
        },
        onAnhoeren: async () => {
          // Audio ab Fundstellen-Minute — wenn die WAV im Fall verwahrt ist
          try {
            const audioUrl = await window.mmc.vault.readDocAsDataUrl(karte.fallId, `docs/${wav}`);
            const audio = new Audio(audioUrl);
            const [mm, ss] = minute.split(':').map(n => parseInt(n, 10) || 0);
            audio.currentTime = mm * 60 + ss;
            await audio.play();
            this.showToast(`Spielt ab Minute ${minute}.`);
          } catch {
            this.showToast(`Aufnahme nicht verfügbar — Minute ${minute}.`);
          }
        },
        onFalsch: () => {
          container.style.display = 'none';
          this.handleNein(karte);
        }
      })
    );
  }

  // ============================================================================
  // Frag-mich
  // ============================================================================

  private setupFragMich(): void {
    const toggle = document.getElementById('frag-mich-toggle');
    const eingabe = document.getElementById('frag-mich-eingabe') as HTMLInputElement;
    const senden = document.getElementById('frag-mich-senden');

    if (toggle) {
      toggle.addEventListener('click', () => {
        if (this.zustand === 'antwortend') {
          this.zustand = this.karten.length > 0 ? 'fragend' : 'ruhig';
        } else {
          this.zustand = 'antwortend';
        }
        this.renderZustand();
      });
    }

    if (senden && eingabe) {
      const sendeFn = () => {
        const frage = eingabe.value.trim();
        if (frage) {
          this.handleFrage(frage);
          eingabe.value = '';
        }
      };

      senden.addEventListener('click', sendeFn);
      eingabe.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendeFn();
      });
    }
  }

  private async handleFrage(frage: string): Promise<void> {
    const log = document.getElementById('dialog-log');
    if (!log) return;

    // Frage anzeigen
    const frageEl = document.createElement('div');
    frageEl.className = 'frage';
    frageEl.textContent = frage;
    log.appendChild(frageEl);

    // Spinner
    const spinner = document.createElement('div');
    spinner.className = 'antwort';
    spinner.textContent = '…';
    log.appendChild(spinner);
    log.scrollTop = log.scrollHeight;

    try {
      // Kontext: bestätigtes Wissen (gemergte Atoms auf main) ZUERST,
      // danach offene Vorschläge — als unbestätigt markiert. Dedupe per Schlüssel.
      const faelle = await window.mmc.vault.listFaelle();
      const kontexte: Array<{ fall: string; doc: string; seite: number; text: string }> = [];
      const gesehen = new Set<string>();

      for (const fall of faelle) {
        const gemergt = await window.mmc.vault.listAtomsMain(fall.id).catch(() => []);
        for (const eintrag of gemergt) {
          for (const atom of eintrag.atoms) {
            const key = `${fall.id}|${atom.fundstelle.doc}|${atom.feld}|${atom.wert}`;
            if (gesehen.has(key)) continue;
            gesehen.add(key);
            kontexte.push({
              fall: fall.id,
              doc: atom.fundstelle.doc,
              seite: atom.fundstelle.seite ?? 1,
              text: `${eintrag.titel} — ${atom.feld}: ${atom.wert} (bestätigt)`
            });
          }
        }

        const vorschlaege = await window.mmc.vault.listVorschlaege(fall.id);
        for (const v of vorschlaege) {
          for (const atom of v.atoms) {
            const key = `${fall.id}|${atom.fundstelle.doc}|${atom.feld}|${atom.wert}`;
            if (gesehen.has(key)) continue;
            gesehen.add(key);
            kontexte.push({
              fall: fall.id,
              doc: atom.fundstelle.doc,
              seite: atom.fundstelle.seite ?? 1,
              text: `${v.kartentext.titel} — ${atom.feld}: ${atom.wert} (unbestätigter Vorschlag)`
            });
          }
        }
      }

      // vLLM aufrufen
      const { antwort } = await window.mmc.llm.fragMich(frage, kontexte);

      // Spinner entfernen
      spinner.remove();

      // Antwort anzeigen
      const antwortEl = document.createElement('div');
      antwortEl.className = 'antwort';
      antwortEl.style.whiteSpace = 'pre-wrap';
      antwortEl.textContent = antwort;

      // Zitat-Kacheln (v0.1: vereinfacht, keine Parsing der Antwort nach [1], [2], etc.)
      // Falls Kontext vorhanden war, zeige Quellen
      if (kontexte.length > 0) {
        const zitatBox = document.createElement('div');
        zitatBox.style.cssText = 'margin-top: 12px; display: flex; gap: 6px; flex-wrap: wrap;';

        // Bis zu 5 Quellen als Kacheln
        // Treffer-Karten nach OsSuche.dc.html: 15px 18px, 65 % Weiß, kein
        // Schatten, Fall-Chip in Olivgold, Häkchen rechts (Salbei, 2.4)
        zitatBox.style.cssText = 'margin-top: 12px; display: flex; flex-direction: column; gap: 10px;';

        kontexte.slice(0, 5).forEach(k => {
          const treffer = document.createElement('div');
          treffer.style.cssText = `
            padding: 15px 18px;
            display: flex;
            align-items: center;
            gap: 14px;
            background: rgba(255,255,255,.65);
            border: 1px solid rgba(184,163,105,.22);
            border-radius: 16px;
            cursor: pointer;
          `;

          const chip = document.createElement('span');
          chip.className = 't11';
          chip.style.cssText = `
            flex: none;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(184,163,105,.14);
            color: #96824c;
          `;
          chip.textContent = k.fall;
          treffer.appendChild(chip);

          const mitte = document.createElement('div');
          mitte.style.cssText = 'flex: 1; min-width: 0;';

          const zeile1 = document.createElement('div');
          zeile1.className = 't13';
          zeile1.textContent = k.text;
          mitte.appendChild(zeile1);

          const zeile2 = document.createElement('div');
          zeile2.className = 't11 sub';
          zeile2.style.marginTop = '2px';
          zeile2.textContent = `${k.doc} · S. ${k.seite} — im Fall geprüft`;
          mitte.appendChild(zeile2);

          treffer.appendChild(mitte);

          const haken = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          haken.setAttribute('width', '14');
          haken.setAttribute('height', '14');
          haken.setAttribute('viewBox', '0 0 24 24');
          haken.setAttribute('fill', 'none');
          haken.setAttribute('stroke', '#8FA98F');
          haken.setAttribute('stroke-width', '2.4');
          haken.setAttribute('stroke-linecap', 'round');
          haken.setAttribute('stroke-linejoin', 'round');
          haken.style.flexShrink = '0';
          const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pfad.setAttribute('d', 'M20 6 9 17l-5-5');
          haken.appendChild(pfad);
          treffer.appendChild(haken);

          treffer.onclick = () => {
            this.showToast(`Quelle: ${k.fall} · ${k.doc} · Seite ${k.seite}`);
          };
          zitatBox.appendChild(treffer);
        });

        antwortEl.appendChild(zitatBox);

        // Quellzeile nach OsSuche.dc.html: Fälle · Treffer · nichts hat das Haus verlassen ✓
        const faelleGezaehlt = new Set(kontexte.map(k => k.fall)).size;
        const suchQuelle = document.createElement('div');
        suchQuelle.className = 'quelle';
        suchQuelle.style.cssText = 'margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';
        suchQuelle.textContent =
          `${faelleGezaehlt} ${faelleGezaehlt === 1 ? 'Fall' : 'Fälle'} durchsucht · ` +
          `${kontexte.length} ${kontexte.length === 1 ? 'Treffer' : 'Treffer'}, jeder im eigenen Fall geprüft · ` +
          'nichts hat das Haus verlassen ✓';
        antwortEl.appendChild(suchQuelle);
      }

      log.appendChild(antwortEl);
      log.scrollTop = log.scrollHeight;
    } catch (err) {
      spinner.remove();

      const fehlerEl = document.createElement('div');
      fehlerEl.className = 'antwort';
      fehlerEl.style.color = '#9c6a63';

      if ((err as Error).message?.includes('vLLM failed')) {
        fehlerEl.textContent = 'Ich erreiche meinen Denker gerade nicht.';
      } else {
        fehlerEl.textContent = `Fehler: ${(err as Error).message || err}`;
      }

      log.appendChild(fehlerEl);
      log.scrollTop = log.scrollHeight;
    }
  }

  // ============================================================================
  // Drop-Zone (Ingress)
  // ============================================================================

  private setupDropZone(): void {
    const main = document.querySelector('main');
    if (!main) return;

    // WICHTIG: Listener auf document, nicht nur auf <main>. Landet der Drop
    // ausserhalb von <main> (Kopfzeile, Rand), macht Chromium sonst den
    // Standard: er NAVIGIERT zur Datei — die Oberflaeche ist weg.
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!this.dropZoneActive) {
        this.dropZoneActive = true;
        main.style.background = 'rgba(143,169,143,.08)';
      }
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      // Nur zuruecksetzen, wenn der Zeiger das Fenster wirklich verlaesst
      if ((e as DragEvent).relatedTarget === null) {
        this.dropZoneActive = false;
        main.style.background = '';
      }
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.dropZoneActive = false;
      main.style.background = '';

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0]; // Nur erste Datei
      await this.handleEingang(file);
    });

    // Zweiter Eingangsweg: Klick auf die Einladung öffnet die Dateiauswahl
    const dateiInput = document.createElement('input');
    dateiInput.type = 'file';
    dateiInput.accept = '.jpg,.jpeg,.png,.pdf,.json,image/jpeg,image/png,application/pdf,application/json';
    dateiInput.style.display = 'none';
    document.body.appendChild(dateiInput);

    dateiInput.addEventListener('change', async () => {
      const file = dateiInput.files?.[0];
      dateiInput.value = ''; // gleiche Datei erneut wählbar
      if (file) await this.handleEingang(file);
    });

    const einladung = document.getElementById('gruss-klein');
    if (einladung) {
      einladung.style.cursor = 'pointer';
      einladung.textContent = 'Zieh ein Dokument hierher — oder klick, um eines zu wählen.';
      einladung.addEventListener('click', () => dateiInput.click());
    }
  }

  private async handleEingang(file: File): Promise<void> {
    try {
      // Fall-Wahl: wenn kein Fall existiert, anlegen
      let fallId = this.aktuellerFall;

      if (!fallId) {
        const faelle = await window.mmc.vault.listFaelle();

        if (faelle.length === 0) {
          // Kein Fall vorhanden → Dialog mit Eingabefeld
          const dialog = this.erstelleFallDialog();
          document.body.appendChild(dialog);

          // Warten auf Eingabe
          fallId = await this.warteFallWahl(dialog);

          if (!fallId) {
            this.showToast('Abgebrochen.');
            return;
          }

          await window.mmc.vault.createFall(fallId);
          this.aktuellerFall = fallId;
        } else {
          // Ersten Fall verwenden (v0.1: einfach)
          fallId = faelle[0].id;
          this.aktuellerFall = fallId;
        }
      }

      // 1. Commit vor Deutung
      const bytes = await file.arrayBuffer();

      // Transkript-Weiche: .json mit {art:'anruf', wav, zeilen} ist eine
      // Anruf-Mitschrift → kanal 'anruf', keine OCR (Etappe 4, Arbeit A)
      let transkript: Transkript | null = null;
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const t = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as Transkript;
          if (t && t.art === 'anruf' && typeof t.wav === 'string' && Array.isArray(t.zeilen)) {
            transkript = t;
          }
        } catch {
          // kein gültiges JSON — normaler Dokumentweg
        }
      }

      const { sha, docPfad } = await window.mmc.vault.commitEingang(
        fallId,
        transkript
          ? { absender: 'Anruf-Mitschrift', kanal: 'anruf' }
          : { absender: 'Datei-Drop', kanal: 'app' },
        { name: file.name, bytes }
      );

      console.log(`Eingang committed: ${sha}`);

      // Fundstelle.doc muss auf die VERWAHRTE Datei zeigen (zeitgestempelter
      // Name im Vault, aus docPfad), nicht auf den Originalnamen — sonst
      // findet der Beweis (readDocAsDataUrl auf docs/<doc>) die Datei nicht.
      const verwahrterName = docPfad.split('/').pop() ?? file.name;

      // 2.+3. Deutung — Anruf: direkt aus dem Transkript (Minuten statt bbox);
      // Dokument: OCR, dann Heuristik. Beides im Main-Prozess (eine Quelle der Wahrheit).
      let deutung: DeutungErgebnis;
      if (transkript) {
        deutung = await window.mmc.ocr.deutungAusTranskript(transkript, verwahrterName);
      } else {
        const ocr = await window.mmc.ocr.deuteBeleg({
          name: file.name,
          bytes,
          mime: file.type
        });
        console.log(`OCR: ${ocr.pages.length} Seiten, ${ocr.totalMs}ms`);
        deutung = await window.mmc.ocr.deutungAusOcr(ocr, verwahrterName);
      }

      // 4. Vorschlag erstellen
      const proposalId = `deutung-${Date.now()}`;
      await window.mmc.vault.proposeDeutung(fallId, proposalId, deutung.atoms, deutung.kartentext);

      // 5. Vorschläge neu laden
      await this.ladeVorschlaege();
      this.zustand = 'fragend';
      this.renderZustand();

      this.showToast(
        deutung.atoms.length === 0
          ? (transkript
              ? 'Anruf verwahrt — nichts Verbindliches erkannt.'
              : 'Eingang verwahrt — ich finde keine Beträge.')
          : (transkript
              ? `Anruf verarbeitet: ${deutung.atoms.length} Stellen erkannt.`
              : `Eingang verarbeitet: ${deutung.atoms.length} Beträge erkannt.`)
      );
    } catch (err) {
      console.error('Fehler beim Verarbeiten des Eingangs:', err);
      this.showToast(`Fehler: ${(err as Error).message || err}`);
    }
  }

  private erstelleFallDialog(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.3);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const dialog = document.createElement('div');
    dialog.className = 'karte';
    dialog.style.cssText = `
      width: 400px;
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    const titel = document.createElement('div');
    titel.className = 'serif';
    titel.style.fontSize = '22px';
    titel.textContent = 'Neuen Fall anlegen';
    dialog.appendChild(titel);

    const hinweis = document.createElement('div');
    hinweis.className = 't13 sub';
    hinweis.textContent = 'Gib einen Namen ein (z. B. „steuern-2026"):';
    dialog.appendChild(hinweis);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 't13';
    input.style.cssText = `
      padding: 10px 16px;
      border: 1px solid rgba(184,163,105,.3);
      border-radius: 8px;
      font-family: var(--font-sans);
      font-size: 15px;
    `;
    input.placeholder = 'z. B. stricker-2026';
    dialog.appendChild(input);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 10px; margin-top: 8px;';

    const btnOk = document.createElement('button');
    btnOk.textContent = 'Anlegen';
    btnOk.className = 'pill-salbei';
    btnRow.appendChild(btnOk);

    const btnAbbrechen = document.createElement('button');
    btnAbbrechen.textContent = 'Abbrechen';
    btnAbbrechen.className = 'pill-still';
    btnRow.appendChild(btnAbbrechen);

    dialog.appendChild(btnRow);

    overlay.appendChild(dialog);

    // Handler
    btnOk.onclick = () => {
      const val = input.value.trim();
      if (val) {
        overlay.dataset.result = val;
        overlay.remove();
      }
    };

    btnAbbrechen.onclick = () => {
      overlay.dataset.result = '';
      overlay.remove();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnOk.click();
      }
    });

    // Focus
    setTimeout(() => input.focus(), 100);

    return overlay;
  }

  private warteFallWahl(dialog: HTMLElement): Promise<string> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!document.body.contains(dialog)) {
          clearInterval(interval);
          resolve(dialog.dataset.result || '');
        }
      }, 100);
    });
  }

  // ============================================================================
  // Seitenbrett (Fall-Liste + Fall-Ansicht)
  // ============================================================================

  private async setupSeitenbrett(): Promise<void> {
    const toggle = document.getElementById('seitenbrett-toggle');
    const panel = document.getElementById('seitenbrett-panel');

    if (toggle && panel) {
      toggle.addEventListener('click', async () => {
        const istOffen = panel.style.display === 'block';
        if (istOffen) {
          panel.style.display = 'none';
        } else {
          panel.style.display = 'block';
          await this.renderSeitenbrett();
        }
      });
    }
  }

  private async renderSeitenbrett(): Promise<void> {
    const liste = document.getElementById('seitenbrett-liste');
    if (!liste) return;

    liste.innerHTML = '';

    try {
      const faelle = await window.mmc.vault.listFaelle();

      if (faelle.length === 0) {
        const hinweis = document.createElement('div');
        hinweis.className = 't13 sub';
        hinweis.textContent = 'Noch keine Fälle.';
        liste.appendChild(hinweis);
        return;
      }

      for (const fall of faelle) {
        const item = document.createElement('div');
        item.className = 't13';
        item.style.cssText = `
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;

        const name = document.createElement('span');
        name.textContent = fall.id;
        item.appendChild(name);

        if (fall.offeneVorschlaege > 0) {
          const zaehler = document.createElement('span');
          zaehler.className = 't11';
          zaehler.style.cssText = `
            background: rgba(217,166,160,.2);
            color: #9c6a63;
            padding: 2px 8px;
            border-radius: 999px;
          `;
          zaehler.textContent = fall.offeneVorschlaege.toString();
          item.appendChild(zaehler);
        }

        item.onmouseenter = () => {
          item.style.background = 'rgba(143,169,143,.08)';
        };
        item.onmouseleave = () => {
          item.style.background = '';
        };

        item.onclick = () => {
          this.zeigeFallAnsicht(fall.id);
        };

        liste.appendChild(item);
      }
    } catch (err) {
      console.error('Fehler beim Rendern des Seitenbretts:', err);
    }

    this.renderFlaechenNavigation(liste);
    await this.renderGitchainZeile(liste);
  }

  /**
   * Flächen der OS-Sprache (Etappe 4 B5–B7) — jeder Artboard ist erreichbar.
   */
  private renderFlaechenNavigation(liste: HTMLElement): void {
    const label = document.createElement('div');
    label.className = 't11';
    label.style.cssText =
      'margin-top: 14px; padding: 0 12px 6px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgba(42,37,32,.42);';
    label.textContent = 'Flächen';
    liste.appendChild(label);

    const eintraege: Array<[string, () => void]> = [
      ['Tisch — Nebeneinander', () => this.zeigeTisch()],
      ['Gruppe — vier Klone, ein Baum', () => this.zeigeGruppe()],
      ['Einladen — eine Erlaubnis, nie der Besitz', () => this.zeigeEinladen()],
      ['Rückruf — Erlaubnis entziehen', () => this.zeigeRueckruf()],
      ['Onboarding — Siegel prägen', () => this.zeigeOnboarding(1)]
    ];

    for (const [text, aktion] of eintraege) {
      const item = document.createElement('div');
      item.className = 't13';
      item.style.cssText = 'padding: 10px 12px; border-radius: 8px; cursor: pointer;';
      item.textContent = text;
      item.onmouseenter = () => { item.style.background = 'rgba(143,169,143,.08)'; };
      item.onmouseleave = () => { item.style.background = ''; };
      item.onclick = () => {
        const panel = document.getElementById('seitenbrett-panel');
        if (panel) panel.style.display = 'none';
        aktion();
      };
      liste.appendChild(item);
    }
  }

  /** OsTisch.dc.html — Vollfenster-Szene im Overlay. */
  private zeigeTisch(): void {
    const overlay = document.getElementById('beweis-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    overlay.style.display = 'flex';
    overlay.appendChild(
      renderTisch(() => {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
      })
    );
  }

  /** OsGruppe.dc.html — Mobil-Blatt (390px) auf der Bühne. */
  private zeigeGruppe(): void {
    this.zustand = 'fall-ansicht';
    this.renderZustand();

    const container = document.getElementById('fall-ansicht-container');
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(renderGruppe());

    const btnZurueck = document.createElement('button');
    btnZurueck.textContent = 'Zurück';
    btnZurueck.className = 'pill-still';
    btnZurueck.style.cssText = 'margin: 24px auto 0; display: block;';
    btnZurueck.onclick = () => {
      this.zustand = this.karten.length > 0 ? 'fragend' : 'ruhig';
      this.renderZustand();
    };
    container.appendChild(btnZurueck);
  }

  /** OsEinladen.dc.html — Capability-Flow (Scope, Dauer, kein Konto) auf der Bühne. */
  private zeigeEinladen(): void {
    this.zustand = 'fall-ansicht';
    this.renderZustand();

    const container = document.getElementById('fall-ansicht-container');
    if (!container) return;
    container.innerHTML = '';

    const zurueck = (): void => {
      this.zustand = this.karten.length > 0 ? 'fragend' : 'ruhig';
      this.renderZustand();
    };

    container.appendChild(
      renderEinladen({
        onEinladen: () => {
          this.showToast('Einladen braucht einen zweiten Klon — auf diesem Gerät noch nicht verbunden.');
        },
        onAbbrechen: zurueck
      })
    );
  }

  /** OsRueckruf.dc.html — Anruf/Rückruf einer Erlaubnis (Mobil-Blatt auf der Bühne). */
  private zeigeRueckruf(): void {
    this.zustand = 'fall-ansicht';
    this.renderZustand();

    const container = document.getElementById('fall-ansicht-container');
    if (!container) return;
    container.innerHTML = '';

    const zurueck = (): void => {
      this.zustand = this.karten.length > 0 ? 'fragend' : 'ruhig';
      this.renderZustand();
    };

    container.appendChild(
      renderRueckruf({
        onEntziehen: () => {
          this.showToast('Rückruf braucht einen zweiten Klon — auf diesem Gerät noch nicht verbunden.');
        },
        onBehalten: zurueck
      })
    );
  }

  /**
   * Null-Fragen-Onboarding (Etappe 4 C): ObSiegel → ObRettung → ObErfolg.
   * Drei Vollflächen im Overlay; ObNull ist Referenzblatt, ObWohnort/ObAutonomie*
   * sind Archiv und werden nicht gebaut.
   */
  private zeigeOnboarding(schritt: 1 | 2 | 3): void {
    const overlay = document.getElementById('beweis-overlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    overlay.style.display = 'flex';

    const fertig = (): void => {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
      localStorage.setItem('mmc-onboarding', 'done');
    };

    let flaeche: HTMLElement;
    if (schritt === 1) {
      flaeche = renderObSiegel(() => this.zeigeOnboarding(2));
    } else if (schritt === 2) {
      flaeche = renderObRettung({
        onJetzt: () => {
          this.showToast('Zweiter Träger folgt — auf diesem Gerät noch nicht verbunden.');
          this.zeigeOnboarding(3);
        },
        onSpaeter: () => this.zeigeOnboarding(3)
      });
    } else {
      flaeche = renderObErfolg(fertig);
    }
    overlay.appendChild(flaeche);
  }

  /**
   * GitChain-Verbindungszeile am Fuß des Seitenbretts.
   * Nicht verbunden → Klick startet Device-Login (Browser öffnet sich, Code wird
   * angezeigt, wir pollen). Verbunden → zeigt den Nutzer, Klick pusht den Fall.
   */
  private async renderGitchainZeile(liste: HTMLElement): Promise<void> {
    const zeile = document.createElement('div');
    zeile.id = 'gitchain-status';
    zeile.className = 't11 sub';
    zeile.style.cssText = 'margin-top:16px;padding:10px 12px;border-top:1px solid rgba(0,0,0,.06);cursor:pointer;';
    zeile.textContent = 'GitChain: prüfe …';
    liste.appendChild(zeile);

    try {
      const s = await window.mmc.gitchain.status();
      if (s.angemeldet) {
        zeile.textContent = `GitChain: verbunden als ${s.user} · Klick sichert den Fall`;
        zeile.onclick = async () => {
          const fallId = this.aktuellerFall ?? this.karten[0]?.fallId;
          if (!fallId) { this.showToast('Kein Fall ausgewählt.'); return; }
          zeile.textContent = `GitChain: sichere ${fallId} …`;
          const erg = await window.mmc.gitchain.pushFall(fallId);
          zeile.textContent = erg.ok
            ? `GitChain: ${fallId} gesichert (${erg.remoteRefs.length} Refs)`
            : `GitChain: Sicherung fehlgeschlagen`;
          if (!erg.ok) this.showToast(erg.meldung);
        };
      } else {
        zeile.textContent = 'GitChain: nicht verbunden · Klick zum Anmelden';
        zeile.onclick = async () => {
          zeile.onclick = null;
          try {
            const start = await window.mmc.gitchain.loginStart();
            zeile.textContent = `GitChain: Code ${start.userCode} — im Browser bestätigen …`;
            const bisMs = Date.now() + start.expiresInSek * 1000;
            const poll = async (): Promise<void> => {
              if (Date.now() > bisMs) { zeile.textContent = 'GitChain: Anmeldung abgelaufen.'; return; }
              const p = await window.mmc.gitchain.loginPoll(start.deviceCode);
              if (p.status === 'ok') {
                zeile.textContent = `GitChain: verbunden${p.user ? ` als ${p.user}` : ''}`;
                return;
              }
              if (p.status === 'fehler') { zeile.textContent = `GitChain: ${p.meldung}`; return; }
              setTimeout(poll, start.intervalSek * 1000);
            };
            setTimeout(poll, start.intervalSek * 1000);
          } catch (e) {
            zeile.textContent = 'GitChain: Anmeldung nicht erreichbar.';
            console.error('gitchain loginStart:', e);
          }
        };
      }
    } catch (e) {
      zeile.textContent = 'GitChain: nicht erreichbar.';
      console.error('gitchain status:', e);
    }
  }

  private async zeigeFallAnsicht(fallId: string): Promise<void> {
    this.aktuellerFall = fallId;
    this.zustand = 'fall-ansicht';
    this.renderZustand();

    const container = document.getElementById('fall-ansicht-container');
    if (!container) return;

    container.innerHTML = '';

    try {
      const erzaehlung = await window.mmc.vault.fallErzaehlung(fallId);
      const vorschlaege = await window.mmc.vault.listVorschlaege(fallId).catch(() => []);

      // Titel nach OsFall.dc.html: Serif 34, zentriert, line-height 1.3
      const titelEl = document.createElement('div');
      titelEl.className = 'serif';
      titelEl.style.cssText = 'font-size: 34px; line-height: 1.3; text-align: center; margin-bottom: 34px;';
      const offen = vorschlaege.length;
      titelEl.textContent =
        offen === 0
          ? `${fallId.toUpperCase()}. Alles ruhig.`
          : offen === 1
            ? `${fallId.toUpperCase()}. Ein Ding wartet.`
            : `${fallId.toUpperCase()}. ${offen} Dinge warten.`;
      container.appendChild(titelEl);

      if (erzaehlung.length === 0) {
        const hinweis = document.createElement('div');
        hinweis.className = 't13 sub';
        hinweis.style.textAlign = 'center';
        hinweis.textContent = 'Noch keine Einträge in diesem Fall.';
        container.appendChild(hinweis);
      } else {
        // "Still passiert"-Liste nach OsFall.dc.html
        const label = document.createElement('div');
        label.className = 't11';
        label.style.cssText =
          'font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgba(42,37,32,.42); margin-bottom: 9px;';
        label.textContent = 'Still passiert';
        container.appendChild(label);

        const liste = document.createElement('div');
        liste.style.cssText = 'display: flex; flex-direction: column; gap: 9px;';

        for (const satz of erzaehlung) {
          // Karte: 13px 16px, kein Schatten, 65 % Weiß, Häkchen Salbei
          const karte = document.createElement('div');
          karte.style.cssText = `
            padding: 13px 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            background: rgba(255,255,255,.65);
            border: 1px solid rgba(184,163,105,.22);
            border-radius: 16px;
          `;

          const zeile = document.createElement('div');
          zeile.style.cssText = 'display: flex; align-items: center; gap: 12px;';

          const haken = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          haken.setAttribute('width', '15');
          haken.setAttribute('height', '15');
          haken.setAttribute('viewBox', '0 0 24 24');
          haken.setAttribute('fill', 'none');
          haken.setAttribute('stroke', '#8FA98F');
          haken.setAttribute('stroke-width', '2.4');
          haken.setAttribute('stroke-linecap', 'round');
          haken.setAttribute('stroke-linejoin', 'round');
          haken.style.flexShrink = '0';
          const pfad = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pfad.setAttribute('d', 'M20 6 9 17l-5-5');
          haken.appendChild(pfad);
          zeile.appendChild(haken);

          const text = document.createElement('span');
          text.className = 't13';
          text.style.flex = '1';
          text.textContent = satz.satz;
          zeile.appendChild(text);

          const tag = document.createElement('span');
          tag.className = 't11 sub';
          tag.textContent = this.wochentagKurz(satz.datumIso);
          zeile.appendChild(tag);

          karte.appendChild(zeile);

          // Aufklappbare Commit-Zeile — der Beweis bleibt erreichbar
          const details = document.createElement('details');
          const summary = document.createElement('summary');
          summary.className = 'quelle';
          summary.style.cssText = 'cursor: pointer; user-select: none;';
          summary.textContent = '▸ Commit-Zeile';
          details.appendChild(summary);

          const quellzeile = document.createElement('div');
          quellzeile.className = 'quelle';
          quellzeile.style.cssText = 'margin-top: 6px; padding-left: 12px;';
          quellzeile.textContent = satz.commitZeile;
          details.appendChild(quellzeile);
          karte.appendChild(details);

          liste.appendChild(karte);
        }

        container.appendChild(liste);
      }

      // Button-Zeile: Vereinbarung (OsVereinbarung) + Zurück
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display: flex; gap: 10px; margin-top: 24px;';

      if (erzaehlung.length > 0) {
        const btnVereinbarung = document.createElement('button');
        btnVereinbarung.textContent = 'Vereinbarung';
        btnVereinbarung.className = 'pill-still';
        btnVereinbarung.onclick = () => void this.zeigeVereinbarung(fallId, erzaehlung);
        btnRow.appendChild(btnVereinbarung);
      }

      const btnZurueck = document.createElement('button');
      btnZurueck.textContent = 'Zurück';
      btnZurueck.className = 'pill-still';
      btnZurueck.onclick = () => {
        this.zustand = this.karten.length > 0 ? 'fragend' : 'ruhig';
        this.renderZustand();
      };
      btnRow.appendChild(btnZurueck);
      container.appendChild(btnRow);
    } catch (err) {
      console.error('Fehler beim Laden der Erzählung:', err);
      const fehlerEl = document.createElement('div');
      fehlerEl.className = 't13';
      fehlerEl.style.color = '#9c6a63';
      fehlerEl.textContent = `Fehler: ${(err as Error).message || err}`;
      container.appendChild(fehlerEl);
    }
  }

  /**
   * OsVereinbarung.dc.html — die Fassung aus dem Verlauf, jede Zeile zeigt
   * auf ihre Stelle. Positionen kommen aus den echten gemergten Atoms des
   * Falls; die Gegenseite ist v0.1-Statik im Artboard-Duktus (kein
   * Signatur-Backend). Signieren bleibt hinter Face ID — hier nur der Hinweis.
   */
  private async zeigeVereinbarung(fallId: string, erzaehlung: ErzaehlSatz[]): Promise<void> {
    const container = document.getElementById('fall-ansicht-container');
    if (!container) return;
    container.innerHTML = '';

    try {
      const gruppen = await window.mmc.vault.listAtomsMain(fallId);
      const atoms = gruppen.flatMap(g => g.atoms);

      const positionen: VereinbarungPosition[] = atoms.slice(0, 6).map(a => ({
        feld: a.feld,
        wert: a.wert,
        fundstelle:
          a.fundstelle.art === 'anruf'
            ? `aus dem Anruf · Minute ${a.fundstelle.minute ?? '—'}`
            : `aus ${a.fundstelle.doc} · S. ${a.fundstelle.seite ?? 1}`
      }));

      const letzterSha = erzaehlung.length > 0 ? erzaehlung[erzaehlung.length - 1].sha : '—';

      const screen = renderVereinbarung({
        fallId,
        fassung: Math.max(1, erzaehlung.length),
        commitSha: letzterSha.slice(0, 7),
        positionen,
        parteien: [
          { name: 'Gerd', signiert: true, hinweis: 'signiert · heute' },
          { name: 'Du', signiert: false, hinweis: 'deine Signatur fehlt noch' }
        ],
        onSignieren: () => {
          this.showToast('Signieren braucht Face ID — auf diesem Gerät noch nicht verbunden.');
        },
        onAendern: () => {
          this.showToast('Fassung ändern: Zieh ein Dokument auf den Fall, der Rest passiert still.');
        }
      });
      container.appendChild(screen);

      // Zurück zur Fall-Ansicht
      const btnZurueck = document.createElement('button');
      btnZurueck.textContent = 'Zurück';
      btnZurueck.className = 'pill-still';
      btnZurueck.style.cssText = 'margin: 24px auto 0; display: block;';
      btnZurueck.onclick = () => void this.zeigeFallAnsicht(fallId);
      container.appendChild(btnZurueck);
    } catch (err) {
      console.error('Fehler beim Laden der Vereinbarung:', err);
      const fehlerEl = document.createElement('div');
      fehlerEl.className = 't13';
      fehlerEl.style.color = '#9c6a63';
      fehlerEl.textContent = `Fehler: ${(err as Error).message || err}`;
      container.appendChild(fehlerEl);
    }
  }

  /** Wochentag-Kürzel wie im OsFall-Artboard ("Do", "Di") */
  private wochentagKurz(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
  }

  // ============================================================================
  // Toast
  // ============================================================================

  private showToast(msg: string): void {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.classList.add('sichtbar');
    setTimeout(() => toast.classList.remove('sichtbar'), 2400);
  }
}

// App starten
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}
