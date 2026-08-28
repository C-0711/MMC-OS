# Agenten-Container-Spezifikation v0.1

*Status: Entwurf · Gilt für: gitchain OS (Desktop/Mobile), gitchain-lite · Ergänzt `supercontainer-v0.1.md`, Abschnitt 8*

---

## 0. Der eine Satz

**Der Agent ist kein Programm mit verstecktem Zustand — er ist ein Clone-Inhaber mit Capability. Alles, was er weiß, kann oder getan hat, ist committet: Git for agent memory.**

## 1. Die dritte Container-Klasse

| Container-Typ | Inhalt | Besitz |
|---|---|---|
| Fall-Container | Eingänge, Deutungen, Original-Blobs — die Welt des Nutzers | Nutzer |
| Funktionscontainer | Code + Regeln, zustandslos | Auslieferer/Betreiber |
| **Agenten-Container** | Memories + Skills + Policy — das Innere der KI als Baum | **Nutzer** (seine KI, seine Regeln) |

## 2. Verzeichnisstruktur

```
agent-<name>/
├── memories/                    ← was der Agent über Nutzer/Welt weiß
│   ├── episodic/                   je Interaktion ein Commit (Gespräch → Atoms mit Fundstelle)
│   ├── semantic/                   verdichtete Fakten, JEDE mit Quelle-Atom im Fall
│   └── preferences/                „Nutzer will kurze Antworten" — committet, diffbar
├── skills/                      ← was der Agent kann
│   ├── <skill>/SKILL.md            die Fähigkeit, versioniert
│   ├── <skill>/scripts/            ausführbar, hash-adressiert
│   └── evolution.json              wann/warum/von wem geändert
├── policy.json                  ← Erlaubnisse des Agenten (Capability-Spiegel)
└── audit/                       ← jede Werkzeugnutzung, jede Deutungsentscheidung
```

## 3. Memory-Commit-Format

Ein Memory ist ein Atom mit Pflicht-Feldern:

```json
{
  "memory_id": "sha256:<hash>",
  "kind": "episodic | semantic | preference",
  "content": "Nutzer bevorzugt SEPA-Überweisungen am Monatsantrag.",
  "learned_from": {
    "atom": "steuern-2026:atom-1042",      // Fundstelle im Fall
    "interaction": "episodic/2026-08-28/commit-abc123"
  },
  "confidence": 0.87,
  "reviewed_by_user": true,                 // four-eyes auch fürs Lernen
  "expires": null | "2027-12-31"
}
```

**Regeln:**
- **Keine Memory ohne Quelle.** `learned_from` ist Pflicht; fehlt sie, ist der Memory ungültig (fail closed). „Woher weißt du das?" ist damit immer zweifach beantwortet: Quelle des Fakts (Fall) + Lernmoment (Agenten-Container).
- **Lernen ist ein Commit.** Der Nutzer kann diffen, was die KI gestern über ihn gelernt hat — und `git revert`en. **Vergessen ist ein Commit, nicht eine Bitte.**
- **Verdichtung (episodic → semantic) ist ein nachvollziehbarer Vorgang:** der verdichtete Memory referenziert alle Episoden, aus denen er entstand.

## 4. Skill-Signatur und Load-Regel

- Jeder Skill (SKILL.md + scripts) hat eine **Herkunfts-Signatur** (Ed25519 des Auslieferers — Nutzer selbst, Partner, gitchain GmbH).
- **Load-Regel (fail closed):** Ein Skill ohne überprüfbare Herkunfts-Signatur wird nicht geladen. Ein Skill mit ungültiger/fehlender Signatur wird verworfen und der Vorfall in `audit/` committet.
- **Skill-Evolution:** jede Änderung ist ein Commit mit `evolution.json`-Eintrag (was, warum, von wem, welche Fassung welchen Effekt hatte).
- **Beweisbarkeit der Maschine:** jede Buchung/Deutung verweist auf die Skill-Version, die sie erzeugte — Reproduzierbarkeit nicht nur der Daten, sondern der Verarbeitung.

## 5. Policy-Spiegel

`policy.json` spiegelt die dem Agenten erteilten Capabilities:

```json
{
  "agent": "did:key:<agent-pubkey>",
  "capabilities": [
    {"container": "steuern-2026", "operations": ["search", "get-atom", "propose"]},
    {"container": "haus-bauträger", "operations": ["search", "get-atom"]}
  ],
  "may_write": "branch-only",          // nie main — four-eyes
  "voice_commit": "confirm-only"       // siehe Vorschlags-Format (separate Spec)
}
```

Der Agent verhält sich gegenüber Fällen exakt wie ein Partner im Safe Network: liest per Capability, schreibt nur Vorschläge auf Branches, Bestätigung macht der Nutzer.

## 6. Agent-zu-Agent im Safe Network

- Agenten können Skills teilen — als **Clone-Übergabe mit Signatur**, prüfbar auf Herkunft.
- Agent-zu-Agent-Kommunikation erzeugt Episoden in *beiden* Agenten-Containern (jede Seite dokumentiert ihre Sicht).
- Ein fremder Agent (Steuerberater-KI, Bank-Bot) erhält dieselbe Behandlung wie ein Partner-Plugin: Capability-basiert, Namensraum-getrennt, audit-pflichtig.

## 7. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Zustand außerhalb eines Baums (in-memory DB, Cloud-Memory) | „Was nicht committet ist, ist nicht Teil des Systems" |
| Memory ohne `learned_from` | unbelegte Behauptung, fail closed |
| Skill-Laden ohne Signaturprüfung | Fälschungsschutz bricht |
| Agent-Schreibzugriff auf main | four-eyes bricht |
| Agent-Container als einzige Kopie (kein Klon) | Git-Regel: Klone sind Besitz |

## 8. Die eine Regel, die das System zusammenhält

> **Kein Zustand außerhalb eines Baums.** Was der Agent weiß, kann, getan oder entschieden hat — wenn es nicht committet ist, ist es nicht Teil des Systems.

---

*Nächster Schritt: Vorschlags-Format (proaktive Rückfragen + Voice-Commit-Semantik) als eigene Spec.*
