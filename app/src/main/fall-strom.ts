/**
 * fall-strom.ts — Der Fall als Chat: geteilter Strom + private Spur (AUFTRAG §2).
 *
 * Geteilt: Branch 'strom' im Fall-Repo. Jede Zeile (Text, Wurf, Anruf, …)
 * ist ein Commit auf eine chronologische Datei strom/NNNN-<slug>.<ext>.
 * Privat: Ref refs/privat/<did> — Commits NUR auf dem Ref (Working Tree
 * bleibt sauber), vom Sync ausgeschlossen (Whitelist: nur 'strom').
 * Teilen: cherry-pick vom Privat-Ref auf 'strom' mit Teilungs-Zeitpunkt.
 */

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const execFileP = promisify(execFile);

function vaultRoot(): string {
  return process.env.MMC_VAULT ?? path.join(os.homedir(), 'MMC-Vault');
}

function fallPfad(fallId: string): string {
  // Fall-Container heißen <id> direkt; Kontakt-Container kontakt-<slug>.
  return path.join(vaultRoot(), fallId);
}

async function git(fallId: string, args: string[]): Promise<string> {
  const cwd = fallPfad(fallId);
  const { stdout } = await execFileP('git', ['-C', cwd, ...args], {
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env },
  });
  return stdout;
}

// ============================================================================
// Strom-Typen (die sechs Formen aus §4 als Daten)
// ============================================================================

export type StromTyp = 'text' | 'wurf' | 'anruf' | 'arbeit' | 'qa' | 'vorschlag' | 'ding';

export interface StromEintrag {
  nummer: number;
  typ: StromTyp;
  inhalt: string;
  von: string;
  zeitIso: string;
  sha: string;
}

/** Sync-Vertrag: nur der geteilte Strom verlässt das Gerät (AUFTRAG §2). */
export function syncWhitelist(): string[] {
  return ['strom'];
}

// ============================================================================
// Strom: Commit-pro-Eintrag auf Branch 'strom'
// ============================================================================

const ENDUNG: Record<StromTyp, string> = {
  text: 'md', wurf: 'json', anruf: 'json', arbeit: 'json',
  qa: 'json', vorschlag: 'json', ding: 'json',
};

async function stromPfadExistiert(fallId: string): Promise<boolean> {
  try {
    await fsp.access(path.join(fallPfad(fallId), '.git'));
    return true;
  } catch {
    return false;
  }
}

/** Nächste laufende Nummer im Strom (aus ls-tree). */
async function naechsteNummer(fallId: string): Promise<number> {
  const tree = await git(fallId, ['ls-tree', '--name-only', 'strom', 'strom/']).catch(() => '');
  let max = 0;
  for (const zeile of tree.split('\n')) {
    const m = zeile.trim().match(/^strom\/(\d{4})-/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/**
 * Legt einen Strom-Eintrag an: EIN Commit auf Branch 'strom'.
 * hineinlegen IST mitteilen (AUFTRAG §3.1) — kein zweiter Zustell-Schritt.
 */
export async function stromEintrag(
  fallId: string,
  eintrag: { typ: StromTyp; inhalt: string; von: string; payload?: Record<string, unknown> }
): Promise<{ nummer: number; sha: string; datei: string }> {
  if (!(await stromPfadExistiert(fallId))) {
    throw new Error(`Fall ${fallId} existiert nicht`);
  }

  // Branch strom anlegen, wenn fehlt
  try {
    await git(fallId, ['rev-parse', '--verify', 'strom']);
  } catch {
    await git(fallId, ['branch', 'strom']);
  }

  const nummer = await naechsteNummer(fallId);
  const slug = eintrag.inhalt.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'eintrag';
  const datei = `strom/${String(nummer).padStart(4, '0')}-${slug}.${ENDUNG[eintrag.typ]}`;
  const zeitIso = new Date().toISOString();

  // Payload je Typ (Formen-Mapping)
  const body = eintrag.typ === 'text'
    ? eintrag.inhalt
    : JSON.stringify({ typ: eintrag.typ, inhalt: eintrag.inhalt, von: eintrag.von, zeit: zeitIso, ...(eintrag.payload ?? {}) }, null, 2);

  // Datei auf den strom-Branch committen — ohne den Working Tree zu wechseln:
  // blob via hash-object + update-index auf einem temporären Index? Einfacher
  // und git-ehrlich: checkout strom, schreiben, committen, zurück zu main.
  await git(fallId, ['checkout', 'strom']);
  try {
    await fsp.mkdir(path.join(fallPfad(fallId), 'strom'), { recursive: true });
    await fsp.writeFile(path.join(fallPfad(fallId), datei), body);
    await git(fallId, ['add', datei]);
    await git(fallId, ['commit', '-m', `strom:${eintrag.typ}: ${eintrag.inhalt.slice(0, 120)}`]);
  } finally {
    await git(fallId, ['checkout', 'main']).catch(() => {});
  }
  const sha = (await git(fallId, ['rev-parse', `strom:${datei}`])).trim();
  return { nummer, sha, datei };
}

/** Der Strom, chronologisch (für das Chat-Fenster). */
export async function listeStrom(fallId: string): Promise<StromEintrag[]> {
  const log = await git(fallId, [
    'log', 'strom', '--format=%aI%x00%s%x00%b%x00%H%x1E',
  ]).catch(() => '');
  const eintraege: StromEintrag[] = [];
  for (const block of log.split('\x1E')) {
    if (!block.trim()) continue;
    const [zeit, subject, _body, sha] = block.split('\x00').map(s => (s || '').trim());
    const m = subject.match(/^strom:(\w+):\s*(.*)$/);
    if (!m) continue;
    eintraege.push({
      nummer: 0, // Nummer aus Datei, unten nachgefüllt
      typ: m[1] as StromTyp,
      inhalt: m[2],
      von: '—',
      zeitIso: zeit,
      sha,
    });
  }
  // Nummern aus den Dateinamen
  const tree = await git(fallId, ['ls-tree', '--name-only', 'strom', 'strom/']).catch(() => '');
  for (const zeile of tree.split('\n')) {
    const m = zeile.trim().match(/^strom\/(\d{4})-/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    // jüngster Commit für diese Datei
    const shaZeile = await git(fallId, ['log', 'strom', '-1', '--format=%H', '--', zeile.trim()]).catch(() => '');
    const sha = shaZeile.trim();
    const eintrag = eintraege.find(e => e.sha === sha);
    if (eintrag) eintrag.nummer = n;
  }
  return eintraege.sort((a, b) => a.nummer - b.nummer);
}

// ============================================================================
// Private Spur: Ref refs/privat/<did>, NIE im Sync
// ============================================================================

export interface PrivatEintrag {
  art: 'suche' | 'frage';
  inhalt: string;
  ergebnis?: string;
  zeitIso: string;
  sha: string;
  geteiltIso?: string;
}

function privatRef(did: string): string {
  // Git-Ref-Namen erlauben keine ':', '<', '>' etc. — DID wird gesluggt.
  // Der Ref bleibt eindeutig pro Person (did:test:anna → did-test-anna).
  const sicher = did.toLowerCase()
    .replace(/[:<>*?\[\]\\"\\]/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `refs/privat/${sicher}`;
}

/** git-Befehl mit stdin (für mktree) — promise-basiert. */
function spawnStdin(cwd: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const kind = spawn('git', ['-C', cwd, ...args]);
    let out = '';
    let err = '';
    kind.stdout.on('data', d => { out += d; });
    kind.stderr.on('data', d => { err += d; });
    kind.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err || `git ${args.join(' ')} exit ${code}`)));
    kind.on('error', reject);
    kind.stdin.write(stdin);
    kind.stdin.end();
  });
}

async function refExistiert(fallId: string, ref: string): Promise<boolean> {
  try {
    await git(fallId, ['rev-parse', '--verify', ref]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Privater Eintrag: Commit NUR auf den Ref — ohne Branch, ohne Working Tree.
 * git commit-tree ist der ehrliche Weg: Baum bauen aus dem Eltern-Commit des
 * Refs, neuen Commit setzen, Ref bewegen.
 */
export async function privatEintrag(
  did: string,
  fallId: string,
  eintrag: { art: 'suche' | 'frage'; inhalt: string; ergebnis?: string }
): Promise<{ sha: string }> {
  const zeitIso = new Date().toISOString();

  // Anfangsbaum: leer oder vom letzten Privat-Commit
  let baum: string;
  if (await refExistiert(fallId, privatRef(did))) {
    baum = (await git(fallId, ['rev-parse', `${privatRef(did)}^{tree}`])).trim();
  } else {
    // Der berühmte leere Baum (hash of empty tree) — git-eigen, kein Objektschreiben
    baum = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  }

  // Datei-Blob für den Eintrag
  const inhalt = JSON.stringify({ ...eintrag, zeit: zeitIso }, null, 2);
  const tmp = path.join(os.tmpdir(), `privat-${Date.now()}.json`);
  await fsp.writeFile(tmp, inhalt);
  const blob = (await execFileP('git', ['-C', fallPfad(fallId), 'hash-object', '-w', tmp])).stdout.trim();
  await fsp.rm(tmp, { force: true });

  // Baum erweitern: <art>-<slug>.json dazu (read-tree + update-index umständlich —
  // wir bauen den Baum per mktree aus dem alten + dem neuen Eintrag)
  const slug = eintrag.inhalt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'eintrag';
  const name = `${eintrag.art}-${Date.now()}-${slug}.json`;
  const alt = await git(fallId, ['ls-tree', baum]).catch(() => '');
  const zeilen = alt.split('\n').filter(z => z.trim());
  const modus = '100644';
  const neueZeile = `${modus} blob ${blob}\t${name}`;
  const mktreeInput = [...zeilen, neueZeile].join('\n') + '\n';
  const neuerBaum = await spawnStdin(fallPfad(fallId), ['mktree'], mktreeInput);

  // Commit auf den Ref
  const eltern = (await refExistiert(fallId, privatRef(did)))
    ? ['-p', (await git(fallId, ['rev-parse', privatRef(did)])).trim()]
    : [];
  const commitInput = `privat:${eintrag.art}: ${eintrag.inhalt.slice(0, 120)}\n\nzeit: ${zeitIso}`;
  const commitSha = (await execFileP('git', [
    '-C', fallPfad(fallId), 'commit-tree', neuerBaum, ...eltern, '-m', commitInput,
  ])).stdout.trim();
  await git(fallId, ['update-ref', privatRef(did), commitSha]);

  return { sha: commitSha };
}

/** Die private Spur lesen (nur lokal möglich — der Ref wird nie gepusht). */
export async function listePrivat(did: string, fallId: string): Promise<PrivatEintrag[]> {
  if (!(await refExistiert(fallId, privatRef(did)))) return [];
  const log = await git(fallId, [
    'log', privatRef(did), '--format=%aI%x00%s%x00%b%x00%H%x1E',
  ]).catch(() => '');
  const eintraege: PrivatEintrag[] = [];
  for (const block of log.split('\x1E')) {
    if (!block.trim()) continue;
    const [zeit, subject] = block.split('\x00').map(s => (s || '').trim());
    const m = subject.match(/^privat:(\w+):\s*(.*)$/);
    if (!m) continue;
    eintraege.push({
      art: m[1] as PrivatEintrag['art'],
      inhalt: m[2],
      zeitIso: zeit,
      sha: block.split('\x00')[3]?.trim() ?? '',
    });
  }
  return eintraege;
}

/**
 * „In den Strom teilen": cherry-pick des privaten Eintrags auf 'strom' —
 * neuer Commit, neue Zeit. Der Strom lügt nicht über den Moment des Teilens.
 */
export async function teilePrivat(
  did: string,
  fallId: string,
  sha: string
): Promise<{ nummer: number; sha: string; geteiltIso: string }> {
  // Prüfen: ist der Ref-Kopf oder ein Vorfahre?
  const istDa = (await git(fallId, ['cat-file', '-t', sha]).catch(() => '')).trim();
  if (istDa !== 'commit') throw new Error('Privater Eintrag nicht gefunden');

  const geteiltIso = new Date().toISOString();

  // Inhalt des privaten Commits holen (sein Baum → die eine Datei)
  const baum = (await git(fallId, ['rev-parse', `${sha}^{tree}`])).trim();
  const dateien = await git(fallId, ['ls-tree', baum]);
  const datei = dateien.split('\n')[0]?.split('\t')[1];
  if (!datei) throw new Error('Privater Commit ohne Inhalt');
  const roh = await git(fallId, ['show', `${baum}:${datei}`]);
  let privateInhalt = '';
  try {
    const j = JSON.parse(roh) as { art?: string; inhalt?: string };
    privateInhalt = j.inhalt ?? roh.slice(0, 120);
  } catch {
    privateInhalt = roh.slice(0, 120);
  }

  // Als geteilten Strom-Eintrag committen — Subject menschlich lesbar
  // (listeStrom parst das Subject; der Private-Inhalt gehört DORTHIN).
  const erg = await stromEintrag(fallId, {
    typ: 'qa',
    inhalt: `Geteilt aus dem Privaten: ${privateInhalt}`,
    von: 'Du',
    payload: { geteiltVon: sha, geteiltIso, quelle: 'privat', original: roh },
  });
  return { ...erg, geteiltIso };
}
