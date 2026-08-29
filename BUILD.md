# BUILD.md — Bau-Auftrag für Claude Code / Codex

*Repo: C-0711/MMC-OS · Stand: 2026-08-30 · Ausführung: lokal auf dem Mac des Auftraggebers*

---

## Der Auftrag in einem Satz

**Baue `docs/spec/desktop-app-v0.1.md` als Electron-App — gegen die Constraints aus
`docs/spec/technical-spec-v0.1.md`, im Look des `docs/spec/design-brief-for-claude.md`,
mit dem Prototyp `docs/spec-prototyp/gitchain-os-prototyp-v0.1.html` als visueller Referenz.**

## Lesereihenfolge (Pflicht, vor der ersten Zeile Code)

1. `docs/spec/README.md` — Glossar (Eingang · Deutung · Fall · Schlüssel), der eine Satz
2. `docs/spec/desktop-app-v0.1.md` — das WAS: ein Fenster, drei Zustände, sechs Flächen
3. `docs/spec/technical-spec-v0.1.md` — das WIE: Vault, Ingress, Decision, Gateway, NFRs
4. `docs/spec/design-brief-for-claude.md` — Design-Tokens, Screens, Grenzen
5. `docs/spec/ingress-flow-v0.1.md` + `docs/spec/interaction-voice-screen-v0.1.md` — Karten-Logik
6. `docs/spec-prototyp/gitchain-os-prototyp-v0.1.html` — im Browser öffnen, durchklicken;
   `docs/spec-prototyp/test-prototyp.js` zeigt die erwarteten Zustandsübergänge

Die übrigen Specs (supercontainer, agent-containers, boot-and-desktop, communication,
intelligent-ingester, os-manifest) sind Kontext — lesen, wo eine Entscheidung sie berührt.

## Was gebaut wird (v0.1-Scope)

Electron-App „Der ruhige Raum" mit genau diesen Flächen:

| Fläche | Muss in v0.1 |
|---|---|
| **Heute** | Begrüßung, 0–3 Karten, „Frag mich"-Feld, Zustand „Alles ruhig." |
| **Karte** | Vorschlag + Beweis-Link + [Ja][Später][Nein], Fußnote `(fall · doc · seite · commit · sig ✓)` aufklappbar |
| **Beweis** | Original-Bild mit Salbei-Rechteck (bbox aus OCR), Quellen-Zeile, [Passt][Anders][Quelle] |
| **Frag-mich-Dialog** | Antwort mit Zitat-Kacheln, jede klickbar → Beweis |
| **Fall-Ansicht** | Zeitstrahl der Commits als Erzählung, jeder Satz klappt zur Commit-Zeile auf |
| **Seitenbrett** | ausklappbar, stille Fall-Liste + Eingänge mit Zählern |

Nicht in v0.1: Umzug/Takeout, Voice, FinderSync-Extension, iOS-Spiegel.

## Lokale Ressourcen (die Keys/Endpunkte dieses Macs)

| Dienst | Adresse | Zweck |
|---|---|---|
| **belegsrv** (Vision-OCR) | `http://127.0.0.1:8787` — `POST /v1/ocr` (multipart `file`), `GET /health` | Deutung von Belegen; Antwort enthält Zeilen mit `text`, `conf`, `bbox` (normalisiert 0..1) → daraus das Beweis-Rechteck |
| **h200v vLLM** | `http://192.168.145.10:11435` — OpenAI-kompatibel, Modell `gemma4-mm` | Frag-mich-Antworten; entspricht der „lokalen Route :11435" der technical-spec |
| **Gateway** | `:7906` (per Spec; in v0.1 stubben, wenn nicht vorhanden) | einzige Außengrenze |

Regeln dazu aus dem Spec-Verbund, nicht verhandelbar:
- **Commit vor Deutung**: jeder Eingang wird byte-identisch in den Fall (Git-Repo) committet,
  BEVOR OCR/LLM ihn anfassen.
- **Agent schreibt nur Branches, nie main.** Bestätigung durch den Nutzer merged.
- **Jede Aussage trägt Beweis**: Fundstelle = Datei + Seite + Rechteck + Commit + Signatur.
- Vault = lokale Git-Repos (ein Fall = ein Repo), SHA-256-adressiert. Kein eigener Datenbank-Server.

## Technische Leitplanken

- **Electron** (per desktop-app-spec §7), TypeScript, kein Framework-Zoo — Vanilla/gering
  gehaltenes Frontend reicht für sechs Flächen. Der Prototyp ist bereits framework-frei.
- **OCR ausschließlich über belegsrv** (`/v1/ocr`). KEIN eigenes OCR-Modell, kein Upscaling,
  kein Tesseract — der Vision-Pfad ist auf diesem Rechner verbindlich (siehe CLAUDE.md des
  Auftraggebers). Die App ist Client, nie Erkennungspfad.
- **Fälle als Git-Repos** unter `~/MMC-Vault/<fall>/` (v0.1: unverschlüsselt lokal, Verschlüsselung
  ist spätere Phase). `docs/` für Eingänge, `atoms/` für Deutungen, Branches `agent/*` für Vorschläge.
- **NFRs aus der technical-spec**: Deutung < 5 s (belegsrv schafft warm 0,26 s), Frag-mich < 2 s
  + Modellzeit, App-Start ≤ 2 min inkl. Diensteprüfung.
- **Design-Tokens exakt aus dem Brief**: Canvas `#FAF7F2`, Tinte `#2E2A26`, Salbei `#8FA98F`,
  Beige `#E8DFD3`, Rosé `#D9A6A0`, Olivgold `#B8A369`. Serifen-Headline, Monospace nur in
  Quellen-Zeilen.

## Negativ-Katalog (Review-Gate — ein Verstoß = nicht mergen)

- Mehr als 3 Karten · Badge/roter Punkt/Zähler auf der Bühne · Icon-Dock · Navigations-Menü-Baum
- Tabelle als Fall-Ansicht (Erzählung ist Pflicht)
- Terminal-Vokabular („commit", „hash", „sig") im Haupttext — nur in der aufklappbaren Fußnote
- Sync-Anzeige · Chat-Verlauf als Scrollliste · Einstellungs-Seiten-Wüste
- Blau/Lila-SaaS-Gradients, Bounce-Animationen, Konfetti

## Arbeitsweise

1. Gerüst: `app/` im Repo-Root (Electron + TS + Build via `npm start`), Fenster mit den drei
   Zuständen ruhig/fragend/antwortend.
2. Vault-Schicht: Fall-Repos anlegen/lesen, Eingang-Commit, Branch-Vorschlag, Merge-bei-Ja.
3. Ingress: Drop-Zone/Watch-Ordner → Commit → belegsrv-Deutung → Karte oder still.
4. Beweis-Viewer: Bild + bbox-Rechteck (die bbox kommt normalisiert, y-Achse beachten).
5. Frag-mich gegen vLLM, Antworten mit Zitat-Kacheln aus den Atoms.
6. Fall-Ansicht als Erzählung aus `git log`.
7. Je Etappe: committen mit sprechender Message; `test-prototyp.js`-Erwartungen als Vorlage
   für eigene Zustandstests.

## Definition of Done (v0.1)

- [ ] Foto in die App ziehen → Eingang-Commit sichtbar im Fall-Repo (vor jeder Deutung)
- [ ] Karte erscheint mit Vorschlag, „Woher weißt du das?" öffnet Beweis mit Salbei-Rechteck
- [ ] [Ja] merged den Agent-Branch, Karte legt sich ab, Bühne zeigt „Alles ruhig."
- [ ] Frag-mich beantwortet eine Frage mit mindestens einer klickbaren Zitat-Kachel
- [ ] Fall-Ansicht erzählt die Historie in Sätzen, jeder Satz klappt zur Commit-Zeile auf
- [ ] Kein Punkt des Negativ-Katalogs verletzt
