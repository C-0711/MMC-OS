/**
 * gitchain-ref — Connector-Schicht (W1.5, workspace-business-v0.1.md)
 *
 * Connector-Anchoring: Jeder Systemzugriff wird zu einer zitierbaren Fundstelle.
 * Mock-First: Teamcenter + ERP + PIM mit eingebautem WIDERSPRUCH (der Demo-Kern).
 *
 * Endpunkte (via server.js):
 *   GET  /api/v2/connectors/mock/teamcenter      → Pull liefert Items mit Revisionen
 *   POST /api/v2/connectors/pull                 {system, objekt?} → committeter Eingang + Diff
 *   POST /api/v2/connectors/widerspruch-pruefung → Widerspruchs-Karte mit ZWEI Fundstellen
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = '/opt/data/gitchain-ref';

// ── Mock: Teamcenter (mit Revision C/D) ─────────────────────
const TEAMCENTER_MOCK = {
  system: 'teamcenter',
  endpoint: 'https://tc.internal/api/v9/items',
  abgerufenDurch: 'rolle:pim-team',
  items: {
    'MNR-4711': {
      revision: 'C',
      attribute: {
        wanddicke: { wert: '2,1 mm', geaendert: '2026-08-12T14:02:11Z', von: 'konstruktion.mueller' },
        material: { wert: 'AlMg3', geaendert: '2026-03-04T09:15:00Z', von: 'konstruktion.mueller' },
      },
    },
    'MNR-0815': {
      revision: 'D',
      attribute: {
        bautiefe: { wert: '480 mm', geaendert: '2026-08-20T11:30:00Z', von: 'konstruktion.schmidt' },
        material: { wert: 'Stahl S235', geaendert: '2026-08-20T11:31:00Z', von: 'konstruktion.schmidt' },
      },
    },
  },
};

// ── Mock: PIM (mit DEMO-WIDERSPRUCH gegen Teamcenter MNR-4711) ──
const PIM_MOCK = {
  system: 'pim',
  endpoint: 'https://pim.internal/api/v3/attributes',
  abgerufenDurch: 'rolle:pim-team',
  items: {
    'MNR-4711': {
      revision: 'pim-stand-2026-08',
      attribute: {
        wanddicke: { wert: '2,3 mm', geaendert: '2026-08-25T16:44:00Z', von: 'pim.weber' }, // ← WIDERSPRUCH: TC sagt 2,1
        material: { wert: 'AlMg3', geaendert: '2026-04-02T10:00:00Z', von: 'pim.weber' },
      },
    },
  },
};

// ── Mock: ERP ───────────────────────────────────────────────
const ERP_MOCK = {
  system: 'erp',
  endpoint: 'https://erp.internal/api/v2/material',
  abgerufenDurch: 'rolle:disposition',
  items: {
    'MNR-4711': { revision: 'materialstamm-08-2026', attribute: { material: { wert: 'AlMg3', geaendert: '2026-02-11T08:00:00Z', von: 'disposition.klein' } } },
  },
};

const MOCKS = { teamcenter: TEAMCENTER_MOCK, pim: PIM_MOCK, erp: ERP_MOCK };

// ── Connector-Fundstelle (die zitierbare Quelle) ────────────
function connectorFundstelle(system, objekt, attributpfad) {
  const m = MOCKS[system];
  const item = m.items[objekt];
  if (!item) throw new Error(`Objekt ${objekt} in ${system} nicht gefunden`);
  return {
    art: 'connector',
    system,
    objekt,
    revision: item.revision,
    attributpfad,
    wert: item.attribute[attributpfad.split('.').pop()].wert,
    geaendert: item.attribute[attributpfad.split('.').pop()].geaendert,
    endpoint: m.endpoint,
    abgerufen: new Date().toISOString(),
    abgerufenDurch: m.abgerufenDurch,
  };
}

// ── Pull: committeter Eingang ins System-Container-Archiv ────
// (Commit vor Deutung gilt für APIs — der Pull landet byte-identisch)
async function connectorPull({ system, objekt }, commitFn) {
  const m = MOCKS[system];
  if (!m) throw new Error('unbekanntes System (mocks: teamcenter, pim, erp)');
  const item = m.items[objekt];
  if (!item) throw new Error(`Objekt ${objekt} in ${system} nicht gefunden`);
  const daten = { system, objekt, revision: item.revision, attribute: item.attribute, abgerufen: new Date().toISOString(), endpoint: m.endpoint };
  const sidecar = {
    typ: 'connector-pull',
    ...daten,
    fundstellen: Object.keys(item.attribute).map(a => connectorFundstelle(system, objekt, `${objekt}.${a}`)),
  };
  // in den Fall „systeme-<system>" committen (Commit vor Deutung)
  const fallId = `systeme-${system}`;
  const bytes = Buffer.from(JSON.stringify(daten, null, 2));
  const erg = await commitFn(fallId, {
    absender: `${system}/${objekt} rev ${item.revision}`,
    kanal: system,
    nutzlastB64: bytes.toString('base64'),
    name: `${objekt}-rev-${item.revision.replace(/[^a-z0-9-]/gi, '')}`,
  });
  return { fall: fallId, objekt, revision: item.revision, commit: erg.commit, sidecar };
}

// ── Widerspruchs-Engine (der Demo-Kern) ─────────────────────
// Abgleich gleicher Attribute quer über Systeme → Diff-Atom mit ZWEI Fundstellen
function widerspruchPruefung(systemA, systemB, objekt) {
  const a = MOCKS[systemA]?.items[objekt];
  const b = MOCKS[systemB]?.items[objekt];
  if (!a || !b) throw new Error('Objekt muss in beiden Systemen existieren');
  const widersprueche = [];
  for (const attr of Object.keys(a.attribute)) {
    const wertA = a.attribute[attr].wert;
    const wertB = b.attribute[attr]?.wert;
    if (wertB !== undefined && wertA !== wertB) {
      const fsA = connectorFundstelle(systemA, objekt, `${objekt}.${attr}`);
      const fsB = connectorFundstelle(systemB, objekt, `${objekt}.${attr}`);
      const artA = fundstelleAlsArtefakt(fsA);
      const artB = fundstelleAlsArtefakt(fsB);
      widersprueche.push({
        attribut: attr,
        wertA: { wert: wertA, fundstelle: fsA, artefaktHash: artA.hash },
        wertB: { wert: wertB, fundstelle: fsB, artefaktHash: artB.hash },
        karte: {
          titel: `Widerspruch: ${attr} ${objekt}`,
          frage: `${systemA} (${a.attribute[attr].geaendert.slice(0, 10)}, ${a.attribute[attr].von}) sagt "${wertA}", ${systemB} (${b.attribute[attr].geaendert.slice(0, 10)}, ${b.attribute[attr].von}) sagt "${wertB}" — welche gilt?`,
        },
      });
    }
  }
  return { objekt, geprueft: Object.keys(a.attribute).length, widersprueche };
}

// ── OsConnectorBeweis: Fundstelle als zitierbares Artefakt (hash-adressiert) ──
const ARTEFAKTE = new Map(); // hash → fundstelle (auch auf Platte für Persistenz)
function fundstelleAlsArtefakt(f) {
  const kanon = JSON.stringify(f); // deterministisch: gleiche Fundstelle ⇒ gleicher Hash
  const hash = crypto.createHash('sha256').update(kanon).digest('hex').slice(0, 16);
  if (!ARTEFAKTE.has(hash)) ARTEFAKTE.set(hash, { ...f, hash, erstellt: new Date().toISOString() });
  return ARTEFAKTE.get(hash);
}
function artefatzHolen(hash) { return ARTEFAKTE.get(hash) || null; }

// ── OsDivergenz: Auflösung → SIGNIERTE FASSUNG (welche gilt künftig) ──
const GUELTIGKEIT = new Map(); // "objekt.attr" → {fall, attr, wertQuelle: 'teamcenter'|'pim'|..., fundstelleHash, signiertVon, seit}
function divergenzAufloesen({ objekt, attribut, giltSystem, fundstelle, signiertVon }) {
  if (!['teamcenter', 'pim', 'erp'].includes(giltSystem)) throw new Error('giltSystem unbekannt');
  if (!fundstelle || !fundstelle.system || !fundstelle.revision) throw new Error('Auflösung braucht die Fundstelle des gültigen Werts (keine Aussage ohne Beweis)');
  const fassung = {
    objekt, attribut,
    gilt: { system: giltSystem, wert: fundstelle.wert, revision: fundstelle.revision, geaendert: fundstelle.geaendert },
    signiertVon: signiertVon || 'rolle:pim-team',
    seit: new Date().toISOString(),
  };
  GUELTIGKEIT.set(`${objekt}.${attribut}`, fassung);
  return fassung;
}
function gueltigkeitAbfragen(objekt) {
  const out = {};
  for (const [k, v] of GUELTIGKEIT) if (k.startsWith(objekt + '.')) out[k.split('.')[1]] = v;
  return out;
}

// ── OsRevision: Revisions-Historie je Objekt (was galt wann — Retrospektiv-Beweis) ──
function revisionsHistorie(objekt) {
  const zeilen = [];
  for (const [system, m] of Object.entries(MOCKS)) {
    const item = m.items[objekt];
    if (!item) continue;
    for (const [attr, a] of Object.entries(item.attribute)) {
      zeilen.push({
        system, objekt, revision: item.revision,
        attribut: attr, wert: a.wert,
        geaendert: a.geaendert, von: a.von,
        gilt_seit: (GUELTIGKEIT.get(`${objekt}.${attr}`) || {}).seit || null,
        gilt_laut: (GUELTIGKEIT.get(`${objekt}.${attr}`) || {}).gilt?.system || null,
      });
    }
  }
  zeilen.sort((x, y) => (x.geaendert < y.geaendert ? 1 : -1));
  return { objekt, eintraege: zeilen, hinweis: 'Sortiert nach Änderungszeitpunkt; gilt_laut = signierte Divergenz-Auflösung, falls vorhanden' };
}

module.exports = { MOCKS, connectorPull, widerspruchPruefung, connectorFundstelle, fundstelleAlsArtefakt, artefatzHolen, divergenzAufloesen, gueltigkeitAbfragen, revisionsHistorie };
