/**
 * screens-kontakte.ts — Kontakte & Kontakt-Detail (Spec 21).
 *
 * Kontakte-Liste: ruhige Karten, Serif-Name, Mono-Fußnote, Anlegen als
 * Textlink. Kontakt-Detail: fortlaufender Verlauf (Anrufe/Texte/Dateien
 * gemischt nach Zeit, jede Zeile mit Quelle), Text-Eingabe unten → Commit.
 *
 * Regeln: kein Tab nach Typ (Inhalt statt Verordnung), nie rot, Serif 400,
 * Issuing ohne Rückfrage.
 */

import type { AppCtx } from './router.js';
import { kopf } from './screens-onboarding.js';
import { anrufLive } from './screens-os.js';
import { navigate } from './router.js';

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

function quelle(text: string): HTMLElement {
  return el('div', 'quellzeile t11', text);
}

function datumKurz(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Kontakte — die Liste
// ---------------------------------------------------------------------------

interface KontaktKarte {
  slug: string;
  name: string;
  aktivitaet: number;
  letzterEintragIso: string | null;
}

export async function renderKontakteListe(container: HTMLElement): Promise<void> {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const mitte = el('div');
  mitte.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 80px 36px;overflow:auto';

  const titel = el('div', 'serif', 'Kontakte');
  titel.style.fontSize = '28px';
  mitte.appendChild(titel);

  // Anlegen als Textlink (kein Formular-Zwang — Issuing kommt vom Leben)
  const anlegen = el('div', 'frag');
  anlegen.style.cssText = 'width:100%;max-width:560px';
  const input = el('input') as HTMLInputElement;
  input.placeholder = 'Wen suchst du? Neuer Kontakt entsteht mit dem ersten Wort.';
  input.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
  const knopf = el('button', 'pill-still', 'Anlegen');
  anlegen.append(input, knopf);
  mitte.appendChild(anlegen);

  knopf.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return;
    try {
      await window.mmc.kontakte.create(name);
      input.value = '';
      // Liste neu zeichnen
      container.textContent = '';
      await renderKontakteListe(container);
    } catch { /* still */ }
  });

  // Die Liste
  let kontakte: KontaktKarte[] = [];
  try {
    kontakte = await window.mmc.kontakte.list();
  } catch { /* leer ist gültig */ }

  if (kontakte.length === 0) {
    mitte.appendChild(el('div', 't13 sub',
      'Noch keine Kontakte — sie entstehen mit der ersten Kommunikation, automatisch.'));
  }
  for (const k of kontakte) {
    const karte = el('div', 'karte karte-tipp');
    karte.style.cssText = 'text-align:left;width:100%;max-width:560px;cursor:pointer';
    karte.append(
      el('div', 'serif t17', k.name),
      el('div', 't13 sub', `${k.aktivitaet} Einträge im Verlauf${k.letzterEintragIso ? ' · zuletzt ' + datumKurz(k.letzterEintragIso) : ''}`)
    );
    karte.appendChild(quelle(`kontakt-${k.slug} · container · signatur ✓`));
    karte.addEventListener('click', () => zeigeDetail(container, k.slug, k.name));
    mitte.appendChild(karte);
  }

  gr.append(kopf(), mitte);
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// Kontakt-Detail — der fortlaufende Verlauf
// ---------------------------------------------------------------------------

async function zeigeDetail(container: HTMLElement, slug: string, name: string): Promise<void> {
  container.textContent = '';
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const mitte = el('div');
  mitte.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:14px;padding:8px 80px 36px;overflow:auto';

  mitte.append(
    el('div', 'serif t28', name),
    el('div', 't11 sub', `kontakt-${slug} · alles in einem Verlauf`)
  );

  // Anrufen — Klon zu Klon aus dem Verlauf heraus (Spec 21 Kreis-Schluss)
  const rufKnopf = el('button', 'pill-salbei', 'Anrufen');
  rufKnopf.addEventListener('click', async () => {
    try {
      await anrufLive.anrufen(name);
      navigate('anruf-laeuft');
    } catch {
      mitte.appendChild(el('div', 't13 sub',
        'Der Anruf kam nicht zustande — kein PAT oder die Registry antwortet nicht.'));
    }
  });
  mitte.appendChild(rufKnopf);

  // Verlauf: Anrufe, Texte, Dateien — gemischt nach Zeit (neueste oben)
  let eintraege: Array<{ zeitIso: string; typ: string; zusammenfassung: string; quelle: string }> = [];
  try {
    eintraege = await window.mmc.kontakte.historie(slug);
  } catch { /* leer */ }

  if (eintraege.length === 0) {
    mitte.appendChild(el('div', 't13 sub', 'Noch nichts ausgetauscht — der erste Anruf oder Text öffnet den Verlauf.'));
  }
  for (const e of eintraege) {
    const zeile = el('div', 'karte');
    zeile.style.cssText = 'text-align:left;width:100%;max-width:560px;padding:14px 20px';
    const icon = e.typ === 'anruf' ? 'Anruf · ' : e.typ === 'text' ? 'Text · ' : e.typ === 'datei' ? 'Datei · ' : '';
    zeile.append(
      el('div', 't13 sub', `${datumKurz(e.zeitIso)} · ${icon}${e.zusammenfassung}`),
      quelle(e.quelle)
    );
    mitte.appendChild(zeile);
  }

  // Text senden — Nachricht = Commit
  const senden = el('div', 'frag');
  senden.style.cssText = 'width:100%;max-width:560px;position:sticky;bottom:12px';
  const textInput = el('input') as HTMLInputElement;
  textInput.placeholder = 'Schreib etwas — Nachricht wird Committen im Verlauf.';
  textInput.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
  const send = el('button', 'pill-salbei', 'Senden');
  senden.append(textInput, send);
  const schicken = async () => {
    const text = textInput.value.trim();
    if (!text) return;
    try {
      await window.mmc.kontakte.commText(slug, text, 'Du');
      textInput.value = '';
      zeigeDetail(container, slug, name); // Verlauf neu
    } catch { /* still */ }
  };
  send.addEventListener('click', schicken);
  textInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') schicken(); });
  mitte.appendChild(senden);

  // Zurück
  const zurueck = el('button', 'btn-ghost', '← Kontakte');
  zurueck.addEventListener('click', () => { container.textContent = ''; void renderKontakteListe(container); });
  mitte.appendChild(zurueck);

  gr.append(kopf(), mitte);
  container.appendChild(gr);
}
