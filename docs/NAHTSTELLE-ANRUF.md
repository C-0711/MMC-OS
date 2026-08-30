# Nahtstelle Anruf — Befund und fehlende Endpunkte

Stand 2026-08-30, gemessen von der App-Seite (Etappe 4, Commit `319f3fe`).
Alles hier ist geprüft, nicht vermutet. Adressat: Backend-Team („fehlende
Endpunkte — dann nennst du sie mir einfach").

---

## 1. Befund: auf 192.168.145.10:3361 läuft NICHT die gitchain-ref

Genannt war „Minuten-Fundstellen auf :3361, Signaling auf :3362" auf
`192.168.145.10`. Gemessen am 2026-08-30:

| Probe | Erwartet (docs/gitchain-ref/server.js) | Tatsächlich auf 192.168.145.10:3361 |
|---|---|---|
| `GET /api/v2/health` | `{service:'@gitchain/ref', version:'0.3.0-lernend', backend:'git-fs'}` (server.js:157–159) | `{service:'@0711/registry', version:'0.3.0', backend:'postgres', containers:4303, …}` |
| `GET /api/brain/metrics` | Route existiert in der Ref | Express-HTML `Cannot GET /api/brain/metrics` (404) |
| `GET /api/chain/status` | „referenz (kein chain-backend…)" | `GitChain Content Blockchain`, base-sepolia, Contract `0xAd31…aEc7` |
| Fehler-Schlüssel | `fehler` (server.js durchgängig) | `error` |
| `POST /api/v2/fall/:id/anruf` | 201 `{sitzungId, fall, gestartet, hinweis}` (server.js:245–249) | `{"error":"Anmeldung erforderlich"}` |
| TCP :3362 (Signaling) | offen (server.js: SIGNALING_PORT 3362) | **zu** (`nc -z` schlägt fehl) |

Konsequenz: Der Dienst dort ist `@0711/registry` (identische Health wie
`api-gitchain.0711.io` — die Domain proxyt vermutlich auf diesen Host).
Die gitchain-ref v0.3-lernend mit Anruf-Endpunkt und Signaling ist unter
der genannten Adresse **nicht erreichbar**.

**Rückfrage ans Backend:** Wo läuft die echte gitchain-ref, bzw. ist der
Anruf-Endpunkt auf der registry deployed? Und falls der Schreibpfad dort
Anmeldung verlangt: Device-Login ist der einzige Auth-Pfad der App
(Secrets werden nie übertragen).

**Nachtrag (Statuscode-Messung, 2026-08-30):** Das Backend-Team bestätigt
die Adresse (öffentlich api-gitchain.0711.io, LAN 192.168.145.10:3361,
Cluster `gitchain-service.gitchain.svc.cluster.local:3361`) — es ist also
die eine GitChain-API, kein Proxy-Irrtum. Unterscheidung Auth-Gate vs.
fehlende Route:

    POST /api/v2/fall/x/anruf          → 401   } beide 401 → globale Auth-
    POST /api/v2/fall/x/gibt-es-nicht  → 401   } Middleware, nicht entscheidbar
    GET  /api/v2/fall/x/anruf/y/transkript → 404   } GETs sind nicht auth-
    GET  /api/v2/fall/x/docs               → 404   } gegated (Health geht ja)
                                                     → Routen FEHLEN sicher

Die Lese-Endpunkte aus §3 (Transkript, wav, Doc-Liste) fehlen also
definitiv. Ob der Anruf-POST hinter der Auth existiert, klärt erst ein
Device-Login.

## 2. Lokaler Betrieb der Ref scheitert an hartkodiertem Vault-Pfad

`docs/gitchain-ref/server.js:299` macht `mkdirSync('/opt/data/gitchain-ref/vault')`
— ohne Env-Schalter (nur `GITCHAIN_REF_PORT` existiert, server.js:21).
Auf einem Entwickler-Mac: `EACCES`, Start unmöglich ohne sudo.

**Wunsch:** `GITCHAIN_REF_VAULT`-Env analog zu `GITCHAIN_REF_PORT`.
(Die App selbst hat das: `MMC_VAULT`, Default `~/MMC-Vault`.)

## 3. Fehlende Endpunkte für die Anruf-Nahtstelle

Die App (Etappe 4) spricht noch KEIN HTTP zur Referenz — die
Übereinstimmung besteht auf Kontrakt-Ebene: die Fundstellen-Form
`{art:'anruf', wav, minute}` ist deckungsgleich mit der
Ref-Validierung (server.js:82). Für die echte Verdrahtung fehlen:

### a) Transkript einer Sitzung abrufen

`POST /api/v2/fall/:id/anruf` liefert nur `{sitzungId, …}`, aber kein
Transkript. Gebraucht wird z. B. `GET /api/v2/fall/:id/anruf/:sitzungId/transkript`
**exakt** in der Form, die die App als Transkript erkennt (`istTranskript`):

```json
{
  "art": "anruf",
  "wav": "anruf-2026-08-27.wav",
  "dauer": "23:41",
  "titel": "Rückruf Werkstatt Weber",
  "zeilen": [
    { "zeit": "11:03", "sprecher": "Weber", "text": "… 12.500,00 Euro …" }
  ]
}
```

Pflicht: `art:'anruf'`, `wav`, `zeilen[]` mit `zeit` als `MM:SS`,
`sprecher`, `text`. Optional: `dauer`, `titel`.

### b) wav-Bytes zur Sitzung

Für „Anhören ab MM:SS" im Beweis-Overlay: `GET …/anruf/:sitzungId/wav`
(oder Doc-Abruf per Hash, siehe d). Commit VOR Deutung gilt auch für
Audio — die App verwahrt die Datei erst im Vault, dann wird gedeutet.

### c) Signaling-Host/Port

Zeilen-JSON-Protokoll (signaling-tcp.js) ist verstanden; :3362 ist zu.
Realistisch erst Etappe 5 — die App hat noch keinen Live-Call-Client
(OsRueckruf ist Capability-Entzug, kein Anruf).

### d) Tisch/Stapel (Priorität 2)

- Fall-Doc-Liste: `GET /api/v2/fall/:id/docs` → `[{name, sha256, bytes, empfangenIso}]`
- Doc-Abruf per Hash: `GET /api/v2/doc/:sha256` → Bytes

## 4. Kontrakt-Referenz aus der App (zum Gegenlesen)

- Fundstelle Anruf-Atom: `{art:'anruf', doc, wav, minute:'MM:SS', dauer}`,
  conf 1.0, kein `bbox`/`seite` — Ref validiert `f.wav && f.minute` (server.js:82).
- Vault-Namenskonvention: verwahrter Dateiname ist zeitgestempelt
  (`<ISO-Timestamp>-<Originalname>`, vault.ts:188–190); `fundstelle.doc`
  zeigt auf den VERWAHRTEN Namen (app.ts:833).
- Fehler-Schlüssel der Ref ist `fehler`, nicht `error` — die App wird
  darauf asserten.

## 5. AUFLÖSUNG (2026-08-30, gleicher Tag): Endpunkte geliefert und quer-bewiesen

Das Backend-Team hat noch am selben Tag geliefert (Merge `fda3220`):
`GITCHAIN_REF_ROOT`-Env (§2 erledigt), `GET /api/v2/anruf/:sitzId/transkript`
(§3a), `GET …/wav` (§3b), `GET /api/v2/fall/:id/docs` + `…/doc/<pfad>` (§3d,
per Pfad statt Hash — für den Beweis-Viewer ausreichend), plus
Transkript-Mitgabe beim `POST …/anruf` bzw. Nachlieferung via
`…/anruf-transkript`.

Gemessen, lokal (`GITCHAIN_REF_ROOT=/tmp/gitchain-ref-test`, :3361):

- Health → `@gitchain/ref 0.3.0-lernend git-fs` — der ROOT-Schalter
  funktioniert, EACCES weg.
- `test-kontrakt.js` (vom Backend): **8/8** — inkl. Pfad-Traversal-Block
  und 404 für unbekannte Sitzungen.
- **Quer-Beweis** (`/tmp/nahtstelle-cross.js`): Sitzung an der Ref eröffnet,
  Transkript per GET geholt und **unverändert** in die laufende App
  (CDP :9222) gefüttert → `deutungAusTranskript` liefert 2 Atoms, Betrag
  `12.500,00` mit Fundstelle `{art:'anruf', minute:'11:03', wav}` →
  `NAHTSTELLE-CROSS-OK`. Was die Ref liefert, deutet die App ohne
  Anpassung — der Kontrakt hält in beide Richtungen.

**Was von §1/§3 offen bleibt:**
- Deployment: auf `192.168.145.10:3361` läuft weiterhin die registry
  (postgres), nicht diese Ref — die neuen Routen sind dort erst nutzbar,
  wenn die Ref deployed oder die Routen in die registry übernommen sind.
- §3c Signaling (:3362) — unverändert Etappe 5.
- Anruf-POST hinter der registry-Auth: klärt erst ein Device-Login.
