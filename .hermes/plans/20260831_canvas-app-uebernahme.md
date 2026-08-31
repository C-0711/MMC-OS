# Canvas → App: Alle Screens + Navigation übernehmen — Implementationsplan

> **For Hermes:** Mit subagent-driven-development Task für Task umsetzen. Mac-Team kann parallel nach diesem Plan bauen.

**Ziel:** Alle verbindlichen Screens des Design-Canvas (OS-Sprache, Onboarding, Übergänge) werden in die Electron-App (`app/`) übernommen — inklusive einer vollständigen Navigation, die jeden Screen erreichbar macht.

**Architektur:** Vanilla-TS-DOM-Komponenten (kein Framework, wie `beweis.ts`/`screens.ts` es bereits vormachen). Ein zentraler `Screen`-Router im Renderer ersetzt die 4 festen `zustand`-Strings durch benannte Screens. Design-Tokens aus `os-tokens.css` → `app/src/renderer/tokens.css`. Jeder Canvas-Screen wird 1:1 als Render-Funktion überführt; Übergangs-Screens (page-10) werden als Motion-Verhalten (max 300ms, eine Bedeutung je Animation) auf die Zielscreens gelegt, nicht als eigene Seiten.

**Tech Stack:** Electron + TypeScript (bestehend), keine neuen Dependencies, Playwright/Integrationstest bestehend in `app/test/`.

---

## 0. Quellen & Verbindlichkeit (vor dem Bau lesen)

- Canvas-Stand: Branches `claude/canvas-sanduhr`, `claude/canvas-meister-buerger`, `claude/canvas-uebergaenge` (alle gemerged in lokale Canvas-Kopie), `docs/design-canvas/`
- **VERBINDLICH (übernehmen):** page-7 (OS-Sprache, 30 Screens), page-8 (Onboarding, 14 gültige Screens, 3 verworfen NICHT übernehmen: ObWohnort/ObAutonomie/ObSiegel), page-9 (Bausteine → Tokens), page-10 (Übergänge, 6 = Motion-Verhalten)
- **ARCHIV (NICHT übernehmen):** page-1 (blaues Glas Ist-Stand), page-2 (NavA/B/C verworfen), page-3 (macOS-Seitenleiste verworfen), page-6 (iOS-Stimmungsarchiv). Nur als Referenz.
- Regeln: `docs/spec/massen-ingest-v0.1.md`, `docs/spec/meister-seite-v0.1.md`, `docs/spec/buerger-assistant-v0.1.md`; Design-Anleitung in `docs/AUFTRAG-ingest-mac.md` (Sanduhr, Scan-First)

**Hard rules aus dem Canvas (Negativ-Katalog, Abnahme-Kriterien):**
- Nie rot für Fehler; Schloss-Zeile still (ObScanBericht)
- Kein Dashboard, keine Badges/Zähler als Status (ObAllesRuhig)
- Kein Euro-Zeichen im Wohnzimmer-Kontext der Sanduhr (ObSanduhr)
- Animation max 300ms, eine Bedeutung je Animation (`--os-motion-max`)
- Serif NIE fett (Playfair 400), Quellzeile NUR Mono 11px
- Aufnehmen als Textlink, nicht als Triumph-Button (ObSanduhrFertig)

---

## 1. Vollständige Screen-Liste (alle 50 zu übernehmenden Screens)

### Gruppe A — Onboarding & AUTH (page-8, 14 Screens)
| # | Canvas-Datei | Screen | Bereits in `screens.ts`? |
|---|---|---|---|
| A1 | ObNull | Erster Start — „Wirf mir irgendetwas hin." | nein |
| A2 | ObErfolg | Der erste Erfolg — ganzes Onboarding | `renderObErfolg` ✅ prüfen |
| A3 | ObRettung | Tag 2 — Rettungs-Karte | `renderObRettung` ✅ prüfen |
| A4 | ObAutonomieKarte | Tag 3 — Autonomie als Karte | nein |
| A5 | ObEingeladen | Eingeladen — ein Bildschirm | nein |
| A6 | ObSanduhr | Sanduhr — Ingest läuft, Hügel wächst | nein |
| A7 | ObSanduhrFertig | „bereit, wenn du es bist" | nein |
| A8 | ObSanduhrNicken | Das Nicken — 300ms, ein Ereignis | nein |
| A9 | ObScanBericht | Scan-First „Darf ich?" | nein |
| A10 | ObBuergerKarte | Rechnung mit Beweis, ein Wort | nein |
| A11 | ObAllesRuhig | „Alles ruhig." — Zustand mit Würde | nein (app.ts hat `ruhig`-Zustand → ausbauen) |
| A12 | ObAnmeldung | AUTH: ein Feld, ein Knopf | nein |
| A13 | ObCode | AUTH: Code, 10 Minuten | nein |
| A14 | ObZwoelfWorte | AUTH: Zwölf Worte, Notar-Moment | nein |

### Gruppe B — OS-Alltag (page-7, 30 Screens)
| # | Canvas-Datei | Screen | App-Anknüpfung |
|---|---|---|---|
| B1 | OsHeute | Heute — Karte (Desktop) | `ruhig`-Zustand erweitern |
| B2 | OsBeweis | Der Beweis — wichtigster Screen | `beweis.ts` ✅ (passt schon) |
| B3 | OsPhone | Karte+Liste — Phone (später iOS, hier Desktop-schmal) | nein |
| B4 | OsFall | CTAX als Fall | `fall-ansicht`-Zustand → echtes Fall-Screen |
| B5 | OsAnrufBeweis | Beweis für einen Anruf — die Minute | beweis.ts wiederverwenden, Kontext Anruf |
| B6 | OsKatalog | Katalog ohne Ordner (Buderus) | nein |
| B7 | OsUebernahme | Übernahme — Einwilligung (Klon-Annahme) | nein |
| B8 | OsUebergang | Übergang — Brücke nach draußen, geschwärzt | nein |
| B9 | OsVereinbarung | Vereinbarung — signiert + Anker | `renderVereinbarung` ✅ prüfen |
| B10 | OsAnrufKommt | Anruf kommt — Klon zu Klon | nein |
| B11 | OsAnrufLaeuft | Anruf läuft — Mitschrift + Beschluss-Karte | nein |
| B12 | OsText | Text — Nachricht=Commit, Zitat=Referenz | nein |
| B13 | OsFreund | Freund — ein Baum, zwei Klone | nein |
| B14 | OsAusgruendung | Ausgründung — Kapsel wächst nie von allein | nein |
| B15 | OsGruppe | Gruppe — vier Klone, ein Baum | `renderGruppe` ✅ prüfen |
| B16 | OsLeseplatz | Leseplatz — Original, Lesung als Folie | nein |
| B17 | OsTisch | Tisch — zwei Originale, Gegenprobe | `renderTisch` ✅ prüfen |
| B18 | OsEinladen | Einladen — Erlaubnis statt Besitz | `renderEinladen` ✅ prüfen |
| B19 | OsSuche | Frag alles — Brain als Bildschirm | nein |
| B20 | OsRueckruf | Rückruf — Erlaubnis beenden | `renderRueckruf` ✅ prüfen |
| B21 | OsStapel | Stapel durch — Ingester sortiert allein | nein |
| B22 | OsNeuesThema | Neues Thema — Ingester legt Fälle an | nein |
| B23 | OsMeet | Meet — Tisch in Echtzeit | nein |
| B24 | OsDivergenz | Divergenz — zwei Zeugen | nein |
| B25 | OsAufzeichnung | Aufzeichnen — Zustimmung committet | nein |
| B26 | OsWiderspruch | Widerspruch — zwei Systeme, ein Attribut | nein |
| B27 | OsConnectorBeweis | Connector-Beweis — Systemzelle | nein |
| B28 | OsRevision | Neue Revision — stiller Pull | nein |
| B29 | OsMeisterSeite | Meister-Seite — Quelle an/aus | nein (Spec 20) |
| B30 | OsMixAntwort | Mix-Antwort — Ehrlichkeitszeile | nein |

### Gruppe C — Übergänge (page-10, 6 = Motion-Regeln, KEINE eigenen Screens)
| # | Canvas-Datei | Verhalten → wohin |
|---|---|---|
| C1 | UeKarteTipp | Tap: 150ms eine Spur tiefer, kein Ripple → auf alle Karten (B1, A10) |
| C2 | UeAufwachsen | Miniatur → Leseplatz: 300ms ease-out wachsen, Karte tritt 25% zurück → B1→B16 |
| C3 | UeLeseplatzAnkunft | Rechteck steht am Betrag, nichts slidet → B16 |
| C4 | UeMinuteSprung | Sprung auf die Minute → B5 |
| C5 | UeSchalterMoment | Schalter: 600ms Sanduhr (Ausnahme von 300ms, dokumentiert!) → A9 |
| C6 | UeNickenLaeuft | Nach Nicken läuft still → A8→A6 |

---

## 2. Navigations-Konzept (der fehlende Menübereich, wie der User ihn will)

**Erkenntnis aus Canvas + Code:** Navigation ist KEINE Seitenleiste (page-3 verworfen) und KEIN Register (NavB verworfen). Verbindlich ist die OS-Sprache: Screenwechsel über Karten und Textlinks. Aber der User will einen expliziten Menübereich mit Sprüngen — daher:

### 2.1 Siegel-Menü (neu, im Stil der OS-Sprache)
Das runde Olivgold-Siegel (oben rechts, „Du") wird zum einzigen Menü-Eingang. Klick öffnet ein stilles Overlay (kein Dropdown-Rauschen): weiße Karte, 16px-Radius, Serifen-Einträge, Untertitel in Sans 13:

```
┌─────────────────────────────┐
│  Du                          │
│  ── Heute (B1)               │
│  ── Fälle (B4, B6, B22)      │
│  ── Anrufe & Texte (B5,B10-B12, B25) │
│  ── Themen (B21, B22, B26-B28)│
│  ── Leseplatz & Tisch (B16, B17, B23) │
│  ── Leute (B13-B15, B18, B7) │
│  ── Suche (B19)              │
│  ── Meister-Seite (B29, B30)  │
│  ── Zurücksetzen / AUTH (A12) │
└─────────────────────────────┘
```

- Anrufe und Themen sind genau die Bereiche, die der User genannt hat — von Siegeln aus erreichbar.
- Jeder Eintrag: Serif 21px + zählende Untertitelzeile Mono 11 („2 Fälle · 1 Anruf"), NIE ein Badge.
- Overlay schließt mit ESC/Klick-außen, 300ms fade.

### 2.2 Router (`app/src/renderer/router.ts`, NEU)
```typescript
type ScreenId =
  // Onboarding
  | 'ob-null' | 'ob-erfolg' | 'ob-rettung' | 'ob-autonomie-karte' | 'ob-eingeladen'
  | 'sanduhr' | 'sanduhr-fertig' | 'sanduhr-nicken' | 'scan-bericht' | 'buerger-karte'
  | 'alles-ruhig'
  // AUTH
  | 'auth-anmeldung' | 'auth-code' | 'auth-zwoelf-worte'
  // OS
  | 'heute' | 'beweis' | 'fall' | 'anruf-beweis' | 'katalog' | 'uebernahme'
  | 'uebergang' | 'vereinbarung' | 'anruf-kommt' | 'anruf-laeuft' | 'text'
  | 'freund' | 'ausgruendung' | 'gruppe' | 'leseplatz' | 'tisch' | 'einladen'
  | 'suche' | 'rueckruf' | 'stapel' | 'neues-thema' | 'meet' | 'divergenz'
  | 'aufzeichnung' | 'widerspruch' | 'connector-beweis' | 'revision'
  | 'meister-seite' | 'mix-antwort';

interface Route { id: ScreenId; render(container: HTMLElement, ctx: AppCtx): void; }
navigate(id: ScreenId, ctx?: Partial<AppCtx>): void;  // ersetzt zustand-Strings
```
`zustand` in `app.ts` wird auf den Router umgestellt (alte 4 Zustände mappen: `ruhig`→`heute`, `fragend`→`heute`+Karten, `antwortend`→`mix-antwort`/`beweis`, `fall-ansicht`→`fall`).

### 2.3 Navigations-Flüsse (aus den Screens selbst, verbindlich)
- B1 Heute → Karte tippen (C1) → Karte wächst (C2) → B16 Leseplatz
- B1 → Bürger-Karte (A10) → „Original öffnen" → B16
- A6 Sanduhr → Nicken (A8) → weiter lesen; fertig (A7) → „Aufnehmen"-Textlink → B1
- B10 AnrufKommt → annehmen → B11 AnrufLaeuft → Beschluss-Karte → B5 AnrufBeweis (C4 Minuten-Sprung)
- B19 Suche → Treffer → B2 Beweis; Mix-Treffer → B30 MixAntwort (Ehrlichkeitszeile)
- B7 Übernahme → Klon angenommen → Fall erscheint in B1
- B29 Meister-Seite: Quellen an/aus (Spec 20: Quelle an/aus, Ehrlichkeitszeile in B30)
- Siegel-Menü → überall direkt.

---

## 3. Tasks (Reihenfolge; je Task = Commit)

### Etappe 1 — Fundament
**T1** `tokens.css` um fehlende Tokens ergänzen (aus `os-tokens.css`: `--os-radius-innen: 12px`, `--os-radius-blatt: 8px`, `--os-motion-max`, Serif/Klasse `.serif`, `.pill-salbei`, `.pill-still`, `.quellzeile`, `.frag`). Test: visuelle Regression bestehender Screens bleibt grün.
**T2** `router.ts` + `navigate()` bauen, `app.ts` auf Router umstellen, alte zustand-Strings mappen. Test: App startet und zeigt `heute` (bestehende Integrationstests angepasst).
**T3** Siegel-Menü bauen (`siegelmenue.ts`): Overlay, Einträge mit Zählern aus `AppCtx` (Fälle/Anrufe/Themen aus `window.mmc.vault.listFaelle()`), ESC/Klick-außen, 300ms fade. Test: Klick auf Siegel öffnet, Eintrag navigiert, Overlay schließt.

### Etappe 2 — Onboarding (Gruppe A, Reihenfolge = Erlebnis)
**T4** A1 ObNull + A2 ObErfolg (renderObErfolg gegen Canvas prüfen, Abweichungen fixen).
**T5** A6+A7+A8 Sanduhr-Trio: 24px-SVG-Sanduhr, Körner 3-4/s Olivgold 1px, Hügel wächst, „9.500 Seiten"-Zeile, kein Euro. Nicken = Taille 300ms aufleuchten (C6).
**T6** A9 ObScanBericht: Quellen-Karten (Serif-Name, Mono-Zahlen, Mini-Sanduhr), Schloss-Zeile still, „Darf ich?" — Aufnehmen als Textlink. Schalter-Moment C5 (600ms, die dokumentierte Ausnahme).
**T7** A10 ObBuergerKarte: Rechnung 89€, Beweis-Rechteck-Miniatur, Quellzeile, Stimmt/Anders/Frag-nicht-wieder (beweis.ts-Stil, schmaler).
**T8** A11 ObAllesRuhig + A3 ObRettung + A4 ObAutonomieKarte + A5 ObEingeladen.

### Etappe 3 — AUTH (T9: A12+A13+A14; ein Task, drei einfache Screens, ObZwoelfWorte mit Copy-Button der NICHT in Zwischenablage loggt)

### Etappe 4 — OS-Kern (die Straße)
**T10** B1 OsHeute (ruhig-Karte ausbauen: „Guten Morgen. Alles ruhig." + Karte „Umsatzsteuer fällig in 2 Tagen" mit Quellzeile) + C1/C2 Motion.
**T11** B16 OsLeseplatz + C3 (Original mit Folie, stehendes Rechteck, „Seite 4 von 12 · unverändert seit Aufnahme").
**T12** B19 OsSuche (Brain-Screen: Frage-Pill oben, Treffer als Quellzeilen-Karten) + B30 OsMixAntwort (Ehrlichkeitszeile: „Bis 14.09. weiß ich es aus dem Finanzamt-Brief — danach …").
**T13** B2 prüfen (beweis.ts deckt OsBeweis; OsAnrufBeweis B5 als Variante mit Minuten-Anzeige + C4 Minuten-Sprung).
**T14** B4 OsFall (Erzählung aus `fallErzaehlung()`, Ding-Karte „CTAX. Ein Ding wartet.", Erinner-Karte mit „zugesagt im Anruf vom Donnerstag · Minute 27:50").

### Etappe 5 — Verbindung & Leute
**T15** B7 OsUebernahme + B13 OsFreund + B14 OsAusgruendung + B15 renderGruppe prüfen.
**T16** B18 renderEinladen prüfen + B17 renderTisch prüfen + B23 OsMeet (Tisch in Echtzeit, Multi-eyes).
**T17** B8 OsUebergang (geschwärzte Mail-Vorschau) + B9 renderVereinbarung prüfen (signierte Fassung + Anker-Zeile).

### Etappe 6 — Kommunikation
**T18** B10+B11+B12 (Anruf kommt/läuft, Text=Commit) + B25 OsAufzeichnung (Zustimmung wird committet).

### Etappe 7 — Ingester & Industrielle Beweise
**T19** B21 OsStapel + B22 OsNeuesThema („Da fängt etwas an: Photovoltaik" — Ingester legt Fälle an).
**T20** B26 OsWiderspruch (2,1mm vs 2,3mm) + B27 OsConnectorBeweis (Systemzelle) + B28 OsRevision (stiller Pull: „Teamcenter meldet M-4711").
**T21** B6 OsKatalog (Buderus: Flügelradzähler-Frage → „Vertikaler Einbau in Falleitungen." mit Beweis-Form).

### Etappe 8 — Meister & Abschluss
**T22** B29 OsMeisterSeite (Quelle an/aus pro Quelle, verdrahtet an Spec 20) + B3 OsPhone (schmale Fassung für Phone-Layout).
**T23** Siegel-Menü-Zähler live verdrahten (Fälle, offene Anrufe, Themen aus Vault), Navigations-Flüsse aus §2.3 als Integrationstest.

### Etappe 9 — Verifikation
**T24** Abnahme-Suite: (a) jeder ScreenId rendert ohne Fehler (Headless-Loop über alle 50), (b) Negativ-Katalog-Checks (keine roten Fehler-Farben, kein Badge, Serif nie fett — per DOM-Scan), (c) Motion ≤ 300ms außer dokumentierter Sanduhr-Schalter 600ms, (d) bestehende Tests grün, (e) manuelles Durchklicken: Siegel-Menü → jeder Bereich → zurück.

---

## 4. Dateien

- **Neu:** `app/src/renderer/router.ts`, `app/src/renderer/siegelmenue.ts`, `app/src/renderer/screens/onboarding.ts`, `app/src/renderer/screens/auth.ts`, `app/src/renderer/screens/os.ts` (oder je Screen eine Datei, wie `beweis.ts`)
- **Ändern:** `app/src/renderer/app.ts` (zustand→Router), `app/src/renderer/tokens.css`, `app/src/renderer/index.html`
- **Vorlage:** jede `*.dc.html` aus `docs/design-canvas/` — HTML/CStruktur 1:1 in DOM-Bau übersetzen (kein innerHTML für Nutzdaten, wie in screens.ts)
- **Tests:** `app/test/screens.test.ts` (neu, Render-Loop), `app/test/integration.test.ts` (Flüsse), bestehende Tests anpassen

## 5. Risiken & offene Punkte

1. **screens.ts-Funktionen gegen Canvas diffen** — sie wurden vor den neuesten Canvas-Commits gebaut; wortwörtliche Abweichungen sind Token-Bruch (Trellbuchung in T4/T15-T18 als Prüfschritt).
2. **3 verworfene Onboarding-Screens NICHT bauen** (ObWohnort/ObAutonomie/ObSiegel) — Verführung ist groß, weil sie "fertig aussehen".
3. **C5 600ms widerspricht `--os-motion-max: 300ms`** — im Canvas dokumentierte Ausnahme; als Konstante `MOTION_SCHALTER = 600` mit Kommentar.
4. **B3 OsPhone** ist eigentlich iOS — hier nur als schmale Desktop-Fassung; echte iOS-App ist ein eigener Auftrag (nicht dieser Plan).
5. **Daten-Lücken:** OsMeet/OsDivergenz brauchen Live-Präsenz (Multi-eyes) — Backend-Abhängigkeit; erst mit Mock-Daten bauen, Live-Anbindung als eigener Task wenn Backend da ist.
