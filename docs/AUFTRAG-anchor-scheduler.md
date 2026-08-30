# AUFTRAG: Anchor-Scheduler + mode-Feld

*Bau-Auftrag für Claude Code (Mac) · Repo: C-0711/MMC-OS · Quellcode: ~/0711/0711-gitchain-codex-deploy/apps/service/ · Baut auf: DIAGNOSE-turbo-anchor.md (alle Befunde)*

---

## Der Auftrag in einem Satz

**Baue den fehlenden Anchor-Scheduler (die 9 Batches warten sonst ewig auf Hand-Submits) und das ehrliche `mode`-Feld im Chain-Status — so dass Verankerung künftig von selbst läuft und das Monitoring immer weiß, ob es darf.**

## Hintergrund (aus der Diagnose, Stand des Teams)

- Es gibt **keinen Batcher/Cron/Timer** — pending-Batches werden ausschließlich per manuellem `POST /api/chain/submit` bestätigt (chain-routes.ts:131–174)
- Ohne `ANCHOR_WALLET_KEY`: read-only, Schreibrouten 503 (anchor-routes.ts:21–32); Adresse wird aus dem Key abgeleitet (anchor-routes.ts:162) — **`0xD78E…` im Status = Key angekommen (der Verifikations-Indikator)**
- Offene Netzwerk-Decision: base-sepolia (Config + Contract) vs. base-mainnet (finanziertes Wallet 0xD78E…, 0,002791 ETH) — **nicht mischbar**

## S.1 — Der Anchor-Scheduler (`src/anchor/scheduler.ts`)

```
INTERVALL (env): ANCHOR_SCHEDULER_INTERVAL_MS (default 15 Min, 0 = aus)

TICK:
  1. chain/status prüfen: Key da? → sonst: nichts tun, NUR ein Log (read-only ist
     bewusster Zustand, kein Fehler)
  2. pending Batches holen (die 9 existierenden + alle neuen)
  3. JE Batch: POST /api/chain/submit (interne Route, dieselbe wie Hand-Submit —
     kein zweiter Code-Pfad!)
  4. Ergebnis je Batch loggen (tx-hash, fee, confirmed)
  5. Bei Tx-Fehler: BACKOFF (nicht in jedem Tick dieselbe fehlgeschlagene Tx
     erneut feuern — max 3 Versuche, dann Batch auf "fehlerhaft" markieren
     und MANUELLE_KARTE im Log, kein stiller Retry-Loop)

REGELN:
  - Der Scheduler verwendet NUR die bestehende Submit-Route — kein dupliziertes
    Signieren, kein zweites Wallet-Handling (eine Quelle der Wahrheit)
  - Raten-Limit: max 1 Batch pro Tick (Gas-Schonung, Testnet zuerst validieren)
  - Graceful Shutdown: laufende Tx zu Ende, dann Stop (K8s-Rollout-sicher)
  - METRIK: Zähler in /api/chain/status (scheduler: {läuft, letzterTick,
    verarbeiteteBatches, fehlversuche})
```

## S.2 — Das `mode`-Feld (ehrlicher Chain-Status)

`GET /api/chain/status` bekommt ein Pflichtfeld:

```json
{
  "mode": "anchoring" | "read-only",
  "walletAddress": "0xD78E…" | "read-only",
  ...
}
```

- **`mode: "read-only"`** — wenn `ANCHOR_WALLET_KEY` fehlt (der heutige 503/read-only-Zustand): Status bleibt 200, `connected: true` ist korrekt, aber das Feld sagt ehrlich: **es wird nichts verankert.**
- **`mode: "anchoring"`** — Key da, Scheduler läuft, Batches fließen.
- **Migration des Verhaltens:** die bestehenden Felder bleiben (Kompatibilität), `mode` ist der neue eine Blick.

## S.3 — Netzwerk-Konsistenz-Wächter (klein, verhindert den Quiet-Fehler)

Beim Start (und je Tick):

```
PRÜFE: konfiguriertes Netzwerk vs. Wallet-Guthaben auf genau DIESEM Netz
  - base-sepolia konfiguriert, Guthaben nur auf mainnet → WARN-Log:
    "Wallet 0xD78E… hat Guthaben auf base-mainnet, Service läuft auf
    base-sepolia — Cross-Chain-Mismatch (siehe DIAGNOSE-turbo-anchor.md)"
  - chain/status bekommt bei Mismatch: "netzwerkHinweis": "…"
```

Das hätte den aktuellen Konflikt (Sepolia-Config + Mainnet-Wallet) in Sekunden sichtbar gemacht — jetzt bauen, damit er es künftig tut.

## Definition of Done

1. `mode`-Feld in `/api/chain/status` — live prüfbar (aktuell: `read-only` mit `walletAddress: "read-only"`)
2. Scheduler läuft mit Interval-Env; ein manueller Test-Batch wird beim Tick bestätigt (Testnet!)
3. Keine doppelte Submit-Logik — Scheduler ruft die bestehende Route
4. Backoff + Fehlversuch-Zähler; kein stiller Endlos-Retry
5. `scheduler`-Metrik-Objekt im Status (läuft, letzterTick, verarbeitet, fehlversuche)
6. Netzwerk-Mismatch-Warnung im Log + als `netzwerkHinweis` im Status
7. `npm run typecheck` + bestehende Tests grün
8. Doku: `docs/gitchain-api.md` um die neuen Status-Felder ergänzen (mode, scheduler, netzwerkHinweis)

## Parallel dazu (Ops, nicht Code)

- **Netzwerk-Decision fällen** (Sepolia konsolidieren, Mainnet-Wallet als Reserve — oder umgekehrt mit Contract-Deploy)
- **Key-Kette schließen** — Erfolgskriterium: `walletAddress` zeigt `0xD78E…` (nicht mehr `read-only`)
- Danach: die 9 pending Batches fließen beim ersten Scheduler-Tick von selbst
