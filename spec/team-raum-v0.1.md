# Team-Raum-Spezifikation v0.1 — „der Tisch"

*Vierzehnte Spec im Verbund · Löst Team-Kanäle, Chats, Meetings-Notizen, Dateiablagen, Aufgaben-Boards ab · Aufbauend auf: communication, enterprise-humans, supercontainer*

---

## 0. Der eine Satz

**Teams ersetzt Kommunikation durch Lärm. Der Tisch ersetzt Lärm durch einen geteilten Fall: der Team-Raum IST der Container, und jede Nachricht, Datei, Entscheidung und Aufgabe darin trägt ihren Beweis bei sich.**

## 1. Warum Teams tausendmal schlechter ist (die ehrliche Analyse)

| Teams heute | Das eigentliche Problem |
|---|---|
| 47 Kanäle, niemand weiß wo was steht | **Kanäle organisieren nach Zufall, nicht nach Sache** — dieselbe Sache wird in 5 Kanälen, 3 Chats, 2 Meetings und einer Mail „behandelt" |
| Suche findet Nachrichten, nicht Wahrheit | der Chat ist ein **Datenverichter**: Wissen versinket in Scroll-Historie, nach 3 Monaten unfinanzbar |
| Dateien sind Anhänge ohne Herkunft | Version C, C-final, C-final2.xlsx — **Herkunft ist Gefühlssache** |
| Meetings erzeugen Notizen, die niemand liest | Notizen sind **Pflicht-Abfall**, keine beweisbaren Beschlüsse |
| Aufgaben sind Karten ohne Beweis | „Wer hat das wann wem versprochen?" — niemand |
| Kanal = meist eine Abteilung | **Schnittstellen-Ping-Pong**: PIM-Kanal fragt Konstruktion-Kanal, Übergabe = Copy-Paste |

**Die Wurzel:** Teams hat den Fehler der E-Mail wiederholt (Kanal-Zentrierung) und mit Presence-Druck und Notification-Kaskaden multipliziert.

## 2. Der Tisch: die eine Struktur

Der Team-Raum ist ein **geteilter Fall-Container** (Kommunikations-Spec §4) mit Arbeits-Oberfläche:

```
TISCH „Badrenovierung" (oder „M-Nr 4711")         [Fall: der gemeinsame Baum]
┌─────────────────────────────────────────────────────────────┐
│  DER TISCH         DER STROM        DIE ARBEIT     DIE AKTE  │
│  (was gilt jetzt)  (Verlauf als     (offene        (Originale │
│                    Erzählung)       Sachen)        + Beweise) │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│ Vereinbarung │ 14.08. Weber  │ ⚠ 2 Aufgaben │ 📄 Zeichnung   │
│ v3 · 2/3     │ hat Fassung   │ offen        │ v3.pdf         │
│ freigegeben  │ C2 übergeben  │ (nicht Karten-│ 📄 Angebot     │
│              │               │ Flut: max. 3  │ endgültig.pdf  │
│ NÄCHSTER     │ 15.08. Erika  │ pro Person)  │ 🖼 Foto        │
│ SCHRITT:     │ hat Widerspr. │               │ Feuchtigkeit  │
│ QM prüft     │ erkannt (Karte│               │ (Blob)        │
│ bis 17.08.    │ ging an QM)    │               │               │
└──────────────┴──────────────┴──────────────┴─────────────────┘
```

**Die vier Zonen — das komplette Vokabular des Team-Raums:**

1. **Der Tisch (Mitte):** was gilt *jetzt* — die aktuelle signierte Fassung, der nächste Schritt, wer dran ist. Wer den Raum öffnet, sieht in 5 Sekunden den Zustand der Welt. **(Der Screen, den Teams nie hatte: kein Scrollen zum Verstehen.)**
2. **Der Strom:** der Verlauf als **Erzählung** (Desktop-App-Spec §3.1), nicht als Nachrichtenliste. Jede Meldung klappt zur Commit-Zeile auf. Man fragt „was ist seit meiner Woche passiert?" und bekommt eine *Zusammenfassung mit Beweisen*, nicht 400 ungelesene Nachrichten.
3. **Die Arbeit:** offene Aufgaben — aber als **beweisbare Verbindungen** („wem, was, bis wann, aus welchem Beschluss"), nicht als Karten-Brett. Max. 3 pro Person sichtbar (Queue-Prinzip), der Rest lebt im Baum.
4. **Die Akte:** Originale und Beweise — byte-identisch, jede Datei mit Fundstellen zu den Attributen/Deutungen, die aus ihr gezogen wurden. *Keine Version C-final2 mehr: eine Datei, ein Hash, eine Geschichte.*

## 3. Was den Tisch tausendmal besser macht (die Mechanik)

### 3.1 Beschlüsse statt Chatten
Jede „Nachricht" ist ein Atom im Baum. Aber der entscheidende Unterschied: **die KI führt strukturiert zu Beschlüssen.** Aus dem Gesprächsverlauf erkennt der Rollen-Agent Beschluss-Kandidaten („Vorschlag: Weber bekommt Zuschlag für Dach, 12.400 € — begründet in: [Zitat] [Zitat]") → Karte → Multi-eyes (enterprise-humans §3) → **signierte Fassung**. Chat wird zum *Rohstoff*, nicht zum Produkt.

### 3.2 Der Agent ist der sechste am Tisch
- Er **zuhört mit**: „Du hast Weber am Dienstag 12.400 € zugesagt — soll ich den Vertrag als Fassung vorbereiten?" (proaktiv, aus dem Strom, nicht aus Chats, weil es keine Chats mehr gibt)
- Er **beantwortet die Universal-Frage jedes Teams**: „Was haben wir damals vereinbart?" → Antwort mit Beweis-Rechteck, in Sekunden, statt drei Kollegen fragen
- Er **hütet die Kette**: „QM prüft seit 3 Tagen — erinnern oder übernehmen?"

### 3.3 Einladung ist Capability, nicht Konto
Jemand an den Tisch holen = Capability ausstellen (scope: dieser Fall, diese Operationen, diese Dauer). Der Partner/Bote/Freiberufler braucht **kein Konto, keine Lizenz, keinen Tenant** — er bekommt einen Container-Klon. Externe am Tisch sind Erstklasses-Bürger ohne IT-Onboarding. **(Das tötet das Gastkonto-Elend von Teams.)**

### 3.4 meetings werden zu Mitschriften im Baum
Anruf im Team-Raum = geteilter Fall-Container (Kommunikations-Spec): Mitschrift läuft lokal, Beschlüsse werden agreement-Kandidaten, Aufgaben entstehen aus dem Gespräch als beweisbare Verbindungen. Das Meeting-Protokoll schreibt sich selbst — *in den Baum, nicht in eine Datei, die niemand liest.*

### 3.5 Kein Presence-Druck, keine Notification-Hölle
- Stille ist Zustand (Interaktions-Spec D2): wer den Tisch verlässt, verpasst nichts — der Strom fasst zusammen, wenn er zurückkommt.
- Dringlichkeit zeigt die Karte, nicht ein roter Badge-Zähler. **„Ungelesen" ist ein Anti-Konzept** — es gibt nur „offen" (max. 3 pro Person) und „erledigt".
- @-Erwähnungen existieren nicht — es gibt **Zuständigkeit** (Capability auf eine Sache) statt Aufmerksamkeits-Schreie.

## 4. Migration: wie Teams stirbt (ablaufbar)

| Teams-Artefakt | Am Tisch |
|---|---|
| Kanal | **Themen-Fall** oder Beziehungs-Container (Kommunikations-Spec §4) |
| Chat-Verlauf | Strom (Erzählung) — Altlast bleibt alt, Neues ist beweisbar |
| Datei-Register | Akte (hash-adressiert, mit Fundstellen) |
| Aufgaben-Board | Arbeit (beweisbare Verbindungen, Queue) |
| Meeting-Notizen | Mitschrift im Baum, Beschluss = signierte Fassung |
| Team/Gruppe | Kreis von Capability-Inhabern um einen Fall |
| Wiki/SharePoint | der Baum selbst — jede Seite ein Atom mit Historie |

**Brücke:** Teams bleibt solange laufen, wie externe Partner es brauchen — jede Teams-Nachricht wird per Bridge zum Eingang committet (redigiert, auditiert). Der Tisch wächst, Teams verdorrt.

## 5. Warum das BUZZ bleibt: der ruhige Raum gilt auch hier

Der Team-Raum ist KEINE lärmige Kollaborations-Zentrale. Er ist der ruhige Raum, mehrstimmig: Erikas Morgen beginnt weiterhin mit **drei Dingen** — nur dass zwei davon vom Tisch M-Nr 4711 kommen. Der einzelne Mensch sieht nie „den Team-Raum als Ganzes" (das ist der Dashboard-Fehler), er sieht **seine Rollen-Queue über alle Tische hinweg**.

## 6. Negativ-Katalog

| Verbot | Grund |
|---|---|
| Kanal-Liste als Navigation | Kanäle organisieren nach Zufall — der Fall ist die Struktur |
| „Ungelesen"-Zähler, Presence, Tippen-Indikator | Aufmerksamkeits-Terror; es gibt offene/erledigt, sonst Stille |
| @-Erwähnungen | Zuständigkeit ist Capability, kein Schrei |
| Dateien ohne Fundstelle in der Akte | Version C-final2-Zustand verboten |
| Beschluss als Chat-Text | ein Beschluss ohne Signatur ist Meinung |
| Dashboard/Activity-Feed | der Mensch fragt, der Baum antwortet — kein Gießkann-Feed |
| Gastkonten, Tenant-Zwang für Externe | Einladung ist Capability + Container-Klon |

## 7. Der Satz

*Teams hat den Menschen in Kanäle sortiert und mit Benachrichtigungen regiert. Der Tisch sortiert die Welt in Fälle, lässt den Agenten zuhören, und macht jede Vereinbarung zu einem beweisbaren Commit — der Mensch kommt zurück, um zu entscheiden, nicht um zu scrollen.*
