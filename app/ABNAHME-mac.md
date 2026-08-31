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
