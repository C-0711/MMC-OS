# Supercontainer-Spezifikation v0.1 — „Der Brain"

*Status: Entwurf · Gilt für: gitchain OS (Desktop/Mobile), gitchain-lite, ocr.0711.io-Eingangspipeline*

---

## 0. Der eine Satz

**Der Supercontainer (Brain) ist ein Föderations- und Index-Objekt über eigenständigen Fall-Containern. Er enthält niemals deren Inhalte.**

## 1. Rollen und Begriffe

| Objekt | Definition | Besitz |
|---|---|---|
| **Fall-Container** | ein Git-Repo = ein Fall/Mandant. Enthält `docs/` (Original, byte-identisch), `atoms` (Deutungen mit Fundstelle), eigene Signatur, eigene Historie | Fall-Inhaber; vollständige Kopie bei jedem Klon |
| **Supercontainer (Brain)** | ein Git-Repo, das *Verweise und Indizes* hält — nie Fallinhalte | Nutzer; klonbar wie jeder Baum |
| **Funktionscontainer** | kleines Repo mit einer Fähigkeit (USt-Rechner, Fristen-Wächter, Beleg-Prüfer) — Code + Regeln, keine Stammdaten | auslieferbar, versioniert, austauschbar |
| **Agenten-Container** | Memories + Skills + Policy eines Agenten — das Innere der KI als Baum (siehe Spec `agent-containers-v0.1.md`) | Nutzer (seine KI, seine Regeln) |
| **Safe Network** | Gesamtheit der Klon-Inhaber + ihre Capabilities | keine zentrale Instanz |

## 2. Die harte Grenze: was im Brain liegt — und was nie

```
supercontainer/
├── brain.json                  ① Manifest: Version, Modell-Hash, Rebuild-Regel
├── refs/                       ② Verweise auf Fall-Container
│   ├── steuern-2026    → sha256:<root> + capability-ref + Sig
│   └── haus-bauträger  → sha256:<root> …
├── .brain/                     ③ der QUER-Index (TurboQuant + PolarQuant)
│   ├── vectors_tq.npz            quantisierte Embeddings ÜBER ALLE Fälle
│   ├── bm25.npz                   lexikalisches Zwillings-Index
│   └── map.json                   atom-Id → (Fall, Fundstelle) — AUFLÖSUNG, kein Text
├── proposals/                  ④ offene KI-Vorschläge (je Branch im Fall, hier nur Ref)
└── .plugins/                   ⑤ Partner-Apps, je Namensraum
```

**Niemals im Brain:**
- ❌ Original-Blobs (`docs/`-Inhalte) — sie bleiben im Fall
- ❌ Atom-Texte — der Brain hält nur `map.json`-Verweise (Atom-Id → Fall + Fundstelle)
- ❌ Klartext-Rechte — Rechte leben als Capabilities in den Fällen
- ❌ Anything als einzige Kopie

**Der Prüfsatz (für jedes Design-Review):** *Kann ich den Brain löschen und alles aus den Fällen neu bauen?* Wenn ja: zulässig. Wenn nein: verletzt das Modell.

## 3. Retrieve-then-Resolve (die einzigen zwei Operationen)

```
1. SEARCH  (im Brain):   Frage → top-k über vectors_tq/bm25
                         → Ergebnis: [(fall, atom-id, fundstelle)] — nur Adressen
2. RESOLVE (im Fall):    für jede Adresse: Klon des Falls prüfen
                         → Capability prüfen (fail closed)
                         → Atom + Original-Ausschnitt aus dem FALL holen
```

**Regel:** Der Brain findet, der Fall beweist. Eine Antwort, die nur aus dem Brain kommt (kein Resolve im Fall), ist **ungeprüft** — fail closed, nie main-würdig.

## 4. Rebuild-Regel (GIT RULE für den Brain)

- `brain.json` hält: Embedding-Modell-Id + Hash, Quantisierer (PolarQuant b, QJL-Seed), Fassung jedes Fall-Roots, Rebuild-Skript-Hash.
- **Rebuild ist deterministisch** (PolarQuant-Garantie): gleiche Fälle + gleiche Modellversion ⇒ byte-identischer Brain — auditierbar durch jeden Dritten.
- **Commit-Pflicht:** was in eine Antwort/Deutung eingeflossen ist, wird im Fall committet (das Retrieval-*Ergebnis* mit Fundstellen). Die Index-Dateien sind Cache — committet, aber neu baubar; ein Re-Index-Ereignis ist ein Brain-Commit mit `reason: reindex`, diffbar.
- **Brain-Klone sind gleichwertig.** Phone hält einen Klon (µs-Suche, MB-größe dank TurboQuant), Mac baut neu, Cloud spiegelt Chiffre.

## 5. Föderations-Regeln (Kapsel bleibt Kapsel)

1. **Kein Merge von Fällen.** Der Brain kennt Fälle nur über `refs/`. Ein Atom gehört genau einem Fall; Quer-Verweise sind Referenzen (`fall-a:atom-42`), keine Kopien.
2. **Capability gilt pro Fall.** Der Brain filtert Suchergebnisse *vor* der Anzeige nach Capability (fail closed: zweifelhaft = unsichtbar).
3. **Revocation erreicht den Brain über pull-on-push** — derselbe Kanal wie die Fälle.
4. **Löschbarkeit:** Fall aus `refs/` entfernen + Rebuild ohne den Fall ⇒ fort aus jeder zukünftigen Suche. Vergessen ist ein Rebuild-Ereignis, im Brain-Commit dokumentiert (DSGVO-Pfad).

## 6. Funktionscontainer und Plugins

- Funktionscontainer sind **zustandslose Reaktoren**: erhalten (per Capability) aufgelöste Atoms, rechnen, geben einen **Vorschlag** zurück (kein Schreibzugriff auf main).
- Vorschläge landen als Branch im Ziel-Fall — four-eyes: die Bestätigung des Nutzers macht den Merge.
- `.plugins/<partner>/` ist additiv, eigener Namensraum, darf nie in `refs/` oder `.brain/` schreiben — nur lesen (per Capability) und Vorschläge in Fälle stellen.

## 7. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Fallinhalte in den Brain kopieren | zerstört Kapsel + Löschbarkeit |
| Suche, die ohne Capability prüft | Filter-in-geteilte-Tabelle-Syndrom |
| Brain als einzige Kopie irgendetwas | jede Wahrheit lebt im Fall |
| Antwort ohne Resolve im Fall | fail closed: ungeprüft |
| Plugin mit Schreibzugriff auf main | four-eyes bricht |

## 8. Agenten-Container

Siehe eigene Spezifikation `agent-containers-v0.1.md`. Der Brain kann Agenten-Memories mit-indexieren — dieselbe retrieve-then-resolve-Regel: Memory-Fundstelle zeigt auf den Ursprungs-Commit im Agenten-Container und, wo der Agent ein Fakt gelernt hat, zusätzlich auf den Fall.
