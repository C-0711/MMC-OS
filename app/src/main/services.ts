/**
 * services.ts — Node-Modul für externe Dienste (OCR, vLLM)
 * KEINE Electron-Imports, nur native Node 22-APIs (fetch, FormData, Blob)
 */

const BELEGSRV_URL = process.env.BELEGSRV_URL || 'http://127.0.0.1:8787';
const VLLM_URL = process.env.VLLM_URL || 'http://192.168.145.10:11435';
const VLLM_MODEL = process.env.VLLM_MODEL || 'gemma4-mm';

// ============================================================================
// OCR Health Check
// ============================================================================

export async function ocrHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${BELEGSRV_URL}/health`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// OCR-Typen
// ============================================================================

export interface OcrLine {
  bbox: [number, number, number, number]; // [x, y, w, h] normalisiert 0..1
  text: string;
  conf: number;
}

export interface OcrPage {
  index: number;
  width: number;
  height: number;
  lines: OcrLine[];
}

export interface OcrErgebnis {
  name: string;
  pagesTotal: number;
  totalMs: number;
  pages: OcrPage[];
}

// ============================================================================
// Beleg-Deutung
// ============================================================================

export async function deuteBeleg(datei: {
  name: string;
  bytes: Buffer | Uint8Array;
  mime?: string;
}): Promise<OcrErgebnis> {
  // FormData mit Blob (nativ in Node 22)
  const formData = new FormData();
  const blob = new Blob([datei.bytes as any], {
    type: datei.mime || 'application/octet-stream'
  });
  formData.append('file', blob, datei.name);

  const response = await fetch(`${BELEGSRV_URL}/v1/ocr`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`OCR failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as {
    name: string;
    pages_total: number;
    total_ms: number;
    pages: Array<{
      index: number;
      width: number;
      height: number;
      lines: Array<{
        bbox: [number, number, number, number];
        text: string;
        conf: number;
      }>;
    }>;
  };

  // Snake_case → camelCase
  return {
    name: result.name,
    pagesTotal: result.pages_total,
    totalMs: result.total_ms,
    pages: result.pages.map(p => ({
      index: p.index,
      width: p.width,
      height: p.height,
      lines: p.lines
    }))
  };
}

// ============================================================================
// Frag-mich-Typen
// ============================================================================

export interface ZitatKontext {
  fall: string;
  doc: string;
  seite: number;
  text: string;
}

// ============================================================================
// Frag-mich gegen vLLM
// ============================================================================

export async function fragMich(
  frage: string,
  kontext: ZitatKontext[]
): Promise<{ antwort: string }> {
  // System-Prompt + nummerierte Fundstellen.
  // Ziel: vollständige, belegte Antworten — nicht knapp um der Kürze willen.
  const systemPrompt = `Du bist der ruhige Gesprächspartner von gitchain OS, einer Beleg-Verwaltung mit Beweispflicht. Deutsch, sachlich, ohne Floskeln.

Regeln:
1. Stütze dich AUSSCHLIESSLICH auf die mitgegebenen Fundstellen. Nichts erfinden, nichts aus Weltwissen ergänzen.
2. Antworte VOLLSTÄNDIG: nenne ALLE Fundstellen, die zur Frage passen, nicht nur die erste. Beträge, Daten, Namen und Kennziffern exakt so wiedergeben, wie sie in der Fundstelle stehen (deutsches Zahlenformat beibehalten).
3. Zitiere jede Aussage mit ihrer Fundstellen-Nummer in eckigen Klammern, z. B. [2]. Eine Aussage ohne [n] zählt nicht.
4. Bei Summen- oder Vergleichsfragen: Einzelwerte mit [n] auflisten, dann das Ergebnis vorrechnen.
5. Widersprüche zwischen Fundstellen offen benennen ([3] sagt X, [5] sagt Y) — nicht stillschweigend eine Seite wählen.
6. Als "unbestätigter Vorschlag" markierte Fundstellen sind noch nicht geprüft — kennzeichne Aussagen daraus als unbestätigt.
7. Wenn die Fundstellen die Frage nur teilweise oder gar nicht beantworten: sag klar, was fehlt, in einer Schlusszeile "Fehlt: …". Rate nicht.`;

  const fundstellen = kontext
    .map((k, i) => `[${i + 1}] Fall "${k.fall}", ${k.doc}, Seite ${k.seite}:\n${k.text}`)
    .join('\n\n');

  const userMessage = fundstellen
    ? `Fundstellen:\n${fundstellen}\n\nFrage: ${frage}\n\nAntworte vollständig mit [n]-Belegen; nenne am Ende, was zur Beantwortung fehlt, falls etwas fehlt.`
    : `Es liegen KEINE Fundstellen vor.\n\nFrage: ${frage}\n\nSag ehrlich, dass ohne Fundstellen keine belegte Antwort möglich ist, und nenne, welche Art Beleg die Frage beantworten würde.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(`${VLLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: VLLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0,
      max_tokens: 900
    }),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`vLLM failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  };

  return {
    antwort: result.choices[0]?.message?.content || ''
  };
}
