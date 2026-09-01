/**
 * showcase.ts — Buderus-Enterprise-Showcase: Der komplette Firmenschatz
 * eines Buderus-Kunden, in einem Schlag in gitchain geladen.
 *
 * Simuliert den Enterprise-Use-Case: Ein Handwerksbetrieb lädt SEINE
 * komplette Buderus-Welt (Kataloge, Datenblätter, Rechnungen, Verträge,
 * Anrufe) in sein gitchain. Danach ist der Schatz abfragbar (Frag alles)
 * und baubar (Studio) — alles nur aus seinen eigenen Dokumenten.
 *
 * Der Setup ist idempotent: existiert der Fall schon, wird nichts doppelt
 * geladen.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as vault from './vault';
import { deutungAusOcr, deutungAusTranskript, type Transkript } from './deutung';

export const SHOWCASE_FALL = 'buderus-firmenschatz';

function fixturesPfad(): string {
  return path.join(process.env.SHOWCASE_FIXTURES ?? path.join(process.cwd(), 'test', 'fixtures', 'buderus'));
}

interface ManifestEintrag {
  datei: string;
  typ: string;
  gattung: string;
  titel: string;
}

/** Der Showcase-Stand: liegt der Schatz schon im Vault? */
export async function showcaseStand(): Promise<{ geladen: boolean; dokumente: number; faelle: string[] }> {
  const faelle = await vault.listFaelle();
  const geladen = faelle.some(f => f.id === SHOWCASE_FALL);
  let dokumente = 0;
  if (geladen) {
    const pfad = path.join(process.env.MMC_VAULT ?? path.join(os.homedir(), 'MMC-Vault'), SHOWCASE_FALL, 'docs');
    try {
      dokumente = (await fs.readdir(pfad)).filter(f => !f.startsWith('.')).length;
    } catch { dokumente = 0; }
  }
  return { geladen, dokumente, faelle: faelle.map(f => f.id) };
}

/**
 * Lädt den kompletten Buderus-Korpus in den Fall — Belege mit voller
 * Deutung (Karten!), Werkstoffe still (Sanduhr-Geist: committen, keine
 * Fragen), Mitschriften als Anruf-Deutung.
 */
export async function ladeShowcase(): Promise<{
  fall: string;
  belege: number;
  werkstoffe: number;
  karten: number;
}> {
  // Fall anlegen (oder existierenden nutzen)
  const existiert = (await vault.listFaelle()).some(f => f.id === SHOWCASE_FALL);
  if (!existiert) {
    await vault.createFall(SHOWCASE_FALL);
  }

  const manifestRaw = await fs.readFile(path.join(fixturesPfad(), 'manifest.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw) as ManifestEintrag[];

  let belege = 0;
  let werkstoffe = 0;
  let karten = 0;

  for (const eintrag of manifest) {
    const bytes = await fs.readFile(path.join(fixturesPfad(), eintrag.datei));

    // Mitschriften: Anruf-Weg (kanal 'anruf', Deutung aus Transkript)
    let transkript: Transkript | null = null;
    if (eintrag.datei.endsWith('.json')) {
      try {
        const t = JSON.parse(bytes.toString('utf-8')) as Transkript;
        if (t?.art === 'anruf' && Array.isArray(t.zeilen)) transkript = t;
      } catch { /* normal weiter */ }
    }

    // Eingang committen (byte-identisch, VOR jeder Deutung)
    await vault.commitEingang(
      SHOWCASE_FALL,
      transkript
        ? { absender: 'Buderus Service', kanal: 'anruf' }
        : { absender: 'Buderus', kanal: eintrag.gattung === 'werkstoff' ? 'werkstoff' : 'post' },
      { name: eintrag.datei, bytes: Buffer.from(bytes) }
    );

    // Werkstoff: still committet, KEINE Karte (B3/B5.2-Geist)
    if (eintrag.gattung === 'werkstoff') {
      werkstoffe++;
      continue;
    }

    // Beleg: Deutung als Vorschlag → Karte im Heute
    belege++;
    try {
      let kartentext: { titel: string; frage: string; deutungV?: number };
      let atoms: vault.Atom[] = [];
      if (transkript) {
        const d = deutungAusTranskript(transkript, eintrag.datei);
        atoms = d.atoms;
        kartentext = d.kartentext;
      } else {
        // Text-Belege: einfache Text-Deutung (OCR-Frei — die .txt sind schon Text)
        const zeilen = bytes.toString('utf-8').split('\n');
        const d = textDeutung(zeilen, eintrag.datei, eintrag.titel);
        atoms = d.atoms;
        kartentext = d.kartentext;
      }
      if (atoms.length > 0) {
        await vault.proposeDeutung(SHOWCASE_FALL, `showcase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, atoms, kartentext);
        karten++;
      }
    } catch { /* Deutung darf scheitern — der Eingang bleibt verwahrt */ }
  }

  return { fall: SHOWCASE_FALL, belege, werkstoffe, karten };
}

// ============================================================================
// Text-Deutung für .txt-Belege (ohne OCR-Dienst): Absender, Beträge, Daten
// — dasselbe Muster wie deutungAusOcr, aber direkt aus Zeilen.
// ============================================================================

function textDeutung(
  zeilen: string[],
  docName: string,
  titelHint: string
): { atoms: vault.Atom[]; kartentext: { titel: string; frage: string; deutungV: number } } {
  const atoms: vault.Atom[] = [];
  const GELD = /\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g;
  const DATUM = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;
  const ABSENDER = /^\s*(?:von|absender)\s*:\s*(.+)$/i;

  zeilen.forEach((text, i) => {
    const absender = text.match(ABSENDER);
    if (absender?.[1] && absender[1].trim().length > 2) {
      atoms.push({
        id: `sa-${i}-absender`,
        feld: 'Absender',
        wert: absender[1].trim().slice(0, 80),
        fundstelle: { doc: docName, seite: 1 },
        conf: 1.0,
      });
    }
    for (const m of text.matchAll(GELD)) {
      const feld = text.split(m[0])[0].trim() || 'Betrag';
      atoms.push({
        id: `sa-${i}-geld-${m[0]}`,
        feld: feld.slice(0, 60) || 'Betrag',
        wert: m[0],
        fundstelle: { doc: docName, seite: 1 },
        conf: 1.0,
      });
    }
    for (const m of text.matchAll(DATUM)) {
      const vor = text.slice(0, m.index ?? 0).trim().toLowerCase();
      const feld = /(fällig|zahlbar|bis|frist|datum)/.test(vor) ? vor.split(/\s+/).slice(-2).join(' ') || 'Datum' : 'Datum';
      atoms.push({
        id: `sa-${i}-datum-${m[0]}`,
        feld: feld.slice(0, 60),
        wert: `${m[1]}.${m[2]}.${m[3]}`,
        fundstelle: { doc: docName, seite: 1 },
        conf: 1.0,
      });
    }
  });

  // Dedupe (Feld|Wert)
  const gesehen = new Set<string>();
  const deduped = atoms.filter(a => {
    const k = `${a.feld}|${a.wert}`;
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    return true;
  });

  const name = deduped.find(a => a.feld === 'Absender')?.wert;
  const betrag = deduped.find(a => a.feld.toLowerCase().includes('betrag'))?.wert;
  const titel = name
    ? `${titelHint} von ${name}`
    : betrag
      ? `${titelHint} über ${betrag} €`
      : titelHint;

  return {
    atoms: deduped,
    kartentext: {
      titel,
      frage: deduped.length > 0
        ? `${deduped.slice(0, 3).map(a => `${a.feld}: ${a.wert}`).join(' · ')}${deduped.length > 3 ? ' …' : ''} — stimmt das?`
        : 'Nichts Verbindliches gefunden — magst du selbst schauen?',
      deutungV: 2,
    },
  };
}
