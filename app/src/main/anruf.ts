/**
 * anruf.ts — Anruf-Modelle aus Mitschriften (Datenkanal T3).
 *
 * Ein Anruf = eine Mitschrift im Fall (JSON, Typ wie beweis.ts-Transkript):
 *   docs/mitschrift-*.json  { zeilen: [{zeit, sprecher, text}], wav? }
 *
 * listAnrufe(fallId) liefert die Anruf-Liste für Anrufe & Texte,
 * minuten(fallId, doc) die markierten Minuten für den Anruf-Beweis.
 */

import * as vault from './vault';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execFileP = promisify(execFile);

export interface AnrufZeile {
  zeit: string;      // "27:50"
  sprecher: string;
  text: string;
}

export interface AnrufInfo {
  id: string;        // Dateiname ohne .json
  fallId: string;
  doc: string;       // "mitschrift-2026-08-27.json"
  partner: string;   // aus der ersten Zeile des Gegenübers
  dauer: string;     // letzte zeit-Marke ("34:12") oder "—"
  zeilen: AnrufZeile[];
  minuten: string[]; // Minuten mit Fundstellen (aus Atomen)
}

interface Mitschrift {
  zeilen: Array<{ zeit: string; sprecher: string; text: string }>;
}

async function gitShow(fallPfad: string, datei: string): Promise<string> {
  const { stdout } = await execFileP('git', ['-C', fallPfad, 'show', `main:docs/${datei}`], {
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

function vaultRoot(): string {
  return process.env.MMC_VAULT ?? path.join(os.homedir(), 'MMC-Vault');
}

/** Liste aller Anrufe eines Falls (aus git ls-tree, main). */
export async function listAnrufe(fallId: string): Promise<AnrufInfo[]> {
  const fallPfad = path.join(vaultRoot(), fallId);

  // ls-tree nach Mitschriften (Pfade sind bereits relativ zum Fall-Root:
  // "docs/<ts>-mitschrift-*.json" — NICHT nochmal docs/ vorsetzen).
  let tree = '';
  try {
    const { stdout } = await execFileP('git', ['-C', fallPfad, 'ls-tree', '--name-only', '-r', 'main', 'docs/']);
    tree = stdout;
  } catch {
    return []; // Fall ohne docs oder ohne Repo — still leer
  }

  // Minuten-Markierungen aus den Atomen (anruf-Fundstellen)
  const minutenMap = new Map<string, Set<string>>();
  const atomDateien = await vault.listAtomsMain(fallId).catch(() => []);
  for (const { atoms } of atomDateien) {
    for (const a of atoms) {
      if (a.fundstelle.art === 'anruf' && a.fundstelle.minute) {
        const doc = a.fundstelle.doc;
        if (!minutenMap.has(doc)) minutenMap.set(doc, new Set());
        minutenMap.get(doc)!.add(a.fundstelle.minute);
      }
    }
  }

  const anrufe: AnrufInfo[] = [];
  for (const zeile of tree.split('\n')) {
    const pfad = zeile.trim();
    if (!pfad.endsWith('.json') || !/mitschrift/i.test(pfad)) continue;
    // gitShow erwartet den Pfad relativ zum Fall-Root (docs/… schon drin)
    const relPfad = pfad.startsWith('docs/') ? pfad : `docs/${pfad}`;
    const datei = relPfad.replace(/^docs\//, '');
    try {
      const raw = await gitShow(fallPfad, datei);
      const m = JSON.parse(raw) as Mitschrift;
      if (!Array.isArray(m.zeilen)) continue;

      const partnerZeile = m.zeilen.find(z => z.sprecher && z.sprecher !== 'Du');
      const dauer = m.zeilen.length > 0 ? m.zeilen[m.zeilen.length - 1].zeit : '—';

      anrufe.push({
        id: datei.replace(/\.json$/, ''),
        fallId,
        doc: datei,
        partner: partnerZeile?.sprecher ?? 'unbekannt',
        dauer,
        zeilen: m.zeilen,
        minuten: [...(minutenMap.get(datei) ?? [])].sort(),
      });
    } catch {
      continue; // kaputte Mitschrift überspringen — still
    }
  }

  // neueste zuerst (Dateiname enthält Datum)
  return anrufe.sort((a, b) => b.id.localeCompare(a.id));
}
