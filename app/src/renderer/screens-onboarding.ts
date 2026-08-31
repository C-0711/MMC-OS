/**
 * screens-onboarding.ts — Der Null-Fragen-Weg + AUTH + Sanduhr + Bürger-Alltag.
 *
 * Wortgleich zu den Canvas-Artboards (page-8, gültige Fassung):
 * ObNull, ObErfolg, ObRettung, ObAutonomieKarte, ObEingeladen,
 * ObSanduhr/Fertig/Nicken, ObScanBericht, ObBuergerKarte, ObAllesRuhig,
 * ObAnmeldung, ObCode, ObZwoelfWorte.
 *
 * Regeln aus dem Canvas (Abnahme):
 * - Nie rot für Fehler; Schloss-Zeile still
 * - Kein Dashboard, keine Badges; Aufnehmen als Textlink
 * - Sanduhr: 24px, Körner 3-4/s Olivgold 1px, kein Euro-Zeichen
 * - Serif 400, nie fett; Zahlen als Mono-Fußnoten
 */

import type { AppCtx } from './router.js';
import { navigate } from './router.js';

/** Schema für Sanduhr und Fußnoten aus den Atomen/Seiten des Ingests. */
export interface SanduhrDaten {
  seitenVerstanden: number;   // „Verstanden: 9.500 Seiten."
  seitenGelesen: number;      // „2.146 / 9.500 gelesen"
  fallId: string;
}

const MOTION_SCHALTER = 600; // dokumentierte Ausnahme von --os-motion-max (UeSchalterMoment)

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  klassen?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (klassen) e.className = klassen;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Kopf mit Ampel-platzhalter + Siegel rechts (auf allen Desktop-Screens). */
export function kopf(siegelText = 'Du'): HTMLElement {
  const k = el('div');
  k.style.cssText =
    'flex:none;height:52px;display:flex;align-items:center;padding:0 16px;gap:12px';
  const abstand = el('span');
  abstand.style.flex = '1';
  const s = el('div', 'siegel serif', siegelText);
  k.appendChild(abstand);
  k.appendChild(s);
  return k;
}

function fusszeile(text: string): HTMLElement {
  return el('div', 'quellzeile t11', text);
}

function zentriert(...kinder: HTMLElement[]): HTMLElement {
  const w = el('div');
  w.style.cssText =
    'flex:1;display:flex;flex-direction:column;align-items:center;gap:18px;padding:8px 80px 0;text-align:center';
  for (const k of kinder) w.appendChild(k);
  return w;
}

// ---------------------------------------------------------------------------
// A1 · ObNull — Erster Start, keine einzige Frage
// ---------------------------------------------------------------------------

export function renderObNull(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();

  const mitte = zentriert(
    el('div', 'serif', 'Wirf mir irgendetwas hin.') as HTMLElement
  );
  (mitte.firstChild as HTMLElement).style.fontSize = '34px';

  const sub = el('div', 't13 sub',
    'Einen Brief, ein Foto, ein PDF — ich lese es hier, auf deinem Gerät.');
  const drop = el('div', 't13 sub', 'hierher ziehen — oder abfotografieren');
  drop.style.cssText =
    'border:1.5px dashed rgba(184,163,105,.5);border-radius:12px;padding:18px 26px;color:#5c705c';
  const leitsatz = el('div', 't11 sub', 'Kein Konto. Keine Fragen. Kein Assistent.');

  mitte.append(sub, drop, leitsatz);
  gr.append(kopf(), mitte, el('div') /*fuß-abstand*/);
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// A2 · ObErfolg — Der erste Erfolg (ganzes Onboarding in einem Screen)
// ---------------------------------------------------------------------------

export function renderObErfolg(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Wirf mir irgendetwas hin.');
  titel.style.fontSize = '34px';
  const mitte = zentriert(titel);
  const mitte2 = el('div', 't13 sub', 'Kfz-Police 2026.pdf');
  const gelesen = el('div', 't13 sub',
    'Gelesen — in 0,6 Sekunden, hier auf dem Gerät.');
  const jetzt = el('div', 't15', 'Jetzt frag mich etwas. Zum Beispiel:');
  const f1 = el('button', 'pill-still', 'Wann läuft die Police aus?');
  const f2 = el('button', 'pill-still', 'Wie hoch ist die Selbstbeteiligung?');
  const fertig = el('div', 't13 sub',
    'Wenn du die erste Antwort siehst — mit der Stelle, aus der sie kommt — bist du fertig. Das war das ganze Onboarding.');
  const frag = el('div', 'frag');
  const input = el('input') as HTMLInputElement;
  input.placeholder = 'Frag mich …';
  input.style.cssText = 'flex:1;border:none;background:transparent;font-size:15px;outline:none';
  frag.appendChild(input);
  mitte.append(mitte2, gelesen, jetzt, f1, f2, fertig, frag);
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// A3 · ObRettung — Tag 2, die Rettungs-Karte
// ---------------------------------------------------------------------------

export function renderObRettung(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Guten Morgen.');
  titel.style.fontSize = '30px';
  const unter = el('div', 't15', 'Wie versprochen: dein Siegel sichern.');
  const einleitung = el('div', 't13 sub',
    'Im Moment trägt nur dieses Gerät dein Siegel. Zwei Wege, das zu ändern — such dir einen aus, fünf Minuten:');
  const mitte = zentriert(titel, unter, einleitung);

  const weg1 = el('div', 'karte');
  weg1.append(
    el('div', 'serif t15', 'Dein Mac wird zweiter Träger'),
    el('div', 't13 sub', 'Geht eines der Geräte verloren, trägt das andere weiter.')
  );
  const weg2 = el('div', 'karte');
  weg2.append(
    el('div', 'serif t15', 'Zwölf Wörter auf Papier'),
    el('div', 't13 sub', 'Aufschreiben, in die Schublade — der älteste Tresor der Welt.')
  );

  const knoepfe = el('div');
  knoepfe.style.cssText = 'display:flex;gap:10px';
  knoepfe.append(
    el('button', 'pill-salbei', 'Ja, jetzt'),
    el('button', 'pill-still', 'Am Wochenende')
  );
  const hartnaeckig = el('div', 't13 sub',
    'Ich erinnere dich, bis es erledigt ist — das ist die eine Sache, bei der ich hartnäckig bin.');

  mitte.append(weg1, weg2, knoepfe, hartnaeckig);
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// A4 · ObAutonomieKarte — Tag 3, Autonomie als Karte (keine Vorab-Frage!)
// ---------------------------------------------------------------------------

export function renderObAutonomieKarte(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Kurz nachgefragt — zum ersten Mal.');
  titel.style.fontSize = '28px';
  titel.style.lineHeight = '1.3';
  const mitte = zentriert(titel);

  const karte = el('div', 'karte');
  karte.style.textAlign = 'left';
  karte.append(
    el('div', 't15', 'Einsortieren, Ablegen, Erinnern — weiterhin still'),
    el('div', 't13 sub', 'Geld, Abgaben, Verträge fragen immer — das ändert sich nie')
  );
  const knoepfe = el('div');
  knoepfe.style.cssText = 'display:flex;gap:10px';
  knoepfe.append(
    el('button', 'pill-salbei', 'Passt, weiter so'),
    el('button', 'pill-still', 'Frag öfter')
  );
  const schluss = el('div', 't13 sub',
    'Das war früher eine Onboarding-Frage. Jetzt ist es eine Karte — gestellt, als es etwas zu entscheiden gab.');

  mitte.append(karte, knoepfe, schluss);
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// A5 · ObEingeladen — ein Bildschirm (Klon-Annahme mit Siegel-Signatur)
// ---------------------------------------------------------------------------

export function renderObEingeladen(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Fast drin.');
  titel.style.fontSize = '28px';
  const mitte = zentriert(titel);
  mitte.append(
    el('div', 't13 sub', 'Dein Siegel ist geprägt.'),
    el('div', 't13 sub', 'Es hat gerade dein „Annehmen" signiert — Lena sieht: das warst wirklich du.'),
    el('div', 't15', 'Wo soll dein Klon des Falls wohnen?')
  );
  const hier = el('button', 'pill-salbei', 'Hier, auf diesem iPhone');
  const hinweis = el('div', 't11 sub',
    'Später auf einen Mac oder in deine Cloud umziehen geht immer.');
  const zumFall = el('button', 'pill-still', 'Zum Fall');
  zumFall.addEventListener('click', () => navigate('fall'));
  const schluss = el('div', 't13 sub',
    'Alles Weitere fragt dich das System, wenn es so weit ist — nicht vorher.');
  mitte.append(hier, hinweis, zumFall, schluss);
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// A6-A8 · Die Sanduhr (24px, Körner 3-4/s, kein Euro, der Hügel ist der Bericht)
// ---------------------------------------------------------------------------

export function renderObSanduhr(container: HTMLElement, ctx: AppCtx): void {
  const live = ((ctx?.daten ?? {}) as { ingest?: { total: number; fertig: number; phase: string } }).ingest;
  const d = ((ctx?.daten ?? {}) as { sanduhr?: SanduhrDaten }).sanduhr ??
    (live && live.total > 0
      ? { seitenVerstanden: live.total, seitenGelesen: live.fertig, fallId: 'ingest' }
      : null);

  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();

  const zahl = (n: number) => n.toLocaleString('de-DE');
  const titel = el('div', 'serif', d
    ? `Verstanden: ${zahl(d.seitenVerstanden)} Seiten.`
    : 'Ich lese noch nichts — wirf mir irgendetwas hin.');
  titel.style.fontSize = '22px';
  const mitte = zentriert(
    titel,
    el('div', 't13 sub', 'Was davon heute wichtig ist, liegt oben auf.')
  );

  // Die Sanduhr: 24px Haarlinie, Körner fallen — DOM genügt.
  const uhr = el('div', 'sanduhr');
  mitte.appendChild(uhr);

  const huegelText = el('div', 't13 sub',
    'Der Hügel unten ist der Bericht. Er wächst still — Themen entstehen erst, wenn du sie aufnimmst.');
  mitte.appendChild(huegelText);
  if (d) {
    mitte.appendChild(fusszeile(
      `${zahl(d.seitenGelesen)} / ${zahl(d.seitenVerstanden)} gelesen · alles committet vor Deutung · fall·${d.fallId} · signatur ✓`
    ));
  } else {
    mitte.appendChild(fusszeile('ingest bereit · scan-first · kein commit vor dem nicken'));
  }
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
  // Körnerfall erst im DOM (rAF reicht, kein Timeout)
  requestAnimationFrame(() => sanduhrStarten(container.querySelector('.sanduhr')));
}

export function renderObSanduhrFertig(container: HTMLElement, ctx: AppCtx): void {
  const d = ((ctx?.daten ?? {}) as { sanduhr?: SanduhrDaten }).sanduhr ??
    { seitenVerstanden: 9500, seitenGelesen: 4231, fallId: 'ingest' };
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif',
    `${d.seitenGelesen.toLocaleString('de-DE')} Dokumente · bereit, wenn du es bist.`);
  titel.style.fontSize = '22px';
  const mitte = zentriert(titel, el('div', 'sanduhr sanduhr-fertig'));
  // Aufnehmen als Textlink — kein Triumph, kein Bestätigen.
  const aufnehmen = el('button', 'btn-ghost', 'Aufnehmen');
  aufnehmen.style.cssText =
    'font-size:15px;color:var(--os-tinte);text-decoration:underline;text-underline-offset:4px';
  const spaeter = el('button', 'btn-ghost', 'später');
  mitte.append(aufnehmen, spaeter,
    el('div', 't11 sub', 'Fertigmelden ist kein Triumph — die Zahlen stehen als Fußnote, nicht als Dashboard.'));
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

export function renderObSanduhrNicken(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Aufgenommen.');
  titel.style.fontSize = '22px';
  const mitte = zentriert(titel, el('div', 'sanduhr sanduhr-nicken'));
  // C6: nach dem Nicken läuft es still — 300ms leuchtet die Taille, ein Ereignis.
  mitte.appendChild(el('div', 't13 sub', 'Ich lese still weiter — du merkst es nicht.'));
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// A9 · ObScanBericht — Scan-First: „Ich habe Orte gefunden … Darf ich?"
// ---------------------------------------------------------------------------

export interface ScanQuelle {
  name: string;
  zahlen: string;           // Mono-Zeile: „8.900 dateien · 6,1 GB · ältestes 2009"
  extra?: string;           // z.B. „~9.500 seiten, eine nacht"
  geschuetzt?: number;      // geschützte Dateien — stille Schloss-Zeile, NIE rot
  aufnehmen?: () => void;
}

export function renderObScanBericht(container: HTMLElement, ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();

  const titel = el('div', 'serif', 'Ich habe Orte gefunden, an denen dein Leben liegt.');
  titel.style.cssText = 'font-size:22px;line-height:1.4;text-align:center';
  const darf = el('div', 'serif', 'Darf ich?');
  darf.style.cssText = 'font-size:15px;color:#5c705c';
  const mitte = zentriert(titel, darf);
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);

  // Echte Quellen asynchron nachladen (Scan-First: nur stat())
  const daten = (ctx?.daten ?? {}) as Record<string, unknown>;
  const pfade = (daten.scanPfade as string[] | undefined) ?? [];
  window.mmc.daten.ingestScanReport(pfade)
    .then((bericht) => {
      mitte.textContent = '';
      zeichneQuellen(mitte, bericht.map(q => ({
        name: q.name,
        zahlen: `${q.dateien.toLocaleString('de-DE')} dateien · ${(q.bytes / 1e9).toFixed(1)} GB${q.aeltestes ? ' · ältestes ' + q.aeltestes : ''}`,
        geschuetzt: q.geschuetzt,
      })), ctx);
    })
    .catch(() => {
      zeichneQuellen(mitte, [], ctx);
    });
}

/** Interne Darstellung der Quellen-Karten (wird von renderObScanBericht genutzt). */
function zeichneQuellen(mitte: HTMLElement, quellen: ScanQuelle[], _ctx: AppCtx): void {
  const titel2 = el('div', 'serif', 'Ich habe Orte gefunden, an denen dein Leben liegt.');
  titel2.style.cssText = 'font-size:22px;line-height:1.4;text-align:center';
  const darf2 = el('div', 'serif', 'Darf ich?');
  darf2.style.cssText = 'font-size:15px;color:#5c705c';
  mitte.append(titel2, darf2);

  for (const q of quellen) {
    const karte = el('div', 'karte');
    karte.style.cssText = 'text-align:left;width:100%;max-width:560px';
    const kopfQ = el('div', 'serif t15', q.name);
    const zahlen = el('div', 'quellzeile t11', q.zahlen);
    karte.append(kopfQ, zahlen);
    if (q.extra) karte.appendChild(el('div', 't11 sub', q.extra));
    if (q.geschuetzt) {
      // Stille Schloss-Zeile — nie rot, nie Alarm.
      karte.appendChild(el('div', 't11 sub', `🔒 ${q.geschuetzt} geschützte Dateien nicht aufgenommen`));
    }
    const knoepfe = el('div');
    knoepfe.style.cssText = 'display:flex;gap:10px;margin-top:10px';
    const auf = el('button', 'btn-ghost', 'Aufnehmen');
    auf.style.cssText = 'font-size:15px;color:var(--os-tinte);text-decoration:underline;text-underline-offset:4px';
    if (q.aufnehmen) auf.addEventListener('click', q.aufnehmen);
    knoepfe.append(auf, el('button', 'btn-ghost', 'später'));
    karte.appendChild(knoepfe);
    mitte.appendChild(karte);
  }

  if (quellen.length === 0) {
    mitte.appendChild(el('div', 't13 sub', '2 weitere Orte gefunden — sie warten, ohne zu drängen'));
  }

  mitte.append(
    el('div', 't13 sub',
      'Bis du nickst, wird nichts gelesen und nichts gespeichert — der Bericht zählt nur, er öffnet keine einzige Datei.'),
    fusszeile('scan-first · nur stat() und dateinamen · kein commit vor dem nicken')
  );
}

// ---------------------------------------------------------------------------
// A10 · ObBuergerKarte — Rechnung mit Beweis, ein Wort
// ---------------------------------------------------------------------------

export function renderObBuergerKarte(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const etikett = el('div', 'etikett', 'Aus deinem Briefkasten, heute Morgen');
  const frage = el('div', 'serif',
    'Rechnung Stadtwerke, 89 €, fällig 15.09. — stimmt das?');
  frage.style.cssText = 'font-size:21px;line-height:1.45;text-align:center';
  const mitte = zentriert(etikett, frage);

  const blatt = el('div');
  blatt.style.cssText =
    'width:420px;background:#fff;border-radius:8px;box-shadow:0 18px 50px -18px rgba(70,58,38,.4);padding:26px 32px;text-align:left';
  blatt.append(
    el('div', 't11', 'RECHNUNG · STADTWERKE 2026-09'),
    el('div', 't11 sub', 'Stadtwerke · Leistungszeitraum September 2026')
  );
  const betrag = el('div');
  betrag.style.cssText =
    'position:relative;display:flex;justify-content:space-between;font-size:13px;padding:4px 8px;margin:10px -8px 0';
  const mark = el('span');
  mark.className = 'mark-beweis';
  mark.style.cssText = 'position:absolute;inset:0';
  const links = el('span', 'sub', 'Fällig 15.09.');
  const rechts = el('span', '89,00 €');
  rechts.style.fontWeight = '600';
  betrag.append(mark, links, rechts);
  blatt.appendChild(betrag);

  const quelle = fusszeile('post · stadtwerke-2026-09.pdf · Seite 1 · commit 7b3e · Signatur ✓');
  const knoepfe = el('div');
  knoepfe.style.cssText = 'display:flex;gap:10px';
  knoepfe.append(
    el('button', 'pill-salbei', 'Stimmt'),
    el('button', 'pill-still', 'Anders'),
    el('button', 'pill-still', 'Frag nicht wieder')
  );
  mitte.append(blatt, quelle, knoepfe);
  mitte.append(
    el('div', 't13 sub', 'Eine Karte, ein Beweis, ein Wort. Dein Nicken ist ein Commit — keine App, die dich erzieht.'),
    el('div', 't11 sub', '1 von 1 karte · nichts weiter wartet')
  );
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// A11 · ObAllesRuhig — ein Zustand mit Würde
// ---------------------------------------------------------------------------

export function renderObAllesRuhig(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Alles ruhig.');
  titel.style.fontSize = '30px';
  const mitte = zentriert(titel);
  mitte.append(
    el('div', 't13 sub',
      'Keine Karte wartet. Dein Assistent liest still weiter — was wichtig wird, liegt dann oben auf.'),
    fusszeile('heute 14:02 · 3 eingänge still einsortiert · alles committet · signatur ✓')
  );
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// A12-A14 · AUTH — Anmeldung, Code, Zwölf Worte
// ---------------------------------------------------------------------------

export function renderObAnmeldung(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Deine E-Mail.');
  titel.style.cssText = 'font-size:34px;text-align:center;line-height:1.3';
  const mitte = zentriert(titel, el('div', 't13 sub', 'Dein Container entsteht.'));
  const feld = el('input') as HTMLInputElement;
  feld.type = 'email';
  feld.placeholder = 'christoph@0711.io';
  feld.style.cssText =
    'width:320px;min-height:44px;border:none;border-bottom:1.5px solid rgba(184,163,105,.5);background:transparent;font-size:17px;text-align:center;outline:none;font-family:var(--os-sans)';
  const senden = el('button', 'pill-salbei', 'Code senden');
  senden.addEventListener('click', () => navigate('auth-code'));
  const passkey = el('button', 'btn-ghost', 'Passkey statt E-Mail — der souveräne Weg ↗');
  passkey.style.fontSize = '13px';
  mitte.append(feld, senden, passkey);
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

export function renderObCode(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Der Code ist unterwegs.');
  titel.style.fontSize = '34px';
  const mitte = zentriert(titel,
    el('div', 't13 sub', 'an c········h@0711.io · gilt zehn Minuten, ein einziges Mal'));
  const feld = el('input') as HTMLInputElement;
  feld.placeholder = '—— —— ——';
  feld.style.cssText =
    'width:220px;min-height:52px;border:1px solid rgba(184,163,105,.4);border-radius:12px;background:#fff;text-align:center;font-size:22px;letter-spacing:.3em;outline:none;font-family:var(--os-mono)';
  const weiter = el('button', 'pill-salbei', 'Weiter');
  weiter.addEventListener('click', () => navigate('auth-zwoelf-worte'));
  const nochmal = el('button', 'btn-ghost', 'nichts angekommen? noch einmal senden');
  mitte.append(feld, weiter, nochmal);
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

export function renderObZwoelfWorte(container: HTMLElement, _ctx: AppCtx): void {
  const gr = el('div', 'os-grund');
  gr.style.cssText = grundCss();
  const titel = el('div', 'serif', 'Schreib diese zwölf Wörter auf. Jetzt.');
  titel.style.fontSize = '34px';
  const mitte = zentriert(titel);
  const worte = ['glacier','ribbon','harvest','lantern','meadow','copper','velvet','anchor','timber','orchid','saddle','winter'];
  const gitter = el('div');
  gitter.style.cssText =
    'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:560px;width:100%';
  worte.forEach((w, i) => {
    const z = el('div', 'karte');
    z.style.cssText = 'margin:0;padding:14px 18px;display:flex;gap:12px;align-items:baseline';
    z.append(el('span', 't11 sub', String(i + 1).padStart(2, '0')), el('span', 'serif t15', w));
    gitter.appendChild(z);
  });
  const weiter = el('button', 'pill-salbei', 'Aufgeschrieben — weiter');
  mitte.append(gitter, weiter,
    el('div', 't13 sub', 'Gleich frage ich dich nach zweien davon — zur Sicherheit, einmalig.'));
  gr.append(kopf(), mitte, el('div'));
  (gr.lastChild as HTMLElement).style.height = '36px';
  container.appendChild(gr);
}

// ---------------------------------------------------------------------------
// CSS: os-grund + die Sanduhr (24px, Körner 3-4/s Olivgold)
// ---------------------------------------------------------------------------

function grundCss(): string {
  return 'width:100%;height:100%;min-height:560px;overflow:hidden;position:relative;display:flex;flex-direction:column;background:var(--os-grund);color:var(--os-tinte)';
}

export function onboardingCss(): string {
  return `
/* Die Sanduhr — 24px, Haarlinie Tinte, Sand Olivgold 1px (ObSanduhr) */
.sanduhr {
  position: relative; width: 24px; height: 40px; margin: 14px 0;
}
.sanduhr::before { /* der Glas-Körper: zwei Dreiecke als Haarlinie */
  content: ''; position: absolute; inset: 0;
  border-left: 1px solid rgba(42,37,32,.5); border-right: 1px solid rgba(42,37,32,.5);
  clip-path: polygon(0 0, 100% 0, 50% 50%, 100% 100%, 0 100%, 50% 50%);
}
.sanduhr::after { /* der Hügel unten — der Bericht, er wächst still */
  content: ''; position: absolute; left: -14px; right: -14px; bottom: -4px; height: 8px;
  background: radial-gradient(50% 100% at 50% 100%, rgba(184,163,105,.45), transparent 70%);
  border-radius: 50%;
  animation: huegel-wachsen 60s ease-out forwards;
}
@keyframes huegel-wachsen { from { transform: scaleX(.2); } to { transform: scaleX(1); } }
.sanduhr .korn {
  position: absolute; left: 50%; width: 1px; height: 1px;
  background: var(--os-olivgold);
  animation: korn-fall 1400ms linear forwards; /* 3-4 Körner/s im Schnitt */
}
@keyframes korn-fall {
  0% { top: 2px; opacity: 0; }
  10% { opacity: 1; }
  85% { opacity: 1; }
  100% { top: 32px; opacity: 0; }
}
.sanduhr-fertig::after { animation: none; transform: scaleX(1); }
.sanduhr-nicken::before {
  animation: taille-leuchten 300ms ease-out 1; /* C6: ein Ereignis, 300ms */
}
@keyframes taille-leuchten {
  0%, 100% { border-color: rgba(42,37,32,.5); }
  50% { border-color: var(--os-olivgold); box-shadow: 0 0 12px rgba(184,163,105,.8); }
}
`;
}

/** Startet den Körnerfall (vom Host nach dem Einfügen einmal aufrufen). */
export function sanduhrStarten(uhr: HTMLElement | null): void {
  if (!uhr) return;
  let lauf = 0;
  const tick = () => {
    if (!uhr.isConnected || lauf++ > 200) return;
    const k = el('span', 'korn');
    k.style.animationDelay = `${Math.random() * 250}ms`;
    uhr.appendChild(k);
    setTimeout(() => k.remove(), 1700);
    setTimeout(tick, 260 + Math.random() * 120); // 3-4/s, sanft versetzt
  };
  tick();
}
