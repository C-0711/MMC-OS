# Bürger-Assistent-Spezifikation v0.1 — „der eigene Assistent"

*Status: Entwurf · 19. Spec im Verbund · Gilt für: gitchain OS Desktop/iOS (privater Assistent des Durchschnittsbürgers) · Baut auf: desktop-app, ingress-flow, interaction-voice-screen, super-brain, massen-ingest, recovery-erbschaft*

---

## 0. Der eine Satz

**Der Durchschnittsbürger partizipiert durch seinen eigenen geschützten Assistenten: ein Gerät, sein Schlüssel, eine Sanduhr — er wirft sein Leben hinein, die KI macht daraus seinen Container, und er bleibt die ganze Zeit eingebunden: jede Deutung als Karte mit Beweis, jede Maschine als Vorschlag, den er annimmt oder wegwirft — sein Assistent, sein Kontext, seine Dollar-freie Souveränität.**

## 1. Die Umsetzungs-Planung (Drei Wellen)

```
WELLE 1 (Wochen 0–8)        WELLE 2 (Wochen 6–16)      WELLE 3 (Monate 4–12)
„Es funktioniert"           „Es gehört mir"            „Es managt mich"
─────────────────────────────────────────────────────────────────────────
Desktop-App (existiert!)     + Phone=Tresor+Zeuge        + Brain-Autonomie
Takeout-Importer            + Brain federation          + Capability-Partizipation
(alleine)                   (Gruppe/Familie)            (Assistent verdient)

MAC-TEAM (Electron)         HERMES (Spez/Backend)       BEIDE
Laufende Etappe-4 +         brain-todos-Spec +          Capability-Ökonomie
Takeout-Import              Sandbox/Ref-Instanz        + Bridge zu Partnern
```

### Welle 1 — „Es funktioniert" (der Bürger wirft Sand rein)

| # | Baustein | Was zu tun ist | Beweis fürs Gelingen |
|---|---|---|---|
| 1.1 | **Takeout-Importer** | MBOX/PST/ICS/Google-Takeout → Eingangs-Pipeline (massen-ingest §2): Mail, Kalender, Fotos, Docs — alles wird Eingang, byte-identisch committet | User wirft 10 Jahre Google-Takeout rein → 24h später: 3 Karten Vorschläge, 0 Fragen |
| 1.2 | **PDF-Schublade** | Drag&Drop für Ordner/Scanner → Lesen (reader-schemas generisch) → Atome mit Fundstelle | Der Schuhkarton wird geleert: 500 Seiten → abfragbar („Was stand in der Versicherung von 2019?") |
| 1.3 | **Frag-mich lokal** | vLLM (Mac=Denker) → Container-Abfrage wie Quantum, aber privat | Antwort mit Beweis-Rechteck auf der eigenen PDF-Seite |
| 1.4 | **Null-Fragen-Onboarding** | Nur Schlüssel-Moment (bestehender Stand: ETAPPE-4 Punkt C) | Der Bürger startet ohne Formular, mit einem Siegel |

### Welle 2 — „Es gehört mir" (der Bürger trägt den Kontext)

| # | Baustein | Was zu tun ist | Beweis |
|---|---|---|---|
| 2.1 | **Phone = Tresor + Zeuge** | iOS-App: voller Klon, verify, µs-Suche; 2–4B NPU-Modell für Alltags-Deutung | Mac aus → Phone fragt trotzdem (mit Fundstelle) |
| 2.2 | **Brain federation** | Supercontainer lokal auf dem Phone/Mac; Familien-Container als geteilter Fall (team-raum „der Tisch") | Familienkalender, geteilte Dokumente — ohne dass jemand außer der Familie mitliest |
| 2.3 | **Autonomie-Kalibrierung** | 3× gleiche Bestätigung → memory-commit „darfst du selbst" (bestehende super-brain-Regel, auf Bürger anwenden) | Vorschläge werden weniger, Zuständigkeit wächst sichtbar |
| 2.4 | **Vergessen** | DSGVO-Pfad: Container löschen → Brain-Rebuild (supercontainer-Gesetz) | „Wirf den Container Weg" löscht ihn wirklich — und der Rest bleibt heil |

### Welle 3 — „Es managt mich" (der Bürger partizipiert)

| # | Baustein | Was zu tun ist | Beweis |
|---|---|---|---|
| 3.1 | **Daily-Treiber** | brain-todos: To-dos als Deutungen über Eingänge (Mail→Termin, Anruf→Rückruf) | Morgen-Karte: 3 Dinge, alle mit Fundstelle |
| 3.2 | **Capability-Partizipation** | Der eigene Assistent alsCapability-Inhaber: er schließt Dienste ab (Versicherungswechsel, Steuer-Vorbereitung) — gegen Gebühr, die beim Bürger bleibt | Euro-Abrechnung, kein Token; der Bürger verdient an seinem eigenen Kontext |
| 3.3 | **Partner-Bridge** | Export-Kompatibilität: Container → WISO/DATEV/Belegordner + container.json als Beweis-Anhang | Der Steuerberater bekommt Belege + Beweis statt Schuhkarton |

## 2. Der eingebundene Bürger (graphisch, alle Zustände)

```
                 ┌────────────────────────────────────────────┐
                 │   DER BÜRGER (immer im Loop, nie peripher) │
                 └────────────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
   [EINGEHENDES]               [GERAGT WERDEN]              [ZUSTIMMEN]
   Er wirft Sand rein:         Er sieht Karten,              Er entscheidet:
   Foto, Mail, Ordner,         max. 3 auf einmal,            Stimmt / Anders /
   Anruf, takeout              jede mit Beweis               Frag nicht wieder
        │                            │                            │
        ▼                            ▼                            ▼
   ┌─────────┐                ┌─────────────┐              ┌──────────────┐
   │ COMMIT  │                │ BEWEIS-     │              │ SIGNATUR     │
   │vor Deutg│                │ RECHTECK    │              │(commit auf   │
   │(sichtbar)│               │(woher weißt │              │ die Fassung) │
   └─────────┘                │ du das?)    │              └──────────────┘
                               └─────────────┘
        │                            │                            │
        └────────────────────────────┼────────────────────────────┘
                                     ▼
                    ┌─────────────────────────────────┐
                    │ SEIN CONTAINER (Sanduhr unten)  │
                    │ Datum wächst, Dollar-Äquivalent │
                    │ als beweisbarer Kontext. Aber:   │
                    │ ALLES RUHIG. — ein Zustand mit   │
                    │ Würde (keine offene Queue leer- │
                    │ drücken müssen)                 │
                    └─────────────────────────────────┘
```

**Das Feedback-Gesetz** (aus interaction-voice-screen, hier für den Bürger):
- Voice „ja" gilt nur mit sichtbarem Anker (fail closed).
- R3 (unwiderruflich, z. B. Löschen, Zahlung) braucht Geräte-Entsperrung.
- Zweifel ist ein Zustand: „ungeprüft" wird nie still absorbiert — der Bürger sieht immer, was noch wackelig ist.

## 3. Der Bürger-Alltag nach Welle 1 (Konkretes)

| Situation | Was passiert | Bürger-Erlebnis |
|---|---|---|
| Briefkasten-Post | Foto → OCR → schema „Post" → Atom mit Fundstelle | Karte: „Rechnung Stadtwerke, 89 €, fällig 15.09. — stimmt das?" |
| 500 Seiten Altpapier | Scanner-Stapel → Sanduhr über Nacht | Nächster Morgen: „Deine Versicherung 2019 hatte 500 € Selbstbehalt — willst du den Vertrag finden?" |
| Arzttermin-Anruf | Transkript → Termin-Atom (Minute als Fundstelle) | Karte mit Anruf-Fundstelle, nicht „ich habe irgendwas gehört" |
| Steuer | Container → DATEV-Export + Beweis-Beilage | Steuerberater: „warum 89 €?" → Rechteck auf der Stadtwerke-Rechnung |

## 4. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| „Cloud-KI im Verborgenen"-Verdacht zerstört Vertrauen | Gateway-Disziplin: nur redaktionierte Slices, jeder Cross geloggt, sichtbar in Preferences |
| Komplexität erschlägt den Durchschnittsbürger | Drei Screen-Formen (Karte/Liste/Beweis), kein Terminal-Vokabular, max. 3 Karten |
| Schlüsselverlust = Leben weg | recovery-erbschaft-Spec: Notar-Pfad, Siegel-Wiederherstellung — Onboarding-Frage Nummer eins bleibt der Schlüssel |
| Der Bürger fühlt sich überwacht (von der eigenen KI) | Alles lokal sichtbar: was der Assistent weiß, ist ein diffbares Repo; löschen ist ein Commit |
| „Warum soll ich das wollen?" | Onboarding v2: KI arbeitet sofort (kalibriert von Null-Fragen), Wert zeigt sich am ersten Beweis-Rechteck |

## 5. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Bürger-Container in einer zentralen Cloud | Souveränität: der Tresor gehört dem Bürger, nirgendwo sonst |
| Anonymisierung als Ersatz für lokales Processing | „Wir hashen das" ist keine Souveränität — die Masse verlässt das Gerät nicht |
| To-do-App als Feature statt als Deutung über Eingängen | sonst entsteht eine zweite Liste, die der Mensch pflegen muss — genau was gitchain abschafft |
| Benachrichtigungen, die drängen | ruhiger Raum: Karten warten, kein Badge-Zwang, „Alles ruhig." hat Würde |
| Partizipation ohne Erklärbarkeit | jede Dollar-artige Aussage („dein Vertrag ist teuer") braucht Beweis-Rechteck, sonst ist es Werbung |
| Der Bürger muss „AI-lingo" lernen | Os-Sprache (Canvas Seite 7) ist bindend: Karte, Beweis, Fassung — keine Embeddings, keine Token |

## 6. Der Satz

*Der Bürger bringt sein Leben in seiner Sanduhr unter — sein geschützter Assistent macht daraus seinen Kontext, zeigt jeden Beweis, stellt jede Frage als Karte, und was er lernt, lernt er vom Bürger: souverän vom ersten Foto an.*
