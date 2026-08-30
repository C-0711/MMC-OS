# Meister-Seite v0.1 — „die Quelle an/aus"

*Status: Entwurf · 20. Spec im Verbund · Gilt für: gitchain OS Desktop/iOS + Workspace · Baut auf: supercontainer, super-brain, interaction-voice-screen, buerger-assistent, massen-ingest, identitaet-email-container*

---

## 0. Der eine Satz

**Eine einzige ruhige Seite: jede Quelle deines Lebens als Zeile mit einem Schalter — an oder aus —, und jede Antwort kombiniert nur aus dem, was an ist, jede Zahl mit Fundstelle und der Ehrlichkeit, zu sagen, was sie nicht weiß, weil es aus ist.**

## 1. Die Seite (eine, nicht viele)

```
DIE MEISTER-SEITE — ruhig, scrollbar, sonst nichts
────────────────────────────────────────────────────────────
  ▸ Dokumente            ●──────── an   12.400 Atome
  ▸ Bilder               ●──────── an    3.100 Atome
  ▸ Mails                ○──────── aus   —
  ▸ Anrufe               ●──────── an      412 Atome
  ▸ USB „Bosch 2019"     ●──────── an    9.500 Seiten
  ▸ Teamcenter (rev. 47) ●──────── an    Connector
  ▸ Erikas Fachwissen    ○──────── aus   Rollen-Capability
  ▸ Versicherung A       ○──────── aus   (ausgetreten 2024)
────────────────────────────────────────────────────────────
                          Σ an: 5 Quellen · 22.212 Atome
                          „Frag mich etwas"  ·  „Bericht machen"
```

- **Keine Hierarchie, keine Ordner-Baum-Navigation.** Die Liste ist flach; Ordnung macht der Brain (Auto-Deploy), nicht der Mensch.
- Zeilen entstehen automatisch: jede neue Quelle (USB-Stick erkannt, System-Connector gebunden, Takeout importiert) erscheint als Karte mit sanftem 300-ms-Einblenden — niemand „legt Quellen an".
- Jede Zeile trägt nur drei Dinge: Name (Serif), Schalter, eine Mono-Zeile mit der Atom-/Seitenzahl. Nichts weiter. Details (Zeitraum, Trust-Verteilung, letzte Änderung) erst beim Antippen der Zeile — als aufklappbare Ruhe, nicht als Modal.

## 2. Der Schalter ist Zuständigkeit, kein Filter

| | Klassischer Filter (NotebookLM & Co.) | Meister-Seite-Schalter |
|---|---|---|
| Wirkung | blendet Treffer aus Ergebnisliste aus | die Quelle IST oder IST NICHT im Retrieval-Universum |
| Antwort bei „aus" | schweigt über die Lücke | sagt es: „aus deinen Mails weiß ich das nicht — sie sind aus" |
| Rechte | alle Quellen gehören dem Account | jede Quelle ist eine Capability (Schlüssel-Prinzip) |
| Kombination | unausgesprochen | jede Antwort zeigt ihren Quellen-Mix als kleine Zeile unter dem Beweis |

**Regeln:**
1. **Aus ist aus:** kein Retrieval-Kontamination, kein „aber vielleicht doch noch". Fail closed.
2. **Ehrlichkeitszeile:** jede Antwort/ jeder Bericht endet mit *„aus: Dokumente · Bilder · Teamcenter"* — der Mix ist Teil des Beweises.
3. **Rollen-Schalter (Job):** im Business-Kontext schalten Zeilen wie „Erikas Fachwissen" mit der Rollen-Capability — der Mensch schaltet nicht Daten um, sondern Zuständigkeit (enterprise-humans-Anschluss).
4. **Vergangenheit bleibt beweisbar:** ein Bericht, gestern mit 5 an-Quellen erzeugt, bleibt zitierbar mit genau diesem Mix — der Quellen-Stand ist Teil der Fassung (Commit), nicht des Moments.

## 3. Antworten und Berichte (die perfekten Kombinationen)

- **„Frag mich etwas"**: Frage → Kaskade über NUR an-Quellen (Matryoshka, wie gehabt) → Antwort mit Beweis-Rechtecken + Ehrlichkeitszeile. Im Bürger-Ton („Alles ruhig." bleibt ein Zustand).
- **„Bericht machen"**: eine Fassung (signiertes Dokument), erzeugt aus dem aktuellen Quellen-Mix; jede Zahl im Bericht trägt ihre Fundstelle (Atom-Ref), der Bericht endet mit dem Quellen-Stand als Fußnote. Export: PDF/A + container.json als Beweis-Anhang (Export-Kompatibilitätspfad).
- **Kombination ist der Wert:** was NotebookLM nicht kann — Beruf + Privat + Familie in EINEM sitzenden Bericht („unsere Versicherung + mein Firmenkontext + der Hausordner") — ist hier der Normalfall, weil alle Quellen im selben souveränen Container-Universum leben.

## 4. Design (Design-Register bindend, Sanduhr weitergeführt)

- Schalter: physische Präzision, keine Spielerei — Haarlinie, Tinte `#2E2A26`, Knopf in Salbei `#8FA98F` (an) / Beige `#E8DFD3` (aus), 44 px Zeilenhöhe, Umschalten 200 ms mit einem einzigen weichen Klick-Gefühl.
- Kein Synthie-Toggle mit Leucht-Status. „An" ist ruhig sichtbar, nicht leuchtend.
- Die Σ-Zeile unten: Mono, klein — *„5 Quellen · 22.212 Atome"* — gesetzt wie eine Fundstellen-Fußnote.
- Beim Umschalten: die Sanduhr erscheint EIN Mal kurz (600 ms) als Zeichen, dass sich das Universum gerade neu formt — dann ist sie weg. Kein Spinner.
- Mobile: dieselbe Liste, eine Spalte; Schalter daumen-groß, nichts sonst.

## 5. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Quellen-Checkboxen in der Antwort-Ansicht nachträglich | das wäre Filter-Denken; die Meister-Seite ist der EINE Ort der Zuständigkeit |
| Quellen mischen, die aus sind („doch noch reinschauen") | fail closed; aus ist aus, sonst stirbt das Vertrauen in die Ehrlichkeitszeile |
| Ehrlichkeitszeile weglassen, wenn unbequem | sie ist der Kern des Beweises; fehlt sie, ist die Antwort Werbung |
| Ordner/Gruppen als Pflicht-Struktur | Ordnung ist gelernte Struktur (Brain), nie Zwangs-Hierarchie für den Menschen |
| Leuchtende/animierte Toggles | ruhiger Raum; Zuständigkeit ist kein Spielzeug |
| Quellen-Stand eines alten Berichts still ändern | der Mix ist Teil der Fassung; ändern = neue Fassung mit neuer Signatur |

## 6. Der Satz

*Eine Seite, so einfach wie ein Lichtschalter: du entscheidest, was dein Assistent wissen darf — und jede Antwort beweist, aus welchem Licht sie fällt.*
