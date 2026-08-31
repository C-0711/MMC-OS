/**
 * kontakte.ts — Kontakte, Kontaktverwaltung, Container-Issuing (Spec 21).
 *
 * Jeder Kontakt ist ein Git-Container im Vault (Namensraum kontakt-<slug>).
 * Issuing: die erste Kommunikation von einem Absender ERZEUGT den Container —
 * kein Formularzwung, keine Rückfrage, nichts geht verloren.
 *
 * Verlauf: alles (Anrufe, Texte, Dateien) als Commits in docs/ — die
 * Git-Historie IST der Verlauf; kontaktHistorie() misst sie nach Zeit.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const execFileP = promisify(execFile);

function vaultRoot(): string {
  return process.env.MMC_VAULT ?? path.join(os.homedir(), 'MMC-Vault');
}

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'kontakt';
}

function kontaktPfad(slug: string): string {
  return path.join(vaultRoot(), `kontakt-${slug}`);
}

// ============================================================================
// Git-Basis für Kontakt-Container
// ============================================================================

async function gitExec(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP('git', ['-C', cwd, ...args], { maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

async function istRepo(pfad: string): Promise<boolean> {
  try {
    await fsp.access(path.join(pfad, '.git'));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Meta / Liste
// ============================================================================

export interface KontaktInfo {
  slug: string;
  name: string;
  erstelltIso: string;
  kanäle: string[];
  aktivitaet: number;        // Commits im Verlauf
  letzterEintragIso: string | null;
}

async function leseMeta(slug: string): Promise<KontaktInfo | null> {
  const pfad = kontaktPfad(slug);
  if (!(await istRepo(pfad))) return null;
  try {
    const raw = await gitExec(pfad, ['show', 'main:docs/meta.json']);
    const m = JSON.parse(raw) as { slug: string; name: string; erstelltIso: string; kanäle?: string[] };
    const logCount = await gitExec(pfad, ['rev-list', '--count', 'main']).catch(() => '0');
    const logZeiten = await gitExec(pfad, ['log', 'main', '-1', '--format=%aI']).catch(() => '');
    return {
      slug: m.slug ?? slug,
      name: m.name ?? slug,
      erstelltIso: m.erstelltIso ?? '',
      kanäle: m.kanäle ?? [],
      aktivitaet: parseInt(logCount.trim(), 10) || 0,
      letzterEintragIso: logZeiten.trim() || null,
    };
  } catch {
    return null;
  }
}

/** Alle Kontakt-Container (Nur-Verzeichnisse mit kontakt- Präfix). */
export async function listKontakte(): Promise<KontaktInfo[]> {
  const root = vaultRoot();
  let eintraege;
  try {
    eintraege = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const kontakte: KontaktInfo[] = [];
  for (const e of eintraege) {
    if (!e.isDirectory() || !e.name.startsWith('kontakt-')) continue;
    const slug = e.name.replace(/^kontakt-/, '');
    const info = await leseMeta(slug).catch(() => null);
    if (info) kontakte.push(info);
  }
  return kontakte.sort((a, b) => (b.letzterEintragIso ?? '').localeCompare(a.letzterEintragIso ?? ''));
}

// ============================================================================
// Issuing — die erste Kommunikation erzeugt den Container
// ============================================================================

async function issueKontakt(name: string, slugOverride?: string): Promise<string> {
  let slug = slugOverride ? slugify(slugOverride) : slugify(name);
  const pfad = kontaktPfad(slug);
  if (!(await istRepo(pfad))) {
    await fsp.mkdir(path.join(pfad, 'docs'), { recursive: true });
    await gitExec(pfad, ['init', '-b', 'main']);
    const meta = {
      slug, name, erstelltIso: new Date().toISOString(), kanäle: [],
    };
    await fsp.writeFile(path.join(pfad, 'docs', 'meta.json'), JSON.stringify(meta, null, 2));
    await gitExec(pfad, ['add', '.']);
    await gitExec(pfad, ['commit', '-m', `initialer Kontakt: ${name}`]);
  }
  return slug;
}

/**
 * Issuing: findet den Kontakt für einen Absender — oder erzeugt ihn.
 * Rückfrage-frei (Null-Fragen-Geist): der Absender-Name wird Kontaktname.
 */
export async function findeOderIssue(absender: string): Promise<string> {
  const slug = slugify(absender);
  const pfad = kontaktPfad(slug);
  if (await istRepo(pfad)) return slug;
  return await issueKontakt(absender);
}

export async function createKontakt(name: string, slugOverride?: string): Promise<KontaktInfo> {
  const slug = await issueKontakt(name, slugOverride);
  const info = await leseMeta(slug);
  if (!info) throw new Error(`Kontakt ${slug} konnte nicht gelesen werden`);
  return info;
}

// ============================================================================
// Kommunikation — alles als Commit
// ============================================================================

interface CommMeta {
  typ: 'anruf' | 'text' | 'datei';
  zusammenfassung: string;
  von: string;         // Absender im Sinne des Kanals
  zeit: string;
}

async function commitComm(
  slug: string,
  dateiName: string,
  bytes: Buffer,
  meta: CommMeta
): Promise<{ slug: string; datei: string; sha: string }> {
  const pfad = kontaktPfad(slug);
  if (!(await istRepo(pfad))) throw new Error(`Kontakt ${slug} existiert nicht`);

  await fsp.writeFile(path.join(pfad, 'docs', dateiName), bytes);
  await gitExec(pfad, ['add', '.']);
  await gitExec(pfad, ['commit', '-m', `comm:${meta.typ}: ${meta.zusammenfassung}`]);
  const sha = (await gitExec(pfad, ['rev-parse', 'HEAD'])).trim();
  return { slug, datei: dateiName, sha };
}

/** Anruf-Mitschrift als Commit (Nachricht = Commit, Minute = Fundstelle). */
export async function commAnruf(
  slug: string,
  mitschrift: { zeilen: Array<{ zeit: string; sprecher: string; text: string }>; dauer?: string; partner?: string }
): Promise<{ slug: string; datei: string; sha: string }> {
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  return commitComm(slug, `comm-${iso}-anruf.json`, Buffer.from(JSON.stringify(mitschrift)), {
    typ: 'anruf',
    zusammenfassung: `Anruf · ${mitschrift.zeilen.length} Zeilen · ${mitschrift.dauer ?? '—'}`,
    von: mitschrift.partner ?? 'Unbekannt',
    zeit: new Date().toISOString(),
  });
}

/** Text als Commit — Nachricht = Commit, Zitat = Referenz. */
export async function commText(
  slug: string,
  text: string,
  von: string
): Promise<{ slug: string; datei: string; sha: string }> {
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const inhalt = { text, von, zeit: new Date().toISOString() };
  return commitComm(slug, `comm-${iso}-text.json`, Buffer.from(JSON.stringify(inhalt)), {
    typ: 'text',
    zusammenfassung: text.slice(0, 60),
    von,
    zeit: inhalt.zeit,
  });
}

/** Datei-Eingang als Commit (byte-identisch). */
export async function commDatei(
  slug: string,
  datei: { name: string; bytes: Buffer }
): Promise<{ slug: string; datei: string; sha: string }> {
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  return commitComm(slug, `comm-${iso}-${datei.name}`, datei.bytes, {
    typ: 'datei',
    zusammenfassung: datei.name,
    von: 'Eingang',
    zeit: new Date().toISOString(),
  });
}

// ============================================================================
// Historie — fortlaufender Verlauf, gemischt nach Zeit
// ============================================================================

export interface VerlaufEintrag {
  zeitIso: string;
  typ: 'anruf' | 'text' | 'datei' | 'sonstiges';
  zusammenfassung: string;
  quelle: string;        // „anruf · 27:50" | „text" | „datei · name"
}

/** Der fortlaufende Verlauf: jede Kommunikation eine Zeile, nach Zeit gemischt. */
export async function kontaktHistorie(slug: string): Promise<VerlaufEintrag[]> {
  const pfad = kontaktPfad(slug);
  if (!(await istRepo(pfad))) throw new Error(`Kontakt ${slug} existiert nicht`);

  const logOutput = await gitExec(pfad, [
    'log', 'main', '--format=%aI%x00%s%x00%b%x1E',
  ]);
  const eintraege: VerlaufEintrag[] = [];
  for (const block of logOutput.split('\x1E')) {
    if (!block.trim()) continue;
    const [zeit, subject] = block.split('\x00').map(s => (s || '').trim());
    if (!zeit || !subject) continue;
    const m = subject.match(/^comm:(anruf|text|datei):\s*(.*)$/);
    if (m) {
      eintraege.push({
        zeitIso: zeit,
        typ: m[1] as VerlaufEintrag['typ'],
        zusammenfassung: m[2],
        quelle: m[1] === 'anruf' ? 'anruf · Mitschrift' : m[1] === 'text' ? 'text' : 'datei',
      });
    } else if (/initialer Kontakt/.test(subject)) {
      eintraege.push({
        zeitIso: zeit, typ: 'sonstiges',
        zusammenfassung: 'Kontakt entstanden.', quelle: 'meta',
      });
    }
  }
  return eintraege; // git log liefert neueste zuerst — der Verlauf ist umgekehrt
}

// ============================================================================
// Zusammenfassender Kontakt-Brief (für Listen mit Vorschau)
// ============================================================================

export async function kontaktBrief(slug: string): Promise<KontaktInfo & { letzterText: string | null }> {
  const info = await leseMeta(slug);
  if (!info) throw new Error(`Kontakt ${slug} existiert nicht`);
  const hist = await kontaktHistorie(slug).catch(() => []);
  const erster = hist[hist.length - 1]; // ältester = letzter im Array
  return { ...info, letzterText: erster ? `${erster.typ}: ${erster.zusammenfassung}` : null };
}
