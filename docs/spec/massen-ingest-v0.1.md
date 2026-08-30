# Massen-Ingest-Spezifikation v0.1 — „die Masse"

*Status: Entwurf · 18. Spec im Verbund · Gilt für: gitchain OS (privat) + Workspace (Business) · Baut auf: intelligent-ingester, supercontainer, super-brain, ingress-flow, technical-spec*

---

## 0. Der eine Satz

**Wir lesen Millionen Seiten — nicht drei Dokumente —, verstehen und normalisieren sie lokal, bringen sie in Container (im Unternehmen nach Produkt, beim Menschen nach Thema), und aus der einmal aufgeschlagenen Masse wird in Sekunden zugänglich, was vorher unzugänglich war: der mächtigste Kontext, den es geben wird, souverän.**

## 1. Das Problem in Zahlen

| Ebene | Heute | gitchain |
|---|---|---|
| Mensch | dicke Ordner, Schuhkartons, Scan-Schublade — „irgendwo ist das" | alles wird Eingang; Fundstelle statt Erinnerung |
| Unternehmen | PLM/PIM/ERP + PDF-Archive, Millionen Seiten, halb findbar | Connector-Anchoring: jede Systemzelle zitierbar; PDF-Masse wird Atom-Basis |
| Suche | Dokument-Grobkorn, Gloss-Treffer | Seiten-Rechteck + `page_png_sha256` + Trust-Stufe |
| Tempo | Minuten bis „weiß nicht" | **Embed 14,8 ms · Kaskade 440,8 ms → Beweis-Basis < 1 s** (live, 2026-08-30) |

Der Satz „hundert bis Millionen Dokumente schlagen auf" ist keine Hyperbel, er ist der
Designfall: die Pipeline muss so gebaut sein, dass ein 500.000-Seiten-Archiv kein
Projekt ist, sondern ein Auftrag über Nacht.

## 2. Die Pipeline (drei Stufen, alle lokal) — die Sanduhr

```
      SAND (oben)                ENGPASS (Mitte)              DOLLAR (unten)
─────────────────────────────────────────────────────────────────────────────
  Ordner-Berge          ┌─ 1 LESEN      OCR + Layout          ┌─ Beweis-Basis
  Millionen PDF-Seiten  │               (reader-schemas       │   < 1 s
  Systemdaten (PLM/PIM/ │                signiert)            │   (14,8 ms embed
  ERP/R&D)              ├─ 2 EMBEDDEN   EmbeddingGemma 300M   │    + 440,8 ms
  dicke Aktenordner     │               MRL 768→128-d        │    Kaskade)
  Schuhkartons, Scans   │               Matryoshka-Kaskade    │
                        └─ 3 CONTAINERN Auto-Deploy nach      ├─ Dialog-
                            policy (super-brain):             │   Anreicherung
                            Unternehmen = nach Produkt/        │   (Commits,
                            Master; Mensch = nach Thema/       │   Fundstellen,
                            Fall (mehrere Sichten parallel)    │   multi-eyes)
                                                             └─ Capability-
                                                                Abrechnung (€)
```

### 2.1 Lesen
- Reader-Schemas sind **signierte Skills** (agent-containers): sie wissen je
  Dokumenttyp, welche Felder existieren müssen; fehlende Pflichtfelder →
  gezielte Frage zu genau diesem Feld (nicht „bitte prüfen Sie alles").
- Jedes Feld wird Atom mit `fundstelle` (Datei + Seite + Rechteck) — beim
  Unternehmens-Pull: (System, Objekt-ID, Revision, Abrufzeitpunkt, Attributpfad).
- Tabellen sind **Queries, nie Storage** (bestehende Regel, gilt unverändert).

### 2.2 Embedden (die Verstehens-Stufe, nicht nur Indexierung)
- Embedding ist ** lokal**, Dimensionen 128/256/512/768 als Matryoshka-Tiers
  (6× / 3× / 1.5× kleiner / exakt): die kleinen Dimensionen ranken, nur die
  exakten 768-d-Treffer werden beweis-relevant.
- „Verstehen und normalisieren": Einheiten, ETIM-Codes, Varianten-Sichten,
  Duplikate über `content_hash` erkennen — das Atom-Modell ist die Normierung,
  kein zusätzliches Mapping-Layer.
- Abdeckung ist eine Metrik, kein Zustand: `cited_atoms/total_atoms` pro
  Container sichtbar (live in der Registry: 4303 Container, 954 embeddings —
  die Masse ist gescannt, das Embedding wächst hinterher, nie umgekehrt).

### 2.3 Containern
- Unternehmen: Container nach **Produkt/Master** (Bosch-Muster: 157 Master,
  Varianten als eigene Fassung mit `parent_master`-Ref). Andere Gliederungen
  (Abteilung, Projekt, Rechtsträger) parallel möglich — ein Baum pro Sicht,
  die Atome bleiben identisch.
- Mensch: Container nach **Thema/Fall** — Auto-Deploy per gelernter policy
  (super-brain), kein Treffer → Vorschlag (fail closed), nie still angelegt.
- CDOC = der Prozess, nicht das Format: der Container ist das Ziel der Masse.

## 3. Dialog-Anreicherung (der Kontext wächst im Gespräch)

Die Masse ist der Startzustand, nicht das Ergebnis. Im Dialog mit dem Nutzer
(alleine, zu zweit, in Gruppen — team-raum/der Tisch) wird angereichert:

| Quelle | Was | Beweis |
|---|---|---|
| Nutzer-Antwort | fehlende Pflichtfelder, Korrekturen |.Commit auf den Zweifel-Atom; `learned_from` beim Lernen |
| AI-Deutung | Vorschlag mit Fundstelle, nie still | diff am Beweis-Rechteck sichtbar |
| Gruppe | multi-eyes: [Passt][Anders] am Rechteck | sichtbare Signatur-Kette |
| Unternehmen | Rollen-Freigabe | Fassung mit Rollen-Signatur |

Jede Anreicherung ist ein Commit mit Fundstelle — der Kontext wird mächtiger
**und** beweisbarer gleichzeitig. Das ist der Unterschied zu Chat-Historien:
das Gespräch verglüht nicht, es wird Baustoff.

## 4. Betriebseigenschaften (hard rules)

1. **Lokal**: Lesen, Embedden, Inferenz auf eigener Hardware (H200-Muster);
   kein Byte der Masse verlässt den Mandanten ohne bewussten, geloggten Cross.
2. **Kontinuierlich**: Aufnahme ist ein Stream (Ingester-Daemon), kein Skript-
   Sprint; ein neues Dokument ist Minuten nach dem Eingriff abfragbar.
3. **Fail closed**: unbekannter Typ, fehlendes Pflichtfeld, Zweifel → Frage/
   Vorschlag, nie stilles Raten.
4. **Kostbarkeits-Bilanz**: Speicher + Embedding-Compute pro Million Seiten
   sind eine Kennzahl des Systems (Capability-Ökonomie), nicht Marketing.
5. **Vergessbarkeit bleibt gleichberechtigt**: die Masse zu haben heißt nicht,
   sie behalten zu müssen — „Vergessen ist ein Commit"; DSGVO-Pfad über
   Container-Löschen + Rebuild-Ereignis (supercontainer-Gesetz: Brain ist
   rebuildbar aus den Fällen).

## 5. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Cloud-OCR/Cloud-Embedding der Masse | Souveränität: die Masse ist der Mandant, sie wandert nicht |
| Dokument-Grobkorn-Index („PDF gefunden") als Erfolg | Beweis ist Seite+Rechteck+Hash; weniger ist Pseudo-Fund |
| Silent-Ablage in Container | super-brain-Regel: kein Treffer der policy → Vorschlag, fail closed |
| Masse ohne Abdeckungs-Metrik | „alles drin" ohne cited/total-Zahl ist eine Behauptung, kein Beweis |
| Eine verbindliche Gliederung für alle | Unternehmen gliedert nach Produkt, Mensch nach Thema — Sichten sind Container-Filter, nie Identität |
| To-do-artige Anreicherung ohne Fundstelle | jede Anreicherung braucht Commits mit Beweis-Bezug, sonst verrottet der Kontext |
| Embedding-Abdeckung als Bool statt Zahl | 954/4303 ist die Realität; sie gehört auf den Screen, nicht ins Marketing |

## 6. Der Satz

*Die Masse ist eine Sanduhr: oben fließt Sand rein — Millionen Seiten, Ordner-Berge, Systemdaten; in der Mitte, im Engpass, presst die Kaskade ihn durch — Lesen, Verstehen, Normalisieren, lokal; und unten kommen Dollar raus: beweisbarer Kontext, den Kunden abfragen, anreichern und bezahlen.*
