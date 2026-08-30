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
