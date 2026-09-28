# Prototype: tailor the user's own file in place

Proves the riskiest idea in Rezz: editing a user's own DOCX / PDF without losing their design.

## Run

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python make_samples.py   # writes samples/priya_resume.docx and .pdf
.venv/bin/python tailor.py         # writes out/priya_tailored.docx, .pdf, before.png, after.png
```

`make_samples.py` looks for Georgia in macOS system fonts; on other machines, point `find_font()` and `SERVER_FONTS` in `tailor.py` at a local TTF.

## What it does

`tailor.py` applies a fixed edit plan (what the AI planner would output): 5 rephrases, 1 user-approved added line (Kafka), 1 removal to keep the page length.

- **DOCX:** rewrites paragraphs run by run, keeping the paragraph style, bullet numbering, tab stops and bold spans. A new bullet is cloned from its neighbour. Never adds bold the original line didn't have. Estimates line counts to check the resume doesn't grow (no renderer here).
- **PDF:** finds each line, redacts it, and writes the new text in the same box and colour. Fonts are resolved in order: the PDF's embedded font (if usable) → the same family from a server font library → a metric-similar fallback. Adding/removing lines is skipped (needs reflow → look-alike rebuild path).

## Results (28 Sep 2026)

- DOCX: all 7 operations applied; styles, bullets and bold spans intact; estimated lines 18 → 18.
- PDF: all 5 swaps applied cleanly (see `out/before.png` and `out/after.png`).
- Finding: exported PDFs embed subset fonts with no Unicode map, so their own font can't be reused for new text. A server font library is required.

## Not covered yet

Real page counting for DOCX (LibreOffice headless), LaTeX, two-column layouts, text that doesn't fit its box (the code measures and holds, but doesn't yet ask the AI to shorten), and the look-alike rebuild for PDFs.
