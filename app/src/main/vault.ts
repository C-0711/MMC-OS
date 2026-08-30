import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const execFileAsync = promisify(execFile);

function getVaultRoot(): string {
  return process.env.MMC_VAULT ?? path.join(os.homedir(), 'MMC-Vault');
}

// Type definitions
export interface FallInfo {
  id: string;
  pfad: string;
  offeneVorschlaege: number;
  letzterCommitIso: string;
}

export interface Atom {
  id: string;
  feld: string;
  wert: string;
  fundstelle: {
    doc: string;
    seite: number;
    bbox: [number, number, number, number];
  };
  conf: number;
}

export interface Vorschlag {
  id: string;
  kartentext: {
    titel: string;
    frage: string;
  };
  atoms: Atom[];
  branch: string;
}

export interface ErzaehlSatz {
  satz: string;
  commitZeile: string;
  sha: string;
  datumIso: string;
}

// Git helper functions
async function gitExec(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-c', 'user.name=MMC Agent', '-c', 'user.email=agent@mmc.local', ...args], { cwd });
  return stdout.trim();
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    await gitExec(dir, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

async function getLastCommitIso(dir: string): Promise<string> {
  try {
    return await gitExec(dir, ['log', '-1', '--format=%aI']);
  } catch {
    return '';
  }
}

async function countBranches(dir: string, pattern: string): Promise<number> {
  try {
    const output = await gitExec(dir, ['branch', '--list', pattern]);
    return output ? output.split('\n').length : 0;
  } catch {
    return 0;
  }
}

// Exported API functions

export async function listFaelle(): Promise<FallInfo[]> {
  try {
    const vaultRoot = getVaultRoot();
    await fs.mkdir(vaultRoot, { recursive: true });
    const entries = await fs.readdir(vaultRoot, { withFileTypes: true });
    const faelle: FallInfo[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fallPfad = path.join(vaultRoot, entry.name);
        if (await isGitRepo(fallPfad)) {
          const offeneVorschlaege = await countBranches(fallPfad, 'agent/*');
          const letzterCommitIso = await getLastCommitIso(fallPfad);
          faelle.push({
            id: entry.name,
            pfad: fallPfad,
            offeneVorschlaege,
            letzterCommitIso,
          });
        }
      }
    }

    return faelle;
  } catch (err) {
    throw new Error(`Fehler beim Auflisten der Fälle: ${err}`);
  }
}

export async function createFall(id: string): Promise<FallInfo> {
  // Validate id
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`Ungültige Fall-ID: ${id} (nur [a-z0-9-] erlaubt)`);
  }

  const vaultRoot = getVaultRoot();
  const fallPfad = path.join(vaultRoot, id);

  // Check if already exists
  try {
    await fs.access(fallPfad);
    throw new Error(`Fall ${id} existiert bereits`);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Create directory structure
  await fs.mkdir(fallPfad, { recursive: true });
  await fs.mkdir(path.join(fallPfad, 'docs'), { recursive: true });
  await fs.mkdir(path.join(fallPfad, 'atoms'), { recursive: true });

  // Create .gitkeep files
  await fs.writeFile(path.join(fallPfad, 'docs', '.gitkeep'), '');
  await fs.writeFile(path.join(fallPfad, 'atoms', '.gitkeep'), '');

  // Initialize git repo
  await gitExec(fallPfad, ['init', '-b', 'main']);

  // Create initial fall.json
  const fallJson = {
    id,
    angelegtIso: new Date().toISOString(),
  };
  await fs.writeFile(path.join(fallPfad, 'fall.json'), JSON.stringify(fallJson, null, 2));

  // Add and commit
  await gitExec(fallPfad, ['add', '.']);
  await gitExec(fallPfad, ['commit', '-m', `initialer Fall: ${id}`]);

  const letzterCommitIso = await getLastCommitIso(fallPfad);

  return {
    id,
    pfad: fallPfad,
    offeneVorschlaege: 0,
    letzterCommitIso,
  };
}

export async function commitEingang(
  fallId: string,
  quelle: { absender: string; kanal: string },
  datei: { name: string; bytes: Buffer }
): Promise<{ sha: string; docPfad: string }> {
  const vaultRoot = getVaultRoot();
  const fallPfad = path.join(vaultRoot, fallId);

  // Check if fall exists
  if (!(await isGitRepo(fallPfad))) {
    throw new Error(`Fall ${fallId} existiert nicht`);
  }

  // Generate filename with ISO timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const basename = `${timestamp}-${datei.name}`;
  const docPfad = path.join(fallPfad, 'docs', basename);
  const sidecarPfad = path.join(fallPfad, 'docs', `${basename}.eingang.json`);

  // Write file byte-identically
  await fs.writeFile(docPfad, datei.bytes);

  // Compute SHA-256 of the bytes
  const sha256 = crypto.createHash('sha256').update(datei.bytes).digest('hex');

  // Create sidecar JSON
  const sidecar = {
    absender: quelle.absender,
    kanal: quelle.kanal,
    empfangenIso: new Date().toISOString(),
    sha256,
  };
  await fs.writeFile(sidecarPfad, JSON.stringify(sidecar, null, 2));

  // Add and commit on main
  await gitExec(fallPfad, ['add', docPfad, sidecarPfad]);
  const commitMsg = `eingang: ${datei.name} von ${quelle.absender}`;
  await gitExec(fallPfad, ['commit', '-m', commitMsg]);

  // Get commit SHA
  const sha = await gitExec(fallPfad, ['rev-parse', 'HEAD']);

  return { sha, docPfad };
}

export async function proposeDeutung(
  fallId: string,
  proposalId: string,
  atoms: Atom[],
  kartentext: { titel: string; frage: string }
): Promise<{ branch: string; sha: string }> {
  const vaultRoot = getVaultRoot();
  const fallPfad = path.join(vaultRoot, fallId);

  // Check if fall exists
  if (!(await isGitRepo(fallPfad))) {
    throw new Error(`Fall ${fallId} existiert nicht`);
  }

  const branchName = `agent/${proposalId}`;

  // Check if branch already exists
  try {
    await gitExec(fallPfad, ['rev-parse', '--verify', branchName]);
    throw new Error(`Branch ${branchName} existiert bereits`);
  } catch (err: any) {
    if (!err.message?.includes('existiert bereits')) {
      // Branch doesn't exist, which is what we want
    } else {
      throw err;
    }
  }

  // Get current main commit
  const mainSha = await gitExec(fallPfad, ['rev-parse', 'HEAD']);

  // Create atoms file content
  const atomsData = {
    kartentext,
    atoms,
  };
  const atomsContent = JSON.stringify(atomsData, null, 2);

  // Create a tree with the atoms file
  const atomsPath = `atoms/${proposalId}.json`;

  // Write the atoms file to working directory
  const tmpAtomsPath = path.join(fallPfad, atomsPath);
  await fs.mkdir(path.dirname(tmpAtomsPath), { recursive: true });
  await fs.writeFile(tmpAtomsPath, atomsContent);

  // Read current index into git
  await gitExec(fallPfad, ['read-tree', mainSha]);

  // Add the file to git index
  await gitExec(fallPfad, ['add', tmpAtomsPath]);

  // Write tree from index (now contains all files from main + the new atoms file)
  const newTree = await gitExec(fallPfad, ['write-tree']);

  // Create commit from tree
  const commitMsg = `deutung: ${kartentext.titel}`;
  const commitSha = await gitExec(fallPfad, ['commit-tree', newTree, '-p', mainSha, '-m', commitMsg]);

  // Create branch reference
  await gitExec(fallPfad, ['update-ref', `refs/heads/${branchName}`, commitSha]);

  // Reset index to HEAD (clean up)
  await gitExec(fallPfad, ['reset', '--hard', 'HEAD']);

  // Clean up temp file (if it still exists after hard reset)
  await fs.unlink(tmpAtomsPath).catch(() => {
    /* ignore if already deleted */
  });

  return { branch: branchName, sha: commitSha.trim() };
}

export async function listVorschlaege(fallId: string): Promise<Vorschlag[]> {
  const vaultRoot = getVaultRoot();
  const fallPfad = path.join(vaultRoot, fallId);

  // Check if fall exists
  if (!(await isGitRepo(fallPfad))) {
    throw new Error(`Fall ${fallId} existiert nicht`);
  }

  const vorschlaege: Vorschlag[] = [];

  // List all agent/* branches
  let branchOutput: string;
  try {
    branchOutput = await gitExec(fallPfad, ['branch', '--list', 'agent/*']);
  } catch {
    return [];
  }

  if (!branchOutput) return [];

  const branches = branchOutput.split('\n').map((b) => b.trim().replace(/^\*?\s*/, ''));

  for (const branch of branches) {
    if (!branch) continue;

    const proposalId = branch.replace('agent/', '');
    const atomsPath = `atoms/${proposalId}.json`;

    try {
      // Read the file from the branch
      const content = await gitExec(fallPfad, ['show', `${branch}:${atomsPath}`]);
      const data = JSON.parse(content);

      vorschlaege.push({
        id: proposalId,
        kartentext: data.kartentext,
        atoms: data.atoms,
        branch,
      });
    } catch {
      // Skip if file doesn't exist or can't be parsed
      continue;
    }
  }

  return vorschlaege;
}

/**
 * Gemergtes Wissen: alle atoms/*.json auf main (bestätigte Deutungen).
 * Das ist die Quelle für Frag-mich — offene Vorschläge sind nur Kandidaten.
 */
export async function listAtomsMain(
  fallId: string
): Promise<Array<{ titel: string; atoms: Atom[] }>> {
  const vaultRoot = getVaultRoot();
  const fallPfad = path.join(vaultRoot, fallId);

  if (!(await isGitRepo(fallPfad))) {
    throw new Error(`Fall ${fallId} existiert nicht`);
  }

  let treeOutput: string;
  try {
    treeOutput = await gitExec(fallPfad, ['ls-tree', '--name-only', 'main', 'atoms/']);
  } catch {
    return [];
  }
  if (!treeOutput) return [];

  const ergebnis: Array<{ titel: string; atoms: Atom[] }> = [];
  for (const datei of treeOutput.split('\n')) {
    const pfad = datei.trim();
    if (!pfad.endsWith('.json')) continue;
    try {
      const content = await gitExec(fallPfad, ['show', `main:${pfad}`]);
      const data = JSON.parse(content);
      if (Array.isArray(data.atoms)) {
        ergebnis.push({ titel: data.kartentext?.titel ?? pfad, atoms: data.atoms });
      }
    } catch {
      continue;
    }
  }
  return ergebnis;
}

export async function mergeVorschlag(fallId: string, proposalId: string): Promise<{ sha: string }> {
  const vaultRoot = getVaultRoot();
  const fallPfad = path.join(vaultRoot, fallId);

  // Check if fall exists
  if (!(await isGitRepo(fallPfad))) {
    throw new Error(`Fall ${fallId} existiert nicht`);
  }

  const branchName = `agent/${proposalId}`;

  // Check if branch exists
  try {
    await gitExec(fallPfad, ['rev-parse', '--verify', branchName]);
  } catch {
    throw new Error(`Vorschlag ${proposalId} existiert nicht`);
  }

  // Merge with --no-ff
  const commitMsg = `bestaetigt: ${proposalId}`;
  await gitExec(fallPfad, ['merge', '--no-ff', branchName, '-m', commitMsg]);

  // Get merge commit SHA
  const sha = await gitExec(fallPfad, ['rev-parse', 'HEAD']);

  // Delete the branch
  await gitExec(fallPfad, ['branch', '-d', branchName]);

  return { sha };
}

export async function rejectVorschlag(fallId: string, proposalId: string, grund?: string): Promise<void> {
  const vaultRoot = getVaultRoot();
  const fallPfad = path.join(vaultRoot, fallId);

  // Check if fall exists
  if (!(await isGitRepo(fallPfad))) {
    throw new Error(`Fall ${fallId} existiert nicht`);
  }

  const branchName = `agent/${proposalId}`;

  // Check if branch exists
  try {
    await gitExec(fallPfad, ['rev-parse', '--verify', branchName]);
  } catch {
    throw new Error(`Vorschlag ${proposalId} existiert nicht`);
  }

  // Delete the branch
  await gitExec(fallPfad, ['branch', '-D', branchName]);

  // Create empty commit on main
  const commitMsg = `abgelehnt: ${proposalId}`;
  const commitBody = grund ? `\n\n${grund}` : '';
  await gitExec(fallPfad, ['commit', '--allow-empty', '-m', commitMsg + commitBody]);
}

function erzaehleSatz(subject: string, body: string): string {
  // Parse commit message and create German narrative sentence
  if (subject.startsWith('eingang:')) {
    const match = subject.match(/eingang:\s*(.+?)\s*von\s*(.+)/);
    if (match) {
      return `Am ${formatDatum(new Date())} kam ${match[1]} von ${match[2]}.`;
    }
    return `Ein Eingang wurde registriert.`;
  } else if (subject.startsWith('bestaetigt:')) {
    const proposalId = subject.replace('bestaetigt:', '').trim();
    return `Du hast ${proposalId} bestätigt.`;
  } else if (subject.startsWith('deutung:')) {
    const titel = subject.replace('deutung:', '').trim();
    return `Ich habe ${titel} erkannt.`;
  } else if (subject.startsWith('abgelehnt:')) {
    const proposalId = subject.replace('abgelehnt:', '').trim();
    return `Du hast ${proposalId} verworfen.`;
  } else if (subject.startsWith('initialer Fall:')) {
    const fallId = subject.replace('initialer Fall:', '').trim();
    return `Fall ${fallId} wurde angelegt.`;
  }

  return subject;
}

function formatDatum(date: Date): string {
  const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${date.getDate()}. ${monate[date.getMonth()]}`;
}

export async function fallErzaehlung(fallId: string): Promise<ErzaehlSatz[]> {
  const vaultRoot = getVaultRoot();
  const fallPfad = path.join(vaultRoot, fallId);

  // Check if fall exists
  if (!(await isGitRepo(fallPfad))) {
    throw new Error(`Fall ${fallId} existiert nicht`);
  }

  // Get log with custom format (--first-parent to only show mainline, not merged branch commits)
  const logOutput = await gitExec(fallPfad, ['log', 'main', '--first-parent', '--format=%H%x00%aI%x00%s%x00%b%x1E']);

  if (!logOutput) return [];

  const commits = logOutput.split('\x1E').filter((c) => c.trim());
  const erzaehlung: ErzaehlSatz[] = [];

  for (const commit of commits) {
    const parts = commit.split('\x00').map((p) => (p || '').trim());
    const [sha, datumIso, subject, body] = parts;

    if (!sha) continue;

    const shortSha = sha.substring(0, 4);
    const commitType = subject.split(':')[0];
    const satz = erzaehleSatz(subject, body || '');
    const commitZeile = `${shortSha} · ${commitType} · sig ✓`;

    erzaehlung.push({
      satz,
      commitZeile,
      sha,
      datumIso,
    });
  }

  return erzaehlung.reverse(); // Oldest first
}
