# Backend-Stand — für das MMC-OS-Team

*Lebendes Dokument · Stand 2026-08-30*

Ihr baut gegen den 0711-Backend (OCR-Pipeline, gitchain-lite, GitChain). Der
Unterbau wurde konsolidiert — **alle Client-Verträge sind gehalten** (per
Golden-Vergleich verifiziert, nicht nur per Status-Code). Hier ist, was für euch
gilt, was kommt, und welche Bau-Regeln daraus folgen.

## Die Verträge, gegen die ihr baut

| Endpunkt | Vertrag | Notiz |
|---|---|---|
| `https://api-gitchain.0711.io` | git smart HTTP (`/git/<typ>/<ns>/<id>.git`, HTTP Basic mit PAT im Passwortfeld) · OCP v1 (`/api/ocp/v1/{registry,identity,manifest,activate,invoke}`) · `/v1/user` (PAT-Introspection) · `/api/v2/health` | Der Weg zum Gedächtnis. Anonymes git bekommt 401 — das ist der Vertrag, kein Fehler |
| `https://ocr.0711.io` | Reader/OCR-Pipeline; ohne Anmeldung 401 | 401 ist der Vertrag |
| `https://gl.0711.io` | gitchain-lite (Brain-Index) | unverändert |
| `https://gitchain.de` | Device-Login (`/auth/device/start`, `/auth/device/poll`, `/auth/whoami`) | Pfade bleiben stabil, auch wenn der Träger dahinter wechselt |

## Bau-Regeln (jetzt schon einhalten)

1. **Mandant kommt aus der Auth (PAT), niemals aus selbst gesetzten Headern.**
   Baut keine Logik, die Mandanten-Kontext über Request-Header transportiert —
   die Plattform leitet ihn aus dem Token ab.
2. **Für OCP heute `api-gitchain.0711.io` verwenden.** `gitchain.0711.io/api/ocp/*`
   antwortet derzeit noch nicht; das kommt mit der nächsten Umbaustufe (dann sind
   beide gleichwertig).
3. **Status-Code 200 beweist keine funktionierende Antwort.** Prüft Inhalte
   (Schema/Feld, nicht nur HTTP-Code) — Wartungs- und Platzhalterseiten liefern
   auch 200. Unsere Abnahmen vergleichen deshalb normalisierte Antwort-Hashes;
   für eure Tests ist ein Feld-Assert das Minimum.
4. **In Cluster-Kontexten Dienstnamen (DNS) statt Host-IPs adressieren.**
   Pfade, die von außen und vom Host funktionieren, können aus Containern heraus
   anders geroutet werden — Namensauflösung über den Cluster ist der stabile Weg.
5. **URLs aus API-Antworten nicht cachen/hardcoden.** Einige Antworten (z.B.
   OCP-Registry) spiegeln den Request-Host in `*_url`-Feldern — immer relativ
   zur eigenen Basis-URL auflösen.

## Was als Nächstes kommt

- **`inspektor.0711.io`** wird durch den neuen Reader ersetzt;
  **`gitchain.de` / `gitchain.0711.io`** zeigen danach direkt auf die
  GitChain-API — inklusive lebendem `/api/ocp/*`. Der Device-Login behält seine
  Pfade (ein Adapter sorgt für Kompatibilität).
- Kurze, angekündigte Wartungsfenster im Minutenbereich sind möglich; baut
  Retries mit Backoff ein statt harter Fehler beim ersten 5xx.

## Wen fragen

Entscheidungen und Zugänge: C. Betriebsprotokoll und Portvertrag liegen im
internen GitLab (nicht in diesem Repo — hier ist public, dort steht der Rest).
