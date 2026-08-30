/**
 * gitchain-ref v0.3 — Korrektur-Lernen (Spec super-brain-v0.1.md §4.1)
 *
 * Der Lernzyklus:
 *   1. Brain deployt nach Policy → Rückkehr: deploy-id
 *   2. Nutzer antwortet "Anders" + nennt Ziel → korrekturLernen()
 *   3. Ab 3 identischen Korrekturen: Policy-Anpassung wird selbst Vorschlag
 *   4. Nutzer signiert → Policy-Version +1, gelernte Regel aktiv
 *
 * Alles committet: Korrekturen = Memory-Commits, Policy-Änderung = signierter Stand.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.GITCHAIN_REF_ROOT || '/opt/data/gitchain-ref';
const POLICY_PFAD = path.join(ROOT, 'policy.json');
const LERN_PFAD = path.join(ROOT, 'brain', 'korrekturen.jsonl');
const SCHWELLE = 3; // Spec: "Ab 3 identischen Korrekturen: Policy-Anpassung wird selbst Vorschlag"

// ── Lern-Store (append-only JSONL = Memory-Commits) ────────
function ladeKorrekturen() {
  try { return fs.readFileSync(LERN_PFAD, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); }
  catch { return []; }
}
function schreibeKorrektur(eintrag) {
  fs.mkdirSync(path.dirname(LERN_PFAD), { recursive: true });
  fs.appendFileSync(LERN_PFAD, JSON.stringify(eintrag) + '\n');
  return eintrag;
}

// ── Korrektur erfassen ──────────────────────────────────────
// nutzerAntwort: {antwort: "anders", zielFall: "steuern", deployRef: <deploy-id>, grund?}
function korrekturLernen({ absender, gezogenNach, korrigiertNach, deployRef, grund }) {
  const eintrag = {
    ts: new Date().toISOString(),
    absender, gezogenNach, korrigiertNach, deployRef, grund,
    typ: 'korrektur',
    learned_from: deployRef, // Spec agent-containers §3: kein Memory ohne Quelle
  };
  schreibeKorrektur(eintrag);

  // Zähle identische Korrekturen (gleicher Absender-Kontext, gleiches Muster)
  const alle = ladeKorrekturen();
  const identisch = alle.filter(k => k.absender === absender && k.korrigiertNach === korrigiertNach);
  const bereitFuerVorschlag = identisch.length >= SCHWELLE && !bereitsVorgeschlagen(absender, korrigiertNach);

  return { eintrag, korrekturenZaehler: identisch.length, von: SCHWELLE, bereitFuerVorschlag };
}

function bereitsVorgeschlagen(absender, ziel) {
  return ladeKorrekturen().some(k => k.typ === 'policy-vorschlag' && k.absender === absender && k.neueRegel && k.neueRegel.dann && k.neueRegel.dann.fall === ziel);
}

// ── Policy-Vorschlag erzeugen (nach 3 Korrekturen) ──────────
function policyVorschlagErzeugen(absender, ziel) {
  const vorschlag = {
    typ: 'policy-vorschlag',
    ts: new Date().toISOString(),
    absender, ziel,
    vorschlag: `Soll ich künftig Eingänge von "${absender}" immer nach "${ziel}" legen?`,
    neueRegel: { wenn: { absenderEnthaelt: absender.split(' ')[0].toLowerCase() }, dann: { fall: ziel, begruendung: `gelernt aus ${SCHWELLE} Korrekturen` } },
    basis: ladeKorrekturen().filter(k => k.absender === absender && k.korrigiertNach === ziel).map(k => k.ts),
    status: 'offen', // vier-eyes: braucht Unterschrift
  };
  schreibeKorrektur(vorschlag);
  return vorschlag;
}

// ── Policy-Anwendung nach Unterschrift ──────────────────────
function policyAnwenden(vorschlagTs) {
  const alle = ladeKorrekturen();
  const v = alle.find(k => k.typ === 'policy-vorschlag' && k.ts === vorschlagTs && k.status === 'offen');
  if (!v) throw new Error('Vorschlag nicht gefunden oder schon entschieden');

  const policy = JSON.parse(fs.readFileSync(POLICY_PFAD, 'utf8'));
  // Gelernte Regeln NACH den Standard-Regeln (Spezifität gewinnt)
  policy.regeln.push({ ...v.neueRegel, gelernt: true });
  policy.version += 1;

  // Vorschlag als entschieden markieren
  const idx = alle.findIndex(k => k === v);
  alle[idx] = { ...v, status: 'angenommen', angenommen: new Date().toISOString() };
  fs.writeFileSync(LERN_PFAD, alle.map(JSON.stringify).join('\n') + '\n');
  fs.writeFileSync(POLICY_PFAD, JSON.stringify(policy, null, 2));

  return { neueVersion: policy.version, regel: v.neueRegel, hinweis: 'Policy signiert — künftige Deploys folgen der gelernten Regel' };
}

module.exports = { ladeKorrekturen, korrekturLernen, policyVorschlagErzeugen, policyAnwenden, SCHWELLE, POLICY_PFAD, LERN_PFAD };
