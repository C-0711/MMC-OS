/**
 * screens-showcase.ts — Der Buderus-Showcase: EIN Screen, der die ganze
 * Enterprise-Welt in gitchain holt.
 *
 * Super simpel (OS-Sprache):
 *   - Ist der Schatz schon da? → Zahl + weiter zu Studio/Frag alles
 *   - Nein? → EIN Knopf „Schatz laden" → Sanduhr → fertig-Zahlen
 *   - Danach: zwei Wege-Knöpfe (Studio bauen / Frag alles) — beide führen
 *     real irgendwohin. Keine Sackgassen.
 */

import type { AppCtx } from './router.js';
import { navigate } from './router.js';
import { kopf } from './screens-onboarding.js';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, klassen?: string, text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (klassen) e.className = klassen;
  if (text !== undefined) e.textContent = text;
  return e;
}

function grundCss(): string {
  return 'width:100%;height:100%;min-height:560px;overflow:hidden;position:relative;display:flex;flex-direction:column;background:var(--os-grund);color:var(--os-tinte)';
}

export async function renderShowcase(container: HTMLElement, ctx: AppCtx): Promise<void> {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();

  const mitte = el('div');
  mitte.style.cssText = 'flex:1;overflow-y:auto;padding:8px 80px 36px;display:flex;flex-direction:column;align-items:center;gap:16px;';

  mitte.append(
    el('div', 'serif t28', 'Buderus-Showcase'),
    el('div', 't13 sub', 'Ein Unternehmen lädt seine komplette Buderus-Welt in sein gitchain — Kataloge, Datenblätter, Rechnungen, Verträge, Anrufe.')
  );

  const stand = await window.mmc.showcase.stand().catch(() => ({ geladen: false, dokumente: 0, faelle: [] as string[] }));

  // --- Zustands-Karte ---
  const karte = el('div', 'karte');
  karte.style.cssText = 'text-align:left;width:100%;max-width:560px';

  if (stand.geladen) {
    karte.append(
      el('div', 'serif t17', 'Der Firmenschatz liegt.'),
      el('div', 't13 sub', `${stand.dokumente} Dokumente im Fall buderus-firmenschatz · alles verwahrt, alles unterschrieben`),
    );
    mitte.appendChild(karte);

    // Zwei Wege — beide real
    const wege = el('div');
    wege.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    const frag = el('button', 'pill-salbei', 'Frag alles');
    frag.addEventListener('click', () => navigate('suche', ctx));
    const bau = el('button', 'pill-still', 'Im Studio bauen');
    bau.addEventListener('click', () => navigate('studio', ctx));
    wege.append(frag, bau);
    mitte.appendChild(wege);
  } else {
    karte.append(
      el('div', 'serif t17', 'Der Firmenschatz liegt noch nicht.'),
      el('div', 't13 sub', 'Ein Klick lädt 35 Dokumente — 3 Kataloge, 12 Datenblätter, 8 Rechnungen, 3 Wartungsverträge, 1 Mahnung, 4 Briefe, 3 Anruf-Mitschriften, 1 Angebot. Belege werden zu Karten, Werkstoffe still ins Regal.'),
    );
    mitte.appendChild(karte);

    const lade = el('button', 'pill-salbei', 'Schatz laden');
    lade.style.cssText = 'min-width:200px;';
    mitte.appendChild(lade);

    const ergebnis = el('div', 't13 sub', '');
    mitte.appendChild(ergebnis);

    lade.addEventListener('click', async () => {
      lade.disabled = true;
      ergebnis.textContent = 'Ich lese den Firmenschatz ein — jede Datei byte-identisch, hier auf deinem Gerät.';

      try {
        const erg = await window.mmc.showcase.lade();
        ergebnis.textContent = '';
        // Zustand neu zeichnen (der ganze Screen)
        container.textContent = '';
        await renderShowcase(container, ctx);
        void erg;
      } catch (e) {
        ergebnis.textContent = 'Das Laden ist an einer Stelle hängen geblieben — nichts geht verloren, nochmal versuchen.';
        lade.disabled = false;
        void e;
      }
    });
  }

  gr.append(kopf(), mitte);
  container.appendChild(gr);
}
