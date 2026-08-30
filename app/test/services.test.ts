/**
 * services.test.ts — Unit-Tests für services.ts (node:test)
 */

import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ocrHealth, deuteBeleg, fragMich } from '../src/main/services';

describe('services', () => {
  // Mock fetch global vor jedem Test
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  describe('ocrHealth', () => {
    test('returns true on OK response', async () => {
      globalThis.fetch = mock.fn(async () => ({
        ok: true
      })) as any;

      const result = await ocrHealth();
      assert.equal(result, true);
    });

    test('returns false on network error', async () => {
      globalThis.fetch = mock.fn(async () => {
        throw new Error('Network error');
      }) as any;

      const result = await ocrHealth();
      assert.equal(result, false);
    });

    test('returns false on timeout', async () => {
      // Mock AbortSignal.timeout statt das eigentliche fetch zu verzögern
      globalThis.fetch = mock.fn(async (_url: any, options: any) => {
        // Simuliere Abort bei Timeout
        if (options?.signal) {
          throw new DOMException('AbortError', 'AbortError');
        }
        return { ok: true };
      }) as any;

      const result = await ocrHealth();
      assert.equal(result, false);
    });
  });

  describe('deuteBeleg', () => {
    test('builds correct multipart request and maps response', async () => {
      let capturedBody: FormData | null = null;

      globalThis.fetch = mock.fn(async (url: any, options: any) => {
        capturedBody = options?.body as FormData;
        return {
          ok: true,
          json: async () => ({
            name: 'test.jpg',
            pages_total: 1,
            total_ms: 474.4,
            source: 'vision-ane',
            pages: [
              {
                index: 0,
                width: 1148,
                height: 2040,
                ocr_ms: 447.5,
                lines: [
                  {
                    bbox: [0.364, 0.0, 0.258, 0.013],
                    text: 'Test',
                    conf: 1.0
                  }
                ]
              }
            ]
          })
        };
      }) as any;

      const result = await deuteBeleg({
        name: 'test.jpg',
        bytes: Buffer.from('fake-image-data')
      });

      // Prüfe Request-Body
      assert.ok(capturedBody);

      // Prüfe camelCase-Mapping
      assert.equal(result.name, 'test.jpg');
      assert.equal(result.pagesTotal, 1);
      assert.equal(result.totalMs, 474.4);
      assert.equal(result.pages.length, 1);
      assert.equal(result.pages[0].index, 0);
      assert.equal(result.pages[0].width, 1148);
      assert.equal(result.pages[0].height, 2040);
      assert.equal(result.pages[0].lines.length, 1);

      // bbox UNVERÄNDERT (kein Y-Flip hier)
      assert.deepEqual(result.pages[0].lines[0].bbox, [0.364, 0.0, 0.258, 0.013]);
      assert.equal(result.pages[0].lines[0].text, 'Test');
      assert.equal(result.pages[0].lines[0].conf, 1.0);
    });

    test('throws on non-OK response', async () => {
      globalThis.fetch = mock.fn(async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })) as any;

      await assert.rejects(
        async () => await deuteBeleg({ name: 'x.jpg', bytes: Buffer.from('x') }),
        /OCR failed: 500/
      );
    });
  });

  describe('fragMich', () => {
    test('builds correct OpenAI payload with Fundstellen', async () => {
      let capturedPayload: any = null;

      globalThis.fetch = mock.fn(async (url: any, options: any) => {
        capturedPayload = JSON.parse(options?.body as string);
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Die Selbstbeteiligung beträgt 150 EUR.'
                }
              }
            ]
          })
        };
      }) as any;

      const result = await fragMich('Was ist die Selbstbeteiligung?', [
        {
          fall: 'versicherungen',
          doc: 'hausrat.pdf',
          seite: 4,
          text: 'Die Selbstbeteiligung beträgt 150,00 EUR je Schadenfall.'
        }
      ]);

      // Prüfe Payload
      assert.equal(capturedPayload.model, 'gemma4-mm');
      assert.equal(capturedPayload.temperature, 0);
      assert.equal(capturedPayload.max_tokens, 900);
      assert.equal(capturedPayload.messages.length, 2);
      assert.equal(capturedPayload.messages[0].role, 'system');
      assert.match(capturedPayload.messages[0].content, /ruhige Gesprächspartner/);
      assert.equal(capturedPayload.messages[1].role, 'user');
      assert.match(capturedPayload.messages[1].content, /Fundstellen:/);
      assert.match(capturedPayload.messages[1].content, /Fall "versicherungen"/);
      assert.match(capturedPayload.messages[1].content, /hausrat\.pdf/);
      assert.match(capturedPayload.messages[1].content, /Seite 4/);

      // Prüfe Antwort
      assert.equal(result.antwort, 'Die Selbstbeteiligung beträgt 150 EUR.');
    });

    test('reads choices[0].message.content', async () => {
      globalThis.fetch = mock.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Testantwort'
              }
            }
          ]
        })
      })) as any;

      const result = await fragMich('Test?', []);
      assert.equal(result.antwort, 'Testantwort');
    });

    test('throws on non-OK response', async () => {
      globalThis.fetch = mock.fn(async () => ({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      })) as any;

      await assert.rejects(
        async () => await fragMich('Test?', []),
        /vLLM failed: 503/
      );
    });
  });

  describe('Live-Test (optional)', () => {
    test('real ocrHealth check (skips if unreachable)', async () => {
      // Restore original fetch
      globalThis.fetch = originalFetch;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        const response = await fetch('http://127.0.0.1:8787/health', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          // Dienst läuft → echten Test machen
          const health = await ocrHealth();
          assert.equal(health, true, 'belegsrv should be healthy');
        } else {
          console.log('⏭️  belegsrv not reachable, skipping live test');
        }
      } catch {
        console.log('⏭️  belegsrv not reachable, skipping live test');
      }
    });
  });
});
