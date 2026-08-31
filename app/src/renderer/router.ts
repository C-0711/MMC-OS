/**
 * router.ts — Der stille Weg durchs Haus.
 *
 * Ersetzt die vier festen zustand-Strings durch benannte Screens.
 * Ein Screen = eine Render-Funktion in der Registry.
 *
 * Bewegung: max 300ms, eine Bedeutung je Animation (--os-motion-max).
 */

export type ScreenId =
  // Onboarding (Null-Fragen-Weg, gültig)
  | 'ob-null' | 'ob-erfolg' | 'ob-rettung' | 'ob-autonomie-karte' | 'ob-eingeladen'
  | 'sanduhr' | 'sanduhr-fertig' | 'sanduhr-nicken' | 'scan-bericht'
  | 'buerger-karte' | 'alles-ruhig'
  // AUTH
  | 'auth-anmeldung' | 'auth-code' | 'auth-zwoelf-worte'
  // OS-Alltag
  | 'heute' | 'beweis' | 'anruf-beweis' | 'fall' | 'katalog' | 'uebernahme'
  | 'uebergang' | 'vereinbarung' | 'anruf-kommt' | 'anruf-laeuft' | 'text'
  | 'freund' | 'ausgruendung' | 'gruppe' | 'leseplatz' | 'tisch' | 'einladen'
  | 'suche' | 'rueckruf' | 'stapel' | 'neues-thema' | 'meet' | 'divergenz'
  | 'aufzeichnung' | 'widerspruch' | 'connector-beweis' | 'revision'
  | 'meister-seite' | 'mix-antwort' | 'kontakte' | 'fall-strom' | 'phone';

export interface AppCtx {
  faelle?: { id: string; name: string }[];
  kartenOffen?: number;
  fallId?: string;
  daten?: Record<string, unknown>;
}

export type SiegelBereich =
  | 'heute' | 'faelle' | 'anrufe-texte' | 'themen' | 'leseplatz-tisch'
  | 'leute' | 'kontakte' | 'suche' | 'meister' | 'auth';

export type RenderFn = (container: HTMLElement, ctx: AppCtx) => void;

interface Route {
  id: ScreenId;
  bereich: SiegelBereich;
  render: RenderFn;
}

const routes = new Map<ScreenId, Route>();
const history: ScreenId[] = [];
let aktuelle: ScreenId | null = null;

/** Registriert einen Screen (idempotent — letzter gewinnt). */
export function route(id: ScreenId, bereich: SiegelBereich, render: RenderFn): void {
  routes.set(id, { id, bereich, render });
}

export function aktuellerScreen(): ScreenId | null {
  return aktuelle;
}

export function letzterScreen(): ScreenId | null {
  return history.length >= 2 ? history[history.length - 2] : null;
}

/** Navigiert. Rendert in den Container und merkt sich den Weg. */
export function navigate(id: ScreenId, ctx: AppCtx = {}, container?: HTMLElement): void {
  const r = routes.get(id);
  if (!r) {
    console.warn(`[router] Screen ${id} nicht registriert`);
    return;
  }
  const ziel = container || document.getElementById('buehne');
  if (!ziel) return;
  aktuelle = id;
  history.push(id);
  if (history.length > 40) history.shift();

  // Bühne sichtbar machen, App-Shell-Zustände still beiseite — der
  // Router-Screen IST jetzt die Ansicht. (Zurück-Kontext bleibt im
  // history-Array; der Shell-Zustand wird von app.ts bei 'heute' gehebelt.)
  ziel.style.display = 'block';
  for (const shellId of ['gruss', 'gruss-klein', 'alles-ruhig', 'karten-container', 'dialog-container', 'fall-ansicht-container', 'fussleiste']) {
    const e = document.getElementById(shellId);
    if (e) e.style.display = 'none';
  }
  if (id === 'heute') {
    // Heute ist der Alltag: Shell-Karten gehören DORTHIN — der
    // Router-Heute-Screen zeigt sie zusätzlich aus AppCtx. Wir lassen
    // die Shell sichtbar und verstecken die Bühne wieder:
    ziel.style.display = 'none';
    const grussEl = document.getElementById('gruss');
    if (grussEl) grussEl.style.display = 'block';
    const grussKlein = document.getElementById('gruss-klein');
    if (grussKlein) grussKlein.style.display = 'block';
    const karten = document.getElementById('karten-container');
    if (karten) karten.style.display = 'block';
    const zustand = document.getElementById('alles-ruhig');
    if (zustand) zustand.style.display = 'block';
    const fuss = document.getElementById('fussleiste');
    if (fuss) fuss.style.display = 'block';
  }

  ziel.textContent = '';
  r.render(ziel, ctx);
}

export function screensFuerBereich(bereich: SiegelBereich): ScreenId[] {
  return [...routes.values()].filter((r) => r.bereich === bereich).map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Registrierung aller Screens (einmalig, beim Laden des Moduls)
// ---------------------------------------------------------------------------
import * as ob from './screens-onboarding.js';
import * as os from './screens-os.js';
import {
  renderObNull, renderObErfolg, renderObRettung, renderObAutonomieKarte,
  renderObEingeladen, renderObAnmeldung, renderObCode, renderObZwoelfWorte,
} from './screens-onboarding.js';
import {
  renderVereinbarung, renderTisch, renderGruppe, renderEinladen, renderRueckruf,
} from './screens.js';

// Onboarding
route('ob-null', 'auth', renderObNull);
route('ob-erfolg', 'auth', renderObErfolg);
route('ob-rettung', 'auth', renderObRettung);
route('ob-autonomie-karte', 'auth', renderObAutonomieKarte);
route('ob-eingeladen', 'auth', renderObEingeladen);
route('sanduhr', 'themen', ob.renderObSanduhr);
route('sanduhr-fertig', 'themen', ob.renderObSanduhrFertig);
route('sanduhr-nicken', 'themen', ob.renderObSanduhrNicken);
route('scan-bericht', 'themen', ob.renderObScanBericht);
route('buerger-karte', 'heute', ob.renderObBuergerKarte);
route('alles-ruhig', 'heute', ob.renderObAllesRuhig);
route('auth-anmeldung', 'auth', renderObAnmeldung);
route('auth-code', 'auth', renderObCode);
route('auth-zwoelf-worte', 'auth', renderObZwoelfWorte);

// OS-Alltag (screens-os.ts, DOM-Bau nach Canvas)
route('heute', 'heute', os.renderOsHeute);
route('beweis', 'heute', os.renderOsBeweisScreen);
route('anruf-beweis', 'anrufe-texte', os.renderOsAnrufBeweis);
route('fall', 'faelle', os.renderOsFall);
route('katalog', 'faelle', os.renderOsKatalog);
route('uebernahme', 'leute', os.renderOsUebernahme);
route('uebergang', 'faelle', os.renderOsUebergang);
route('anruf-kommt', 'anrufe-texte', os.renderOsAnrufKommt);
route('anruf-laeuft', 'anrufe-texte', os.renderOsAnrufLaeuft);
route('text', 'anrufe-texte', os.renderOsText);
route('freund', 'leute', os.renderOsFreund);
route('ausgruendung', 'leute', os.renderOsAusgruendung);
route('leseplatz', 'leseplatz-tisch', os.renderOsLeseplatz);
route('suche', 'suche', os.renderOsSuche);
route('stapel', 'themen', os.renderOsStapel);
route('neues-thema', 'themen', os.renderOsNeuesThema);
route('meet', 'leseplatz-tisch', os.renderOsMeet);
route('divergenz', 'anrufe-texte', os.renderOsDivergenz);
route('aufzeichnung', 'anrufe-texte', os.renderOsAufzeichnung);
route('widerspruch', 'themen', os.renderOsWiderspruch);
route('connector-beweis', 'themen', os.renderOsConnectorBeweis);
route('revision', 'themen', os.renderOsRevision);
route('meister-seite', 'meister', os.renderOsMeisterSeite);
route('mix-antwort', 'suche', os.renderOsMixAntwort);
route('phone', 'heute', os.renderOsPhone);

// Kontakte (Spec 21) — Liste + Detail als fortlaufender Verlauf
import * as sk from './screens-kontakte.js';
route('kontakte', 'kontakte', (c: HTMLElement) => { void sk.renderKontakteListe(c); });

// Der Fall als Chat (AUFTRAG-der-fall) — der Strom als Leitform
import * as fs2 from './screens-fall-strom.js';
route('fall-strom', 'faelle', (c: HTMLElement, ctxX: AppCtx) => { void fs2.renderFallStrom(c, ctxX); });

// Bestehende screens.ts-Komponenten (geben HTMLElement zurück — Adapter).
route('vereinbarung', 'leute', (c: HTMLElement) => c.appendChild(renderVereinbarung({
  positionen: [
    { feld: 'Werkstatttermin', wert: 'Freitag, 6.3.', fundstelle: 'aus dem Anruf · Minute 04:12' },
    { feld: 'Ersatzwagen', wert: 'organisiert', fundstelle: 'aus dem Anruf · Minute 11:03' },
  ],
  parteien: [
    { name: 'Du', signiert: true, hinweis: 'signiert · heute 13:52' },
    { name: 'Lena Weber', signiert: false, hinweis: 'deine Signatur fehlt noch' },
  ],
  fallId: 'unfall-passat',
  fassung: 3,
  commitSha: 'e8a1f4',
  onSignieren: () => navigate('heute'),
  onAendern: () => navigate('anruf-laeuft'),
})));
route('tisch', 'leseplatz-tisch', (c: HTMLElement) => c.appendChild(renderTisch(() => navigate('heute'))));
route('gruppe', 'leute', (c: HTMLElement) => c.appendChild(renderGruppe()));
route('einladen', 'leute', (c: HTMLElement) => c.appendChild(renderEinladen({
  onEinladen: () => navigate('freund'),
  onAbbrechen: () => navigate('fall'),
})));
route('rueckruf', 'leute', (c: HTMLElement) => c.appendChild(renderRueckruf({
  onEntziehen: () => navigate('heute'),
  onBehalten: () => navigate('heute'),
})));
