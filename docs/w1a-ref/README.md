# W1a-Referenz-Implementierung — „Der erste Eingang"

Referenz für die notebookai-Übernahme (W1a), Haus-Muster wie `gitchain-ref`.
Beweist die DoD aus `docs/NACHTSCHICHTPAKET-w1a.md` §2 und
`docs/AUFTRAG-notebookai-revival.md` Etappe W1a.

## Start

```bash
node server.js          # HTTP-Server auf http://127.0.0.1:3371
```

Testdaten erzeugen (50 Dokumente → `/tmp/w1a-testdaten/`):

```bash
node make-docs.js
```

## Test

```bash
node test-w1a.js        # E2E-Beweis aller 4 DoD-Kriterien, endet mit PASS/FAIL
```

## API

| Route | Bedeutung |
|---|---|
| `POST /api/ingest/start` `{quellen:[pfad], container?:id}` | startet den Ingest-Worker (entkoppelt, nie blockierend) |
| `GET /api/ingest/stream` | SSE: `dokument_fertig`, `bericht_aktualisiert`, `fragen_bereit`, `done` — Reconnect liefert Zustands-Snapshot nach |
| `POST /api/ingest/ask` `{frage}` | SSE-Token-Antwort `{t:"..."}` nur aus bereits verarbeiteten Atomen; sonst Ehrlichkeits-Satz |

## Drei-Lane-Router (`lanes.js`)

- **TEXT** — PDF mit Textschicht: echte Extraktion per PyMuPDF aus dem
  venv `/tmp/pdfbench/bin/python` (Child-Process, `extract_text.py`).
  Atome per Regex: Geldbeträge (EUR/€), Daten (TT.MM.JJJJ), Absender-Zeilen
  („Von:"/„Absender:") — jede mit Fundstelle (Seite).
- **OCR** — Scan-PDF ohne Textschicht: Platzhalter, simuliert 15 ms/Dokument
  mit echtem `setTimeout` (später DocTR).
- **VISION** — jpg/png/heic: Platzhalter (später Florence-2/Moondream).

## DoD-Mapping

| DoD | Beweis in `test-w1a.js` |
|---|---|
| Erster NAME aus Dokument-Inhalt < 10 s | (a) — Name aus `namenAusDokumenten` (kein Dateiname) |
| 3 klickbare Fragen ≤ 30 s | (b) — `fragen_bereit` mit 3 Fragen (`fragen.js`: 1 Typ pro Frage, jeder mit `atomRef`) |
| Antwort mit Beleg-Zitat während Ingest läuft | (c) — `/ask` antwortet mit `[n] datei · Seite N` vor `done` |
| Tab schließen/öffnen: Worker läuft durch | (d) — SSE-Abbruch + Reconnect, `done` kommt trotzdem |

## Worker-Regeln (hart)

1. Queue entkoppelt — Requests blockieren den Worker nie, Worker wartet nie auf die UI.
2. Kleine Dokumente zuerst (Sortierung nach Byte-Größe).
3. `bericht_aktualisiert` coalesct: max. 1 Event pro 500 ms.
4. Ehrlichkeit: `/ask` antwortet nur aus bereits verarbeiteten Atomen —
   fehlender Teil wird gesagt, nie still ausgelassen.

Kein npm, keine Fremdabhängigkeiten — nur Node-Stdlib + PyMuPDF aus `/tmp/pdfbench`.
