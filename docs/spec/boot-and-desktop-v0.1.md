# Boot & Desktop-Spezifikation v0.1 — Onboarding & Erste-Nutzer-Erlebnis

*Status: Entwurf · Fünfte Spec im Verbund · Gilt für: gitchain OS (Desktop/Mobile), iOS-App*

---

## 0. Der eine Satz

**Zwei Minuten bis zum Tresor, drei Fragen bis zur Autonomie, danach: ein ruhiger Raum, der maximal drei Dinge am Tag fragt.**

## 1. Design-Prinzipien (verbindlich für jeden Screen)

| # | Prinzip | Bedeutung |
|---|---|---|
| D1 | **Eine Geste pro Screen** | ein Tap oder ein Wort — nie Tastatur-Pflicht, nie Doppel-Confirm |
| D2 | **Stille ist ein Zustand** | „Alles ruhig." statt Badge-Zählern; Still = erledigt |
| D3 | **Wortgleichheit** | Was die Stimme sagt, steht wörtlich auf dem Screen (Beweisanker für Voice-Commits) |
| D4 | **Transparenz als Fußnote** | unter jeder Karte: `(fall, doc, page, commit · sig ✓)` aufklappbar — wer will, sieht alles; wer nicht will, sieht ein ruhiges Gerät |
| D5 | **Warm, nicht nerdig** | Warmweiß/Salbei/Rosé (Website-Palette), handgezeichnet angedeutete Formen, Serifen-Akzente; kein Terminal-Ästhetik im Nutzerpfad |
| D6 | **Ernstes als Ernstes** | Schlüssel-Momente (Recovery) werden wie ein Notar-Termin geführt: ruhig, wörtlich, unübersehbar — nie verspielt |
| D7 | **Maximal 3 offene Karten** | kognitive Überlastung = der unsortierte Haufen kehrt zurück (Ingress-Spec §7) |

## 2. Visuelles System (Design-Tokens für Übergabe)

- **Palette:** Warmweiß `#FAF7F2` (Canvas), Salbei `#8FA98F` (bestätigt/granted), Rosé `#D9A6A0` (Zweifel/denied), Beige `#E8DFD3` (pending), Tintengrau `#2E2A26` (Text), Olivgold `#B8A369` (Agenten-Akzent/Siegel)
- **Typo:** Ruhige Serif oder Sans mit menschlichem Charakter für Headlines; Monospace *nur* für Fundstellen-Zeilen (D4) — das Terminal als Privatsache
- **Formen:** weiche Karten (12px Radius, kaum Schatten), das Siegelwürfel-Markenzeichen als einziges Icon mit emotionalem Gewicht
- **Bewegung:** eine Bedeutung pro Animation (Siegel formt sich, Karte legt sich ab, Rechteck leuchtet auf). Kein Bounce, kein Parallax-Theater
- **Referenz-Register:** Apple-Einfachheit der Geste + die warme, handgezeichnete Anmutung der gitchain.de-Landingpage (Excalidraw-artige Diagramme, die auf der Website bereits existieren)

## 3. Akt 0 — Einschalten (erste 10 Sekunden)

Schwarzer Screen → das Siegelwürfel-Symbol formt sich (Wachs-Metapher, 2s) → darunter: **„Willkommen. Das hier ist deins."** → Siegel schließt, Desktop atmet ein.

Kein Logo-Feuerwerk, kein Konto, keine AGB-Wand in diesem Akt.

## 4. Akt 1 — Die drei Fragen (2 Minuten)

### Frage 1 — „Wo sollen deine Daten wohnen?"
Drei weiche Karten (keine Radio-Buttons): 🏠 *Hier auf diesem Gerät* · 📱 *Mac zu Hause (Zeuge/Denker)* · ☁️ *Souveräne Cloud (Betreiber sieht nur Chiffre)*. Antwort per Tap oder gesprochenem Wort („hier").

### Frage 2 — „Wie erkennst du dich wieder?"
Gesicht/PIN. Der Schlüssel-Moment — eine Zeile Menschensprache: *„Das hier ist dein Schlüssel. Ohne ihn kann dir niemand — auch wir nicht — in deine Sachen sehen."* Direkt anschließend der Recovery-Pfad (12 Worte / QR auf Papier), geführt wie ein Notar-Termin (D6): ernst, wörtlich, mit Bestätigung *„Ist weggesperrt. Ich habe es nie gesehen."*

### Frage 3 — „Was darf ich für dich tun?"
Der Autonomie-Regler (Schwellen-Policy der Ingress-Spec §7 als UI):

```
  frag mich bei allem        ●────────○        mach mehr selbst
```

Live-Untertitel, mitbewegend: *„In dieser Stellung frage ich dich bei etwa 3 Dingen pro Tag."* Feinjustage (R0–R3-Matrix) später, tief im System — hier zählt das Gefühl.

Abschluss: **„Dein gitchain ist bereit."** *(klein: Das System erklärt sich selbst, wenn du es brauchst.)*

## 5. Akt 2 — Der Desktop (das Zuhause)

**Der Desktop ist kein Datei-Ordner, sondern eine Lebensübersicht.** Kein Icon-Raster, kein Dock-Zwang — ein Raum mit drei Zonen:

```
┌────────────────────────────────────────────────────┐
│                                    ○ Du (Siegel)    │
│   Guten Morgen.                                    │
│   Alles ruhig. Ein Ding wartet.                    │
│                                                    │
│   [ Karte: offenes Ding des Tages ]           ▶    │
│                                                    │
│   (Karten-Regel: 0–3, nie mehr — D7)               │
│                                                    │
│   …                                    „Frag mich" │
└────────────────────────────────────────────────────┘
```

- **Mitte: das Heute** — 0 bis 3 Karten (Vorschlag/ungeklärt/Zweifel). Alles erledigt = *„Alles ruhig."* (D2)
- **Ecke: „Frag mich"** — der Haupteingang für alles; ein Gesprächspartner, keine Datenbank-Abfrage
- **Keine App-Wüste:** Apps sind Abfragen mit Darstellung. Eine Fotos-Ansicht *erscheint* als Antwort, sie liegt nicht als Icon herum
- **„Du (Siegel)"** oben rechts: Identität, Autonomie-Regler, Recovery — die drei intimsten Einstellungen hinter einem guten Zugang

## 6. Akt 3 — Der erste Eingang (Zauber-Moment)

Foto einer Rechnung, ohne „speichern":
1. Karte: *„Ich habe eine Rechnung erkannt. 2026-118, 1.190 € brutto. Soll ich sie zu deinen Steuern legen?"* — mit Rechteck-Highlight im Original + Fundstellen-Fußnote (D4)
2. Ein Wort (*„ja"*) oder ein Tap → verschoben, committet, unsichtbar
3. KI lernt still (Memory-Commit, diffbar); nach der dritten Bestätigung gleicher Art fragt sie nie wieder — **das System wird persönlich, sichtbar und spurbar zugleich**

## 7. Akt 4 — Die Auswanderung (Tag 1–7, optional)

Weiche Karte: **„Ich hole deine Sachen ab."** Google/Apple/Microsoft-Takeout als Umzugsservice inszeniert — ein Fortschrittsbalken mit Etappen (*„Deine Fotos sind da. 14.332 Stück, alle geprüft."*). Ehrlichkeits-Zusatz: *„Die Originale bleiben byte-identisch. Was ich daraus verstehe, siehst du jederzeit — und kannst es löschen."* Originale werden als Blobs committet, bevor irgendetwas gedeutet wird (Ingress-Spec §2).

## 8. Screen-Inventar (komplette Liste)

| Screen | Zweck | Elemente |
|---|---|---|
| Boot/Siegel | erster Eindruck | Markenzeichen, 1 Satz |
| 3 Onboarding-Fragen | Tresor/Schlüssel/Autonomie | Karten, Regler, Recovery-Flow |
| Desktop/Heute | Zuhause | 0–3 Karten, „Frag mich", Siegel-Zugang |
| Karte (ein Vorschlag) | Entscheidung | Frage, Beweis-Rechteck, [Ja][Später][Nein] |
| Liste (bis 3) | Tagesübersicht | Einträge + Voice-Selector |
| Beweis | „Woher weißt du das?" | Original + Highlight + Fundstelle + [Passt][Anders][Quelle] |
| Frag-mich-Dialog | freie Abfrage | Frage → Antwort mit Zitaten |
| Umzug | Takeout | Fortschritt, Etappen |
| Du/Siegel | Identität & Regler | Profil, Autonomie, Recovery, Preferences |

## 9. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Icon-Dock / App-Wüste | Apps sind Abfragen, keine Besitztümer |
| Badge-Zähler, Push-Kaskaden | Stille ist Zustand; proaktiv heißt rechtzeitig, nicht laut |
| Tastatur-Pflicht im Nutzerpfad | mobile-first, Diktat-These |
| Terminal-Vokabular im Standard-Text | „commit", „hash", „repo" → nur in der aufklappbaren Fußnote (D4) |
| Verspieltheit beim Recovery | D6: ernst wie ein Notar |
| Mehr als 3 Karten | D7 |

## 10. Der Satz

*Nach zwei Minuten besitzt du einen Tresor, nach dem ersten Foto verstehst du die KI, nach der ersten Woche hast du keine Posteingänge mehr — und du hast kein einziges Mal das Gefühl gehabt, ein Programm zu bedienen.*
