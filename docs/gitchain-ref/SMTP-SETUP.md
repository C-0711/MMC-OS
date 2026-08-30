# SMTP-SETUP — Code-Zustellung in eurer Produktion

*Für: euren K8s-Verbund / Server · Zusteller-Modul: `zustaeller.js` (Interface ist fertig, nur noch SMTP_HOST setzen)*

---

## Die drei Wege (aus identitaet-email-container-v0.1.md §5, mit Entscheidungshilfe)

| Weg | Aufwand | Start in | Souveränität |
|---|---|---|---|
| **A. Eigener Postfix** (das Ziel) | DNS-Set + IP-Reputation | 1–2 Wochen Aufbau | maximal — Zustellung komplett in eurer Hand |
| **B. EU-SMTP-Relay** (z. B. SMTPmart/Turbo-SMTP, GDPR-Server) | Konto + Credentials | 1 Tag | hoch — Relay sieht nur „an welche Adresse ging ein Code" |
| **C. QR/Einladung** (ganz ohne SMTP) | App-Feature | Feature-Arbeit | maximal — kein SMTP nirgends |

**Empfehlung: B zum Launch → A als Ziel.** C als Pilotkunden-Weg (Bosch-Klasse) parallel.

---

## Weg A: Eigener Postfix — die DNS-Checkliste für `auth.gitchain.de`

Vor dem ersten versendeten Code müssen ALLE stehen (2026-Anforderung — Gmail/MSN lehnen sonst ab):

| # | DNS-Eintrag | Wert (Beispiel) | Zweck |
|---|---|---|---|
| 1 | **MX** | `auth.gitchain.de. 3600 IN MX 10 mail.gitchain.de.` | Empfang (für Bounces nötig) |
| 2 | **A/PTR** | statische IP eures Servers + **PTR-Rückwärts-Eintrag beim IP-Besitzer** (Hetzner-Backend) | IP ohne PTR = sofort Spam-Verdacht |
| 3 | **SPF** (TXT) | `v=spf1 ip4:<eure-ip> -all` | wer darf für die Domain senden — nur euer Server, strikt |
| 4 | **DKIM** | Key-Paar generieren (`opendkim-genkey`), public in TXT `s1._domainkey` | kryptografische Signatur je Mail |
| 5 | **DMARC** (TXT) | `_dmarc: v=DMARC1; p=reject; rua=mailto:dmarc@gitchain.de` | Policy: abweisen statt Spam-Ordner; Reports an euch |
| 6 | **MTA-STS / TLS-RPT** | optional, später | Transport-Verschlüsselung erzwingen |

**Postfix-im-Pod (K8s):**
- Deployment: Postfix als StatefulSet (oder Sidecar), Config: nur Transaktionsmail, Relay-Verbot (`smtpd_relay_restrictions` strikt), Rate-Limit
- **DKIM-Signierung** via OpenDKIM-Sidecar
- kein offenes Relay — der Pod sendet NUR die Auth-Codes ( `smtp_sasl_auth` nach außen über euren Smarthost = Weg B hybrid möglich)

**IP-Reputation aufbauen (der Geduld-Teil):**
- saubere IP mit History prüfen VOR Bestellung (MXToolbox, Spamhaus-Abfrage)
- erste Wochen wenig Volumen (nur Codes, kein Marketing — Glücklicherweise: **Transaktions-Codes sind der leichteste Zustellfall überhaupt**), Monitoring via DMARC-Reports

## Weg B: EU-Relay in 1 Tag

1. Konto bei EU-SMTP-Relay (deutscher Anbieter, GDPR, DPA/AVV-Vertrag!)
2. Domain trotzdem selbst authentifizieren: SPF um Relay-IP erweitern (`v=spf1 ip4:<eure-ip> include:<relay> -all`), DKIM weiter eure Keys (Relay signiert mit eurem Key — bleibt eure Identität)
3. env setzen: `GITCHAIN_ZUSTELLER=smtp` + `SMTP_HOST/PORT/USER/PASS/FROM`
4. fertig — App-Code unverändert (das Interface regelt das)

## Umstellung im Code (beide Wege identisch)

```bash
# Mock (jetzt, CI, Container):
GITCHAIN_ZUSTELLER=mock

# Produktion:
GITCHAIN_ZUSTELLER=smtp
SMTP_HOST=mail.gitchain.de        # oder Relay-Host
SMTP_PORT=587
SMTP_USER=auth@gitchain.de
SMTP_PASS=***                      # aus Vault/Secret, NIE in .env committet
SMTP_FROM="gitchain <auth@gitchain.de>"
```

`SmtpZustaeller` (in `zustaeller.js` dokumentiert, `nodemailer`-Schema) einbinden — der Auth-Pfad bleibt unberührt, die Code-Logik (Hashing, 10-Min-Gültigkeit) ist zusteller-unabhängig.

## Harte Regeln (aus der Spec, gelten für jeden Weg)

- **Code nur als Zahlen** im Mail-Body, kein Betreff-Geheimnis, kein Token-Link (Phishing-Fläche minimal)
- E-Mail bleibt **Zustelladresse**: nur `hash(email)` in der DB — der Zusteller sieht die Adresse flüchtig, speichert sie nie
- Rate-Limit je Adresse (z. B. 3 Codes/Std) — sonst ist euer Auth ein Mail-Bombing-Werkzeug
- **Bounces nicht als Fehler offenlegen** („Adresse unbekannt" = Account-Enumeration)
- DKIM-Key-Rotation jährlich (Kalender-Erinnerung)

## Warum mein Container hier mockt (der ehrliche Absatz fürs Team)

Port 25/465/587 sind in der Referenz-Umgebung bewusst geschlossen — die Instanz beweist **die Zustell-Logik** (Hashing, Code-Gültigkeit, Fail-closed), nicht den Transport. Das ist die Systemränder-Doktrin: Mechanik echt, Außenwelt Attrappe. Für App-Tests gegen `:3361` ist `GITCHAIN_ZUSTELLER=mock` korrekt; der SMTP-Zusteller wird erst in eurem K8s scharf — mit dieser Checkliste.
