/**
 * screens-fall-strom.ts — Der Fall als Chat (AUFTRAG-der-fall §3/§4).
 *
 * Der Strom als Dokument: Neues entsteht unten, die Geschichte wohnt
 * oberhalb, Auto-Scroll nur wenn der Nutzer unten war (§4 Fließverhalten).
 *
 * Sechs Formen (§4, pixelgleich gegen FallStromFormen.dc.html):
 *   1 Blase — NUR gesprochenes/geschriebenes Wort. du=Salbei-Ton rechts,
 *     sie=weiß links; max 480px.
 *   2 Stille Arbeit — EINE Zeile, aufklappbar (Form folgt in §9.5)
 *   3 Frage-&-Antwort-Paar — Frage sub, Antwort Tinte mit [n] (§9.5)
 *   4 Vorschlags-Zeile — Glyph + Satz + Machen (§9.5)
 *   5 Ding mit Handgriff — EIN Knopf (Öffnen, Salbei), Zweitwege hinter ⌄
 *   6 Wurf mit Vorschau — Thumbnails VOR dem Satz, Wurf+Wort = EIN Commit
 *
 * Stille Fußzeile je Eintrag: Beweis/Teilen/Vorlesen als Haarlinien-Glyphs,
 * sichtbar erst beim Verweilen; Zeit in Mono.
 *
 * Schritt 2 nach §9: Formen 1/5/6 live auf dem LiveStore-Stand.
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

function mono(text: string): HTMLElement {
  return el('div', 'quellzeile t11', text);
}

function zeitKurz(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' :
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Form 1 · Blase — NUR gesprochenes/geschriebenes Wort
// ---------------------------------------------------------------------------

function formBlase(von: string, inhalt: string, zeitIso: string): HTMLElement {
  const du = von === 'Du';
  const reihe = el('div');
  reihe.style.cssText = `display:flex;justify-content:${du ? 'flex-end' : 'flex-start'};padding:3px 0;`;

  const blase = el('div');
  blase.style.cssText = `
    max-width:480px;padding:10px 16px;border-radius:16px;font-size:15px;line-height:1.5;
    ${du
      ? 'background:rgba(143,169,143,.18);color:#2a2520;border-bottom-right-radius:4px;'
      : 'background:#fff;color:#2a2520;border:1px solid rgba(184,163,105,.15);border-bottom-left-radius:4px;'}
    box-shadow:0 4px 14px -8px rgba(90,75,50,.2);`;

  const zeile = el('div', '', inhalt);
  blase.appendChild(zeile);
  const fuss = el('div', 't11 sub', zeitKurz(zeitIso));
  fuss.style.cssText = 'margin-top:4px;text-align:right;';
  blase.appendChild(fuss);

  reihe.appendChild(blase);
  return reihe;
}

// ---------------------------------------------------------------------------
// Form 5 · Ding mit Handgriff — EIN Knopf, Zweitwege hinter ⌄
// ---------------------------------------------------------------------------

function formDing(name: string, zeitIso: string): HTMLElement {
  const reihe = el('div');
  reihe.style.cssText = 'display:flex;justify-content:flex-start;padding:3px 0;';

  const ding = el('div');
  ding.style.cssText = `
    max-width:480px;width:100%;background:#fff;border:1px solid rgba(184,163,105,.2);
    border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:14px;
    box-shadow:0 4px 14px -8px rgba(90,75,50,.2);`;

  const glyph = el('div', 'serif', '◈');
  glyph.style.cssText = 'font-size:22px;color:var(--os-olivgold);flex:none;';
  const mitte = el('div');
  mitte.style.flex = '1';
  mitte.append(
    el('div', 't15', name),
    mono(zeitKurz(zeitIso) + ' · ding · hineingelegt = mitgeteilt')
  );
  const oeffnen = el('button', 'pill-salbei', 'Öffnen');
  oeffnen.style.cssText = 'min-height:36px;padding:0 18px;font-size:13px;';
  const zweite = el('button', 'btn-ghost', '⌄');
  zweite.style.fontSize = '13px';
  ding.append(glyph, mitte, oeffnen, zweite);

  reihe.appendChild(ding);
  return reihe;
}

// ---------------------------------------------------------------------------
// Form 6 · Wurf mit Vorschau — Thumbnails VOR dem Satz, EIN Commit
// ---------------------------------------------------------------------------

function formWurf(von: string, inhalt: string, dateien: string[], zeitIso: string): HTMLElement {
  const du = von === 'Du';
  const reihe = el('div');
  reihe.style.cssText = `display:flex;justify-content:${du ? 'flex-end' : 'flex-start'};padding:3px 0;`;

  const wurf = el('div');
  wurf.style.cssText = `
    max-width:480px;background:${du ? 'rgba(143,169,143,.14)' : '#fff'};
    border:1px solid rgba(184,163,105,.15);border-radius:12px;padding:12px;
    box-shadow:0 4px 14px -8px rgba(90,75,50,.2);`;

  // Thumbnails klein VOR dem Satz
  if (dateien.length > 0) {
    const daumen = el('div');
    daumen.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
    for (const _d of dateien.slice(0, 3)) {
      const t = el('div');
      t.style.cssText = `
        width:52px;height:52px;border-radius:8px;flex:none;
        background:linear-gradient(135deg, #e9e0d0, #d9cdb8);
        border:1px solid rgba(184,163,105,.3);
        display:flex;align-items:center;justify-content:center;
        font-size:20px;color:var(--os-olivgold);`;
      t.textContent = '▤';
      daumen.appendChild(t);
    }
    wurf.appendChild(daumen);
  }
  wurf.appendChild(el('div', 't15', inhalt));
  wurf.appendChild(mono(zeitKurz(zeitIso) + ' · wurf · eingang byte-identisch committet vor deutung'));
  reihe.appendChild(wurf);
  return reihe;
}

// ---------------------------------------------------------------------------
// Der Strom-Screen (Formen-Mapping: typ → Form)
// ---------------------------------------------------------------------------

function formFuer(e: { typ: string; inhalt: string; von: string; zeitIso: string }): HTMLElement {
  switch (e.typ) {
    case 'ding':
      return formDing(e.inhalt, e.zeitIso);
    case 'wurf': {
      // payload.dateien aus dem JSON — listeStrom trägt sie nicht im Subject;
      // wir zeigen den Satz, die Daumen kommen aus dem Commit-Body (v0.1: aus inhalt)
      return formWurf(e.von, e.inhalt, [], e.zeitIso);
    }
    default:
      return formBlase(e.von, e.inhalt, e.zeitIso);
  }
}

export async function renderFallStrom(container: HTMLElement, ctx: AppCtx): Promise<void> {
  const fallId = ctx.fallId ?? ctx.faelle?.[0]?.id;
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();

  const kopfzeile = el('div');
  kopfzeile.style.cssText = 'flex:none;display:flex;align-items:center;padding:10px 16px;gap:12px;';
  const titel = el('div', 'serif t15', fallId ?? 'Fall');
  const hinweis = el('div', 't11 sub', 'hineinlegen ist mitteilen · der Strom ist die Akte');
  kopfzeile.append(titel, hinweis);

  // Der Strom als Dokument: scrollt, Geschichte oberhalb
  const stromBox = el('div');
  stromBox.style.cssText = 'flex:1;overflow-y:auto;padding:8px 20px 130px;display:flex;flex-direction:column;';

  // Wurf-Platz unten (fixiert) — hier entsteht Neues
  const wurfPlatz = el('div');
  wurfPlatz.style.cssText = `
    position:absolute;bottom:0;left:0;right:0;padding:14px 20px 20px;
    background:linear-gradient(to top, var(--os-grund) 60%, transparent);`;
  const frag = el('div', 'frag');
  frag.style.cssText = 'width:100%;max-width:720px;margin:0 auto;';
  const input = el('input') as HTMLInputElement;
  input.placeholder = 'Schreib in den Strom — jede Zeile ein Commit.';
  input.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
  const senden = el('button', 'pill-salbei', 'Hineinlegen');
  frag.append(input, senden);
  wurfPlatz.appendChild(frag);

  const zeichne = async () => {
    stromBox.textContent = '';
    if (!fallId) {
      stromBox.appendChild(el('div', 't13 sub', 'Kein Fall gewählt — der Strom braucht seinen Container.'));
      return;
    }
    let eintraege: Array<{ typ: string; inhalt: string; von: string; zeitIso: string; nummer: number }> = [];
    try {
      eintraege = await window.mmc.strom.liste(fallId);
    } catch { /* still */ }
    if (eintraege.length === 0) {
      stromBox.appendChild(el('div', 't13 sub',
        'Noch nichts im Strom — die erste Zeile beginnt das Gespräch.'));
    }
    // War der Nutzer unten? (Auto-Scroll nur dann — §4)
    const warUnten = stromBox.scrollHeight - stromBox.scrollTop - stromBox.clientHeight < 80;
    for (const e of eintraege) {
      stromBox.appendChild(formFuer(e));
    }
    if (warUnten) stromBox.scrollTop = stromBox.scrollHeight;
  };

  const legeHin = async () => {
    const text = input.value.trim();
    if (!text || !fallId) return;
    try {
      await window.mmc.strom.eintrag(fallId, { typ: 'text', inhalt: text, von: 'Du' });
      input.value = '';
      await zeichne();
    } catch { /* still */ }
  };
  senden.addEventListener('click', legeHin);
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') legeHin(); });

  gr.append(kopf(), kopfzeile, stromBox, wurfPlatz);
  container.appendChild(gr);
  await zeichne();
}
