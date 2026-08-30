/**
 * app.ts — UI-Shell State-Machine
 *
 * Drei Zustände: ruhig | fragend | antwortend
 */

type AppZustand = 'ruhig' | 'fragend' | 'antwortend';

interface Karte {
  id: string;
  typ: 'warn' | 'info';
  titel: string;
  frage: string;
  beweisLabel?: string;
  fussnote: string;
}

class App {
  private zustand: AppZustand = 'ruhig';
  private karten: Karte[] = [];

  constructor() {
    this.init();
  }

  private init(): void {
    this.renderBegruessung();
    this.renderZustand();
    this.setupFragMich();

    // Demo: EINE Beispielkarte anzeigen (Zustand "fragend")
    this.demoKarte();
  }

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

  private renderZustand(): void {
    const zustandEl = document.getElementById('zustand-text');
    const kartenEl = document.getElementById('karten-container');
    const ruhigEl = document.getElementById('alles-ruhig');
    const dialogEl = document.getElementById('dialog-container');

    if (!zustandEl || !kartenEl || !ruhigEl || !dialogEl) return;

    // Zustand-Anzeige oben rechts
    if (this.zustand === 'ruhig') {
      zustandEl.textContent = 'heute · alles ruhig';
      ruhigEl.style.display = 'block';
      kartenEl.style.display = 'none';
      dialogEl.style.display = 'none';
    } else if (this.zustand === 'fragend') {
      const anzahl = this.karten.length;
      zustandEl.textContent = `heute · ${anzahl} ${anzahl === 1 ? 'offen' : 'offen'}`;
      ruhigEl.style.display = 'none';
      kartenEl.style.display = 'block';
      dialogEl.style.display = 'none';
      this.renderKarten();
    } else if (this.zustand === 'antwortend') {
      zustandEl.textContent = 'heute · frag-mich';
      ruhigEl.style.display = 'none';
      kartenEl.style.display = 'none';
      dialogEl.style.display = 'block';
    }
  }

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
    div.className = `karte ${karte.typ}`;
    div.innerHTML = `
      <h3>${karte.titel}</h3>
      <p>${karte.frage}</p>
      ${karte.beweisLabel ? `<div class="beweis-link">${karte.beweisLabel}</div>` : ''}
      <details class="fussnote">
        <summary class="quelle">▸ Fundstelle</summary>
        <p class="quelle" style="margin-top: 8px; padding-left: 12px;">${karte.fussnote}</p>
      </details>
      <div class="btn-row">
        <button class="btn-primary" data-action="ja" data-id="${karte.id}">Ja</button>
        <button class="btn-secondary" data-action="spaeter" data-id="${karte.id}">Später</button>
        <button class="btn-ghost" data-action="nein" data-id="${karte.id}">Nein</button>
      </div>
    `;

    // Button-Handler
    div.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (action && id) {
          this.handleKarteEntscheidung(id, action);
        }
      });
    });

    return div;
  }

  private handleKarteEntscheidung(id: string, action: string): void {
    console.log(`Karte ${id}: ${action}`);

    // Karte entfernen
    this.karten = this.karten.filter(k => k.id !== id);

    // Zustand aktualisieren
    if (this.karten.length === 0) {
      this.zustand = 'ruhig';
    }

    this.renderZustand();
    this.showToast(
      action === 'ja' ? 'Erledigt' :
      action === 'spaeter' ? 'Später — die Karte kehrt zurück' :
      'Abgelehnt'
    );
  }

  private setupFragMich(): void {
    const toggle = document.getElementById('frag-mich-toggle');
    const eingabe = document.getElementById('frag-mich-eingabe') as HTMLInputElement;
    const senden = document.getElementById('frag-mich-senden');

    if (toggle) {
      toggle.addEventListener('click', () => {
        this.zustand = this.zustand === 'antwortend' ? 'ruhig' : 'antwortend';
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

  private handleFrage(frage: string): void {
    const log = document.getElementById('dialog-log');
    if (!log) return;

    // Frage anzeigen
    const frageEl = document.createElement('div');
    frageEl.className = 'frage';
    frageEl.textContent = frage;
    log.appendChild(frageEl);

    // Placeholder-Antwort (wird in Etappe 3 gegen vLLM ersetzt)
    const antwortEl = document.createElement('div');
    antwortEl.className = 'antwort';
    antwortEl.innerHTML = `
      <p>Dazu habe ich noch keine Antwort — die Frag-mich-Logik wird in Etappe 3 mit vLLM verbunden.</p>
      <p class="quelle" style="margin-top: 8px;">TODO: window.mmc.llm.ask() aufrufen</p>
    `;
    log.appendChild(antwortEl);

    log.scrollTop = log.scrollHeight;
  }

  private showToast(msg: string): void {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.classList.add('sichtbar');
    setTimeout(() => toast.classList.remove('sichtbar'), 2400);
  }

  private demoKarte(): void {
    // Eine Demo-Karte, damit man den Zustand "fragend" sieht
    this.karten = [
      {
        id: 'demo-1',
        typ: 'warn',
        titel: 'Umsatzsteuer-Voranmeldung Q3',
        frage: 'Soll ich die USt machen? Sie ist in 2 Tagen fällig.',
        beweisLabel: '12 Belege · 4 offen',
        fussnote: 'fall: steuern-2026 · doc: fristen/ust-q3.ics · seite: 1 · commit: a41f · sig ✓'
      }
    ];
    this.zustand = 'fragend';
    this.renderZustand();
  }
}

// App starten, sobald DOM bereit
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}
