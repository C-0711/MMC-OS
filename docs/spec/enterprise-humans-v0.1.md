# Enterprise-Spezifikation v0.1 — Der Mensch im System

*Dreizehnte Spec im Verbund · B2B-Fortführung: Rollen, Freigaben, Agenten-Besitz · Aufbauend auf: ingress, interaction, agent-containers, communication*

---

## 0. Der eine Satz

**Im Unternehmen ist der Mensch keine Person, sondern eine Rolle in einer Freigabe-Kette — und jede Interaktion ist ein beweisbarer Akt zwischen Rolle, Agent und Fall.**

## 1. Die drei Ebenen menschlicher Beteiligung

```
┌─────────────────────────────────────────────────────┐
│  EBENE 1: DER ENTSCHEIDER (Rolle)                    │
│  „Darf/kann/muss ich das freigeben?"                │
│  Freigabe = signierter Commit mit Rollen-Capability │
├─────────────────────────────────────────────────────┤
│  EBENE 2: DER FACHMANN (Domäne)                     │
│  „Stimmt diese Deutung?" (Korrektur statt Fehler    │
│  melden: [Passt][Anders] direkt am Beweis-Rechteck) │
├─────────────────────────────────────────────────────┤
│  EBENE 3: DER BETRACHTER (Interesse)                │
│  „Was gilt gerade?" (Anfrage mit Beweis, keine      │
│  Schreibrechte, nur lesende Capability)             │
└─────────────────────────────────────────────────────┘
```

Jeder Mensch im Unternehmen ist gleichzeitig auf mehreren Ebenen: Erika (PIM) ist **Entscheiderin** für Attribute ihres Produkts, **Fachfrau** bei Deutungen im eigenen Domänen-Baum, **Betrachterin** in allem anderen.

## 2. Der Tagesablauf eines PIM-Mitarbeiters (das Fenster)

Die Oberfläche bleibt der ruhige Raum — aber der Inhalt ist Arbeit:

```
┌─────────────────────────────────────────────────────┐
│  ○ Siegel (Erika · Rolle PIM)   3 Dinge · 2 warten   │
│─────────────────────────────────────────────────────│
│  Guten Morgen, Erika.                              │
│  Drei Dinge für M-Nr 4711.                          │
│                                                     │
│  ⚠ Zeichnung v3: 2 Attribute widersprechen    ▶   │
│     dem Datenblatt (Konstruktion wartet auf dich)   │
│  ℹ Zulieferer Weber hat Container-Fassung        ▶   │
│     C2 übergeben — 4 Änderungen                    │
│  ✓ Freigabe Q3 abgeschlossen (nur Info)             │
│                                                     │
│  …                    Frag mich · was gilt heute?   │
└─────────────────────────────────────────────────────┘
```

**Die Regeln bleiben die B2C-Regeln — nur die Füllung ändert sich:**
- **Maximal 3 offene Karten pro Rolle pro Tag** — nicht pro Person. Wenn Erikas Queue voll ist, weil sie im Urlaub war, übersteht die Kette es (Vertretung, §5).
- **Stille = erledigt** gilt für die Rolle: Der Großteil der Attribut-Pflege läuft auto (R0/R1: neue Werte gegen Schema prüfen, committen mit Fundstelle), nur Abweichungen werden Karten.
- **Beweis-Rechteck überall:** „2,3 mm" klappt auf zu *Teamcenter MNR-4711, Rev C, Abruf 28.08., Attributpfad X* — der Fachmann prüft am Original, nicht an der Behauptung.

## 3. Freigaben: Multi-eyes statt four-eyes

Die Freigabe ist der entscheidende menschliche Akt — im Unternehmen ist sie eine **Kette von Rollen-Signaturen**:

```
Freigabe-Zustand einer Attributänderung (Fall M-Nr 4711):

  vorgeschlagen  →  Erika (PIM) ✓ 14:02      ← Fach-Deutung bestätigt
                   Konstruktion ✓ 15:31       ← fachliche Prüfung
                   QM [ ]                     ← wartet seit 1 Tag
                   ──────────────
                   Freigabe-Kette: 2/3 · QM erinnern?
```

**Die Regeln:**
1. **Jede Rolle in der Kette hat eine Capability mit `may_confirm: true`** — Signatur = commit mit Rollen-Identität (did:key der Rolle, nicht der Person; die Person handelt *in* der Rolle, beides im Audit).
2. **Vertretung ist Architektur, kein Hack:** Rolle ≠ Mensch heißt: Erikas Urlaub ist ein Capability-Transfer an die Vertretung (befristet, signiert, im Baum dokumentiert). Der Agent wechselt den Ansprechpartner, die Kette steht nicht still.
3. **Erinnerungen sind Karten, keine E-Mails:** „QM prüft seit 2 Tagen — erinnern?" erzeugt eine Karte *bei QM*, nicht eine Mail an alle. Jede Erinnerung ist ein Commit (Audit: wer hat wen wann gedrängt — auch das ist Compliance-relevant).
4. **Die Kette ist sichtbar, der Zustand ist bewiesen:** „Welche Fassung galt, als Weber 2023 geliefert hat?" → die Freigabe-Historie des Baums antwortet mit Signaturen und Zeitstempeln. **Das ist der Retrospektiv-Beweis, den kein PLM/ERP heute führt.**

## 4. Agenten im Unternehmen: eine Rolle, ein Agent

| B2C | B2B |
|---|---|
| Agent lernt alles von *einer Person* | Agent gehört zur **Rolle**, lernt von deren Domäne |
| Memories = Persönlichkeit des Nutzers | Memories = **Fachwissen der Rolle** (wichtig: Arbeitsprodukt, bleibt im Unternehmen bei Ausscheiden) |
| Autonomie-Regler des Nutzers | Rollen-Policy der Organisation (R0–R3-Matrix je Rolle editierbar durch Daten-Steward) |
| Four-eyes: Nutzer bestätigt | Multi-eyes: Freigabe-Kette bestätigt |

**Der Rollen-Agent verhält sich wie ein Mitarbeiter:**
- Er **schlägt vor, nie main** (branch-only) — seine Deutungen landen als Vorschläge bei der Rolle.
- Er **hat eine Skill-Vita**: „Zeichnungs-Leser v2.4, freigegeben von PIM-Steward am 01.08." — jede Deutung referenziert die Skill-Version, die sie erzeugte (Reproduzierbarkeit der Maschine — für Audits/ISO).
- Er **lernt aus Korrekturen**: „Anders"-Antworten (Erika korrigiert eine Deutung) sind Memory-Commits mit Quelle — nach 3 gleichen Korrekturen fragt er nicht mehr, sondern macht es richtig (in Grenzen der Rollen-Policy).

## 5. Die Interaktionsformen im Überblick

| Situation | Mensch | Interaktion |
|---|---|---|
| Tägliche Queue | Rollen-Inhaber | Desktop-App: max. 3 Karten, Tap/Voice |
| Fach-Prüfung einer Deutung | Fachmann | Beweis-Rechteck → [Passt][Anders] — Korrektur wird Commit |
| Freigabe | Entscheider-Rolle | Multi-eyes-Kette, Signatur, ggf. Geräte-Entsperre (R3) |
| Ad-hoc-Frage | jeder | „Frag mich" — Antwort mit Fundstelle (System, Objekt, Revision) |
| Vertretung | Rollen-Inhaber | Capability-Transfer, befristet, im Baum |
| Metriken/Steuerung | Steward/Management | Abfrage, kein Dashboard-Bau: „Wo stocken Freigaben?" → Antwort aus dem Baum |
| Extern (Zulieferer) | Partner-Rolle | Container-Übergabe (Kommunikations-Spec) — jede Seite besitzt den Klon, Freigabe = signierte Fassung |

## 6. Der Unterschied zu heute (warum Unternehmen das wollen)

| Heute (PLM/ERP-Welt) | gitchain |
|---|---|
| Freigabe = Statusfeld in einer Datenbank | Freigabe = Kette signierter Commits mit Identität und Zeitpunkt |
| „Wer hat das geändert?" = IT-Ticket, Log-Archäologie | Abfrage mit Beweis, Sekunden |
| Widerspruch Datenblatt/Zeichnung = Meetings | Karte am Beweis-Rechteck, Diff sichtbar, Entscheidung dokumentiert |
| Vertretung = Rechte-Verwaltung im Admin-Tool | Capability-Transfer, befristet, auditierbar |
| KI = Black-Box-Empfehlung | Deutung mit Fundstelle, Skill-Version, four-eyes — prüfbar |
| Personengebundes Wissen wandert bei Kündigung | Rollen-Agent-Memories bleiben im Baum des Unternehmens |

## 7. Negativ-Katalog

| Verbot | Grund |
|---|---|
| Freigabe ohne Rollen-Signatur | der Kern-Beweiswert bricht |
| Persönliche Memories vermischen mit Rollen-Memories | Ausscheiden = Datenabfluss; Rolle ist Arbeitsprodukt des Unternehmens |
| Karten-Flut statt Rolle-Queue (mehr als ~5/Tag dauerhaft) | dann stimmt die Rollen-Policy nicht — Meta-Rückfrage an den Steward |
| Freigabe per E-Mail-Text („einverstanden, MfG Erika") | Beweiskraft einer Meinung; Signatur mit did:key ist Pflicht |
| Dashboard-Zwang für Steuerung | Abfragen mit Beweis ersetzen Berichte; wer Zahlen will, fragt |

## 8. Der Satz

*Der Mensch im Unternehmen bleibt, was er sein soll: Entscheider, Fachmann, Betrachter — aber jede seiner Handlungen wird zu einem beweisbaren Commit in einer Rolle, und der Agent der Rolle arbeitet wie ein Kollege: vorschlagend, lernend, niemals eigenmächtig auf main.*
