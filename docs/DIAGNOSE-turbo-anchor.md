# Diagnose: search-turbo 500 + Verankerung — UPDATE nach Wallet-Inventur

*Update: 2026-08-30, nach Pod-Inspektion (Wallet-Inventur vom Ops) · earlier: DIAGNOSE-turbo-anchor.md*

---

## Befund (b) UPDATE: Die Verankerungs-Lage ist jetzt vollständig — und enthält einen Netzwerk-Konflikt

### Die Fakten aus der Inventur (Ops)

| Artefakt | Inhalt |
|---|---|
| Wallet on-chain (**Base MAINNET**) | `0xD78E59c22f660D9c2f1E9934672182C34Ce25009` — 0,002791 ETH, **14 gesendete Tx** (echtes, genutztes, finanziertes Wallet) |
| Anchor-Contract | `0xAd31465A5618Ffa27eC1f3c0056C2f5CC621aEc7` |
| Schlüssel (Quelle) | `apps/service/.env` (0600) |
| Schlüssel (Deploy) | `deploy/helm/secrets.env` (0600, gitignored) |

### Der neue Befund (live, 3 Probes, stabil): **connected: true — der Pod liest einen Key**

```
network: base-sepolia · connected: TRUE · walletAddress: "read-only" · 0/9 confirmed · 9 pending
```

Die API meldet jetzt **connected: true** (vorhin false) — der Pod ist also nach der Env-Korrektur **verbunden**. Aber drei Widersprüche bleiben, und sie sind alle derselbe Knoten:

1. **Netzwerk-Konflikt:** Der Service konfiguriert **base-sepolia**, aber das Wallet mit Guthaben + 14 Transaktionen lebt auf **base-MAINNET**. Ein sepolia-verbundener Batcher mit einem Mainnet-Wallet signiert entweder gegen die falsche Chain (Tx sterben) oder — schlimmer — das Wallet-Feld `read-only` deutet an, dass die Signier-Verbindung nicht aufgebaut wurde, obwohl ein Key da ist.
2. **`walletAddress: "read-only"` trotz Key:** die Statusanzeige zeigt nicht die Adresse `0xD78E…` — der Pod nutzt den Key offenbar nur lesend oder das Feld wird falsch befüllt.
3. **0/9 confirmed bei connected: true:** Verbindung steht, aber seit der Korrektur wurde kein Batch bestätigt — entweder der Batcher-Timer läuft nicht, oder die Tx schlagen auf der falschen Chain fehl (Gas auf Sepolia vorhanden?).

### Zu prüfen (Ops, konkret):

1. **Welches Netzwerk soll es sein?** Decision nötig: Sepolia = Testnet (Contract `0xAd31…` ist dort deployed lt. Status), Mainnet = das finanzierte Wallet. **Beides zusammen geht nicht.** Wenn Mainnet: Contract auf Base-Mainnet deployen (der `0xAd31…`-Contract existiert dort evtl. nicht!) + Service-Config umstellen. Wenn Sepolia: das Mainnet-Wallet-Guthaben ist für Sepolia nutzlos — Sepolia-Gas über Faucet holen, und die .env auf das Sepolia-HD-Konto prüfen.
2. **Warum `read-only`?** Im Code nachsehen, wann walletAddress den String "read-only" bekommt — vermutlich ein Fallback-Zweig, wenn die Signier-Wallet nicht initialisiert. Wenn ein Key in der .env steht und trotzdem read-only: Initialisierung schlägt fehl (RPC? Chain-ID-Mismatch?).
3. **Batcher-Timer:** 9 Batches pending, connected: true — läuft der Worker? Pod-Logs nach Batch-Versuchen durchsuchen.
4. **Die .env-Kette:** apps/service/.env (Quelle) → deploy/helm/secrets.env (Deploy) — ist der Key auf dem WEG dorthin identisch, und landet er im Pod als Env/Secret? (0600 auf beiden Seiten ist gut — aber der Pod könnte eine Dritt-Kopie mit altem Stand haben.)

### Empfehlung (aus der Spec-Sicht)

Kurzfristig auf **einem** Netzwerk konsolidieren (vermutlich Sepolia — der Contract ist dort deployed und Tests sind frei), Mainnet-Wallet-Guthaben als Reserve für später. Und danach den `mode: "read-only" | "anchoring"`-Vorschlag aus der ersten Diagnose umsetzen — die Anzeige hätte diesen Konflikt in Sekunden sichtbar gemacht.

---

## Befund (a) unverändert: search-turbo 500

Root Cause steht (Spalte `embedding_tq_polar` fehlt in der Prod-DB, Feldname `query_embedding` korrekt). Wartet auf die Migration am Pod.
