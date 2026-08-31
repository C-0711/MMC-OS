# AUFTRAG: Der Fall — ein Container als Chat, komplett erklärt

*Für: die Bau-Session (Mac/IDE) · Von: Design-Session · Status: BAUAUFTRAG + REFERENZ · Erstellt 2026-08-31 · Vorlagen: `docs/design-canvas/` Seite „Der Fall" (page-12, 17 Artboards) · Baut auf: souveraene-kommunikation-v0.1, massen-ingest-v0.1, meister-seite-v0.1, FRONT3-AUTH*

---

## 0. Der eine Satz

**Ein Fall ist ein endloses Gespräch mit Gedächtnis: zwei Drittel Chat, der alles trägt — Worte, Dateien, Anrufe, Erzeugnisse —, jede geteilte Zeile wird der anderen Person zugestellt, jede private Zeile bleibt gestrichelt bei dir, und der Strom selbst ist die Akte: committet, signiert, für beide byte-identisch.**

## 1. Warum so (die Erklärung hinter jeder Entscheidung)

**Warum Chat als Leitform?** Weil Menschen Chat können. WhatsApp hat bewiesen, dass „unten schreiben, hochscrollen für Geschichte" keine Erklärung braucht. gitchain nimmt diese Vertrautheit und legt darunter, was WhatsApp nie hatte: jeder Eintrag ist ein Commit, jede Behauptung trägt eine Fundstelle, und der Verlauf ist bei beiden Seiten derselbe Git-Baum — nicht zwei Kopien, die auseinanderlaufen können.

**Warum ist der Strom die Akte?** Weil ein Bericht, den niemand verlangt hat, tote Arbeit ist. Alles Beweisbare ist bereits im Strom: der Eingang byte-identisch, die Mitschrift mit Minuten, die Vereinbarung mit beiden Signaturen. Eine Fassung (Bericht) entsteht NUR, wenn draußen jemand eine braucht — Steuerberater, Versicherung, Gericht. Kein Bericht als Pflicht, nie.

**Warum eine private Spur im geteilten Raum?** Weil Denken privat ist und Sprechen geteilt. Wer im Fall sucht („alle Kontaktdaten aller Beteiligten"), denkt — das darf die andere Seite nicht sehen, sonst traut sich niemand zu denken. Erst das bewusste „In den Strom teilen" macht aus einem Gedanken eine Mitteilung.

## 2. Das Datenmodell (so wird es gebaut)

```
fall/unfall-passat/
├── strom/                      # der GETEILTE Strom = shared branch 'strom'
│   ├── 0001-text-lw.md         # jede Zeile = ein Commit, chronologisch
│   ├── 0002-eingang-fotos/     # Wurf: Eingang byte-identisch + Objekt-Karte
│   ├── 0003-anruf-mitschrift/  # Anruf-Objekt: wav + transcript + atoms
│   └── ...
├── privat/<did>/               # die PRIVATE Spur = lokaler ref, wird NIE gepusht
│   ├── s0001-suche.json        # Suchanfrage + Ergebnis (mit Fundstellen)
│   └── s0002-frage.json        # private Frag-mich-Antwort
└── .gitchain/zustellung.json   # Zustell-/Lese-Quittungen (siehe 3.2)
```

- **Geteilt = Branch `strom`.** Jeder Eintrag (Text, Wurf, Anruf-Objekt, Studio-Erzeugnis) ist ein Commit auf `strom`; Sync = push/pull über die eigene Registry (Anruf-Live-Pfad T15–T17 wiederverwenden).
- **Privat = Ref `refs/privat/<did>`.** Wird von Sync AUSGESCHLOSSEN (fetchspec whitelistet nur `strom`). Der Grep-Test dafür ist DoD: im Remote existiert kein einziges privates Objekt.
- **„In den Strom teilen"** = cherry-pick des privaten Eintrags auf `strom` (neuer Commit, neue Zeit — der geteilte Strom lügt nicht über den Moment des Teilens).

## 3. Die Mechaniken, einzeln erklärt

### 3.1 Jede geteilte Zeile ist eine Nachricht

Text, Foto-Upload, Dokument-Upload, Anruf-Ende, Meet-Ende, Studio-Erzeugnis: alles committet auf `strom` und wird damit zugestellt — es gibt keinen Unterschied zwischen „etwas in den Fall legen" und „es der anderen Person schicken". Das ist die Abschaffung des Unterschieds zwischen Dateiablage und Chat: **hineinlegen IST mitteilen** (im geteilten Fall).

### 3.2 Zustellung ehrlich anzeigen

- `an lena zugestellt ✓` = ihr Klon hat den Commit gefetcht (Registry meldet die Ref-Bewegung).
- `gelesen ✓` = ihr Gerät hat einen Lese-Commit auf `.gitchain/zustellung.json` gesetzt (selbst committet, also beweisbar — keine Server-Behauptung).
- Kein Häkchen-Theater: zwei Zustände, beide aus Git ableitbar, keine „online zuletzt"-Überwachung.

### 3.3 Die private Spur

- Auslöser: die ⌕-Taste am Wurf-Platz ODER ein gestrichelter Vorschlags-Chip.
- Darstellung: **gestrichelte Haarlinie** (1px dashed, rgba(42,37,32,.35)), Grund rgba(255,255,255,.6), Mono-Marke `nur du siehst das`.
- Jede private Antwort trägt Fundstellen wie jede geteilte ([n] → police S. 2 …).
- Fußzeile jedes privaten Eintrags: `In den Strom teilen` (Textlink Tinte) · `behalten` (sub) · Mono-Erklärung `suche = kein commit im geteilten strom`.

### 3.4 Vorschläge (der Fall denkt mit)

- Quelle: Deutung über den letzten Strom-Einträgen (Frag-mich-Pipeline, services.ts) — NIE aus Weltwissen.
- Form: Vorschlags-Zeile (Glyph + ein Satz + stiller `Machen`-Knopf) oder Chip über dem Wurf-Platz. Max. 2 sichtbar, Rest hinter „mehr zeigen".
- Gesetz: **Vorschläge senden nichts.** Erst „Machen" erzeugt den Commit (Anruf starten, Vereinbarung festhalten, Erinnerung anlegen). Bis dahin existieren sie nur lokal.

### 3.5 Suche im Fall

- Läuft lokal (µs, bestehende suche.ts), Ergebnis erscheint ALS STROM-EINTRAG in der privaten Spur — nicht in einem Modal, nicht auf einer zweiten Seite. Der Chat ist auch das Suchfenster.
- Jede Treffer-Zeile trägt ihre Fundstelle und springt beim Tipp auf Leseplatz/Minute.

## 4. Die sechs Formen (Vorlage: `FallStromFormen.dc.html` — pixelgleich bauen)

| # | Form | Wofür | Kernregeln |
|---|---|---|---|
| 1 | **Blase** | NUR gesprochenes/geschriebenes Wort | du = Salbei-Ton rechts, sie = weiß links; max. 480px |
| 2 | **Stille Arbeit, aufklappbar** | viele leise Assistenz-Schritte | EINE Zeile `Still einsortiert: 7 Schritte (2 warten) ⌄`; Offenes als Rosé-TEXT-Zeile, nie rot, nie Badge |
| 3 | **Frage-&-Antwort-Paar** | Frag-mich im Strom | Frage sub-grau, Antwort Tinte, Paar unzertrennlich, Antwort mit [n] |
| 4 | **Vorschlags-Zeile** | nächste Schritte | Glyph + ein Satz + stiller `Machen`-Knopf; max 2, Rest „mehr zeigen" |
| 5 | **Ding mit Handgriff** | Dateien, Erzeugnisse | EIN Knopf (Öffnen, Salbei), Zweitwege (teilen/beweis/verlauf) hinter ⌄ |
| 6 | **Wurf mit Vorschau** | Foto/Bild + Wort | Thumbnails klein VOR dem Satz; Wurf und Wort = EIN Eintrag/Commit |

Dazu überall: **die stille Fußzeile** — Beweis/Teilen/Vorlesen als Haarlinien-Glyphs in 45 % Tinte, sichtbar erst beim Verweilen; Zeit + Fundstelle + Quittung in Mono.

### Fließverhalten (Vorlage: `FallStromFluss.dc.html`)

Der Strom ist ein Dokument: Neues entsteht unten und schafft sich Platz, die Geschichte wohnt oberhalb, hochscrollen genügt; am oberen Rand klingt sie angeschnitten und verblasst aus (opacity-Verlauf, KEINE harte Kante). Auto-Scroll nur, wenn der Nutzer bereits unten war.

## 5. Der Rand (rechtes Drittel) und die Leiste

- **Rand** (`FallChat.dc.html` rechts): drei ruhige Blöcke — `Zwischen euch offen` (mit Minuten), `Was hier liegt` (EIN Serif-Satz, semantisch — Aufzählungen sind Fußnoten!), `Würde noch passen`. Darunter die Erklärzeile: „Kein Bericht nötig: der Strom selbst ist die Akte."
- **Leiste** (`FallLeiste.dc.html`): elf fall-gebundene Griffe um den Wurf-Platz. Links bringen hinein: Hineinlegen, Fragen, Anrufen, Meet, Studio (der Funke). Rechts arbeiten: Lesen, Suchen, Bericht, Teilen, Zeit, Mitnehmen. Wegwerfen wohnt NICHT in der Leiste (hinter Zeit). Jeder Griff = Commit auf DIESEN Container.

## 6. Werkstatt & Studio (Anschluss, nicht Teil dieses Auftrags)

`FallWerkstatt`/`FallStudio`/`FallErzeugnis` beschreiben, wie 3rd-Party-APIs (Konnektor + Systemzelle als Fundstelle), Einladungen und NotebookAI am selben Container andocken. Für DIESEN Auftrag genügt: die Leiste hat den Funke-Griff, und Studio-Erzeugnisse erscheinen als Form 5 im Strom.

## 7. Definition of Done

1. `npm run typecheck` + alle Tests grün; neue `strom.test.ts` (Commit-pro-Eintrag, Reihenfolge, Formen-Mapping) und `privat.test.ts`.
2. Zwei Instanzen (A/B, zwei MMC_VAULTs): A schreibt Text → B sieht ihn ≤ 2 s mit `zugestellt ✓`; B öffnet → A sieht `gelesen ✓`; Foto-Wurf und PDF-Wurf ebenso (Eingang byte-identisch committet VOR Deutung).
3. **Privat-Grep-Test (hart):** A führt 3 private Suchen aus → auf B's Klon UND im Registry-Remote existiert kein Objekt davon (`git rev-list --all | xargs git cat-file` + grep über Suchbegriffe = 0 Treffer). Danach: A teilt EINE davon → genau diese eine erscheint bei B, als neuer Commit mit Teilungs-Zeitpunkt.
4. Vorschlags-Zeile „Mi 9:00 als Vereinbarung festhalten" → `Machen` → Vereinbarungs-Atom mit Fundstelle, beide Signaturen einholbar; ohne `Machen` erreicht B nichts.
5. Suche „Kontaktdaten aller Beteiligten" liefert Zeilen mit Fundstellen (police S. 2, gutachten S. 6), jede springt auf Leseplatz/Minute.
6. Pixel-Vergleich gegen `FallChat`, `FallStromFluss`, `FallStromFormen`, `FallLeiste` (Review-Gate — gegen die Artboards, nicht gegen Erinnerung).

## 8. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Bericht als Pflichtschritt oder Standard-CTA | der Strom ist die Akte; Fassung nur auf äußeren Bedarf |
| Privates über den Sync-Kanal (auch verschlüsselt) | „aus ist aus"-Disziplin: privat verlässt das Gerät nicht |
| Zustell-/Lese-Status vom Server behauptet | Quittungen sind selbst Commits — beweisbar oder gar nicht |
| Vorschlag, der ohne „Machen" etwas sendet | Zustimmung ist ein Commit, nie eine Unterlassung |
| Alles als Blase rendern | Blase nur fürs Wort — sechs Formen sind der Vertrag |
| Badges, Zähler, rote Zahlen im Strom | Offenes ist Rosé-Text; Zahlen sind Mono-Fußnoten |
| Such-Modal oder zweite Such-Seite | der Chat ist auch das Suchfenster (private Spur) |
| Auto-Scroll, während der Nutzer oben liest | die Geschichte gehört dem Leser |

## 9. Reihenfolge-Empfehlung

1. Datenmodell (Branch `strom` + privater Ref + Ausschluss im Sync) — mit den Tests aus DoD 3 ZUERST.
2. Formen 1/5/6 (Blase, Ding, Wurf) auf dem bestehenden LiveStore — damit fließt der Alltag.
3. Zustell-/Lese-Quittungen (3.2).
4. Private Spur + Suche im Strom (3.3/3.5).
5. Formen 2/3/4 (stille Arbeit, Q&A, Vorschläge mit Machen).
6. Rand + Leiste, dann Pixel-Vergleich, dann Abnahme (Messlauf durch die Abnahme-Session).
