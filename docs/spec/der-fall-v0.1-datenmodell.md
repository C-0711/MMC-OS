# Spec 22: der-fall-v0.1 — Der Fall als Chat: Datenmodell (Schritt 1 nach AUFTRAG §9)

*Verbindlich für strom.test.ts + privat.test.ts (DoD 1/3). Baut auf AUFTRAG-der-fall.md §2.*

## Der eine Satz

**Der Fall bekommt einen geteilten Strom als Branch `strom` (jede Zeile ein Commit) und eine private Spur als lokalen Ref `refs/privat/<did>`, den der Sync nie verlässt — der Grep-Test beweist es.**

## Datenmodell (Vertrag)

```
fall/<id>/
├── strom/            # Arbeitsverzeichnis des Branches 'strom' (per-Datei-Commits)
├── .gitchain/zustellung.json
└── refs/privat/<did>/  — als Git-Ref, KEIN Verzeichnis im Working Tree
```

- **Geteilter Strom = Branch `strom`** im Fall-Repo. `stromEintrag(fallId, eintrag)` committet eine chronologische Datei `strom/NNNN-<slug>.<ext>`. Sync später über die Registry (T15–T17-Pfad) — dieser Schritt nur lokal.
- **Privat = Ref `refs/privat/<did>`** — Commits NUR auf dem Ref, Working Tree bleibt sauber (kein Checkout). Sync-Whitelist: NUR `strom` (fetchspec).
- **Teilen = cherry-pick** vom Privat-Ref auf `strom`, mit Teilungs-Zeitpunkt im Commit-Body.

## API (Main, `fall-strom.ts`)

```typescript
stromEintrag(fallId, { typ: 'text'|'wurf'|'anruf'|'arbeit'|'qa'|'vorschlag'|'ding',
                       inhalt, payload? })  → { nummer, sha }
listeStrom(fallId)                          → StromEintrag[] (chronologisch)
privatEintrag(did, fallId, { art: 'suche'|'frage', inhalt })  → { sha }
listePrivat(did, fallId)                    → PrivatEintrag[]
teilePrivat(did, fallId, sha)               → cherry-pick auf strom → { nummer, sha, geteiltIso }
syncWhitelist(fallId)                        → ['strom']   // der fetchspec-Vertrag
```

## DoD für diesen Schritt (aus AUFTRAG §7.1/7.3, als Tests)

1. `strom.test.ts`: Commit-pro-Eintrag, chronologische Nummerierung, Formen-Mapping (typ → Dateiendung/Struktur).
2. `privat.test.ts`: (a) private Commits existieren NUR auf dem Ref, nicht im `strom`-Branch, nicht in `main`; (b) nach `syncWhitelist`-Sync-Simulation bleibt `refs/privat` unberührt; (c) **Grep-Test**: 3 private Suchen → `git rev-list --all` + cat-file + grep = 0 Treffer; (d) teilePrivat einer → genau diese eine auf `strom` mit Teilungs-Zeitpunkt.
