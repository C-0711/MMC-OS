# Recovery & Erbschaft v0.1 — Der letzte Schlüssel-Moment

*Einundzwanzigste Spec im Verbund · Schließt den letzten offenen Architektur-Punkt · Baut auf: identitaet-email-container (12 Worte, Notar-Moment), boot-and-desktop (Recovery als Zeremonie), technical-spec §2.5 (Keys in Enclave, nie im Container)*

---

## 0. Der eine Satz

**Der Schlüssel ist die Souveränität — deshalb ist sein Verlust der einzige Fall, in dem das System dem Nutzer helfen muss, ohne ihm je begegnen zu können: Recovery ist eine Zeremonie mit zwei Zeugen, kein Passwort-Reset.**

## 1. Die vier Fälle (das komplette Spektrum)

| Fall | Was passiert | Lösung |
|---|---|---|
| **F1 Gerätewechsel** | altes Gerät da, neues dazu | Geräte-Capability (§2.1) — Routine, 2 Minuten |
| **F2 Geräteverlust** | Gerät weg, Worte da | Recovery aus 12 Worten (§2.2) — Notar-Moment |
| **F3 Schlüsselverlust** | Worte UND Geräte weg | Social Recovery / Erbschaft (§3) — der harte Fall |
| **F4 Erbschaft/Tod** | Nutzer kann nicht mehr | Erbschafts-Pfad (§4) — Recht + Technik |

## 2. F1 & F2 — der Normalweg

### 2.1 Gerätewechsel (Routine)

```
Neues Gerät ──► bestehender Tresor (Mac/Phone) signiert eine
               Geräte-Capability {geräte-did, expires: 365d, scope: voll}
               → neues Gerät kloned, ist ab sofort gleichwertig
```
- Einladung im bestehenden Tresor, Bestätigung am neuen Gerät — **kein Passwort-Transfer, nie.**
- Die Geräte-Capability selbst ist committet (Audit: welche Geräte existierten wann).

### 2.2 Recovery aus 12 Worten (Notar-Moment)

- 12 Worte → Argon2id → **zweiter, gleichwertiger Vault-Key-Pfad** (der Recovery-Key ist nicht der Geräte-Key — zwei Türen, ein Tresor).
- Zeremonie nach Boot-Spec: ernst, wörtlich, kein Copy-Paste-Weg (einmalige Anzeige + handschriftliche Bestätigung „Ich habe sie sicher verwahrt").
- Nutzung: neue Geräte-Capability ausstellen, alte Geräte ggf. sperren (Revocation — der Recovery-Key ist der Herr im Haus).
- **Was bei Fehleingabe passiert:** keine „3 Versuche"-Sperrung gegen Brute-Force nötig (Argon2 + 128-bit-Entropie), aber jeder Recovery-Versuch wird committet (Audit-Spur: Fehlversuche sichtbar).

## 3. F3 — Social Recovery (Schlüsselverlust ohne Worte)

**Prinzip:** Shamir Secret Sharing (3-of-5) über die Recovery-Information — 5 vertrauenswürdige Stellen halten je ein Fragment, 3 genügen zur Wiederherstellung.

| Fragment-Inhaber | Rolle |
|---|---|
| 2× Familienmitglieder/Vertraute | privat, persönlich |
| 1× Anwalt/Notar | professionelle Verwahrung |
| 1× Betreiber-Vault (verschlüsselt, nur per Anweisung freigeben) | letzte Instanz |
| 1× physisch (Papier im Bankschließfach) | analoges Backup |

**Regeln:**
- **Nie mehr als die Hälfte der Fragmente an einem Ort** (3-of-5: ein einzelner Verlust ist nie fatal).
- Jeder Inhaber weiß **nicht**, wer die anderen sind (kein Kollusions-Pfad über die Liste — nur der Tresor kennt sie, committet).
- Aktivierung: 3 Fragmente zusammen → Recovery-Key → neuer Geräte-Key → **alle alten Schlüssel werden rotiert** (der Verlustfall ist ein Angriffsfall bis zum Beweis des Gegenteils).
- Der Betreiber hält maximal 1 Fragment — er kann allein **nie** wiederherstellen.

## 4. F4 — Erbschaft (der rechtlichste Fall)

**Zwei Ebenen getrennt halten:**

1. **Technisch:** Erbschafts-Capability (vorbereitet, inaktiv): `{erbe-did, ausloeser: todesfall-nachweis, scope: read + export, expires: nie — aber nur aktivierbar einmal}`.
   - Auslöser = Todesfall-Nachweis: 2 der Social-Recovery-Fragmente **plus** ein amtliches Dokument (Erbschein/Testament) an die Betreiber-Instanz → diese gibt ihr Fragment frei → 3-of-5 erreicht → Erbe erhält read+export-Zugang. **Nie write** — der Erbe liest die Welt, er führt sie nicht fort.
2. **Rechtlich:** Die Erbschafts-Capability ist nur die *technische Tür*. Was der Erbe darf (Datenschutz, Postmortem, Berufsgeheimnisse — z. B. die Steuer-Container), entscheidet **deutsche Rechtslage + die Anweisungen des Nutzers** (Erbschafts-Anweisungs-Atom im Container, bei Lebenszeit gesetzt, committet — „meine Steuerfälle gehören dem Steuerberater X zur Abwicklung, nicht dem Erben").

**Design-Entscheidung:** Der Tresor stirbt nicht mit dem Nutzer — er wird **versiegelt lesbar** übergeben. Das ist bewusst anders als „Accounts sterben mit Person" (die US-Plattform-Logik) — die Fälle sind Beweise über den Tod hinaus (Verträge, Versicherungsfälle, Steuern), genau dafür brauchen Erben sie.

## 5. Rotation & Kettentreue (übergreifend)

- **Jeder Recovery-Vorgang rotiert alle Schlüssel** (Geräte-Keys neu, alter Vault-Key-Rotations-Commit im Baum — die Historie bleibt lesbar via neuer Key, die alte Türen schließen).
- **Commits bleiben kryptografisch unversehrt:** alte Signaturen verifizieren gegen das Schlüssel-Register (committet im Container) — Rotation ändert die *Zukunft*, nicht die *Vergangenheit*. Die Beweiskette übersteht jeden Schlüsselwechsel (das ist der Unterschied zu „Passwort zurücksetzen = Historie futsch").
- Betreiber sieht bei allem: nur Chiffre + Audit-Zeilen („ein Recovery fand statt, von wo, mit welchen Fragmenten-Quoren" — ohne Identitäten der Fragment-Inhaber).

## 6. Umsetzung (technischer Anker)

| Baustein | Umsetzung |
|---|---|
| 12 Worte | `@scure/bip39` (bereits im AUTH-Auftrag A.2) |
| Shamir 3-of-5 | `@supabase/shards`-Klasse / `sss-cli`-Ansatz (Bibliothek: `shamirs-secret-sharing` npm oder noble-Ansatz) |
| Rotation | Key-Register im Container (committet), Rotations-Flow im Backend |
| Erbschafts-Auslöser | Betreiber-Endpoint: Dokument-Prüfung (manuell, rechtspflichtig — NICHT automatisieren) + Fragment-Freigabe |
| Referenz-Instanz | Test: F1 (Geräte-Capability), F2 (Worte → Key → Rotation), F3 (3-of-5 → Recovery), F4 (Erbschafts-Capability read-only) als `test-recovery.js` |

## 7. Negativ-Katalog

| Verbot | Grund |
|---|---|
| Passwort-Reset durch Betreiber | wer zurücksetzen kann, hat den Tresor — das ist die US-Logik, nie unsere |
| Recovery ohne Rotations-Commit | der Verlustfall muss nachvollziehbar sein |
| Mehr als 1 Fragment beim Betreiber | Betreiber darf allein nie wiederherstellen können |
| Fragmente-Liste im Klartext irgendwo | Kollusions-Pfad; nur committet im Tresor |
| Erbe mit Schreibrechten | Erben lesen die Welt, führen sie nicht fort |
| Recovery per E-Mail-Link allein | E-Mail = Zustelladresse, kein Beweis von Identität bei Verlust (F2 braucht die Worte) |
| 3-Fragmente-am-einem-Ort | ein Diebstahl = kompletter Schlüsselverlust |

## 8. Der Satz

*Ein Passwort kann jemand zurücksetzen — ein Tresor nicht. Deshalb trägst du zwölf Worte, verteilst fünf Fragmente unter Menschen, die dir vertrauen, und die Beweiskette deiner Fälle übersteht selbst dich selbst.*
