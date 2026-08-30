# gitchain OS — Spezifikations-Verbund

*Status: v0.1-Entwürfe · Arbeitskopie im Workspace*

## Lesereihenfolge

1. **`supercontainer-v0.1.md`** — Der Brain: Föderation über Fall-Containern, harte Grenze (nie Inhalte, nur refs + quantisierter Index), retrieve-then-resolve, deterministischer Rebuild, Löschen als Rebuild-Ereignis.
2. **`agent-containers-v0.1.md`** — Git for agent memory: Memories (mit Pflicht-Quelle `learned_from`), Skills (signiert, versioniert, Load fail closed), Policy-Spiegel, `may_write: branch-only`. Kernsatz: *Vergessen ist ein Commit, nicht eine Bitte.*
3. **`interaction-voice-screen-v0.1.md`** — Voice + simple Screens: drei Screen-Formen (Karte/Liste max. 3/Beweis-Rechteck), Wortgleichheit Screen↔Stimme, Voice-Commit nur mit sichtbarem Anker, Stimme nie alleinige Authentifizierung.
4. **`ingress-flow-v0.1.md`** — Der Eingang: Commit vor Deutung, dreispurige Entscheidung (auto/Vorschlag/Zweifel) nach Konfidenz × Risiko-Klasse (R0–R3), Schwellen-Policy als editierbare Preference, max. 3 offene Dinge/Tag.
5. **`massen-ingest-v0.1.md`** — Die Masse: Millionen Seiten lesen, embedden (Matryoshka-Kaskade 768→128-d, lokal), normalisieren, in Container bringen (Unternehmen nach Produkt, Mensch nach Thema); Beweis-Basis < 1 s; Dialog-Anreicherung als Commits — aus Ordner-Bergen der mächtigste Kontext.
6. **`buerger-assistent-v0.1.md`** — Der eigene Assistent des Durchschnittsbürgers: drei Umsetzungs-Wellen („es funktioniert / es gehört mir / es managt mich"), der Bürger immer im Loop (Eingehen-Gefragt Werden-Zustimmen), Takeout-Importer, Phone=Tresor+Zeuge, Capability-Partizipation — sein Container, sein Kontext, souverän.

## Begriffs-Glossar (die vier Worte)

| Begriff | Bedeutung | Beweist |
|---|---|---|
| **Eingang** | `{Absender, Zeitpunkt, Nutzlast}` — jede Quelle ist dasselbe Ding; committet vor jeder Deutung (docs/, byte-identisch) | dass etwas kam, wann, von wem |
| **Deutung** | Atom mit Fundstelle (Datei + Seite + Rechteck); Agent schreibt nur Branches, nie main | was es bedeutet — und woher wir wissen |
| **Fall** | ein Git-Repo = ein Mandant/Thema; Kapsel, kein Filter | wohin es gehört |
| **Schlüssel** | did:key + Capability + Signatur | wer sehen/ändern darf |

Dazu drei Behälter-Typen: **Fall-Container** (Welt des Nutzers), **Funktionscontainer** (zustandslose Reaktoren), **Agenten-Container** (Memories & Skills der KI). Der **Supercontainer (Brain)** föderiert — alle leben im **Safe Network** (Klon-Inhaber + Capabilities, keine zentrale Instanz).

## Der eine Satz

**gitchain ist die Source of Truth: Die KI lernt alles vom Nutzer, weiß alles vom Nutzer, managt alles für ihn — auf gitchain OS und iOS. Wir sind ein Betriebssystem.**

## Offene Punkte

- [ ] Vorschlags-Format (JSON-Schema für proposals/ inkl. Frist-Ableitung) — teils in `interaction-voice-screen` §6 vorbereitet
- [ ] Recovery/Erbschafts-Spezifikation (Schlüsselverlust, Notar-Pfad)
- [ ] Tresor-Konvention (Cloud-Betreiber-Anforderungen: Chiffre-only, Attest, Exit)
- [ ] Export-Kompatibilitäts-Layer (Container → WISO/DATEV/Lexware-Belegordner + Beweis-Beilage)
- [ ] Takeout-Importer (MBOX/PST/ICS → Container-Pipeline)
- [ ] Governance-Modell (Stiftung vs. GmbH, wer entscheidet über OCP)
