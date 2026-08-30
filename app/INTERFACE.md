# window.mmc Preload-Interface — TypeScript-Signaturen

Das `window.mmc`-API wird im Renderer-Prozess über `contextBridge` exponiert.
Definiert in: `src/main/preload.ts`

## Type-Definitionen

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

## Verwendung im Renderer

```typescript
// Beispiel für Etappe 2 (Vault):
// const fallId = await window.mmc.vault.createFall('steuern-2026');
// const commitHash = await window.mmc.vault.commitEingang(fallId, fileBuffer, {
//   absender: 'Finanzamt',
//   ts: new Date().toISOString()
// });

// Beispiel für Etappe 3 (OCR):
// const result = await window.mmc.ocr.deuteBeleg(imageBuffer);
// console.log(`${result.zeilen.length} Zeilen erkannt in ${result.secs}s`);

// Beispiel für Etappe 3 (LLM):
// const antwort = await window.mmc.llm.ask(
//   'Was habe ich mit Weber vereinbart?',
//   [atomText1, atomText2]
// );
// console.log(antwort.antwort);
// antwort.zitate.forEach(z => console.log(z.text, z.quelle));
```

## Implementierung der IPC-Handler

Die entsprechenden `ipcMain.handle()` werden in Etappe 2 und 3 in `src/main/main.ts` hinzugefügt.

## Status

- ✓ Struktur angelegt (leere Namespaces)
- ✓ TypeScript-Typen definiert
- ✓ contextBridge exponiert
- ⏳ Etappe 2: Vault-Handler implementieren
- ⏳ Etappe 3: OCR + LLM-Handler implementieren
