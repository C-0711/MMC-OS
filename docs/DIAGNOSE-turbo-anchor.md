# Diagnose: search-turbo 500 + Verankerung INAKTIV

*Für: Mac-/Ops-Team · Von: Spec-/Live-Seite (Hermes) · Stand: 2026-08-30, 3 Probes je Befund*

---

## Befund (a): search-turbo 500 — ROOT CAUSE lokalisiert ✅

**Symptom:** `POST /api/v1/search/turbo` wirft 500.

**Live-Reproduktion (3 Feldnamen getestet, 1024-dim-Array):**

| Body-Feld | Status | Antwort |
|---|---|---|
| `embedding` | 400 | `query_embedding must be a 1024-dim array (got length=not-array)` |
| `query_embedding` | **500** | **`column "embedding_tq_polar" does not exist`** (latency 1ms) |
| `vector` | 400 | dito |

**Diagnose (gesichert):**
1. Erwarteter Feldname ist `query_embedding` (die 400er beweisen: die Validierung prüft genau dieses Feld).
2. Die Route validiert korrekt (1024-dim), übergibt an Postgres — und **die Spalte `embedding_tq_polar` existiert nicht in der Produktions-DB**.
3. Latenz 1ms = Query-Bau schlägt fehl, bevor die DB antwortet — klassische fehlende Migration.

**Vermutung (zu prüfen):** die Migration, die `embedding_tq_polar` anlegt (TurboQuant-Polar-Spalte), lief im Pod-Deployment nie — evtl. im Docker-Altzustand vorhanden, im K8s-Postgres nie angelegt. **Fix:** Migration finden/ausführen (`ALTER TABLE … ADD COLUMN embedding_tq_polar …` oder ORM-Äquivalent), danach sollten auch die 954 embeddings aus health mit dieser Spalte zusammenhängen.

## Befund (b): Verankerung INAKTIV — 3 Probes, stabil ✅

**Live-Daten (stabil über 3 Abfragen, je 2s Abstand):**

```
connected: false          ← Wallet-Verbindung getrennt
walletAddress: "read-only" ← Signier-Wallet fehlt (nur Lese-Zugriff)
balance: "0"
contractDeployed: true     ← Contract selbst existiert (0xAd31…aEc7, base-sepolia)
stats: 10 Manifeste, 9 Batches, 0 confirmed, 9 pending
```

**Diagnose (gesichert):**
- Der **Anchor-Batcher läuft im Read-only-Modus**: Contract deployed, aber `walletAddress: "read-only"` + `connected: false` heißt — es gibt **keine Signier-Wallet** konfiguriert. Ohne Wallet keine Transaktionen, deshalb `confirmedBatches: 0` bei 9 Pending.
- Es ist NICHT: Chain down, Contract falsch, oder Netzwerk-Fehler. Es ist: **Konfiguration** — der Pod startet ohne Private Key / ohne Wallet-Verbindung.

**Zu prüfen (eure Seite, Pod vs. Docker-Altzustand):**
1. `ANCHOR_PRIVATE_KEY` (o.ä.) als Secret im K8s gesetzt? Der alte Docker-Container hatte evtl. die Env, der Pod nicht.
2. Batcher-Intervall: laufen 9 Batches nur auf den nächsten Tick, oder ist der Worker-Timer gar nicht gestartet (weil ohne Wallet initialisiert er sich vielleicht gar nicht)?
3. Wenn Wallet bewusst weg gelassen (Kosten/Security): dann ist "read-only" ein bewusster Zustand — aber dann sollten die 9 pending Batches nicht "pending" heißen, sondern der Zustand sollte das ehrlich benennen. **Empfehlung: chain/status um ein Feld `mode: "read-only" | "anchoring"` erweitern**, damit Monitoring den Unterschied sieht.

## Priorität

- **(a) turbo-500:** Nutzer-sichtbar (Suche kaputt) → Migration nachziehen, P1.
- **(b) Verankerung:** 9 Manifeste warten auf Beweiszeitpunkte → Wallet-Secret prüfen, P1 (rechtlich relevant: "verifiable forever" braucht den Anchor).

---

## Antwort von der Mac-Seite (Quellcode-Abgleich, gleicher Tag) — beide „zu prüfen"-Fragen geklärt

Quelle: `~/Documents/0711-Gitchain/apps/service/src/` (Details mit file:line in
`docs/gitchain-api.md` §2.2/§2.6).

**Zu (a) — „Migration finden":** Gefunden. `database/migrations/2026-04-19-embedding_tq.sql:20`
legt `embedding_tq_polar` (+ `_qjl`, `_rnorm`, `_xnorm`, bytea, seed=42, b=3) auf `neo.rag_chunks`
an; für die Vision-Variante `2026-04-19-visual_atoms.sql:58` auf `enriched.visual_atoms`.
Nach dem Anwenden Befüllung via `scripts/compute-turbo-embeddings.ts`. Der Mount trägt den
Kommentar „staging-only until Phase 14 cutover" (simple-index.ts:842–844) — die Route war für
Prod schlicht noch nicht gedacht.

**Zu (b) — „läuft der Worker-Timer?":** Es gibt **keinen**. Im Code existiert kein Batcher, kein
Cron, kein Timer — pending-Batches werden ausschließlich durch manuellen `POST /api/chain/submit`
bestätigt (chain-routes.ts:131–174). Der Env-Name ist `ANCHOR_WALLET_KEY` (nicht
`ANCHOR_PRIVATE_KEY`; anchor-routes.ts:21–32) — ohne ihn read-only, Schreibrouten 503, Wallet-
Adresse würde aus dem Key abgeleitet (anchor-routes.ts:162). Frage 2 der Diagnose ist damit
beantwortet: die 9 Batches warten nicht auf einen Tick, es gibt keinen. Der `mode`-Feld-Vorschlag
bleibt sinnvoll — plus Entscheidung: Key setzen **und** einen Scheduler bauen, sonst bleibt es
bei Hand-Submits.

---

## ZWEITES UPDATE (nach Wallet-Inventur, live vom Spec-Standort): der Netzwerk-Konflikt

Die Code-Analyse des Teams (oben) + die On-Chain-Inventur des Ops zusammen ergeben einen neuen, entscheidenden Befund:

| Quelle | Fakten |
|---|---|
| **Service-Config (live, 3 Probes)** | `network: base-sepolia` · `connected: true` (nach Env-Fix) · `walletAddress: "read-only"` · 0/9 confirmed |
| **Wallet on-chain (Ops-Inventur)** | `0xD78E…25009` auf **Base MAINNET** · 0,002791 ETH · **14 gesendete Tx** — echtes, finanziertes Mainnet-Wallet |
| **Schlüssel-Lagerung** | `apps/service/.env` (0600, Quelle) → `deploy/helm/secrets.env` (0600, gitignored) |

**Der Konflikt:** Der Service ist auf **Sepolia** konfiguriert, aber das inventierte Wallet lebt auf **Mainnet**. Und `connected: true` bei `walletAddress: "read-only"` heißt nach Team-Befund: **`ANCHOR_WALLET_KEY` ist (noch) nicht im Pod angekommen** — ohne ihn bleibt alles read-only, Schreibrouten 503 (anchor-routes.ts:21–32).

**Die offenen Entscheidungen (jetzt konkret):**

1. **Netzwerk-Decision:** Sepolia (Contract deployed, Tests frei) oder Mainnet (das finanzierte Wallet — aber dann Contract auf Base-Mainnet deployen, der `0xAd31…`-Contract existiert dort vermutlich nicht). **Nicht mischbar.**
2. **Key-Pfad prüfen:** `.env` (Quelle) → `secrets.env` (Deploy) → **Pod-Env** — die Kette hat an irgendeiner Stelle einen Bruch, sonst stünde `walletAddress: 0xD78E…` statt `"read-only"`. Da der Code die Adresse aus dem Key ableitet (anchor-routes.ts:162), wäre die Adresse die perfekte Verifikation: **im chain/status auftauchende 0xD78E… = Key angekommen.**
3. **Scheduler bauen (Team-Empfehlung übernehmen):** ohne Batcher/Timer bleiben die 9 Batches Hand-Submits (`POST /api/chain/submit`). Vorschlag: Scheduler + `mode: "read-only" | "anchoring"` im Status — dann zeigt das Monitoring beides ehrlich.
4. **(a) bleibt wie vom Team gelöst:** Migration `2026-04-19-embedding_tq.sql` anwenden — mit dem Teams-Befund, dass die Route „staging-only until Phase 14 cutover" war (simple-index.ts:842-844): das erklärt, warum die Spalte in Prod fehlt. Entweder Migration nachziehen oder Route bis Phase 14 sperren.
