# Super-Brain-Spezifikation v0.1 — Der Gärtner

*Fünfzehnte Spec im Verbund · Erweitert: supercontainer, agent-containers, ingress-flow · Prinzip: Container-Verwaltung selbst wird Deutung mit Beweis*

---

## 0. Der eine Satz

**Der Brain deployt Inhalte automatisch in die Container, zu denen sie nachweislich gehören — und verwaltet die Container selbst (spalten, ausgründen, zusammenführen, archivieren), aber jede Struktur-Änderung ist ein Vorschlag mit Metrik-Beweis und braucht deine Unterschrift.**

## 1. Das Modell: Der Garten

```
SUPER-BRAIN (Agent, lokal)
├── BEOBACHTEN  Metriken je Container (Größe, Rate, Suchtreffer, Widersprüche)
├── LERNEN      Cluster-Muster + deine Korrekturen → Policy (committet, diffbar)
└── HANDELN     Deploy-Vorschläge als Deutungen mit Beweis
        │
        ▼ (vier-eyes für Struktur; auto nur für R0-Deploy)
   [ Fall-Container ] × N  (jeder: eigenes Repo, eigene Signatur, löschbar ohne andere)
```

Der Brain kennt Fälle nur über refs (Supercontainer-Gesetz bleibt). Aber die refs-Liste ist jetzt **gelernte Struktur**, nicht manuelle Konfiguration.

## 2. Auto-Deploy der Inhalte

```
EINGANG → Commit vor Deutung → Atoms mit Fundstelle
  → Brain-Suche (TurboQuant): wo leben ähnliche Atoms?
  → Zuordnungs-Policy (gelernt, versioniert)
  ├─ Konfidenz ≥ 0.85 UND Ziel-Container existiert UND R0/R1  → AUTO-DEPLOY
  │    Commit referenziert: policy-version, match-metrik, ziel-fall
  ├─ Mittlere Konfidenz → Karte (max. 3, wie immer)
  └─ Neues Muster → Cluster-Karte: „Neues Thema erkannt — eigener Container?"
```

**Auto-Deploy-Commit-Format** (jede automatische Zuordnung ist rückverfolgbar):
```json
{
  "typ": "auto-deploy",
  "ziel-fall": "weber-beziehung",
  "eingang-sha": "…",
  "entschieden-durch": {"policy": "zuordnung-v7", "korrekturen-basis": ["deploy-1042"], "konfidenz": 0.91, "aehnlichste-atoms": ["weber-beziehung:atom-88", "weber-beziehung:atom-91"]},
  "revert-weg": "git revert + Policy-Anpassung"
}
```

**Warum liegt das hier?** → Antwort: *„Policy v7 (nach deiner Korrektur vom 12.08.) — Rechnungen von Weber gehen in die Beziehung. 0,91 Konfidenz, nächste Atoms im selben Fall."*

## 3. Die fünf Garten-Operationen

| Operation | Auslöser (Metrik) | Beweis-Fundstelle | Risiko-Klasse |
|---|---|---|---|
| **SPALTEN** | Fall > 5.000 Atoms oder Cluster-Silhouetten-Score > 0.6 | Cluster-Analyse als Committetes Artefakt (`.brain/clusters/`) | R1 → Karte |
| **AUSGRÜNDEN** | Unterthema > 40 % der Commits, 30 Tage | Commit-Historie-Zählung | R1 → Karte |
| **ZUSAMMENFÜHREN** | Zwei Fälle: Atoms-Überschneidung > 50 % | Diff-Statistik beider Bäume | R2 → Karte + Warnung (Beweisketten!) |
| **ARCHIVIEREN** | 14 Monate inaktiv, 0 Abfragen im Quartal | Nutzungsmetriken | R0 → auto möglich |
| **VERGEBEN** (Capability) | Dritter greift 3× auf denselben Fall zu | audit.jsonl-Einträge | R2 → Karte |

Garten-Operationen sind **Struktur-Änderungen** — sie erzeugen eigene Commits im Supercontainer (`refs/`-Änderung) und im Agenten-Container (Memory: warum diese Struktur). **Zusammenführen ist besonders R2:** die Beweisketten beider Fälle müssen erhalten bleiben (Merge der Historien, nie Rewrite).

## 4. Self-Learning: drei Schleifen

1. **Korrektur-Lernen:** „Anders"-Antwort auf Deploy → Memory-Commit `learned_from: deploy-<id>, korrektur: …`. Ab 3 identischen Korrekturen: Policy-Anpassung wird selbst Vorschlag („Soll ich künftig X immer nach Y legen?") → signiert = neue Policy-Version.
2. **Cluster-Lernen (unüberwacht, lokal):** Embeddings über alle Atoms; Cluster-Ergebnis als committetes Artefakt in `.brain/clusters/<datum>.json` — Grundlage für SPALTEN/AUSGRÜNDEN-Vorschläge. Kein Cloud-Training, nie.
3. **Nutzungs-Lernen:** Was nie abgefragt wird, ist Archiv-Kandidat (der Brain lernt Nutzung, nicht nur Inhalt). Abfragen zählen anonym in `audit/usage.jsonl` (Was gefragt, nicht Wer).

**Harte Grenze:** Lernen verändert nur Policy-Vorschläge und Zuordnungen — **niemals Inhalte, niemals main ohne Unterschrift.** Policy-Versionen sind diffbar; jede Zuordnung zeigt, welche Version sie entschied.

## 5. Metrik-Fundstellen (der Neuigkeits-Kern)

Struktur-Vorschläge brauchen Beweise wie Inhalts-Deutungen. Jede Metrik, die einen Vorschlag begründet, ist ein **committetes Artefakt mit Hash**:

```
.brain/clusters/2026-08-30.json    {fall, thema, atom-anzahl, score, methode}
.brain/metrics/2026-08-30.json     {fall, groesse, rate, abfragen, letzte-aktivitaet}
```

Der Beweis-Link auf der SPALTEN-Karte zeigt auf genau diese Dateien — dieselbe „Woher weißt du das?"-Mechanik wie bei Rechnungen. **Der Brain beweist seine eigene Hausarbeit.**

## 6. Negativ-Katalog

| Verbot | Grund |
|---|---|
| Struktur-Änderung ohne Karte/Unterschrift | der Garten gehört dir — Gärtner auf Zuruf |
| Auto-Deploy ohne Policy-Referenz im Commit | Rückverfolgbarkeit „warum liegt das hier" bricht |
| Stilles Umsortieren bei niedriger Konfidenz | fail closed gilt auch für Container |
| Cluster nur in-memory | jede Metrik, die einen Vorschlag begründet, muss committet sein |
| Merge mit Historien-Rewrite | Beweisketten der Einzelfälle sind unantastbar |
| Cloud-Training über Atoms | Self-Learning läuft lokal, Punkt |

## 7. Der Satz

*Der Brain ist der Gärtner: Er beobachtet, wie dein Wissen wächst, lernt aus deinen Korrekturen, und deployt jeden Inhalt dorthin, wo er nachweislich hingehört — aber Container entstehen, teilen sich und sterben nur durch deine Unterschrift.*
