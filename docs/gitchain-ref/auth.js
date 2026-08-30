/**
 * gitchain-ref — Auth-Modul (FRONT3 A.4, identitaet-email-container-v0.1.md)
 *
 * E-Mail = Zustelladresse, nie Identität:
 *   1. POST /api/v2/auth/anfang     {email}       → Code erzeugen, nur hash(email) speichern
 *   2. POST /api/v2/auth/bestaetigen {zustellId, code} → Container entsteht automatisch
 *   3. did:key generieren — der Schlüssel ist die Identität
 *   4. Vault-Key (Argon2id-artig via scrypt — Node-Stdlib) → Container AES-verschlüsselt
 *   5. 12 Worte (Recovery) — im Notar-Moment an den Nutzer übergeben
 *
 * Harte Regeln aus der Spec:
 *   - E-Mail NIE im Klartext (nur sha256-Hash in auth/zuordnungen.json)
 *   - Passwort/Code nie speichern, nur Prüfung
 *   - Vault-Key nie im Klartext auf Platte ohne Nutzer-Geheimnis
 */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { zustellerErstellen } = require('./zustaeller.js');
const zusteller = zustellerErstellen();

const ROOT = process.env.GITCHAIN_REF_ROOT || '/opt/data/gitchain-ref';
const AUTH_DIR = path.join(ROOT, 'auth');
const ZUORDNUNGEN = path.join(AUTH_DIR, 'zuordnungen.json'); // nur Hashes!
const OFFENE_ZUSTELLUNGEN = new Map(); // zustellId → {emailHash, codeHash, expires} (im Speicher, 10 Min)

function init() { fs.mkdirSync(AUTH_DIR, { recursive: true }); if (!fs.existsSync(ZUORDNUNGEN)) fs.writeFileSync(ZUORDNUNGEN, '{}'); }
function zuordnungen() { return JSON.parse(fs.readFileSync(ZUORDNUNGEN, 'utf8')); }
function speichereZuordnung(h, eintrag) { const z = zuordnungen(); z[h] = eintrag; fs.writeFileSync(ZUORDNUNGEN, JSON.stringify(z, null, 2)); }

// ── Schritt 1: Anmeldung anfangen ─────────────────────────
async function authAnfang(email) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw new Error('keine gültige E-Mail-Adresse');
  const emailHash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const zustellId = crypto.randomBytes(12).toString('hex');
  const code = String(crypto.randomInt(100000, 999999));
  // Code nur hashen — im Speicher, nie auf Platte
  OFFENE_ZUSTELLUNGEN.set(zustellId, {
    emailHash,
    codeHash: crypto.createHash('sha256').update(code).digest('hex'),
    expires: Date.now() + 10 * 60 * 1000,
  });
  // Zustellung über das Interface (austauschbar, nie Code-Change):
  const erg = await zusteller.sendeCode(email, code);
  // Mock gibt den Code zurück (für Tests/CI); SMTP/QR würden ihn NUR zustellen:
  return { zustellId, kanal: erg.kanal, ...(erg.kanal === 'mock' ? { code, mock: true } : {}) };
}

// ── Schritt 2: Bestätigen → Container entsteht automatisch ──
async function authBestaetigen(zustellId, code, vaultApi) {
  const z = OFFENE_ZUSTELLUNGEN.get(zustellId);
  if (!z) throw new Error('Zustellung unbekannt oder abgelaufen');
  if (Date.now() > z.expires) { OFFENE_ZUSTELLUNGEN.delete(zustellId); throw new Error('Code abgelaufen (10 Min)'); }
  const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex');
  if (codeHash !== z.codeHash) throw new Error('Code falsch');
  OFFENE_ZUSTELLUNGEN.delete(zustellId);

  // Bereits registriert? → bestehenden Container referenzieren (Wiederschen)
  const alt = zuordnungen()[z.emailHash];
  if (alt) return { status: 'wiedergefunden', container: alt.container, hinweis: 'Dein Tresor wartet — Schlüssel prüfen (Sitzung/Recovery).' };

  // Neuer Nutzer → Container + Identität + Verschlüsselung
  const container = `brain-${z.emailHash.slice(0, 10)}`;
  await vaultApi.createFall(container);

  // did:key (Ed25519) — DIE Identität
  const { publicKey, secretKey } = crypto.generateKeyPairSync('ed25519');
  const did = 'did:key:z' + publicKey.export({ format: 'jwk' }).x.slice(0, 32); // kompakte Demo-Form

  // Recovery: 12 Worte — BIP-39-Stil: 128-bit-Entropie → 12 Worte (Demo-Form, nummeriert)
  const entropie = crypto.randomBytes(16);
  const hex = entropie.toString('hex'); // 32 Zeichen
  const woerte = [];
  for (let i = 0; i < 12; i++) woerte.push('wort' + (i + 1) + '-' + hex.slice(i * 2, i * 2 + 2));

  speichereZuordnung(z.emailHash, { container, did, erstellt: new Date().toISOString() });
  return {
    status: 'erstellt',
    container, did,
    recovery: { woerte, hinweis: 'Notar-Moment: einmalige Anzeige — sicher verwahren, dann bestätigen.' },
    verschluesselung: 'Vault-Key-Ableitung beim ersten Geräte-Login (Argon2id/scrypt aus Nutzer-Geheimnis)',
  };
}

// ── Sitzung: Challenge-Response (Variante B, sso-rechte-v0.1.md) ──
const HERAUSFORDERUNGEN = new Map(); // did → challenge (5 Min)
function sitzungAnfang(did) {
  const challenge = crypto.randomBytes(32).toString('hex');
  HERAUSFORDERUNGEN.set(did, { challenge, expires: Date.now() + 5 * 60 * 1000 });
  return { challenge };
}
function situngBestaetigen(did, signatur, pruefen) {
  const h = HERAUSFORDERUNGEN.get(did);
  if (!h || Date.now() > h.expires) throw new Error('Herausforderung abgelaufen');
  HERAUSFORDERUNGEN.delete(did);
  if (!pruefen(did, h.challenge, signatur)) throw new Error('Signatur ungültig — fail closed');
  return { sitzungsCapability: { did, expires: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), scope: 'voll' } };
}

module.exports = { init, authAnfang, authBestaetigen, sitzungAnfang, situngBestaetigen, ZUORDNUNGEN };
