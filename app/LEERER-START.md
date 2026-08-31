# LEERER START — MMC-OS von null testen

**Stand:** `local-merge` = `589f596` (alle Etappen + Telefon + Fall-Strom Schritt 1/2)
**Ziel:** Du startest mit einem komplett leeren System und gehst den Weg als erster echter Nutzer.

## Auf dem Mac (echtes Electron — der richtige Weg)

```bash
cd <dein/MMC-OS-Checkout>
git fetch origin
git checkout local-merge        # 589f596 oder neuer
cd app
npm ci && npm run build

# LEERES SYSTEM: das Vault ist per Default ~/MMC-Vault —
# stelle SICHER, dass es nicht existiert (dann ist dein Start wirklich null):
rm -rf ~/MMC-Vault ~/MMC-Vault-Backup

npm start
```

**Was dann passieren sollte (dein Testpfad):**

1. **Onboarding** (leerer erster Start): „Das ist dein Siegel." → Name steht drin → „Siegel prägen" → Rettungs-Karte („Ja, jetzt" oder „Am Wochenende") → „Wirf mir irgendetwas hin." — drei Screens, keine einzige Frage davor.
2. **Leerer Alltag**: „Alles ruhig." — keine Karten, keine Fälle, keine Kontakte. Genau richtig.
3. **Erster Wurf**: Zieh EIN Dokument (PDF/TXT/Foto) ins Fenster → es entsteht der erste Fall, erste Atome, ggf. erste Karte („stimmt das?").
4. **Siegel-Menü**: Klick aufs Siegel oben rechts → 10 Bereiche. Alle leer mit Würde (Leer-Sätze, keine Spinner).
5. **Kontakte**: „Wen suchst du?" → Namen eintippen → „Anlegen" → Kontakt-Container entsteht → Text senden → erscheint als Commit im Verlauf.
6. **Texte**: Anruf & Texte → Wahl-Feld (Live-Anruf braucht PAT/Registry — ohne: ehrlicher Scheitern-Satz nach 30 s, das ist korrekt).
7. **Fall als Chat**: Fälle → der Strom — Schreib eine Zeile → „Hineinlegen" → Commit erscheint sofort.
8. **Suche**: Frag alles → Frage stellen → Antwort nur aus deinen echten Daten (bei leerem Vault: Ehrlichkeits-Satz).
9. **Crash-Test**: `kill -9` der App → Neustart → nichts verloren (Git).
10. **Backup**: nach ~1 h liegt `~/MMC-Vault-Backup/` mit Bundles.

## In der Cloud-VM (ohne Electron — Notfall-Vorschau)

Der Renderer läuft headless, aber **Onboarding-Vault-Build und echte
Electron-Features (Keychain, Sandbox, Backup-Job-Timing) gibt es nur im
echten App-Start.** Für den vollen Testpfad: Mac.

## Was bewusst NICHT da ist (keine Bugs)

- STT/Audio (whisper.cpp) — bewusst offen
- Live-Anruf ohne PAT/Registry — Scheitern-Satz ist korrektes Verhalten
- Quittungen (zugestellt/gelesen), private Spur im UI, Formen 2/3/4 — Fall-Auftrag Schritte 3–5, noch nicht gebaut
- OCR/VISION-Lane — Platzhalter-Tempo
