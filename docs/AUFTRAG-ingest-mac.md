# AUFTRAG: Ingest auf dem Mac — Scan-First, Bürger-Preview, lokale Sanduhr

*Für: Claude Code auf dem Mac von Christoph · Von: Spec-/Live-Seite (Hermes) · Status: BAUAUFTRAG · Erstellt 2026-08-30 · Baut auf: massen-ingest-v0.1 (18. Spec), buerger-assistent-v0.1 (19. Spec)*

---

## 0. Der eine Satz

**Der Mac findet alles, was ein Leben ausmacht — Laufwerke, Fotos, Mails, Messages, Verträge —, zeigt es zuerst als ruhigen Bericht ohne einen einzigen Inhalt, und erst wenn der Bürger nickt, fließt der Sand: lokal, committet, mit Fundstelle.**

## 1. Prinzip: SCAN-FIRST (die harte Reihenfolge)

```
   1 SCANNEN          2 ZEIGEN              3 NICKEN           4 INGESTEN
   (nur Metadaten,    (ingest-plan.json     (der Bürger        (Sand fließt:
   niemals Inhalte    als ruhiger Bericht,  entscheidet        Lesen → Embedden
   öffnen/lesen)      keine Inhalte)        pro Quelle)        → Containern)
```

**Verboten bis zum Nicken:** irgendetwas zu committen, zu embedden, zu versenden, in irgendeinen Container zu legen. Der Scan selbst darf nur `stat()`-Daten und Dateinamen lesen — kein Öffnen, kein Lesen, kein OCR.

## 2. Was gescannt wird (Quellen-Locations)

| Quelle | Location (macOS) | Typen | Besonderheit |
|---|---|---|---|
| Dokumente | `~/Documents`, Schreibtisch | pdf, docx, xlsx, pages, txt, rtf | auch Unterordner rekursiv |
| Bilder | `~/Pictures` (inkl. Photos Library.photoslibrary über `osxphotos`), `~/Downloads` | heic, jpg, png, tiff, dng | Photos-Library NUR read-only-API, nie die DB direkt |
| Mail | `~/Library/Mail` (read-only Ansatz über AppleScript/`sqlite` nur wenn User Export macht) — **bevorzugt: User exportiert Mailbox als .mbox** | eml, mbox | wenn kein Export: Mails weglassen, nicht hacken |
| Messages | iMessage-DB ist geschützt — **nur über angebotenen Export/Chat-Export** | txt, pdf exports | nie die chat.db direkt öffnen (TCC + Integrität) |
| USB / externe Laufwerke | `/Volumes/*` (automatisch beim Anschließen erkennen) | alles oben | je Stick/Laufwerk eigener Eintrag im Bericht |
| Cloud-Takeout | `~/Downloads/takeout-*`, Google Takeout ZIP | zip→mbox, ics, json, heic | Takeout wird NIE verändert, nur gelesen |
| Zeitmaschine / Backups | nur wenn User explizit einen Pfad zeigt | — | nicht automatisch |

**Härtung:**
- TCC-geschützte Ordner (Documents, Pictures, Mail) → beim ersten Scan macOS-Berechtigungs-Dialog sauber abwarten, nicht umgehen.
- Dateien unter 1 KB und System-Müll (`.DS_Store`, `._*`, Caches, `node_modules`, `Library/Caches`) überspringen.
- **Credentials-Filter (SAFETY-Regel aus dem Vorfall):** Pfade/Dateien mit Mustern wie `credentials`, `passwort`, `.ovpn`, `.cer`, `id_rsa`, `.p12`, `secrets`, `.env` → **nie committen, im Bericht nur als „⚠︎ sensible Datei übersprungen" zählen** (Anzahl, keine Namen). Das ist keine Option, das ist Gesetz.

## 3. Der Bericht: `ingest-plan.json` (+ was der User sieht)

Pro Quelle ein Eintrag, **ohne jegliche Inhalte**:

```json
{
  "quelle": "USB-Stick 'Bosch 2019' /Volumes/BOSCH2019",
  "typ": "usb",
  "dateien": 4231,
  "bytes": "18,2 GB",
  "nach_typ": {"pdf": 3800, "jpg": 312, "docx": 88, "xlsx": 31},
  "altersverteilung": {"vor 2015": 900, "2015-2020": 2100, "ab 2020": 1231},
  "beispiel_namen": ["Rechnung_2019_03.pdf", "Vertrag_BT_neu.pdf"],
  "geschuetzt_uebersprungen": 4,
  "schaetzung": {"seiten_nach_ocr": "~9500", "dauer_nacht": "~4 h"},
  "vorschlag_container": ["Versorgung/Verträge", "Steuern/2019"]
}
```

Dazu als UI: der **Scan-Report als ruhige Karte** (Design siehe Anleitung unten) — jede Quelle eine Zeile mit einer winzigen Sanduhr daneben, die fällt, während der Scan läuft, und wenn sie durchgelaufen ist, steht da nur: *„4.231 Dokumente · bereit, wenn du es bist."*

## 4. Der Ingest (nach dem Nicken)

1. **Eingang committen** (docs/, byte-identisch) — Commit-VOR-Deutung, Hausregel.
2. **Lesen:** OCR + Layout lokal (`ocr.0711.io`-Muster/belegsrv `127.0.0.1:8787`); reader-schemas generisch (Post, Rechnung, Vertrag, Versicherung, Zeugnis, Steuer).
3. **Embedden:** lokal auf dem Mac (EmbeddingGemma-Muster; die 300M-Modelle laufen auf Apple Silicon).
4. **Containern:** Auto-Deploy-Vorschlag per policy — unbekannt → Karte („wohin damit?"), nie still.
5. **Fortschritt als Zustand:** „gelesen 3.120 / 4.231 · eingebettet 2.400" — im UI als sanfte Zeile, kein Balken-Disco.

## 5. DoD (Definition of Done)

- [ ] `scan-mac.ts` (oder .py): scannt alle Quellen §2, schreibt `ingest-plan.json`, öffnet KEINE Dateiinhalte.
- [ ] Preview-UI (Electron, bestehende App): zeigt Quellen als Karten mit Sanduhr-Animation, Nicken = Button „Aufnehmen" pro Quelle.
- [ ] Ingest-Pipeline respektiert das Nicken; kein Commit vor Zustimmung.
- [ ] Credentials-Filter greift (Test mit Dummy-`credentials.txt` im Scan-Pfad → darf nie im Plan auftauchen).
- [ ] Nach Ingest: `cited_atoms/total_atoms` pro Container sichtbar.
- [ ] Ein End-to-End-Test: 10 PDFs → Eingang → Atom mit Fundstelle → Frag-mich-Antwort mit Rechteck.

---

# ANLEITUNG DESIGN — die Sanduhr, der Bericht, die stille Revolution

*Für: Claude Code / Design am Canvas · Ton: hochfein, subtil, „selbstverständlich" — die Leute sollen die Revolution spüren, ohne dass wir sie anschreien.*

## A. Der Grundton

Keine Zukunftsmusik, keine Neon-KI-Optik, keine „Alles wird einfacher!"-Slogans. Der Satz, den alles trägt:

> **Oben fließt dein Sand rein. Unten kommt dein Leben heraus, verständlich.**

Es wirkt, als wäre es immer schon so gewesen. Die Revolution ist, dass niemand mehr nach Ordner suchen muss — und das zeigen wir wie eine Tasse Tee, die jemand hinstellt.

## B. Die Sanduhr (das eine Element, das bleiben wird)

**Form:** winzig (24–28 px Höhe), Haarlinien-Strichstärke (0.75–1 px), Tinte `#2E2A26` auf warmweiß `#FAF7F2`. Kein Glas-Glanz, kein kitschiger Rahmen. Zwei Kammern, eine Taille.

**Die Animation (das Herzstück):**
- Im Scan/Ingest: Sandkörner fallen — **3–4 Körner pro Sekunde**, nicht mehr. Jedes Korn: 1px, Farbe Olivgold `#B8A369`, weicher 150-ms-Fade am Auftreffen unten. Kein Dauerregen, keine Sturzbäche — **eine Sanduhr, die Zeit hat.**
- Beim „Aufnehmen"-Nicken: die Taille leuchtet einmal sanft auf (Olivgold, 300 ms) — das ist das einzige „Ereignis".
- Fertig: unten liegt ein sanfter Hügel aus Körnern (keine Zahl, kein Konfetti). Der Hügel ist der Bericht.
- `prefers-reduced-motion`: Körner statisch, ein einziges sanftes Ausblenden.

**Darunter, in einer Zeile, gesetzt wie eine Fußnote:** *„4.231 Dokumente · bereit, wenn du es bist."* — Der Punkt ist kein Ausrufezeichen. Fertigmelden ist kein Triumph, es ist Selbstverständlichkeit.

## C. Der Bericht als ruhige Karte

- Jede Quelle (Dokumente, Bilder, USB „Bosch 2019", Takeout …) = **eine Karte im Karten-Stapel**, nicht eine Tabelle mit Zebra-Streifen.
- Kartenaufbau von oben nach unten: Quellenname (Serif, 15 px) → eine Zeile Zahlen in Mono 11 px (*„3.800 PDF · 18,2 GB · ältestes 2003"*) → rechts die Mini-Sanduhr.
- **Zahlen setzen, nicht rufen:** Mono-Fußnoten-Größe für Fundstellen und Mengen — im Design-Register ist Mono NUR für Fundstellen da, und Mengen sind Fundstellen des Lebens.
- Kein Dashboard-Gefühl: kein „Start Scan"-Hero-Button, kein Fortschritts-Ring. Der Einstieg ist eine Zeile: *„Ich habe Orte gefunden, an denen dein Leben liegt. Darf ich?"* — Karte für Karte, nikken oder weglegen.
- Der „Aufnehmen"-Affordance: kein grüner Bestätigungs-Knopf. Ein schlichter Textlink in Tinte: **„Aufnehmen"**, daneben leiser **„später"**. Wer abnickt, unterschreibt leise.

## D. Die Zeile unten (der Dollar-Moment)

Wenn der Sand durch ist, steht am Ende der Kartenreihe — nicht prominent, eher wie eine Signatur:

*„Verstanden: 9.500 Seiten. Was davon heute wichtig ist, liegt oben auf."*

Kein Euro-Zeichen im Bürger-UI (das wäre laut). „Dollar raus" übersetzen wir fürs Auge in: ** Wert sichtbar machen ohne zu beziffern** — der Hügel unten in der Sanduhr, die Zeile „verstanden: 9.500 Seiten". Das Bezahlen regelt die Capability-Ökonomie außen herum, nicht im Wohnzimmer.

## E. Was verboten ist (Negativ-Katalog, Design)

| Verbot | Grund |
|---|---|
| Fortschrittsbalken mit Prozent-Puls | Alarm-Ästhetik: der Bürger soll entspannt bleiben, nicht optimieren |
| Sand-Regen / Partikel-Feuerwerk | die Kaskade ist präzise, kein confetti — Subtilität IST die Botschaft |
| Ausrufezeichen, „Fertig!"-Badges | Fertigmelden ist ein Zustand, kein Ereignis |
| Euro/Dollar-Zeichen im Bürger-UI | Geld ist außen (Capability-Ökonomie), das Wohnzimmer bleibt wert-ruhig |
| Zahlen in großen Displays | Zahlen sind Mono-Fußnoten (Fundstellen-Register), keine Helden |
| Fotos/Inhalte im Scan-Report | Scan-First-Gesetz: der Bericht zählt, er zeigt keine Inhalte |
| Rote Warnfarbe bei „⚠︎ sensible Datei übersprungen" | stattdessen Tinte + kleines Schloss-Glyph; kein Alarm |

## F. Referenz-Token (aus dem Design-Register, bindend)

Warmweiß `#FAF7F2` · Salbei `#8FA98F` · Rosé `#D9A6A0` · Beige `#E8DFD3` · Olivgold `#B8A369` (nur Sandkörner + Taille) · Tinte `#2E2A26` · Serif für Kartentitel · Mono NUR für Zahlen/Fundstellen · max 300 ms · eine Bedeutung pro Animation.

## G. Abnahme

- [ ] Sanduhr fällt mit 3–4 Körnern/s, Olivgold, auf Warmweiß — und niemand im Raum regt sich auf.
- [ ] Der Bericht zeigt 1.000 Dateien ohne einen einzigen Inhalt.
- [ ] Ein Außenstehender versteht „Aufnehmen" ohne Erklärung — in 3 Sekunden.
- [ ] Der Credential-Filter-Test aus DoD läuft durch die UI hindurch sichtbar („4 geschützte Dateien nicht aufgenommen" als ruhige Zeile).
