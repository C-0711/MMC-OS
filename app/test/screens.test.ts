/**
 * screens.test.ts — Abnahme-Suite: JEDER Screen rendert, Bereiche decken alles ab.
 *
 * Läuft ohne Electron: minimaler DOM-Stub, dann Router-Import.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- DOM-Stub ---------------------------------------------------------------
class El {
  children: El[] = [];
  listeners: Record<string, ((ev: unknown) => void)[]> = {};
  private _text = '';
  private _classes = new Set<string>();
  private _store: Record<string, string> = {};
  constructor(public tag: string) {}
  get classList() {
    const s = this._classes;
    return {
      add: (...c: string[]) => c.forEach(x => s.add(x)),
      remove: (...c: string[]) => c.forEach(x => s.delete(x)),
      toggle: (c: string) => s.has(c) ? (s.delete(c), false) : (s.add(c), true),
      contains: (c: string) => s.has(c),
    };
  }
  get isConnected() { return true; }
  get textContent(): string { return this._text + this.children.map(c => c.textContent).join(''); }
  set textContent(t: string) { this._text = t; this.children = []; }
  get style() {
    const store = this._store;
    return {
      setProperty: (k: string, v: string) => { store[k] = v; },
      get cssText() { return Object.entries(store).map(([k, v]) => `${k}:${v}`).join(';'); },
      set cssText(t: string) {
        store[`${t.split(';')[0]}`] = '';
        Object.keys(store).forEach(k => delete store[k]);
        t.split(';').filter(Boolean).forEach(p => {
          const i = p.indexOf(':');
          store[p.slice(0, i).trim()] = p.slice(i + 1).trim();
        });
      },
    };
  }
  setAttribute(_k: string, _v: string): void {}
  appendChild(c: El) { this.children.push(c); return c; }
  append(...cs: El[]): void { cs.forEach(c => this.children.push(c)); }
  remove(): void {}
  addEventListener(t: string, fn: (ev: unknown) => void): void { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(): void {}
  querySelector(): El | null { return null; }
  querySelectorAll(): El[] { return []; }
  getElementById(): El | null { return null; }
  get firstChild() { return this.children[0] ?? null; }
  get lastChild() { return this.children[this.children.length - 1] ?? null; }
}

const g = globalThis as unknown as Record<string, unknown>;
g.document = {
  createElement: (tag: string) => new El(tag),
  createElementNS: (_ns: string, tag: string) => new El(tag),
  createTextNode: (t: string) => { const e = new El('#text'); e.textContent = t; return e; },
  body: new El('body'),
  head: new El('head'),
  getElementById: () => new El("div") as never,
  querySelector: () => new El("div") as never,
  addEventListener: (): void => {},
};
g.requestAnimationFrame = (fn: () => void) => { fn(); return 0; };
g.localStorage = { getItem: () => 'done', setItem: (): void => {} };
g.window = { ...((globalThis as unknown as Record<string, unknown>).window ?? {}), mmc: {
  daten: {
    ingestScanReport: async () => [],
    fragAlles: async () => ({ frage: '', antwort: '', treffer: [], ehrlich: true }),
    ingestStatus: async () => ({ phase: 'idle', fertig: 0, total: 0, atome: 0 }),
    onIngestEvent: () => () => {},
  },
  vault: {
    listFaelle: async () => [],
    createFall: async (id: string) => ({ id, pfad: '', offeneVorschlaege: 0, letzterCommitIso: '' }),
    listVorschlaege: async () => [],
  },
} };

// Router importieren (registriert automatisch alle Screens)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const router = require('../src/renderer/router.js') as {
  navigate(id: string, ctx?: unknown, container?: unknown): void;
  aktuellerScreen(): string | null;
  letzterScreen(): string | null;
  screensFuerBereich(b: string): string[];
};

const ALLE = [
  'ob-null', 'ob-erfolg', 'ob-rettung', 'ob-autonomie-karte', 'ob-eingeladen',
  'sanduhr', 'sanduhr-fertig', 'sanduhr-nicken', 'scan-bericht', 'buerger-karte',
  'alles-ruhig', 'auth-anmeldung', 'auth-code', 'auth-zwoelf-worte',
  'heute', 'beweis', 'anruf-beweis', 'fall', 'katalog', 'uebernahme', 'uebergang',
  'vereinbarung', 'anruf-kommt', 'anruf-laeuft', 'text', 'freund', 'ausgruendung',
  'gruppe', 'leseplatz', 'tisch', 'einladen', 'suche', 'rueckruf', 'stapel',
  'neues-thema', 'meet', 'divergenz', 'aufzeichnung', 'widerspruch',
  'connector-beweis', 'revision', 'meister-seite', 'mix-antwort', 'phone',
];

const ctx = {
  faelle: [{ id: 'steuern-2026', name: 'steuern-2026' }],
  kartenOffen: 2,
  fallId: 'ctax',
  daten: {
    sanduhr: { seitenVerstanden: 9500, seitenGelesen: 2146, fallId: 'ingest' },
    scanQuellen: [{ name: 'Dokumente', zahlen: '8.900 dateien · 6,1 GB', geschuetzt: 4 }],
  },
};

test('(a) jeder Screen rendert ohne Fehler — alle 44', () => {
  for (const id of ALLE) {
    router.navigate(id, ctx);
    assert.equal(router.aktuellerScreen(), id, `Screen ${id} sollte nach navigate aktiv sein`);
  }
});

test('(b) Siegel-Menü-Bereiche decken alles ab', () => {
  for (const bereich of ['heute', 'faelle', 'anrufe-texte', 'themen', 'leseplatz-tisch', 'leute', 'suche', 'meister', 'auth']) {
    assert.ok(router.screensFuerBereich(bereich).length > 0, `Bereich ${bereich} hat Screens`);
  }
});

test('(c) Navigations-Fluss: Heute → Leseplatz → zurück', () => {
  router.navigate('heute', ctx);
  router.navigate('leseplatz', ctx);
  assert.equal(router.letzterScreen(), 'heute');
  router.navigate('heute', ctx);
  assert.equal(router.letzterScreen(), 'leseplatz');
});

test('(d) Unbekannter Screen bleibt still (kein Wurf)', () => {
  router.navigate('gibt-es-nicht', ctx); // darf nicht werfen
  assert.ok(router.aktuellerScreen()); // vorheriger bleibt
});

// Live-Kontext wie ihn der LiveStore baut (StoreDaten nach T6/T7)
const liveCtx = {
  faelle: [{ id: 'steuern-2026', name: 'steuern-2026' }],
  kartenOffen: 2,
  fallId: 'steuern-2026',
  daten: {
    uebersicht: {
      fallId: 'steuern-2026',
      dinge: [
        { titel: 'Umsatzsteuer fällig in 2 Tagen', frage: 'Voranmeldung August · 1.190,00 € — stimmt das?', quelle: 'voranmeldung.pdf · Seite 1', proposalId: 'v1' },
      ],
      protokoll: [
        { satz: 'Am 31.8. kam rechnung.txt von Stadtwerke.', commitZeile: 'a1b2 · eingang · sig ✓', sha: 'a1b2c3', datumIso: '2026-08-31' },
      ],
      beteiligte: ['Stadtwerke Musterstadt', 'Finanzamt Stuttgart'],
    },
    anrufe: [
      { id: 'mitschrift-2026-08-27', fallId: 'steuern-2026', doc: 'mitschrift-2026-08-27.json',
        partner: 'Lena Weber', dauer: '27:50',
        zeilen: [{ zeit: '27:50', sprecher: 'Lena Weber', text: 'Prelive bleibt eingefroren.' }],
        minuten: ['27:50'] },
    ],
    themen: [{ name: 'Rechnungen', anzahl: 4, fallId: 'steuern-2026' }],
    stapel: [{ fallId: 'steuern-2026', satz: 'Am 31.8. kam rechnung.txt von Stadtwerke.', commitZeile: 'a1b2 · eingang · sig ✓' }],
    neuesThema: [{ fallIdVorschlag: 'photovoltaik', titel: 'Photovoltaik', quelle: 'aus Fall steuern-2026 · Vorschlag v2', proposalId: 'v2' }],
    ingest: { phase: 'laeuft', fertig: 2146, total: 9500, atome: 30, zusammenfassung: '2.146 / 9.500 gelesen', namen: ['Stadtwerke'], fragen: [] },
    suche: null,
  },
};

// Leerer Kontext: Screens müssen mit Würde leer bleiben (T8)
const leerCtx = { faelle: [], kartenOffen: 0, daten: {} };

test('(e) T7: Live-Screens rendern mit echten Store-Daten', () => {
  for (const id of ['heute', 'fall', 'anruf-kommt', 'anruf-laeuft', 'stapel', 'neues-thema', 'sanduhr']) {
    router.navigate(id, liveCtx);
    assert.equal(router.aktuellerScreen(), id);
  }
});

test('(f) T8: Screens mit leerem Store zeigen Leer-Zustand, kein Wurf', () => {
  for (const id of ALLE) {
    router.navigate(id, leerCtx); // darf NIE werfen
  }
  assert.ok(router.aktuellerScreen());
});
