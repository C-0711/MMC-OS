# NACHTSCHICHTPAKET — alles bereit zum Losrennen

*Für: Claude Code auf dem Mac (und ggf. direkt auf der H200v) · Von: Spec-/Live-Seite (Hermes) · Erstellt 2026-08-30 · Umfasst: 8 Commits auf `local-merge` (Repo C-0711/MMC-OS)*

---

## 0. Der eine Satz

**Die Nachtschicht baut den ersten Eingang: der User wirft Material ein, der Live-Bericht nennt Namen aus seinen Dokumenten in Sekunden, drei klickbare Fragen gehen an Gemma 4 31B — und während er noch liest, kann er schon fragen.**

## 1. VORBEREITUNG (30 Minuten, bevor irgendetwas gebaut wird)

### 1.1 Repo-Stand ziehen

```bash
cd <dein/MMC-OS-Checkout>
git fetch origin
git checkout local-merge   # oder: git pull origin local-merge
# Erwartung: HEAD = 2955d7b (oder neuer, wenn Mac parallel pushte — FETCH_HEAD-Log prüfen!)
git log --oneline -9
```

Die 8 Commits (früheste zuerst):
1. `9e9dedd` — PAT-Akzeptanz-Doc (vision-Suche + /v1/user + /v1/organizations live verifiziert)
2. `70ea6e6` — **18. Spec: massen-ingest** — die Sanduhr (Millionen Seiten, CDOC-Wertstrom)
3. `6266554` — **19. Spec: buerger-assistent** — drei Wellen, Bürger immer im Loop
4. `4f47a81` — **AUFTRAG-ingest-mac** — Scan-First + Design-Anleitung (Sanduhr 3–4 Körner/s)
5. `036b213` — **20. Spec: meister-seite** — Quelle an/aus, Ehrlichkeitszeile
6. `318bd9a` — **AUFTRAG-notebookai-revival** — Zwei-Welten-Topologie (Festung + Privat)
7. `bfc5ca7` — W1a: erster Eingang (Live-Ingest, dynamischer Bericht, 3 Fragen)
8. `2955d7b` — W1a: Drei-Lane-Ingest (pdfx/DocTR/Vision, gemessene Tempi, Live-Infra)

### 1.2 Pflicht-Lektüre vor dem Bau (in dieser Reihenfolge)
1. `docs/AUFTRAG-notebookai-revival.md` — W1a ist das Kernstück dieser Nacht; W1b (Secrets-Sicherheit) ist Teil derselben Nacht.
2. `docs/AUFTRAG-ingest-mac.md` — Scan-First-Gesetz und Design-Ton (Sanduhr) gelten UNVERÄNDERT weiter.
3. `docs/spec/massen-ingest-v0.1.md` + `docs/spec/meister-seite-v0.1.md` — die Regeln, gegen die gebaut wird (Negativ-Kataloge sind Abnahme-Kriterien).

### 1.3 SAFTY-STOPP (bevor `notebookai` angefasst wird — aus dem VPN-Vorfall gelernt)

```bash
cd ~/projects/notebookai
git status                      # ERWARTET: alles uncommitted, nur 1 Initial-Commit
git ls-files                    # was ist überhaupt getrackt?
ls -la .env docker-compose.yml  # KLARTEXT-SECRETS — NICHT committen!
```

- [ ] `.env` → in `.env.example` umwandeln (Werte raus), echte Werte nach `secrets.env` (chmod 600)
- [ ] `docker-compose.yml`: Secrets raus (aus Env-Ref), Compose ohne Klartext
- [ ] `.gitignore` prüfen: `.env`, `secrets.env`, `*.local` drin
- [ ] ERST DANN: Commits in Etappen (Datei für Datei, KEIN `git add -A`)
- [ ] Remote: internes GitLab (privat), NICHT public GitHub

## 2. BAUAUFTRAG W1a — DER ERSTE EINGANG (Kernstück der Nacht)

**Ziel-Beweis (Abnahme am Morgen):**
> 50 Dokumente in einen Ordner geworfen → nach < 10 s zeigt der Live-Bericht den ersten NAMEN aus dem Dokument-Inhalt (nicht dem Dateinamen). Nach ~30 s stehen 3 klickbare Fragen. Ein Klick → Gemma 4 31B antwortet mit Beweis-Rechteck, während Dokument 20+ noch gelesen wird. Tab schließen/öffnen: Ingest läuft unbeeindruckt weiter.

### 2.1 Backend — Ingest-Worker (Node/TS, im notebookai-Stack)

```
POST /api/ingest/start   {quellen: [pfad|upload], container?: id}
GET  /api/ingest/stream  → SSE (text/event-stream)
     events: {typ:"dokument_fertig", name, lane, ms, atome, fundstellen}
             {typ:"bericht_aktualisiert", zusammenfassung, namenAusDokumenten}
             {typ:"fragen_bereit", fragen: [q1, q2, q3]}
             {typ:"done", totalMs, textSeiten, ocrSeiten}
POST /api/ingest/ask     {frage} → SSE-Antwort von Gemma 4 31B (stream, mit atomRefs)
```

**Drei-Lane-Router (das Herzstück):**
| Bedingung (pro Dokument, in ms entscheidbar) | Lane | Dienst |
|---|---|---|
| PDF hat Textschicht (`pdfx-serve` sagt ja) | TEXT | `pdfx-serve` (Rust) — Seiten + Wort-Rechtecke direkt |
| PDF ohne Textschicht / Bild-PDF / Scan | OCR | DocTR (GPU0/GPU1, ~15 ms/Doc), Fallback PP-OCR-Familie |
| Foto/Bild (HEIC/JPG) | VISION | Florence-2 / Moondream 2 / Gemma Edge E2B |

**Worker-Regeln (hart, aus dem Auftrag):**
1. Queue entkoppelt — der Worker wartet NIE auf die UI; Events dürfen coalescen (alle `dokument_fertig` seit letztem Flush = ein `bericht_aktualisiert`).
2. Priorität: kleine Dokumente zuerst (frühe erste Fragen!), dann Masse.
3. Commit vor Deutung: jedes Dokument landet byte-identisch in `docs/` des Containers, BEVOR Lane/Atome laufen (nur wenn der Scan-Report genickt wurde — Scan-First gilt).
4. SSE-Event muss `lane` + `ms` tragen — der Bericht zeigt zwei Zahlen (Text-Seiten vs. OCR-Seiten getrennt).
5. Ehrlichkeit: Fragen während des Ingest antworten nur aus bereits committet+embeddeden Atomen; fehlender Teil wird gesagt, nie still ausgelassen.

**Läuft gegen (Live-Infra):** gitchain-service (k3s, ns gitchain) · gitchain-postgres (k3s, ns bosch) · 0711.events-Redis · Rate-Limit-Redis · cdoc-api (Pod, hostPort) · EmbeddingGemma 300M · Gemma4-mm (vLLM TP2) — **Ollama-Port :11434 ist TABU, alles über die k3s-Fabric (:11435/:11436).**

### 2.2 Der dynamische Bericht (Front-End)

**Struktur (NotebookAI erweitern, Design-Register bindend):**
- Eine ruhige Seite: oben Mini-Sanduhr (3–4 Körner/s, Olivgold auf Warmweiß — siehe AUFTRAG-ingest-mac §B), darunter der Bericht als wachsende Liste.
- Berichtszeilen nennen NAMEN AUS DEN DOKUMENTEN:
  - `„Rechnung Stadtwerke 08/2026 · 89 € · fällig 15.09."` (aus Atomen)
  - `„Mietvertrag · Parteien: M. Mustermann ↔ Hausverwaltung X · Kaution 3 MM"` (aus Atomen)
  - NICHT: `„invoice_final_v2 (1).pdf"`.
- Zwei Fortschritts-Zahlen in Mono-Fußnote: *„Text-Lane: 3.800 Seiten · OCR-Lane: 12 Seiten"*.
- **Die 3 Fragen** als klickbare Karten (Salbei-Rahmen, Serif): aus den ersten Atomen generiert (Vertragsfelder → Laufzeit-Frage; Rechnungs-Atome → offene-Posten-Frage; Parteien → Kaution-Frage). Nach Klick: Frage-Chip im Chat, Antwort streamt mit Beweis-Rechteck-Popup auf die Quellseite (Zitations-Popup existiert schon im NotebookAI-RAG — wiederverwenden!).

### 2.3 Fragen-Generator (Modul `frageVorschlaege`)

```
Eingang: die ersten N gelesenen Atome (gemischt über Typen)
Regeln:
  - max. 3 Vorschläge, jeder MIT Atom-Ref (Klick = sofort beantwortbar)
  - ein Vorschlag pro Dokumenttyp (nicht 3× Rechnung)
  - Formulierung im Bürger-Ton („Was steht in meinem Mietvertrag zur Kaution?")
  - nie Fragen zu Atomen mit trust:"low", ohne das zu sagen — oder mit Trust-Label
Ausführung: Gemma 4 31B (ein Aufruf, ~2 s) nach jedem 10. Dokument oder bei
Typ-Wechsel; resultierende Fragen landen als `fragen_bereit`-Event
```

### 2.4 W1b — Aufräumen (parallel, ~1 h)

- [ ] notebookai-Stack: Docker auf :10400/:10401 gegen k3s-Fabric zum Laufen bringen (Beweis: Chat mit einer PDF lokal).
- [ ] TASKS.md aktualisieren (Ollama-Port-Ersetzung als erledigt streichen).
- [ ] Playwright-Screenshot der neuen Live-Bericht-Seite ins Repo (docs/bilder/) — vorherige PNGs (02-notebook-3panel.png …) als „März-Stand" kennzeichnen oder archivieren.

## 3. ABNAHME (Morgens, in dieser Reihenfolge)

1. **Tempo-Beweis:** 50 Dokumente (Mischung: 45 Text-PDF, 4 Scan-PDF, 1 Foto) → Bericht zeigt ersten Namen < 10 s; beide Lane-Zahlen vorhanden.
2. **Fragen-Beweis:** 3 klickbare Fragen nach ≤ 30 s; eine beantwortet mit Beweis-Retteck, während `done` noch aussteht.
3. **Robustheits-Beweis:** Browser-Tab zu nach Dokument 10 → wieder auf → Bericht holt Zustand nach (SSE-Reconnect), Ingest lief durch (Worker-Log zeigt keine Pause).
4. **Scan-First-Beweis:** Ohne vorheriges Nicken im Scan-Report wird NICHTS committet (Container-Git-Log leer).
5. **Security-Beweis:** `git log --all --full-history -p -- .env docker-compose.yml` zeigt NIE einen Klartext-Secret; `git ls-files | grep -i secret` leer.
6. **Stil-Beweis:** Screenshot gegen Design-Register: Warmweiß/Salbei/Olivgold/Tinte, Serif-Titel, Mono nur für Zahlen, Sanduhr 3–4 Körner/s, keine Fortschritts-Disco.

## 4. Was NICHT in dieser Nacht gebaut wird (Abgrenzung)

- Meister-Seite (W3 — erst wenn W1a+W2 stabil sind)
- Audio-Overviews (W4)
- Festungs-Mandantenfähigkeit (W4)
- Takeout-Importer (separater Auftrag AUFTRAG-ingest-mac, Welle 1.1)

## 5. Der Satz

*Über Nacht wird aus einem schlafenden 30-%-Klon ein lebendiger erster Eingang: Sand fließt durch drei Düsen, der Bericht erzählt, was er liest, und der User stellt seine erste Frage, bevor die Nacht endet.*
