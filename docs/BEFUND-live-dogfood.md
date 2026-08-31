# BEFUND: Live-Dogfood durch DJ — drei Korrekturen mit Anleitung

*Von: Design-Session (Befunde von DJ am laufenden System, 31.08. abends) · Für: Bau-Session · Status: KORREKTUR-AUFTRAG · Evidenz: Screenshots „Guten Abend / 209 Beträge erkannt", „Wirf mir irgendetwas hin", „Das ist dein Siegel"*

---

## B1 — Das Wort „Siegel" versteht kein Mensch → **„Unterschrift"**

**Befund:** Onboarding sagt „Das ist dein Siegel. … Siegel prägen". DJ: „kein mensch versteht hier siegeln."

**Korrektur:** Das nutzer-sichtbare Wort wird **Unterschrift** — das eine Wort, das jeder Mensch aus dem Alltag kennt und das genau das Richtige verspricht (etwas gilt, weil DU es unterschrieben hast).

- Onboarding: **„Das ist deine Unterschrift."** · „Sie entsteht jetzt, auf diesem Gerät, und verlässt es nie. Alles, was du ablegst oder zusagst, trägt ab heute deine Unterschrift — deshalb glaubt man dir." · Knopf: **„Unterschrift anlegen"** (statt „Siegel prägen").
- Ehrlichkeits-Karte bleibt wortgleich, nur das Wort getauscht: „Verlierst du alle Geräte, kann dir niemand deine Unterschrift zurückgeben — auch wir nicht."
- Quellzeilen: `sig ✓` → **`unterschrift ✓`** (bzw. `✍ ✓` nirgends — Wort, kein Symbol).
- Rubrik/Startschirm-Kachel „Siegel" → **„Unterschrift"**; das OLIVGOLD-RUND als Sinnbild bleibt (die einzige volle Form) — es heißt nur anders.
- Technische Ebene (did:key, Signatur im Commit) bleibt unberührt — das ist Vokabular, kein Umbau.
- Falls „Unterschrift" irgendwo zu lang ist (Dock-Hover): „Deine Unterschrift" kürzt auf „Unterschrift", nie zurück auf Siegel.

Canvas-Folge: Die Design-Session zieht das Wort in den betroffenen Artboards nach, sobald dieser Befund bestätigt gemergt ist (ObSiegel/OsStartschirm/OsDock/OsIconSprache u. a.) — Bau bitte nicht auf die alten Artboard-Wörter pixelvergleichen, sondern auf diese Korrektur.

## B2 — Fremd-Ingest drängt sich vor: „Der erste Vorschlag ist keine Datei von mir"

**Befund:** Die Vordergrund-Karte „209 Beträge erkannt … passt das?" stammt aus `BU_DE-DE_2026-04_P3_ALL_Brennwerttechnik-KWK.pdf` — einem vom Agenten geholten Buderus-Katalog, nicht aus einem Dokument des Nutzers. Gleichzeitig ist DJs eigentliches Thema (Steuer) nicht vorn.

**Korrektur — Vorrang-Regel für Karten:**
1. **Nur Eigenes darf in den Vordergrund.** Eine Karte auf „Heute" entsteht ausschließlich aus Eingängen, die der NUTZER selbst geworfen hat (Drop, Scan, Foto, Mail-Weiterleitung) oder aus Gesprächen, in denen er war.
2. **Agent-/Connector-Ingest läuft IMMER über die Sanduhr:** still committen, still einsortieren, im Stapel-Zähler mitlaufen — nie eine Frage-Karte aus eigenem Antrieb.
3. **„Heute" folgt dem Nutzer, nicht dem letzten Ingest:** vorn bleibt das Thema, das der Nutzer zuletzt bewegt hat (hier: die Steuerthematik). Sortierschlüssel: letzte NUTZER-Interaktion pro Thema, nicht letzter Commit.

## B3 — Werkstoff ist kein Beleg: der Katalog bekommt die Sanduhr

**Befund:** Der hochgeladene Buderus-Katalog wurde wie ein Beleg behandelt — Beträge-Extraktion („209 Beträge erkannt: 0,20 · 52,90 · 0,24 — passt das?") über Katalog-Preislisten ist genau die sinnlose Frage, die das System nie stellen darf.

**Korrektur — Zwei Gattungen von Eingängen:**

| | **Beleg** (an dich gerichtet) | **Werkstoff/Referenz** (über die Welt) |
|---|---|---|
| Beispiele | Rechnung, Police, Bescheid, Vertrag, Brief | Katalog, Broschüre, PRD, Datenblatt, Handbuch |
| Heuristik | wenige Seiten · Adressat/Kundennr. erkennbar · ein Betrag „fällig" | viele Seiten · Preislisten/Tabellen in Serie · kein Adressat · Artikel-Nummern |
| Behandlung | Karten-Flow: eine Deutung, eine Frage, Fundstelle | **Sanduhr**: still committen + einbetten, NULL Fragen |
| Danach | „liegt oben auf" wenn fällig | abfragbar (Frag-mich/Quellen: „was kostet die GB192?"), taucht sonst nie auf |
| Unsicher? | — | im Zweifel Werkstoff + EINE leise Karte: „Katalog als Nachschlagewerk einsortiert — richtig?" (Ja/Beleg draus machen) |

Beträge-Extraktion mit „passt das?" ist für Werkstoff VERBOTEN — ein Katalog hat hunderte Beträge, und keiner davon ist eine Pflicht des Nutzers.

## DoD

1. Grep über Renderer-Strings: „Siegel/siegeln/prägen" = 0 nutzer-sichtbare Treffer; „Unterschrift" an allen Stellen aus B1.
2. Test: Agent-Ingest eines 200-Seiten-PDF mit 200+ Beträgen → KEINE Karte, Stapel-Zähler läuft; Nutzer-Drop einer 2-Seiten-Rechnung → genau EINE Karte mit Fundstelle.
3. Test: Klassifikator ordnet `BU_DE-DE_…Brennwerttechnik-KWK.pdf` als Werkstoff ein (Heuristik-Fixture); Rechnung-Fixture als Beleg.
4. „Heute" zeigt nach Agent-Ingest weiterhin das zuletzt vom Nutzer bewegte Thema vorn.
5. 53/53 (bzw. aktueller Stand) bleibt grün.

## B4 — Nachtrag (live): Frag-mich bricht ab

**Befund (wörtlich):** „Welche Buderus Produkte hast DU?" → `Error invoking remote method 'llm:fragMich': AbortError: This operation was aborted`.

**Diagnose-Hinweise:** `AbortError` ist in services.ts der 30-Sekunden-Timeout des vLLM-Aufrufs — nicht „Server aus" (das wäre ein Verbindungsfehler). Zwei wahrscheinliche Ursachen, beide prüfen:
1. **Env fehlt beim Start:** seit der Env-Hygiene ist `VLLM_URL` ohne `.env` ein localhost-Mock — App bitte mit geladener Env starten (`set -a; source .env; set +a; npm start`) bzw. die App lädt `.env` künftig selbst beim Start (dotenv im Main-Prozess, nur lesen, nie committen).
2. **Kontext-Flut durch B3:** die Frage traf den frisch ingestierten Katalog — hunderte Beträge-Atome als Fundstellen-Kontext können den 30s-Timeout reißen. Fix gehört zu B3: Werkstoff-Atome gehen gedeckelt in den Frag-mich-Kontext (Top-k, nicht alle), und der Kontext wird nach Token-Budget geschnitten.

**UI-Korrektur:** Ein technischer Fehler-String mit Methodennamen darf den Nutzer nie erreichen. Stattdessen eine ruhige Karte in OS-Sprache: **„Der Denker antwortet gerade nicht."** + Mono-Zeile `vllm · zeitüberschreitung nach 30 s · nochmal versuchen` — Rosé-Wort, kein Stacktrace, kein Alarm. (DoD-Punkt 6: Timeout-Fixture → diese Karte, kein Error-Toast.)
