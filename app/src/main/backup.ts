/**
 * backup.ts — Der Tresor-Tresor (T10).
 *
 * Stündlicher Job: git bundle je Fall nach ~/MMC-Vault-Backup/.
 * Pruning: letzte 24h stündlich behalten, danach nur die jüngste je Tag,
 * max 30 Tage. Bundles sind wiederherstellbar (git clone <bundle>).
 */

import { app, powerMonitor } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fsp from 'node:fs/promises';
import { type Dirent } from 'node:fs';
import * as path from 'node:path';
import * as os from 'os';
import { log } from './log';

const execFileP = promisify(execFile);

const STUNDEN_24 = 24 * 3600 * 1000;
const TAGE_30 = 30 * 24 * 3600 * 1000;

function vaultRoot(): string {
  return process.env.MMC_VAULT ?? path.join(os.homedir(), 'MMC-Vault');
}

export function backupZiel(benutzerWahl?: string): string {
  return benutzerWahl ?? path.join(os.homedir(), 'MMC-Vault-Backup');
}

/** Ein Backup-Jetzt-Lauf (auch manuell/testbar). */
export async function backupJetzt(ziel = backupZiel()): Promise<{ faelle: number; bundles: number }> {
  const root = vaultRoot();
  let eintraege: Dirent[];
  try {
    eintraege = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return { faelle: 0, bundles: 0 }; // kein Vault — still, kein Fehler
  }

  const stempel = new Date().toISOString().replace(/[:.]/g, '-');
  let bundles = 0;
  for (const e of eintraege) {
    if (!e.isDirectory()) continue;
    const fallPfad = path.join(root, e.name);
    try {
      // ist es ein Git-Repo?
      await execFileP('git', ['-C', fallPfad, 'rev-parse', '--git-dir']);
    } catch {
      continue;
    }
    const datei = path.join(ziel, e.name, `${e.name}-${stempel}.bundle`);
    await fsp.mkdir(path.dirname(datei), { recursive: true });
    try {
      await execFileP('git', ['-C', fallPfad, 'bundle', 'create', datei, '--all']);
      bundles++;
    } catch (err) {
      log('warn', `Backup für Fall ${e.name} fehlgeschlagen: ${String(err)}`);
    }
  }

  await prunen(ziel);
  log('info', `Backup: ${bundles} Bundles nach ${ziel}`);
  return { faelle: eintraege.length, bundles };
}

/** Pruning: <24h alles, danach 1/Tag, max 30 Tage. */
async function prunen(ziel: string): Promise<void> {
  const jetzt = Date.now();
  let faelle: Dirent[];
  try {
    faelle = await fsp.readdir(ziel, { withFileTypes: true });
  } catch {
    return;
  }
  for (const fall of faelle) {
    if (!fall.isDirectory()) continue;
    const fallPfad = path.join(ziel, fall.name);
    const bundles = (await fsp.readdir(fallPfad)).filter(f => f.endsWith('.bundle'));

    // neueste zuerst
    const sortiert = bundles.sort((a, b) => b.localeCompare(a));
    const behalten = new Set<string>();
    let letzterTag = '';
    for (const b of sortiert) {
      const m = b.match(/^.*-(\d{4})-(\d{2})-(\d{2})T/);
      const tag = m ? `${m[1]}-${m[2]}-${m[3]}` : b;
      // Zeitstempel parsen: <fall>-<ISO mit Bindestrichen>.bundle
      // Format: 2026-08-31T07-04-12-123Z → ISO 2026-08-31T07:04:12.123Z
      const isoRaw = b.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.bundle$/);
      let alter = Infinity;
      if (isoRaw) {
        const iso = `${isoRaw[1]}-${isoRaw[2]}-${isoRaw[3]}T${isoRaw[4]}:${isoRaw[5]}:${isoRaw[6]}.${isoRaw[7]}Z`;
        const t = new Date(iso).getTime();
        if (!Number.isNaN(t)) alter = jetzt - t;
      }

      if (alter < STUNDEN_24) {
        behalten.add(b); // letzte 24h: alles behalten
      } else if (tag !== letzterTag && alter < TAGE_30) {
        behalten.add(b); // danach: das erste (= jüngste) je Tag
        letzterTag = tag;
      }
      // älter als 30 Tage: fällt weg
    }
    for (const b of bundles) {
      if (!behalten.has(b)) {
        await fsp.rm(path.join(fallPfad, b), { force: true }).catch(() => {});
      }
    }
  }
}

/** Startet den stündlichen Job (powerMonitor-abhängig, für Tests exportierbar). */
export function starteBackupJob(): void {
  const stunde = 3600 * 1000;
  const tick = () => { backupJetzt().catch(() => {}); };
  setInterval(tick, stunde).unref();
  // Nach Resume aus dem Schlaf eine Runde nachschieben
  try {
    powerMonitor.on('resume', tick);
  } catch { // powerMonitor im Test-Kontext nicht da — egal
    void app;
  }
}
