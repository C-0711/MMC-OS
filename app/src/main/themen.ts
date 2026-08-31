/**
 * themen.ts — Themen & Stapel aus Atomen (Datenkanal T4).
 *
 * Themen: Typ-Häufigkeiten über die Atome eines Falls (geld/datum/absender/
 * vertrag_* …), gruppiert nach Lesefluss — NICHT nach Ordner (Canvas-Gesetz:
 * „Inhalt statt Verzeichnis").
 *
 * Stapel: was der Ingester zuletzt einsortiert hat (letzte Commits).
 * NeuesThema: Fälle, die es noch nicht gibt, aber zusammengehörige Atome
 * andeuten (aus offenen Vorschlägen ohne Fall-Bezug).
 */

import * as vault from './vault';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execFileP = promisify(execFile);

export interface Thema {
  name: string;          // „Rechnungen", „Verträge", „Kontakte" …
  anzahl: number;
  fallId: string;
}

export interface StapelEintrag {
  fallId: string;
  satz: string;          // Erzähl-Satz des letzten Commits
  commitZeile: string;
}

/** Atom-Feld → Themenname (Lesefluss, nicht Technik). */
function themaName(feld: string): string {
  const f = feld.toLowerCase();
  if (/rechnung|betrag|geld|preis|umsatz/.test(f)) return 'Rechnungen';
  if (/vertrag|kaution|laufzeit|miete/.test(f)) return 'Verträge';
  if (/absender|partner|kontakt|sprecher/.test(f)) return 'Kontakte';
  if (/datum|faellig|frist/.test(f)) return 'Termine';
  return 'Sonstiges';
}

/** Themen eines Falls: Typ-Zählung über alle Atome auf main. */
export async function themenFuerFall(fallId: string): Promise<Thema[]> {
  const atomDateien = await vault.listAtomsMain(fallId).catch(() => []);
  const counts = new Map<string, number>();
  for (const { atoms } of atomDateien) {
    for (const a of atoms) {
      const name = themaName(a.feld);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, anzahl]) => ({ name, anzahl, fallId }))
    .sort((a, b) => b.anzahl - a.anzahl);
}

/** Themen über ALLE Fälle (für den Themen-Bereich im Siegel-Menü). */
export async function alleThemen(): Promise<Thema[]> {
  const faelle = await vault.listFaelle();
  const proFall = await Promise.all(faelle.map(f => themenFuerFall(f.id)));
  // Zusammenfassen über Fälle hinweg
  const sum = new Map<string, Thema>();
  for (const liste of proFall) {
    for (const t of liste) {
      const key = t.name;
      const bisher = sum.get(key);
      if (bisher) bisher.anzahl += t.anzahl;
      else sum.set(key, { ...t });
    }
  }
  return [...sum.values()].sort((a, b) => b.anzahl - a.anzahl);
}

/** Der Stapel: letzte Commits je Fall (was der Ingester sortiert hat). */
export async function stapel(): Promise<StapelEintrag[]> {
  const faelle = await vault.listFaelle();
  const eintraege: StapelEintrag[] = [];
  for (const f of faelle) {
    try {
      const saetze = await vault.fallErzaehlung(f.id);
      const letzte = saetze[0]; // fallErzaehlung liefert neueste zuerst
      if (letzte) {
        eintraege.push({
          fallId: f.id,
          satz: letzte.satz,
          commitZeile: letzte.commitZeile,
        });
      }
    } catch {
      continue;
    }
  }
  return eintraege;
}

/**
 * NeuesThema: offene Vorschläge, deren Titel einen Fall andeuten, der
 * noch nicht existiert — der Ingester schlägt einen Fall vor.
 * (Ehrlichkeit: nur wenn es wirklich offene Vorschläge gibt.)
 */
export interface ThemaVorschlag {
  fallIdVorschlag: string;  // sluggified
  titel: string;
  quelle: string;
  proposalId: string;
}

export async function neuesThema(): Promise<ThemaVorschlag[]> {
  const faelle = await vault.listFaelle();
  const existierende = new Set(faelle.map(f => f.id.toLowerCase()));

  const vorschlaege: ThemaVorschlag[] = [];
  for (const fall of faelle) {
    const offen = await vault.listVorschlaege(fall.id).catch(() => []);
    for (const v of offen) {
      const titel = v.kartentext?.titel ?? '';
      const slug = titel.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (slug && !existierende.has(slug)) {
        vorschlaege.push({
          fallIdVorschlag: slug,
          titel,
          quelle: `aus Fall ${fall.id} · Vorschlag ${v.id}`,
          proposalId: v.id,
        });
      }
    }
    if (vorschlaege.length >= 3) break; // max 3 Vorschläge — keine Drängelei
  }
  return vorschlaege;
}
