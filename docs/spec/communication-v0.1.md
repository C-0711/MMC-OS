# Kommunikations-Spezifikation v0.1 — „Der geteilte Fall"

*Achte Spec im Verbund · Löst Mail, Chat und Anruf in einem Konzept auf: Kommunikation ist Container-Austausch.*

---

## 0. Der eine Satz

**Wenn ich jemanden mit gitchain anrufe, schicke ich einen Container — und ab diesem Moment führen beide Seiten denselben Baum: Groupchat, Groupmail und geteilter Fall sind dieselbe Sache.**

## 1. Die Auflösung

| Klassisch | gitchain |
|---|---|
| Anruf (flüchtig, Mitschrift getrennt) | Anruf erzeugt/öffnet den gemeinsamen Container; Mitschrift = Atoms mit Fundstelle (Zeit + Sprecher) |
| Mail (Thread im Postfach des Providers) | Nachricht = Commit im geteilten Fall; kein Provider zwischen den Seiten |
| Chat/WhatsApp (silofremde Kopie) | dieselbe Commit-Struktur, andere Darstellung |
| „Gruppenchat" / „Groupmail" | **ein geteilter Fall-Container** — N Klone, ein Baum |

Das Beobachtungsfenster des Nutzers bleibt dabei, was er kennt: *Mail — quiet. Messages — quiet. Photos — quiet. Scans — 1 open.* Die Apps sind Abfragen mit Darstellung (gestrichelte Kästchen); hinter allen läuft derselbe Mechanismus.

## 2. Der Lebenszyklus eines geteilten Falls

```
1. ANRUF/ANSTOSS    A ruft B (gitchain-zu-gitchain)
                      → A erzeugt Fall-Container „a+b-<thema>" (oder lädt bestehenden)
                      → Übergabe: Signatur + Capability für B (scope: read/propose)
2. ÜBERNAHME        B erhält Container (P2P/Direct oder Relay — Transport ist austauschbar)
                      → B kloned in eigenen Vault; Capability-Check fail closed
3. VERLAUF          jede Nachricht/Anruf/Datei = Commit im Fall
                      → beide Seiten schreiben nur Branches + Commits; Konflikte = Merge
                      → Mitschriften, Belege, Vereinbarungen landen als Atoms MIT Fundstelle
4. ERGEBNIS         Vereinbarung/Vertrag = signierter Stand des Baums (Fassung)
                      → optional Anchor (QTSP/EBSI) = beweisbarer Zeitpunkt
5. ENDE/ARCHIV      Fall bleibt Klon bei beiden — jede Seite besitzt die vollständige Wahrheit
```

**Der entscheidende Punkt:** Es gibt keinen zentralen Server, der „den Chat" hält. Der Chat *ist* ein verteiltes Git-Repo — beide Seiten besitzen die vollständige, signierte Historie. Was heute „Chatverlauf bei Meta" ist, ist hier: *ein Klon bei jedem*.

## 3. Zwei Wege, je nach Gegenseite

| Gegenseite | Mechanismus |
|---|---|
| **B hat gitchain** | Voll-Sync: gemeinsamer Fall-Container, Clone-Übergabe, jede Interaktion ein Commit (Idealzustand) |
| **B hat kein gitchain** | Brücke: die eigene KI übersetzt den Fall in klassische Kanäle (Mail/Signal-Anhang) — was rausgeht, ist redigiert (redact) und als Crossing in `audit.jsonl` dokumentiert; was zurückkommt, wird als Eingang committet. **Der Fall bleibt vollständig — nur die Gegenseite hat ihn nicht.** |

Regeln:
- **Der Container ist immer mein Eigentum.** Teilen heißt: Capability ausstellen, nie Besitz abgeben. Rückruf (Revocation) jederzeit — Commit im Baum, verteilt über pull-on-push.
- **Redaction bei jedem externen Crossing** (IBAN, Adressen, was die Policy sagt). Was die Policy nicht freigibt, geht nicht raus — fail closed.
- **Anruf-Brücke:** klassische Telefonie bleibt möglich (die Welt ist nicht fertig); die Mitschrift läuft lokal und wird in den Fall committet — der Partner ohne gitchain hat nur das Gespräch, ich habe Gespräch + Beweis.

## 4. Granularität: die zwei Container-Formen

| Form | Zweck | Lebensdauer |
|---|---|---|
| **Beziehungs-Container** (a+b) | der gemeinsame Baum mit einem Menschen: alle Gespräche, Mails, Absprachen, Belege mit dieser Person | solange die Beziehung |
| **Themen-Fall** (projekt, vertrag, kauf) | ein konkreter Vorgang, ggf. aus dem Beziehungs-Container ausgegründet, wenn er eigenes Gewicht bekommt | bis Abschluss + Anchor |

Beide sind normale Fall-Container im Brain föderiert — Kommunikation erzeugt keine neue Datenstruktur, sie *nutzt* die bestehende. Die KI schlägt die Ausgründung vor („Wir haben jetzt 3 Themen mit Weber — soll ich ‚Badrenovierung' als eigenen Fall führen?").

## 5. Nachrichten-Commit-Format

```json
{
  "msg_id": "sha256:<hash>",
  "from": "did:key:<a>",
  "kind": "text | voice-memo | call-transcript | file | agreement",
  "content_ref": "blob-sha oder text-atom",
  "fundstelle": {"container": "a+b-weber", "commit": "<sha>", "ts": "..."},
  "refs": ["a+b-weber:atom-881"],          // worauf sich die Nachricht bezieht
  "sig": "<ed25519 absender>"
}
```

- Jede Nachricht ist signiert, adressiert, unveränderbar committet.
- **Zitat = Referenz** („worauf sich die Nachricht bezieht") — Antworten zeigen auf Atoms, genau wie jede Deutung. Auch im Chat gilt: keine Aussage ohne Fundstelle.
- Voice-Memos: lokal transkribiert (STT), Text als Atom, Audio als Blob — beide auffindbar.
- Anruf-Mitschriften: pro Äußerung ein Atom mit `(sprecher, zeit, text)`; Beschlüsse werden von der KI als **agreement-Kandidaten** markiert → Vorschlag → four-eyes → signierte Fassung.

## 6. Der Groupchat-Effekt (warum das besser ist als Chat)

- **Vollständigkeit statt Scrollen:** „Was haben wir im März vereinbart?" ist eine Abfrage über den Baum — mit Antwort + Beweis, nicht 40 Minuten Scrollen.
- **Verträge als Merge:** die Endform der Kommunikation ist die signierte Fassung des gemeinsamen Falls — zwei Seiten, ein Baum, ein Beweis. (Container-zu-Container-Dialog als Vertragsform.)
- **Keine Metamorphose-Apps:** dieselbe Struktur trägt Familiengruppe (Photos-Container), Kundenprojekt (Themen-Fall), Steuer-Mandant (Beleg-Austausch mit Buhl-Klasse-Partner).

## 7. Negativ-Katalog

| Verbot | Grund |
|---|---|
| Zentraler Chat-Server im Besitz eines Dritten | der Chat ist ein Klon bei jedem — sonst ist es WhatsApp mit anderem Label |
| Nachricht ohne Absender-Signatur | Beweiswert bricht |
| Unredigiertes Crossing zu Nicht-gitchain-Seiten | redact ist Pflicht, fail closed |
| Chatverlauf als „Chat-App-Ansicht" ohne Fall-Zugehörigkeit | jede Nachricht gehört zu einem Baum, sonst ist es der alte Silo-Zauber |
| Löschen beim Partner erzwingen | mein Baum ist meiner; was ich zurückrufe, ist die Capability — der Klon beim Partner ist sein Baum (ehrlich kommunizieren) |

## 8. Der Satz

*Ein Anruf öffnet einen Container. Eine Mail ist ein Commit. Ein Vertrag ist eine signierte Fassung. Und am Ende besitzt jeder seinen eigenen Klon der gemeinsamen Wahrheit.*
