/**
 * gitchain.ts — Anbindung an den 0711-GitChain-Backend.
 *
 * Verträge (docs/backend-stand-h200v.md, live sondiert 2026-08-30):
 *   GITCHAIN_API_URL  (default https://api-gitchain.0711.io)
 *     - git smart HTTP:  /git/<typ>/<ns>/<id>.git   (HTTP Basic, PAT im Passwortfeld)
 *     - PAT-Introspection: GET /v1/user             (anonym → 401, das ist der Vertrag)
 *     - OCP v1:          /api/ocp/v1/registry …
 *     - Health:          /api/v2/health
 *   GITCHAIN_AUTH_URL (default https://gitchain.de)
 *     - Device-Login: POST /auth/device/start → {user_code, device_code, verify_url, interval, expires_in}
 *                     POST /auth/device/poll  {device_code}
 *
 * Bau-Regeln (verbindlich):
 *   1. Mandant kommt aus dem PAT — hier werden NIE Tenant-Header gesetzt.
 *   3. 200 beweist nichts — jede Antwort wird per Feld-Assert geprüft.
 *   5. *_url-Felder aus Antworten werden NICHT übernommen — alles relativ zur Basis.
 *   +  Retries mit Backoff bei 5xx (kurze Wartungsfenster sind angekündigt möglich).
 *
 * PAT-Verwahrung: Electron safeStorage (macOS: Keychain-gestützt) → verschlüsselte
 * Datei im userData-Verzeichnis. Klartext liegt nie auf der Platte (Spec: Keys in
 * OS-Keychain, niemals im Container). Ohne Verschlüsselung: fail-closed.
 */

import { app, safeStorage } from 'electron';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const API_URL = (process.env.GITCHAIN_API_URL || 'https://api-gitchain.0711.io').replace(/\/+$/, '');
const AUTH_URL = (process.env.GITCHAIN_AUTH_URL || 'https://gitchain.de').replace(/\/+$/, '');
const GIT_TYP = process.env.GITCHAIN_TYP || 'fall';
const GIT_NS = process.env.GITCHAIN_NS || 'mmc';

// ============================================================================
// Fetch mit Backoff (Bau-Regel: Retries statt harter Fehler beim ersten 5xx)
// ============================================================================

async function fetchMitBackoff(url: string, init?: RequestInit, versuche = 3): Promise<Response> {
  let letzter: unknown = null;
  for (let i = 0; i < versuche; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
      if (res.status < 500) return res;
      letzter = new Error(`HTTP ${res.status}`);
    } catch (e) {
      letzter = e;
    }
    if (i < versuche - 1) await new Promise(r => setTimeout(r, 500 * 2 ** i));
  }
  throw letzter instanceof Error ? letzter : new Error(String(letzter));
}

// ============================================================================
// PAT-Verwahrung (safeStorage, fail-closed)
// ============================================================================

function patDatei(): string {
  return path.join(app.getPath('userData'), 'gitchain-pat.enc');
}

export function hatPat(): boolean {
  return fs.existsSync(patDatei());
}

function speicherePat(pat: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Keine OS-Verschlüsselung verfügbar — PAT wird nicht gespeichert (fail-closed).');
  }
  fs.writeFileSync(patDatei(), safeStorage.encryptString(pat), { mode: 0o600 });
}

function lesePat(): string | null {
  if (!fs.existsSync(patDatei())) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  return safeStorage.decryptString(fs.readFileSync(patDatei()));
}

export function vergissPat(): void {
  if (fs.existsSync(patDatei())) fs.unlinkSync(patDatei());
}

// ============================================================================
// Device-Login (gitchain.de)
// ============================================================================

export interface DeviceStart {
  userCode: string;
  deviceCode: string;
  verifyUrl: string;
  intervalSek: number;
  expiresInSek: number;
}

export async function deviceStart(): Promise<DeviceStart> {
  const res = await fetchMitBackoff(`${AUTH_URL}/auth/device/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const j = (await res.json()) as Record<string, unknown>;
  // Feld-Assert (Bau-Regel 3)
  if (typeof j.user_code !== 'string' || typeof j.device_code !== 'string') {
    throw new Error(`Device-Start ohne user_code/device_code: ${JSON.stringify(j).slice(0, 200)}`);
  }
  // verify_url NICHT blind übernehmen (Bau-Regel 5): nur akzeptieren, wenn sie
  // auf unserer Auth-Basis liegt, sonst aus der Basis neu bauen.
  let verifyUrl = typeof j.verify_url === 'string' ? j.verify_url : '';
  if (!verifyUrl.startsWith(`${AUTH_URL}/`)) {
    verifyUrl = `${AUTH_URL}/auth/device?code=${encodeURIComponent(j.user_code)}`;
  }
  return {
    userCode: j.user_code,
    deviceCode: j.device_code,
    verifyUrl,
    intervalSek: typeof j.interval === 'number' ? j.interval : 3,
    expiresInSek: typeof j.expires_in === 'number' ? j.expires_in : 600
  };
}

export type PollErgebnis =
  | { status: 'ok'; user: string | null }
  | { status: 'wartet' }
  | { status: 'fehler'; meldung: string };

/** Ein einzelner Poll-Schritt. Der Renderer ruft ihn im Intervall auf. */
export async function devicePoll(deviceCode: string): Promise<PollErgebnis> {
  const res = await fetchMitBackoff(`${AUTH_URL}/auth/device/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode })
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  // Erfolgsform: irgendein Token-Feld (Schema live noch nicht gesehen — defensiv).
  const pat = [j.pat, j.token, j.access_token].find(v => typeof v === 'string' && v.length > 0) as
    | string
    | undefined;
  if (pat) {
    speicherePat(pat);
    const wer = await whoami();
    return { status: 'ok', user: wer.ok ? wer.user : null };
  }

  // Bekannte Fehlerform (live sondiert): {"error":"Code unbekannt oder abgelaufen — …"}
  const err = typeof j.error === 'string' ? j.error : '';
  if (/abgelaufen|unbekannt|expired|invalid|denied/i.test(err)) {
    return { status: 'fehler', meldung: err };
  }
  return { status: 'wartet' };
}

// ============================================================================
// PAT-Introspection: GET /v1/user (der Verbindungsnachweis)
// ============================================================================

export type WhoamiErgebnis =
  | { ok: true; user: string; raw: Record<string, unknown> }
  | { ok: false; meldung: string };

export async function whoami(): Promise<WhoamiErgebnis> {
  const pat = lesePat();
  if (!pat) return { ok: false, meldung: 'Kein PAT verwahrt — erst anmelden.' };

  // Erst Bearer, dann Basic (PAT im Passwortfeld — so will es der git-Vertrag).
  for (const auth of [
    `Bearer ${pat}`,
    `Basic ${Buffer.from(`pat:${pat}`).toString('base64')}`
  ]) {
    const res = await fetchMitBackoff(`${API_URL}/v1/user`, {
      headers: { Authorization: auth }
    });
    if (res.status === 401) continue;
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    // Feld-Assert (Bau-Regel 3): ohne Identitätsfeld gilt die Antwort als kaputt.
    const user = j && [j.user, j.username, j.login, j.name, j.sub].find(v => typeof v === 'string');
    if (typeof user === 'string') return { ok: true, user, raw: j! };
    return { ok: false, meldung: `Antwort ohne Identitätsfeld (HTTP ${res.status}).` };
  }
  return { ok: false, meldung: 'PAT abgelehnt (401 mit Bearer und Basic).' };
}

// ============================================================================
// OCP-Registry (Sichtbarkeit der Container)
// ============================================================================

export async function registry(): Promise<{ version: string; count: number; ids: string[] }> {
  const pat = lesePat();
  const res = await fetchMitBackoff(`${API_URL}/api/ocp/v1/registry`, {
    headers: pat ? { Authorization: `Bearer ${pat}` } : {}
  });
  const j = (await res.json()) as Record<string, unknown>;
  if (typeof j.version !== 'string' || !j.version.startsWith('ocp/')) {
    throw new Error(`Registry-Antwort ohne ocp-Version: ${JSON.stringify(j).slice(0, 200)}`);
  }
  const container = Array.isArray(j.containers) ? (j.containers as Array<Record<string, unknown>>) : [];
  return {
    version: j.version,
    count: typeof j.count === 'number' ? j.count : container.length,
    ids: container.map(c => String(c.id ?? '')).filter(Boolean).slice(0, 50)
  };
}

// ============================================================================
// Fall-Push: git push des lokalen Fall-Repos zum Backend
// ============================================================================

/** Askpass-Helfer: hält den PAT aus argv/Platte heraus (nur env des Kindprozesses). */
function askpassHelfer(): string {
  const pfad = path.join(app.getPath('userData'), 'gitchain-askpass.sh');
  const inhalt = `#!/bin/sh
case "$1" in
  *sername*) echo "pat" ;;
  *) printf '%s' "$MMC_GITCHAIN_PAT" ;;
esac
`;
  fs.writeFileSync(pfad, inhalt, { mode: 0o700 });
  return pfad;
}

function gitLauf(args: string[], cwd: string, pat: string): Promise<{ code: number; out: string }> {
  return new Promise(resolve => {
    const kind = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: askpassHelfer(),
        MMC_GITCHAIN_PAT: pat
      }
    });
    let out = '';
    kind.stdout.on('data', d => (out += d));
    kind.stderr.on('data', d => (out += d));
    kind.on('close', code => resolve({ code: code ?? -1, out }));
  });
}

export interface PushErgebnis {
  ok: boolean;
  remoteUrl: string;
  meldung: string;
  remoteRefs: string[];
}

/**
 * Pusht den Fall (main + alle agent/*-Branches) nach
 * ${API_URL}/git/<typ>/<ns>/<fallId>.git und verifiziert per ls-remote,
 * dass refs/heads/main drüben liegt (Feld-Assert statt Exit-Code-Glaube).
 */
export async function pushFall(fallId: string): Promise<PushErgebnis> {
  const pat = lesePat();
  if (!pat) return { ok: false, remoteUrl: '', meldung: 'Kein PAT verwahrt — erst anmelden.', remoteRefs: [] };

  if (!/^[A-Za-z0-9._-]+$/.test(fallId)) {
    return { ok: false, remoteUrl: '', meldung: `Unzulässige Fall-ID: ${fallId}`, remoteRefs: [] };
  }
  const vaultRoot = process.env.MMC_VAULT ?? path.join(require('os').homedir(), 'MMC-Vault');
  const fallPfad = path.join(vaultRoot, fallId);
  if (!fs.existsSync(path.join(fallPfad, '.git'))) {
    return { ok: false, remoteUrl: '', meldung: `Kein git-Repo unter ${fallPfad}`, remoteRefs: [] };
  }

  const remoteUrl = `${API_URL}/git/${GIT_TYP}/${GIT_NS}/${fallId}.git`;

  const push = await gitLauf(['push', '--all', remoteUrl], fallPfad, pat);
  if (push.code !== 0) {
    return { ok: false, remoteUrl, meldung: push.out.trim().slice(0, 500), remoteRefs: [] };
  }

  // Gegenprobe: ls-remote muss main zeigen (200/Exit 0 allein beweist nichts).
  const ls = await gitLauf(['ls-remote', remoteUrl], fallPfad, pat);
  const refs = ls.out
    .split('\n')
    .filter(z => z.includes('\t'))
    .map(z => z.split('\t')[1]);
  const hatMain = refs.includes('refs/heads/main');
  return {
    ok: ls.code === 0 && hatMain,
    remoteUrl,
    meldung: hatMain ? `Verifiziert: ${refs.length} Refs, main liegt drüben.` : `Push ok, aber main fehlt im ls-remote: ${ls.out.trim().slice(0, 300)}`,
    remoteRefs: refs
  };
}

// ============================================================================
// Signal-Transport (Etappe D): Signaling-Einträge als Commits in einem
// lokalen Signal-Fall, gepusht/gepullt über den selben git-Transport.
// Kein neuer Backend-Endpunkt — die Registry IST der Signal-Anker.
// ============================================================================

function signalFallPfad(id: string): string {
  const vaultRoot = process.env.MMC_VAULT ?? path.join(require('os').homedir(), 'MMC-Vault');
  return path.join(vaultRoot, `mmc-signal-${id}`);
}

/** Signal als Commit in den lokalen Signal-Fall schreiben, dann pushen. */
export async function pushSignal(fallSignalName: string, inhalt: string): Promise<void> {
  const pat = lesePat();
  if (!pat) throw new Error('Kein PAT verwahrt — erst anmelden.');

  const pfad = signalFallPfad(fallSignalName.replace(/^mmc-signal-/, ''));
  fs.mkdirSync(path.join(pfad, 'docs'), { recursive: true });
  if (!fs.existsSync(path.join(pfad, '.git'))) {
    const init = await gitLauf(['init', '-b', 'main'], pfad, pat);
    if (init.code !== 0) throw new Error(`git init fehlgeschlagen: ${init.out}`);
  }
  const datei = path.join(pfad, 'docs', `signal-${Date.now()}.json`);
  fs.writeFileSync(datei, inhalt);
  await gitLauf(['add', '.'], pfad, pat);
  const commit = await gitLauf(['commit', '-m', `signal: ${new Date().toISOString()}`, '--allow-empty'], pfad, pat);
  if (commit.code !== 0 && !/nothing to commit/.test(commit.out)) {
    throw new Error(`git commit fehlgeschlagen: ${commit.out.slice(0, 200)}`);
  }
  const remoteUrl = `${API_URL}/git/${GIT_TYP}/${GIT_NS}/${fallSignalName}.git`;
  const push = await gitLauf(['push', '-u', 'origin', 'main', remoteUrl], pfad, pat);
  // Push-Fehler sind kein harter Fehler — der nächste Poll holt nach.
  if (push.code !== 0) logWarn(`pushSignal push fehlgeschlagen: ${push.out.slice(0, 200)}`);
}

/** Signale seit `seitIso` aus dem Remote pullen (Felder geprüft). */
export async function pullSignal(fallSignalName: string, seitIso: string | null): Promise<string[]> {
  const pat = lesePat();
  if (!pat) return [];

  const pfad = signalFallPfad(fallSignalName.replace(/^mmc-signal-/, ''));
  fs.mkdirSync(pfad, { recursive: true });
  if (!fs.existsSync(path.join(pfad, '.git'))) return []; // noch nichts da — still

  const remoteUrl = `${API_URL}/git/${GIT_TYP}/${GIT_NS}/${fallSignalName}.git`;
  await gitLauf(['pull', remoteUrl, 'main'], pfad, pat); // kein Fehler bei leer

  const seit = seitIso ? `--since=${seitIso}` : '-20';
  const logOut = await gitLauf(['log', 'main', seit, '--format=%b'], pfad, pat);
  if (logOut.code !== 0) return [];
  // Signal-Commits tragen die Nachricht im Body — wir lesen die JSON-Dateien direkter:
  const docs = path.join(pfad, 'docs');
  try {
    const dateien = fs.readdirSync(docs).filter(f => f.endsWith('.json')).sort();
    const roh: string[] = [];
    for (const d of dateien.slice(-50)) {
      try {
        const n = JSON.parse(fs.readFileSync(path.join(docs, d), 'utf8')) as { zeit?: string };
        if (seitIso && n.zeit && n.zeit <= seitIso) continue;
        roh.push(fs.readFileSync(path.join(docs, d), 'utf8'));
      } catch { continue; }
    }
    return roh;
  } catch {
    return [];
  }
}

function logWarn(meldung: string): void {
  // gitchain.ts hat keinen log-Import (Zirkulargefahr mit electron) —
  // console als stiller Fallback; main.ts loggt ohnehin global.
  console.warn(`[gitchain] ${meldung}`);
}

// ============================================================================
// Status (für die UI)
// ============================================================================

export async function status(): Promise<{
  apiUrl: string;
  angemeldet: boolean;
  user: string | null;
}> {
  if (!hatPat()) return { apiUrl: API_URL, angemeldet: false, user: null };
  const wer = await whoami();
  return { apiUrl: API_URL, angemeldet: wer.ok, user: wer.ok ? wer.user : null };
}
