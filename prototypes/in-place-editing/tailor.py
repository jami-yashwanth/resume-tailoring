"""Proof of concept: tailor a user's OWN resume file in place, keeping its design.

DOCX: rewrite paragraphs run-by-run (keeps style, numbering, bold spans), clone a
neighbouring bullet to add a line, and estimate line count so the page never grows.
PDF: swap a line in the same box using the PDF's own embedded font, check every new
glyph exists in the subset font, and measure overflow before writing.
"""
import copy
import os
import sys
import pymupdf
from docx import Document
from docx.shared import Emu

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(HERE, "samples")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

# The plan the AI would produce: every edit is an operation on an existing line.
PLAN = [
    {"op": "rephrase", "find": "Software engineer interested in backend development.",
     "new": "Backend engineer with 3 years building payment and ledger services in **Java** and **Spring Boot** on AWS."},
    {"op": "rephrase", "find": "Worked on backend APIs for payments.",
     "new": "Cut payment API p95 latency from 820 ms to 310 ms using async **Spring Boot** workers on AWS ECS.",
     "shorter": ["Cut payment API p95 latency from 820 ms to 310 ms with async Spring Boot workers."]},
    {"op": "rephrase", "find": "Helped refactor the refunds module.",
     "new": "Split the refunds module into 4 microservices, each deployed on its own."},
    {"op": "add_after", "find": "Split the refunds module", "user_approved": True,
     "new": "Consumed payment events from Kafka topics to update the ledger."},
    {"op": "remove", "find": "Moved nightly batch jobs", "reason": "least relevant; makes room for the added line"},
    {"op": "rephrase", "find": "Wrote unit tests.",
     "new": "Added JUnit and Testcontainers integration tests to the loyalty-points service."},
    {"op": "rephrase", "find": "Python, Git, Docker, Java, Spring Boot, AWS, PostgreSQL, Redis",
     "new": "Java, Spring Boot, AWS (ECS, SQS, RDS), microservices, PostgreSQL, Redis, Docker, Git, Python"},
]

# ---------------------------------------------------------------- DOCX

def para_text(p):
    return "".join(r.text for r in p.runs)


def set_text_keep_format(p, new):
    """Replace paragraph text, keeping the paragraph's own run formatting.
    **word** in `new` becomes bold using the formatting of the paragraph's bold run
    (or the plain run made bold if the original had none)."""
    runs = p.runs
    plain_rpr = None
    bold_rpr = None
    for r in runs:
        rpr = r._r.rPr
        if r.bold and bold_rpr is None:
            bold_rpr = rpr
        if not r.bold and plain_rpr is None:
            plain_rpr = rpr
    for r in runs[1:]:
        r._r.getparent().remove(r._r)
    first = runs[0]
    if bold_rpr is None:  # never introduce bold the user's own line didn't have
        new = new.replace("**", "")
    parts = new.split("**")
    first.text = ""
    template = first._r
    # rebuild as a sequence of runs cloned from the first run
    anchor = template
    for i, chunk in enumerate(parts):
        if not chunk:
            continue
        new_r = copy.deepcopy(template)
        for t in new_r.findall('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
            new_r.remove(t)
        run_rpr = bold_rpr if (i % 2 == 1) else plain_rpr
        old_rpr = new_r.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr')
        if old_rpr is not None:
            new_r.remove(old_rpr)
        if run_rpr is not None:
            new_r.insert(0, copy.deepcopy(run_rpr))
        anchor.addnext(new_r)
        anchor = new_r
        from docx.text.run import Run
        run = Run(new_r, p)
        run.text = chunk
        if i % 2 == 1 and bold_rpr is None:
            run.bold = True
    template.getparent().remove(template)


def estimate_lines(doc, text, p):
    """Rough line count: measure with a metric-similar font against the text width.
    A production build renders with LibreOffice instead; this is the fallback estimate."""
    sec = doc.sections[0]
    width_pt = Emu(sec.page_width - sec.left_margin - sec.right_margin).pt
    indent = 18 if p.style.name.startswith("List") else 0
    size = 10.5
    for r in p.runs:
        if r.font.size:
            size = r.font.size.pt
            break
    font = pymupdf.Font("tiro")  # Times-like metrics as a stand-in for Georgia
    words, lines, cur = text.replace("**", "").split(), 1, 0.0
    space = font.text_length(" ", fontsize=size) * 1.08
    for w in words:
        wl = font.text_length(w, fontsize=size) * 1.08  # Georgia runs ~8% wider than Times
        if cur and cur + space + wl > width_pt - indent:
            lines, cur = lines + 1, wl
        else:
            cur = cur + (space if cur else 0) + wl
    return lines


def tailor_docx(src, dst):
    doc = Document(src)
    report = []
    before = sum(estimate_lines(doc, para_text(p), p) for p in doc.paragraphs if para_text(p))
    for step in PLAN:
        target = next((p for p in doc.paragraphs if para_text(p).startswith(step["find"])), None)
        if target is None:
            report.append(f"SKIP  {step['op']}: '{step['find'][:40]}' not found")
            continue
        if step["op"] == "rephrase":
            old_n = estimate_lines(doc, para_text(target), target)
            new = step["new"]
            new_n = estimate_lines(doc, new, target)
            for alt in step.get("shorter", []):  # fit rule: a rewrite may not add a line
                if new_n <= max(old_n, 1) + 0:
                    break
                new, new_n = alt, estimate_lines(doc, alt, target)
            set_text_keep_format(target, new)
            report.append(f"OK    rephrase ({old_n}->{new_n} lines): {new.replace('**', '')[:60]}")
        elif step["op"] == "add_after":
            if not step.get("user_approved"):
                report.append("HOLD  add_after waits for the user's Add it")
                continue
            clone = copy.deepcopy(target._p)  # same style, same bullet numbering
            target._p.addnext(clone)
            from docx.text.paragraph import Paragraph
            newp = Paragraph(clone, target._parent)
            set_text_keep_format(newp, step["new"])
            report.append(f"OK    add (+{estimate_lines(doc, step['new'], newp)} lines, user approved): {step['new'][:60]}")
        elif step["op"] == "remove":
            n = estimate_lines(doc, para_text(target), target)
            target._p.getparent().remove(target._p)
            report.append(f"OK    remove (-{n} lines, {step['reason']}): {step['find']}")
    after = sum(estimate_lines(doc, para_text(p), p) for p in doc.paragraphs if para_text(p))
    doc.save(dst)
    report.append(f"FIT   estimated text lines {before} -> {after} ({'fits' if after <= before + 1 else 'OVERFLOW RISK'})")
    return report

# ---------------------------------------------------------------- PDF

def line_block(page, needle):
    """Return (rect, font_xref_name, size, color) of the text line that starts with needle."""
    d = page.get_text("dict")
    for b in d["blocks"]:
        for ln in b.get("lines", []):
            txt = "".join(s["text"] for s in ln["spans"])
            if txt.strip().startswith(needle):
                s = ln["spans"][0]
                return pymupdf.Rect(ln["bbox"]), s["font"], s["size"], s["color"]
    return None


def embedded_font(doc, page, fontname):
    for xref, ext, ftype, basefont, name, enc, *_ in page.get_fonts(full=True):
        if fontname in basefont:
            _, _, _, buf = doc.extract_font(xref)
            return buf
    return None


SERVER_FONTS = {  # fonts the server has as full files (Google Fonts + metric-compatible stand-ins)
    "Georgia Regular": "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "Georgia Bold": "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
}


def resolve_font(doc, page, fontname, text):
    """1) the PDF's own embedded font, if it has a Unicode map and every glyph;
    2) the server's full copy of the same family; 3) a metric-similar fallback."""
    buf = embedded_font(doc, page, fontname)
    if buf:
        f = pymupdf.Font(fontbuffer=buf)
        if all(f.has_glyph(ord(c)) for c in text if c.strip()):
            return f, "its own embedded font"
    for family, path in SERVER_FONTS.items():
        if family in fontname and os.path.exists(path):
            return pymupdf.Font(fontfile=path), f"same family from the font library ({family}); the file's copy is a subset"
    return pymupdf.Font("tiro"), "a metric-similar fallback (family not in the font library)"


def tailor_pdf(src, dst):
    doc = pymupdf.open(src)
    page = doc[0]
    report = []
    fallback = pymupdf.Font("tiro")
    for step in PLAN:
        if step["op"] != "rephrase":
            report.append(f"SKIP  {step['op']}: PDF mode only swaps lines in place (adding/removing needs reflow -> look-alike rebuild)")
            continue
        found = line_block(page, step["find"])
        if not found:
            report.append(f"SKIP  '{step['find'][:40]}' not found")
            continue
        rect, fname, size, color = found
        new = step["new"].replace("**", "")
        use_font, note = resolve_font(doc, page, fname, new)
        box = pymupdf.Rect(rect.x0, rect.y0, page.rect.width - 56, rect.y1 + 0.5)
        width = box.width
        candidates = [new] + step.get("shorter", [])
        chosen = None
        for c in candidates:
            if use_font.text_length(c, fontsize=size) <= width:
                chosen = c
                break
        if chosen is None:
            report.append(f"HOLD  '{new[:40]}…' needs {use_font.text_length(new, fontsize=size):.0f}pt, box is {width:.0f}pt -> ask AI for a shorter wording")
            continue
        page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE)
        rgb = tuple(((color >> k) & 255) / 255 for k in (16, 8, 0))
        tw = pymupdf.TextWriter(page.rect, color=rgb)
        tw.append((rect.x0, rect.y1 - size * 0.22), chosen, font=use_font, fontsize=size)
        tw.write_text(page)
        report.append(f"OK    swapped in place with {note}: {chosen[:60]}")
    doc.save(dst, garbage=3, deflate=True)
    return report


if __name__ == "__main__":
    print("== DOCX ==")
    for r in tailor_docx(os.path.join(SAMPLES, "priya_resume.docx"), os.path.join(OUT, "priya_tailored.docx")):
        print(r)
    print("\n== PDF ==")
    for r in tailor_pdf(os.path.join(SAMPLES, "priya_resume.pdf"), os.path.join(OUT, "priya_tailored.pdf")):
        print(r)
    for name in ["priya_resume.pdf"]:
        pymupdf.open(os.path.join(SAMPLES, name))[0].get_pixmap(dpi=80).save(os.path.join(OUT, "before.png"))
    pymupdf.open(os.path.join(OUT, "priya_tailored.pdf"))[0].get_pixmap(dpi=80).save(os.path.join(OUT, "after.png"))
    print("\nwrote", OUT)
