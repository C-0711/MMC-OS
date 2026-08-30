#!/usr/bin/env node
/**
 * gitchain-ref v0.2 — mit Super-Brain-Auto-Deploy
 * Erweiterung: Policy-basierte Zuordnung, Metrik-Artefakte, Cluster-Karten
 * (super-brain-v0.1.md in Code)
 */
'use strict';
const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ladeKorrekturen, korrekturLernen, policyVorschlagErzeugen, policyAnwenden, SCHWELLE } = require('./lernen.js');
const auth = require('./auth.js');
const connectors = require('./connectors.js');
const { signalingErweiternTcp } = require('./signaling-tcp.js');
const fassung = require('./fassung.js');
const execFileAsync = promisify(execFile);

const PORT = process.env.GITCHAIN_REF_PORT || 3361;
const ROOT = '/opt/data/gitchain-ref';
const VAULT = path.join(ROOT, 'vault');
const POLICY_PFAD = path.join(ROOT, 'policy.json');
const STARTED = new Date();

// ── Policy (gelernte Zuordnung, versioniert) ───────────────
const STANDARD_POLICY = {
  version: 1,
  regeln: [
    { wenn: { absenderEnthaelt: 'weber' }, dann: { fall: 'weber-beziehung', begruendung: 'Partner-Bezug' } },
    { wenn: { absenderEnthaelt: 'finanzamt' }, dann: { fall: 'steuern', begruendung: 'Steuersache' } },
    { wenn: { inhaltEnthaelt: ['rechnung', 'betrag', '€'] }, dann: { fall: 'belege', begruendung: 'Belegart' } },
  ],
};
function ladePolicy() {
  try { return JSON.parse(fs.readFileSync(POLICY_PFAD, 'utf8')); }
  catch { fs.writeFileSync(POLICY_PFAD, JSON.stringify(STANDARD_POLICY, null, 2)); return STANDARD_POLICY; }
}

async function git(cwd, ...args) {
  const { stdout } = await execFileAsync('git', ['-c', 'user.name=gitchain-ref', '-c', 'user.email=ref@gitchain.local', ...args], { cwd });
  return stdout.trim();
}
async function fallExistiert(id) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) return false;
  try { await git(path.join(VAULT, id), 'rev-parse', '--git-dir'); return true; } catch { return false; }
}
async function createFall(id) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) throw new Error('fall-id: nur [a-z0-9-]');
  const p = path.join(VAULT, id);
  if (fs.existsSync(p)) throw new Error('fall existiert bereits');
  fs.mkdirSync(path.join(p, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(p, 'atoms'), { recursive: true });
  await git(p, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(p, 'fall.json'), JSON.stringify({ id, erstellt: new Date().toISOString() }, null, 2));
  await git(p, 'add', '.'); await git(p, 'commit', '-q', '-m', `fall: ${id}`);
  return { id, pfad: p };
}
async function commitEingang(fallId, eingang) {
  const { absender, kanal, nutzlastB64, name } = eingang;
  if (!absender || !nutzlastB64) throw new Error('absender und nutzlastB64 sind Pflicht');
  const fallPfad = path.join(VAULT, fallId);
  const bytes = Buffer.from(nutzlastB64, 'base64');
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const dir = path.join(fallPfad, 'docs', 'eingang', new Date().toISOString().slice(0, 10));
  fs.mkdirSync(dir, { recursive: true });
  const dateiName = `${name || 'eingang'}-${sha.slice(0, 8)}`;
  const docPfad = path.join(dir, dateiName);
  fs.writeFileSync(docPfad, bytes);
  fs.writeFileSync(docPfad + '.eingang.json', JSON.stringify({ typ: 'eingang', absender, kanal: kanal || 'unbekannt', zeitpunkt: new Date().toISOString(), sha256: sha, doc: path.relative(fallPfad, docPfad), bytes: bytes.length }, null, 2));
  await git(fallPfad, 'add', '.'); await git(fallPfad, 'commit', '-q', '-m', `eingang: ${absender} (${kanal || 'unbekannt'})`);
  return { sha, doc: path.relative(fallPfad, docPfad), commit: await git(fallPfad, 'rev-parse', 'HEAD'), fall: fallId };
}
async function proposeDeutung(fallId, deutung) {
  const { proposalId, atoms, kartentext } = deutung;
  if (!Array.isArray(atoms) || !atoms.length) throw new Error('atoms[] ist Pflicht');
  for (const a of atoms) {
    const f = a.fundstelle;
    const ok = f && (
      (f.art === 'dokument' || !f.art) && f.doc                            // klassisch
      || (f.art === 'anruf' && f.wav && f.minute)                          // C.1/C.7
      || (f.art === 'connector' && f.system && f.objekt && f.revision)   // W1.1
    );
    if (!ok) throw new Error('jedes Atom braucht eine gültige Fundstelle (dokument: doc | anruf: wav+minute | connector: system+objekt+revision)');
  }
  const fallPfad = path.join(VAULT, fallId);
  const branch = `vorschlag/${proposalId || crypto.randomBytes(4).toString('hex')}`;
  try { await git(fallPfad, 'checkout', '-q', '-b', branch); } catch { await git(fallPfad, 'checkout', '-q', branch); } // idempotent
  const zeilen = atoms.map((a, i) => JSON.stringify({ id: `atom-${Date.now()}-${i}`, feld: a.feld || 'deutung', wert: a.wert, fundstelle: a.fundstelle, conf: a.conf ?? null, zweifel: (a.conf ?? 1) < 0.5 }));
  fs.mkdirSync(path.join(fallPfad, 'atoms'), { recursive: true });
  fs.writeFileSync(path.join(fallPfad, 'atoms', `${proposalId || 'vorschlag'}.jsonl`), zeilen.join('\n') + '\n');
  await git(fallPfad, 'add', '.'); await git(fallPfad, 'commit', '-q', '-m', `deutung: ${atoms.length} atoms (branch-only)`);
  const sha = await git(fallPfad, 'rev-parse', 'HEAD');
  await git(fallPfad, 'checkout', '-q', 'main');
  return { branch, sha };
}

// ── SUPER-BRAIN: Policy-Auswertung + Auto-Deploy ────────────
function policyEntscheidung(absender, text) {
  const policy = ladePolicy();
  const a = (absender || '').toLowerCase(); const t = (text || '').toLowerCase();
  for (const r of policy.regeln) {
    const w = r.wenn;
    if (w.absenderEnthaelt && a.includes(w.absenderEnthaelt)) return { fall: r.dann.fall, begruendung: r.dann.begruendung, policyVersion: policy.version, konfidenz: 0.91 };
    if (w.inhaltEnthaelt && w.inhaltEnthaelt.some(s => t.includes(s))) return { fall: r.dann.fall, begruendung: r.dann.begruendung, policyVersion: policy.version, konfidenz: 0.85 };
  }
  return null;
}

async function autoDeploy(eingang) {
  const { absender, kanal, nutzlastB64, name } = eingang;
  const text = Buffer.from(nutzlastB64, 'base64').toString('utf8');
  const entscheidung = policyEntscheidung(absender, text);

  if (!entscheidung) {
    return { status: 'vorschlag', grund: 'keine Policy-Regel — fail closed, bitte zuordnen',
      vorschlaege: fs.readdirSync(VAULT).filter(d => fs.existsSync(path.join(VAULT, d, '.git'))) };
  }
  const ziel = entscheidung.fall;
  const zielExistiert = await fallExistiert(ziel);
  if (!zielExistiert) {
    return { status: 'cluster-karte', grund: `Policy will ${ziel}, Container existiert nicht — neuer Container? (Garten-Operation)`, entscheidung };
  }
  // AUTO-DEPLOY: Commit vor Deutung in Ziel, mit Policy-Referenz
  const r = await commitEingang(ziel, eingang);
  const fallPfad = path.join(VAULT, ziel);
  // Deploy-Evidenz als Sidecar (Spec §2)
  const ev = { typ: 'auto-deploy', zielFall: ziel, eingangSha: r.sha, entschiedenDurch: { policy: `zuordnung-v${entscheidung.policyVersion}`, konfidenz: entscheidung.konfidenz, begruendung: entscheidung.begruendung }, zeitpunkt: new Date().toISOString() };
  const evPfad = path.join(fallPfad, 'docs', 'eingang', new Date().toISOString().slice(0, 10), `${r.sha.slice(0, 8)}.deploy.json`);
  fs.writeFileSync(evPfad, JSON.stringify(ev, null, 2));
  await git(fallPfad, 'add', '.'); await git(fallPfad, 'commit', '-q', '-m', `auto-deploy: policy v${entscheidung.policyVersion} (${entscheidung.begruendung})`);
  const deployCommit = await git(fallPfad, 'rev-parse', 'HEAD');
  return { status: 'auto-deployed', fall: ziel, ...r, deployCommit, entscheidung };
}

// ── Metrik-Artefakte (Spec §5: Brain beweist seine Hausarbeit) ──
async function metrikArtefakt() {
  const faelle = fs.readdirSync(VAULT).filter(d => fs.existsSync(path.join(VAULT, d, '.git')));
  const metrik = { datum: new Date().toISOString(), faelle: {} };
  for (const f of faelle) {
    const log = await git(path.join(VAULT, f), 'log', '--oneline');
    metrik.faelle[f] = { commits: log.split('\n').filter(Boolean).length };
  }
  const dir = path.join(ROOT, 'brain', 'metrics');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(p, JSON.stringify(metrik, null, 2));
  return { artefakt: path.relative(ROOT, p), metrik };
}

// ── HTTP ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/v2/health') {
      const faelle = fs.readdirSync(VAULT).filter(d => fs.existsSync(path.join(VAULT, d, '.git')));
      return json(200, { status: 'ok', service: '@gitchain/ref', version: '0.3.0-lernend', backend: 'git-fs', containers: faelle.length, uptimeS: Math.round((Date.now() - STARTED) / 1000) });
    }
    if (req.method === 'GET' && url.pathname === '/api/brain/metrics') return json(200, (await metrikArtefakt()).metrik);
    if (req.method === 'GET' && url.pathname === '/api/brain/policy') return json(200, ladePolicy());
    if (req.method === 'GET' && url.pathname === '/api/v2/connectors/mocks') {
      return json(200, Object.fromEntries(Object.entries(connectors.MOCKS).map(([k, m]) => [k, { system: k, endpoint: m.endpoint, objekte: Object.keys(m.items), abgerufenDurch: m.abgerufenDurch }])));
    }
    // OsConnectorBeweis: Fundstelle als zitierbares Artefakt (hash-adressiert)
    if (url.pathname.startsWith('/api/v2/connectors/fundstelle/')) {
      const hash = url.pathname.split('/').pop();
      const a = connectors.artefatzHolen(hash);
      if (!a) return json(404, { fehler: 'Artefakt unbekannt — erst /widerspruch oder /pull erzeugen Artefakte' });
      return json(200, a);
    }
    // OsRevision: Revisions-Historie je Objekt (was galt wann)
    if (url.pathname.startsWith('/api/v2/connectors/revisionen/')) {
      const objekt = url.pathname.split('/').pop();
      return json(200, connectors.revisionsHistorie(objekt));
    }
    // OsVereinbarung/OsUebernahme: Fassung abrufen (Diff-Daten + Siegel-Zeilen)
    if (url.pathname.startsWith('/api/v2/fall/') && url.pathname.endsWith('/fassung-uebersicht')) {
      const teileF = url.pathname.split('/').filter(Boolean);
      // [api, v2, fall, <fallId>, <fassungId>, fassung-uebersicht]
      const f = fassung.fassungHolen(teileF[3], teileF[4]);
      if (!f) return json(404, { fehler: 'Fassung nicht gefunden' });
      return json(200, f);
    }
    // Übergaben eines Falls listen (OsUebergang: Zustandsanzeige)
    if (url.pathname.startsWith('/api/v2/fall/') && url.pathname.endsWith('/uebergaben')) {
      const teileF = url.pathname.split('/').filter(Boolean);
      return json(200, { uebergaben: fassung.uebergabeListe(teileF[3]) });
    }
    // OsDivergenz: was gilt aktuell (signierte Auflösungen)?
    if (url.pathname.startsWith('/api/v2/connectors/gueltigkeit/')) {
      const objekt = url.pathname.split('/').pop();
      return json(200, { objekt, gueltig: connectors.gueltigkeitAbfragen(objekt) });
    }
    if (req.method === 'GET' && url.pathname === '/api/chain/status') return json(200, { status: 'ok', modus: 'referenz (kein chain-backend — Signatur/Anchor laut Spec: QTSP/EBSI/OTS)', signaturErzwungen: false, hinweis: 'Referenz-Instanz beweist Container-Mechanik, nicht Verankerung' });

    if (req.method === 'GET' && url.pathname === '/api/brain/lernen') {
      return json(200, { korrekturen: ladeKorrekturen(), schwelle: SCHWELLE });
    }
    if (req.method === 'POST') {
      const body = await new Promise((ok, err) => { let b = ''; req.on('data', c => b += c); req.on('end', () => ok(b)); req.on('error', err); });
      const daten = body ? JSON.parse(body) : {};
      const teile = url.pathname.split('/').filter(Boolean);

      if (teile[2] === 'fall' && teile.length === 4 && !teile[4]) return json(201, await createFall(daten.id || teile[3]));
      if (teile[2] === 'fall' && teile[4] === 'eingang') {
        if (!await fallExistiert(teile[3])) return json(404, { fehler: 'fall nicht gefunden' });
        return json(201, await commitEingang(teile[3], daten));
      }
      if (teile[2] === 'fall' && teile[4] === 'deutung') {
        if (!await fallExistiert(teile[3])) return json(404, { fehler: 'fall nicht gefunden' });
        return json(201, await proposeDeutung(teile[3], daten));
      }
      // NEU: Auto-Deploy — der Brain entscheidet den Ziel-Container selbst
      if (teile[0] === 'api' && teile[1] === 'brain' && teile[2] === 'deploy') {
        return json(200, await autoDeploy(daten));
      }
      // NEU v0.3: Korrektur-Lernen — "Anders"-Antwort wird Memory-Commit
      if (teile[0] === 'api' && teile[1] === 'brain' && teile[2] === 'korrektur') {
        const r = korrekturLernen(daten);
        let vorschlag = null;
        if (r.bereitFuerVorschlag) vorschlag = policyVorschlagErzeugen(daten.absender, daten.korrigiertNach);
        return json(200, { ...r, vorschlag });
      }
      // NEU v0.3: Policy-Vorschlag signieren (four-eyes → neue Policy-Version)
      if (teile[0] === 'api' && teile[1] === 'brain' && teile[2] === 'policy' && teile[3] === 'annehmen') {
        return json(200, policyAnwenden(daten.vorschlagTs));
      }
      // FRONT3 A.4: AUTH — E-Mail = Zustelladresse, Container entsteht automatisch
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'auth' && teile[3] === 'anfang') {
        return json(200, auth.authAnfang(daten.email));
      }
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'auth' && teile[3] === 'bestaetigen') {
        return json(200, await auth.authBestaetigen(daten.zustellId, daten.code, { createFall: (id) => createFall(id) }));
      }
      // W1.5: Connector-Pull — System-API wird committeter Eingang mit Fundstellen
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'connectors' && teile[3] === 'pull') {
        return json(200, await connectors.connectorPull(daten, (fallId, eingang) => commitEingang(fallId, eingang)));
      }
      // W1.5: Widerspruchs-Engine — Karte mit ZWEI Fundstellen
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'connectors' && teile[3] === 'widerspruch') {
        return json(200, connectors.widerspruchPruefung(daten.systemA || 'teamcenter', daten.systemB || 'pim', daten.objekt || 'MNR-4711'));
      }
      // C.7: Anruf-Sitzung — eröffnet Live-Spur im Fall, Atoms mit Minuten-Fundstelle
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'fall' && teile[4] === 'anruf') {
        if (!await fallExistiert(teile[3])) return json(404, { fehler: 'fall nicht gefunden' });
        const sitzungId = 'anruf-' + Date.now().toString(36);
        return json(201, { sitzungId, fall: teile[3], gestartet: new Date().toISOString(), hinweis: 'Atoms via /deutung mit fundstelle.art=anruf committen' });
      }
      // OsDivergenz: Widerspruch auflösen → signierte Fassung (fail closed ohne Fundstelle)
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'connectors' && teile[3] === 'aufloesen') {
        const w = connectors.widerspruchPruefung(daten.systemA || 'teamcenter', daten.systemB || 'pim', daten.objekt || 'MNR-4711');
        const wid = w.widersprueche.find(x => x.attribut === daten.attribut);
        if (!wid) throw new Error('kein offener Widerspruch für dieses Attribut');
        const quelle = daten.giltSystem === 'teamcenter' ? wid.wertA.fundstelle : wid.wertB.fundstelle;
        const fassung = connectors.divergenzAufloesen({
          objekt: daten.objekt || 'MNR-4711', attribut: daten.attribut,
          giltSystem: daten.giltSystem, fundstelle: quelle, signiertVon: daten.signiertVon,
        });
        return json(200, { aufgeloest: true, fassung, hinweis: 'Signierte Fassung gilt ab jetzt — bis ein System sie wieder widerspricht' });
      }
      // ── OsVereinbarung: Fassung erzeugen / signieren ──
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'fall' && teile[4] === 'fassung') {
        const r = fassung.fassungErstellen(teile[3], daten);
        return json(201, r);
      }
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'fall' && teile[4] === 'fassung-signieren') {
        const r = fassung.fassungSignieren(teile[3], daten.fassungId, daten.did);
        return json(200, r);
      }
      // ── OsUebernahme/OsUebergang: Übergabe des Klon-Angebots ──
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'fall' && teile[4] === 'uebergabe') {
        return json(201, fassung.uebergabeStarten(daten));
      }
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'fall' && teile[4] === 'uebergabe-annehmen') {
        return json(200, fassung.uebergabeAnnehmen(daten.uebergabeId, daten.did));
      }
      if (teile[0] === 'api' && teile[1] === 'v2' && teile[2] === 'fall' && teile[4] === 'uebergabe-ablehnen') {
        return json(200, fassung.uebergabeAblehnen(daten.uebergabeId, daten.did, daten.grund));
      }
      // (der GET-/api/brain/lernen-Handler liegt oben beim anderen GET-Block)
      return json(404, { fehler: 'unbekannter Pfad', bekannt: ['/api/v2/health', '/api/brain/deploy (POST)', '/api/brain/metrics', '/api/brain/policy', '/api/brain/lernen (GET)', '/api/v2/fall/<id>/eingang', '/api/v2/fall/<id>/deutung'] });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/v2/fall/')) {
      const teile = url.pathname.split('/').filter(Boolean);
      const id = teile[3];
      if (!await fallExistiert(id)) return json(404, { fehler: 'fall nicht gefunden' });
      if (teile[4] === 'erzaehlung') {
        const log = await git(path.join(VAULT, id), 'log', '--reverse', '--format=%H%x1f%aI%x1f%s');
        return json(200, { saetze: log.split('\n').filter(Boolean).map(l => { const [sha, iso, msg] = l.split('\x1f'); return { satz: msg, commitZeile: `${sha.slice(0, 8)} · ${iso}` }; }) });
      }
      return json(200, { fall: id });
    }
    return json(404, { fehler: 'nicht gefunden' });
  } catch (e) { return json(400, { fehler: e.message }); }
});

fs.mkdirSync(VAULT, { recursive: true });
ladePolicy();
auth.init();

// ── Signaling-Server (CALL C.2) — TCP-JSON auf :3362 ──
const net = require('net');
const SIGNALING_PORT = 3362;
const sig = signalingErweiternTcp();
net.createServer(sock => sig.verbinde(sock)).listen(SIGNALING_PORT, '127.0.0.1', () => {
  console.log('Signaling (TCP-JSON) auf :' + SIGNALING_PORT + ' — sieht nie Medien');
});
server.listen(PORT, '127.0.0.1', () => console.log(`gitchain-ref v0.3-lernend auf :${PORT} · Auto-Deploy aktiv`));
