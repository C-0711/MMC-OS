# FRONT 3: AUTH — Anmeldung: E-Mail = dein Container

*Ergänzung zu `W1-und-CALL-AUFTRAG.md` (dritte parallele Front) · Spec: `docs/spec/identitaet-email-container-v0.1.md` (kein SSO — E-Mail ist Zustelladresse, did:key ist Identität)*

---

## Der Auftrag in einem Satz

**Baue den Anmelde-Flow: E-Mail eingeben → Code → Container entsteht automatisch, superverschlüsselt, mit did:key — und der Login-Screen nach OS-Sprache.**

## A.1 — Auth-Flow im Backend (`app/src/main/auth/`)

```
auth/
├── identitaet.ts     E-Mail → hash(email) als Zustell-Schlüssel (NIE Klartext speichern)
├── zustellung.ts     Code-Erzeugung (6-stellig, 10 Min, einmalig) + Versand-Interface
├── ableitung.ts      Argon2id (argon2-Paket): Passwort/Passkey → Vault-Key
└── geraet.ts         Passkey (WebAuthn) als Geräteweg; Challenge-Response für Folge-Sitzungen
```

Endpunkte (an gitchain-ref-Konvention angelehnt):
- `POST /api/v2/auth/anfang` `{email}` → `{zustellId}` (Code geht raus — Mock-Modus: Code in Konsole statt SMTP, echte SMTP-Credentials nie im Repo)
- `POST /api/v2/auth/bestaetigen` `{zustellId, code}` → Erfolg löst A.2 aus
- `POST /api/v2/auth/sitzung` `{passwort|passkey}` → `{sitzungsCapability (24h, befristet)}`

**Regeln aus der Spec (Review-Gate):**
- E-Mail **nur als Hash** in der Zustell-Zuordnung — nie Klartext in DB/Commits/Container
- Passwort nie speichern — nur Argon2-Parameter + Hash
- Sitzung ist selbst eine **Capability mit `expires`** — fail closed bei jedem Zugriff
- Mock-Modus für Tests: `AUTH_MOCK=1`

## A.2 — Auto-Container bei Erst-Anmeldung

Nach Bestätigung des Codes entsteht automatisch (nutzt die bestehende vault.ts-Mechanik):
1. Vault-Init + Brain-Fall (`createFall`) — der erste Container
2. did:key-Generierung (Ed25519, `@noble/curves`) — **der Schlüssel, nicht die E-Mail, ist die Identität**
3. Vault-Key-Ableitung (Argon2id aus Passwort/Passkey) → Container-Dateien AES-256-GCM (`@noble/ciphers`, age-Klasse)
4. Recovery-Vorbereitung: 12 Worte generieren (`@scure/bip39`) — Anzeige im Notar-Moment (Boot-Spec: ernst, wörtlich, nicht verspielt)

## A.3 — Login-Screen nach OS-Sprache (Canvas `ObNull`/`ObSiegel` als Vorlage)

Warmweiß, Serif-Headline, EIN Feld:

```
┌────────────────────────────────┐
│  Deine E-Mail.                  │   Serif
│  Dein Container entsteht.       │
│                                 │
│  [________________________]     │   ein Feld, sonst nichts
│                                 │
│  [ Code senden ]                │   Salbei-Pill
│                                 │
│  klein: Passkey statt E-Mail ↗ │   der souveräne Alternativweg
└────────────────────────────────┘
```

**Keine Optionen-Wand:** kein Google-Button, kein GitHub-Button (bleiben laut Spec optional — NICHT in v1 bauen). Ein Feld, ein Button, ein Alternativweg klein darunter.

## A.4 — Referenz-Instanz spiegeln (`docs/gitchain-ref/`)

Erweitere `server.js`:
- `POST /api/v2/auth/anfang` + `bestaetigen` (Mock: Code bei `AUTH_MOCK=1` in Response, sonst Konsole)
- nach Bestätigung: Auto-`createFall('brain-<hash-prefix>')` + Zuordnung `{emailHash → containerRef}` (Datei `auth/zuordnungen.json` — nur Hashes)
- Test (`test-auth.js`): E-Mail → Code → Container existiert + superverschlüsselt (ohne Key nur Chiffre) + **E-Mail nirgends im Klartext** (grep-Test über alle committeten Dateien)

## AUTH Definition of Done

1. E-Mail → Code → Container: kompletter Flow läuft mit Mock-Zustellung
2. Vault-Dateien sind verschlüsselt (Test liest Container-Datei ohne Key → nur Chiffre)
3. E-Mail-Klartext existiert NIE: grep über Vault + Zuordnungen + Commits = 0 Treffer
4. Recovery: 12 Worte generiert, Bestätigungs-Screen nach Boot-Spec-Notar-Ton
5. Login-Screen pixelverglichen gegen ObNull/ObSiegel-Artboards
6. `npm run typecheck` grün; `AUTH_MOCK` für CI dokumentiert

## Einordnung in die Gesamt-Reihenfolge (mit W1 + CALL)

1. **W1.1 + C.1 + A.1-Interface-Design** als gemeinsamer Basis-Commit (Fundstellen-Typen + Auth-Schnittstellen)
2. Parallel: W1.2–W1.4 · C.2–C.5 · A.1–A.3 (drei unabhängige Stränge, getrennte Commits `W1.x:` / `CALL.x:` / `AUTH.x:`)
3. Referenz-Instanz-Erweiterungen (W1.5, C.7, A.4) zuletzt — Test-Zielscheiben für alles

## Harte Regeln (zusätzlich zu W1/CALL)

- E-Mail nur als Hash, Passwort nie im Klartext, Vault-Key nie beim Betreiber
- Kein Google/GitHub-Button in v1 — Passkey ist der souveräne Alternativweg
- Onboarding-Versprechen bleibt: ein Feld, ein Button — keine Optionen-Wand, keine AGB
