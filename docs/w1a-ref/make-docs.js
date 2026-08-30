'use strict';
// make-docs.js — erzeugt 50 Test-Dokumente nach /tmp/w1a-testdaten/:
// 45 Text-PDFs (echter Text via PyMuPDF im venv /tmp/pdfbench),
// 4 Scan-PDFs (leere Seite, keine Textschicht), 1 Bild (test.jpg, 1 Byte).
// Nur Node-Stdlib + das mitgelieferte make_docs.py.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PY = '/tmp/pdfbench/bin/python';
const SCRIPT = path.join(__dirname, 'make_docs.py');
const ZIEL = '/tmp/w1a-testdaten';

function generateDocs(ziel = ZIEL) {
  fs.rmSync(ziel, { recursive: true, force: true });
  const erg = spawnSync(PY, [SCRIPT, ziel], { encoding: 'utf8' });
  if (erg.status !== 0) {
    throw new Error('make_docs.py fehlgeschlagen: ' + (erg.stderr || erg.stdout));
  }
  return fs.readdirSync(ziel).sort();
}

module.exports = { generateDocs, ZIEL };

if (require.main === module) {
  const dateien = generateDocs();
  console.log(`OK ${dateien.length} Dokumente erzeugt in ${ZIEL}`);
}
