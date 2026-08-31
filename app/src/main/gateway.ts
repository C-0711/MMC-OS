/**
 * gateway.ts — Gateway-Stub für Außenverkehr
 *
 * Laut technical-spec-v0.1.md ist :7906 der einzige Außen-Endpunkt.
 * vLLM (Adresse aus VLLM_URL, siehe .env.example) ist die lokale Route (:11435-Klasse).
 *
 * In v0.1 ist dies ein Platzhalter-Modul, das nur festhält (Kommentar + no-op),
 * dass Außenverkehr ausschließlich über :7906 ginge.
 *
 * KEIN echter Netzcode in diesem Modul — nur Dokumentation der Architektur.
 */

/**
 * Gateway-Konzept (v0.1 = stub):
 *
 * - Außenverkehr (Internet, nicht vertrauenswürdige Hosts) geht AUSSCHLIESSLICH
 *   über :7906 (Gateway-Prozess, nicht Teil dieser App).
 * - Lokale Dienste (belegsrv 127.0.0.1:8787, vLLM aus VLLM_URL) sind
 *   trusted local routes — kein Gateway nötig.
 * - Default-deny für den KI-Kern: tcpdump sollte zero outbound zeigen (außer
 *   zu den lokalen Routen).
 *
 * Wenn in einer späteren Phase echter Außenverkehr gebraucht wird:
 * - Requests gehen an localhost:7906
 * - Gateway entscheidet, was rausgeht (redigiert, signiert, geloggt)
 * - Gateway ist ein separater Prozess (nicht Teil von Electron-App)
 */

// Platzhalter-Funktion (no-op)
export function gatewayHealth(): boolean {
  // In v0.1 ist der Gateway nicht implementiert
  return false;
}

export function gatewayRequest(_endpoint: string, _payload: unknown): Promise<unknown> {
  // In v0.1 ist der Gateway nicht implementiert
  throw new Error('Gateway nicht implementiert (v0.1 stub)');
}
