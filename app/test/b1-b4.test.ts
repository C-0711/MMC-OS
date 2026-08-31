/**
 * b1-b4.test.ts — DoD aus BEFUND-live-dogfood.md: B1 (Unterschrift)
 * und B4 (ruhige Timeout-Karte, Kontext-Deckelung).
 *
 * B1-DoD 1: Grep über Renderer-Strings — „Siegel/siegeln/prägen" = 0
 *           nutzer-sichtbare Treffer; „Unterschrift" an allen Stellen.
 * B4-DoD 6: Timeout-Fehler → die ruhige Karte, kein Stacktrace im DOM.
 * B4-Kontext: Top-k + Token-Budget statt Flut (sammleKontext-Grenzen).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Quellen lesen (nicht dist): vom Test-Dateiort zurück ins Repo.
// Kompiliert liegt dieser Test in dist/test/test/ — die Quellen liegen
// in ../../src (app/). Wir suchen sie robust über process.cwd().
const RENDERER_DIR = path.join(process.cwd(), 'src', 'renderer');
const MAIN_DIR = path.join(process.cwd(), 'src', 'main');

// Nutzer-sichtbare String-Container (textContent/innerHTML/placeholder/HTML-Text)
const SICHTBAR = /(?:textContent|innerHTML|placeholder)\s*=\s*['"`]([^'"`]+)['"`]/g;

describe('B1 — Unterschrift statt Siegel', () => {
  const dateien = ['screens.ts', 'screens-onboarding.ts', 'screens-os.ts',
    'screens-kontakte.ts', 'screens-fall-strom.ts', 'index.html', 'app.ts'];

  test('DoD 1: kein nutzer-sichtbares „Siegel/prägen" mehr', () => {
    const verstsöße: string[] = [];
    for (const d of dateien) {
      const src = fs.readFileSync(path.join(RENDERER_DIR, d), 'utf-8');
      for (const m of src.matchAll(SICHTBAR)) {
        if (/siegel|siegeln|prägen/i.test(m[1])) {
          verstsöße.push(`${d}: ${m[1].slice(0, 60)}`);
        }
      }
    }
    assert.deepEqual(verstsöße, [], 'Siegel-Wörter dürfen Nutzer nie sehen');
  });

  test('Unterschrift an den Kernstellen', () => {
    const screens = fs.readFileSync(path.join(RENDERER_DIR, 'screens.ts'), 'utf-8');
    assert.ok(screens.includes('Das ist deine Unterschrift.'), 'Onboarding-Titel');
    assert.ok(screens.includes('Unterschrift anlegen'), 'Knopf-Text');
    const quellen = fs.readFileSync(path.join(RENDERER_DIR, 'screens-os.ts'), 'utf-8');
    assert.ok(quellen.includes('unterschrift ✓'), 'Quellzeilen tragen unterschrift ✓');
  });
});

describe('B4 — ruhige Karte statt Stacktrace + Kontext-Deckelung', () => {
  test('DoD 6: Timeout-Pfad rendert die ruhige Karte, nie den Methodennamen', () => {
    const app = fs.readFileSync(path.join(RENDERER_DIR, 'app.ts'), 'utf-8');
    assert.ok(app.includes('Der Denker antwortet gerade nicht.'), 'ruhiger Satz');
    assert.ok(app.includes('zeitüberschreitung nach 30 s'), 'Mono-Zeile mit Fundstelle');
    // Der alte harte Fehler-String ist weg:
    assert.ok(!/fehlerEl\.textContent = `Fehler: \$\{/.test(app),
      'kein "Fehler: <message>"-String mehr im Frag-mich-Pfad');
  });

  test('Kontext-Deckelung: Top-k + Token-Budget in sammleKontext', () => {
    const suche = fs.readFileSync(path.join(MAIN_DIR, 'suche.ts'), 'utf-8');
    assert.ok(suche.includes('MAX_TREFFER'), 'Top-k-Grenze');
    assert.ok(suche.includes('MAX_TOKEN_SCHAETZ'), 'Token-Budget');
    assert.ok(suche.includes('score > 0'), 'Score-0 fliegt zuerst raus');
  });

  test('.env wird im Main geladen (B4-Ursache 1: VLLM_URL-Default)', () => {
    const main = fs.readFileSync(path.join(MAIN_DIR, 'main.ts'), 'utf-8');
    assert.ok(main.includes('ladeEnv'), '.env-Loader vorhanden');
    assert.ok(main.includes("process.env[schluessel] === undefined"), 'Env gewinnt über Datei');
  });
});
