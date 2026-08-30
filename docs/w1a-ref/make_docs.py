#!/usr/bin/env python3
"""Erzeugt die W1a-Testdaten in /tmp/w1a-testdaten:
45 Text-PDFs (Rechnungen, Mietverträge, Versicherung), 4 Scan-PDFs
(leere Seite, keine Textschicht), 1 Bild (test.jpg, 1 Byte).
Aufruf: make_docs.py <zielpfad>
Läuft mit dem venv /tmp/pdfbench (pymupdf).
"""
import sys, os, random
import pymupdf

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/w1a-testdaten"
os.makedirs(OUT, exist_ok=True)

random.seed(42)

def new_doc():
    return pymupdf.open()

def add_page(doc, lines):
    page = doc.new_page()  # A4 default
    y = 72
    for line in lines:
        page.insert_text((72, y), line, fontsize=11, fontname="helv")
        y += 20
    return doc

def rechnung_lines(n):
    return [
        "Absender: Stadtwerke Musterstadt GmbH",
        "Von: Rechnungsstelle Stadtwerke",
        f"Rechnung Nr. SW-2026-{n:03d}",
        f"Kundennummer: {1000 + n}",
        "Rechnungsbetrag: 89,50 EUR",
        "Betrag: 89,50 EUR",
        "Fälligkeit: 15.09.2026",
        "Zahlbar bis: 15.09.2026",
        "Bei Fragen erreichen Sie uns unter service@stadtwerke-musterstadt.de",
    ]

def mietvertrag_lines(n):
    base = [
        "Absender: Hausverwaltung Sonnenhof",
        "Mietvertrag",
        "zwischen M. Mustermann (Mieter)",
        "und Hausverwaltung Sonnenhof (Vermieter)",
        "Kaution: 3 Monatsmieten",
        "Miete: 980,00 EUR monatlich",
        "Laufzeit: bis 31.12.2029",
    ]
    extra = [
        "Weitere Vereinbarungen zum Betriebskostenanteil und",
        "zur Instandhaltung werden hiermit ergänzt.",
    ]
    return base, extra

def versicherung_lines(n):
    base = [
        "Absender: Versicherung Nordlicht AG",
        "Versicherungsvertrag Hausrat",
        "Versicherungssumme: 15.000 EUR",
        "Selbstbehalt: 500 EUR",
        "Vertragslaufzeit: 01.01.2027 bis 31.12.2029",
    ]
    extra = [
        "Der Versicherungsschutz umfasst Feuer, Leitungswasser,",
        "Einbruchdiebstahl und weitere Ziffern der Bedingungen.",
    ]
    return base, extra

docs = []
for i in range(1, 46):
    if i <= 20:
        typ = "rechnung"
    elif i <= 35:
        typ = "mietvertrag"
    else:
        typ = "versicherung"
    doc = new_doc()
    if typ == "rechnung":
        pages = random.choice([1, 1, 2])
        for p in range(pages):
            add_page(doc, rechnung_lines(i) if p == 0 else
                     ["Stadtwerke Musterstadt GmbH", "Rechnung Seite 2",
                      "Abschlag und Verbrauchsdaten siehe Anlage."])
    elif typ == "mietvertrag":
        base, extra = mietvertrag_lines(i)
        pages = random.choice([2, 2, 3])
        add_page(doc, base)
        add_page(doc, extra + ["Absender: Hausverwaltung Sonnenhof"])
        if pages == 3:
            add_page(doc, ["Anlage: Hausordnung und Nebenbestimmungen."])
    else:
        base, extra = versicherung_lines(i)
        pages = random.choice([1, 2, 3])
        add_page(doc, base)
        for p in range(1, pages):
            add_page(doc, extra + ["Absender: Versicherung Nordlicht AG"])
    doc.save(os.path.join(OUT, f"{typ}-{i:02d}.pdf"))
    doc.close()
    docs.append(f"{typ}-{i:02d}.pdf")

# 4 Scan-Platzhalter: PDF ohne Textschicht (nur leere Seite)
for i in range(1, 5):
    doc = new_doc()
    doc.new_page()  # leere Seite, kein insert_text -> keine Textschicht
    doc.save(os.path.join(OUT, f"scan-{i:02d}.pdf"))
    doc.close()
    docs.append(f"scan-{i:02d}.pdf")

# 1 Bild als 1-Byte-Datei
with open(os.path.join(OUT, "test.jpg"), "wb") as f:
    f.write(b"\xff")
docs.append("test.jpg")

print(f"OK {len(docs)} Dokumente erzeugt in {OUT}")
