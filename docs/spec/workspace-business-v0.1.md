# Workspace Business Version v0.1 — Planung

*Siebzehnte Spec im Verbund · B2B-Arbeitsfläche + System-Anbindung (Teamcenter, PIM, ERP, R&D) · Baut auf: enterprise-humans, team-raum, super-brain, technical-spec*

---

## 0. Der eine Satz

**Die Workspace ist der ruhige Raum für Rollen statt Personen: derselbe Kern (Vault, Karten, Beweis, Frag-mich), aber der Inhalt kommt nicht mehr nur vom Foto — er kommt aus Teamcenter, PIM, ERP und R&D, und jede Zahl weiß, aus welchem System, welcher Revision sie stammt.**

## 1. Positionierung: eine Codebasis, zweiGesichter

| | Privat (gitchain OS) | Business (Workspace) |
|---|---|---|
| Souverän | die Person | die Rolle + das Unternehmen |
| Eingänge | Foto, Mail, Anruf | System-Pulls (Teamcenter, ERP …) + Foto, Mail, Anruf |
| Freigabe | four-eyes (ich) | Multi-eyes (Freigabe-Kette, Rollen-Signaturen) |
| Agent | mein persönlicher | Rollen-Agent (Arbeitsprodukt des Unternehmens) |
| Tresor | mein Gerät + meine Cloud | Unternehmens-Tresor (On-Prem/EU-Cloud) + Capability je Rolle |

**Keine zweite App.** Die Workspace ist ein Modus desselben Systems: schaltet sich ein, wenn eine *Rollen-Capability* vorliegt („Erika agiert als PIM-Fachkraft für M-Nr 4711"). UI bleibt der ruhige Raum — Erikas Morgen beginnt mit drei Dingen, nur dass zwei davon vom Teamcenter-Konnector kommen.

## 2. Die Connector-Schicht (das Herzstück)

### 2.1 Prinzip: Connector-Anchoring

Jeder Systemzugriff wird zu einer **zitierbaren Fundstelle** — die B2B-Erweiterung des Beweis-Rechtecks (beim Verbraucher: PDF-Rechteck; hier: Systemzelle mit Revision):

```json
{
  "typ": "connector-quelle",
  "system": "teamcenter",
  "objekt": "MNR-4711",
  "revision": "C",
  "attributpfad": "ItemRevision.wanddicke",
  "abgerufen": "2026-08-30T09:41:12Z",
  "endpoint": "https://tc.internal/api/v9/…",
  "abgerufen-durch": "rolle:pim-team"
}
```

**Die Regel:** Kein Attribut aus einem System ohne Connector-Fundstelle. Ein Wert ohne Herkunfts-Commit ist Meinung, kein Fakt — dieselbe Grammatik wie überall.

### 2.2 Der Konnektor-Lebenszyklus

```
QUELLE (Teamcenter/ERP/PIM/R&D via API)
  ↓ 1. PULL: Konnektor holt Objekt + Metadaten (Schedule oder Trigger)
  ↓ 2. COMMIT VOR DEUTUNG: Objekt byte-identisch in den Fall-Container (docs/systeme/<system>/<objekt>-rev-C/)
  ↓ 3. DIFF: was hat sich seit letztem Pull geändert? (Atom-Diff mit zwei Fundstellen)
  ↓ 4. DEUTUNG: Rollen-Agent liest Änderung gegen Erwartungs-Schema
  ↓ 5. KARTE bei Abweichung: „Zeichnung v3: 2 Attribute widersprechen Datenblatt"
```

Dabei greift der Super-Brain: gelernte Policies entscheiden, welche Systemobjekte in welche Fall-Container deployt werden (Deploy-Commit mit Connector-Fundstelle + Policy-Version — bereits in der Referenz-Instanz bewiesen).

### 2.3 Konnektor-Katalog (Referenz-Integrationen)

| Konnektor | Holt | Besonderheit |
|---|---|---|
| **Teamcenter/PLM** | Items, Revisionen, Zeichnungen (PDF/STEP), Freigabe-Statusen | Revision ist die Fundstellen-Achse; Änderungsanträge (ECO/ECN) werden zu Vorschlags-Ketten |
| **ERP (SAP-Klasse)** | Materialstamm, Stücklisten, Bestellungen, Belege | Belege → derselbe Ingester-Pfad wie Privat (OCR + Schema) |
| **PIM/MDM** | Attribute, Klassifikationen, Übersetzungen | Attribut-Widerspruch PRÜFUNG: PIM-Wert vs. Teamcenter-Wert → Diff-Karte |
| **R&D-Systeme** | Versuchsdaten, Simulationen, Normen-Dokumente | Deutungen aus Versuchsdaten = Atoms mit Fundstelle in der Versuchsdatei |
| **DMS/Sharepoint-Klasse** | Verträge, Bescheide | Migration übernommener Dokumente in Fall-Container |
| **Mail/Calendar (Business)** | geschäftliche Post | wie Privat, aber Rollen-Eingang statt Personen-Eingang |

### 2.4 Widerspruchs-Engine (der Killer-Nutzen)

Die Query, die kein System der Welt beantwortet — jetzt automatisch:

> *„Diese 2,3 mm Wanddicke — PIM sagt 2,3, Teamcenter Rev C sagt 2,1. Welche gilt, wer hat wann was geändert, und welche Freigabe war aktiv?"*

Technisch: regelmäßiger Attribut-Abgleich quer über Konnektoren; jeder Widerspruch erzeugt einen Diff-Atom mit BEIDEN Fundstellen → Karte an die zuständige Rolle → Multi-eyes-Auflösung → signierte Fassung, die künftig als „gültig" gilt, bis ein System sie wieder widerspricht.

## 3. Der Workspace-Tisch (Team-Raum im Business-Modus)

Der Tisch (team-raum-v0.1.md) bekommt Business-Fassungen der vier Zonen:

| Zone | Privat | Business |
|---|---|---|
| **Tisch** | „was gilt jetzt" | + Freigabe-Ketten-Status („2/3 signiert, QM ausstehend") |
| **Strom** | Verlauf als Erzählung | + System-Ereignisse als Erzählung („Teamcenter Rev D kam um 09:41 — 4 Attribute geändert") |
| **Arbeit** | offene Sachen | + Rollen-Queues mit SLA/Sichtbarkeit der Vertretung |
| **Akte** | Originale + Beweise | + Connector-Fundstellen je Attribut, System-Diffs, signierte Fassungen |

## 4. Rollen- und Identitäts-Modell

- **Login:** Unternehmens-SSO (SAML/OIDC) *nur für Authentifizierung* — die Fach-Autorisierung läuft über did:key-Capabilities (Technik existiert schon: Device-Login + PAT-Verwahrung im aktuellen Backend).
- **Rollen-Agenten:** Agenten-Container pro Rolle (Memories = Arbeitsprodukt, bleiben bei Ausscheiden). Skills ggf. vom Systembetreiber signiert und versioniert — jede Deutung referenziert ihre Skill-Version (ISO-Audit-tauglich).
- **Vertretung:** Capability-Transfer befristet (Urlaub, Rollenwechsel) — kein Admin-Tooling.

## 5. Deployment-Optionen (abhängig von Souveränitätsgrad)

| Variante | Ort | Für wen |
|---|---|---|
| **On-Prem** | eigener Server/Cluster (wie dein K8s) | Konzerne (Datenschutz maximal) |
| **Sovereign Cloud** | EU-Betreiber nach Tresor-Konvention (nur Chiffre) | Mittelstand ohne eigenes RZ |
| **Hybrid** | Vault on-prem, Brain/Eingang in EU-Cloud | Übergang |

Die Workspace-App verbindet sich wie ein weiterer Klon — kein zentraler App-Server im Pfad.

## 6. Roadmap (aufbauend auf Bestehendem)

| Etappe | Inhalt | Vorhandene Basis |
|---|---|---|
| **W1** | Connector-Gerüst: Pull-Scheduler + Connector-Fundstellen-Format + Ein-System-Anbindung (Teamcenter oder ERP) | Referenz-Instanz v0.3 (Deploy-Commit-Mechanik steht) |
| **W2** | Diff-Engine + Widerspruchs-Karten (2 Systeme kreuzgeprüft) | Beweis-Viewer (bbox) + Karten-Queue |
| **W3** | Rollen-Modus: Rollen-Capability schaltet Workspace-Gesicht; Multi-eyes-Freigaben | Enterprise-Spec §3 (nur Spez) |
| **W4** | Tisch-Business: Freigabe-Ketten im Team-Raum, System-Ereignisse im Strom | Team-Raum-Spec |
| **W5** | SSO-Bridge + On-Prem-Deployment (Helm/K8s wie dein Verbund) | Device-Login im Backend |

**Meilenstein „Workspace Preview":** W1–W2 — dann kann man live zeigen: Teamcenter-Pull landet als committeter Eingang, ein Widerspruch wird Karte mit zwei Fundstellen, eine Rolle bestätigt, die Fassung ist signiert. *Das* ist die Bosch-Demo.

## 7. Negativ-Katalog

| Verbot | Grund |
|---|---|
| Attribut aus System ohne Connector-Fundstelle | Meinung, kein Fakt |
| System-Pull ohne Commit (nur in-memory vergleichen) | Commit vor Deutung gilt auch für APIs |
| Workspace als separate App/Fork | eine Codebasis, Rollen-Modus — sonst Gabelung des Windows of Truth |
| SSO für Fach-Autorisierung missbrauchen | Auth ≠ Capability (Login identifiziert, Capability autorisiert) |
| Schreibzugriff des Konnektors auf Quellsysteme (außer dokumentierten Write-Backs) | Connectors lesen + beweisen; Änderungen laufen über Freigaben im Menschen-Pfad |
| Personen-Memories in Rollen-Containern | Ausscheiden = Datenabfluss |

## 8. Der Satz

*Die Workspace ist derselbe ruhige Raum — aber Erika sieht morgens drei Dinge, die aus Teamcenter, ERP und einem Widerspruch kommen, bestätigt mit einem Tap, und die signierte Fassung ihrer Entscheidung gilt ab dann als bewiesene Wahrheit in jedem angeschlossenen System.*
