/**
 * screens-os.ts — Die OS-Sprache: 30 Screens des Alltags (page-7).
 *
 * Wortgleich zu den Canvas-Artboards. jeder Screen:
 * Kopf (Siegel rechts) — Inhalt (Karten, Serif, Quellzeilen) — Fuß.
 *
 * Regeln: Beweis-Rechteck = .mark-beweis (Rosé), Lesung = .mark-lese (Salbei),
 * Quellzeile Mono 11, Serif 400 nie fett, Bewegung max 300ms.
 */

import type { AppCtx } from './router.js';
import { navigate } from './router.js';
import { kopf } from './screens-onboarding.js';
import { AnrufLive } from './anruf-live-renderer.js';

/** Die eine Live-Instanz — Anruf-Kommt und Anruf-Läuft teilen sie. */
export const anrufLive = new AnrufLive();

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

function buehne(...kinder: HTMLElement[]): HTMLElement {
  const w = el('div');
  w.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 80px 36px;overflow:auto';
  for (const k of kinder) w.appendChild(k);
  return w;
}

function fuss(h: number = 36): HTMLElement {
  const f = el('div');
  f.style.height = `${h}px`;
  return f;
}

function titelSerif(text: string, px = 30): HTMLElement {
  const t = el('div', 'serif', text);
  t.style.fontSize = `${px}px`;
  return t;
}

function quelle(text: string): HTMLElement {
  return el('div', 'quellzeile t11', text);
}

function knoepfe(...k: [string, string, (() => void)?][]): HTMLElement {
  const w = el('div');
  w.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
  for (const [text, klasse, fn] of k) {
    const b = el('button', klasse, text);
    if (fn) b.addEventListener('click', fn);
    w.appendChild(b);
  }
  return w;
}

/** Beweis-Zeile auf einem Blatt (Rechteck Rosé, zwei Spalten). */
function beweisZeile(links: string, rechts: string): HTMLElement {
  const z = el('div');
  z.style.cssText = 'position:relative;display:flex;justify-content:space-between;font-size:13px;padding:4px 8px;margin:0 -8px';
  const m = el('span', 'mark-beweis');
  m.style.cssText = 'position:absolute;inset:0';
  const l = el('span', 'sub', links);
  const r = el('span', rechts);
  r.style.fontWeight = '600';
  z.append(m, l, r);
  return z;
}

export interface StoreDaten {
  uebersicht?: FallUebersicht;
  anrufe?: AnrufInfo[];
  anrufeAlle?: AnrufInfo[];
  kontakte?: Array<{ slug: string; name: string; aktivitaet: number; letzterEintragIso: string | null }>;
  themen?: ThemaInfo[];
  stapel?: StapelEintrag[];
  neuesThema?: ThemaVorschlag[];
  ingest?: {
    phase: string; fertig: number; total: number; atome: number;
    zusammenfassung: string; namen: string[];
    fragen: Array<{ text: string; atomRef: string }>;
  };
  suche?: {
    frage: string; antwort: string; ehrlich: boolean;
    treffer: Array<{ fall: string; doc: string; seite: number; text: string }>;
  } | null;
  ladeUebersicht?: (fallId: string) => Promise<FallUebersicht | undefined>;
}

// ---------------------------------------------------------------------------
// B1 · OsHeute — die Karte (aus dem LiveStore: echte Ding-Karten)
// ---------------------------------------------------------------------------

export function renderOsHeute(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();

  const d = ((ctx?.daten ?? {}) as StoreDaten)?.uebersicht;
  const stunde = new Date().getHours();
  const gruss = stunde < 12 ? 'Guten Morgen' : stunde < 18 ? 'Guten Tag' : 'Guten Abend';
  const b = buehne(titelSerif(`${gruss}. ${d && d.dinge.length > 0 ? 'Ein Ding wartet.' : 'Alles ruhig.'}`, 30));

  if (d && d.dinge.length > 0) {
    // Die Karte des Tages aus der echten Fall-Übersicht (Tipp → Leseplatz/Beweis)
    for (const ding of d.dinge.slice(0, 3)) {
      const karte = el('div', 'karte karte-tipp');
      karte.style.cssText = 'text-align:left;width:100%;max-width:560px;cursor:pointer';
      karte.append(
        el('div', 'etikett', 'Ein Ding wartet.'),
        el('div', 'serif t17', ding.titel),
        el('div', 't13 sub', ding.frage)
      );
      karte.appendChild(quelle(ding.quelle));
      karte.addEventListener('click', () => navigate('beweis', ctx));
      b.appendChild(karte);
    }
  } else {
    b.appendChild(el('div', 't13 sub',
      'Keine Karte wartet. Dein Assistent liest still weiter — was wichtig wird, liegt dann oben auf.'));
  }

  const rest = (ctx.kartenOffen ?? 0) - (d ? Math.min(d.dinge.length, 3) : 0);
  if (rest > 0) {
    b.appendChild(el('div', 't11 sub', `${rest} weitere Karten liegen still darunter`));
  }

  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B5 · OsAnrufBeweis — die Minute (Beweis für einen Anruf)
// ---------------------------------------------------------------------------

export function renderOsAnrufBeweis(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    titelSerif('Woher weißt du das?', 30),
    el('div', 't13 sub', '„Prelive bleibt bis zum Freigabetermin eingefroren."')
  );
  const blatt = el('div');
  blatt.style.cssText = 'width:560px;background:#fff;border-radius:8px;box-shadow:0 18px 50px -18px rgba(70,58,38,.4);padding:30px 36px;text-align:left';
  blatt.append(
    el('div', 'etikett', 'MITSCHRIFT · ANRUF REVIEW & PLANNING'),
    el('div', 't11 sub', 'Donnerstag, 14:07–15:03 · Du und Stefan')
  );
  const minute = beweisZeile('Minute 27:50 — Stefan:', '„…bleibt eingefroren."');
  blatt.appendChild(minute);
  b.append(blatt, quelle('fall ctax · mitschrift-2026-08-27.md · Minute 27:50 · commit a41c07 · unterschrift ✓'),
    knoepfe(['Stimmt', 'pill-salbei'], ['Original öffnen', 'pill-still'],
      ['Falsch zugeordnet', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B4 · OsFall — CTAX als Fall (Ding-Karte + Erinner-Karte)
// ---------------------------------------------------------------------------

export function renderOsFall(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const d = ((ctx?.daten ?? {}) as StoreDaten)?.uebersicht;
  const fallName = d?.fallId ?? ctx.fallId ?? 'fall';
  const dinge = d?.dinge ?? [];
  const b = buehne(titelSerif(dinge.length > 0 ? `${fallName}. Ein Ding wartet.` : `${fallName}. Alles ruhig.`, 28));

  if (dinge.length === 0) {
    b.appendChild(el('div', 't13 sub', 'Noch keine offenen Karten in diesem Fall — was ankommt, liegt dann oben auf.'));
  }
  for (const ding of dinge.slice(0, 4)) {
    const karte = el('div', 'karte karte-tipp');
    karte.style.cssText = 'text-align:left;width:100%;max-width:560px;cursor:pointer';
    karte.append(
      el('div', 'serif t17', ding.titel),
      el('div', 't13 sub', ding.frage)
    );
    karte.appendChild(quelle(ding.quelle));
    karte.addEventListener('click', () => navigate('beweis', ctx));
    b.appendChild(karte);
  }

  // Protokoll: die letzten Erzähl-Sätze des Falls
  const protokoll = d?.protokoll ?? [];
  if (protokoll.length > 0) {
    const pk = el('div', 'karte');
    pk.style.cssText = 'text-align:left;width:100%;max-width:560px';
    pk.appendChild(el('div', 'trenner', 'der Verlauf'));
    for (const s of protokoll.slice(0, 4)) {
      pk.append(el('div', 't13 sub', s.satz), el('div', 't11 sub', s.commitZeile));
    }
    b.appendChild(pk);
  }
  b.appendChild(el('div', 't11 sub', (d?.beteiligte ?? ['extern']).join(' · ')));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B6 · OsKatalog — der Katalog ohne Ordner (Buderus)
// ---------------------------------------------------------------------------

export function renderOsKatalog(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 'etikett', 'Buderus-Kataloge · Original unverändert · nur du'),
    el('div', 'serif t15', 'Du fragst: „Für welchen Einbau ist der Flügelradzähler PTFB0003 vorgesehen?"')
  );
  const blatt = el('div');
  blatt.style.cssText = 'width:560px;background:#fff;border-radius:8px;box-shadow:0 18px 50px -18px rgba(70,58,38,.4);padding:30px 36px;text-align:left';
  blatt.append(
    el('div', 'etikett', 'FLÜGELRADZÄHLER PTFB0003'),
    el('div', 't11 sub', 'Katalog 2024 · Kapitel 4 · Tabelle 4.2')
  );
  blatt.appendChild(beweisZeile('Einbau:', 'Vertikaler Einbau in Falleitungen.'));
  b.append(blatt,
    quelle('fall kataloge · buderus-2024.pdf · Seite 212 · commit 3fd2 · unterschrift ✓'),
    el('div', 't15', 'Vertikaler Einbau in Falleitungen.'));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B7 · OsUebernahme — der Einwilligungs-Moment (Klon-Annahme)
// ---------------------------------------------------------------------------

export function renderOsUebernahme(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 't13 sub', 'Lena Weber teilt'),
    titelSerif('einen Fall mit dir.', 28)
  );
  const karte = el('div', 'karte');
  karte.style.cssText = 'text-align:left;width:100%;max-width:520px';
  karte.append(
    el('div', 'serif t17', 'Unfall Passat'),
    el('div', 't13 sub', 'Werkstatt Weber · seit heute')
  );
  b.append(karte,
    el('div', 't13 sub',
      'Annehmen heißt: ihr führt denselben Baum. Du bekommst deinen eigenen Klon — er gehört dir und bleibt bei dir, auch wenn ihr euch trennt.'),
    knoepfe(['Annehmen', 'pill-salbei', () => navigate('fall', { fallId: 'unfall-passat' })],
      ['Nicht jetzt', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B8 · OsUebergang — die Brücke nach draußen, geschwärzt
// ---------------------------------------------------------------------------

export function renderOsUebergang(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(titelSerif('Das verlässt gleich das Haus.', 28),
    el('div', 't15', 'Antwort an Dr. Berger — als Mail'),
    el('div', 't13 sub', 'Er hat kein gitchain. Die Brücke übersetzt — der Fall bleibt vollständig bei dir.'));
  const mail = el('div', 'karte');
  mail.style.cssText = 'text-align:left;width:100%;max-width:560px;font-family:var(--os-sans)';
  const s1 = el('div', 't13',
    'Sehr geehrter Herr Dr. Berger, die Freigabe der Versicherung über 2.480,00 € liegt vor. Den Betrag überweisen wir von unserem Konto ████ ████.');
  const s2 = el('div', 't13', 'Mit freundlichen Grüßen · Ihre Werkstatt');
  const geschwaerzt = el('div', 't11 sub', '██████ geschwärzt — 3 Stellen; was draußen ankommt, zeigt weiterhin auf den Fall.');
  mail.append(s1, s2, geschwaerzt);
  b.append(mail, knoepfe(['Senden', 'pill-salbei'], ['Noch ansehen', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B10/B11/B12 · Anruf kommt / läuft / Text
// ---------------------------------------------------------------------------

export function renderOsAnrufKommt(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const daten = (ctx?.daten ?? {}) as StoreDaten;
  // Anrufe über ALLE Fälle (Dogfood-Befund): der Screen zeigt jeden
  // Anruf aus dem Leben — anrufeAlle zuerst, Fall-Liste als Fallback.
  const anrufe = (daten?.anrufeAlle?.length ? daten.anrufeAlle : daten?.anrufe) ?? [];
  const b = buehne(titelSerif('Anrufe', 28));

  // Klon zu Klon: ein Partner anrufen (WebRTC, kein Anbieter dazwischen)
  const wahl = el('div', 'frag');
  wahl.style.cssText = 'width:100%;max-width:560px';
  const nummer = el('input') as HTMLInputElement;
  nummer.placeholder = 'Wen rufst du an? (Klon-Name)';
  nummer.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
  const ruf = el('button', 'pill-salbei', 'Anrufen');
  wahl.append(nummer, ruf);
  const hinweis = el('div', 't11 sub',
    'Klon zu Klon — kein Anbieter dazwischen · Mitschrift mit Minute, bei euch beiden');
  ruf.addEventListener('click', async () => {
    const partner = nummer.value.trim();
    if (!partner) return;
    try {
      await anrufLive.anrufen(partner);
      navigate('anruf-laeuft', ctx);
    } catch {
      b.appendChild(el('div', 't13 sub',
        'Der Anruf kam nicht zustande — kein PAT oder die Registry antwortet nicht. Nichts geht verloren.'));
    }
  });
  b.append(wahl, hinweis);

  if (anrufe.length === 0) {
    b.appendChild(el('div', 't13 sub', 'Noch keine Anrufe in diesem Fall — wenn einer kommt, liegt er hier mit Minute und Sprecher.'));
  }
  for (const a of anrufe.slice(0, 5)) {
    const karte = el('div', 'karte karte-tipp');
    karte.style.cssText = 'text-align:left;width:100%;max-width:560px;cursor:pointer';
    karte.append(
      el('div', 'serif t17', a.partner),
      el('div', 't13 sub', `Mitschrift · Dauer ${a.dauer}`)
    );
    karte.appendChild(quelle(`fall ${a.fallId} · ${a.doc}${a.minuten.length ? ' · Minuten ' + a.minuten.join(', ') : ''} · unterschrift ✓`));
    karte.addEventListener('click', () => navigate('anruf-laeuft'));
    b.appendChild(karte);
  }
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsAnrufLaeuft(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const daten = (ctx?.daten ?? {}) as StoreDaten;
  const anrufe = (daten?.anrufeAlle?.length ? daten.anrufeAlle : daten?.anrufe) ?? [];
  const a = anrufe[0];
  const live = anrufLive.phase === 'laeuft' || anrufLive.phase === 'rufend';

  const b = buehne(
    el('div', 'etikett', live
      ? `Anruf · ${anrufLive.zeilen.length > 0 ? 'live' : 'verbinde'}`
      : a ? `Anruf · ${a.partner}` : 'Anruf'),
    el('div', 'serif t15', live ? 'läuft' : a ? a.dauer : '—')
  );

  const mitschrift = el('div', 'karte');
  mitschrift.style.cssText = 'text-align:left;width:100%;max-width:560px';

  if (live) {
    // Live-Mitschrift aus dem DataChannel (Nachricht = Commit)
    const zeilenBox = el('div');
    const zeichne = () => {
      zeilenBox.textContent = '';
      for (const z of anrufLive.zeilen.slice(-12)) {
        zeilenBox.appendChild(el('div', 't13', `${z.zeit} · ${z.sprecher}: ${z.text}`));
      }
    };
    anrufLive.beimAendern(zeichne);
    zeichne();
    mitschrift.appendChild(zeilenBox);

    // Sende-Feld: sage etwas → bei beiden in der Mitschrift
    const feld = el('div', 'frag');
    feld.style.cssText = 'width:100%';
    const input = el('input') as HTMLInputElement;
    input.placeholder = 'Sagen oder festhalten …';
    input.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
    const send = el('button', 'pill-salbei', 'Sagen');
    feld.append(input, send);
    const schicken = () => {
      const text = input.value.trim();
      if (!text) return;
      anrufLive.sage(text);
      input.value = '';
    };
    send.addEventListener('click', schicken);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') schicken(); });
    mitschrift.appendChild(feld);

    const knopfLeiste = el('div');
    knopfLeiste.style.cssText = 'display:flex;gap:10px';
    const auflegen = el('button', 'pill-rose', 'Auflegen');
    auflegen.addEventListener('click', () => {
      anrufLive.auflegen();
      navigate('anruf-kommt', ctx);
    });
    knopfLeiste.appendChild(auflegen);
    b.appendChild(mitschrift);
    b.appendChild(knopfLeiste);
    b.appendChild(el('div', 't11 sub',
      'Klon zu Klon — die Mitschrift entsteht auf beiden Geräten, kein Anbieter dazwischen.'));
  } else if (a) {
    // Gespeicherte Mitschrift (aus dem Fall)
    for (const z of a.zeilen.slice(0, 12)) {
      const markiert = a.minuten.includes(z.zeit);
      const zeile = el('div', markiert ? 't13' : 't13 sub', `${z.zeit} · ${z.sprecher}: ${z.text}`);
      if (markiert) zeile.style.cssText = 'background:rgba(217,166,160,.08);border-radius:6px;padding:3px 8px;margin:0 -8px';
      mitschrift.appendChild(zeile);
    }
    mitschrift.appendChild(quelle(`fall ${a.fallId} · ${a.doc} · unterschrift ✓`));
    b.appendChild(mitschrift);
  } else {
    b.appendChild(el('div', 't13 sub', 'Noch keine Mitschrift — rufe jemanden an oder wähle im Anrufe-Bereich.'));
  }
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsText(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const daten = (ctx?.daten ?? {}) as StoreDaten;
  const kontakte = daten?.kontakte ?? [];
  const erste = kontakte[0];

  const b = buehne(
    erste ? el('div', 'etikett', `Texte · ${erste.name}`)
         : el('div', 'serif t28', 'Texte')
  );

  if (!erste) {
    b.appendChild(el('div', 't13 sub',
      'Noch keine Texte — sie entstehen mit dem ersten Wort und bleiben im Verlauf des Kontakts.'));
    gr.append(kopf(), b, fuss());
    container.appendChild(gr);
    return;
  }

  // Verlauf des ersten Kontakts: nur Text-Einträge, als Chat dargestellt
  window.mmc.kontakte.historie(erste.slug).then((hist) => {
    const texte = hist.filter(h => h.typ === 'text');
    if (texte.length === 0) {
      b.appendChild(el('div', 't13 sub',
        'Noch nichts geschrieben — Nachricht = Commit, Zitat = Referenz.'));
    }
    for (const t of texte) {
      const msg = el('div', 'karte');
      msg.style.cssText = 'text-align:left;width:100%;max-width:520px';
      msg.append(
        el('div', 't13', t.zusammenfassung),
        quelle(`kontakt-${erste.slug} · ${t.quelle} · ${new Date(t.zeitIso).toLocaleDateString('de-DE')} · unterschrift ✓`)
      );
      b.appendChild(msg);
    }

    // Schreiben — Nachricht = Commit in den Kontakt-Verlauf
    const senden = el('div', 'frag');
    senden.style.cssText = 'width:100%;max-width:520px';
    const input = el('input') as HTMLInputElement;
    input.placeholder = 'Nachricht an den Kontakt — wird committet.';
    input.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
    const send = el('button', 'pill-salbei', 'Senden');
    senden.append(input, send);
    const schicken = async () => {
      const text = input.value.trim();
      if (!text) return;
      await window.mmc.kontakte.commText(erste.slug, text, 'Du').catch(() => {});
      input.value = '';
      navigate('text', ctx); // Screen neu — neuer Commit ist sofort sichtbar
    };
    send.addEventListener("click", schicken);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') schicken(); });
    b.appendChild(senden);
    b.appendChild(el('div', 't11 sub', 'Nachricht = Commit · Zitat = Referenz — beides im Kontakt, bei euch beiden'));
  }).catch(() => {
    b.appendChild(el('div', 't13 sub', 'Der Verlauf ist gerade nicht erreichbar — nichts geht verloren.'));
  });

  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsFreund(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(titelSerif('Anna.', 34),
    el('div', 't13 sub', 'ein Baum, zwei Klone — ihr seht dasselbe'));
  const karte = el('div', 'karte karte-tipp');
  karte.style.cssText = 'text-align:left;width:100%;max-width:520px;cursor:pointer';
  karte.append(
    el('div', 'serif t17', 'Anna schlägt vor: 6.–8. März für die Hütte.'),
    el('div', 't13 sub', 'drei Preise, zwei Zitate aus dem Verlauf'),
    quelle('fall huettenwochenende · mail-verlauf.md · commit 9d21 · unterschrift ✓')
  );
  karte.addEventListener('click', () => navigate('gruppe'));
  b.append(karte, knoepfe(['Zusagen', 'pill-salbei'], ['Anders', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsAusgruendung(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 'serif t28', 'Kurze Frage zur Ordnung.'),
    el('div', 't13 sub', 'Eigener Baum, eigene Kapsel — vier Klone'),
    el('div', 't13 sub', 'Max und Lisa sehen nur die Hütte — nicht euren Baum'),
    el('div', 't13 sub', 'Euer Baum mit Anna bleibt, wie er ist')
  );
  b.append(knoepfe(['Eigene Kapsel anlegen', 'pill-salbei', () => navigate('gruppe')],
    ['Im alten Baum lassen', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B16 · OsLeseplatz — ein Original, die Lesung als Folie
// ---------------------------------------------------------------------------

export function renderOsLeseplatz(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 'etikett', 'Fall versicherungen'),
    titelSerif('Hausratversicherung.pdf', 22),
    el('div', 't11 sub', 'Seite 4 von 12 · unverändert seit Aufnahme')
  );
  const blatt = el('div');
  blatt.style.cssText = 'width:560px;background:#fff;border-radius:8px;box-shadow:0 18px 50px -18px rgba(70,58,38,.4);padding:34px 40px;text-align:left';
  blatt.append(
    el('div', 'etikett', 'HAUSRATVERSICHERUNG — VERSICHERUNGSSCHEIN'),
    el('div', 't11 sub', 'Beispiel Versicherung AG · Vertrag HV-2024-88231 · Seite 4')
  );
  const folie = el('div');
  folie.style.cssText = 'position:relative;padding:6px 10px;margin:10px 0';
  const m = el('span', 'mark-lese');
  m.style.cssText = 'position:absolute;inset:0';
  folie.append(m, el('span', 't13', 'Beitrag 214,80 € jährlich · Selbstbehalt 500 €'));
  blatt.appendChild(folie);
  // C3: das Rechteck steht — nichts slidet herein.
  b.append(blatt,
    quelle('fall versicherungen · hausratversicherung.pdf · Seite 4 · commit 7f3a · unterschrift ✓'),
    knoepfe(['Original öffnen', 'pill-still'], ['Zurück', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B17 · OsTisch — zwei Originale, die Gegenprobe
// ---------------------------------------------------------------------------

export function renderOsTisch(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(el('div', 'etikett', 'Nebeneinander · Unfall Passat'));
  const reihe = el('div');
  reihe.style.cssText = 'display:flex;gap:16px;align-items:flex-start';
  for (const wer of ['Du', 'Werkstatt Weber']) {
    const blatt = el('div');
    blatt.style.cssText = 'width:360px;background:#fff;border-radius:8px;box-shadow:0 18px 50px -18px rgba(70,58,38,.4);padding:26px 30px;text-align:left';
    blatt.append(
      el('div', 'etikett', 'KOSTENVORANSCHLAG'),
      el('div', 't11 sub', `${wer === 'Du' ? 'dein Klon' : wer} · 28.08.2026 · Seite 1`)
    );
    blatt.appendChild(beweisZeile(wer === 'Du' ? 'Kotflügel:' : 'Kotflügel (original):', wer === 'Du' ? '1.240,00 €' : '1.198,00 €'));
    reihe.appendChild(blatt);
  }
  b.append(reihe,
    el('div', 't13 sub', 'Zwei Originale, eine Gegenprobe — ihr seht beide, unverändert.'),
    knoepfe(['Gegenprobe laufen lassen', 'pill-salbei'], ['Später', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B19 · OsSuche — Frag alles, der Brain als Bildschirm
// ---------------------------------------------------------------------------

export function renderOsSuche(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const daten = ((ctx?.daten ?? {}) as StoreDaten);
  const b = buehne(el('div', 'serif t15', 'Frag alles — dein Assistent antwortet nur mit Beleg.'));

  // Frage-Feld (frag-Pille wie im Eingang)
  const frag = el('div', 'frag');
  frag.style.cssText = 'width:100%;max-width:560px';
  const input = el('input') as HTMLInputElement;
  input.placeholder = 'Was möchtest du wissen?';
  input.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
  const los = el('button', 'pill-salbei', 'Fragen');
  frag.append(input, los);
  b.appendChild(frag);

  const ergebnis = el('div');
  ergebnis.style.cssText = 'width:100%;max-width:560px;display:flex;flex-direction:column;gap:12px';
  b.appendChild(ergebnis);

  const stelle = async () => {
    const frage = input.value.trim();
    if (!frage) return;
    ergebnis.textContent = '';
    const warten = el('div', 't13 sub', 'Ich lese in deinen Fällen — jeden Treffer mit Fundstelle.');
    ergebnis.appendChild(warten);
    try {
      const r = await window.mmc.daten.fragAlles(frage);
      daten?.suche !== undefined || null;
      ergebnis.textContent = '';
      const antwort = el('div', 't15', r.antwort);
      ergebnis.appendChild(antwort);
      for (const t of r.treffer.slice(0, 5)) {
        const karte = el('div', 'karte');
        karte.style.cssText = 'text-align:left';
        karte.append(el('div', 't13', t.text));
        karte.appendChild(quelle(`fall ${t.fall} · ${t.doc} · Seite ${t.seite} · unterschrift ✓`));
        ergebnis.appendChild(karte);
      }
      if (r.ehrlich) {
        const e = el('div', 't11 sub', 'Ehrlichkeitszeile: was fehlt oder streitet, wird gesagt — nie still entschieden.');
        ergebnis.appendChild(e);
      }
    } catch {
      ergebnis.textContent = '';
      ergebnis.appendChild(el('div', 't13 sub', 'Das kann ich gerade nicht zeigen — dein Vault bleibt vollständig bei dir.'));
    }
  };
  los.addEventListener('click', stelle);
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') stelle(); });

  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B20 · OsRueckruf — Erlaubnis beenden, ehrlich
// ---------------------------------------------------------------------------

export function renderOsRueckruf(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 'etikett', 'AllianzHilfe'),
    titelSerif('den Zugriff entziehen?', 28),
    el('div', 't13 sub', 'Unfall Passat · die Reparatur ist abgeschlossen'),
    el('div', 't13 sub', 'Ihre Erlaubnis endet sofort — der nächste Abruf läuft ins Leere')
  );
  b.append(knoepfe(['Beenden', 'pill-rose'], ['Weiter lassen', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B21/B22 · Stapel / Neues Thema — der Ingester
// ---------------------------------------------------------------------------

export function renderOsStapel(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const daten = ((ctx?.daten ?? {}) as StoreDaten);
  const stapel = daten?.stapel ?? [];
  const b = buehne(titelSerif(stapel.length > 0 ? 'Der Stapel ist durch.' : 'Alles ruhig.', 30));
  if (stapel.length === 0) {
    b.appendChild(el('div', 't13 sub', 'Noch nichts einsortiert — wirf mir irgendetwas hin, der Ingester sortiert allein.'));
  }
  for (const e of stapel.slice(0, 6)) {
    const karte = el('div', 'karte karte-tipp');
    karte.style.cssText = 'text-align:left;width:100%;max-width:560px;cursor:pointer';
    karte.append(el('div', 'serif t15', e.fallId), el('div', 't13 sub', e.satz));
    karte.appendChild(quelle(e.commitZeile));
    karte.addEventListener('click', () => navigate('fall', { ...ctx, fallId: e.fallId }));
    b.appendChild(karte);
  }
  b.appendChild(el('div', 't11 sub', 'der Ingester sortiert allein — du siehst das Ergebnis, nicht den Vorgang'));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsNeuesThema(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const vorschlaege = ((ctx?.daten ?? {}) as StoreDaten)?.neuesThema ?? [];
  const b = buehne(el('div', 'serif t28', 'Da fängt etwas Neues an.'));

  if (vorschlaege.length === 0) {
    b.appendChild(el('div', 't13 sub', 'Gerade deutet nichts auf einen neuen Fall — der Ingester meldet sich, wenn etwas zusammengehört.'));
    gr.append(kopf(), b, fuss());
    container.appendChild(gr);
    return;
  }
  b.appendChild(el('div', 't13 sub', `${vorschlaege.length} ${vorschlaege.length === 1 ? 'Ding gehört' : 'Dinge gehören'} zusammen — und zu keinem Fall, den es gibt. Ich würde einen anlegen:`));
  for (const v of vorschlaege.slice(0, 3)) {
    const karte = el('div', 'karte');
    karte.style.cssText = 'text-align:left;width:100%;max-width:520px';
    karte.append(
      el('div', 'serif t17', v.titel),
      el('div', 't11 sub', v.quelle),
      quelle(`vorschlag · ${v.proposalId} · scan-first ✓`)
    );
    karte.appendChild(knoepfe(['Fall anlegen', 'pill-salbei', async () => {
      await window.mmc.vault.createFall(v.fallIdVorschlag).catch(() => {});
      navigate('fall', { ...ctx, fallId: v.fallIdVorschlag });
    }], ['Lieber nicht', 'pill-still']));
    b.appendChild(karte);
  }
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B23/B24/B25 · Meet / Divergenz / Aufzeichnung
// ---------------------------------------------------------------------------

export function renderOsMeet(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 'etikett', 'Meet · Badrenovierung'),
    el('div', 't13 sub', 'vier Tresore, ein Fall')
  );
  const anwesend = el('div');
  anwesend.style.cssText = 'display:flex;gap:8px';
  for (const w of ['Du', 'We', 'Ma', 'Li']) {
    const s = el('div', 'siegel serif', w);
    anwesend.appendChild(s);
  }
  const karte = el('div', 'karte');
  karte.style.cssText = 'text-align:left;width:100%;max-width:560px';
  karte.append(
    el('div', 'serif t15', 'Alle sehen dasselbe Original, jede Änderung ist ein Commit.'),
    el('div', 't13 sub', 'Badrenovierung · Kostenvoranschlag Seite 2 — gerade gelesen')
  );
  b.append(anwesend, karte, el('div', 't11 sub', 'Tisch in Echtzeit · Multi-eyes live · alles bleibt im Fall'));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsDivergenz(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(titelSerif('Zwei Zeugen, ein Moment.', 28),
    el('div', 't13 sub', 'Minute 27:50 — eure Geräte haben verschieden gehört. Das ist normal, und es bleibt sichtbar.'));
  const reihe = el('div');
  reihe.style.cssText = 'display:flex;gap:16px';
  for (const [wer, was] of [['Dein Gerät hörte', '„…bleibt bis Freigabe eingefroren."'], ['Webers Gerät hörte', '„…bleibt bis Freigabe festgesetzt."']]) {
    const blatt = el('div', 'karte');
    blatt.style.cssText = 'text-align:left;width:300px';
    blatt.append(el('div', 't13 sub', wer), el('div', 't15', was));
    reihe.appendChild(blatt);
  }
  b.append(reihe, knoepfe(['Beide behalten', 'pill-salbei'], ['Nachfragen', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsAufzeichnung(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 'serif t28', 'Frau Weber möchte aufzeichnen.'),
    el('div', 't13 sub', 'Anruf · Badrenovierung · Minute 02:10'),
    el('div', 't13 sub', 'Das Audio liegt dann als Datei im Fall — bei euch beiden, nicht bei einem Anbieter')
  );
  const fussHinweis = el('div', 't11 sub', 'Zustimmung wird committet — vor dem ersten Ton, nicht danach');
  b.append(knoepfe(
    ['Zustimmen', 'pill-salbei', async () => {
      // Die Erlaubnis wird als Commit im Fall festgehalten (vor dem Ton)
      try {
        const fall = ctx?.fallId ?? 'unfall-passat';
        await window.mmc.vault.commitEingang(fall,
          { absender: 'System', kanal: 'anruf-aufzeichnung' },
          { name: `aufzeichnung-einwilligung-${Date.now()}.json`,
            bytes: new TextEncoder().encode(JSON.stringify({
              art: 'einwilligung', partner: 'Frau Weber',
              minute: '02:10', zeit: new Date().toISOString(),
            })).buffer });
        fussHinweis.textContent = 'Einwilligung committet · vor dem ersten Ton · bei euch beiden';
      } catch {
        fussHinweis.textContent = 'Das konnte ich nicht committen — es wurde nichts aufgenommen.';
      }
    }],
    ['Nicht aufzeichnen', 'pill-still']),
    fussHinweis);
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B26/B27/B28 · Widerspruch / Connector-Beweis / Revision
// ---------------------------------------------------------------------------

export function renderOsWiderspruch(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(titelSerif('Zwei Systeme, ein Attribut.', 28),
    el('div', 't13 sub', 'Wanddicke der Materialnummer 4711 — die Systeme widersprechen sich. Welche gilt?'));
  const reihe = el('div');
  reihe.style.cssText = 'display:flex;gap:16px';
  for (const [sys, wert] of [['Teamcenter sagt', '2,1 mm'], ['Ihr PLM sagt', '2,3 mm']]) {
    const blatt = el('div', 'karte');
    blatt.style.cssText = 'text-align:left;width:300px';
    blatt.append(el('div', 't13 sub', sys), el('div', 'serif t17', wert));
    reihe.appendChild(blatt);
  }
  b.append(reihe, knoepfe(['Teamcenter gilt', 'pill-salbei', () => navigate('revision')],
    ['PLM gilt', 'pill-still'], ['Offen lassen', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsConnectorBeweis(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(titelSerif('Woher weißt du das?', 30),
    el('div', 't13 sub', '„Die Wanddicke von M-4711 beträgt 2,1 mm."'));
  const zelle = el('div');
  zelle.style.cssText = 'width:520px;background:#fff;border-radius:8px;box-shadow:0 18px 50px -18px rgba(70,58,38,.4);padding:28px 34px;text-align:left';
  zelle.append(
    el('div', 'etikett', 'TEAMCENTER · M-4711 · REVISION C'),
    el('div', 't11 sub', 'Systemzelle · abgerufen 29.08., 14:02 · connector live')
  );
  zelle.appendChild(beweisZeile('Wanddicke:', '2,1 mm'));
  b.append(zelle,
    quelle('connector · teamcenter · M-4711 · Rev C · abgerufen 29.08. · unterschrift ✓'),
    knoepfe(['Stimmt', 'pill-salbei'], ['Original öffnen', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsRevision(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 'serif t28', 'Teamcenter meldet eine neue Revision.'),
    el('div', 't15', 'M-4711: Wanddicke 2,3 → 2,1 mm'),
    el('div', 't13 sub', 'Revision B → C · freigegeben am 27.08.')
  );
  const karte = el('div', 'karte info');
  karte.style.cssText = 'text-align:left;width:100%;max-width:520px';
  karte.append(
    el('div', 't13 sub', 'alt:'),
    el('div', 't15', '2,3 mm — gilt nicht mehr'),
    quelle('teamcenter · M-4711 · Rev B · abgerufen 29.08.')
  );
  b.append(karte, el('div', 't11 sub', 'stiller Pull — eine Karte, kein Alarm'),
    knoepfe(['Übernehmen', 'pill-salbei'], ['Behalten wie es war', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B29 · OsMeisterSeite — die Quelle an/aus (Spec 20)
// ---------------------------------------------------------------------------

export function renderOsMeisterSeite(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(titelSerif('Was dein Assistent wissen darf.', 28),
    el('div', 't13 sub', 'Eine Seite, flach wie ein Lichtschalter — keine Ordner, keine Bäume.'));

  const quellen: [string, string, boolean][] = [
    ['Dokumente', '12.400 atome', true],
    ['Bilder', '8.100 atome', true],
    ['Teamcenter', 'connector · live', false],
    ['Anrufe', 'mitschriften · minuten-genau', true],
  ];
  for (const [name, hinweis, an] of quellen) {
    const zeile = el('div', 'karte');
    zeile.style.cssText = 'text-align:left;display:flex;align-items:center;justify-content:space-between;width:100%;max-width:520px;margin-bottom:10px';
    const links = el('div');
    links.append(el('div', 'serif t15', name), el('div', 't11 sub', hinweis));
    const schalter = el('button', 'schalter' + (an ? ' an' : ''));
    schalter.setAttribute('aria-pressed', String(an));
    schalter.addEventListener('click', () => {
      const jetzt = schalter.classList.toggle('an');
      schalter.setAttribute('aria-pressed', String(jetzt));
    });
    zeile.append(links, schalter);
    b.appendChild(zeile);
  }
  b.appendChild(el('div', 't11 sub', 'aus = der Assistent antwortet ehrlich weniger — nie still falsch'));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B30 · OsMixAntwort — die Ehrlichkeitszeile
// ---------------------------------------------------------------------------

export function renderOsMixAntwort(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(
    el('div', 'serif t15', '„Was zahlt unsere Versicherung beim Wasserschaden?"'),
    el('div', 't17', 'Bis 15.000 € je Schadensfall, Selbstbehalt 500 €')
  );
  const ehrlich = el('div', 'karte info');
  ehrlich.style.cssText = 'text-align:left;width:100%;max-width:560px';
  ehrlich.append(
    el('div', 't13', '— dein Anruf mit Frau Berger vom 12.03. bestätigt beides'),
    el('div', 't11 sub', ' Police sagt: bis 10.000 € · der Anruf ist neuer und mündlich zugesagt — beide stehen, der Anruf gewinnt.')
  );
  b.append(ehrlich,
    quelle('police-wasserschaden.pdf S. 3 · mitschrift-anruf-12-03.md Minute 04:12 · beide committet'),
    el('div', 't11 sub', 'Ehrlichkeitszeile: was fehlt oder streitet, wird gesagt — nie still entschieden.'));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// B2/B3 · Beweis + Phone — beweis.ts deckt B2 ab; B3 als schmale Fassung
// ---------------------------------------------------------------------------

export function renderOsBeweisScreen(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const b = buehne(titelSerif('Woher weißt du das?', 30),
    el('div', 't13 sub', '„Die Umsatzsteuer für August beträgt 1.190,00 €."'));
  const blatt = el('div');
  blatt.style.cssText = 'width:560px;background:#fff;border-radius:8px;box-shadow:0 18px 50px -18px rgba(70,58,38,.4);padding:30px 36px;text-align:left';
  blatt.append(
    el('div', 'etikett', 'RECHNUNG 2026-118'),
    el('div', 't11 sub', 'Mahler & Sohn GmbH · Leistungszeitraum August 2026')
  );
  blatt.appendChild(el('div'));
  const net = el('div', 't13');
  net.style.cssText = 'display:flex;justify-content:space-between;margin-top:10px';
  net.append(el('span', 'sub', 'Nettobetrag'), el('span', '6.263,16 €'));
  blatt.appendChild(net);
  blatt.appendChild(beweisZeile('Umsatzsteuer 19 %', '1.190,00 €'));
  const sum = el('div', 't13');
  sum.style.cssText = 'display:flex;justify-content:space-between';
  sum.append(el('span', 'sub', 'Rechnungsbetrag'), el('span', '7.453,16 €'));
  blatt.appendChild(sum);
  b.append(blatt,
    quelle('fall steuern-2026 · rechnung-2026-118.pdf · Seite 1 · Commit 8f0f849 · unterschrift ✓'),
    knoepfe(['Stimmt', 'pill-salbei'], ['Original öffnen', 'pill-still'],
      ['Falsch zugeordnet', 'pill-still']));
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

export function renderOsPhone(container: HTMLElement, ctx: AppCtx): void {
  // Schmale Fassung von Heute für das Phone-Layout (Karte + Liste).
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss() + ';max-width:390px;margin:0 auto';
  const b = buehne(titelSerif('Alles ruhig.', 24));
  const karte = el('div', 'karte karte-tipp');
  karte.style.cssText = 'text-align:left;width:100%;cursor:pointer';
  karte.append(
    el('div', 'serif t15', 'Umsatzsteuer fällig in 2 Tagen'),
    el('div', 't13 sub', 'Voranmeldung August · 1.190,00 €')
  );
  karte.addEventListener('click', () => navigate('leseplatz', ctx));
  const liste = el('div');
  liste.style.cssText = 'width:100%';
  for (const e of ['Stromrechnung → Haus & Wohnen', 'Anruf mit Werkstatt Weber → Unfall Passat', 'Police-Foto → Versicherungen']) {
    const z = el('div', 'listenzeile t13');
    z.style.marginBottom = '8px';
    z.textContent = e;
    liste.appendChild(z);
  }
  b.append(karte, liste);
  gr.append(kopf(), b, fuss());
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// CSS: Motion & Schalter (Karte-Tipp 150ms, Schalter 600ms dokumentiert)
// ---------------------------------------------------------------------------

export function osCss(): string {
  return `
/* C1 · Karte-Tipp: 150ms eine Spur tiefer, kein Ripple */
.karte-tipp { transition: transform 150ms ease-out, box-shadow 150ms ease-out; }
.karte-tipp:active { transform: translateY(2px); box-shadow: 0 6px 18px -12px rgba(90,75,50,.35); }

/* B29 · Der Schalter — 600ms Sanduhr-Moment (dokumentierte Ausnahme von --os-motion-max) */
.schalter {
  width: 52px; height: 30px; border-radius: 999px; flex: none;
  background: rgba(184,163,105,.25); position: relative; cursor: pointer;
  transition: background 600ms ease-out;
  border: none;
}
.schalter::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 24px; height: 24px; border-radius: 999px; background: #fff;
  box-shadow: 0 2px 6px rgba(90,75,50,.3);
  transition: left 600ms ease-out;
}
.schalter.an { background: var(--os-salbei); }
.schalter.an::after { left: 25px; }
`;
}
