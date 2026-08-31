/**
 * siegelmenue.ts — Die Unterschrift oben rechts ist der Menü-Eingang.
 *
 * Klick auf das runde Olivgold-Siegel (oben rechts) öffnet ein
 * stilles Overlay: weiße Karte, Serifen-Einträge, Untertitel in
 * Sans 13 mit Mono-Zählern. NIE ein Badge, nie rot.
 *
 * Auf-/Zumachen: 300ms fade (eine Bedeutung: da / weg).
 */

import { navigate, screensFuerBereich, type AppCtx, type SiegelBereich, type ScreenId } from './router.js';

interface MenueEintrag {
  bereich: SiegelBereich;
  ziel: ScreenId;
  titel: string;
  untertitel?: (ctx: AppCtx) => string;
}

/** Die Bereiche — Reihenfolge = Lesefluss, Anrufe & Themen wie gewünscht vom Siegel aus. */
const EINTRAEGE: MenueEintrag[] = [
  { bereich: 'heute',      ziel: 'heute',          titel: 'Heute' },
  { bereich: 'faelle',     ziel: 'fall-strom',     titel: 'Fälle',
    untertitel: (c) => c.faelle?.length ? `${c.faelle.length} Fall${c.faelle.length === 1 ? '' : 'fälle'}` : '' },
  { bereich: 'anrufe-texte', ziel: 'anruf-kommt',  titel: 'Anrufe & Texte' },
  { bereich: 'themen',     ziel: 'stapel',         titel: 'Themen' },
  { bereich: 'leseplatz-tisch', ziel: 'leseplatz', titel: 'Leseplatz & Tisch' },
  { bereich: 'leute',      ziel: 'freund',         titel: 'Leute' },
  { bereich: 'kontakte',   ziel: 'kontakte',       titel: 'Kontakte' },
  { bereich: 'suche',      ziel: 'suche',          titel: 'Frag alles' },
  { bereich: 'meister',    ziel: 'meister-seite',  titel: 'Meister-Seite' },
  { bereich: 'auth',       ziel: 'auth-anmeldung', titel: 'Anmeldung' },
];

export class SiegelMenue {
  private overlay: HTMLElement | null = null;

  constructor(private ctx: () => AppCtx) {}

  /** Hängt das Siegel + Overlay-Verhalten an den bestehenden Siegel-Button. */
  oeffnen(siegelEl: HTMLElement | null): void {
    if (!siegelEl || this.overlay) return;
    const ov = this.baueOverlay();
    document.body.appendChild(ov);
    this.overlay = ov;
    siegelEl.addEventListener('click', () => this.umschalten());
  }

  private umschalten(): void {
    const ov = this.overlay;
    if (!ov) return;
    const offen = ov.classList.contains('offen');
    if (offen) this.schliessen();
    else {
      this.aktualisiereZaehler();
      ov.classList.add('offen');
      requestAnimationFrame(() => ov.classList.add('sichtbar'));
    }
  }

  schliessen(): void {
    const ov = this.overlay;
    if (!ov) return;
    ov.classList.remove('sichtbar');
    setTimeout(() => ov.classList.remove('offen'), 300); // --os-motion-max
  }

  private aktualisiereZaehler(): void {
    const ctx = this.ctx();
    for (const e of EINTRAEGE) {
      const el = this.overlay?.querySelector<HTMLElement>(`[data-bereich="${e.bereich}"] .menue-untertitel`);
      if (el) el.textContent = e.untertitel?.(ctx) ?? '';
    }
  }

  private baueOverlay(): HTMLElement {
    const ov = document.createElement('div');
    ov.className = 'siegel-overlay';

    const karte = document.createElement('div');
    karte.className = 'siegel-menue-karte';
    karte.setAttribute('role', 'menu');

    const titel = document.createElement('div');
    titel.className = 'siegel-menue-titel serif';
    titel.textContent = 'Menü';
    karte.appendChild(titel);

    for (const e of EINTRAEGE) {
      const btn = document.createElement('button');
      btn.className = 'siegel-menue-eintrag';
      btn.setAttribute('data-bereich', e.bereich);
      btn.setAttribute('role', 'menuitem');

      const name = document.createElement('span');
      name.className = 'serif menue-name';
      name.textContent = e.titel;

      const unter = document.createElement('span');
      unter.className = 'menue-untertitel';
      unter.textContent = e.untertitel?.(this.ctx()) ?? '';

      btn.appendChild(name);
      btn.appendChild(unter);
      btn.addEventListener('click', () => {
        this.schliessen();
        navigate(e.ziel, this.ctx());
      });
      karte.appendChild(btn);
    }

    ov.appendChild(karte);
    ov.addEventListener('click', (ev) => {
      if (ev.target === ov) this.schliessen();
    });
    return ov;
  }
}

// CSS wird einmalig injiziert (die App hat eine tokens.css, das Menü
// bringt aber sein eigenes Verhalten mit — Klassen sind menue-lokal).
export function siegelmenueCss(): string {
  return `
.siegel-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(42,37,32,.28);
  display: none; align-items: flex-start; justify-content: flex-end;
  padding: 64px 24px 0 0;
  opacity: 0; transition: opacity 300ms ease-out; /* eine Bedeutung: da / weg */
}
.siegel-overlay.offen { display: flex; }
.siegel-overlay.sichtbar { opacity: 1; }
.siegel-menue-karte {
  background: #fff; border: 1px solid rgba(184,163,105,.22);
  border-radius: var(--os-radius-karte);
  box-shadow: 0 30px 80px -24px rgba(70,58,38,.45);
  min-width: 280px; max-width: 340px; overflow: hidden;
}
.siegel-menue-titel {
  font-size: 21px; padding: 16px 22px 12px;
  border-bottom: 1px solid rgba(184,163,105,.18);
  color: var(--os-tinte);
}
.siegel-menue-eintrag {
  display: flex; width: 100%; justify-content: space-between; align-items: baseline;
  gap: 16px; background: none; border: 0; text-align: left;
  padding: 13px 22px; cursor: pointer;
  border-bottom: 1px solid rgba(184,163,105,.10);
}
.siegel-menue-eintrag:last-child { border-bottom: 0; }
.siegel-menue-eintrag:hover { background: rgba(143,169,143,.08); }
.siegel-menue-eintrag .menue-name {
  font-size: 17px; color: var(--os-tinte); font-weight: 400; /* nie fett */
}
.siegel-menue-eintrag .menue-untertitel {
  font-family: var(--os-mono); font-size: 11px; color: rgba(42,37,32,.55);
}
`;
}
