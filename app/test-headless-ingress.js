#!/usr/bin/env node
/**
 * test-headless-ingress.js — Headless Ingress-Lauf mit Stricker-Beleg
 *
 * Testet den kompletten Pfad:
 * 1. Temp-Vault
 * 2. createFall
 * 3. commitEingang (Commit vor Deutung!)
 * 4. deuteBeleg (OCR)
 * 5. deutungAusOcr (Heuristik)
 * 6. proposeDeutung
 * 7. mergeVorschlag
 * 8. fallErzaehlung
 *
 * Arithmetische Gegenprobe: KapSt 21,82 = 89,23/4,09 · Soli 1,20 · KiSt 1,96
 * Erwartete Beträge: 729,23 / 640,00 / 21,82 / 1,20 / 1,96
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Node-ESM-Module für vault, services, deutung
async function main() {
  // Temporäres Vault
  const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), 'mmc-test-headless-'));
  process.env.MMC_VAULT = tempVault;

  console.log(`Temp-Vault: ${tempVault}`);

  // Module importieren (ESM)
  const vault = await import('./dist/main/vault.js');
  const services = await import('./dist/main/services.js');
  const deutung = await import('./dist/main/deutung.js');

  try {
    // 1. Fall anlegen
    console.log('\n1. Fall anlegen...');
    const fall = await vault.createFall('stricker-2026');
    console.log(`   Fall erstellt: ${fall.id}`);

    // 2. Beleg laden
    const belegPfad = path.join(os.homedir(), 'Downloads/Stricker/WhatsApp Image 2026-07-28 at 11.07.28.jpeg');
    if (!fs.existsSync(belegPfad)) {
      throw new Error(`Beleg nicht gefunden: ${belegPfad}`);
    }
    const belegBytes = fs.readFileSync(belegPfad);

    // 3. Commit vor Deutung
    console.log('\n2. Eingang committen (Commit vor Deutung)...');
    const { sha: eingangSha, docPfad } = await vault.commitEingang(
      'stricker-2026',
      { absender: 'Stricker', kanal: 'whatsapp' },
      { name: 'WhatsApp Image 2026-07-28 at 11.07.28.jpeg', bytes: belegBytes }
    );
    console.log(`   Eingang committed: ${eingangSha.substring(0, 8)}`);

    // 4. OCR
    console.log('\n3. OCR (deuteBeleg)...');
    const ocr = await services.deuteBeleg({
      name: 'WhatsApp Image 2026-07-28 at 11.07.28.jpeg',
      bytes: belegBytes,
      mime: 'image/jpeg'
    });
    console.log(`   OCR: ${ocr.pages.length} Seiten, ${ocr.totalMs}ms`);
    console.log(`   Zeilen: ${ocr.pages[0].lines.length}`);

    // 5. Deutung aus OCR
    console.log('\n4. Deutung aus OCR (deutungAusOcr)...');
    const ergebnis = deutung.deutungAusOcr(ocr, 'WhatsApp Image 2026-07-28 at 11.07.28.jpeg');
    console.log(`   Atoms: ${ergebnis.atoms.length}`);
    console.log(`   Titel: ${ergebnis.kartentext.titel}`);
    console.log(`   Frage: ${ergebnis.kartentext.frage}`);
    console.log(`   Zweifel: ${ergebnis.zweifel}`);

    // Beträge ausgeben
    console.log('\n   Gefundene Beträge:');
    ergebnis.atoms.forEach((a, i) => {
      console.log(`     ${i + 1}. ${a.feld}: ${a.wert} (conf ${a.conf.toFixed(2)})`);
    });

    // 6. Vorschlag erstellen
    console.log('\n5. Vorschlag erstellen (proposeDeutung)...');
    const { branch, sha: deutungSha } = await vault.proposeDeutung(
      'stricker-2026',
      'deutung-stricker-1',
      ergebnis.atoms,
      ergebnis.kartentext
    );
    console.log(`   Branch: ${branch}`);
    console.log(`   SHA: ${deutungSha.substring(0, 8)}`);

    // 7. Vorschlag mergen
    console.log('\n6. Vorschlag mergen (mergeVorschlag)...');
    const { sha: mergeSha } = await vault.mergeVorschlag('stricker-2026', 'deutung-stricker-1');
    console.log(`   Merge-SHA: ${mergeSha.substring(0, 8)}`);

    // 8. Erzählung
    console.log('\n7. Fall-Erzählung (fallErzaehlung)...');
    const erzaehlung = await vault.fallErzaehlung('stricker-2026');
    console.log(`   Commits: ${erzaehlung.length}`);
    erzaehlung.forEach((satz, i) => {
      console.log(`   ${i + 1}. ${satz.satz}`);
      console.log(`      → ${satz.commitZeile}`);
    });

    // Arithmetische Gegenprobe
    console.log('\n8. Arithmetische Gegenprobe...');
    const betraege = ergebnis.atoms.map(a => parseFloat(a.wert.replace('.', '').replace(',', '.')));
    console.log(`   Beträge (numerisch): ${betraege.join(' / ')}`);

    // Erwartete Beträge: 729,23 / 640,00 / 21,82 / 1,20 / 1,96
    if (betraege.length === 5) {
      const kapital = betraege[0]; // 729,23
      const gezahlt = betraege[1]; // 640,00
      const kapst = betraege[2];   // 21,82
      const soli = betraege[3];    // 1,20
      const kist = betraege[4];    // 1,96

      // Gegenprobe: KapSt = (Kapital - Gezahlt) / (4 + Kirchensteuersatz/100)
      // Annahme: 9% Kirchensteuer (Trier, Ev. Kirche im Rheinland)
      const differenz = kapital - gezahlt; // 89,23
      const erwarteteKapSt = differenz / 4.09; // 21,82
      const erwarteteSoli = kapst * 0.055;     // 1,20
      const erwarteteKiSt = kapst * 0.09;      // 1,96

      console.log(`   Kapitalerträge: ${kapital.toFixed(2)}`);
      console.log(`   Gezahlte Beträge: ${gezahlt.toFixed(2)}`);
      console.log(`   Differenz: ${differenz.toFixed(2)}`);
      console.log(`   → KapSt erwartet: ${erwarteteKapSt.toFixed(2)}, gelesen: ${kapst.toFixed(2)} ` +
                  (Math.abs(erwarteteKapSt - kapst) < 0.01 ? '✓' : '✗'));
      console.log(`   → Soli erwartet: ${erwarteteSoli.toFixed(2)}, gelesen: ${soli.toFixed(2)} ` +
                  (Math.abs(erwarteteSoli - soli) < 0.01 ? '✓' : '✗'));
      console.log(`   → KiSt erwartet: ${erwarteteKiSt.toFixed(2)}, gelesen: ${kist.toFixed(2)} ` +
                  (Math.abs(erwarteteKiSt - kist) < 0.01 ? '✓' : '✗'));
    } else {
      console.log(`   WARNUNG: Erwartete 5 Beträge, fand ${betraege.length}`);
    }

    console.log('\n✓ Headless Ingress-Lauf erfolgreich');
  } catch (err) {
    console.error('\n✗ Fehler:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    // Aufräumen
    fs.rmSync(tempVault, { recursive: true, force: true });
    console.log(`\nTemp-Vault gelöscht: ${tempVault}`);
  }
}

main();
