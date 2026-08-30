# DoD-Review-Checkliste — Fronten-Abnahme in einer Stunde

*Ausführungsanleitung: pro Front die Befehle laufen lassen, Ergebnis abhaken. Rot = sofortiges Issue im Fronten-Strang. Ziel: eine Stunde, dann weißt du, was grün ist.*

---

## FRONT 1: W1 — Workspace-Connectors

```bash
# 1. Typen: Connector-Fundstelle im Vault-Modell vorhanden?
grep -rn "art: 'connector'" app/src/main/ || echo "ROT: W1.1 fehlt"

# 2. Connector-Gerüst existiert?
ls app/src/main/connectors/ || echo "ROT: W1.2 fehlt"
ls app/src/main/connectors/mocks/ || echo "ROT: Mocks fehlen (Mock-First-Doktrin)"

# 3. Keine echten URLs/Credentials committet?
grep -rn "192.168\|https://tc\.\|password\|token:" app/src/main/connectors/ \
  | grep -v "mock\|MOCK\|\.env\.example" || echo "GRÜN: keine Live-Credentials"

# 4. Widerspruchs-Engine existiert + Demo-Daten vorbereitet?
grep -rn "Widerspruch\|widerspruch" app/src/main/ --include="*.ts" -l \
  || echo "ROT: W1.4 fehlt"

# 5. Tests + Typecheck
cd app && npm run typecheck && npm test
```

**Ende-zu-Ende-Beweis (manuell, 10 Min):** App starten → Teamcenter-Mock-Pull triggern → im Fall-Container prüfen: `docs/systeme/teamcenter/<objekt>/` existiert mit Sidecar (Connector-Fundstelle) → Widerspruchs-Karte erscheint mit ZWEI Fundstellen (Teamcenter + PIM) → Bestätigung → `git log` im Fall zeigt signierte Fassung.

---

## FRONT 2: CALL — Call & Meet

```bash
# 1. Fundstellen-Typ "anruf" (gemeinsame Basis mit ETAPPE-4 A)?
grep -rn "art: 'anruf'" app/src/ || echo "ROT: C.1 fehlt"

# 2. Signaling-Stub + Typ-Trennung (der Sicherheits-Beweis!)
ls app/src/main/call/ || echo "ROT: C.2 fehlt"
grep -rn "SignalingNachricht" app/src/main/call/ | head -1 \
  || echo "ROT: Typ-Trennung fehlt"
# Kritisch: Medien-Daten dürfen NIE durch Signaling:
grep -A5 "interface SignalingNachricht" app/src/main/call/signaling.ts \
  | grep -i "audio\|video\|media\|stream" && echo "ROT: Medien im Signaling-Typ!" || echo "GRÜN: Typ getrennt"

# 3. STT on-device (kein Cloud-Endpunkt!)
grep -rn "whisper\|stt\|STT" app/src/main/call/ --include="*.ts" -l \
  || echo "ROT: C.4 fehlt"
grep -rn "api.openai\|azure\|google.*speech" app/src/main/call/ \
  && echo "ROT: CLOUD-STT IM PFAD!" || echo "GRÜN: lokal"

# 4. R3-Regel: gesprochenes "ja" nie main
grep -rn "kandidat\|Kandidat" app/src/main/call/ --include="*.ts" -l \
  || echo "ROT: Beschluss-Kette (C.6) fehlt"
```

**Ende-zu-Ende-Beweis (manuell, 15 Min):** Zwei App-Instanzen starten (A/B) → A ruft B mit Fall-Kontext (Klingel-Screen zeigt Fall-Infos) → 30s sprechen → auflegen → im geteilten Fall: Atoms mit `{sprecher, minute}` von BEIDEN Seiten → mind. 1 Beschluss-Kandidat als Karte → beide bestätigen → signierte Fassung → Beweis-Screen zeigt Transkript-Timeline mit gehighlighteter Minute (pixelvergleichen gegen `OsAnrufBeweis.dc.html`).

---

## FRONT 3: AUTH — E-Mail = dein Container

```bash
# 1. Auth-Modul existiert?
ls app/src/main/auth/ || echo "ROT: A.1 fehlt"

# 2. DER HÄRTESTE CHECK: E-Mail-Klartext nirgends
#    (Vault, Zuordnungen, alle committeten Dateien)
grep -rn "@" docs/gitchain-ref/auth/ 2>/dev/null | grep -v "gitchain\|@\|\.local\|specs@" \
  | grep -E "[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}" && echo "ROT: E-MAIL IM KLARTEXT!" || echo "GRÜN: nur Hashes"
grep -rn "email" app/src/main/auth/identitaet.ts | grep -i "hash\|sha\|blake" \
  || echo "ROT: E-Mail wird nicht gehasht!"

# 3. Passwort nie im Klartext (nur Argon2-Parameter)
grep -rn "argon2" app/src/main/auth/ableitung.ts || echo "ROT: A.2 Argon2 fehlt"

# 4. Verschlüsselung: Container-Datei ohne Key = nur Chiffre?
#    (im gitchain-ref-Test oder als App-Test)
grep -rn "aes-256-gcm\|chacha" app/src/main/auth/ app/src/main/vault.ts \
  || echo "ROT: AES-GCM fehlt"

# 5. Mock-Modus dokumentiert (CI-tauglich)?
grep -n "AUTH_MOCK" app/README.md app/src/main/auth/*.ts 2>/dev/null \
  || echo "GELB: AUTH_MOCK nicht dokumentiert"

# 6. Kein Google/GitHub-Button in v1
grep -rn "google\|github" app/src/renderer/index.html \
  | grep -i "button\|login\|auth" && echo "ROT: Optionen-Wand gebaut (verboten in v1)!" || echo "GRÜN: kein SSO-Button"
```

**Ende-zu-Ende-Beweis (manuell, 5 Min):** E-Mail eingeben → Code (Mock: Konsole) → Container entsteht → Vault-Datei mit `cat`/Hex-Viewer öffnen: nur Chiffre → 12-Worte-Screen erscheint im Notar-Ton (pixelvergleichen gegen `ObZwoelfWorte.dc.html`) → Login-Screen gegen `ObAnmeldung.dc.html` + `ObCode.dc.html`.

---

## Front-übergreifend (alle drei, einmalig)

```bash
# 1. Alle Fundstellen-Arten im Typ-Union?
grep -rn "art: 'dokument'\|art: 'anruf'\|art: 'connector'" app/src/main/ \
  --include="*.ts" -l | wc -l   # Ziel: ≥ 1 Datei mit allen dreien

# 2. Commit vor Deutung im Ingress (Regression)?
cd app && npm test -- --grep "ingress\|commit" 2>/dev/null || npm test

# 3. Review-Gate-Commits sauber getrennt?
git log --oneline | grep -E "^(W1|CALL|AUTH)\." | head -20
#   fehlen Präfixe → Team erinnern (Review-Disziplin)

# 4. Referenz-Instanz (der Dritte im Bunde) läuft noch?
cd docs/gitchain-ref && node server.js &   # oder curl:
curl -s http://127.0.0.1:3361/api/v2/health | grep '"ok"'
```

## Legende

- **ROT** = Front nicht abnehmbar → Issue im Strang, nicht weiterbauen
- **GELB** = läuft, aber Dokumentation/Disziplin fehlt → im Nachgang
- **GRÜN** = abhaken, DoD-Punkt erfüllt

**Nach dem Durchlauf:** Für jede Front ein 3-Zeilen-Review-Ergebnis (was grün, was rot, was das Team als Nächstes braucht) — dann weißt du in einer Stunde, ob Round 5 (Frag-mich-Integration, Sync, iOS) starten kann oder ob erst Rot zu Grün wird.
