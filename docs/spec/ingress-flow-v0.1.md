# Eingangs-Fluss-Spezifikation v0.1 (Ingress Flow)

*Status: Entwurf · Vierte Spec im Verbund (nach `supercontainer`, `agent-containers`, `interaction-voice-screen`) · Gilt für: gitchain OS, ocr.0711.io-Pipeline*

---

## 0. Der eine Satz

**Jeder Eingang ist dasselbe Ding — `{Absender, Zeitpunkt, Nutzlast}` — wird committet, bevor gedeutet wird, und endet in genau einem von drei Zuständen: erledigt (unsichtbar), Vorschlag (eine Karte), Zweifel (offen sichtbar).**

## 1. Nutzer-Sicht: drei Zustände, kein Posteingang

| Zustand | Sichtbar? | Bedeutung |
|---|---|---|
| **① Erledigt** | nein | Routine ist gelaufen (Audit-Commit vorhanden). Still = erledigt. |
| **② Vorschlag** | eine Karte | braucht four-eyes: Entscheidung des Nutzers. |
| **③ Zweifel** | „ungeklärt"-Karte | Deutung nicht prüfbar → fließt NICHT in Fälle (fail closed). Sichtbar, nie versteckt. |

Maximal **3 offene Dinge pro Tag** (Listen-Regel der Interaktions-Spec). Es gibt keinen Ort, an dem etwas „liegt, das noch jemand durchsehen muss" — der unsortierte Haufen ist strukturell unmöglich, weil die Sortierlast in der Maschine liegt.

Der Nutzer kehrt zur Quelle zurück über Beweis-Rechtecke (`fall, doc, page, commit, sig ✓`) oder über die gestrichelten Apps (Abfragen mit Darstellung). Er muss nie wissen, in welchem Behälter etwas liegt.

## 2. Phase 0 — Eingang (mechanisch)

```
QUELLE          TRANSPORT              EINGANGS-BLOB (committet VOR jeder Deutung)
Mail            IMAP-Pull (lokal)  →   docs/eingang/<datum>/mail-<n>.eml
Nachricht       Bridge (verschl.)  →   .../msg-<n>.json
Foto            Kamera/Import      →   Blob-Store (hash) + Pointer
Anruf           lokale Mitschrift →   .../call-<n>.txt
Datei           Drop/Folder-Watch →   .../scan-<n>.pdf
```

Regeln:
- **Commit vor Deutung.** Das Original ist byte-identisch gesichert, bevor irgendetwas es interpretiert.
- **Kein Eingang geht verloren**, weil kein App-Container dazwischen liegt.
- Transport ist lokal oder Ende-zu-Ende-verschlüsselt; STT/OCR on-device (ocr.0711.io).

## 3. Phase 1 — Deutung (Agent liest)

Agenten-Skills (Beleg-Erkennung, Fristen-Extraktion, Korrespondenz-Deutung) mit versionierter, signierter Skill-Fassung:
1. **Lesen** — OCR/Parser → Atoms mit Fundstelle (Datei + Seite + Rechteck)
2. **Einordnen** — retrieve-then-resolve über den Brain (nur Adressen; Resolve im Fall mit Capability-Check)
3. **Handlung ableiten** — Frist? Duplette? Vertragsrelevant? Antwort nötig?

Der Agent schreibt **nie auf main** — jede Deutung ist ein Branch-Vorschlag im Ziel-Fall.

## 4. Phase 2 — Entscheidung (dreispurig)

```
        ┌───────────────────┬────────────────────┐
        ▼                   ▼                    ▼
  AUTO-COMMIT           VORSCHLAG             ZWEIFEL
  Konfidenz ≥ Schwelle  0.5 ≤ K < Schwelle    K < 0.5 / Regelverstoß
  UND risikoarm         ODER risikoträchtig   → fail closed
        │                   │                    │
  still, Audit-Commit   Karte (②)            „ungeklärt" (③)
```

Die Schwelle ist eine **Policy, kein Zufall** — siehe `threshold-policy` unten. Risikoarme, umkehrbare Routinen macht die KI selbst (mit Audit-Commit); alles mit Geld/Abgabe/Vertrag/Unwiderruflichkeit wird immer ein Vorschlag; Unklares bleibt offen sichtbar liegen.

## 5. Phase 3 — Dialog (falls Vorschlag)

Standard-Zyklus aus `interaction-voice-screen-v0.1.md`: Stimme stellt Frage wortgleich zum Screen, Screen zeigt Beweis-Anker, ein Wort oder ein Tap bestätigt, Commit mit Signatur und Fundstelle. Beispiel Duplette: Karte mit beiden Beweis-Rechtecken, „ja, die alte passt" → Verwerfungs-Commit im Fall + Memory-Commit („Bei Rechnungen gilt Erst-Eingang") im Agenten-Container.

## 6. Phase 4 — Ablage

Merge in den Fall → Frist-Atoms mit Quelle → ggf. Funktionscontainer-Trigger (USt-Rechner registriert Beleg für Q3) → Brain-Re-Index (Cache-Rebuild, diffbar, `reason: reindex`) → Ruhe.

## 7. Schwellen-Policy (editierbare Tabelle — eine Preference im Agenten-Container)

Die Grenze auto/vorschlag ergibt sich aus **zwei Achsen**: Deutungs-Konfidenz (K) und Aktions-Risiko-Klasse (R).

| Risiko-Klasse | Beispiele | K ≥ 0.95 | 0.7–0.95 | < 0.7 |
|---|---|---|---|---|
| **R0 harmlos, umkehrbar** | Newsletter archivieren, Foto zuordnen, Metadaten | **auto** | auto | Vorschlag |
| **R1 fallbildend** | Beleg neu anlegen, Frist-Atom setzen, Duplette verwerfen | **auto** + Audit | Vorschlag | Zweifel |
| **R2 geld-/abgabe-/vertragsnah** | USt-Voranmeldung, Buchung vorbereiten, Antwort senden | **Vorschlag** (immer) | Vorschlag | Zweifel |
| **R3 unwiderruflich / main** | Abgabe an Finanzamt, Zahlung, Vertragsschluss | **Vorschlag + Geräte-Entsperre** (immer, ungeachtet K) | Vorschlag + Entsperre | Zweifel |

Regeln:
- **R3 kennt kein Auto.** Unwiderrufliches wird immer vom Menschen bestätigt (four-eyes) — und verlangt die Geräte-Entsperrung am Confirm-Moment (Interaktions-Spec §4).
- **Die Tabelle ist eine Preference** (`agent-*/memories/preferences/decision-thresholds.json`): der Nutzer kann sie verschieben („macht mehr selbst" = K-Grenzen senken; „frag mich öfter" = anheben). Änderungen sind Memory-Commits — diffbar, revertierbar.
- **Sichtbarkeit ist Preis der Autonomie:** jede Auto-Zelle erzeugt einen Audit-Commit mit Fundstelle; der Nutzer kann jede automatisierte Entscheidung nachträglich einsehen und reverten (`git revert` auf den Fall-Branch).
- **Zweifel stapeln sich nicht unbegrenzt:** ≥ 10 „ungeklärrt"-Karten lösen eine Meta-Rückfrage aus („Ich verstehe 12 Belege nicht — sollen wir gemeinsam 5 Minuten drübergehen?"), sonst kehrt der Haufen durch die Hintertür zurück.

## 8. Gesamtfluss in einem Bild

```
NUTZER-SICHT                     KI-SICHT
(schweigt/lebt)    ←Stille→      ① Eingang committen (mechanisch, vor Deutung)
                                   ② Deuten (Skills versioniert, Fundstellen)
                                   ③ Dreispurig: auto | vorschlag | zweifel
„3 Dinge heute"     ←Screen→      ④ Karte/Liste (max. 3) + Beweis
„ja / Nummer 2"     ←Voice→       ⑤ Commit (signiert, mit Fundstelle)
(er sieht nichts    ←Stille→     ⑥ Merge, Re-Index, Memory-Lernen
 mehr davon)                      ⑦ nächster Eingang / Ruhe
```

## 9. Negativ-Katalog (für Review)

| Verbot | Grund |
|---|---|
| Deutung vor Commit des Originals | Original muss byte-identisch stehen, sonst keine Beweisbasis |
| Unklares still einordnen | fail closed: Zweifel muss sichtbar sein, sonst heimlicher Haufen |
| Mehr als 3 offene Karten | kognitive Überlastung kehrt zurück |
| R3 ohne Vorschlag + Entsperre | unwiderruflich ohne four-eyes |
| Auto-Aktion ohne Audit-Commit | Autonomie ohne Nachvollziehbarkeit = Vertrauensbruch |
| Unbegrenzte Zweifel-Stapel | Meta-Rückfrage erzwingen, sonst Haufen durch Hintertür |

## 10. Die zwei Sätze

- **Nutzer:** *Ich habe keinen Posteingang mehr. Ich habe drei Dinge am Tag — und alles andere ist bereits erledigt, beweisbar, auffindbar.*
- **KI:** *Jeder Eingang ist dasselbe Ding. Ich deute, ich schlage vor, ich commite nie ohne Anker — und was ich nicht sicher weiß, lasse ich offen liegen, statt es zu verstecken.*
