# gitchain API-Referenz — api-gitchain.0711.io

> **Stand:** 2026-08-30 · **Methode:** Live-Analyse der Produktions-API per `curl` (nur öffentliche Zugriffe, ohne Credentials).
> Quellcode (Repo `C-0711/MMC-OS`, `apps/service/`, Entry `simple-index.ts`, 22 Router in `src/routes/`) war **nicht** lesbar — die Router-Struktur ist aus bekannten Router-Namen abgeleitet.
>
> **Legende:**
> - ✅ **live verifiziert** — Antwort wurde per curl tatsächlich erhalten (Status-Code + Body belegt).
> - 📋 **abgeleitet** — aus Router-Namen / Kontext erschlossen, NICHT live geprüft.

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

**Abgeleitet aus dem Fehlerbild:** Erfolgsantwort würde Treffer mit Distanz/Score + `latency_ms` enthalten (Feldname `latency_ms` ist live belegt).

### 2.7 `POST /api/v2/search/vision` — Vision-Suche ✅ (auth-geschützt)

Ohne Auth → **401** `{"error":"Anmeldung erforderlich"}`. Route existiert (POST); GET auf denselben Pfad → 404 (nur POST registriert). Body-Schema 📋 abgeleitet (vermutlich Bild-/Embedding-Payload, da `vision`).

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
| Registry v2 | `/api/v2/*` | ✅ `/api/v2/health`, `/api/v2/search` live; `search/vision` 401 |
| Git Smart HTTP + Objekt-API | `/git/*` | ✅ `info/refs` live; Upload-Pack 📋 |
| OCP Tier-0-Protokoll | `/api/ocp/v1/*` | 📋 Pfad live 404 — konkrete Sub-Routen unbekannt; `ocp_state`-Feld in Search-Results belegt OCP-Integration |
| User/PAT/Device/Admin/Billing | `/v1/*` | ✅ `/v1/user`, `/v1/admin` live 401; weitere 📋 |
| v1-Compat | `/api/*` | ✅ `/api/user` live 401; `/api/v1/inject`, `/api/v1/search/turbo` live; `/api/verify/:id`, `/api/chain/status` live |
| Chain/Verify | `/api/chain`, `/api/verify` | ✅ live |

---

## 4. Router-Struktur (22 Router, aus Router-Namen abgeleitet) 📋

Quelle: Router-Namen aus `src/routes/` (Kontext; Quellcode nicht lesbar). Bekannte Namen und ihre wahrscheinlichen Flächen — **Pfade unterhalb der Router sind erschlossen, nicht live verifiziert** (außer wo ✅):

| # | Router | Vermutete Fläche | Verifiziert |
|---|---|---|---|
| 1 | `containers` | Container-CRUD/Listing, vermutlich `/api/v2/containers/:id` o.ä. | Route 404 am getesteten Pfad; Container-Schema über Search/Inject indirekt ✅ |
| 2 | `git-objects` | Git-Objekt-API (Blobs/Trees/Atoms), vermutlich unter `/git/*` neben Smart HTTP | 📋 |
| 3 | `device` | Device-Registrierung/-Bindung, `/v1/device*` | 📋 |
| 4 | `tokens` | PAT-Verwaltung (Personal Access Tokens), `/v1/tokens*` | 📋 |
| 5 | `users` | User-Management/Profile | `/v1/user`, `/api/user` 401 ✅ |
| 6 | `organizations` | Orgs/Namespaces (analog `namespace`-Feld in Search) | 📋 |
| 7 | `merge-requests` | MRs auf Container-Repos | 📋 |
| 8 | `issues` | Issues pro Container | 📋 |
| 9 | `webhooks` | Webhook-Registrierung/-Auslieferung | 📋 |
| 10 | `billing` | Abrechnung (Euro-Settlement, Capability-Economy), `/v1/billing*` | 📋 |
| 11 | `signing` | Signatur-API (Ed25519, Fassung-Signaturen) | 📋 |
| 12 | `search-turbo` | Vektor-Suche TurboQuant | ✅ `POST /api/v1/search/turbo` |
| 13 | `search-vision` | Vision-Suche | ✅ `POST /api/v2/search/vision` (401) |
| 14–22 | *unbekannt* (9 weitere) | u.a. vermutlich: registry/health, chain/anchors, verify/inject, admin | `/api/v2/health`, `/api/chain/status`, `/api/verify/:id`, `/api/v1/inject` existieren — welcher Router sie bedient ist ohne Quellcode nicht zuordenbar |

**Ehrlichkeits-Vermerk:** Nur 13 Router-Namen sind bekannt; die restlichen 9 der 22 sind unbenannt. Die Zuordnung Router→Präfix ist plausibel (Router-Namen entsprechen den Flächen), aber nicht belegt.

---

## 5. Konventionen

### 5.1 Pfad-Stil ✅/📋
- Versionierte Präfixe je Fläche: `/api/v2/*` (Registry), `/api/v1/*` (v1-Compat neu), `/api/*` (v1-Compat alt), `/v1/*` (User/Admin/Billing), `/api/ocp/v1/*` (Protokoll), `/git/*` (transport) ✅ (anhand der Live-Routen belegt).
- Ressourcen-Pfade singular/plural gemischt: `/v1/user` (singular), `/api/v2/search` — daher wurden `/v1/users` (404) vs. `/v1/user` (401) unterschieden ✅.
- Container-IDs als Pfad-Parameter: `0711:<type>:<namespace>:<identifier>` — Doppelpunkte müssen URL-encoded werden (`%3A`) ✅.
- Git-Smart-HTTP klassisch nach Git-Protokoll: `/git/<path>.git/info/refs?service=git-upload-pack` ✅.

### 5.2 Auth-Modell ✅ Status, 📋 Details
- **Bearer-Auth:** Authentifizierte Routen antworten ohne/gültiges Token mit **401** `{"error":"Authentication required"}` (englisch) bzw. vision-Suche mit `{"error":"Anmeldung erforderlich"}` (deutsch — gemischte Sprachen im Fehlerformat).
- **PAT/Device-Bearer** (📋 aus Kontext: Router `tokens` + `device`): `Authorization: Bearer <token>`; Token-Präfix in der Praxis häufig `gct_` (unbestätigt — getesteter Fake `gct_test123` wurde abgelehnt; das Präfix selbst ist nicht verifizierbar ohne echtes Token).
- **Öffentlich ohne Auth:** health, chain/status, verify/:id, inject, v2/search, git smart HTTP (upload-pack read).

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

1. **Turbo-Suche produktionsreif** (500 statt 200 — fehlende Spalte `embedding_tq_polar`) — vermutlich fehlende Migration im K8s-Image.
2. **Chain-Verankerung inaktiv** (`connected:false`, 9/9 Batches pending) — mit Multi-Anchor-Roadmap (QTSP/EBSI/OTS statt reiner Base-Sepolia) abgleichen.
3. **DB-Fehler leaken** in API-Antworten (Postgres-Meldungen) — für Produktion wrappen.
4. **Gemischte Fehler-Sprachen** (en/de) und `containerId` vs. snake_case — vereinheitlichen.
5. **OCP v1-Fläche** (`/api/ocp/v1/*`) konnte nicht live verifiziert werden — Sub-Routen brauchen Quellcode oder Doku vom Mac.

*Erstellt von einem repo-externen Agenten ausschließlich über die öffentliche API; alle ✅-Angaben sind echte curl-Responses vom 2026-08-30.*
