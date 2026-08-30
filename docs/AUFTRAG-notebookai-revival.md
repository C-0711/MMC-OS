# AUFTRAG: NotebookAI-Wiederbelebung — von 30 % zum stillen Eigenbau

*Für: Claude Code auf dem Mac / H200v (`~/projects/notebookai`) · Von: Spec-/Live-Seite (Hermes) · Erstellt 2026-08-30 · Baut auf: meister-seite-v0.1 (20. Spec), massen-ingest-v0.1, buerger-assistent-v0.1*

---

## 0. Der eine Satz

**Wir wecken `~/projects/notebookai` wieder auf, bringen ihn in 4 Etappen von 30 % auf den eigenen NotebookLM — aber die Oberfläche wird dabei stiller statt lauter: super simple Front-Fläche, die Engines dahinter machen aus dem Content das Beste, und die Rechenkraft kommt aus der Festung (H200v-Cluster, geteilt zwischen Mittelständlern), während der Bürger-Teil privat oder on-prem bleibt.**

## 1. Die Zwei-Welten-Topologie (Festung + Privat)

```
┌────────────────────────────────────────────────────────────────┐
│  DIE FESTUNG (H200v-Cluster)                                    │
│  geteilt zwischen Mittelständlern — Chiffre-only, Mandant=Baum  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │  Mittelständler│ │  Mittelständler│ │  Mittelständler│   ← Capability je   │
│  │  A (Bosch-artig)│ │  B (Bank)      │ │  C (Lieferant) │     Mandant, nie     │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘     Filter auf         │
│         └────────────────┼────────────────┘              geteilter Tabelle  │
│                          ▼                                                  │
│         schwere Engines: Embedding-Massen-Jobs, Fein-Suche,                │
│         Audio-Overviews, Studio-Agenten (Flashcards/Quiz/Mindmap)           │
└────────────────────────────────────────────────────────────────┘
                           ▲ nur redaktionierte Slices, jeder Cross geloggt
                           │ (Gateway-Disziplin, technical-spec §2.6)
┌────────────────────────────────────────────────────────────────┐
│  PRIVAT / ON-PREM (der Bürger)                                               │
│  Mac = Denker · Phone = Tresor + Zeuge · Deutung + Speicher LOKAL            │
│  Alltags-Deutung auf dem Gerät, Festung nur für die Nacht-Arbeit             │
│  (Massen-Embedding), nie für die Seele                                       │
└────────────────────────────────────────────────────────────────┘
```

**Regeln:**
1. Der Bürger-Mandant liegt NIE in der Festung — Festung = Unternehmen (Mittelständler), Privat bleibt auf eigenen Geräten. Ausnahme: explizit gewählter „Nachtwächter"-Job (Sanduhr-Massen-Embedding), bei dem nur Chiffre + redaktionierte Slices die Festung sehen.
2. Jede Festungs-Nutzung ist eine Capability mit Preis (Capability-Ökonomie: Sand rein, Dollar raus — der H200v-Cluster ist die kommerzielle Sanduhr-Mitte für Mittelständler).
3. Tresor-Konvention gilt verschärft: Betreiber sieht nur Chiffre, Attest, Exit-Pfad (README-Offen-Punkt, wird hiermit zur Pflicht für die Festung).

## 2. Der wiedergefundene Baustein: `~/projects/notebookai` (Stand März 2026)

| Vorhanden (30 % lt. Selbsteinschätzung TASKS.md) | Fehlt (70 %) |
|---|---|
| Next.js 16 App Router, TS, Tailwind, Prisma, Postgres+pgvector | Ollama-Endpunkt umstellen (alt `:11434` → k3s-Fabric `:11435/:11436`) |
| Quellen-Upload: PDF (pdf-parse), DOCX (mammoth), Web (cheio) | weitere Reader-Schemas (Bilder/HEIC, MBOX, Scans → ocr.0711.io) |
| Basic-RAG-Chat mit Zitations-Popups | Quellen-MIX (meister-seite: an/aus, Ehrlichkeitszeile) |
| 5 Text-Agenten (Flashcards, Quiz, Mindmap …) | per-Agent LLM-Auswahl (Anthropic/OpenAI/Ollama/OpenRouter — der geplante USP) |
| Docker-Compose-Entwurf (:10400, pgvector :10401) | O711I-SSO, Vault-Anbindung, Audio-Overviews, Deployment |

**VOR JEDER GITHUB/GITLAB-PUSH — SAFETY (aus dem VPN-Vorfall gelernt):**
- [ ] `git status` + `git ls-files` PRÜFEN: das gesamte Projekt ist **uncommitted** (nur 1 Initial-Commit, kein Remote).
- [ ] `.env` und `docker-compose.yml` enthalten **Klartext-Secrets** (`notebookai_secret_2024` etc.): VOR dem ersten Commit/_PUSH: Secrets in `.env.example`-Muster umwandeln, echte Werte in Vault/`secrets.env` (0600), `.env` in `.gitignore`, `git add -A` VERBOTEN — Datei für Datei.
- [ ] Erst committen (sauber, in Etappen), DANN Remote anlegen (gitlab.0711.io, privat).

## 3. Die Etappen (Wiederbelebung)

### Etappe W1a — DER ERSTE EINGANG: Live-Ingest mit dynamischem Bericht (Kernstück)

*Das Wichtigste zuerst: der Moment, in dem Sand zum ersten Mal fließt. Der User darf nicht warten — er muss ZUSEHEN können, wie sein Material verstanden wird, und schon währenddessen losfragen können.*

**Die Architektur des ersten Einlesens (streaming-first, aus dem Live-Krümmungsbetrieb):**

```
DROP/BEGIN EINGANG
     │
     ├─► WORKER (async, NICHT blockierend)         ┌────────────────┐
     │   pro Dokument — LANE-ENTSCHEIDUNG:         │  LIVE-BERICHT  │
     │   ┌─────────────────────────────────┐       │  (dynamisch,   │
     │   │ TEXT-LANE  pdfx-serve (Rust)    │       │   wächst mit   │
     │   │  10.000 Seiten ≈ 1 s           │       │   jedem Doc)   │
     │   │  Beweis-Rechtecke gratis+pixelgenau   └────────▲───────┘
     │   ├─────────────────────────────────┤                │
     │   │ OCR-LANE  DocTR ×2 (GPU0/GPU1)  │                │
     │   │  ~15 ms PRO DOKUMENT            │                │
     │   │  PP-OCRv6 (cdoc-paddle) /       │                │
     │   │  PaddleOCR-VL-1.6 / PP-OCRv5    │                │
     │   │  (hyperpipe) / paddle-table     │                │
     │   ├─────────────────────────────────┤                │
     │   │ VISION-LANE Florence-2 ·        │                │
     │   │  Moondream 2 · Gemma Edge E2B  │                │
     │   └─────────────────────────────────┘                │
     │   1. commit als Eingang (docs/ byte-id.)             │
     │   2. Lane lesen/OCR — Fundstellen direkt aus Reader  │
     │   3. Atome extrahieren (Feld + Fundstelle)          │
     │   4. embedden (EmbeddingGemma 300M)                 │
     │   5. SSE-Event pushen ─────────────────────────────┘
     │      {typ:"dokument_fertig", name, atome, fundstellen, lane, ms}
     │
     ├─► LLMs: Gemma4-mm (vLLM TP2, beide Karten) für Sehen-Deutung
     │        Gemma 4 31B für Chat/erste Fragen (Fabric :11435)
     │
     └─► INFRA: gitchain-service (k3s ns gitchain) · gitchain-postgres
              (k3s ns bosch) · 0711.events-Redis · Rate-Limit-Redis
              · cdoc-api (Pod, hostPort) · cdoc-belege-review
              (hostNetwork, Oberfläche — kein pm2 mehr)
```

**Live-Beleg der Tempi (gemessen 2026-08-30, hier im Container reproduzierbar):**
- TEXT-LANE: 10.000 Seiten reines Text-PDF in **1,36 s (1 Kern)** / **0,34 s (8 Kerne)** — „10.000 Seiten in 1 Sekunde" gilt wörtlich für Textschicht-PDFs (pdfx-serve, Rust, macht das auf der H200v nochmal schneller).
- OCR-LANE: **DocTR bis 15 ms pro Dokument** (×2 auf GPU0/GPU1) — ein 100-Seiten-Scanstapel ist ein ~1,5-Sekunden-Job pro Instanz; die Masse skaliert über beide GPUs.
- Daraus folgt die Berichts-Ehrlichkeit: **ZWEI Zahlen** („3.800 Seiten Text-Lane · 12 Seiten OCR-Lane"), getrennt nach Lane — sonst wirkt OCR-Masse fertig, wenn nur Text durch ist.

**Regeln (hart):**

1. **Streaming darf NIE das Tempo aufhalten.** Der Ingest-Worker pusht SSE-Events; die Berichts-UI ist reiner Konsument. Wenn die UI hängt, stockt der Sand nicht — und umgekehrt: Der Worker wartet nie auf die UI (Queue entkoppelt, Events dürfen coalescen).
2. **Der Bericht ist dynamisch, nicht final.** Er entsteht Dokument für Dokument:
   - *Nach Dokument 1:* „**Eingegangen:** ‚Versicherungsvertrag_Hausrat_2019.pdf' — ich lese gerade …"
   - *Nach Dokument 3:* „**3 Dokumente verstanden** — darunter: ‚Rechnung Stadtwerke 08/2026' (89 €), ‚Mietvertrag' (Parteien: …). **Erste Fragen, die ich dir stellen kann:**"
   - Der Bericht NENNT Namen AUS den Dokumenten („Stadtwerke", „Hausrat 2019", „Mietvertrag") — nicht Dateinamen-Metadaten, sondern Gelesenes. Das ist der Beweis-Moment: der User sieht, dass verstanden wurde, nicht nur gezählt.
3. **Fragen-Hilfe fürs erste Gemma-Gespräch (31B):** der Bericht generiert aus den ersten gelesenen Atomenen **3 vorgeschlagene Fragen** als klickbare Karten:
   - *„Was steht in meinem Mietvertrag zur Kaution?"* (aus dem Atom: Mietvertrag + Kaution vorhanden)
   - *„Wann läuft meine Hausrat-Versicherung aus?"* (aus dem Atom: Vertragslaufzeit-Feld)
   - *„Welche Rechnungen sind noch offen?"* (aus Rechnungs-Atomen mit Betrag + Fälligkeit)
   - Klick → Frage geht sofort an Gemma 4 31B, die Antwort mit Beweis-Rechteck auf die gerade-ingestete Seite. **Der User muss nie selbst die erste Frage formulieren** — die Dokumente formulieren sie.
4. **Fragen während des Ingest sind erlaubt und beantwortbar:** Gemma 4 31B antwortet aus dem, was BEREITS committet+embedded ist; ist der relevante Teil noch nicht durch, sagt die Antwort es ehrlich (*„die letzten 2 Dokumente lese ich noch — sobald sie fertig sind, frage ich dich nicht mehr"*). Die Ehrlichkeitszeile (meister-seite) gilt hier schon.
5. **Reihenfolge = Lesen, nicht Alphabet:** der Worker priorisiert (a) was der User zuletzt/zuletzt geöffnet hat, (b) kleine Dokumente zuerst (frühe erste Fragen!), (c) dann die Masse. Der erste Bericht mit Namen kommt nach **Sekunden**, nicht nach dem ganzen Stapel.

**DoD W1a:**
- [ ] 50 Dokumente werfen → Bericht zeigt nach < 10 s den ersten NAMEN aus Dokument-Inhalt.
- [ ] Nach ~30 s stehen 3 klickbare Fragen; eine beantwortet Gemma mit Fundstelle, während Dokument 20+ noch liest.
- [ ] UI-Tab schließen/öffnen während des Ingest: Worker läuft unbeeindruckt weiter (Beweis: SSE-Wiederverbindung + Zustandsabholung).
- [ ] Kein einziges Dokument wird committet, bevor der Scan-Report genickt wurde (Welle-1-Regel gilt weiter).

**Etappe W1b — Sichern (Tag 1–2):** Secrets sanieren (§2 Safety-Checkliste), saubere Commit-Historie des Working Tree, Remote auf internes GitLab, Docker-Stack zum Laufen bringen gegen k3s-Fabric (`:11435`), Port 10400/10401 wieder lebendig. *Beweis: Chat mit einer PDF läuft lokal.*

**Etappe W2 — Anschließen (Woche 1–2):** NotebookAI als **Studio-Agenten-Engine** an die gitchain-Welt: Quellen nicht nur per Upload, sondern aus dem Container (`/api/v1/inject`-Muster — NotebookAI fragt Container statt Dateien); O711I-SSO; per-Agent LLM-Auswahl ausbauen (Ollama/Fabric-Modelle + bewusste Cloud-Ausnahmen mit Gateway-Logging). *Beweis: eine Frage über einen Bosch-Container mit denselben Zitations-Popups, Modell pro Agent wählbar.*

**Etappe W3 — Still machen (Woche 2–4):** Oberfläche auf Meister-Seiten-Philosophie: super simple ruhige Fläche (Design-Register), die Agenten (Flashcards/Quiz/Mindmap/Bericht) als Karten hinter einem „mach draus"-Moment — nicht als Feature-Wüste. Ehrlichkeitszeile + Quellen-Mix aus der meister-seite-Spec übernehmen. *Beweis: Außenstehender nutzt es in 3 Sekunden ohne Erklärung.*

**Etappe W4 — Festung (Monat 2+):** H200v-Cluster-Mandantfähigkeit: getrennte Bäume je Mittelständler (Mandant = Baum, nie Filter), Capability-Abrechnung, Attest/Exit. Audio-Overviews als eigenes Studio (der NotebookLM-USP — hier mit local-first-Stimmen statt Gemini). *Beweis: zwei Mandanten auf demselben Cluster, keiner sieht den anderen, Abrechnung zählt.*

## 4. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Secrets committen/pushen (auch „nur internes GitLab") | einmal History = für immer; VPN-Vorfall als Gesetz |
| `git add -A` im unkuratierten Projekt | gesamte Entwicklung liegt uncommitted — Datei für Datei kuratieren |
| Ollama alt `:11434` weiter nutzen | k3s-Fabric ist der Träger; Alt-Port = Zombie-Abhängigkeit |
| Bürger-Daten in die Festung | Festung = Unternehmen; Privat bleibt privat/on-prem (Ausnahme: bewusster Nachtwächter-Job) |
| NotebookLM-Feature-Parität als Ziel (jedes Bell, jedes Badge) | wir bauen die stille Version — die Oberfläche MUSS schrumpfen, während die Engines wachsen |
| Mandanten über Filter auf geteilter Tabelle | Kapsel-Gesetz: Mandant = Baum, fail closed |
| Cloud-LLM als Default in den Studio-Agenten | per-Agent WAHLBAR heißt: Fabric/Ollama first, Cloud als bewusste, geloggte Ausnahme |

## 5. Der Satz

*Der Klon wird kein Klon: dieselbe Kraft wie NotebookLM, aber still an der Oberfläche, souverän im Fundament — die Festung rechnet für die Mittelständler, das Wohnzimmer bleibt beim Bürger.*
