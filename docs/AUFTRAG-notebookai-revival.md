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

**Etappe W1 — Sichern (Tag 1):** Secrets sanieren (§2 Safety-Checkliste), saubere Commit-Historie des Working Tree, Remote auf internes GitLab, Docker-Stack zum Laufen bringen gegen k3s-Fabric (`:11435`), Port 10400/10401 wieder lebendig. *Beweis: Chat mit einer PDF läuft lokal.*

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
