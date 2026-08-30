# Etappe 4 — Canvas-Einführung: bis die verbindliche OS-Sprache vollständig umgesetzt ist

*Bau-Auftrag für Claude Code · Repo: C-0711/MMC-OS · Stand: nach Merge `d4442e7` (main)*

---

## Ausgangslage (was schon fertig ist)

- ✅ `app/` — Electron-App, Etappen 1–3: Vault (echte Git-Repos!), Ingress, Beweis-Viewer mit bbox, Frag-mich, Fall-Erzählung
- ✅ `claude/bausteine-komponenten` gemerged auf main: 40 Komponenten-Klassen, Siegel (44px, rund, Radialverlauf, Serif-„Du"), pill-System
- ✅ `docs/design-canvas/` — 54 Dateien: alle Artboards + `os-tokens.css` + `canvas.json`
- ✅ `docs/spec/` — 14 Specs + Manifest (inkl. enterprise-humans, team-raum, communication, ingester)

## Ziel (Definition of Done)

**Jeder Artboard der OS-Sprache-Seite (Seite 7, DIE VERBINDLICHE FASSUNG) und der Onboarding-Seite (Seite 8, Null-Fragen-Weg) ist in der App als Zustand/Fläche erreichbar und sieht pixelgleich aus wie im Canvas.** Vergleichsmaßstab: `docs/design-canvas/gitchain-einfache-oberflaeche.html` (offline öffnen) und die einzelnen `Os*.dc.html` / `Ob*.dc.html` Artboards. Die `.dc.html`-Dateien enthalten die verbindlichen Maße — dort nachmessen, nicht raten.

## Die Arbeiten, priorisiert

### A. Fundstellen-Typ „Anruf" (Voraussetzung für OsAnruf*)
1. `Atom.fundstelle` erweitern: `art: "dokument" | "anruf"`
   - `dokument`: `{doc, seite, bbox}` (bestehend)
   - `anruf`: `{wav, minute: "04:12", dauer?: "00:08"}` — Rechteck entfällt, stattdessen Transkript-Zeile gehighlightet
2. Beweis-Viewer (`beweis.ts`): Fall `art === 'anruf'` → statt Bild+Rechteck: **Transkript-Timeline rendern** (Sprecher · Zeit · Text; die Fundstelle-Zeile mit 2px Rosé + 8% Füllung markiert, wie OsAnrufBeweis.dc.html)
3. `deutung.ts`: Anruf-Transkripte als Eingangsart (`kanal: "anruf"`), Frist-/Zusagen-Extraktion auf Minuten fundieren

### B. Die Screens der OS-Sprache nachbauen (gegen die Artboards)

| App-Zustand | Artboard | Kern-Elemente |
|---|---|---|
| Heute (vorhanden, verfeinern) | `OsHeute.dc.html` | Begrüßung, max. 3 Karten, Frag mich; **neu:** Fußzeile links „Gerd · Stefan extern · 7 weitere" (geteilte Fälle), Zeugen-Zeile |
| Beweis Dokument (vorhanden) | `OsBeweis.dc.html` | Buttons: **Stimmt / Original öffnen / Falsch zugeordnet** (Canvas-Benennung!) |
| Beweis Anruf (neu) | `OsAnrufBeweis.dc.html` | Header „ANRUF · REVIEW & PLANNING · DONNERSTAG · 42 MIN" + Play-Icon, Transkript-Timeline, Quellzeile `Fall · anruf-*.wav · Minute 04:12 · Commit · Signatur ✓` |
| Fall-Ansicht (vorhanden, erweitern) | `OsFall.dc.html` | Erzählung + geteilte-Fälle-Kette (Übernahme/Übergang) |
| Vereinbarung (neu) | `OsVereinbarung.dc.html` | signierte Fassung zwischen zwei Seiten — Diff-Ansicht, beide Siegel |
| Gruppe/Tisch (neu) | `OsGruppe.dc.html`, `OsTisch.dc.html` | Team-Raum-Spec (`docs/spec/team-raum-v0.1.md`): vier Zonen Tisch/Strom/Arbeit/Akte |
| Einladen (neu) | `OsEinladen.dc.html` | Capability-Ausstellung als Flow (Scope, Dauer), kein Konto |
| Suche (vorhanden, verfeinern) | `OsSuche.dc.html` | Frag-mich-Volltext über Fälle |
| Rückruf (neu) | `OsRueckruf.dc.html` | Anruf eröffnet geteilten Fall (communication-v0.1.md §2) |

### C. Onboarding: Null-Fragen-Weg (Seite 8, gültige Fassung)

**Nur eine Frage: der Schlüssel** (`ObSiegel.dc.html` → `ObRettung.dc.html` Recovery als Notar-Moment → `ObErfolg.dc.html`). Kein Wohnort, kein Autonomie-Regler beim Start — Verhaltens-Kalibrierung übernimmt der Agent (`ObNull.dc.html` ist das Referenz-Blatt). Die drei ObWohnort/ObAutonomie*-Artboards sind ARCHIV — nicht bauen.

### D. Zeugen- und Schlüssel-Zeile (aus dem Canvas-Screenshot)

- Stille Zeile unter jedem gelesenen Atom: „gelesen auf diesem Gerät · bezeugt"
- Fußzeile: „Dein Schlüssel liegt hier · 17 Fälle versiegelt · zuletzt geankert [Datum]"

## Harte Regeln (Review-Gate, aus den Specs)

- Commit vor Deutung; Agent schreibt nie main (branch-only)
- max. 3 Karten; Stille = Zustand; kein Badge-Zähler, kein @-Schrei
- Vier Farben, Playfair 400 nie fett, Mono nur Quellzeile, Motion ≤ 300ms
- „ja" ohne sichtbaren Anker zählt nicht; Geld/Abgabe erst nach Face ID (R3)
- pixelgleicher Vergleich gegen `.dc.html` vor jedem Commit — **nicht gegen Erinnerung**

## Abnahme

1. `npm run typecheck` und alle Tests grün
2. Side-by-Side: App-Zustand neben Artboard-Screenshot — kein sichtbarer Unterschied in Layout, Farbe, Typo
3. Der Ablauf aus dem Canvas läuft Ende-zu-Ende: Eingang → Karte → Beweis (Dokument UND Anruf) → „Stimmt" → Commit → „Alles ruhig." → Frag mich mit Beweis
