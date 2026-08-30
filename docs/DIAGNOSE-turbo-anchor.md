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


---

## ABSCHLUSS-BERICHT: Migration k3s + Scheduler-Deploy — LIVE VERIFIZIERT ✅

*Verifiziert von der Spec-/Live-Seite (Hermes) am 30.08., nach dem 14:37–14:48-UTC-Fenster*

### Live-Bestätigung (api-gitchain.0711.io, gemessen):

```
mode: "read-only"                        ← Stufe 1 exakt wie geplant (ehrlich: Key noch nicht da)
scheduler: {laeuft: true, intervalMs: 900000 (15 Min), letzterTick: null,
            verarbeiteteBatches: 0, fehlversuche: 0, fehlerhafteBatches: []}  ← DER SCHEDULER LEBT
confirmed/pending: 0/9 · connected: true · network: base-sepolia
POST /api/chain/submit ohne Auth → 400 "batchId is required" (Route offen — Absicherung steht aus)
```

**Alle DoD-Punkte S.1/S.2/S.3 sind live sichtbar:** Scheduler läuft (letzterTick null, weil noch
kein Key → nichts zu tun, kein Fehler), mode-Feld ehrlich, Metriken vorhanden.

### Die restliche Strecke bis "verankert von selbst" (Ops-Liste, final):

1. **Auth vor /api/chain/submit** (offen — heute kann jeder mit :3361-Zugang rufen; P1, Security)
2. **DEPLOYER_PRIVATE_KEY als Secret** (chain-Modul, blockchain.ts:115 — verifiziert am Baum)
3. **CONTENT_CERTIFICATE_ADDRESS_MAINNET** konsolidieren (Netz-Decision sepolia/mainnet)
4. Drain: 9 Batches × 15 Min ≈ 2¼ h nach Scharfschaltung
5. Phase-3-Inspektor-Ablösung + Kleinkram (Test-PAT, FQDN-Flip, ExternalName, PORT_CONTRACT-Merge)

### Sicherheits-Reminder (SEPARAT und DRINGEND):

**Das in der Shell-History getippte Passwort: löschen + wechseln.**
history -c löscht nur die Session; die Datei ~/.bash_history (oder zsh-Äquivalent) enthält die
Zeile weiter. Konkret: Passwort JETZT ändern (das ist der einzig sichere Weg), dann optional
die History-Zeile entfernen (sed -i '/<fragment>/d' ~/.bash_history in einer NEUEN Shell).
Priorität über allem Kleinkram — Credentials in History sind Angriffsfläche Nr. 1.


---

## ✅ FINALE: SCHARFSCHALTUNG KOMPLETT — von beiden Seiten live gemessen (30.08., ~16:24 UTC)

**Die Diagnose-Kette ist geschlossen. Am Ende des Bogens:**

| Messpunkt | Box (dein Wächter) | Live-API (meine Sonde) |
|---|---|---|
| Erster Tick | — | `letzterTick: 2026-08-30T16:24:35Z` |
| Erster Batch verankert | **Wallet-Nonce 14 → 15** (echte Mainnet-Tx) | `verarbeiteteBatches: 1`, `confirmed: 1/8 pending` |
| Gas | 0,00279103 → 0,00279016 ETH (≈0,00000087 ETH/Batch) | — |
| Fehlversuche | 0 | 0 — der Backoff wurde nie gebraucht |

**Die vollständige Kette dieses Befundes (alle im Baum dokumentiert):**

1. Live-Sonde: „Verankerung INAKTIV" (connected:false, 0/9) → Diagnose
2. Team: Code-Analyse — kein Batcher, falsche Key-Annahme (ANCHOR_WALLET_KEY vs DEPLOYER_PRIVATE_KEY)
3. Ops: Wallet-Inventur — Mainnet-Wallet vs Sepolia-Config
4. Live-Messung: `eth_getCode` — **Contract lebt auf MAINNET, Sepolia hatte 0x** (Netz-Decision zur Faktenlage)
5. Bau-Auftrag → Patch 0001 (Scheduler+mode+Wächter) + 0002 (Auth)
6. k3s-Migration + Rollout anchor2-20260830
7. **Scharfschaltung:** mode:"anchoring" · wallet:0xD78E… · base-mainnet · submit 401-geschützt
8. **Erstes on-chain-Siegel von gitchain-Content — verifiziert durch Nonce-Anstieg UND API-Zähler**

**Rest-Drain:** 8 Batches × 15 Min ≈ 2 h (Gaskosten gesamt ~0,000007 ETH — das Guthaben
trägt das um Größenordnungen). Beschleunigung möglich: reiner Values-Flip
(ANCHOR_SCHEDULER_INTERVAL_MS), kein Code — Ops-Entscheidung.

**Was bleibt (menschlich, nicht technisch):** P0 Passwort (Wechsel VOR History-Säuberung),
Test-PAT chain:submit für externe Batch-Pflege, Phase-3-Inspektor-Ablösung.

*Damit gilt ab jetzt auf der Website zu Recht: „sealed truth, signed, on-chain" — selbstlaufend,
sichtbar ehrlich (mode), geschützt (401), und für ~Bruchteil eines Cents pro Beweis.*


---

## 🎉 DRAIN KOMPLETT — 9/9 CONFIRMED (30.08., ~16:50 UTC, live verifiziert)

```
confirmed: 9/9 · pending: 0 · fehlversuche: 0 · fehlerhafte: 0
mode: "anchoring" · base-mainnet · wallet 0xD78E… (Nonce 14 → 23: 9 echte Tx)
```

**Alle 10 Manifeste / 9 Batches der Registry sind auf Base-Mainnet verankert.**
Der Wächter wurde gestoppt (Aufgabe erfüllt). Der Scheduler läuft weiter und
verankert künftige Batches automatisch (15-Min-Tick, ~0,00000087 ETH pro Batch).

**Die vollständige Erfolgskette des Tages:** Diagnose „Verankerung INAKTIV" →
Code-Analyse (falscher Key-Name) → Wallet-Inventur (Mainnet vs Sepolia) →
eth_getCode-Messung (Contract = MAINNET) → Auftrag → Patch 0001+0002 →
k3s-Migration → Scharfschaltung (mode:anchoring, 401-Auth) → **9/9 verankert.**

Von „connected: false, 0/9, niemand weiß warum" bis „selbstlaufend, geschützt,
für einen Bruchteil eines Cents pro Beweis" — an einem Nachmittag.

*Der Wahrheitsgehalt der Website ist hergestellt: „sealed truth, signed, on-chain —
verifiable by anyone, anytime."*
