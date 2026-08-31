# Anbindung & Produktionsbetrieb — Implementationsplan

> **For Hermes:** Mit subagent-driven-development Task für Task umsetzen. Grundlage ist Commit `c8b4419` (44 Screens + Siegel-Menü + Router, 36/36 Tests grün) auf `local-merge`.

**Ziel:** Die 44 Screens hören auf, Statik zu zeigen: jeder ist mit echten Vault-/Ingest-/Dienstdaten verbunden, und die App läuft als Produkt (Signatur, Auto-Update, Backups, keine Klartext-Secrets, fährt durch Abstürze).

**Architektur:** Der Renderer bleibt DOM-Stumm — ALLE Daten kommen durch `AppCtx` bzw. `window.mmc` (preload/IPC, bestehender Vertrag aus `app/INTERFACE.md`). Neue Datenkanäle werden im Main-Prozess gebaut (`vault.ts`/`services.ts` erweitern, NIE im Renderer fetchen). Ein `LiveStore` im Renderer abonniert den Ingest per SSE-artigem IPC-Push und füttert Router + Siegel-Menü-Zähler. Produktionsbetrieb = electron-packager/Signatur + squirrel/auto-update + Vault-Backup-Job + Crash-Sicherheit (fail-closed).

**Tech Stack:** Electron 32 + TS (bestehend), git CLI (Vault, bestehend), vLLM `192.168.145.10:11435` (bestehend), pdfx/DocTR/Florence (W1a-Lanes), gitchain-Auth (Device-Login + PAT safeStorage, bestehend in `gitchain.ts`). KEINE neue Dependencies, außer electron-updater (für Auto-Update) — ein Mal bewusst.

---

## 0. Ist-Zustand (was schon da ist — nicht neu bauen)

| Baustein | Stand | Datei |
|---|---|---|
| Vault (Git-Container, byte-identisch, Vorschlags-Branches) | ✅ fertig, getestet | `app/src/main/vault.ts` |
| IPC (13 Handler: listFaelle … fallErzaehlung) | ✅ fertig | `app/src/main/ipc.ts` |
| OCR/vLLM (gemma4-mm, Frag-mich mit Zitat-Kontext) | ✅ fertig | `app/src/main/services.ts` |
| gitchain-Anbindung (Device-Login, PAT safeStorage fail-closed, Fall-Push) | ✅ fertig | `app/src/main/gitchain.ts` |
| Deutung (Betrag-Heuristik NUR im Main) | ✅ fertig | `app/src/main/deutung.ts` |
| 44 Screens + Router + Siegel-Menü | ✅ Statik | `app/src/renderer/router.ts`, `screens-os.ts`, `screens-onboarding.ts` |
| W1a-Ingest (Drei-Lane, SSE, E2E 4/4) | ✅ separat | `docs/w1a-ref/` (wird hier integriert) |

**Was FEHLT (dieser Plan):**
1. Screens tragen Statik — kein Live-Bezug zu Vault/Ingest/Anrufen
2. App hat keinen Ingest-Worker (W1a lebt nur im Ref)
3. `AppCtx.faelle`/`kartenOffen` sind nur bei 2 Stellen gefüllt
4. Kein Crash-Reporting, kein Auto-Update, kein Backup-Job, keine Signatur
5. Screens ohne Daten zeigen nichts — es fehlen Lade-/Leer-/Fehler-Zustände (OS-Sprache: still, nie rot)

---

## 1. ETAPPE A — Datenkanäle im Main (neue IPC-Handler)

### T1 · `vault:getFallUebersicht(fallId)` — Fall-Daten für OsFall
**Dateien:** `app/src/main/vault.ts` (+30 Zeilen), `app/src/main/ipc.ts`, `app/src/main/preload.ts`, `app/src/renderer/types.d.ts`
Liest aus `fallErzaehlung()` + `listAtomsMain()`: Ding-Karten (offene Aufgaben), Protokoll-Zeilen, Beteiligte (Gerd/Stefan/extern aus Absender-Atomen).
**Verifikation:** `test/vault.test.ts` erweitern: `getFallUebersicht('ctax')` → `{ dinge: [{titel, frage, quelle}], protokoll: ErzaehlSatz[], beteiligte: string[] }`.

### T2 · `ingest:*` — der W1a-Worker zieht in die App
**Dateien:** NEU `app/src/main/ingest.ts` (Port von `docs/w1a-ref/server.js` + `lanes.js`: Drei-Lane-Router TEXT/OCR/VISION, kleine zuerst, Coalesce 500ms); `ipc.ts` (+4 Handler `ingest:start/stream/ask/status`); `preload.ts`.
SSE geht im Electron über `webContents.send('ingest-event', ev)` — der Renderer abonniert per `window.mmc.onIngestEvent(cb)`.
**Verifikation:** `test/ingest.test.ts` neu: 10 Test-PDFs → `ingest:start`, Events kommen (`dokument_fertig` → `bericht_aktualisiert` → `fragen_bereit` → `done`), `ask` antwortet nur aus verarbeiteten Atomen (Ehrlichheit). W1a-DoD (a)-(d) als Tests übernommen.

### T3 · `anruf:*` — Anruf-Modelle aus Mitschriften
**Dateien:** `app/src/main/anruf.ts` (NEU): listAnrufe(fallId) aus `docs/mitschrift-*.md`/JSON (Typ aus `beweis.ts` Transkript), minutenMarkierung. `ipc.ts` +2 Handler.
**Verifikation:** Test: Mitschrift-JSON im Testfall → `listAnrufe` liefert `{id, partner, dauer, minuten:[]}`.

### T4 · `themen:*` — Themen & Stapel aus Atomen
**Dateien:** `app/src/main/themen.ts` (NEU): über `listAtomsMain` je Fall Typ-Häufigkeit (geld/datum/absender/vertrag_*), neuesThema-Vorschläge (= W1a `frageVorschlaege`-Logik auf Fall-Ebene), stapel(fallId).
**Verifikation:** Test: 3 Atome → themen = `{Rechnungen: 2, Verträge: 1}`.

### T5 · `suche:fragAlles` — der Brain-Screen an vLLM
**Dateien:** `services.ts` erweitern: `fragAlles(frage, faelle)` → sammelt Atom-Kontext über alle Fälle (paralleles `listAtomsMain`), baut Zitat-Kontext, ruft vLLM `fragMich`-Strecke; Antwort mit `{sätze, zitate[]}`, Ehrlichkeits-Flag wenn Kontext < Schwelle.
**Verifikation:** Test mit gestubbtem vLLM (`fetch` mock): Frage „Was zahle ich für Versicherungen" → Antwort zitiert `[1] hausratversicherung.pdf · S. 4`.

---

## 2. ETAPPE B — LiveStore im Renderer (Screens werden lebendig)

### T6 · `LiveStore` — eine Quelle, alle Screens
**Dateien:** NEU `app/src/renderer/store.ts`:
```typescript
class LiveStore {
  faelle: FallInfo[] = [];           // via vault:listFaelle + Refresh nach jedem Commit/Merge
  fallUebersicht: Map<string, FallUebersicht>;
  ingest: IngestState;              // via onIngestEvent
  anrufe: AnrufInfo[];
  themen: ThemenInfo[];
  ctx(): AppCtx;                     // baut AppCtx aus allem — Router & Siegel-Menü lesen NUR hieraus
  async refresh(): Promise<void>;    // nach jeder Aktion (Signatur, Aufnehmen, Merge)
}
```
`app.ts`: `appCtx()` wird `store.ctx()` ersetzt (eine Stelle, alle Screens + Menü-Zähler profitieren).
**Verifikation:** `screens.test.ts` erweitern: nach `store.refresh()` mit Stub zeigt `heute` echte Fall-Karten.

### T7 · Screens an Daten anbinden (Mapping-Tab, je Screen = ein Sub-Task/Commit)
| Screen(s) | Datenquelle | statt Statik |
|---|---|---|
| `heute`, `phone`, `alles-ruhig` | `store.faelle` + offene Vorschläge + ingest-Status | Gruß + Karten aus `listVorschlaege` |
| `fall` | T1 `getFallUebersicht` | Ding-Karten, Beteiligte |
| `beweis`, `anruf-beweis` | bestehende Strecke (beweis.ts) — Router-Adapter | schon live, nur `navigate('beweis')` aus Karten |
| `sanduhr`, `sanduhr-fertig`, `sanduhr-nicken` | T2 ingest-Events | echte Seiten-Zahlen, `sanduhrStarten()` an echter Uhr |
| `scan-bericht` | T2 `ingest:scanReport` (stat()-Lauf, kein Commit) | echte Quellen, geschützte Anzahl |
| `buerger-karte` | Vorschläge-Atom (geld/datum) | echter Betrag, echte Quellzeile |
| `stapel`, `neues-thema` | T4 | echte Themen/Fall-Vorschläge |
| `suche`, `mix-antwort` | T5 | echte vLLM-Antwort, Ehrlichkeitszeile aus Zitat-Delta |
| `anruf-kommt/-laeuft`, `text`, `divergenz`, `aufzeichnung` | T3 | echte Anrufe/Minuten |
| `leseplatz`, `tisch`, `katalog` | `readDocAsDataUrl` + `mark-lese`-bbox aus Atomen | echtes Original als Bild/Folie |
| `widerspruch`, `connector-beweis`, `revision` | Atom-Delta zweier Commits (`vault:listAtomsMain` vor/nach) bzw. gitchain-Connector | echte Revision |
| `meister-seite` | NEU `prefs:quelleAnAus` (electron-store-frei: JSON in app.getPath('userData')) | persistente Schalter |
| `uebernahme`, `vereinbarung`, `einladen`, `freund`, `gruppe`, `rueckruf` | gitchain.ts (Freigabe/Erlaubnis-API) | echte Parteien/Signaturen |
| `uebergang` | NEU `export:mail` (verschlüsselt geschwärzt, mailto-Draft) | echte Schwärzung aus Atom-Mapping |
| AUTH-Trio | gitchain.ts Device-Login (schon da!) | echter Code-Flow statt Dummy |
| Onboarding (ob-null/erfolg/rettung/autonomie/eingeladen) | localStorage-Flag + erster echter Ingest | bleibt, wird von T2 gespeist |

**Verifikation je Sub-Task:** Screen-Test mit Stub-Daten im `store`, plus manueller Klick-Pfad im Siegel-Menü.

### T8 · Leer-/Lade-/Fehler-Zustände (OS-Sprache: still)
Jeder Screen: leer → Serif-Satz („Noch keine Anrufe — wenn einer kommt, liegt er hier."), laden → Sanduhr-Mini (nicht Spinner), Fehler → „Das kann ich gerade nicht zeigen" + Quelle des Fehlers, NIE rot.
**Verifikation:** `screens.test.ts`: jeder Screen mit leerem Store rendert ohne Wurf und mit Leer-Satz.

---

## 3. ETAPPE C — Produktionsbetrieb

### T9 · Crash-Sicherheit & Logging
**Dateien:** `app/src/main/main.ts`: `process.on('uncaughtException')` → Log + still weiter (Window neu laden); `app.getPath('userData')/logs/app-YYYY-MM-DD.log` (rotierend, 14 Tage). Electron `crashReporter` deaktiviert (Telemetrie-Verbot!), eigenes Crash-Log ins userData.
**Verifikation:** Test: geworfener Fehler im Handler → App lebt, Log-Zeile existiert.

### T10 · Vault-Backup-Job (der Tresor-Tresor)
**Dateien:** `app/src/main/backup.ts` (NEU): stündlicher Job (powerMonitor-abhängig), `git bundle create` je Fall + Pruning-Strategie: letzte 24h stündlich, danach täglich, max 30. Ziel `~/MMC-Vault-Backup/` (externer Datenträger wird in Meister-Seite wählbar).
**Verifikation:** Test: Bundle nach Backup wieder in leeres Verzeichnis klonbar (`git clone bundle`), Fall-Inhalt byte-identisch.

### T11 · Env-Hygiene & Secret-Verwahrung (Mac-Auftrag env-hygiene übernehmen)
**Dateien:** `app/.env.example` (NEU, ohne Werte), `.gitignore` (`.env`), `services.ts`: Werte NUR aus `process.env` (schon so), README-Abschnitt „Secrets". Kein PAT je im Renderer; safeStorage fail-closed (schon so in `gitchain.ts`).
**Verifikation:** `grep -r "192.168\|PAT\|secret" app/src/renderer/` → leer; Test startet ohne `.env` mit Defaults.

### T12 · Signatur & Auto-Update
**Dateien:** NEU `app/scripts/` (notarize via `@electron/notarize`? Nur wenn Apple-Developer-ID vorhanden — offene Frage unten), `electron-updater` (ein Mal neue Dependency) mit `update-server` = gitchain-OCP-Registry oder simplen HTTPS-Feed (nostr-notfalls). Update-Dialog im OS-Ton: „Eine neue Fassung liegt bereit — aufnehmen?" (Textlink, nie Auto-Install beim Bürger).
**Verifikation:** signiertes Build startet auf sauberem Mac (Gatekeeper ok); Update-Feed-Test mit Fake-Server.

### T13 · Packager & Release-Pipeline
**Dateien:** `app/package.json` dist-Script erweitern (dmg-Target), `app/RELEASE.md` (NEU): Versions-Nummer = `git describe --tags`, Changelog aus Commit-Titeln, Checkliste (Tests grün → Build → Sign → Notarize → dmg → SHA256 → Release-Notiz).
**Verifikation:** `npm run dist` erzeugt dmg; SHA256 in Release-Notiz stimmt (sha256sum gegenberechnet).

### T14 · Produktions-Abnahme (DoD)
1. `npm test` — alle grün (Vault, Ingest, Screens, Anruf, Themen, Suche)
2. Frischer Rechner: dmg installieren → App startet → Null-Fragen-Onboarding → 50 echte Dokumente einwerfen → Sanduhr zeigt echte Zahlen → Bürger-Karte aus echtem Atom → „Stimmt" committet → Siegel-Menü: Anrufe/Themen/Fälle zeigen echte Zähler → Suche antwortet mit Zitat aus eigenem Vault → Tab zu/aux → Ingest läuft durch → Backup-Job hat Bundle erzeugt
3. `kill -9` auf die App → Neustart: kein Datenverlust (Vault ist Git, letzter Commit zählt)
4. 24h-Soak: Fenster offen, Ingest 10k Seiten (Sanduhr 3-4 Körner/s): kein Memory-Anstieg > 20%, keine Warnung im Log

---

## 4. Entscheidungen (User, 31.08. — GESETZT)

1. **Apple-Signatur: VOLL bauen** — Developer-ID vorhanden, T12 komplett (sign + notarize + auto-update).
2. **vLLM-Fallback: Gemma Edge lokal im App-Bundle** — Produkt funktioniert ohne VPN; Bundle wächst (Modul-Download beim ersten Start statt im dmg, ~2-4 GB; LAN-vLLM bleibt bevorzugt wenn erreichbar).
3. **Anruf-Live: MITBAUEN** — Klon-zu-Klon-Kommunikation kommt in diesen Plan (zusätzlich zu Mitschrift-Wiedergabe). Neue Etappe D, siehe unten.
4. **Update-Feed: gitchain-Registry/OCP** — electron-updater-Feed läuft über die eigene Registry.
5. **Losgehen: Hermes baut Etappe A (T1–T5) sofort** — Etappen B/C folgen nach Abnahme.

### Etappe D — Anruf-Live (aus Entscheidung 3, nach A; Entwurf, wird bei Start verfeinert)
- **T15** Signal-Pfad: WebRTC (DataChannel) Klon-zu-Klon, Signaling über gitchain-Registry (kein Drittanbieter — „kein Anbieter dazwischen" ist Canvas-Gesetz).
- **T16** Mitschrift live: lokales STT (whisper.cpp klein) → Zeilen-Commit in den Fall je Sprecher; Minute = Zeitstempel.
- **T17** OsMeet/OsDivergenz/OsAnrufKommt/-Laeuft/OsAufzeichnung an T15/T16 verdrahten; Divergenz = beide Geräte schreiben eigene Mitschrift-Commits (zwei Zeugen, bleibt sichtbar).
- Abnahme: zwei Instanzen (zwei Vault-Klone) rufen sich an, Mitschrift erscheint bei beiden mit Minuten, Divergenz-Fall zeigt beide Versionen.

## 5. Reihenfolge & Commits

T1→T5 (Main, je 1 Commit) · T6→T8 (Renderer, je Sub-Screen 1 Commit) · T9→T13 (Prod, je 1 Commit) · T14 Abnahme. Gesamtschätzung: 3 Nachtschichten Mac-Team oder 1–2 Tage Hermes-Durchlauf.
