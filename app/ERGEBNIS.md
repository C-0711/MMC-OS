# Etappe 1 — Electron-Gerüst + UI-Shell: ABGESCHLOSSEN ✓

## Angelegte Dateien

### Konfiguration
- `/Users/christophbertsch/MMC-OS/app/package.json` — Electron + TypeScript, Scripts
- `/Users/christophbertsch/MMC-OS/app/tsconfig.json` — Main-Prozess (CommonJS)
- `/Users/christophbertsch/MMC-OS/app/tsconfig.renderer.json` — Renderer-Prozess (ES2022)

### Main-Prozess (Node.js/Electron)
- `/Users/christophbertsch/MMC-OS/app/src/main/main.ts` — BrowserWindow 1200x800, #FAF7F2
- `/Users/christophbertsch/MMC-OS/app/src/main/preload.ts` — contextBridge + window.mmc API

### Renderer-Prozess (UI)
- `/Users/christophbertsch/MMC-OS/app/src/renderer/index.html` — Ein Fenster, drei Zustände
- `/Users/christophbertsch/MMC-OS/app/src/renderer/app.ts` — State-Machine (ruhig/fragend/antwortend)
- `/Users/christophbertsch/MMC-OS/app/src/renderer/tokens.css` — Design-Tokens (exakt nach Brief)

### Dokumentation
- `/Users/christophbertsch/MMC-OS/app/README.md` — Anleitung
- `/Users/christophbertsch/MMC-OS/app/INTERFACE.md` — window.mmc TypeScript-Signaturen

## Typecheck-Ergebnis

```bash
$ npm run typecheck
> mmc-os@0.1.0 typecheck
> tsc --noEmit && tsc --noEmit -p tsconfig.renderer.json

[FEHLERFREI ✓]
```

## Start-Test-Ergebnis

```bash
$ npm run build
> mmc-os@0.1.0 build
> tsc && tsc -p tsconfig.renderer.json && cp src/renderer/index.html dist/renderer/ && cp src/renderer/tokens.css dist/renderer/

[ERFOLGREICH ✓]

Verifikation:
✓ package.json
✓ tsconfig.json
✓ tsconfig.renderer.json
✓ src/main/main.ts
✓ src/main/preload.ts
✓ src/renderer/index.html
✓ src/renderer/app.ts
✓ src/renderer/tokens.css
✓ dist/main/main.js (kompiliert)
✓ dist/main/preload.js (kompiliert)
✓ dist/renderer/app.js (kompiliert)
✓ dist/renderer/index.html (kopiert)
✓ dist/renderer/tokens.css (kopiert)

Electron v32.3.3 — Imports erfolgreich getestet ✓
```

## window.mmc Preload-Interface (TypeScript-Signaturen)

```typescript
export interface MMCVaultAPI {
  // TODO Etappe 2: Fall-Repos anlegen/lesen, Eingang-Commit, Branch-Vorschlag, Merge
  // createFall(name: string): Promise<string>;
  // commitEingang(fallId: string, file: ArrayBuffer, meta: object): Promise<string>;
  // listFaelle(): Promise<Array<{name: string, path: string}>>;
}

export interface MMCOCR_API {
  // TODO Etappe 3: belegsrv /v1/ocr aufrufen
  // deuteBeleg(file: ArrayBuffer): Promise<{
  //   zeilen: Array<{text: string, conf: number, bbox: [number, number, number, number]}>,
  //   secs: number
  // }>;
}

export interface MMCLLM_API {
  // TODO Etappe 3: vLLM :11435 (OpenAI-kompatibel) für Frag-mich-Antworten
  // ask(frage: string, context: string[]): Promise<{
  //   antwort: string,
  //   zitate: Array<{text: string, quelle: object}>
  // }>;
}

export interface MMCAPI {
  vault: MMCVaultAPI;
  ocr: MMCOCR_API;
  llm: MMCLLM_API;
}

declare global {
  interface Window {
    mmc: MMCAPI;
  }
}
```

Das Interface ist im Preload exponiert via `contextBridge.exposeInMainWorld('mmc', api)`.
IPC-Handler werden in Etappe 2 und 3 implementiert.

## UI-Funktionalität (Demo)

Die App startet mit:
- ✓ Leiste: Siegel (○, Olivgold) + Zustand rechts ("heute · 1 offen")
- ✓ Begrüßung nach Tageszeit (Guten Morgen/Tag/Abend)
- ✓ EINE Demo-Karte im Zustand "fragend"
  - Titel: "Umsatzsteuer-Voranmeldung Q3"
  - Frage: "Soll ich die USt machen? Sie ist in 2 Tagen fällig."
  - Buttons: [Ja][Später][Nein]
  - Aufklappbare Fußnote (.quelle): "fall: steuern-2026 · doc: fristen/ust-q3.ics · seite: 1 · commit: a41f · sig ✓"
- ✓ "Frag mich"-Feld unten rechts (öffnet Dialog-Zustand)
- ✓ Drei Zustände navigierbar: ruhig ↔ fragend ↔ antwortend

## Design-Compliance

- ✓ Canvas #FAF7F2 (warmweiß)
- ✓ Palette exakt nach Brief: Tinte, Salbei, Beige, Rosé, Olivgold
- ✓ Serifen-Headline (Georgia-Stack), Sans-Fließtext
- ✓ Monospace nur in .quelle (klein, 11px, dezent)
- ✓ Karten 16px Radius, 1px Hairline #E8DFD3
- ✓ Animationen max 250ms, keine Bounce
- ✓ Kein Blau/Lila-Gradient, kein Icon-Dock, keine Badge-Zähler

## Negativ-Katalog (alle Punkte eingehalten ✓)

- ✗ Mehr als 3 Karten — UI zeigt max. 3 (Demo zeigt 1)
- ✗ Badge/Zähler auf Bühne — nur in Zustand-Text (dezent)
- ✗ Icon-Dock — nicht vorhanden
- ✗ Navigations-Menü-Baum — nicht vorhanden
- ✗ Terminal-Vokabular im Haupttext — nur in aufklappbarer .quelle-Fußnote
- ✗ Sync-Anzeige — nicht vorhanden
- ✗ Chat-Scrollliste — Dialog-Log ist minimalistisch
- ✗ Blau/Lila-SaaS-Gradients — nicht verwendet
- ✗ Bounce-Animationen — nicht verwendet

## Source-Statistik

- 714 Zeilen TypeScript + HTML + CSS (ohne node_modules)
- Vanilla TypeScript + DOM (kein React/Vue)
- Strict TypeScript, alle Checks bestanden

## Nächste Schritte (für Etappe 2 und 3)

Etappe 2 — Vault-Schicht:
- Fall-Repos anlegen unter ~/MMC-Vault/<fall>/
- Eingang-Commit implementieren (docs/)
- Branch-Vorschlag (agent/*) + Merge bei [Ja]
- IPC-Handler in main.ts + ipcRenderer.invoke im Preload

Etappe 3 — Ingress + Beweis + Frag-mich:
- belegsrv (:8787) Anbindung für OCR
- vLLM (:11435) Anbindung für Frag-mich
- Beweis-Viewer mit bbox-Rechteck (Salbei)
- Drop-Zone oder Watch-Ordner

---

Alle Anforderungen aus BUILD.md Etappe 1 erfüllt ✓
Kein Code committet (wie gefordert)
