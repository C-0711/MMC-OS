# gitchain API-Referenz — api-gitchain.0711.io

> **Stand:** 2026-08-30 · **Methode:** Live-Analyse der Produktions-API per `curl` (nur öffentliche Zugriffe, ohne Credentials) **+ Quellcode-Abgleich am selben Tag** auf dem Mac: `~/Documents/0711-Gitchain/apps/service/src/` (Entry `simple-index.ts`, Mounts Z. 790–869; `src/routes/` enthält **13** Dateien, die restlichen Router liegen außerhalb — Aufschlüsselung in §4).
>
> **Legende:**
> - ✅ **live verifiziert** — Antwort wurde per curl tatsächlich erhalten (Status-Code + Body belegt).
> - 🔎 **quell-verifiziert** — im Quellcode nachgelesen (mit `datei:zeile`), nicht live gegen Prod geprüft.
> - 📋 **abgeleitet** — erschlossen, weder live noch im Code geprüft (nach dem Abgleich fast leer).
>
> ⚠️ **Deploy≠Checkout-Vermerk:** Der Live-Fehlertext `"Anmeldung erforderlich"` (§2.7) kommt in diesem Checkout **nicht vor** (`grep` über `apps/service/src` leer). Die deployte Instanz hat mindestens eine `/api/v2`-Auth-Schicht, die neuer oder anders ist als der Mac-Quellstand. Alle 🔎-Angaben gelten für den Checkout-Stand; wo Live-Verhalten abweicht, ist es markiert.

---

## 1. Basis-Konfiguration

| Eigenschaft | Wert | Status |
|---|---|---|
| Base-URL | `https://api-gitchain.0711.io` | ✅ |
| Framework | Express (`x-powered-by: Express`) | ✅ Header |
| Fronting | Cloudflare (`server: cloudflare`, HTTP/2 + h3) | ✅ Header |
| CORS | `access-control-allow-origin: *`, Methoden `GET,HEAD,PUT,PATCH,POST,DELETE` | ✅ (OPTIONS → 204) |
| Content-Type (JSON-Routen) | `application/json; charset=utf-8` | ✅ |
| ETag | Express-Standard (`W/"..."`) aktiv | ✅ Header |
| Health-Service | `@0711/registry` v0.3.0, Backend `postgres` | ✅ `/api/v2/health` |

---

## 2. Live-verifizierte Endpunkte

### 2.1 `GET /api/v2/health` — Registry-Health ✅

```bash
curl -sS --max-time 10 https://api-gitchain.0711.io/api/v2/health
```

```json
{
  "status": "ok",
  "service": "@0711/registry",
  "version": "0.3.0",
  "backend": "postgres",
  "containers": 4303,
  "citations": 3921,
  "anchors": 113,
  "embeddings": "954"
}
```

**Interessante Felder:** `containers`/`citations`/`anchors`/`embeddings` sind Live-Zähler der Registry (Metrik-Format `"954"` als String bei embeddings — Inkonsistenz, vermutlich Alias/Spaltenname aus Postgres). Wichtig: `/health` (ohne `/api/v2`) → **404** — dieselbe Konvention wie die gitchain-Referenz-Instanz (Health liegt unter `/api/v2/health`, Monitoring muss den vollen Pfad prüfen).

### 2.2 `GET /api/chain/status` — Content-Blockchain-Status ✅

```bash
curl -sS --max-time 10 https://api-gitchain.0711.io/api/chain/status
```

```json
{
  "service": "GitChain Content Blockchain",
  "connected": false,
  "network": "base-sepolia",
  "contractAddress": "0xAd31465A5618Ffa27eC1f3c0056C2f5CC621aEc7",
  "contractDeployed": true,
  "walletAddress": "read-only",
  "balance": "0",
  "stats": {
    "totalManifests": 10,
    "totalBatches": 9,
    "confirmedBatches": 0,
    "pendingBatches": 9
  },
  "contract": "0xAd31465A5618Ffa27eC1f3c0056C2f5CC621aEc7",
  "explorer": "https://sepolia.basescan.org/address/0xAd31465A5618Ffa27eC1f3c0056C2f5CC621aEc7"
}
```

**Interessant:** `connected: false`, alle 9 Batches `pending`, keine `confirmedBatches` — die Verankerung läuft aktuell nicht produktiv (Testnet base-sepolia, Read-only-Wallet). Redundanz: `contractAddress` und `contract` doppelt. Enthält direkten Basescan-Explorer-Link.

**Ticket-Antwort „läuft der Anchor-Worker?" 🔎 — es gibt keinen.** Im Quellcode existiert **kein Worker, kein Cron, kein Auto-Polling**: pending-Batches werden nur durch einen manuellen `POST /api/chain/submit` (chain-routes.ts:131–174) bestätigt. `connected` ist ein reiner RPC-Erreichbarkeits-Check, kein Worker-Status (Status-Shape: chain-routes.ts:177–188). `walletAddress: "read-only"` heißt: `ANCHOR_WALLET_KEY` ist im Deployment nicht gesetzt (Env-Konfiguration anchor-routes.ts:21–32 — `ANCHOR_WALLET_KEY` [ohne → read-only, Schreibrouten 503], `ANCHOR_CHAIN` [Default base-sepolia], `ANCHOR_RPC_URL`, `ANCHOR_CONTRACT_ADDRESS` [Default 0xAd31…aEc7]; Wallet-Adresse wird aus dem Key abgeleitet, anchor-routes.ts:162). **Fix:** `ANCHOR_WALLET_KEY` setzen + einmal manuell submitten — oder einen Scheduler davor bauen.

### 2.3 `GET /api/verify/:id` — Container-/Hash-Verifikation ✅

```bash
# Ungültiges Format:
curl -sS --max-time 10 https://api-gitchain.0711.io/api/verify/x
# → 200 {"verified":false,"hash":"x","reason":"Invalid format: not a container ID or SHA-256 hash"}

# Container-ID (URL-encoded Doppelpunkte):
curl -sS --max-time 10 \
  'https://api-gitchain.0711.io/api/verify/0711%3Aproduct%3Abosch%3A7733703118'
# → 200 {"verified":false,
#         "hint":"Container verification available via /api/v1/inject",
#         "containerId":"0711:product:bosch:7733703118"}
```

**Verhalten:** Erkennt Container-IDs nach Schema `0711:<type>:<namespace>:<identifier>`. Voll-Verifikation wird an `POST /api/v1/inject` delegiert (im `hint`-Feld verrät der Service den Weg). Hinweis: `/api/verify` ohne Parameter → 404; es ist eine `/api/verify/:id`-Route.

### 2.4 `POST /api/v1/inject` — Voll-Verifikation / Kontext-Injection ✅

Öffentlich (keine Auth). Body: `{"container_id": "..."}` **oder** `{"snr": "..."}` (Serien-/Artikelnummer).

```bash
curl -sS --max-time 30 -X POST -H 'Content-Type: application/json' \
  -d '{"snr":"7733703118"}' \
  https://api-gitchain.0711.io/api/v1/inject
```

Antwort (gekürzt):

```json
{
  "context": "\n## Key Specifications\nAnzahl der Phasen: 1.0\nMit Fernbedienung: true\n... \nProduct: CL7000i-Set 20 E\nSNR: 7733703118\nCitations: 0\nBlockchain verified: false",
  "verified": false,
  "citations": 0,
  "snr": "7733703118"
}
```

**Interessant:** Das `context`-Feld liefert ein LLM-injizierbares Spezifikations-Sheet (Key-Value-Zeilen) direkt aus dem Container — das ist der „Beweis-Kontext" für RAG. Fehlerfälle live geprüft:
- `{}` → **400** `{"error":"Provide container_id or snr"}`
- unbekannte SNR → **404** `{"error":"Repo not found for 9999999999"}`

### 2.5 `GET /api/v2/search` — Registry-Suche ✅ (öffentlich)

```bash
curl -sS --max-time 15 'https://api-gitchain.0711.io/api/v2/search?q=bosch&limit=1'
```

Antwort-Schema: `{"results": [...], "count": N}` — unterstützt Query-Parameter `q` und `limit`. Ohne Parameter liefert die Route die volle Liste. Result-Objekt:

```json
{
  "id": "0711:product:bosch:7733703118",
  "type": "product",
  "namespace": "bosch",
  "identifier": "7733703118",
  "git_url": "file:///var/lib/gitchain/repos/product/bosch/7733703118.git",
  "display_name": "CL7000i-Set 20 E",
  "description": "bob_00555347_druck.jpg",
  "latest_tag": "v5.1",
  "latest_commit": "0x28edcb5a06e0ae2a76e85f756a8b9a0c62bafdb2820773e5763286f19dbe4392",
  "visibility": "public",
  "owner_id": null,
  "created_at": "2026-05-11T12:13:31.798Z",
  "updated_at": "2026-05-11T12:28:59.044Z",
  "relations": [], "tools": [], "sketches": [],
  "ocp_state": "indexed",
  "mandant_id": null, "tenant_id": null,
  "metadata": {
    "name": "CL7000i-Set 20 E",
    "etim_class": "EC011573",
    "variant_of": "235812143",
    "cited_atoms": 26,
    "total_atoms": 55,
    "parent_master": "0711:master:bosch:235812143"
  }
}
```

**Interessant:** `ocp_state: "indexed"` (OCP-Tier-0-Status pro Container), `metadata.cited_atoms`/`total_atoms` (Beweis-Quote), ETIM-Klassen, `parent_master`-Verkettung zu Master-Containern. `git_url` zeigt auf interne Pfade (`file:///var/lib/gitchain/...`) — nicht von außen klonbar, aber beweist Container = git-Repo.

### 2.6 `POST /api/v1/search/turbo` — Vektor-Suche (TurboQuant) ✅ Route vorhanden, ⚠️ Backend-Fehler

```bash
curl -sS --max-time 20 -X POST -H 'Content-Type: application/json' \
  -d '{"query_embedding":[0.01, ...1024 Werte...], "top_k": 3}' \
  https://api-gitchain.0711.io/api/v1/search/turbo
```

Live-Verhalten:
- Ohne/ungültiges Embedding → **400** `{"error":"query_embedding must be a 1024-dim array (got length=not-array)"}` bzw. `(got length=10)` bei 10 Dim — Validierung existiert und ist präzise.
- Mit gültigem 1024-dim-Vektor → **500** `{"error":"column \"embedding_tq_polar\" does not exist","latency_ms":4041}` — **Produktions-Bug**: die TurboQuant-Polar-Spalte fehlt in der Postgres-Tabelle. Die Route ist korrekt verdrahtet (Validierung → Query), aber die DB-Migration steht aus.

**Ticket-Antwort „Migration fehlt?" 🔎 — die Migration EXISTIERT, sie ist nur nicht angewendet.** Die Query liest `embedding_tq_polar, embedding_tq_qjl, embedding_tq_rnorm, embedding_tq_xnorm` aus `neo.rag_chunks` (search-turbo.ts:88; Kommentar dort: „one-shot brute-force scan … ~100 MB I/O"). Die Spalten legt `database/migrations/2026-04-19-embedding_tq.sql:20` an (bytea, TurboQuant seed=42, b=3); für die Vision-Variante analog `2026-04-19-visual_atoms.sql:58` (Tabelle `enriched.visual_atoms`, gelesen in search-vision.ts:166). Nach der Migration müssen die Spalten noch befüllt werden: `scripts/compute-turbo-embeddings.ts`. Der Mount trägt im Code den Kommentar **„T5 — TurboQuant … staging-only until Phase 14 cutover"** (simple-index.ts:842–844) — der 500er ist also erwartbar: eine staging-only-Route ist auf Prod erreichbar, deren Migration dort nie lief. Fix: Migrationen in der Prod-DB anwenden + Befüll-Skript, oder Route auf Prod nicht mounten.

### 2.7 `POST /api/v2/search/vision` — Vision-Suche ✅ (auth-geschützt)

Ohne Auth → **401** `{"error":"Anmeldung erforderlich"}`. Route existiert (POST); GET auf denselben Pfad → 404 (nur POST registriert).

**Body-Schema 🔎** (search-vision.ts:82–97 — es ist KEINE Bild-Upload-Route, sondern Vektor-Suche über Seiten-Renderings):

```json
{
  "query_embedding": [/* 1024 floats, bge-m3 — Pflicht */],
  "method": "hnsw",          // optional: "hnsw" (Default) | "turbo"
  "k": 10,                   // optional, max 100
  "supplier_pid": "…",       // optional Filter
  "container_id": "…"        // optional Filter
}
```

Erfolgs-Response 🔎: `{results: [{id, supplier_pid, container_id, document, document_sha256, page, page_png_sha256, page_width_px, page_height_px, dpi, score}], latency_ms}` — jeder Treffer trägt Seite + PNG-SHA256 der Seiten-Grafik (Beweis-Viewer-tauglich). **Achtung Deploy≠Checkout:** Im Checkout hat diese Route KEINE Auth-Middleware; der Live-401 (`"Anmeldung erforderlich"`, deutsch — String kommt im Checkout nirgends vor) stammt aus einer Auth-Schicht der deployten Instanz, die hier nicht vorliegt. `method:"turbo"` läuft auf `enriched.visual_atoms` und dürfte auf Prod am selben Migrations-Problem wie §2.6 scheitern.

### 2.8 Authentifizierte User-Routen (401 live) ✅ Status, 📋 Inhalt

| Route | Live-Status | Body |
|---|---|---|
| `GET /v1/user` | **401** | `{"error":"Authentication required"}` |
| `GET /api/user` (v1-Compat) | **401** | `{"error":"Authentication required"}` |
| `GET /v1/admin` | **401** | `{"error":"Authentication required"}` |

Mit Fake-Bearer (`Authorization: Bearer gct_test123`) → identische 401-Antwort (Token wird geprüft, ungültig = wie fehlend — keine Token-Leak-Orakel). Erfolgs-Responses 📋 abgeleitet (User-Objekt).

### 2.9 Git Smart HTTP — `/git/<type>/<namespace>/<id>.git/*` ✅

```bash
curl -sS --max-time 10 \
  'https://api-gitchain.0711.io/git/product/bosch/7733703118.git/info/refs?service=git-upload-pack'
```

→ **200**, `content-type: application/x-git-upload-pack-advertisement`, echte pkt-line-Antwort:

```
001e# service=git-upload-pack
00000111a1c549e17a1be3d1c22b36682c199a9b929acc29 HEADmulti_ack thin-pack side-band ... symref=HEAD:refs/heads/main object-format=sha1 agent=git/2.52.0-Linux
003da1c549e17a1be3d1c22b36682c199a9b929acc29 refs/heads/main
003d7d0097693391819fa58348fc728da0189436fa43 refs/heads/v5.1
0000
```

**Das ist echtes Git:** Container sind klonbare Repos, Branch `main` + Tag/Branch `v5.1`, SHA-1-Objektformat, `git/2.52.0-Linux` serverseitig. Ein `git clone https://api-gitchain.0711.io/git/product/bosch/7733703118.git` sollte funktionieren (nicht ausgeführt — Upload-Pack-Transfer nicht getestet 📋).

Fehlerfälle live:
- `/git/.../info/refs` **ohne** `?service=` → **400** `{"error":"Invalid service parameter"}`
- `/git/.../HEAD` → **404** `{"error":"repository not found"}` (nur `info/refs` [+ vermutlich `git-upload-pack` 📋] registriert; statische Git-Dateien nicht freigegeben)
- Pfad ohne `.git`-Prefix (`/product/bosch/...`) → Express-404

### 2.4a Express-Standard-404 (unregistrierte Pfade) ✅

Jeder nicht registrierte Pfad → **404**, `text/html`:

```html
<pre>Cannot GET /pfad</pre>
```

Dokumentierte 404er (belegen, dass diese Flächen existieren aber anders lauten): `/`, `/health`, `/api/verify` (nur mit `:id`), `/api/v1/search` (nur `/turbo`), `/api/v2/containers`, `/api/v2/users`, `/api/users`, `/v1/users`, `/v1/devices`, `/v1/tokens`, `/v1/billing`, `/api/ocp`, `/api/ocp/v1`, `/api/chain` (nur `/status`), `/api/git-objects`, `/api/v1/objects`, `/api/v2/anchors`, `/api/v2/citations`.

---

## 3. API-Flächen (verifizierte + abgeleitete Pfade)

| Fläche | Präfix | Status |
|---|---|---|
| Registry v2 | `/api/v2/*` | ✅ `/api/v2/health`, `/api/v2/search` live; `search/vision` 401 · 🔎 registry-routes.ts |
| Git Smart HTTP | `/git/<type>/<ns>/<id>.git/*` | ✅ `info/refs` live · 🔎 Direkt-Routen `info/refs`, `git-upload-pack`, `git-receive-pack` mit gitAuth (simple-index.ts:592/658/718) |
| **OCP Tier-0-Protokoll** | **`/ocp/v1/*`** — NICHT `/api/ocp/v1` (daher der Live-404!) | 🔎 ocp/router.ts, öffentlich gemountet (simple-index.ts, „NO persona logic"); Sub-Routen in §4 |
| User/Auth/Admin/Billing | `/v1/*` | ✅ `/v1/user`, `/v1/admin` live 401 · 🔎 users.ts, admin.ts, billing-v1.ts, signing.ts, webhooks.ts, remotes.ts |
| v1-Compat | `/api/*` | ✅ `/api/user` live 401; `/api/v1/inject`, `/api/v1/search/turbo` live · 🔎 registry-v1-compat.ts als LETZTER Mount („search only") |
| Chain/Verify/Anchor | `/api/chain`, `/v1/chain`, `/api/verify`, `/v1/verify`, `/api/v4` | ✅ status/verify live · 🔎 chain-routes.ts, anchor-routes.ts (v4 hinter promoterKey-Middleware) |
| Discovery OCP/MCP | `/v1/ocp`, `/v1/mcp` | 🔎 Discovery + inject/tools/disclose-Subrouten (simple-index.ts:1017–1042) |
| Bridge (Root) | `/` | 🔎 bridge.ts, als Root gemountet |

---

## 4. Router-Struktur 🔎 (quell-verifiziert: simple-index.ts, Mounts Z. 790–869)

**Auflösung der „22 Router":** `src/routes/` enthält exakt **13** Dateien (ls-verifiziert): `admin, batch, billing-v1, bridge, containers, organizations, remotes, search-turbo, search-vision, signing, storage, users, webhooks`. Dazu kommen ~9 Router **außerhalb** von `src/routes/`: `chain-routes` (+ verifyRouter), `registry-routes`, `promote-routes`, `anchor-routes`, `ocp/router`, `ocp/query`, `registry-v1-compat` — plus Direkt-Routen ohne Router (inject, Git Smart HTTP, whoami, Discovery). Die früheren Vermutungen `git-objects`, `device`, `tokens`, `merge-requests`, `issues` **existieren nicht als Router-Dateien**.

### 4.1 Mounts (Reihenfolge wie im Code)

| Mount-Pfad(e) | Router-Datei | Anmerkung |
|---|---|---|
| `/api/chain`, `/v1/chain` | chain-routes.ts | status ✅, submit (manuell, §2.2) |
| `/api/verify`, `/v1/verify` | verifyRouter (chain-routes.ts) | ✅ `:id`-Route |
| `/api/v2` | registry-routes.ts | health ✅, search ✅ |
| `/api/v4` | promote-routes.ts + anchor-routes.ts | hinter **promoterKey-Middleware** |
| `/ocp/v1` | ocp/router.ts + ocp/query.ts | **öffentlich** („NO persona logic") — s. 4.3 |
| `/v1/containers`, `/api/containers` | containers.ts | |
| `/v1/storage`, `/api/storage` | storage.ts | |
| `/v1/billing` | billing-v1.ts | |
| `/v1/webhooks` | webhooks.ts | |
| `/v1/signing` | signing.ts | |
| `/api/v1/search/turbo` | search-turbo.ts | ✅ live (500, §2.6); „staging-only until Phase 14 cutover" (simple-index.ts:842–844) |
| `/api/v2/search/vision` | search-vision.ts | ✅ live (401, §2.7); „NOTE: mounted BEFORE registryV1Router" |
| `/v1/batch`, `/api/batch` | batch.ts | |
| `/v1/admin` | admin.ts | ✅ 401 live |
| `/v1/organizations`, `/api/organizations` | organizations.ts | |
| `/v1` | users.ts | ✅ `/v1/user` 401 live |
| `/api/user` | users.ts | ✅ 401 live (v1-Compat) |
| `/v1/remotes` | remotes.ts | |
| `/` | bridge.ts | Root-Mount |
| `/api` | registry-v1-compat.ts | LETZTER Mount, „search only" |

### 4.2 Direkt-Routen (ohne Router-Datei, direkt in simple-index.ts)

| Route | Zeile | Auth |
|---|---|---|
| `GET /v1/auth/whoami` | :152 | requireAuth |
| `POST /api/v1/inject` | :319 | quotaMiddleware (öffentlich mit Quota) ✅ live |
| `POST /api/v1/inject/skeleton`, `…/expand` | nahe :319 | wie inject |
| `GET /api/v1/search` | — | öffentlich |
| `GET /git/:type/:ns/:id.git/info/refs` | :592 | gitAuth ✅ live |
| `POST …/git-upload-pack` | :658 | gitAuth |
| `POST …/git-receive-pack` | :718 | gitAuth (push!) |
| `/v1/ocp`, `/v1/mcp` Discovery + inject/tools/disclose | :1017–1042 | — |
| `/api/billing/*`, `/registry`, `/registry/health` | — | — |

### 4.3 OCP-Fläche `/ocp/v1/*` (ocp/router.ts:228–531 + ocp/query.ts)

Acht öffentliche GETs je Container: `containers/:cid`, `…/atoms`, `…/atoms/:atom_id`, `…/citations`, `…/documents`, `…/coverage`, `…/conflicts`, `…/verify` — dazu `POST /embed` und `POST /containers/:id/retrieve` (Stubs in query.ts). Der Live-404 auf `/api/ocp/v1` in §2.4a war schlicht der falsche Präfix.

---

## 5. Konventionen

### 5.1 Pfad-Stil ✅/📋
- Versionierte Präfixe je Fläche: `/api/v2/*` (Registry), `/api/v1/*` (v1-Compat neu), `/api/*` (v1-Compat alt), `/v1/*` (User/Admin/Billing), `/ocp/v1/*` (Protokoll — 🔎 korrigiert, NICHT `/api/ocp/v1`), `/api/v4/*` (Promote/Anchor, promoterKey), `/git/*` (Transport) ✅/🔎.
- Ressourcen-Pfade singular/plural gemischt: `/v1/user` (singular), `/api/v2/search` — daher wurden `/v1/users` (404) vs. `/v1/user` (401) unterschieden ✅.
- Container-IDs als Pfad-Parameter: `0711:<type>:<namespace>:<identifier>` — Doppelpunkte müssen URL-encoded werden (`%3A`) ✅.
- Git-Smart-HTTP klassisch nach Git-Protokoll: `/git/<path>.git/info/refs?service=git-upload-pack` ✅.

### 5.2 Auth-Modell ✅ Status, 🔎 Details
- **Zwei Mechanismen 🔎** (middleware/auth.ts): **`X-API-Key`-Header** — Key wird SHA256-gehasht gegen `api_keys.key_hash` geprüft — oder **`Authorization: Bearer <token>`** mit 0711-I-JWT (bzw. Legacy-Session).
- **Das vermutete Token-Präfix `gct_` EXISTIERT NICHT im Code** — die frühere Vermutung ist gestrichen. Der getestete Fake `gct_test123` wurde als beliebiger ungültiger Bearer abgelehnt, nicht wegen des Präfixes.
- Live-Fehlertexte: **401** `{"error":"Authentication required"}` (englisch, aus diesem Code) bzw. `{"error":"Anmeldung erforderlich"}` (deutsch — ⚠️ NICHT in diesem Checkout, siehe Deploy≠Checkout-Vermerk oben).
- **Öffentlich ohne Auth:** health, chain/status, verify/:id, inject (mit Quota), v2/search, `/ocp/v1/*`, git smart HTTP read (gitAuth lässt upload-pack public durch; receive-pack = push braucht Auth).

### 5.3 Fehlerformate ✅
Zwei Formate live belegt:
1. **JSON-Routen:** `{"error": "<message>"}` — Status 400/401/404/500; teilweise mit Zusatzfeldern (`hash`, `reason`, `hint`, `containerId`, `latency_ms`). Fehlermeldungen teils Debug-nah (rohe Postgres-Fehler wie `column "embedding_tq_polar" does not exist` — Leaking von DB-Schema in Produktion ⚠️).
2. **Unregistrierte Pfade:** Express-Default-HTML `<pre>Cannot GET /pfad</pre>` (404, `text/html`).

### 5.4 Erfolgformat ✅
Kein einheitlicher Envelope: health/status = flaches Objekt, search = `{results, count}`, inject = `{context, verified, citations, snr}`. Felder `snake_case` in Request-Bodys (`query_embedding`, `container_id`), `camelCase`-frei; Antwortfelder ebenfalls snake_case bis auf Ausnahmen (`display_name`, `latest_tag` konsistent snake_case; `containerId` im Verify-Response als Ausnahme camelCase ⚠️ Inkonsistenz).

### 5.5 CORS ✅
Voll offen (`*`, alle Standard-Methoden) — browserbasierte Clients direkt möglich.

---

## 6. Offene Punkte / Empfehlungen

1. **Turbo-Suche produktionsreif machen** — GEKLÄRT 🔎: Migrationen `database/migrations/2026-04-19-embedding_tq.sql` + `2026-04-19-visual_atoms.sql` existieren, sind in der Prod-DB nur nicht angewendet; danach `scripts/compute-turbo-embeddings.ts` laufen lassen. Route ist laut Code „staging-only until Phase 14 cutover" (§2.6).
2. **Chain-Verankerung inaktiv** — GEKLÄRT 🔎: es gibt **keinen Anchor-Worker**; pending-Batches bestätigen sich nur per manuellem `POST /api/chain/submit`, und `ANCHOR_WALLET_KEY` ist im Deployment nicht gesetzt (read-only). Offen bleibt die Entscheidung: Key setzen + Scheduler bauen, oder Multi-Anchor-Roadmap (QTSP/EBSI/OTS) abwarten (§2.2).
3. **DB-Fehler leaken** in API-Antworten (Postgres-Meldungen) — für Produktion wrappen.
4. **Gemischte Fehler-Sprachen** (en/de) und `containerId` vs. snake_case — vereinheitlichen.
5. **OCP v1-Fläche** — GEKLÄRT 🔎: liegt unter `/ocp/v1/*` (nicht `/api/ocp/v1`), 8 öffentliche GETs + 2 POST-Stubs (§4.3). Live-Verifikation der Sub-Routen steht noch aus.
6. **NEU — Deploy≠Checkout:** Die deployte `/api/v2`-Auth-Schicht (`"Anmeldung erforderlich"`) existiert im Mac-Checkout nicht. Klären, welcher Stand/welches Layer auf Prod läuft, bevor 🔎-Angaben zu v2-Auth als verbindlich gelten.

*✅-Angaben: echte curl-Responses eines repo-externen Agenten (2026-08-30, öffentliche API). 🔎-Angaben: Quellcode-Abgleich am selben Tag auf dem Mac (`~/Documents/0711-Gitchain/apps/service/src/`), Mounts wörtlich gegengelesen, Turbo-Query/Migrationen/Routen-Dateien per Stichprobe direkt verifiziert.*
