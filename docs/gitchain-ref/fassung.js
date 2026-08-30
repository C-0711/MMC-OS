/**
 * gitchain-ref — Fassungs-Mechanik (OsVereinbarung / OsUebernahme / OsUebergang)
 *
 * Die signierte Fassung zwischen zwei Seiten (communication-v0.1.md §5):
 *   - Fassung = committeter Stand aus Atoms (Draft → signiert → gültig)
 *   - Multi-eyes: JEDE beteiligte Seite signiert; erst dann gilt die Fassung
 *   - Übergabe-Zustand (OsUebernahme/OsUebergang): Klon-Angebot → angenommen/abgelehnt
 *
 * Harte Regeln:
 *   - Keine Fassung ohne Atoms mit Fundstellen (keine Aussage ohne Beweis)
 *   - Gültigkeit braucht ALLE Signaturen (four-eyes auf beiden Seiten)
 *   - Signatur bezieht sich auf den Fassungs-Hash — nachträgliche Änderung = neue Fassung
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.GITCHAIN_REF_ROOT || '/opt/data/gitchain-ref';
const FASSUNGEN_DIR = path.join(ROOT, 'fassungen'); // je Fall eine JSON-Datei (Persistenz)

function fallDatei(fallId) { return path.join(FASSUNGEN_DIR, `${fallId}.json`); }
function lade(fallId) {
  try { return JSON.parse(fs.readFileSync(fallDatei(fallId), 'utf8')); } catch { return {}; }
}
function speichere(fallId, daten) {
  fs.mkdirSync(FASSUNGEN_DIR, { recursive: true });
  fs.writeFileSync(fallDatei(fallId), JSON.stringify(daten, null, 2));
}

// ── Fassung erzeugen (Draft) ───────────────────────────────
function fassungErstellen(fallId, { titel, atoms, beteiligte }) {
  if (!Array.isArray(atoms) || !atoms.length) throw new Error('Fassung braucht Atoms');
  for (const a of atoms) {
    const f = a.fundstelle;
    const ok = f && ((f.art === 'dokument' || !f.art) && f.doc || (f.art === 'anruf' && f.wav && f.minute) || (f.art === 'connector' && f.system && f.revision));
    if (!ok) throw new Error('jedes Atom braucht eine gültige Fundstelle — eine Fassung aus Meinungen ist keine Fassung');
  }
  if (!Array.isArray(beteiligte) || beteiligte.length < 1) throw new Error('beteiligte[] ist Pflicht (wer muss signieren)');

  // Kanonischer Hash über den Fassungs-Inhalt: Änderung ⇒ anderer Hash ⇒ alte Signaturen ungültig
  const inhalt = { titel, atoms, beteiligte };
  const fassungHash = crypto.createHash('sha256').update(JSON.stringify(inhalt)).digest('hex').slice(0, 16);
  const id = `fassung-${fassungHash}`;

  const db = lade(fallId);
  if (db[id]) return { ...db[id], bereits: true };
  db[id] = {
    id, fall: fallId, titel: titel || 'Vereinbarung',
    fassungHash, atoms, beteiligte,
    signaturen: {},            // did → {ts}
    zustand: 'draft',          // draft → signiert_laufend → gueltig
    erstellt: new Date().toISOString(),
  };
  speichere(fallId, db);
  return db[id];
}

// ── Signieren (Multi-eyes) ─────────────────────────────────
function fassungSignieren(fallId, fassungId, did) {
  const db = lade(fallId);
  const f = db[fassungId];
  if (!f) throw new Error('Fassung nicht gefunden');
  if (!f.beteiligte.includes(did)) throw new Error(`${did} ist nicht Beteiligter dieser Fassung`);
  if (f.zustand === 'gueltig') throw new Error('Fassung ist bereits gültig — Änderungen brauchen eine neue Fassung');
  if (f.signaturen[did]) throw new Error('bereits signiert (eine Stimme pro Seite)');

  f.signaturen[did] = { ts: new Date().toISOString() };
  const fehlen = f.beteiligte.filter(b => !f.signaturen[b]);
  if (fehlen.length === 0) {
    f.zustand = 'gueltig';
    f.gueltig_seit = new Date().toISOString();
  } else {
    f.zustand = 'signiert_laufend';
    f.warten_auf = fehlen;
  }
  speichere(fallId, db);
  return { fassungId, signiert: true, von: did, zustand: f.zustand, warten_auf: fehlen.length ? fehlen : undefined, gueltig_seit: f.gueltig_seit };
}

// ── Fassung abrufen (Diff-Daten für den Screen) ────────────
function fassungHolen(fallId, fassungId) {
  const db = lade(fallId);
  const f = db[fassungId];
  if (!f) return null;
  return {
    ...f,
    noch_offen: f.beteiligte.filter(b => !f.signaturen[b]),
    // Screen-Daten: wer hat wann signiert (Zeile je Siegel)
    siegel: f.beteiligte.map(b => ({ did: b, signiert: !!f.signaturen[b], ts: f.signaturen[b]?.ts || null })),
  };
}

// ── Übergabe (OsUebernahme/OsUebergang): Klon-Angebot ──────
const UEBERGABEN = new Map(); // uebergabeId → {fall, von, an, zustand}
function uebergabeStarten({ fall, von, an, scope }) {
  if (!fall || !von || !an) throw new Error('fall, von, an sind Pflicht');
  const id = 'uebergabe-' + crypto.randomBytes(6).toString('hex');
  UEBERGABEN.set(id, {
    id, fall, von, an,
    scope: scope || { atoms: 'all', operationen: ['search', 'get-atom'], dauer: 'unbefristet-bis-widerruf' },
    zustand: 'angeboten', erstellt: new Date().toISOString(),
  });
  return UEBERGABEN.get(id);
}
function uebergabeAnnehmen(id, did) {
  const u = UEBERGABEN.get(id);
  if (!u) throw new Error('Übergabe nicht gefunden');
  if (did !== u.an) throw new Error('nur der Adressat kann annehmen');
  u.zustand = 'angenommen'; u.angenommen = new Date().toISOString();
  return { ...u, hinweis: 'Klon übernommen — beide Seiten führen denselben Baum ab jetzt' };
}
function uebergabeAblehnen(id, did, grund) {
  const u = UEBERGABEN.get(id);
  if (!u) throw new Error('Übergabe nicht gefunden');
  if (did !== u.an) throw new Error('nur der Adressat kann ablehnen');
  u.zustand = 'abgelehnt'; u.grund = grund || null;
  return u;
}
function uebergabeListe(fall) {
  return [...UEBERGABEN.values()].filter(u => u.fall === (typeof fall === 'string' ? fall : fall?.fall));
}

module.exports = { fassungErstellen, fassungSignieren, fassungHolen, uebergabeStarten, uebergabeAnnehmen, uebergabeAblehnen, uebergabeListe };
