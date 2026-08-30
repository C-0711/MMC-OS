# gitchain-ref — README: echt vs. Mock + Laptop-Betrieb

*Antwort auf den Kontrakt-Check vom Mac-Team (Stand: nach Commit „Kontrakt-Fixes")*

---

## Was ist echt, was ist Mock — die Systemränder-Doktrin

**ECHT (die Mechanik, auditiertbar mit `git log`):**
- Fall-Container = echte Git-Repos (klonbar, Erzählung liest echte Historie)
- Commit vor Deutung — Eingänge byte-identisch mit sha256 + Sidecar
- Branch-only — Deutungen auf echten `vorschlag/*`-Branches, main unberührt
- Deploy-Policy, Korrektur-Lernen (Policy-Versionen), Fassungen (Multi-eyes, kanonischer Hash)
- Fundstellen-Validierung: `dokument (doc) | anruf (wav+minute) | connector (system+objekt+revision)` — fail closed
- Fail-closed überall: unbekannte Systeme/Sitzungen/Fassungen → 400/404

**MOCK (nur am Systemrand):**
- Teamcenter/PIM/ERP-**Inhalte** (Mechanik echt, Daten erfunden)
- SMTP-Zustellung (`zustaeller.js`: Interface echt, Mock aktiv; SMTP für euren K8s vorbereitet → `SMTP-SETUP.md`)
- Signaling-Transport (TCP-JSON statt WebRTC-WS; Nachrichten + Typ-Trennung echt)
- Signatur-Krypto (did:key in Demo-Form; echte Verifikation gehört in die Enclave des Macs)

**Formel:** die Beweiskette ist echt, die Eingänge sind Attrappen. Grenze Mock/echt verläuft ausnahmslos an den Systemrändern, nie in der Mitte.

## Laptop-Betrieb (KONTRAKT-FIX Nr. 1)

```bash
git clone https://github.com/C-0711/MMC-OS.git
cd MMC-OS/docs/gitchain-ref

# Vault & Ports frei wählbar (kein /opt/data mehr hartkodiert):
GITCHAIN_REF_ROOT=~/mmc-ref GITCHAIN_REF_PORT=3361 node server.js
# → Signaling auf PORT+1 (3362), API auf 3361, Vault in ~/mmc-ref
```

`GITCHAIN_REF_ROOT` ersetzt in allen Modulen (server, auth, connectors, fassung, lernen) den hartkodierten Pfad. Die App-Seite kann jetzt lokal dagegen entwickeln.

## Wo gitchain-ref läuft (KONTRAKT-FIX Nr. 2)

| Instanz | Ort | Status |
|---|---|---|
| **gitchain-ref v0.4** | Hermes-Container des Design-/Spec-Flusses (127.0.0.1:3361/:3362) | laufend, 85 Tests über 9 Suiten — **nicht vom Mac erreichbar** (isolierter Container) |
| `api-gitchain.0711.io` | euer K8s (`@0711/registry` 0.3.0, Postgres) | anderer Dienst — das ist euer Produktions-Registry-Pod, nicht gitchain-ref |

**Empfehlung:** gitchain-ref gehört als **Dev-Dependency neben die App** (Laptop-Start wie oben) oder als eigener Dev-Pod in euren K8s-Namespace. Es ist bewusst ein eigenständiges Verzeichnis ohne externe Abhängigkeiten (nur Node-Stdlib + git).

## Kontrakt-Endpunkte für die App (KONTRAKT-FIX Nr. 3 — alle gebaut)

| App-Bedarf | Endpunkt | Form |
|---|---|---|
| Anruf-Sitzung + Transkript | `POST /api/v2/fall/:id/anruf` | Transkript gleich mitgeben ODER nachliefern |
| Transkript-Nachlieferung | `POST /api/v2/fall/:id/anruf-transkript` | während des Gesprächs (lokale STT) |
| **Transkript abrufen (App-Form!)** | `GET /api/v2/anruf/:sitzungId/transkript` | `{art:'anruf', wav, dauer?, titel?, zeilen:[{zeit:'MM:SS', sprecher, text}]}` — **unverändert in den Fall-Vault committierbar** |
| **wav-Bytes (Anhören ab Minute)** | `GET /api/v2/anruf/:sitzungId/wav` | `audio/wav` |
| Tisch: Fall-Doc-Liste | `GET /api/v2/fall/:id/docs` | für die Nebeneinander-Ansicht |
| Tisch: Doc-Bytes | `GET /api/v2/fall/:id/doc/<pfad>` | Beweis-Viewer-Quelle (Pfad-Traversal blockiert) |

**Kontrakt-Test** (`test-kontrakt.js`, 8/8): nutzt exakt die App-Form aus dem Mac-Kontrakt-Check — inkl. `zeilen[1] = {zeit:'04:12', sprecher:'Gerd', …}` aus dem OsAnrufBeweis-Szenario.

## Signaling (:3362) — Host/Port & Einordnung

Läuft im gleichen Prozess (PORT+1). Einordnung stimmt mit dem Mac-Befund überein: **Etappe 5** — die App hat noch keinen Live-Call-Client; der Stub wartet (Klingeln mit Fall-Kontext, SDP/ICE-Relay, Typ-Trennung), sobald das Call-UI drankommt.

## Alle Tests (Stand)

```
test-kontrakt 8 · e2e 10 · brain 9 · auth 10 · lernen 7
· connectors 10 · call 8 · b6-screens 9 · fassung 13   = 84/84
```

(Suiten mit geteilten Laufzeitdaten einzeln mit frischem Zustand laufen lassen — der Kontrakt-Test räumt seine eigenen Fälle.)
