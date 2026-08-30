# W1 + CALL — Bau-Aufträge für Claude Code

*Repo: C-0711/MMC-OS · Stand: nach `eecca8d` · Zwei parallele Fronten: Workspace-Connectors (W1) + gitchain Call · Ausführung lokal auf dem Mac*

---

## FRONT 1: W1 — Workspace-Connectors

*Spec: `docs/spec/workspace-business-v0.1.md` (Connector-Anchoring, Widerspruchs-Engine)*

### Der Auftrag in einem Satz

**Baue das Connector-Gerüst: ein System-Pull wird zum committeten Eingang mit Connector-Fundstelle, und ein Attribut-Widerspruch zwischen zwei Systemen wird eine Karte mit zwei Fundstellen.**

### W1.1 — Connector-Fundstellen-Format

Erweitere das Fundstellen-Modell (Vault/Types) um die Connector-Art — analog zu ETAPPE-4 Abschnitt A (dort „anruf", hier „connector"):

```typescript
// Erweiterung des Fundstellen-Union-Types
type Fundstelle =
  | { art: 'dokument'; doc: string; seite: number; bbox: [number, number, number, number] }
  | { art: 'anruf'; wav: string; minute: string }
  | { art: 'connector'; system: string; objekt: string; revision: string;
      attributpfad: string; abgerufen: string; endpoint: string; abgerufenDurch: string }
```

**Regel (Negativ-Katalog):** Kein Attribut aus einem System ohne Connector-Fundstelle. Validierung im Main-Prozess erzwingen (wie `deutung.ts` die Dokument-Fundstellen erzwingt).

### W1.2 — Konnektor-Gerüst (`app/src/main/connectors/`)

```
app/src/main/connectors/
├── connector.ts          Interface: pull() → ConnectorErgebnis[]
├── teamcenter.ts         Teamcenter-Konnektor (erst MOCK, dann echte REST-Antwort)
├── erp.ts                ERP-Konnektor (Mock: Materialstamm/Bestellungen)
└── scheduler.ts          Pull-Zyklen (Cron-artig, je Konnektor konfigurierbar)
```

**Mock-First-Doktrin:** Die echten APIs (Teamcenter auf `192.168.145.x`, ERP) laufen auf deinem Netz — Claude Code baut gegen **Mock-Endpunkte mit realistischen Antworten** (z. B. `app/src/main/connectors/mocks/teamcenter-mock.ts` mit 3 Items, 2 Revisionen, einem eingebauten Widerspruch). Echte Credentials/URLs kommen NIE ins Repo — nur in `.env`/Keychain, gitignored.

### W1.3 — Der Pull-Lebenszyklus (das Gesetz: Commit vor Deutung gilt für APIs)

```
1. PULL:   connector.pull() → Objekt + Metadaten + Revision
2. COMMIT: Objekt byte-identisch nach docs/systeme/<system>/<objekt>-rev-<X>/
           + sidecar mit Connector-Fundstelle (alle abgerufenen Attribute)
3. DIFF:   gegen letzten Stand desselben Objekts → Atom-Diff mit ZWEI Fundstellen
           (alt: connector …rev-B, neu: connector …rev-C)
4. DEUTUNG: Rollen-Agent liest Diff gegen Erwartungs-Schema (skill „attribute-leser")
5. KARTE:  bei Widerspruch — aber nur EINE, max. 3 (Queue-Regel)
```

Verwende die bewährte Mechanik aus `vault.ts` (commitEingang, proposeDeutung) — der Connector ist nur eine weitere Eingangsart (`kanal: 'teamcenter'`).

### W1.4 — Widerspruchs-Engine (der Demo-Kern)

Regelmäßiger Abgleich gleicher Attribute quer über Systeme:

```typescript
// widerspruch.ts
interface AttributWiderspruch {
  attribut: string;                        // z. B. "wanddicke"
  wertA: { wert: string; fundstelle: Connector-Fundstelle };   // Teamcenter Rev C: 2,1
  wertB: { wert: string; fundstelle: Connector-Fundstelle };   // PIM: 2,3
  karte: { titel: "Widerspruch: wanddicke M-Nr 4711";
           frage: "Teamcenter sagt 2,1 mm, PIM sagt 2,3 mm — welche gilt?" }
}
```

Auflösung = Multi-eyes (enterprise-humans-Spec §3): beide Werte sichtbar mit ihren Fundstellen, Rolle entscheidet, **signierte Fassung** committet die Gültigkeit. Demo-Szenario dafür einbauen (Mock so präparieren, dass der Widerspruch garantiert auftritt).

### W1.5 — Referenz-Instanz spiegeln

Erweitere `/opt/data/gitchain-ref/` (bereits im Repo: `docs/gitchain-ref/`) parallel: `POST /api/brain/deploy` versteht `kanal: 'teamcenter'` + Connector-Fundstellen in der Policy-Auswertung (Deploy-Commit zeigt dann `system: 'teamcenter'` als Beweis). Tests dazu erweitern.

### W1 Definition of Done

1. `npm run typecheck` grün, alle Tests grün (bestehende + neue connector.test.ts)
2. Ein Teamcenter-Mock-Pull landet als committeter Eingang im Fall-Container, mit Connector-Fundstelle im Sidecar
3. Der eingebaute Widerspruch wird Karte mit BEIDEN Fundstellen, Beweis-Viewer zeigt beide Quell-Systeme
4. Rollen-Bestätigung erzeugt signierte Fassung (Multi-eyes minimal: 1 Rolle für die Demo)
5. Keine echten URLs/Credentials im Repo (nur Mocks + .env.example)

---

## FRONT 2: CALL — gitchain Call & Meet

*Spec: `docs/spec/souveraene-kommunikation-v0.1.md` (Anruf = Fall in Echtzeit)*

### Der Auftrag in einem Satz

**Baue den Anruf als Live-Spur des geteilten Falls: E2E-Audio zwischen zwei Electron-Instanzen, lokale Mitschrift, jede Zeile als Atom mit Minuten-Fundstelle, Beschluss-Kandidaten als Karten, signierte Fassung am Ende.**

### C.1 — Fundstellen-Typ „anruf" (Voraussetzung, ETAPPE-4 A — falls noch nicht geschehen, zuerst)

```typescript
type Fundstelle =
  | { art: 'dokument'; … }
  | { art: 'anruf'; wav: string; minute: string; dauer?: string }
```

Beweis-Viewer-Fall `art === 'anruf'`: Transkript-Timeline statt Bild+Rechteck (Vorlage: `OsAnrufBeweis.dc.html` — Header „ANRUF · … · 42 MIN" + Play-Icon, Sprecher-Zeilen, Fundstelle-Zeile mit 2px Rosé).

### C.2 — Signaling-Stub (`app/src/main/call/signaling.ts`)

- WebSocket-Dienst (lokal zuerst: `ws://localhost:3362` — dieselbe Adresse für alle Konsumenten)
- Nachrichten: `{typ: 'anruf-anstoss', von: did, fall: fallId}` → `{typ: 'klingeln'}` → `{typ: 'annehmen'}` → `{typ: 'verbindung', sdp/ice …}`
- **Der Stub sieht nur Chiffre-Adressen + Fall-IDs** — in der Demo reicht JSON über localhost; die Disziplin („Signaling sieht nie Inhalt") von Anfang einbauen: Kommentare + Typ-Trennung (`SignalingNachricht` vs. `MedienDaten` — letztere gehen NIEMALS durch den Stub)

### C.3 — Medienpfad (`app/src/main/call/media.ts`)

- WebRTC (Electron: `webrtc-native` oder `libdatachannel`; falls das Build-Risiko zu hoch: **erst Audio-only über simple-peer/Node-WebSocket-Verschlüsselung als Vertretung**, aber die Schnittstelle so bauen, dass WebRTC nur ausgetauscht wird)
- **P2P direkt zwischen den beiden Electron-Instanzen** (zwei Fenster für die Demo: „A" und „B" auf demselben Mac)
- Mikrofon via `navigator.mediaDevices.getUserMedia` (Renderer), Stream durch die IPC ins WebRTC-Modul (Main) — oder gleich im Renderer-WebRTC, je nach Electron-Erfahrung

### C.4 — Lokale Mitschrift (der Beweis-Kern)

- Whisper-Klasse on-device: dein vLLM-Stack auf `192.168.145.10:11435` hat evtl. ein STT-Modell; sonst `whisper.cpp` als Binary neben der App
- **Jede Seite transkribiert lokal** (Demo: A-Lesart und B-Lesart desselben Moments als zwei Atoms mit gleicher `minute` — Divergenz sichtbar machen, das ist Feature)
- Committen in den gemeinsamen Fall: `kanal: 'anruf'`, Atom je Äußerung: `{sprecher, minute, text}`

### C.5 — Die Call-UI (Canvas-Artboards sind die Vorlage)

| Screen | Artboard | Kern |
|---|---|---|
| Klingeln | `OsAnrufKommt.dc.html` | Fall-Kontext sichtbar („Anruf von A · Fall: Badrenovierung · 3 offene Dinge"), [Annehmen][Später] |
| Laufend | `OsAnrufLaeuft.dc.html` | Live-Mitschrift wächst sichtbar (Atom-Vorschläge), max. 3 KI-Signale dezent („Frist erkannt — übernehmen?") |
| Beweis | `OsAnrufBeweis.dc.html` | bereits C.1 |

### C.6 — Beschluss-Kette (Abschluss des Gesprächs)

Nach Auflegen: KI extrahiert Kandidaten aus der Mitschrift (Fristen, Zusagen, Preise — dieselben Skills wie beim Beleg-Leser) → Karten → beide bestätigen → `agreement` als signierte Fassung (communication-Spec §5 Format). **Gesprochenes „ja" erzeugt nur Kandidaten, nie main** (harte Regel — in der UI als Hinweiszeile: „Gesprochene Zustimmung wird vorgeschlagen, nicht committet").

### C.7 — Referenz-Instanz erweitern

`docs/gitchain-ref/server.js`: `POST /api/v2/fall/<id>/anruf` — eröffnet Anruf-Sitzung im Fall (liefert `sitzungId` zurück), Atoms mit `fundstelle.art: 'anruf'` akzeptiert die Deutungs-Route bereits (nach C.1-Type-Erweiterung). Test: Anruf-Sitzung → 3 Atoms → Beschluss-Kandidat → signierte Fassung.

### CALL Definition of Done

1. Zwei App-Instanzen auf demselben Mac: A ruft B mit Fall-Kontext, B sieht Klingel-Screen mit Fall-Infos
2. Audio-Verbindung steht (E2E — auch wenn's lokal nur Loopback ist, muss der Code-Pfad E2E sein)
3. Mitschrift läuft bei beiden, landet als Atoms mit `minute`-Fundstellen im gemeinsamen Fall
4. Nach Auflegen: mind. 1 Beschluss-Kandidat als Karte, Bestätigung beider Seiten → signierte Fassung im Baum
5. Beweis-Screen zeigt die Transkript-Timeline mit gehighlighteter Fundstelle (OsAnrufBeweis-Vorlage)
6. `npm run typecheck` grün; Signaling-Stub enthält nie Medien-/Inhaltsdaten (Typ-Trennung beweisbar im Code)

---

## Harte Regeln für BEIDE Fronten (Review-Gate)

- Commit vor Deutung — auch für API-Pulls und Anruf-Mitschriften
- Keine Aussage ohne Fundstelle (Dokument-Rechteck ODER Anruf-Minute ODER Connector-Zelle)
- Agent schreibt nie main; R3 (Verträge, Abgaben, Geld) braucht die Unterschrift im ruhigen Raum, nie im Gespräch
- max. 3 Karten/Sichtbarkeit; Stille = Zustand
- Echte URLs/Credentials niemals committen — Mocks + `.env.example`
- Pixel-Vergleich gegen die `.dc.html`-Artboards vor jedem Commit (nicht gegen Erinnerung)
- Zwei Commits pro Etappe: `W1.x: <was>` und `CALL.x: <was>` — getrennt reviewbar

## Reihenfolge-Empfehlung

1. **W1.1 + C.1 zusammen** (Fundstellen-Typ-Erweiterung ist gemeinsame Basis — ein Commit, beide Fronten profitieren)
2. Dann parallelisieren: W1.2–W1.4 (Connector-Gerüst + Widerspruch) und C.2–C.5 (Signaling + Medien + UI)
3. Zuletzt die Referenz-Instanz-Erweiterungen (W1.5, C.7) — sie sind die Test-Zielscheibe für beide
