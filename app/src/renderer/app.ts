/**
 * app.ts — UI-Shell mit vollem Lebenszyklus (Etappe 3)
 *
 * Drei Zustände: ruhig | fragend | antwortend
 * Sechs Flächen: Heute, Karte, Beweis, Frag-mich-Dialog, Fall-Ansicht, Seitenbrett
 */

import { renderBeweis, type BeweisOptions } from './beweis.js';

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

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.renderBegruessung();
    await this.ladeVorschlaege();
    this.renderZustand();
    this.setupFragMich();
    this.setupDropZone();
    this.setupSeitenbrett();
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

          // Fussnote: (fall · doc · seite · commit · sig ✓)
          const commitKurz = v.branch.substring(0, 8);
          const fussnote = `fall: ${fall.id} · ${beweisDoc || '?'} · Seite ${beweisSeite || '?'} · ${commitKurz} · sig ✓`;

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
      // Vorschlag holen (für Atoms/bbox)
      const vorschlaege = await window.mmc.vault.listVorschlaege(karte.fallId);
      const vorschlag = vorschlaege.find(v => v.id === karte.vorschlagId);
      if (!vorschlag) return;

      // Bild laden
      const docRelPath = `docs/${karte.beweisDoc}`;
      const bildUrl = await window.mmc.vault.readDocAsDataUrl(karte.fallId, docRelPath);

      // Rechtecke aus Atoms
      const rechtecke = vorschlag.atoms
        .filter(a => a.fundstelle.seite === karte.beweisSeite)
        .map(a => ({
          bbox: a.fundstelle.bbox,
          art: 'beweis' as const
        }));

      // Quellzeile
      const commitKurz = vorschlag.branch.substring(0, 8);
      const quellzeile = `Fall ${karte.fallId} · ${karte.beweisDoc} · Seite ${karte.beweisSeite} · ${commitKurz} · sig ✓`;

      // Beweis-Container anzeigen
      const container = document.getElementById('beweis-overlay');
      if (!container) return;

      container.innerHTML = '';
      container.style.display = 'flex';

      const opts: BeweisOptions = {
        bildUrl,
        seite: {
          width: 1148, // Vision-Breite (wird von bbox skaliert)
          height: 2040
        },
        rechtecke,
        quellzeile,
        onPasst: () => {
          container.style.display = 'none';
          this.handleJa(karte);
        },
        onAnders: () => {
          container.style.display = 'none';
          this.handleNein(karte);
        },
        onQuelle: () => {
          container.style.display = 'none';
        }
      };

      container.appendChild(renderBeweis(opts));
    } catch (err) {
      console.error('Fehler beim Laden des Beweises:', err);
      this.showToast('Beweis konnte nicht geladen werden.');
    }
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
              seite: atom.fundstelle.seite,
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
              seite: atom.fundstelle.seite,
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
        kontexte.slice(0, 5).forEach(k => {
          const kachel = document.createElement('div');
          kachel.className = 'zug zug-ok';
          kachel.style.cursor = 'pointer';
          kachel.textContent = `${k.doc} S. ${k.seite}`;
          kachel.title = k.text;
          kachel.onclick = () => {
            this.showToast(`Quelle: ${k.fall} · ${k.doc} · Seite ${k.seite}`);
          };
          zitatBox.appendChild(kachel);
        });

        antwortEl.appendChild(zitatBox);
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
    dateiInput.accept = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';
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
      const { sha, docPfad } = await window.mmc.vault.commitEingang(
        fallId,
        { absender: 'Datei-Drop', kanal: 'app' },
        { name: file.name, bytes }
      );

      console.log(`Eingang committed: ${sha}`);

      // 2. OCR
      const ocr = await window.mmc.ocr.deuteBeleg({
        name: file.name,
        bytes,
        mime: file.type
      });

      console.log(`OCR: ${ocr.pages.length} Seiten, ${ocr.totalMs}ms`);

      // 3. Deutung aus OCR — läuft im Main-Prozess (deutung.ts, eine Quelle der Wahrheit)
      // Fundstelle.doc muss auf die VERWAHRTE Datei zeigen (zeitgestempelter
      // Name im Vault, aus docPfad), nicht auf den Originalnamen — sonst
      // findet der Beweis (readDocAsDataUrl auf docs/<doc>) das Bild nicht.
      const verwahrterName = docPfad.split('/').pop() ?? file.name;
      const deutung = await window.mmc.ocr.deutungAusOcr(ocr, verwahrterName);

      // 4. Vorschlag erstellen
      const proposalId = `deutung-${Date.now()}`;
      await window.mmc.vault.proposeDeutung(fallId, proposalId, deutung.atoms, deutung.kartentext);

      // 5. Vorschläge neu laden
      await this.ladeVorschlaege();
      this.zustand = 'fragend';
      this.renderZustand();

      this.showToast(
        deutung.zweifel && deutung.atoms.length === 0
          ? 'Eingang verwahrt — ich finde keine Beträge.'
          : `Eingang verarbeitet: ${deutung.atoms.length} Beträge erkannt.`
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

    await this.renderGitchainZeile(liste);
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

      if (erzaehlung.length === 0) {
        const hinweis = document.createElement('div');
        hinweis.className = 't13 sub';
        hinweis.textContent = 'Noch keine Einträge in diesem Fall.';
        container.appendChild(hinweis);
        return;
      }

      // Erzählung als Sätze
      for (const satz of erzaehlung) {
        const item = document.createElement('div');
        item.style.cssText = 'margin-bottom: 20px;';

        const satzEl = document.createElement('div');
        satzEl.className = 'serif';
        satzEl.style.fontSize = '21px'; // Serifen-Skala: 34/30/28/22/21
        satzEl.style.lineHeight = '1.6';
        satzEl.textContent = satz.satz;
        item.appendChild(satzEl);

        // Aufklappbare Quellzeile
        const details = document.createElement('details');
        details.style.marginTop = '6px';

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

        item.appendChild(details);
        container.appendChild(item);
      }

      // Zurück-Button
      const btnZurueck = document.createElement('button');
      btnZurueck.textContent = 'Zurück';
      btnZurueck.className = 'pill-still';
      btnZurueck.style.marginTop = '24px';
      btnZurueck.onclick = () => {
        this.zustand = this.karten.length > 0 ? 'fragend' : 'ruhig';
        this.renderZustand();
      };
      container.appendChild(btnZurueck);
    } catch (err) {
      console.error('Fehler beim Laden der Erzählung:', err);
      const fehlerEl = document.createElement('div');
      fehlerEl.className = 't13';
      fehlerEl.style.color = '#9c6a63';
      fehlerEl.textContent = `Fehler: ${(err as Error).message || err}`;
      container.appendChild(fehlerEl);
    }
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
