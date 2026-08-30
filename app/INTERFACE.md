# window.mmc Preload-Interface — TypeScript-Signaturen

Das `window.mmc`-API wird im Renderer-Prozess über `contextBridge` exponiert.
Definiert in: `src/main/preload.ts`

## Status

✅ **Etappe 3 (Integration) abgeschlossen** — IPC-Handler implementiert und getestet

## API-Übersicht

### Vault-API

```typescript
interface MMCVaultAPI {
  listFaelle(): Promise<FallInfo[]>;
  createFall(id: string): Promise<FallInfo>;
  commitEingang(
    fallId: string,
    quelle: { absender: string; kanal: string },
    datei: { name: string; bytes: ArrayBuffer }
  ): Promise<{ sha: string; docPfad: string }>;
  proposeDeutung(
    fallId: string,
    proposalId: string,
    atoms: Atom[],
    kartentext: { titel: string; frage: string }
  ): Promise<{ branch: string; sha: string }>;
  listVorschlaege(fallId: string): Promise<Vorschlag[]>;
  mergeVorschlag(fallId: string, proposalId: string): Promise<{ sha: string }>;
  rejectVorschlag(fallId: string, proposalId: string, grund?: string): Promise<void>;
  fallErzaehlung(fallId: string): Promise<ErzaehlSatz[]>;
  readDocAsDataUrl(fallId: string, docRelPath: string): Promise<string>;
}
```

### OCR-API

```typescript
interface MMCOCR_API {
  health(): Promise<boolean>;
  deuteBeleg(datei: { name: string; bytes: ArrayBuffer; mime?: string }): Promise<OcrErgebnis>;
  deutungAusOcr(ocr: OcrErgebnis, docName: string): Promise<DeutungErgebnis>;
}

interface DeutungErgebnis {
  atoms: Atom[];
  kartentext: { titel: string; frage: string };
  zweifel: boolean; // niedrige Konfidenz oder 0 Beträge
}
```

Die Betrags-Heuristik lebt AUSSCHLIESSLICH im Main-Prozess
(`src/main/deutung.ts`, IPC-Kanal `deutung:ausOcr`) — der Renderer
dupliziert sie nicht.

### LLM-API

```typescript
interface MMCLLM_API {
  fragMich(frage: string, kontext: ZitatKontext[]): Promise<{ antwort: string }>;
}
```

## Verwendung im Renderer

```typescript
// Fälle auflisten
const faelle = await window.mmc.vault.listFaelle();

// Fall anlegen
const fall = await window.mmc.vault.createFall('steuern-2026');

// Eingang committen
const { sha, docPfad } = await window.mmc.vault.commitEingang(
  'steuern-2026',
  { absender: 'Finanzamt', kanal: 'whatsapp' },
  { name: 'beleg.jpg', bytes: arrayBuffer }
);

// OCR
const ocr = await window.mmc.ocr.deuteBeleg({
  name: 'beleg.jpg',
  bytes: arrayBuffer
});

// Deutung vorschlagen
await window.mmc.vault.proposeDeutung(fallId, proposalId, atoms, kartentext);

// Vorschläge holen
const vorschlaege = await window.mmc.vault.listVorschlaege(fallId);

// Vorschlag mergen
await window.mmc.vault.mergeVorschlag(fallId, proposalId);

// Fall-Erzählung
const erzaehlung = await window.mmc.vault.fallErzaehlung(fallId);

// Frag-mich
const { antwort } = await window.mmc.llm.fragMich(frage, kontexte);
```

## Implementierung

- IPC-Handler: `src/main/ipc.ts`
- Main-Registrierung: `src/main/main.ts`
- Preload-Bridge: `src/main/preload.ts`
