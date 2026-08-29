# Interaktions-Spezifikation v0.1 — Voice + Screen

*Status: Entwurf · Gilt für: gitchain OS (Desktop/Mobile), iOS-App · Drittes Dokument im Spec-Verbund (nach `supercontainer-v0.1.md`, `agent-containers-v0.1.md`)*

---

## 0. Der eine Satz

**Die Stimme stellt die Frage, der Screen zeigt den Beweis, ein Daumen bestätigt.** Sprache für alles, was flüssig ist; Bildschirm für alles, was prüfbar sein muss; nie Tastatur-Pflicht.

## 1. Das Interaktions-Dreieck

```
VOICE  ── stellt Vorschlag, diktiert, fragt nach          (schnell, überall, blind bedienbar)
SCREEN ── zeigt Fundstelle, Diff, Liste (max. 3 Elemente)  (prüfbar, beweisbar)
TAP    ── genau ein Punkt: bestätigen / ablehnen / verschieben (four-eyes, rechtsbindend)
```

**Aufgabentrennung — nie umgekehrt:**
- Stimme **zeigt nie** Beweise („lies mir die Rechnungsnummer vor" = Anti-Pattern: unverifizierbar, fehleranfällig)
- Screen **verlangt nie** Texteingabe für Grundsätzliches (Tastatur ist Ausnahme: Suchbegriff, Freitext-Korrektur)
- Tap **entscheidet nie** doppelt (ein Tap = ein Commit-Ereignis, kein Bestätigungs-Dialog auf dem Bestätigungs-Dialog)

## 2. Die drei Screen-Bausteine (kompletter Vokabular-Katalog)

Der Screen darf nur drei Formen annehmen — sonst ist die Interaktion falsch entworfen:

### ① Die Karte (bei EINEM Vorschlag)
```
┌─────────────────────────────────────┐
│  Umsatzsteuer-Voranmeldung Q3       │
│  „Soll ich die USt machen?          │
│   Sie ist in 2 Tagen fällig."       │
│                                     │
│  📄 12 Belege · 4 offen              │
│     → steuern-2026 (Öffnen)          │
│                                     │
│   [ Ja, machen ]      [ Später ]     │
└─────────────────────────────────────┘
```
- Headline = die gesprochene Frage, wortgleich (Stimme und Screen sagen dasselbe — nie unterschiedliche Formulierungen, das erzeugt Misstrauen)
- Ein Tap: **Ja** (führt aus, commitet), **Später** (snooze — Frist bleibt, Rückfrage kehrt wieder), seltener **Nein** (verwirft Vorschlag, commitet die Ablehnung)

### ② Die Liste (bei MEHREREN offenen Dingen)
```
┌─────────────────────────────────────┐
│  3 Dinge heute                       │
│                                     │
│  ⚠ USt fällig in 2 Tagen       ▶    │
│  ⚠ Duplette: Rechnung 2026-118  ▶    │
│  ℹ Beleg zu Steuern umziehen?   ▶    │
│                                     │
│  „Sag ‚Nummer 1', oder tippe an."   │
└─────────────────────────────────────┘
```
- Maximal **3 Einträge** pro Screen — mehr wird gesprochen („was ist noch offen?" → Zusammenfassung als Audio) oder auf Fälle verteilt
- Jeder Eintrag ist ansteuerbar per **Voice-Selector** („Nummer 2") ODER Tap — beides gleichwertig, beides dokumentiert (Audit: `selected_via: "voice" | "tap"`)

### ③ Der Beweis (bei jedem „Woher weißt du das?")
```
┌─────────────────────────────────────┐
│  Rechnung 2026-118 · 1.190 € brutto │
│  ████████████████░░░░░░░ [Rechteck] │
│  ─ docs/rechnungen/2026-118.pdf,    │
│    S. 1 · commit a41f · sig ✓       │
│                                     │
│  „Das war die Frage — stimmt's so?" │
│   [ Passt ]   [ Anders ]   [ Quelle ]│
└─────────────────────────────────────┘
```
- Der Beweis-Ausschnitt (Seite + Rechteck) ist das Kernstück: **Highlight im Original**, darunter (Fall, doc, page, commit, Signatur-Status) — die vier Begriffe aus der Fundstelle als eine Zeile Lesetext
- `[Anders]` = Sprung in die Korrektur (Voice: „es war netto" → KI macht Diff-Vorschlag, neuer Confirm-Zyklus)

## 3. Der Standard-Zyklus (jede Interaktion folgt ihm)

```
1. VORSCHLAG   KI (Stimme): Frage + Begründung in einem Satz
2. BEWEIS      Screen: Karte/Liste mit Fundstelle (wenn Fälle betroffen sind)
3. BESTÄTIGUNG ein Tap ODER ein Wort („ja", „Nummer 1", „später", „nein")
4. COMMIT      Aktion wird ausgeführt, Fundstelle + Entscheidung committet
               → nächster Vorschlag (oder: Stille — das System ist fertig)
```

**Pflicht zur Ruhe:** Keine Push-Kaskaden. Offene Vorschläge sammeln sich in der Tages-Liste (②); die KI drängt nicht, sie *erwähnt* („3 Dinge heute" beim ersten Screen-Kontakt des Tages). Proaktiv heißt: rechtzeitig, nicht laut.

## 4. Voice-Commit-Semantik (was ein gesprochenes „ja" zählt)

| Gesprochen | Wirkung | Commit-Pflicht |
|---|---|---|
| „ja" / „mach" / „passt" | bestätigt den **aktuell angezeigten** Vorschlag | bindet an die auf dem Screen sichtbare Fundstelle (Screen = Beweisanker fürs Voice-Commit) |
| „Nummer 2" / „die zweite" | wählt Listeneintrag → Zyklus ab Schritt 1 | Auswahl committet |
| „später" / „morgen" | snooze — Vorschlag kehrt wieder | Snooze-Commit mit Rückkehrzeitpunkt |
| „nein" / „lass" | verwirft Vorschlag | Ablehnungs-Commit (die KI lernt daraus — Memory-Commit) |
| „zeige her" / „Beweis" | öffnet ③ — zählt NICHT als Bestätigung | kein Commit (reine Ansicht) |
| alles andere | Nachfrage-Loop: „Meintest du …?" (max. 1×) | — |

**Harte Regeln:**
- **Der Screen ist der Anker.** Ein Voice-„ja" ohne aktuell sichtbare Karte/Liste ist ungültig (fail closed) — verhindert „Alexa, bestell Butter"-Unfälle und macht das gesprochene Wort beweisbar, weil es auf etwas Sichtbares verweist.
- **Nie implizit:** Schweigen, weggehen, App schließen = „später", nie „ja".
- **Stimme ist nicht Authentifizierung.** Wer spricht, bedient — aber Commits auf main (Geld, Abgabe, Vertrag) erfordern zusätzlich die Geräte-Entsperrung (FaceID/PIN) am Confirm-Moment. Voice-ID ist Komfort-Zusatz, nie alleiniger Faktor.

## 5. Multi-Modal-Regeln

- **Was auf dem Screen steht, wird wörtlich gesprochen** — nur so ist Voice-Commit an den Screen beweisbar bindbar.
- **Ohne Screen (AirPods, Auto):** nur Vorschläge der Kategorie *lesen/hören/verschieben* — bestätigungspflichtige Aktionen (Geld, Abgabe, main-Commit) werden angesagt und auf das nächste Screen-Ereignis vertagt („Ich hab's notiert — bestätige am Gerät").
- **Ohne Voice (Sitzung, Rücken an Rücken):** Screen allein trägt die volle Interaktion — jede Voice-Frage hat immer eine Tap-Entsprechung. Voice ist Abkürzung, nie Flaschenhals.
- **Spracherkennung läuft lokal** (Whisper-Klasse, on-device) — niemals Cloud-STT; das Wake-Verhalten ist konfigurierbar (push-to-talk default, wake-word opt-in).

## 6. Audit-Format (jede Interaktion ist ein Vorgang)

```json
{
  "proposal_id": "sha256:<hash>",
  "question": "Soll ich die USt machen? Sie ist in 2 Tagen fällig.",
  "evidence": [{"fall": "steuern-2026", "atom": 1042, "doc": "docs/fristen/ust-q3.ics", "commit": "a41f"}],
  "confirmed_via": "voice",              // "voice" | "tap"
  "voice_transcript": "ja, mach",        // nur wenn voice
  "unlock_factor": "faceid",             // bei main-Commits Pflicht
  "result": "executed | snoozed | rejected",
  "ts": "2026-08-28T09:14:22Z",
  "sig": "<ed25519>"
}
```

Jede Zeile in `audit/` des betroffenen Falls (und beim Agenten-Container als Episoden-Commit) — dieselbe Grammatik wie überall: **was gefragt wurde, was gezeigt wurde, wie entschieden wurde — mit Signatur.**

## 7. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Tastatur als Pflicht für Grundsätzliches | bricht mobile-first & Diktat-These |
| Mehr als 3 Listeneinträge pro Screen | kognitive Überlastung = der unsortierte Haufen kehrt zurück |
| Bestätigung ohne sichtbaren Beweis-Anker | Voice-Commit verliert Beweisbarkeit |
| Doppel-Confirm (Dialog auf Dialog) | ein Tap = ein Commit, sonst Frustpuriertheit |
| Voice-„ja" für main/Geld ohne Geräte-Entsperre | Stimme ist nicht Authentifizierung |
| Verschiedene Formulierungen Screen vs. Stimme | erzeugt Misstrauen, bricht Wortgleichheit |

## 8. Was diese Spec beweist

Der Screen ist nicht „auch da" — er ist der **Beweisanker der Stimme**. Erst durch die Wortgleichheit (Stimme sagt, was auf dem Screen steht) und den sichtbaren Fundstellen-Anker wird ein gesprochenes „ja" zu einem Commit, das vor Buhl, Finanzamt und Gericht hält. Ohne den Screen wäre Voice nur bequem; mit ihm ist Voice **rechts- und beweisfähig** — das unterscheidet gitchain von jedem Sprachassistenten, der nur schnell sein will.
