# Identität & Onboarding-Identität v0.1 — E-Mail = dein Container

*Zwanzigste Spec im Verbund · Ersetzt SSO komplett für den Endnutzer-Pfad · Baut auf: boot-and-desktop (Null-Fragen-Weg), sso-rechte-v0.1 (§ Variante B), supercontainer*

---

## 0. Der eine Satz

**E-Mail eingeben, Code bestätigen, fertig: der Nutzer bekommt automatisch seinen eigenen, superverschlüsselten Container — die E-Mail ist nicht das Login bei einem Anbieter, sie ist die Zustelladresse für seinen Schlüssel.**

## 1. Der Ablauf (30 Sekunden, kein Konto-Formular)

```
1. NUTZER GIBT E-MAIL EIN        „christoph@beispiel.de"
        ↓
2. ZUSTELLUNG (einmalig)         Sechsstelliger Code ODER Magic Link
                                 an die Adresse — beweist: die Adresse gehört dir
        ↓
3. TREsor ENTSTEHT AUTOMATISCH   Der Vault wird angelegt:
                                 - Container-Struktur (Brain + erster Fall)
                                 - did:key (Ed25519) — DER Schlüssel
                                 - alles at rest superverschlüsselt
        ↓
4. SCHLÜSSEL-ÜBERGABE            Der Schlüssel wird dem Nutzer ÜBERGREIFEND
                                 übergeben: Passwort/Passkey-abgeleitet
                                 (Argon2/PBKDF2 → KDF → Vault-Key)
        ↓
5. RECOVERY-PFAD (Notar-Moment)  12 Worte / QR auf Papier — die einzige
                                 zweite Kopie des Schlüssels
        ↓
FERTIG. Kein SSO. Kein Konto-Formular. Keine AGB-Wand. Der Container gehört
der E-Mail — aber nur solange der Schlüssel passt.
```

**Der entscheidende Unterschied zu klassischem Login:** Die E-Mail wird **nicht** in einer Nutzer-Tabelle als Identität *gespeichert und geprüft* (wie bei Google/SSO). Sie dient **einmalig** als Zustell-Beweis — danach lebt die Identität im did:key. Die E-Mail ist der *Türöffner bei Verlust*, nicht der Herr im Haus.

## 2. Was „superverschlüsselt" konkret heißt

| Ebene | Mechanik |
|---|---|
| **Vault at rest** | Jeder Container (Fall, Brain, Agent) AES-256-verschlüsselt; Keys in OS-Keychain/Secure-Enclave, **niemals im Container selbst** |
| **Ableitung** | Nutzer-Passwort/Passkey → Argon2id → Vault-Key. Der Server (falls Cloud-Klon) sieht NUR Chiffre — Tresor-Konvention |
| **Netz** | Transport E2E zwischen Tresoren (WireGuard-Klasse); kein Betreiber im Klartext-Pfad |
| **Recovery** | 12 Worte → zweiter Vault-Key-Pfad (offline, Papier — kein Provider kann ihn leaken) |
| **Neue Geräte** | Einladungs-Flow: bestehender Tresor signiert eine Geräte-Capability (statt Passwort-Übertragung) — oder Recovery-Worte einmalig |

## 3. Die E-Mail-Rolle im Detail (sauber getrennt)

```
E-MAIL = ZUSTELLADRESSE + WIEDERSEHEN-ADRESSE
├─ Bei Erst-Anmeldung:    Beweis der Kontrolle (Code/Magic Link)
├─ Bei neuem Gerät:       Login-Link an dieselbe Adresse = Bequemlichkeit
├─ Bei Verlust:           Recovery-Kette kann an die Adresse gehen
└─ NICHT: Identität, NICHT: Rechte, NICHT: Ort der Wahrheit

IDENTITÄT = did:key IM CONTAINER (signiert alles)
RECHTE    = Capabilities (falls geteilt)
```

**Was der Betreiber nie hat:** Klartext-Inhalte, den Vault-Key, die Capability-Liste, die Historie. **Was der Betreiber hat:** `hash(email) → verschlüsselter Container-Blob` — eine Zustell-Zuordnung, mehr nicht.

## 4. Abgrenzung zu SSO (warum das hier KEIN SSO ist)

| Klassisches SSO | Dieses Modell |
|---|---|
| Anbieter prüft Identität zentral | Niemand prüft zentral — die E-Mail *beweist Einmaligkeit* der Zustelladresse |
| Token erlaubt Zugriff auf Dienste | Kein Token hat Fach-Bedeutung; Capability + Schlüssel regeln alles |
| Konto beim Anbieter nötig | Kein Konto — ein Container, der zur E-Mail *zugeordnet* ist |
| Anbieter kennt alle Logins | Betreiber sieht nur: „an diese Adresse wurde ein Code geschickt" |
| Account-Löschung = Identitätsverlust | E-Mail weg = Zustelladresse weg; did:key + Recovery bleiben |

Google/GitHub-Login (falls je gewünscht) bleibt als **reine Bequemlichkeitsoption** in der Login-Zeile möglich — nach sso-rechte-v0.1 Variante B: als Schlüssel-Aufbewahrung, nie als Identität. Für den Standard-Weg gilt: **kein SSO.**

## 5. Das Zustell-Problem (ehrlich: der eine Kompromiss)

E-Mail-Zustellung braucht einen SMTP-Versand — der läuft über Infrastruktur, die man nicht selbst kontrolliert. Drei Optionen, ehrlich sortiert:

1. **Eigener Mailserver** (im K8s-Verbund): souveränster Weg; Zustellbarkeits-Management (SPF/DKIM) ist Aufwand, aber euer Betrieb hat das Know-how.
2. **EU-Transaktionsmail-Dienst** (z. B. deutsche Anbieter): Pragmatismus für den Start — sieht nur „an welche Adresse ging ein Code", nie Inhalte.
3. **Beweis anders als über E-Mail**: QR auf zweitem Gerät / Einladung durch bestehenden Nutzer („Freund lädt Freund ein" = Capability + Container-Übergabe) — die souveränste Variante ganz ohne E-Mail.

Empfehlung: **Option 1 als Ziel, Option 2 als Start, Option 3 als Premium-Weg** (Einladungs-Onboarding passt perfekt zur Safe-Network-These).

## 6. Umsetzung (technischer Anker)

| Baustein | Umsetzung |
|---|---|
| Zustell-Beweis | `/api/v2/auth/anfang` (E-Mail) → Code (6-stellig, 10 Min gültig) → `/api/v2/auth/bestaetigen` |
| Container-Autoanlage | Erweiterung gitchain-ref: nach Bestätigung automatisch `createFall(brain)` + Vault-Init + did:key-Generierung |
| Ableitung | Argon2id (Node: `argon2`-Paket oder `@noble/hashes`) — Passwort → Vault-Key; Passwort NIE speichern, nur Hash-Parameter |
| Verschlüsselung | AES-256-GCM je Container-Datei (_age_-Klasse, `@noble/ciphers`) |
| Geräte-Bindung | Passkey (WebAuthn) als bevorzugter zweiter Faktor — Geräteschlüssel in der Enclave |
| Referenz-Instanz | Test erweitern: E-Mail → Code → Container existiert, superverschlüsselt, did:key da, E-Mail nirgends im Klartext committet (nur Hash) |

## 7. Negativ-Katalog

| Verbot | Grund |
|---|---|
| E-Mail als Identität in einer zentralen Tabelle mit Klartext-Rechten | das wäre SSO light — genau was wir nicht bauen |
| Passwort im Klartext oder wiederholbar beim Betreiber | nur Argon2-Parameter + Hash |
| Vault-Key jemals beim Betreiber | Tresor-Konvention: Betreiber sieht nur Chiffre |
| Konto-Formular (Name, Adresse, AGB-Wand) | Onboarding-Versprechen: E-Mail, Code, fertig |
| E-Mail-Adresse in Commits/Container im Klartext | nur Hash in der Zustell-Zuordnung — die Adresse ist Metadatum des Transports, nicht des Falls |
| SSO-Zwang | Passkey/Recovery immer ohne Anbieter möglich |

## 8. Der Satz

*Gib deine E-Mail, beweise einmal, dass sie deine ist — und dein superverschlüsselter Container entsteht wie von selbst: Die Adresse ist die Zustellung, der Schlüssel ist die Identität, und der Tresor gehört dir allein.*
