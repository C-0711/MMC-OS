'use strict';
// lanes.js — Drei-Lane-Router (TEXT / OCR / VISION) für den W1a-Eingang.
// TEXT: echte PDF-Textextraktion via PyMuPDF (/tmp/pdfbench) als Child-Process.
// OCR:  Platzhalter — simuliert 15 ms/Dokument mit echtem setTimeout.
// VISION: Platzhalter für jpg/png/heic.
// Kein npm — nur Node-Stdlib.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const PY = '/tmp/pdfbench/bin/python';
const EXTRACT_SCRIPT = path.join(__dirname, 'extract_text.py');

const BILD_EXT = new Set(['.jpg', '.jpeg', '.png', '.heic']);

// Textschicht-Cache: Datei -> Promise<{pages, error}>
const textCache = new Map();

function extrahierePdfText(datei) {
  if (textCache.has(datei)) return textCache.get(datei);
  const p = new Promise((resolve) => {
    execFile(PY, [EXTRACT_SCRIPT, datei], { maxBuffer: 64 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return resolve({ pages: [], error: String(err) });
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          resolve({ pages: [], error: 'ungültiges JSON: ' + String(e) });
        }
      });
  });
  textCache.set(datei, p);
  return p;
}

// decideLane(datei) -> Promise<'text'|'ocr'|'vision'>
// vision: sofort per Dateiendung. PDF: Textschicht-Versuch —
// hat PyMuPDF Text, ist es TEXT; sonst Scan -> OCR.
async function decideLane(datei) {
  const ext = path.extname(datei).toLowerCase();
  if (BILD_EXT.has(ext)) return 'vision';
  if (ext !== '.pdf') return 'ocr';
  const erg = await extrahierePdfText(datei);
  const hatText = erg && !erg.error &&
    erg.pages.some((p) => (p.text || '').trim().length > 0);
  return hatText ? 'text' : 'ocr';
}

// --- Atom-Extraktion (TEXT-Lane): Regex über Geld, Datum, Absender ---
function atomeAusText(datei, pages) {
  const atome = [];
  const refBase = path.basename(datei);
  for (const { seite, text } of pages) {
    const t = text || '';
    if (!t.trim()) continue;

    // Absender-Zeilen ("Von:" / "Absender:")
    for (const m of t.matchAll(/^[ \t]*(?:Absender|Von):[ \t]*(.+)$/gm)) {
      atome.push({
        typ: 'absender',
        wert: m[1].trim(),
        text: m[0].trim(),
        datei: refBase,
        seite,
      });
    }
    // Geldbeträge mit Kontextwort (EUR / €)
    for (const m of t.matchAll(
      /(Rechnungsbetrag|Betrag|Kaution|Versicherungssumme|Selbstbehalt|Miete)\s*:?\s*([\d.,]+)\s*(?:EUR|€)/gi)) {
      const kontext = m[1].toLowerCase();
      const typ =
        kontext === 'kaution' || kontext === 'versicherungssumme' ||
        kontext === 'selbstbehalt' || kontext === 'miete'
          ? 'vertrag_geld'
          : 'rechnung_betrag';
      atome.push({ typ, wert: m[2], text: m[0].trim(), datei: refBase, seite });
    }
    // Daten TT.MM.JJJJ mit Kontextwort
    for (const m of t.matchAll(
      /(Fälligkeit|Laufzeit|Vertragslaufzeit|Zahlbar bis)\s*:?\s*(\d{2}\.\d{2}\.\d{4})/gi)) {
      const kontext = m[1].toLowerCase();
      const typ = kontext === 'fälligkeit' ? 'rechnung_faellig' : 'vertrag_laufzeit';
      atome.push({ typ, wert: m[2], text: m[0].trim(), datei: refBase, seite });
    }
  }
  return atome;
}

// processDoc(datei) -> {lane, ms, atome, fundstellen, seiten}
// OCR simuliert 15 ms/Dokument mit echtem setTimeout (Platzhalter für DocTR).
async function processDoc(datei) {
  const t0 = Date.now();
  const lane = await decideLane(datei);
  let atome = [];
  let seiten = 0;
  let fundstellen = 0;

  if (lane === 'text') {
    const erg = await extrahierePdfText(datei);
    seiten = erg.pages.length;
    atome = atomeAusText(datei, erg.pages);
    fundstellen = atome.length;
  } else if (lane === 'ocr') {
    // OCR-Lane-Platzhalter: 15 ms pro Dokument
    await new Promise((r) => setTimeout(r, 15));
    seiten = 1;
  } else {
    // VISION-Lane-Platzhalter: Bild erkannt, keine Atome
    seiten = 0;
  }
  return { lane, ms: Date.now() - t0, atome, fundstellen, seiten };
}

module.exports = { decideLane, processDoc, extrahierePdfText, atomeAusText };
