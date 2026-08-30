# OPS-HANDBLATT: Scharfschaltung Anchoring — 0 bis 5 in einem Durchgang

*Alles copy-paste-fertig. Ausführen auf: deinem Mac / der Box mit kubectl-Zugriff. Stand: nach Live-Verifikation (mode: read-only, scheduler läuft).*

---

## P0 — PASSWORT (5 Minuten, VOR allem anderen)

> **Reihenfolge ist hier der Sicherheitsgewinn: erst wechseln, dann säubern.** History-Löschen allein bringt nichts, solange das alte Passwort gilt.

```bash
# 1. PASSWORT WECHSELN (bei dem Dienst, zu dem es gehört — nur du weißt woher):
#    → Wechsel durchführen, neu anmelden, prüfen.

# 2. DANACH History säubern — WICHTIG: in einer NEUEN Shell, mit einem Fragment
#    des Passworts (nicht dem ganzen, sonst steht es wieder in der History!):
history -c && history -w                                  # Session leeren (bash)
sed -i '/<passwort-fragment>/d' ~/.bash_history           # Datei säubern
# zsh: sed -i '/<fragment>/d' ~/.zsh_history

# 3. Prüfen:
grep -c "<fragment>" ~/.bash_history || echo "SAUBER: 0 Treffer"
```

---

## P1 — AUTH vor POST /api/chain/submit (Code-Baustein für Claude Code)

**Baustein: Express-Middleware (an die chain-routes hängen, vor dem Submit-Handler):**

```typescript
// src/routes/middleware/requireChainAuth.ts
import type { Request, Response, NextFunction } from 'express';

/**
 * Schützt Verankerungs-Schreibrouten.
 * Erlaubt: (a) PAT mit admin/signing-Scope, (b) Loopback vom eigenen Scheduler
 * (denn der ruft die Route per localhost — kein zweiter Signierpfad!).
 */
export function requireChainAuth(req: Request, res: Response, next: NextFunction): void {
  // Loopback des Schedulers zulassen (er ist vertrauenswürdig — gleicher Pod):
  const isLoopback = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  if (isLoopback && req.get('x-scheduler') === '1') return next(); // Scheduler-Kennung

  // PAT-Prüfung (bestehende Infrastruktur nutzen — die Registry hat 35 PATs):
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    // → an die bestehende PAT-Verifikation durchreichen (dieselbe wie /v1/*-Flächen)
    //   Scope-Anforderung: 'chain:submit' o.ä. — konkreten Scope-Namen aus
    //   der PAT-Tabelle ableiten (tokens-Router).
    return next(); // nach erfolgreicher Verifikation
  }

  res.status(401).json({ error: 'Anmeldung erforderlich — chain/submit ist geschützt' });
}
```

**Einbindung (chain-routes.ts):**
```typescript
router.post('/submit', requireChainAuth, handleSubmit);  // vor dem bestehenden Handler
```

**Zwei Regeln dabei:**
1. **Der Scheduler darf durch** — er ruft per Loopback mit Kennung; sonst schützt die Middleware den Scheduler selbst aus (genau der „zweite Codepfad"-Fehler, den S.1 verbot).
2. **401-Format an die bestehenden Flächen angleichen** — die Registry nutzt bereits `{"error": "…"}` (live verifiziert bei /api/v2/search/vision → 401). Konsistenz statt neue Erfindung.

**GEBAUT (Claude Code, Mac — 2026-08-30). Service-Commit `2fc8d2c`, Lieferung: `docs/patches/0002-feat-service-requireChainAuth-PAT-JWT-Schutz-f-r-POS.patch` (baut auf 0001 auf — beide zusammen: `git am docs/patches/000*.patch`).** Abweichungen/Präzisierungen gegenüber der Skizze oben:
- **Pfad:** `src/middleware/requireChainAuth.ts` (nicht `src/routes/middleware/`) — konsistent mit der bestehenden Struktur (auth.ts, rbac.ts liegen dort).
- **Echte Verifikation statt Platzhalter:** die Middleware reicht an `authenticate()` aus `middleware/auth.ts` durch — dieselbe Prüfung wie die /v1/*-Flächen (X-API-Key gegen api_keys-Tabelle, Bearer = 0711-I-JWT oder Legacy-Session). Kein neuer Auth-Pfad.
- **Scope-Semantik** (requireScope-Konvention): API-Key-Principals brauchen `chain:submit` oder `admin` (403 im Format `{error, required, granted}`); JWT-/Session-User sind vollwertige Principals ohne Scope-Liste und passieren. 401: `{"error": "Anmeldung erforderlich — chain/submit ist geschützt"}`.
- **Loopback ist sicher, weil** simple-index.ts KEIN `trust proxy` setzt → `req.ip` ist die rohe Socket-Adresse, von außen nicht auf 127.0.0.1 fälschbar. **Caveat:** wird jemals `trust proxy` aktiviert, muss der Loopback-Check neu bewertet werden.
- **Scheduler sendet die Kennung** (`x-scheduler: 1`) am Loopback-Call — im selben Commit, kein Fenster, in dem er sich aussperrt.
- `tsc --noEmit` grün. **Ops-Erinnerung:** Test-PAT mit Scope `chain:submit` über den tokens-Router anlegen (Kleinkram-Tabelle unten).

---

## P1 — DEPLOYER_PRIVATE_KEY + Netz-Env (kubectl, 3 Befehle)

```bash
# 1. Secret anlegen (der Key, der wirklich signiert — blockchain.ts:115):
kubectl -n gitchain create secret generic chain-signer \
  --from-literal=DEPLOYER_PRIVATE_KEY="$(grep DEPLOYER_PRIVATE_KEY ~/Documents/0711-Gitchain/apps/service/.env | cut -d= -f2-)"

# 2. Netz-Decision — HIER ENTSCHEIDEN (nicht mischbar):
#    VARIANTE SEPOLIA (empfohlen: Contract ist dort deployed, Tests frei):
#      CONTENT_CERTIFICATE_ADDRESS_MAINNET NICHT setzen ODER auf den
#      Sepolia-Contract-Spiegel zeigen lassen — exakt die Logik aus
#      blockchain.ts prüfen: steuert die Variable NUR die Mainnet-Autodetekt
#      oder ERZWINGT sie Mainnet? (Im Zweifel: leer lassen = Sepolia-Default)
#    VARIANTE MAINNET (das finanzierte 0xD78E…-Wallet):
#      Contract auf Base-Mainnet deployen ERST, dann Adresse eintragen.
#      ACHTUNG: ohne Mainnet-Contract-Deploy ist diese Variante kaputt.

# 3. Rollout mit neuem Env:
helm upgrade gitchain ./deploy/helm -n gitchain \
  --set service.env.ANCHOR_SCHEDULER_INTERVAL_MS=900000
# (oder service.yaml-Verdrahtung, die du gerade editierst — derselbe Effekt)
```

**NETZ-DECISION AUFGELÖST (Claude Code, 2026-08-30 — live gemessen, nicht geraten):**

Die Contract-Adresse ist in `packages/chain/src/blockchain.ts:31` **hartkodiert**
(`0xAd31465A5618Ffa27eC1f3c0056C2f5CC621aEc7`) und wird auf JEDEM Netz verwendet.
`eth_getCode` auf beiden RPCs:

| Netz | Code an 0xAd31…aEc7 |
|---|---|
| base-mainnet | **Bytecode vorhanden** (Contract deployed) |
| base-sepolia | `0x` — **kein Contract** |

Damit ist die „VARIANTE SEPOLIA (empfohlen)" oben **kaputt**, nicht die Mainnet-Variante:
ohne die Env-Variable wählt blockchain.ts:99–103 base-sepolia, ruft dort aber die
Mainnet-Adresse ohne Code — jeder Submit schlägt fehl. Der Kommentar „Contract ist dort
deployed" traf auf den chain-routes-Pfad nie zu (er galt der v4-Fläche/altem Stand).

**Konsequenz — genau EIN gültiger Weg:**
```bash
# Env-Variable ist reiner Netz-Schalter (nur Truthiness geprüft, Wert wird im
# chain-Paket NICHT als Adresse gelesen — Adresse ist hartkodiert):
CONTENT_CERTIFICATE_ADDRESS_MAINNET=0xAd31465A5618Ffa27eC1f3c0056C2f5CC621aEc7
# (den echten Wert setzen, nicht "1" — packages/dpp und packages/ipfs zeigen die
#  Variable als contractAddress im Status an; konsistent halten)
```
Passt zum finanzierten Wallet: `0xD78E…` hat sein Guthaben (0,002791 ETH) auf
base-mainnet — der S.3-Netzwerk-Wächter wäre bei Sepolia-Config sofort mit
Cross-Chain-Mismatch angesprungen. Kein Contract-Deploy nötig, er ist schon da.

**Erfolgs-Kriterien (ich messe sie live, sobald du „drauf" sagst):**
- `walletAddress` zeigt `0xD78E…` (statt `read-only`) ← Key angekommen
- `mode: "anchoring"`
- nach ≤15 Min: `scheduler.letzterTick` gesetzt, `verarbeiteteBatches` steigt

---

## P1/4 — DRAIN: passiert von selbst

Nach Key+Netz verankert der 15-Min-Tick je 1 Batch → **9 Batches ≈ 2¼ h**. Kein Handeln nötig — nur beobachten (`confirmedBatches` in `/api/chain/status`). Wenn ein Batch nach 3 Versuchen auf `fehlerhafteBatches` wandert: das ist der Backoff, MANUELLE_KARTE im Log nachsehen.

---

## P2/P3 — Kleinkram (Reihenfolge nach Aufwand)

| Punkt | Wo | One-Liner |
|---|---|---|
| Test-PAT | Registry-PAT-Tabelle | über bestehenden tokens-Router anlegen, Scope `chain:submit` |
| FQDN-Flip | DNS/Ingress | alter Name → neuer Service, TTL beachten |
| cdoc-Chart-ExternalName | Helm cdoc | `externalName: gitchain-service.gitchain.svc.cluster.local` |
| PORT_CONTRACT-Merge | Branch | PR/Cherry-pick des committeten Stands auf main |
| Inspektor-Ablösung (Phase 3) | eigener Auftrag | nicht im Handblatt — eigener Bau-Auftrag nötig |

---

## Messpunkte zum Schluss (alle live von außen prüfbar)

```bash
curl -sS https://api-gitchain.0711.io/api/chain/status | python3 -m json.tool
# Erwartung nach Scharfschaltung:
#   mode: "anchoring" · walletAddress: "0xD78E…"
#   scheduler: {laeuft: true, letzterTick: "<zeit>", verarbeiteteBatches: 1..9}
#   stats: { confirmedBatches: 0 → 9, pendingBatches: 9 → 0 }
```
