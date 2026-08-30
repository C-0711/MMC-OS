# SSO & Rechtekonzept v0.1 — Anmeldung und Autorisierung

*Neunzehnte Spec im Verbund · Google-/GitHub-SSO + did:key-Capabilities · Baut auf: enterprise-humans §4, technical-spec §2.5, workspace-business*

---

## 0. Der eine Satz

**SSO beantwortet „Wer bist du?" — die Capability beantwortet „Was darfst du?" — und nur letzteres entscheidet über Daten, niemals ersteres.**

## 1. Das Prinzip: Die doppelte Identität

```
┌────────────────────────────────────────────────────────┐
│  EBENE 1: ANMELDUNG (Authentifizierung)                 │
│  Google · GitHub · Microsoft-SSO · Passkey · Passwort    │
│  → liefert: eine BEHAUPTUNG „ich bin Erika"            │
├────────────────────────────────────────────────────────┤
│  EBENE 2: IDENTITÄT (gitchain-intern)                   │
│  did:key — der Schlüssel, der alles signiert            │
│  → die Behauptung wird beim ERSTEN Login einer did:key  │
│    ZUGEORDNET — danach ist der US-Provider austauschbar │
├────────────────────────────────────────────────────────┤
│  EBENE 3: RECHTE (Autorisierung)                        │
│  Capabilities: signiert, widerrufbar, fallbezogen       │
│  → entscheidet ALLES über Datenzugriff                 │
└────────────────────────────────────────────────────────┘
```

**Warum das die Spannung auflöst:** Google-Login ist ein *Schlüsseldienst*, kein *Rechte-System*. Der US-Provider sieht, dass sich jemand anmeldet — aber nie, auf welche Fälle, welche Container, welche Daten die Person Zugriff hat. Die Souveränitäts-Substanz (Fälle, Atoms, Capabilities, Vault) bleibt vollständig auf gitchain-Seite. Und: **die Verheiratung ist einmalig** — wer morgen den Google-Account löscht, verliert nichts als die Anmelde-Bequemlichkeit, nicht die Identität (Recovery über did:key bleibt).

## 2. Architektur: Keycloak als Broker im eigenen Haus

```
NUTZER ──anmelden──► KEYCLOAK (self-hosted, im K8s-Verbund)
                      │  Identity-Brokering:
                      ├─ Google (OIDC)
                      ├─ GitHub (OIDC/OAuth2)
                      ├─ Unternehmens-AD/SAML (Business)
                      └─ Passkey/Passwort (fallback, souverän)
                      │
                      ▼  OIDC-Token (signiert VON KEYCLOAK, nicht von Google)
                     gitchain-Gateway
                      │  Token → Zuordnung → did:key-Sitzung
                      ▼
                   VAULT (Capability-Check entscheidet, fail closed)
```

- **Keycloak ist selbst gehostet** (Red Hat Open Source, im eigenen K8s-Verbund wie dein `:3361`) — Google/GitHub sind nur *vorgelagerte Identity-Provider*, dieKeycloak einbindet (Identity Brokering). Die Tokens, die gitchain akzeptiert, stammen von Keycloak — nicht von Google.
- **Bestehende Basis andocken:** Das Backend hat bereits Device-Login + PAT-Verwahrung. Der Schlüssel-Moment bleibt derselbe: aus dem SSO-Login wird **einmalig** eine did:key-Zuordnung, danach lebt die Fach-Identität auf gitchain.
- **Pflicht-Alternative:** Passkey/Passwort-Login bleibt immer verfügbar (Null-US-Pfad). SSO ist Komfort, nie Zwang — sonst wäre der Onboarding-Satz („kein Konto, keine AGB-Wand") gebrochen.

## 3. Das Rechtekonzept (die Capability-Hierarchie)

### 3.1 Die vier Rechtetypen

| Recht | Format | Beispiel |
|---|---|---|
| **Fall-Recht** | Capability auf einen Container | „Erika darf steuern-2026 lesen+deutungs-vorschlagen" |
| **Operations-Recht** | innerhalb des Falls | `search`, `get-atom`, `propose`, `confirm` (Rollen) |
| **Rollen-Recht** | Enterprise: Rolle statt Person | „wer auch immer PIM-Team vertritt, darf M-Nr 4711 bestätigen" |
| **Admin-Recht** | auf Struktur, nicht Inhalt | Fall anlegen/löschen, Capabilities ausstellen/entziehen — NIE Inhalts-Lesen |

**Strikt getrennt:** Admin-Rechte beinhalten keine Leserechte (ein Daten-Steward sieht, *dass* Fälle existieren, nie *was* in ihnen steht). Das ist die Kapsel-Regel in Rechteform.

### 3.2 Rechtevergabe: Einladung ist Capability (wie überall)

```
1. AUSSTELLEN:  Inhaber signiert Capability {grantee-did, container, scope, expires}
2. PRÜFEN:      vor JEDEM Zugriff (fail closed): Signatur + Ablauf + Revocation-Commit
3. ÜBERTRAGEN:  Capability ist selbst ein committetes Objekt — klonbar, weitergebbar
                (innerhalb des erteilten Rahmens; Delegation braucht explizites Recht)
4. ENTSIEHELEN: Revocation-Commit im Baum, Verteilung über pull-on-push
5. BEFRISTEN:   expires ist Pflichtfeld — nichts gilt ewig ungeprüft
```

### 3.3 Rollen im Business (Kurzfassung der enterprise-humans-Spec)

- Rolle = Capability-Inhaber-Klasse („PIM-Team für M-Nr 4711"); Person handelt *in* der Rolle
- **Vertretung** = befristeter Capability-Transfer (Urlaub, Rollenwechsel) — im Baum dokumentiert
- **Multi-eyes-Freigaben** = N Capabilities mit `may_confirm: true` an einer Fassung

### 3.4 Was SSO-NIE darf (Negativ-Katalog)

| Verbot | Grund |
|---|---|
| SSO-Token als Fach-Berechtigung | Auth ≠ Capability — das Token identifiziert, es autorisiert nichts |
| Rechte aus Google-/GitHub-Profilen ableiten (Orgs, Teams, E-Mails) | dann sind US-Provider im Rechtepfad; Rollen leben im Baum |
| SSO-Zwang (kein Passkey-Fallback) | Onboarding-Versprechen bricht; Provider-Lock-in |
| Auto-Upgrade von Rechten nach Login-Erhöhung | Rechte wachsen nur durch signierte Capability-Ausstellung, nie durch Anmeldung |
| Google/GitHub sehen Fall- oder Capability-Daten | Broker-Muster: vorgelagert, nie nachgelagert |

## 4. Ablauf: Der erste Login (Verheiratung)

```
1. Nutzer klickt „Mit Google anmelden" (oder GitHub, oder Passkey)
2. Keycloak brokert die Anmeldung → bestätigt: „das ist Erika, Google sagt es"
3. ERSTER Login: gitchain erzeugt/verknüpft Erikas did:key
   → Zuordnungs-Commit: {sso-provider: google, subject: <google-sub>, did: erika-key}
   (einmalig; danach ist die Kette beweisbar: wer hat wann welche did zugeordnet)
4. JEDE weitere Sitzung: SSO-Login → Token → Mapping auf did:key → Sitzungsschlüssel
   (der US-Provider sieht nur: „jemand meldet sich an" — nie was danach passiert)
5. Abmeldung vom US-Provider/Account-Löschung:
   → nur der Anmelde-Weg stirbt; did:key + Capabilities + Recovery bleiben
```

**Recovery-Anmerkung:** Der did:key bleibt der Souveränitäts-Anker. Wer sein Google-Konto verliert, authentifiziert sich über Passkey oder den Recovery-Pfad (12 Worte) — die Fälle sind unberührt.

## 5. Umsetzung (technischer Anker)

| Baustein | Umsetzung |
|---|---|
| Broker | Keycloak im K8s-Verbund (Docker/Helm; Identity-Brokering: Google-OIDC, GitHub-OIDC vorkonfiguriert) — Adresse稳定 wie `:3361` |
| Token | Keycloak-OIDC (JWT); das Gateway prüft Token-Signatur (Keycloak-Pubkey, nicht Google) |
| Zuordnung | Erweiterung des Device-Logins im Backend: `sso-sub → did:key` Mapping (Tabelle/Store, committet) |
| Sitzung | kurze Sitzungs-Capability (z. B. 24h) — auch die ist befristet |
| App | Login-Screen: drei Wege (Google/GitHub/Passkey) — OS-Sprache-Design, kein Unternehmen-Logos-Overkill |
| Referenz-Instanz | `docs/gitchain-ref` um `/api/v2/auth/sso/callback` + Zuordnungsdemo erweitern (Test: Login → Zuordnung → Capability gilt, Login ohne Capability = kein Zugriff) |

## 6. Der Satz

*Google und GitHub dürfen sagen, wer du bist — aber was du darfst, entscheidet ausschließlich ein signierter Schlüssel in deinem Baum. Und wenn du morgen beiden den Rücken kehrst, bleibt alles außer der Bequemlichkeit.*
