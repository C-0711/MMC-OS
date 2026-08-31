# Spec 21: kontakte-v0.1 — Kontakte, Kontaktverwaltung, Container-Issuing

*Von: Hermes (Spec-/Live-Seite) · 31.08.2026 · Verbindlich für den Telefonbereich*

## Der eine Satz

**Jeder Kontakt ist ein Container: alles was ihr austauscht — Anrufe, Texte, Dateien — landet als fortlaufende Git-Historie in EINEM Verlauf beim Kontakt, und der Container entsteht automatisch beim ersten Wort (Issuing).**

## Datenmodell

Ein Kontakt = Git-Container im Vault (wie ein Fall, eigener Namensraum):

```
<vault>/kontakt-<slug>/
  docs/
    meta.json                      { slug, name, erstelltIso, kanäle: [] }
    comm-<ISO>-<typ>.<ext>         jede Kommunikation EIN Commit
      typ: anruf (Mitschrift-JSON) | text (JSON) | datei (beliebig, byte-identisch)
```

- **Issuing**: `findeOderIssue(absender)` — Kommunikation von unbekanntem Absender legt den Kontakt-Container automatisch an (kein Formularzwang, kein Verlust: der erste Anruf/Text ERZEUGT den Kontakt).
- **Historie**: `git log` = Chronologie; `kontaktHistorie(slug)` liefert Zeitstrahl-Einträge `{ zeit, typ, zusammenfassung, quelle }` gemischt (Anruf-Minuten, Text, Datei-Eingang).

## API (Main → IPC)

| Funktion | Bedeutung |
|---|---|
| `listKontakte()` | alle Kontakt-Container mit Meta + Aktivitätszahl |
| `createKontakt(name, slug?)` | Container anlegen (manuell) |
| `findeOderIssue(absender)` → slug | Issuing: findet oder ERZEUGT den Kontakt |
| `kontaktHistorie(slug)` | fortlaufender Verlauf (alle Typen, nach Zeit) |
| `commAnruf(slug, mitschrift)` | Mitschrift als Commit |
| `commText(slug, text)` | Text als Commit (Nachricht = Commit, Zitat = Referenz) |
| `commDatei(slug, datei)` | Datei-Eingang als Commit |

## Screens (OS-Sprache)

- **kontakte** (Liste): ruhige Karten — Serif-Name, Mono-Fußnote („3 Anrufe · 12 Texte · seit 2009"), Klick → Detail. Anlegen als Textlink („Wen suchst du?"), kein Formular-Zwang.
- **kontakt-detail**: fortlaufender Verlauf — jede Kommunikation eine Zeile mit Quellzeile (Minute, Zeitstempel, Dateiname), gemischt nach Zeit. Eingabe unten: Text senden → Commit. Neue Anrufe laufen über den bestehenden Anruf-Live-Pfad und committen beim Auflegen in den Kontakt-Container.
- Siegel-Menü: eigener Bereich **Kontakte** (zwischen Leute und Frag alles).

## Regeln (Negativ-Katalog gilt)

- Issuing NIE mit Rückfrage unterbrechen (Null-Fragen-Geist) — der Name aus der Kommunikation wird zum Kontaktnamen, änderbar später.
- Historie ist GEMISCHT (keine Tabs nach Typ — „Inhalt statt Verordnung").
- Jede Zeile zeigt ihre Quelle; nie rot; Serif 400.
