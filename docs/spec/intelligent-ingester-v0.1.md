# Intelligenter Ingester v0.1 — „Der kennt dein Papier"

*Neunte Spec im Verbund · Referenzfall: Versicherungsstapel · Gilt für jeden Dokumenttyp (Police, Rechnung, Kontoauszug, Vertrag, Brief)*

---

## 0. Der eine Satz

**Der Ingester liest nicht Text — er erkennt Dokumenttypen und weiß, welche Felder dazugehören; was fehlt oder wackelt, fragt er gezielt nach. Jedes Feld trägt seine Fundstelle.**

## 1. Der Showcase: der Versicherungsstapel

Der Nutzer fotografiert den Schrank-Policenscheinstapel (oder die alte Excel-/Papier-Übersicht). Was passiert:

```
FOTO-STAPEL
   ↓  Commit vor Deutung (Originale byte-identisch in docs/)
   ↓  Reader (ocr.0711.io): Layout + Text + KOORDINATEN je Seite
   ↓  Typ-Erkennung je Seite: Privathaftpflicht-Police · Hausrat-Rechnung · KFZ-Police · …
   ↓  Feld-Extraktion gegen das Erwartungs-Schema des Typs
   ↓  Fall „versicherungen" wächst: jedes Feld ein Atom mit (Seite + Rechteck)
   ↓  Ableitungen: Fristen, Kontakte, Dubletten, Lücken
   ↓  1 offene Karte: „Ich habe 7 Policen erkannt. Eine Frage habe ich."
```

Das Nutzerfenster bleibt dabei stumm: *Scans — 1 open.* Kein Formular, keine Erfassungsmaske. Das Foto **ist** die Erfassung.

## 2. Das Erwartungs-Schema (warum der Ingester intelligent ist)

Stumpfes OCR liefert Text. Der Ingester hat pro Dokumenttyp ein **signiertes Schema** (ein Skill des Agenten-Containers), das sagt, welche Felder zu erwarten sind:

| Feld (Beispiel Police) | Pflicht? | Ableitung |
|---|---|---|
| Versicherer | Pflicht | Kontakt-Atom (Ansprechpartner) |
| Vertrags-/Policonummer | Pflicht | Schlüssel für Zuordnung künftiger Post |
| Produkt/Sparte | Pflicht | Dubletten-Check gegen bestehende Policen |
| Beitrag + Zahlungsweise | Pflicht | Kosten-Übersicht (Abfrage) |
| Deckungssummen / Selbstbeteiligung | Pflicht | Lücken-/Überschneidungs-Check |
| Laufzeit / befristet bis | optional | Frist-Atom-Kandidat |
| **Kündigungsfrist** | Pflicht† | Frist-Atom → Kalender (†fehlend → gezielte Rückfrage, s. §3) |
| **Ansprechpartner: Name, Telefon, E-Mail** | optional | **Kontakt-Atom** für den Anruf-Knopf |
| Bankverbindung / GL-Nummer / BN-Nummer | optional | Zuordnung für Beitragsabbuchungen |

**Die Regel:** Pflichtfeld fehlt oder Konfidenz < Schwelle → **gezielte Rückfrage zu genau diesem Feld** („Diese Police zeigt keine Kündigungsfrist — beim Anbieter sind es 3 Monate zum Laufzeitende. Übernehmen?"). Nie stumm annehmen, nie pauschal „bitte alles prüfen".

## 3. Was dabei entsteht

- **Fall „versicherungen"** als normaler Fall-Container: Originale (Fotos) + Atoms mit Rechteck-Fundstellen je Feld.
- **Die „Versicherungstabelle" ist eine Abfrage, kein Speicher** (gestricheltes Kästchen): „Welche Policen habe ich, was kosten sie, wann sind sie kündbar, wer ist mein Ansprechpartner?" → gerenderte Tabelle aus Atoms — jede Zelle klickbar auf ihren Beweis. Ändert sich eine Police, ändert sich die Tabelle, weil sie nie der Ort der Wahrheit war.
- **Fristen-Atoms** mit Quelle („KFZ kündbar zum 30.11., Frist 28.10. — Quelle: Police S.2, Absatz 3") → der Kalender *entsteht aus Dokumenten* (wie in der allerersten Skizze).
- **Kontakt-Atoms**: „Ansprechpartner bei der Haftpflicht: Frau Weber, 0800 …" — mit Fundstelle, inklusive Dokumentdatum (Angaben altern; die Telefonnummer weiß, woher sie kommt).
- **Dubletten-Erkennung**: „Du hast zwei Haftpflicht-Policen (A, seit 2019 · B, seit 2023) — soll ich die ältere zum Laufzeitende kündigen?" (R2 → Vorschlag, nie auto).
- **Lücken-Hinweis** (ungefragt nur als eine Karte, nie Vertrieb): „Typische Sparten fehlen: keine Berufsunfähigkeits-Versicherung erkannt." — ein Hinweis ist eine Aussage über *Vorhandenes*, keine Empfehlung über Nicht-Vorhandenes.

## 4. Der Anruf-Knopf (Verschränkung mit Kommunikations-Spec)

Der Kontakt-Atom macht die Telefonnummer zum **Aktionsfeld mit Beweis**:

```
[ Anrufen · Frau Weber · 0800-… · Quelle: Police S.1 · Stand 2025 ]
```

- Anruf startet den **geteilten Fall** (Kommunikations-Spec §2): Mitschrift landet als Atoms im Versicherungs-Fall — „was hat Frau Weber zugesagt?" ist ab dann eine Abfrage mit Beweis.
- Stimmt die Nummer nicht (Dokument veraltet), sagt das System es: „Diese Nummer stammt aus der Police von 2024 — der Anbieter hat gewechselt (neues Schreiben erkannt). Neue Nummer nehmen?"

## 5. Skill-Ökosystem (Partner-Kante)

Reader-Schemas sind **signierte Skills** im Agenten-Container (`skills/versicherung-leser/…`). Das öffnet die Partner-Welt: ein Makler, ein Versicherer, ein Buhl-Klasse-Anbieter kann einen **besseren Reader für seinen Dokumenttyp** ausliefern — signiert, versioniert, nachweisbar welche Fassung welche Deutung erzeugt hat. Der Ingester wird zur Plattform-Grenze, an der Dritte Qualität beisteuern, ohne je in die Fälle schreiben zu können (branch-only, wie überall).

## 6. Einordnung in die Ingress-Regeln

Der Ingester verletzt nichts von dem, was schon gilt — er schärft es:
- **Commit vor Deutung**: Fotos sind Originale, byte-identisch.
- **Drei Spuren**: Feld-Extraktion mit hoher Konfidenz = auto (R0/R1); ableitende Vorschläge (Kündigung, Frist) = Karte (R2); unverständliche Seiten = Zweifel (fail closed).
- **Kein Feld ohne Fundstelle**: auch die extrahierte Telefonnummer ist eine *Deutung* eines Rechtecks — beweisbar, prüfbar, korrigierbar („Anders" → Diff-Vorschlag).

## 7. Negativ-Katalog

| Verbot | Grund |
|---|---|
| Feld ohne Fundstelle committen | eine Zahl ohne Rechteck ist Meinung, nicht Wissen |
| Stummes Annehmen fehlender Pflichtfelder | gezielte Rückfrage ist der Unterschied zwischen OCR und Ingester |
| Tabelle als Speicher | die Übersicht ist Abfrage + Darstellung, der Fall ist die Wahrheit |
| Ungefragte Vertriebs-Empfehlungen | Lücken-Hinweis ja (Aussage über Vorhandenes), Produktempfehlung nein — sonst stirbt das Vertrauen |
| Erfassungsformular | das Foto ist die Erfassung; Masken sind die alte Welt |
| Reader-Skill ohne Signatur | Load-Regel fail closed (Agenten-Spec §4) |

## 8. Der Satz

*Du knipst deinen Schrank, und das System kennt deine Policen, deine Fristen und deine Ansprechpartner — jedes Feld ein bewiesenes, jedes Telefonat ein Fall, jede Frage eine Abfrage.*
