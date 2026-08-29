# Desktop-App-Spezifikation v0.1 — „Der ruhige Raum"

*Status: Entwurf · Sechste Spec im Verbund · Gilt für: gitchain OS Desktop (Mac = Denker), Spiegel auf iOS*

---

## 0. Der eine Satz

**Die Desktop-App ist ein ruhiger Raum mit einem Gesprächspartner: sie zeigt maximal drei Dinge am Tag, beweist alles, was sie sagt, und wird von Tag zu Tag persönlicher — sichtbar, diffbar, deins.**

## 1. Was sie ist (und was nicht)

Die Desktop-App ist **keine App unter vielen im Dock** — sie ist die Mutter-Oberfläche des Systems. Sie ersetzt im Alltag Posteingang, Foto-Ordner, Dateimanager und Notizzettel, ohne je wie eines davon auszusehen.

Drei Grundentscheidungen:

1. **Ein Fenster, drei Zustände:** *ruhig* (Alles ruhig) · *fragend* (1–3 Karten) · *antwortend* (Frag-mich-Dialog + Beweis). Maximale Tiefe: zwei Klicks bis zu jedem Beweis.
2. **Apps sind Abfragen:** kein „Fotos-Modus", kein „Steuer-Modus". Man fragt, die Antwort erscheint als Ansicht. Navigations-Menüs sind ein Anti-Pattern; für Tipper gibt es das minimale Seitenbrett (§4).
3. **Das Terminal wohnt in der Fußnote:** unter jeder Karte/Antwort `(fall · doc · seite · commit · sig ✓)` — aufklappbar, monospace, dezent.

## 2. Der Aufbau (von außen nach innen)

```
┌───────────────────────────────────────────────────────┐
│  ○ Siegel (Du)                    heute · alles ruhig  │  ← Leiste
│───────────────────────────────────────────────────────│
│   Guten Morgen.                                       │
│   Alles ruhig. Ein Ding wartet.                       │  ← Bühne: das Heute
│   ┌───────────────────────────────────────────┐       │
│   │ ⚠  Umsatzsteuer fällig in 2 Tagen      ▶  │       │  ← 0–3 Karten
│   └───────────────────────────────────────────┘       │
│   …                                        Frag mich  │  ← Der eine Eingang
└───────────────────────────────────────────────────────┘
```

- **Leiste:** links das Siegel (Identität, Autonomie-Regler, Recovery, Preferences), rechts der Zustand in zwei Worten (*„heute · alles ruhig"*). Keine klassische Menüleiste — die macOS-Menüleiste gehört dem macOS.
- **Bühne:** das Heute. Der einzige Screen, den der Nutzer täglich sieht. An guten Tagen steht dort nur *„Alles ruhig."*
- **„Frag mich":** ein Gesprächspartner, keine Suchleiste. Versteht gesprochene und getippte Fragen gleich gut.

## 3. Die sechs Flächen (komplettes Inventar)

| Fläche | Wann | Inhalt |
|---|---|---|
| **Heute** | beim Öffnen | Begrüßung, 0–3 Karten, Frag mich |
| **Karte** | Tap auf ein Ding | Vorschlag + Beweis-Link + [Ja][Später][Nein] |
| **Beweis** | „Woher weißt du das?" | Original mit Salbei-Rechteck, Quellen-Zeile, [Passt][Anders][Quelle] |
| **Frag-mich-Dialog** | freie Frage | Antwort mit Zitat-Kacheln (je klickbar → Beweis) |
| **Fall-Ansicht** | „zeig mir Steuern 2026" | Zeitstrahl der Commits als Erzählung (§3.1) |
| **Umzug** | erste Woche | Takeout-Fortschritt mit Etappen |

### 3.1 Die Fall-Ansicht (Erzählung statt Tabelle)

Der einzige Ort, wo Vergangenheit sichtbar wird — als **Erzählung in Menschensprache**:

> *„Am 3. August kam die Rechnung von Weber. Du hast sie am selben Tag bestätigt. Am 14. habe ich die Frist erkannt und gesetzt."*

Jeder Satz klappt zur rawen Commit-Zeile auf (`a41f · +2 atoms · sig ✓`). Die Git-Historie als Geschichte; das Diff als Fußnote. Frage an die Fläche: *„was hat sich seit März geändert?"* → visuelle Redline über Atoms.

## 4. Das Seitenbrett (der ehrliche Kompromiss)

Für Tipper: ausklappbar, minimal — **kein Dock, keine Icon-Wüste**. Eine stille Liste der Fälle (Steuern 2026, Haus, Firma …) und darunter die Eingänge mit Zählern offener Ungeklärtheiten. Sieht aus wie ein Inhaltsverzeichnis, nicht wie ein Dateimanager. Die Kapsel-Regel wird hier sichtbar: jeder Fall ist ein eigenes, getrenntes Kapitel.

## 5. Was die App nicht hat (bewusst)

| Verbot | Grund |
|---|---|
| Badge, roter Punkt, Zähler | Dringlichkeit zeigt die Karte selbst |
| Einstellungs-Seiten-Wüste | die drei intimsten Dinge (Autonomie, Recovery, Identität) leben hinter dem Siegel; alles andere lernt das System durch Commits |
| Sync-Anzeige | Sync ist Architektur (pull-on-push), kein Nutzerereignis — nur ein *fehlender* Tresor wird gemeldet („Dein Mac daheim ist seit 3 Tagen nicht verbunden — nachfragen?") |
| Chat-Verlauf | jeder Dialog wird zu Atoms/Episoden im Agenten-Container; „das Gespräch von gestern" ist eine Abfrage, kein Scrollen |

## 6. Desktop-spezifische Kräfte (der Mac als Denker)

- **Schwerarbeit über Nacht:** ganze Beleg-Deutungen, Re-Indizierung, Takeout-Importe — die App arbeitet bei geschlossenem Deckel (das Siegel in der Menüleiste atmet leise), morgens liegt das Ergebnis als committeter Fakt vor.
- **Voller Beweis-Viewer:** Originale in jeder Größe, Rechteck-Zoom, Diff zwischen Fall-Versionen (visuelle Redline über Atoms).
- **Finder-Watcher:** der `finder.ts`-Gedanke — ein Ordner/Volume, den die App beobachtet: was hineinfällt, wird Eingang (Commit vor Deutung). Der Finder bleibt Finder; die App macht ihn zum Tresor-Zulauf, ohne ihn umzubauen. (Badges/Vorschau: spätere signierte FinderSync-/QuickLook-Extension.)
- **Lokale Inferenz mit GPU** + Gateway (:7906) für den kontrollierten, redigierten Ausblick nach draußen.

## 7. Technische Verankerung

- **Electron/Tauri-artige Runtime** (OS-gastgebend — „die Wahrheit wohnt nicht auf dem Host, sie wohnt im Tresor")
- **Vault:** verschlüsselter Container-Speicher lokal, Keys niemals im Container selbst
- **Klone:** Mac hält volles Repo des Brain + der Fälle; Sync pull-on-push über Tailscale-Klasse
- **Netzwerk:** Default-deny für den KI-Kern (tcpdump: zero outbound), Gateway ist die einzige kontrollierte Grenze
- **Datenmodell:** exakt der Spec-Verbund (Supercontainer, Agenten-Container, Ingress, Interaktion)

## 8. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Mehr als 3 Karten / Fenster-Modi | ein Fenster, drei Zustände |
| Icon-Dock / App-Wüste | Apps sind Abfragen |
| Navigation-Menü-Baum | Fragen sind der Weg; das Seitenbrett ist Inhaltsverzeichnis |
| Tabelle als Fall-Ansicht | Erzählung statt Tabelle — der Mensch liest Geschichte, nicht Zeilen |
| Terminal-Vokabular im Haupttext | nur in der aufklappbaren Quellen-Zeile |

## 9. Die Seele

*Nach zwei Minuten besitzt du einen Tresor, nach dem ersten Foto verstehst du die KI, nach der ersten Woche hast du keine Posteingänge mehr — und du hast kein einziges Mal das Gefühl gehabt, ein Programm zu bedienen.*
