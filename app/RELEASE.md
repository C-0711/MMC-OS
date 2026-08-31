# RELEASE.md — MMC-OS Release-Pipeline

**Version:** `git describe --tags --abbrev=0` (fallback: package.json) · **Produkt:** MMC-OS (gitchain OS Desktop-App)

## Pipeline

```bash
# 1. Tests (50/50 grün = Abnahme-Kriterium)
npm test

# 2. Build + dmg (electron-builder, signiert mit Developer-ID)
#    Credentials: Keychain (`security find-identity -v -p codesigning`)
npm run dist

# 3. Release-Notiz mit SHA256 (scripts/release-notes.js)
npm run release
```

## Erforderliche Credentials (NIE im Repo)

| Was | Wo | Fehlt wenn … |
|---|---|---|
| Developer-ID-Zertifikat | Keychain des Build-Mac | `npm run dist` schlägt bei Signatur fehl |
| Notarytool-Profil | `security notarytool store-credentials MMC-OS` oder `MM_NOTARY_PROFILE` env | Build läuft unnotarisiert (Warnung), Release blockiert |
| Update-Feed-Zugang | registry.gl.0711.io (gitchain-Registry) | Upload der `latest-mac.json` nicht möglich |

## Checkliste vor dem Upload

- [ ] `npm test` — 50/50 grün
- [ ] `codesign --verify --deep --strict --verbose=2 release/arm64/MMC-OS.app`
- [ ] `spctl -a -vv release/arm64/MMC-OS.app` (notarisiert)
- [ ] SHA256 aus `release/RELEASE-NOTES.md` mit `shasum -a 256` nachgerechnet
- [ ] `latest-mac.json` + dmg auf registry.gl.0711.io/updates/mmc-os/ hochgeladen
- [ ] Version-Tag gesetzt: `git tag v0.x.y && git push --tags`

## Update-Verhalten (Produkt)

- Feed: `https://registry.gl.0711.io/updates/mmc-os/` (electron-updater, generic)
- Prüfung: beim Start + alle 6h, still
- Frage im OS-Ton: „Eine neue Fassung liegt bereit — aufnehmen?" (30 s, dann still weg)
- NIE Auto-Download, NIE Auto-Install — der Bürger nickt (Canvas-Gesetz)
- Download nur nach „Aufnehmen"; Installation beim nächsten App-Start

## Backup-Verhalten (Produkt)

- Stündlicher Job: `git bundle` je Fall → `~/MMC-Vault-Backup/<fall>/<fall>-<ISO>.bundle`
- Pruning: letzte 24h alles, danach 1/Tag, max 30 Tage
- Nach Schlaf-Resume: eine Runde sofort
- Restore: `git clone <bundle> <ziel>` — Inhalt byte-identisch (Test T10)

## Crash-Verhalten (Produkt)

- `uncaughtException`/`unhandledRejection`: geloggt nach `userData/logs/app-YYYY-MM-DD.log` (14 Tage Rotation), Fenster lädt still neu
- KEIN crashReporter, keine Telemetrie — Fehler bleiben auf dem Gerät
