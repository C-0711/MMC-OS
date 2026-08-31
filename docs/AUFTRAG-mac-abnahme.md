# AUFTRAG — Mac-Abnahme: MMC-OS App testen & Release bauen

*Für: Claude Code auf dem Mac · Von: Hermes (Spec-/Live-Seite) · Erstellt 31.08.2026 spät · Repo C-0711/MMC-OS, Branch `local-merge`, HEAD erwartet: `b27d777`*

---

## 0. Der eine Satz

**Fünf Etappen sind gebaut und auf Linux getestet (53/53 grün) — du beweist sie auf dem Mac mit echtem Vault, echtem dmg und echtem Anruf zwischen zwei Fenstern, und baust den ersten signierten Release.**

## 1. REPO-STAND ZIEHEN

```bash
cd <dein/MMC-OS-Checkout>
git fetch origin
git checkout local-merge    # oder: git pull origin local-merge
git log --oneline -6
# Erwartung (neueste zuerst):
# b27d777 Etappe D — Anruf-Live: Klon zu Klon über die eigene Registry
# c98a238 Etappe C — Produktionsbetrieb: Crash-Netz, Backup-Job, Signatur+Notarize, Auto-Update
# 4a76b97 Etappe B — LiveStore: Screens hören auf, Statik zu zeigen
# 794cf92 Etappe A — Anbindung: 5 Datenkanäle im Main
# c8b4419 Canvas-Übernahme: alle 44 Screens + Siegel-Menü-Navigation
```

Falls `origin` den Branch noch nicht hat: Der Stand liegt im lokalen `local-merge`
des Hermes-Rechners — **push zuerst** (siehe §6 unten, Abschnitt „Push").

```bash
cd app
npm install        # neue Deps: electron-builder, electron-updater, @electron/notarize
npm test           # MUSS: 53/53 grün (auf dem Mac genauso wie auf Linux)
```

**Abbruch-Kriterium:** Weniger als 53 grün → NICHT weiterbauen, Fehlerliste
zurückschreiben. Alles andere ist verfrüht.

## 2. PFlicht-Lektüre vor dem Test

1. `app/RELEASE.md` — Pipeline, Credentials, Checkliste (dein Bau-Blatt)
2. `.hermes/plans/20260831_anbindung-produktionsbetrieb.md` — die Etappen A–D mit DoD
3. `docs/design-canvas/os-tokens.css` — Negativ-Katalog gilt weiter (nie rot für
   Fehler, kein Badge, Serif nie fett, Motion ≤300ms)

## 3. TESTLAUF 1 — Funktion in der IDE (30 Minuten)

```bash
cd app
npm start          # baut + startet Electron
```

Durchklicken, in dieser Reihenfolge (jeder Punkt = eine Zeile im Abnahme-Report):

**A. Siegel-Menü & Navigation (Etappe Grundlage)**
- [ ] Siegel oben rechts klicken → Overlay mit 9 Bereichen (Heute, Fälle,
      Anrufe & Texte, Themen, Leseplatz & Tisch, Leute, Frag alles,
      Meister-Seite, Anmeldung)
- [ ] Fälle-Zähler als Mono-Fußnote zeigt echte Zahl aus `~/MMC-Vault`
- [ ] Jeder Menü-Eintrag navigiert; ESC/Klick-außen schließt (300ms fade)

**B. Onboarding & Sanduhr (Screens, Etappe B)**
- [ ] localStorage leeren (`mmc-onboarding` löschen) → „Wirf mir irgendetwas hin."
- [ ] Sanduhr-Screen zeigt Körnerfall (3-4/s, kein Regen), Hügel wächst
- [ ] Scan-First: Bericht zählt nur Dateien, KEIN Inhalt, geschützte als
      stille Schloss-Zeile (🔒, nie rot)

**C. Ingest live (Etappe A, W1a in der App)**
- [ ] Ordner mit 10+ PDFs/TXTs einwerfen (Drag auf „hierher ziehen")
- [ ] bericht_aktualisiert coalesct (max 1/Sekunde), kleine Dateien zuerst
- [ ] Fragen erscheinen aus echten Atomen; Frage klicken → Antwort mit
      Quellzeile; kein Zitat = Ehrlichkeits-Satz, nie erfundene Daten

**D. Anruf-Live (Etappe D) — der Kern-Test**
- [ ] Zwei App-Fenster (zweimal `npm start` mit getrennten `MMC_VAULT`,
      z.B. `MMC_VAULT=/tmp/vault-a npm start` und `=vault-b`)
- [ ] Beide bei gitchain angemeldet (PAT verwahrt — sonst: Ehrlichkeits-Satz
      „Der Anruf kam nicht zustande" ist korrekt, KEIN Bug)
- [ ] Fenster A: „Anrufe" → Klon-Name von B → „Anrufen"
- [ ] Erwartung LAN/VPN: DataChannel öffnet, Phase „läuft", Sende-Feld:
      Text landet SOFORT bei beiden mit Minute (MM:SS)
- [ ] Erwartung ohne PAT/Registry: nach 30s „gescheitert" mit Würde-Satz
      („Niemand hat abgenommen — nichts geht verloren")
- [ ] Auflegen (Rose-Pille) → sauber „beendet"
- [ ] Aufzeichnung: „Zustimmen" → im Vault liegt `aufzeichnung-einwilligung-*.json`
      VOR dem ersten Ton (`git log` im Fall zeigt den Commit)

**E. Produktion (Etappe C)**
- [ ] Terminal: `kill -9 <pid>` der App → Neustart: App lebt, Log-Zeile in
      `~/Library/Application Support/mmc-os/logs/app-YYYY-MM-DD.log`
- [ ] Backup: nach 1 Stunde liegt `~/MMC-Vault-Backup/<fall>/<fall>-<ISO>.bundle`;
      Gegenprobe: `git clone <bundle> /tmp/restore` → Inhalt identisch
- [ ] update-frage-Overlay NICHT erscheinen solange kein Feed — still

## 4. TESTLAUF 2 — Signierter Release (T14, der Abnahme-Kern)

**Voraussetzung (vorher auf dem Mac einrichten, NIE committen):**
```bash
# 1. Developer-ID in der Keychain? (muss 1 gültige zeigen)
security find-identity -v -p codesigning

# 2. Notarytool-Profil einmalig speichern (Apple-ID + App-spezifisches PW)
xcrun notarytool store-credentials MMC-OS \
  --apple-id <apple-id> --team-id <team-id> --password <app-pw>
```

**Bauen:**
```bash
cd app
export MM_NOTARY_PROFILE=MMC-OS      # sonst: Warnung, unnotarisiert
npm run dist                          # electron-builder: dmg arm64, signiert
npm run release                       # RELEASE-NOTES.md mit SHA256
```

**Abnahme des Artifacts (alle vier müssen grün sein):**
```bash
codesign --verify --deep --strict --verbose=2 release/arm64/MMC-OS.app
spctl -a -vv release/arm64/MMC-OS.app          # "accepted" = notarisiert
shasum -a 256 release/*.dmg                    # mit RELEASE-NOTES.md abgleichen
```

- [ ] Frisches dmg auf sauberem Mac (oder `xattr -dr com.apple.quarantine`
      umgehen testen): Gatekeeper lässt es ÖFFNEN (notarisiert)
- [ ] In der gepackten App: Siegel-Menü, Ingest, Backup-Job wie in §3
- [ ] 24h-Soak falls möglich: Fenster offen, 100 PDFs einwerfen, RAM im
      Activity Monitor beobachten (Anstieg >20% = Melden)

## 5. ABNAHME-REPORT (dein Deliverable)

Schreibe `app/ABNAHME-mac.md` mit:
1. Versions-Stand (`git log --oneline -1`)
2. Checkliste aus §3/§4 mit ✓/✗ je Punkt
3. Bei ✗: Repro-Schritt + Log-Auszug aus `~/Library/Application Support/mmc-os/logs/`
4. Die drei Ausgaben von codesign/spctl/shasum wortwörtlich
5. Commit + push auf `local-merge` (oder neuer Branch `claude/mac-abnahme`)

## 6. BEKANNTE GRENZEN (keine Bugs — nicht „fixen")

- **STT/Audio fehlt bewusst**: Der DataChannel beweist Klon-zu-Klon; Spracherkennung
  (whisper.cpp) ist der nächste Bauauftrag, NICHT Teil dieser Abnahme.
- **Signal-Push braucht PAT**: Ohne Anmeldung schlägt nur der Remote-Push fehl —
  der lokale Signal-Commit entsteht trotzdem (Tests beweisen es).
- **Update-Overlay**: Erscheint nur, wenn `registry.gl.0711.io/updates/mmc-os/`
  antwortet. Kein Overlay = korrekt still.
- **OCR/VISION-Lane**: Platzhalter-Tempo (15ms) — echte DocTR/Florence-Dienste
  docken später an `services.ts` an.

## 7. PUSH (falls noch nicht geschehen)

Hermes soll `local-merge` auf origin legen (steht bei ihm aus). Falls du den
Stand anders bekommst (Patch/Bundle), sag Bescheid — Backup-Bundles sind
selbst wiederherstellbar.

**Reihenfolge:** erst §1 (53/53), dann §3 (Funktion), dann §4 (Release).
Kein Schritt ohne grünen Vorgänger. Bei Blockern: Report schreiben, NICHT
workarounds in den Code committen — die Abnahme ist Messung, nicht Reparatur.
