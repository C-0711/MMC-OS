/**
 * gitchain-ref — Zusteller-Interface (identitaet-email-container-v0.1.md §5)
 *
 * Der Zusteller ist ein austauschbares Modul am Systemrand:
 *   MockZustaeller   → Code in Konsole/Response (CI, Tests, Container)
 *   SmtpZustaeller   → SMTP-Relay oder eigener Postfix (Produktion, euer K8s)
 *   QrZustaeller     → ganz ohne E-Mail (Einladung über zweites Gerät)
 *
 * Die App kennt NUR das Interface — kein Anbieter-Code im Auth-Pfad.
 * Umstellung Mock→SMTP = Umgebungsvariable, kein Code-Change.
 */
'use strict';

// ── Das Interface ───────────────────────────────────────────
/** interface Zustaeller { sendeCode(email, code) → {kanal, ziel} } */

// ── Mock: Code in Konsole (und bei AUTH_MOCK=1 in die Response) ──
class MockZustaeller {
  async sendeCode(email, code) {
    console.log(`[zusteller:mock] Code ${code} für ${email.replace(/(.{2}).*(@.*)/, '$1***$2')} — nur Konsole, nie Klartext-E-Mail in Logs`);
    return { kanal: 'mock', ziel: 'konsole' };
  }
}

// ── SMTP: Produktion (LÄUFT HIER NICHT — lauffähig vorbereitet) ──
/**
 * SmtpZustaeller — für euren K8s/euren Server. Dort:
 *   1. npm install nodemailer   (oder äquivalent)
 *   2. env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *   3. VON_MIR_NICHT_TESTBAR: DNS muß stehen (SPF/DKIM/DMARC — siehe SMTP-SETUP.md)
 *
 * class SmtpZustaeller {
 *   constructor() {
 *     this.transport = nodemailer.createTransport({
 *       host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
 *       secure: Number(process.env.SMTP_PORT) === 465,
 *       auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
 *     });
 *   }
 *   async sendeCode(email, code) {
 *     await this.transport.sendMail({
 *       from: process.env.SMTP_FROM,            // z. B. "gitchain <auth@gitchain.de>"
 *       to: email,
 *       subject: 'Dein Code',                   // kein Codewort im Betreff (Spy-Filter!)
 *       text: `Dein Code: ${code}\nEr gilt 10 Minuten.\nWenn du das nicht warst: ignorieren.`,
 *       // Regeln aus der Spec (identitaet-email-container):
 *       // - nur der Code, keine Links mit Token (Phishing-Fläche minimal)
 *       // - Absender-Domain MUSS die DKIM-Domain sein (Vertrauen)
 *     });
 *     return { kanal: 'smtp', ziel: 'mail' };
 *   }
 * }
 */

// ── QR/Einladung: ganz ohne E-Mail (Premium-Weg) ──
class QrZustaeller {
  async sendeCode(email, code) {
    // Kein Versand: die Einladung passiert über ein bestehendes Gerät
    // (Capability + Klon-Übergabe, recovery-v0.1.md F1). Hier nur als Platzhalter,
    // der zeigt: dieses Interface braucht SMTP gar nicht zwingend.
    return { kanal: 'qr-einladung', ziel: 'zweites-geraet', hinweis: 'Code entfällt — Einladung über bestehenden Tresor' };
  }
}

// ── Auswahl (env-gesteuert, nie Code-Change) ──
function zustellerErstellen() {
  const art = (process.env.GITCHAIN_ZUSTELLER || 'mock').toLowerCase();
  if (art === 'smtp') {
    // Aktiviert nur in eurer Umgebung (SMTP_HOST etc. gesetzt). Hier im Container
    // läuft er nie — die Klasse ist dokumentiert oben, Einbindung via nodemailer.
    throw new Error('SmtpZustaeller hier nicht lauffähig (kein Mailserver im Referenz-Container) — siehe SMTP-SETUP.md. GITHUB_ACTIONS/CI: GITCHAIN_ZUSTELLER=mock setzen.');
  }
  if (art === 'qr') return new QrZustaeller();
  return new MockZustaeller();
}

module.exports = { zustellerErstellen, MockZustaeller, QrZustaeller };
