/**
 * screens-studio.ts — Das Studio: fragen, wählen, bauen (NotebookAI, Spec 23).
 *
* OS-Sprache, super simpel — drei Schritte auf einem Screen:
*   1. WOFÜR: Themen aus dem eigenen Schatz (ruhige Karten) ODER freie Frage
*   2. WAS: eine der vier Erzeugnis-Formen (Zusammenfassung / Vergleich /
*      Datensammlung / Arbeitsblatt)
*   3. BAUEN → Erzeugnis erscheint im selben Screen, mit [n]-Fundstellen
*
* Jeder Knopf führt irgendwohin: Thema → wählt es, Bauen → Erzeugnis,
* Erzeugnis-Griff → bleibt sichtbar mit Quellen. Keine Sackgassen.
 */

import type { AppCtx } from './router.js';
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

type ErzeugnisArt = 'zusammenfassung' | 'vergleich' | 'datensammlung' | 'arbeitsblatt';

const ARTEN: Array<{ id: ErzeugnisArt; name: string; hinweis: string }> = [
  { id: 'zusammenfassung', name: 'Zusammenfassung', hinweis: 'das Wesentliche als Text' },
  { id: 'vergleich', name: 'Vergleich', hinweis: 'Tabelle: was unterscheidet sich' },
  { id: 'datensammlung', name: 'Datensammlung', hinweis: 'alle Werte je Gerät' },
  { id: 'arbeitsblatt', name: 'Arbeitsblatt', hinweis: 'Checkliste zum Abhaken' },
];

export async function renderStudio(container: HTMLElement, _ctx: AppCtx): Promise<void> {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();

  const mitte = el('div');
  mitte.style.cssText = 'flex:1;overflow-y:auto;padding:8px 80px 36px;display:flex;flex-direction:column;align-items:center;gap:14px;';

  const titel = el('div', 'serif', 'Studio');
  titel.style.fontSize = '28px';
  const untertitel = el('div', 't13 sub', 'Bauen aus deinem Schatz — jede Zeile bewiesen');
  mitte.append(titel, untertitel);

  // --- Schritt 1: Wofür? (Themen aus dem Schatz + freie Frage) ---
  const wofuerBox = el('div', 'karte');
  wofuerBox.style.cssText = 'text-align:left;width:100%;max-width:640px';
  wofuerBox.appendChild(el('div', 'trenner', 'wofür'));

  let themen: Array<{ name: string; anzahlQuellen: number; beispiele: string[] }> = [];
  try {
    themen = await window.mmc.studio.themen();
  } catch { /* leer ok */ }

  const gewaehlt = { thema: '' };

  if (themen.length === 0) {
    wofuerBox.appendChild(el('div', 't13 sub',
      'Noch nichts im Schatz — wirf Dokumente ein, dann stehen hier deine Themen.'));
  }
  for (const t of themen.slice(0, 6)) {
    const chip = el('button', 'pill-still', t.name);
    chip.style.cssText = 'margin:4px 6px 0 0;min-height:36px;font-size:13px;';
    chip.addEventListener('click', () => {
      gewaehlt.thema = t.name;
      // Auswahl sichtbar machen: gewählter Chip bekommt Salbei-Grund
      wofuerBox.querySelectorAll('button').forEach(b => {
        (b as HTMLElement).style.background = 'rgba(143,169,143,.14)';
      });
      chip.style.background = 'var(--os-salbei)';
      chip.style.color = '#fff';
    });
    wofuerBox.appendChild(chip);
  }

  // Freie Frage daneben
  const fragZeile = el('div', 'frag');
  fragZeile.style.cssText = 'width:100%;max-width:640px;margin-top:12px';
  const input = el('input') as HTMLInputElement;
  input.placeholder = 'Oder schreib selbst, wofür (z. B. „GB142 gegen GB192 im Wartungsfall“)';
  input.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
  fragZeile.appendChild(input);
  wofuerBox.appendChild(fragZeile);
  input.addEventListener('input', () => { gewaehlt.thema = input.value; });

  mitte.appendChild(wofuerBox);

  // --- Schritt 2: Was? (vier Formen) ---
  const wasBox = el('div', 'karte');
  wasBox.style.cssText = 'text-align:left;width:100%;max-width:640px';
  wasBox.appendChild(el('div', 'trenner', 'was entsteht'));

  let gewaehlteArt: ErzeugnisArt = 'zusammenfassung';
  for (const a of ARTEN) {
    const chip = el('button', 'pill-still', a.name);
    chip.title = a.hinweis;
    chip.style.cssText = 'margin:4px 6px 0 0;min-height:36px;font-size:13px;';
    if (a.id === gewaehlteArt) {
      chip.style.background = 'var(--os-salbei)';
      chip.style.color = '#fff';
    }
    chip.addEventListener('click', () => {
      gewaehlteArt = a.id;
      wasBox.querySelectorAll('button').forEach(b => {
        (b as HTMLElement).style.background = 'rgba(143,169,143,.14)';
        (b as HTMLElement).style.color = '#5c705c';
      });
      chip.style.background = 'var(--os-salbei)';
      chip.style.color = '#fff';
    });
    wasBox.appendChild(chip);
  }
  mitte.appendChild(wasBox);

  // --- Schritt 3: Bauen ---
  const bauKnopf = el('button', 'pill-salbei', 'Bauen');
  bauKnopf.style.cssText = 'min-width:180px;';
  mitte.appendChild(bauKnopf);

  // --- Ergebnis-Fläche ---
  const ergebnisBox = el('div');
  ergebnisBox.style.cssText = 'width:100%;max-width:640px;display:flex;flex-direction:column;gap:12px;';

  const zeigeFehler = (satz: string) => {
    ergebnisBox.textContent = '';
    const k = el('div', 'karte');
    k.style.cssText = 'text-align:left';
    k.appendChild(el('div', 't15', satz));
    k.appendChild(el('div', 't11 sub', 'dein schatz bleibt vollständig bei dir · später nochmal versuchen'));
    ergebnisBox.appendChild(k);
  };

  bauKnopf.addEventListener('click', async () => {
    const thema = gewaehlt.thema.trim();
    if (!thema) {
      zeigeFehler('Wofür soll ich bauen? Wähle ein Thema oder schreib eines.');
      return;
    }
    // Bauen-Sanduhr (still, W1a-Geist)
    ergebnisBox.textContent = '';
    const warten = el('div', 't13 sub', `Ich baue aus deinem Schatz — ${thema}`);
    ergebnisBox.appendChild(warten);

    try {
      const erg = await window.mmc.studio.baue(gewaehlteArt, thema);
      ergebnisBox.textContent = '';

      // Das Erzeugnis: Form-5-Ding — Titel + Inhalt + Quellen + EIN Griff
      const ding = el('div', 'karte');
      ding.style.cssText = 'text-align:left;';
      ding.appendChild(el('div', 'serif t17', erg.titel));
      const artName = ARTEN.find(a => a.id === erg.art)?.name ?? erg.art;
      ding.appendChild(el('div', 't11 sub', `${artName} · gebaut aus ${erg.quellen.length} Fundstellen`));

      const inhalt = el('div', 't13');
      inhalt.style.cssText = 'white-space:pre-wrap;margin-top:10px;line-height:1.6;';
      inhalt.textContent = erg.inhalt;
      ding.appendChild(inhalt);

      const quellen = el('div', 'quellzeile t11');
      quellen.style.marginTop = '10px';
      quellen.textContent = erg.quellen.slice(0, 3).join(' · ') + (erg.quellen.length > 3 ? ' …' : '');
      ding.appendChild(quellen);

      ergebnisBox.appendChild(ding);
      ergebnisBox.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      zeigeFehler('Der Denker antwortet gerade nicht — das Erzeugnis entsteht später.');
      void e;
    }
  });

  mitte.appendChild(ergebnisBox);
  gr.append(kopf(), mitte);
  container.appendChild(gr);
}
