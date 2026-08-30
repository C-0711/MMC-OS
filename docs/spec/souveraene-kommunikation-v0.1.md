# Souveräne Kommunikation v0.1 — gitchain Call & Meet

*Achtzehnte Spec im Verbund · Eigenes FaceTime + Telefonfunktion für Online-Meetings · Baut auf: communication-v0.1 (der geteilte Fall), super-brain, technical-spec (Tresor-Verbund, Gateway)*

---

## 0. Der eine Satz

**Ein gitchain-Anruf ist kein Anruf — es ist die Eröffnung oder Fortsetzung eines gemeinsamen Falls: Gespräch, Dokumente, Beschlüsse und Beweis leben im selben Baum, E2E-verschlüsselt direkt zwischen den Tresoren, ohne Telefonie-Anbieter im Pfad.**

## 1. Warum FaceTime/Teams/Zoom nicht genügen (die Lücke)

| Problem bei Anbietern (Apple/Microsoft/Zoom) | Konsequenz |
|---|---|
| Mitschrift/Recording in US-Cloud-Verarbeitung | die souveränste Phase — das Gespräch selbst — leakt |
| Meeting-Inhalte (Chat, Dateien, Whiteboard) in Silos | dieselbe Kanal-Zersplitterung wie bei Teams-Nachrichten |
| „Wer hat was zugesagt?" = Erinnerung | Beschlüsse ohne Beweiskraft |
| Konten-/Tenant-Zwang | Gäste, Partner, externe brauchen Konten beim Anbieter |
| Kein Verhältnis zum Fall | das Meeting schwebt über der Arbeit statt in ihr |

**gitchains Antwort:** Der Anruf ist die Kommunikation-Spec in Echtzeit — der geteilte Fall-Container existiert schon; jetzt bekommt er eine **Live-Spur**.

## 2. Die Architektur: Direkt-Verbindung zwischen Tresoren

```
   TEILNEHMER A (Tresor)                    TEILNEHMER B (Tresor)
   ┌─────────────────┐                     ┌─────────────────┐
   │ gitchain Call   │◄──── E2E (SRTP/    ─►│ gitchain Call   │
   │ Audio/Video     │      DTLS, P2P)     │ Audio/Video     │
   │ + Mitschrift    │                     │ + Mitschrift    │
   │ lokal (STT)     │                     │ lokal (STT)     │
   └────────┬────────┘                     └────────┬────────┘
            │ commit (Atoms: Sätze mit         commit │
            │ Sprecher + Zeit)                        │
            ▼                                         ▼
   ┌─────────────────────────────────────────────────────┐
   │   GEMEINSAMER FALL-CONTAINER (der Anruf-Baum)       │
   │   jedes Wort committet · Beschluss = Kandidat ·      │
   │   Vereinbarung = signierte Fassung                   │
   └─────────────────────────────────────────────────────┘
            Signaling: gitchain-Netzknoten (nur Vermittlung,
            sieht nur Chiffre-Adressen, nie Inhalt)
```

**Drei Regeln:**
1. **Medienstrom P2P/E2E** (WebRTC-Klasse): Audio/Video direkt zwischen Geräten; bei restriktiven Netzen TURN-Relay des Betreibers (sieht nur verschlüsselte Pakete, wie ein Router).
2. **Mitschrift läuft lokal** auf jedem Gerät (Whisper-Klasse on-device) — **kein Cloud-STT, niemals.** Jeder Teilnehmer committet seine Mitschrift in den gemeinsamen Fall; Divergenz ist normal und sichtbar (zwei Lesarten desselben Moments — jedes Satzfeld zeigt die Fundstelle `Minute 04:12`).
3. **Signaling über gitchain-Knoten** (dein K8s-Verbund): verteilt die Verbindungswünsche (wer ruft wen, welcher Fall), sieht **nie** Medien oder Inhalte. Die Adresse für Konsumenten bleibt stabil — wie bei deinem `:3361`.

## 3. Der Ablauf eines Anrufs

```
1. ANSTOSS    A spricht: „ruf Weber an" (Voice) oder Tippt
              → gitchain wählt den FALL voraus (Beziehungs-Container oder Thema)
2. SIGNALING  B Gerät klingelt mit Fall-Kontext:
              „Anruf von A · Fall: Badrenovierung · 3 offene Dinge"
              (kein anonymer Anruf — der Anruf kommt IMMER mit Fall)
3. VERBINDUNG P2P-E2E steht; Mitschrift beidseitig lokal
4. IM GESPRÄCH
   - Jeder sieht live den BAUM mitwachsen: „Fr. Weber sagte gerade …" (Atom,
     Minute 12:04, stumm als Vorschlag)
   - KI-Signale dezent: „Frist erkannt (Minute 14:02) — übernehmen?" (Karte,
     nie Unterbrechung; max. 3 pro Gespräch)
   - Datei-Drop: beide sehen dasselbe Dokument auf demselben Beweis-Stand
5. ABSCHLUSS  Beschluss-Kandidaten werden Karten:
              „Vereinbart: Dachfertigstellung 15.09., Preis 12.400 € (Minute 27:50)"
              → beide bestätigen → SIGNIERTE FASSUNG (agreement)
              → der Anruf endet als committeter Zustand im Baum
6. SPÄTER     „Was hat Weber zugesagt?" → Abfrage mit Beweis (Minute + Commit)
```

**Der entscheidende Unterschied zu jedem Meeting-Tool:** Nach dem Auflegen existiert kein „Meeting-Protokoll, das jemand schreiben muss" — der Baum *ist* das Protokoll, mit Zeugen auf beiden Seiten.

## 4. Meeting (der Tisch in Echtzeit)

Multi-Party = dieselbe Mechanik mit N Tresoren und einem Fall:

| Bedarf | Umsetzung |
|---|---|
| Gruppen-Video (bis ~8) | Mesh-P2P (WebRTC); darüber: Videoknoten (Chiffre-relay, selektive Weiterleitung — sieht nur Chiffre) |
| Gemeinsames Dokument | Datei im Fall-Container; alle sehen denselben Hash-Stand; Änderungen als Commits mit Autoren-Signatur |
| Beschluss im Meeting | Multi-eyes live: KI formuliert Kandidat → alle tipken/ja → signierte Fassung noch im Termin |
| Gäste/Externe ohne Konto | Einladung = Capability + Container-Klon (Team-Raum-Spec §3.3) — der Gast braucht nur die gitchain-App, keinen Account beim Anbieter |
| Aufzeichnung | **beidseitig beweisbar statt einseitig geheim:** Audio als Blob im Fall,wer eine Kopie hält, ist committet; Zustimmungs-Status je Teilnehmer dokumentiert (DSGVO-konform) |

## 5. Nummern- und Erreichbarkeits-Modell

**Phase 1 (gitchain-zu-gitchain):** Erreichbarkeit über did:key-Identität („gitchain-Adresse"), kein Nummernkreis nötig. Verzeichnis dezentral (Safe Network), nicht zentral.

**Phase 2 (Brücke zur Telefonwelt):** SIP-Gateway für klassische Festnetz/Mobil-Ziele (Kommunikations-Spec §3: die alte Welt ist Brücke). Eingehende klassische Anrufe landen als Eingang im Beziehungs-Container, Mitschrift lokal, Partner ohne gitchain hat nur das Gespräch — ich habe Gespräch + Beweis.

**Kein Nummernzwang:** eine Telefonnummer ist optional (nur für die Brücke). Innerhalb des Netzes gilt die Identität.

## 6. Sicherheits- und Souveränitäts-Regeln (hart)

| Regel | Warum |
|---|---|
| Medien E2E, niemals Anbieter-entschlüsselbar | das Gespräch selbst ist die souveränste Nutzlast |
| STT ausschließlich on-device | ein Cloud-STT-Anruf wäre die nächste US-Leak-Quelle |
| Signaling-Knoten sehen nur Chiffre + Adressen | Betreiber = Vermittlung, kein Inhalt |
| Aufzeichnung nur mit dokumentierter Zustimmung beider Seiten | jede Seite committet ihre Zustimmung |
| Anruf ohne Fall-Kontext unmöglich | kein anonymer Anruf; der Fall ist der Begegnungsraum |
| „ja" im Gespräch = Vorsatz, kein Commit | R3/Verträge brauchen die Unterschrift im ruhigen Raum (Interaktions-Spec §4) — gesprochene Zustimmung erzeugt einen Kandidaten, nie main |

## 7. Umsetzung ( technischer Anker)

| Baustein | Technologie (Referenz) |
|---|---|
| Medien | WebRTC (libdatachannel/webrtc-native) — P2P DTLS-SRTP, TURN-Fallback |
| Signaling | eigener Dienst im K8s-Verbund (WebSocket, did:key-Adressen) — Erweiterung von gitchain-ref |
| STT/Mitschrift | Whisper-Klasse on-device (bereits im Stack: vLLM :11435-Nachbar) |
| Fall-Bindung | commitEingang/proposeDeutung wie in Referenz-Instanz — Anruf = weitere Eingangsart `kanal: "anruf"` mit `fundstelle: {wav, minute}` (bereits in ETAPPE-4.md Abschnitt A) |
| Meeting-Fassung | agreement-Mechanik (communication-Spec §5) |

## 8. Negativ-Katalog

| Verbot | Grund |
|---|---|
| Cloud-STT / Anbieter-Recording | Souveränitäts-Kern |
| Meeting ohne Fall-Bezug | dann ist es Zoom mit anderem Logo |
| Anonyme Anrufe | der Fall ist der Begegnungsraum |
| Gesprochenes „ja" als Vertrags-Commit | Stimme ist Bedienung, nie Unterschrift (R3) |
| Zentraler Kontakt-Server mit Klartext-Verzeichnis | Identität über did:key + Safe Network |
| Aufzeichnung ohne Zustimmungs-Commits | DSGVO + Beweiswert beider Seiten |

## 9. Der Satz

*FaceTime fragt: „Wen rufst du an?" — gitchain fragt: „In welchem Fall sprecht ihr?" Und wenn ihr aufgelegt habt, ist das Gespräch kein Video mehr, sondern beweisbare Wahrheit im Baum beider Tresore.*
