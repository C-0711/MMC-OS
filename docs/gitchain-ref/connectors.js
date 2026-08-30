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
      widersprueche.push({
        attribut: attr,
        wertA: { wert: wertA, fundstelle: connectorFundstelle(systemA, objekt, `${objekt}.${attr}`) },
        wertB: { wert: wertB, fundstelle: connectorFundstelle(systemB, objekt, `${objekt}.${attr}`) },
        karte: {
          titel: `Widerspruch: ${attr} ${objekt}`,
          frage: `${systemA} (${a.attribute[attr].geaendert.slice(0, 10)}, ${a.attribute[attr].von}) sagt "${wertA}", ${systemB} (${b.attribute[attr].geaendert.slice(0, 10)}, ${b.attribute[attr].von}) sagt "${wertB}" — welche gilt?`,
        },
      });
    }
  }
  return { objekt, geprueft: Object.keys(a.attribute).length, widersprueche };
}

module.exports = { MOCKS, connectorPull, widerspruchPruefung, connectorFundstelle };
