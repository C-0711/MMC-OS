# gitchain OS — Design Brief für Claude.ai
*(Eine Datei. Alles, was du für Screens, Design-System und Prototyp brauchst. Einfach komplett in den Chat kopieren.)*

---

## DEIN AUfTRAG

Du gestaltest **gitchain OS** — ein souveränes KI-Betriebssystem (deutsches Unternehmen, Anti-US-Cloud). Es ist **kein Dateimanager, kein Posteingang, kein Dashboard**: ein ruhiger Raum, der das Leben des Nutzers versteht und für ihn managt. Die KI lernt alles vom Nutzer, weiß alles, managt alles — der Nutzer sieht davon nur drei Dinge am Tag.

**Design-Registern:** Apple-Einfachheit der Geste (eine Interaktion pro Screen) × die warme, handgezeichnete Anmutung von Notion/Excalidral-artigen Tools × Beweisbarkeit als sichtbares Element. **Kein** Terminal-Look, keine Tech-Broker-Ästhetik, kein Cyberpunk, kein Blau-Lila-Gradient-SaaS.

---

## PRODUKT IN 60 SEKUNDEN

1. Alles, was hereinkommt (Mail, Foto, Anruf, Nachricht, Datei), ist dasselbe Ding: ein **Eingang** mit Absender, Zeitpunkt, Nutzlast. Er wird gesichert, bevor irgendetwas gedeutet wird.
2. Eine **KI** (lokal, souverän) deutet jeden Eingang und ordnet ihn einem **Fall** zu (Steuern, Haus, Firma …). Was Routine ist, erledigt sie still. Was eine Entscheidung braucht, wird **eine Karte**.
3. Der Nutzer sieht pro Tag **maximal 3 Karten**. Sonst: *„Alles ruhig."*
4. Jede Aussage der KI trägt ihren **Beweis** sichtbar mit: ein aufleuchtendes Rechteck auf dem Original-Dokument + eine kleine Quellen-Zeile.
5. Bedienung: **Voice + ganz einfache Screen-Interaktionen**. Die Stimme fragt, der Screen zeigt den Beweis, ein Tap oder ein Wort („ja") bestätigt.

**Der eine Satz:** *gitchain is your source of truth. The AI learns all from you, knows all from you, manages all for you.*

---

## DESIGN-TOKENS

**Palette (warm, ruhig, europäisch — KEIN SaaS-Blau):**
- Canvas: Warmweiß `#FAF7F2` · Dunkel-Modus: warmes Anthrazit `#26231F`
- Text/Tinte: `#2E2A26`
- Salbei `#8FA98F` = bestätigt / erledigt / OK
- Beige `#E8DFD3` = wartend / pending
- Rosé `#D9A6A0` = Zweifel / ungeklärt / Aufmerksamkeit
- Olivgold `#B8A369` = der Agent (KI-Akzent) und das Siegel

**Typo:** Headlines in einer ruhigen, menschlichen Serife (z. B. Newsreader, Lora) oder charakterstarken Sans (z. B. Söhne-artig). Fließtext gut lesbar, 16–18px. **Monospace (klein, dezent)** ausschließlich für Quellen-Zeilen — das „Technische" ist Fußnote, nie Haupttext.

**Formen & Bewegung:** weiche Karten (12–16px Radius, kaum Schatten, 1px Hairline-Border `#E8DFD3`), viel Weißraum. Animationen: max. 200–300ms, jede Bewegung hat genau eine Bedeutung (Karte legt sich ab, Siegel schließt sich, Beweis-Rechteck leuchtet auf). Kein Bounce, kein Parallax, kein Konfetti.

**Markenzeichen:** der **Siegelwürfel** (ein versiegelter Container mit Kettenglied — wie ein Wachssiegel, das in geometrische Blätter zerfällt). Er ist das einzige emotional aufgeladene Icon; alles andere ist typografisch oder minimal-linear.

---

## DIE SCREENS (bitte als UI-Mockups/Prototyp gestalten)

### 1. Boot
Schwarz → Siegelwürfel formt sich (Wachs-Gefühl) → *„Willkommen. Das hier ist deins."* → Desktop atmet ein.

### 2. Onboarding — genau drei Fragen (eine pro Screen, enorme Ruhe)
a) **„Wo sollen deine Daten wohnen?"** — drei weiche Karten: 🏠 *Hier auf diesem Gerät* („Dein Tresor. Niemand sonst.") · 🏠→ *Auf deinem Mac zu Hause* („Das Gerät wird zum Zeugen, dein Mac zum Denker.") · ☁️ *In deiner souveränen Cloud* („Verschlüsselt. Der Betreiber sieht nur Chiffre.")
b) **„Wie erkennst du dich wieder?"** — Gesicht/PIN. Zeile: *„Das hier ist dein Schlüssel. Ohne ihn kann dir niemand — auch wir nicht — in deine Sachen sehen."* Dann Recovery (12 Worte als Papier-Zeremonie, ernst wie ein Notar-Termin).
c) **„Was darf ich für dich tun?"** — ein einziger Regler: `frag mich bei allem ●────○ mach mehr selbst`, mit Live-Untertitel *„In dieser Stellung frage ich dich bei etwa 3 Dingen pro Tag."*

### 3. Desktop — „Heute" (der wichtigste Screen)
```
┌───────────────────────────────────────────────┐
│                                 ○ Du (Siegel)   │
│  Guten Morgen.                                 │
│  Alles ruhig. Ein Ding wartet.                │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ ⚠  Umsatzsteuer fällig in 2 Tagen    ▶ │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  …                                 „Frag mich" │
└───────────────────────────────────────────────┘
```
Kein Icon-Dock, keine App-Wüste, keine Badge-Zähler. 0 Karten = *„Alles ruhig."* (Stille ist ein Zustand mit Würde). Unten rechts ein einzelnes Feld **„Frag mich"** — ein Gesprächspartner, keine Suchleiste.

### 4. Die Karte (Kern-Interaktionsmuster)
```
┌─────────────────────────────────────────┐
│  Umsatzsteuer-Voranmeldung Q3           │
│  „Soll ich die machen?                   │
│   Sie ist in 2 Tagen fällig."           │
│                                         │
│  📄 12 Belege · 4 offen → öffnen         │
│                                         │
│    [ Ja, machen ]     [ Später ]        │
└─────────────────────────────────────────┘
```
Ein Vorschlag, ein Beweis-Link, zwei Buttons. Aufklappbar darunter (dezent, Monospace): `steuern-2026 · docs/ust-q3.ics · commit a41f · sig ✓`. **Wortgleichheit:** der gesprochenen Fassung der Frage ist derselbe Text.

### 5. Der Beweis (das Alleinstellungs-Screen)
Original-Dokument (z. B. Rechnung als Bild) mit **aufleuchtendem Salbei-Rechteck** um die relevante Stelle; darunter die Quellen-Zeile; Buttons `[Passt] [Anders] [Quelle]`. Dieses Screen-Design muss am perfektesten sein — es ist der Moment, in dem Souveränität *sichtbar* wird.

### 6. Liste („3 Dinge heute")
Max. 3 Zeilen, je ▶, mit Voice-Selector-Hinweis: *„Sag ‚Nummer 1', oder tippe an."*

### 7. Umzug (Takeout)
„Ich hole deine Sachen ab." — Google/Apple/Microsoft als drei Quellen-Karten, ein ruhiger Fortschrittsbalken mit Etappen: *„Deine Fotos sind da. 14.332 Stück, alle geprüft."*

---

## MÖGLICHE AUFGABEN AN DICH (Claude)

- Gestalte 3–5 der oben genannten Screens als hochwertige HTML/CSS-Mockups (ein File pro Screen, mit den Design-Tokens oben, in einem `artifact`).
- Bau einen klickbaren Desktop-Prototyp (Desktop → Karte → Beweis → „ja" → Alles ruhig).
- Entwickle das Design-System weiter (Spacing-Skala, Komponenten: Karte, Beweis-Viewer, Frag-mich-Dialog, Autonomie-Regler).
- Variiere das Boot-Screen-Siegel (Wachs-Ästhetik, warm, nicht techy).

**Grenzen, die du niemals verletzt:** nie mehr als 3 Karten pro Screen; nie Badge-Zähler oder Push-Kaskaden; nie Tastatur-Pflicht; kein Terminal-Vokabular im Haupttext („commit/hash" nur in der aufklappbaren Quellen-Zeile); ernste Momente (Schlüssel, Recovery) niemals verspielt; keine US-SaaS-Optik (Blau/Lila-Gradients, Glaseffekt-Overkill).

**Gefühl am Ende alles Designs:** Der Nutzer hat nach zwei Minuten einen Tresor, nach dem ersten Foto versteht er die KI, nach einer Woche hat er keine Posteingänge mehr — und nie das Gefühl, ein Programm zu bedienen.
