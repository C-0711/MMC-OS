#!/usr/bin/env python3
"""Extrahiert die Textschicht eines PDFs Seite für Seite (PyMuPDF).
Aufruf: extract_text.py <datei.pdf>
Ausgabe: JSON {"pages":[{"seite":1,"text":"..."}],"error":null}
Läuft mit dem venv /tmp/pdfbench (pymupdf).
"""
import sys, json

try:
    import pymupdf
except Exception as e:
    print(json.dumps({"pages": [], "error": f"pymupdf import: {e}"}))
    sys.exit(0)

path = sys.argv[1]
out = {"pages": [], "error": None}
try:
    doc = pymupdf.open(path)
    for i, page in enumerate(doc):
        out["pages"].append({"seite": i + 1, "text": page.get_text("text")})
    doc.close()
except Exception as e:
    out["error"] = str(e)
print(json.dumps(out, ensure_ascii=False))
