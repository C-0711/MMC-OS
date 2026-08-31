# ABNAHME-mac — Messprotokoll

*Abnahme ist Messung, nicht Reparatur. Blocker werden berichtet, nicht weggecommittet.*

**Prüfer:** Design-/Review-Session (Cloud) · **Datum:** 2026-08-31
**Gemessener Stand:** `origin/main` = `401cfce` — **nicht** der erwartete Prüfstand `b27d777` (siehe Blocker B1).

---

## §1 Repo-Stand · Install · Testpflicht

| Prüfung | Soll | Ist | Urteil |
|---|---|---|---|
| Commit auf origin/main | `b27d777` | `401cfce` — `b27d777` weder auf origin noch in irgendeinem erreichbaren Klon (`git cat-file -t b27d777` → `fatal: Not a valid object name`) | ✗ **B1** |
| npm install (frisch, `rm -rf node_modules && npm ci`) | läuft durch | läuft durch; **keine neuen Runtime-Deps vorhanden** — `dependencies: none`, devDeps unverändert (@electron/packager, @types/node, electron, typescript) | ✓ (aber nicht der erwartete Stand) |
| typecheck | grün | grün (`tsc --noEmit` beide Configs) | ✓ |
| Tests | **53/53** | **32/32** — wörtlich: `# tests 32 · # suites 10 · # pass 32 · # fail 0` | ✗ **B1** |

**Abbruch-Kriterium greift:** 53/53 ist auf diesem Stand nicht messbar, weil die Nachtschicht-Funktionen (Siegel-Menü, Anruf-Live/DataChannel, Coalescing-Ingest, Update-Overlay, T14-Release-Skripte) auf `origin/main` **nicht existieren**. Kein Modul `src/main/call/`, `src/main/auth/`, `src/main/connectors/`; kein `release`-Skript in package.json. Die §3/§4-Abnahme wurde deshalb **nicht fortgesetzt** — nicht weil sie scheiterte, sondern weil der Prüfgegenstand fehlt.

## §2 (entfällt — siehe Auftrag)

## §3 Funktions-Test in der IDE

Auf dem gemessenen Stand nur eingeschränkt möglich; die Durchklick-Pfade setzen `b27d777` voraus.

- [ ] ⊘ Siegel-Menü, 9 Bereiche mit echten Zählern — *Screen existiert auf 401cfce nicht (renderer: app.ts/beweis.ts/screens.ts ohne Siegel-Menü)*
- [ ] ⊘ Onboarding/Sanduhr — *Canvas-Vorlagen liegen (docs/design-canvas, PRs #6–#8), App-Code fehlt auf diesem Stand*
- [ ] ⊘ Ingest 10+ Docs · Coalescing · Ehrlichkeits-Antworten — *kein Coalescing-Code auf 401cfce*
- [x] ✗→Messwert Headless-Ingress (`node test-headless-ingress.js` nach `npm run build`): läuft an, Fall wird erstellt, bricht dann ab — wörtlich:
  ```
  1. Fall anlegen...
     Fall erstellt: stricker-2026
  ✗ Fehler: Beleg nicht gefunden: /root/Downloads/Stricker/WhatsApp Image 2026-07-28 at 11.07.28.jpeg
  ```
  → Testdaten-Pfad ist maschinengebunden (hartkodierter `~/Downloads/Stricker`-Pfad); auf jedem anderen Rechner rot. **Befund, keine Reparatur** (Fixture-Pfad gehört parametrisiert — Entscheidung beim Coder).
- [ ] ⊘ Anruf-Live zweifensterig (zwei MMC_VAULTs, DataChannel, 30s-Wachmann) — *kein call/-Modul auf 401cfce*
- [ ] ⊘ Crash-Test (`kill -9` → Log) — *kein Crash-Logging in main.ts auf diesem Stand (kein uncaughtException-Handler, kein Log-Pfad)*
- [ ] ⊘ Backup (Bundle → `git clone`-Gegenprobe) — *kein Backup-Code in src/ auf diesem Stand (grep backup/bundle = 0 Treffer)*

## §4 Signierter Release (T14)

Nicht messbar aus dieser Prüf-Umgebung — und das ist eine **Umgebungs-, keine Produkt-Aussage**: die Cloud-Session hat kein macOS, und die Geräte-Brücke auf dem Mac ist eine isolierte Linux-VM (`uname: Linux`; `security`/`codesign`/`xcrun`/`spctl` prinzipiell nicht vorhanden). Die vier harten Gegenproben **müssen auf dem Mac selbst laufen** (Coder-Session in der IDE):

- [ ] `security find-identity -v -p codesigning` — Developer-ID vorhanden?
- [ ] `xcrun notarytool store-credentials` — Profil eingerichtet? (nur prüfen, Credentials nie ins Repo)
- [ ] `npm run dist` + `release` — *auf 401cfce existiert kein `release`-Skript; `dist` = electron-packager darwin/arm64*
- [ ] Gegenproben: `codesign --verify --deep --strict`, `spctl -a -vv`, SHA256-Abgleich Artefakt↔Release-Notiz, Gatekeeper-Öffnung auf einem sauberen Mac

## §5 Dieses Dokument

Liegt als `app/ABNAHME-mac.md` im Repo. ✓/✗/⊘-Legende: ✓ gemessen und bestanden · ✗ gemessen und nicht bestanden · ⊘ auf diesem Stand nicht messbar (Prüfgegenstand oder Werkzeug fehlt — Grund steht dabei).

## §6 Keine-Bugs-Liste (bewusst offen — NICHT „reparieren")

- STT (Speech-to-Text) — bewusst offen, kein Bug
- PAT-pflichtiger Signal-Push — bewusst offen
- still-blinkendes Update-Overlay — bekannt, bewusst offen
- OCR-Platzhalter — bewusst offen

## Blocker (berichtet, nicht weggecommittet)

| # | Blocker | Wirkung |
|---|---|---|
| **B1** | Prüfstand `b27d777` ist nicht auf `origin/main` — die Nachtschicht-Commits (neue Deps, 53 Tests, Siegel-Menü, Call-Live, Release-Skripte) sind ungepusht in der lokalen Coder-Session | §1-Testpflicht (53/53) und praktisch ganz §3/§4 nicht messbar; Abnahme pausiert bis zum Push |
| B2 | `test-headless-ingress.js` hängt an hartkodiertem Maschinen-Pfad (`~/Downloads/Stricker/…`) | Test ist nur auf einem Rechner grün — als Testpflicht-Bestandteil untauglich, bis Fixtures im Repo liegen |
| B3 | §4-Werkzeuge (codesign/notarytool/spctl) existieren nur auf macOS direkt — weder Cloud noch Geräte-VM können signieren oder verifizieren | T14-Abnahme kann ausschließlich die Mac-IDE-Session leisten |

**Nächster Messlauf:** sobald `b27d777` (oder Nachfolger) auf `origin/main` liegt — dann §1 komplett neu (frischer `npm ci`, 53/53), danach §3-Durchklick in der IDE und §4 auf dem Mac.

---

# MESSLAUF 2 — 2026-08-31 · Stand `abe7e00` (origin/local-merge)

*Auf Anweisung aus PR #9: `git fetch && git checkout local-merge`. B1 ist damit aufgelöst — der Prüfstand liegt auf origin (alle sechs Nachtschicht-Commits per ls-remote verifiziert).*

## §1 — komplett neu gemessen

| Prüfung | Soll | Ist | Urteil |
|---|---|---|---|
| Stand | `abe7e00` | `abe7e00` ausgecheckt (enthält b27d777) | ✓ |
| `rm -rf node_modules dist && npm ci` | läuft | läuft | ✓ |
| typecheck | grün | grün (beide Configs) | ✓ |
| Tests | **53/53** | **46 pass / 2 fail / 48 gemessen** — wörtlich: `# tests 48 · # suites 10 · # pass 46 · # fail 2`; zusätzlich 4 Live-Tests übersprungen (`⏭️ belegsrv not reachable, skipping live test`) | ✗ **B4** |

**Die beiden roten Tests, wörtlich — beide dieselbe Wurzel:**

```
not ok 3 - T17: AnrufLive — Phasen rufend → beendet, Zeilen mit Minute
  error: Cannot find module '../../renderer/anruf-live-renderer.js'
not ok 6 - dist/test/test/screens.test.js
  error (direkt ausgeführt): Cannot find module '../../renderer/router.js'
```

**Diagnose (Befund, nicht repariert):** `test/tsconfig.json` kompiliert nach `dist/test` und zählt die Quellen einzeln auf — **alle `src/main/*`-Module, aber keine einzige `src/renderer/*`-Datei**. `screens.test.js` und `anruf-live.test.js` requiren aber `../../renderer/router.js` bzw. `../../renderer/anruf-live-renderer.js` → `dist/test/renderer/` existiert nie → deterministisch MODULE_NOT_FOUND auf jedem frischen Checkout. Auf dem Coder-Mac war der Lauf vermutlich grün, weil dort ein älterer `dist/`-Stand oder ein anderer Include-Stand lag. Der Fix wäre eine Zeile im Include — **Entscheidung und Commit gehören dem Coder** (Abnahme repariert nicht).

**Zur 53:** 48 gemessen + 4 übersprungene belegsrv-Live-Tests ≈ 52–53. Die 53/53-Pflicht ist also nur mit laufendem belegsrv (`127.0.0.1:8787`) messbar — Umgebungsvoraussetzung im Auftrag nachtragen.

## B2 nachgemessen

Unverändert auf `abe7e00`: `test-headless-ingress.js:43` hardcodet `os.homedir() + '/Downloads/Stricker/WhatsApp Image 2026-07-28 at 11.07.28.jpeg'` — auf jedem fremden Rechner rot. **B2 bleibt offen.**

## §3 — headless messbar, gemessen

- [x] ✓ **Backup → git clone-Gegenprobe** (T-Backup): Temp-Vault mit einem Fall (`MMC_VAULT=/tmp/abn-vault`), dann `backupJetzt()` aus `dist/test/src/main/backup.js` — wörtlich: `backupJetzt: {"faelle":1,"bundles":1}` → Bundle unter `~/MMC-Vault-Backup/testfall/testfall-2026-08-31T07-51-31-447Z.bundle` → `git clone <bundle>` → Inhalt byte-identisch (`beleg`). **GEGENPROBE=bestanden.**
- [x] ✓ **Crash-Netz vorhanden:** `log.ts:50/61` installiert `uncaughtException`/`unhandledRejection` → stilles rotierendes Log (`userData/logs/app-YYYY-MM-DD.log`, 14-Tage-Aufräumen), kein crashReporter (Telemetrie-Verbot eingehalten); `produktionsbetrieb.test` grün. Der `kill -9`-Livetest selbst bleibt Mac-IDE (⊘ hier).
- [ ] ⊘ Siegel-Menü-Durchklick, Ingest-Coalescing, Anruf-Live zweifensterig, 30s-Wachmann — Code liegt jetzt vor (`siegelmenue.ts`, `ingest.ts`, `anruf-live.ts` + Renderer), aber Durchklick braucht die laufende App: **Mac-IDE-Session.**

## §4 — unverändert B3

`release`-Skript existiert jetzt (`npm run dist && node scripts/release-notes.js`). Signieren/Verifizieren weiterhin nur auf macOS direkt möglich — Cloud und Geräte-Linux-VM können es prinzipiell nicht.

## Blocker-Stand nach Messlauf 2

| # | Status | Kern |
|---|---|---|
| B1 | ✅ aufgelöst | Prüfstand liegt auf `origin/local-merge` (abe7e00) |
| B2 | offen | hartkodierter Stricker-Pfad in test-headless-ingress.js:43 |
| B3 | offen (strukturell) | codesign/notarytool/spctl nur in der Mac-IDE |
| **B4** | **neu** | 2/48 Tests rot auf frischem Checkout: `test/tsconfig.json` include kompiliert keine `src/renderer/*` nach `dist/test` → MODULE_NOT_FOUND für `router.js` und `anruf-live-renderer.js`; außerdem setzt 53/53 laufenden belegsrv voraus |

**Testpflicht-Urteil Messlauf 2: NICHT grün (46/48).** Kein Weiterbauen auf dieser Basis, bis der Coder B4 entschieden hat — der Fix ist klein, aber er gehört ihm.
