"""Editing the user's own DOCX in place.

Lifted from prototypes/in-place-editing/tailor.py, which proved that styles,
bullet numbering, tab stops and bold spans survive a run-by-run rewrite. Two
things changed on the way in:

  - blocks are addressed by id, not by matching the start of their text. Text
    matching silently lands on the wrong bullet when two of them open the same
    way, and the prototype had exactly that failure mode.
  - the fit decision moved out to fitter.py, which can measure with a real
    renderer instead of estimating.
"""
import copy

import pymupdf
from docx import Document
from lxml import etree
from docx.shared import Emu
from docx.text.paragraph import Paragraph
from docx.text.run import Run as DocxRun  # distinct from the wire type below

from .headings import looks_like_caps_heading
from .models import Block, BlockKind, Run

W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def iter_runs(p):
    """Every run in the paragraph, including the ones inside hyperlinks.

    `p.runs` returns only direct `w:r` children, so a link's text is invisible
    to it. A real contact line — phone, then email, LinkedIn and GitHub as
    links — parses as "+91 90000 00000 | | |", losing three of the four facts
    on it.

    Reading `w:r` elements (rather than the element's whole string value) also
    skips field instruction text, which otherwise leaks bookmark ids into a
    heading as "Education137158272884".
    """
    for element in p._p.iter(f"{W_NS}r"):
        yield DocxRun(element, p)


def has_links(p) -> bool:
    return p._p.find(f"{W_NS}hyperlink") is not None


def para_text(p) -> str:
    return "".join(r.text for r in iter_runs(p))


def set_text_keep_format(p, new: str) -> None:
    """Replace a paragraph's text while keeping its own run formatting.

    `**word**` becomes bold using the formatting of the paragraph's existing bold
    run. If the paragraph had no bold run, the markers are stripped rather than
    honoured: introducing formatting the user's line didn't have is a product
    guardrail, not a style preference (docs/05-architecture.md).
    """
    runs = p.runs
    if not runs:
        p.add_run(new.replace("**", ""))
        return

    plain_rpr = None
    bold_rpr = None
    for r in runs:
        if r.bold and bold_rpr is None:
            bold_rpr = r._r.rPr
        if not r.bold and plain_rpr is None:
            plain_rpr = r._r.rPr

    for r in runs[1:]:
        r._r.getparent().remove(r._r)
    first = runs[0]

    if bold_rpr is None:
        new = new.replace("**", "")

    parts = new.split("**")
    first.text = ""
    template = first._r
    anchor = template
    for i, chunk in enumerate(parts):
        if not chunk:
            continue
        new_r = copy.deepcopy(template)
        for t in new_r.findall(f"{W_NS}t"):
            new_r.remove(t)
        run_rpr = bold_rpr if (i % 2 == 1) else plain_rpr
        old_rpr = new_r.find(f"{W_NS}rPr")
        if old_rpr is not None:
            new_r.remove(old_rpr)
        if run_rpr is not None:
            new_r.insert(0, copy.deepcopy(run_rpr))
        anchor.addnext(new_r)
        anchor = new_r
        run = DocxRun(new_r, p)
        run.text = chunk
        if i % 2 == 1 and bold_rpr is None:
            run.bold = True
    template.getparent().remove(template)


def estimate_lines(doc, text: str, p) -> int:
    """Cheap line count, used to pre-filter before paying for a real render.

    Metric stand-in only: Georgia runs ~8% wider than Times, hence the factor.
    render.py is what actually decides whether the page fits.
    """
    sec = doc.sections[0]
    width_pt = Emu(sec.page_width - sec.left_margin - sec.right_margin).pt
    indent = 18 if (p.style.name or "").startswith("List") else 0
    size = 10.5
    for r in p.runs:
        if r.font.size:
            size = r.font.size.pt
            break
    font = pymupdf.Font("tiro")
    words, lines, cur = text.replace("**", "").split(), 1, 0.0
    space = font.text_length(" ", fontsize=size) * 1.08
    for w in words:
        wl = font.text_length(w, fontsize=size) * 1.08
        if cur and cur + space + wl > width_pt - indent:
            lines, cur = lines + 1, wl
        else:
            cur = cur + (space if cur else 0) + wl
    return lines


_ALIGN = {0: "left", 1: "center", 2: "right", 3: "justify"}


def _align(p) -> str:
    """Paragraph alignment, inherited from the style when unset.

    A centred name and contact line is the commonest resume header there is,
    and rendering it flush left is immediately visible as "not my document".
    """
    value = p.paragraph_format.alignment
    if value is None and p.style is not None:
        value = p.style.paragraph_format.alignment
    return _ALIGN.get(int(value), "left") if value is not None else "left"


def _rule_below(p) -> bool:
    """A rule under the paragraph, drawn as a paragraph border.

    This is how most resumes underline a section heading. The sample this was
    first built against had none, so the preview drew none — and then drew
    them in the wrong place for documents that do.
    """
    pPr = p._p.find(f"{W_NS}pPr")
    if pPr is None:
        return False
    borders = pPr.find(f"{W_NS}pBdr")
    if borders is None:
        return False
    bottom = borders.find(f"{W_NS}bottom")
    return bottom is not None and bottom.get(f"{W_NS}val") not in (None, "none", "nil")


def _classify(index: int, text: str, style: str, p) -> BlockKind:
    if has_numbering(p) or style.startswith("List"):
        return BlockKind.BULLET
    if index == 0:
        return BlockKind.NAME
    if index == 1 and ("@" in text or "·" in text):
        return BlockKind.CONTACT
    if style.startswith("Heading") or looks_like_caps_heading(text):
        return BlockKind.HEADING
    # A role line carries a date range pushed to the right with a tab or a
    # right-aligned tab stop; that is what distinguishes it from a sentence.
    if "\t" in p.text or (len(text) < 90 and any(r.bold for r in p.runs) and "—" in text):
        return BlockKind.ROLE
    return BlockKind.PARAGRAPH


def _base_size(doc) -> float:
    """The document's body size.

    Not every resume has a `Normal` style carrying an explicit size — plenty
    set it once in docDefaults and inherit everywhere — so all three sources
    are tried before falling back to Word's own default.
    """
    try:
        size = doc.styles["Normal"].font.size
        if size:
            return size.pt
    except KeyError:
        pass

    default = doc.styles.element.find(
        f"{W_NS}docDefaults/{W_NS}rPrDefault/{W_NS}rPr/{W_NS}sz"
    )
    if default is not None:
        half_points = default.get(f"{W_NS}val")
        if half_points:
            return float(half_points) / 2
    return 11.0


def has_numbering(p) -> bool:
    """Is this paragraph a bullet or numbered item?

    Word says so in two places, and real resumes use both: inline `numPr` on
    the paragraph, or `numPr` on the style it inherits from. Matching on the
    style *name* — "List Bullet" and friends — catches neither when the
    document applies numbering directly to paragraphs styled `normal`, which
    is what Word does by default. Every bullet then renders as flat prose.
    """
    pPr = p._p.find(f"{W_NS}pPr")
    if pPr is not None and pPr.find(f"{W_NS}numPr") is not None:
        return True

    style = p.style
    seen = 0
    while style is not None and seen < 10:  # styles can chain; do not loop
        element = getattr(style, "element", None)
        if element is not None:
            style_pPr = element.find(f"{W_NS}pPr")
            if style_pPr is not None and style_pPr.find(f"{W_NS}numPr") is not None:
                return True
        style = style.base_style
        seen += 1
    return False


def _run_color(run) -> str | None:
    """Explicit RGB only. A theme colour raises or resolves to None, and
    guessing one would tint the preview a colour the document never had."""
    try:
        colour = run.font.color
        if colour is not None and colour.rgb is not None:
            return f"#{colour.rgb}"
    except (AttributeError, ValueError):
        pass
    return None


def _inherit(value, style_value, default=False):
    """Word tri-states these: True, False, or None meaning "ask the style"."""
    if value is not None:
        return value
    return bool(style_value) if style_value is not None else default


def _runs(p, base: float) -> tuple[list[Run], float]:
    """The paragraph's runs with formatting resolved, and its effective size."""
    style_font = p.style.font if p.style else None
    paragraph_size = base
    if style_font is not None and style_font.size:
        paragraph_size = style_font.size.pt

    runs: list[Run] = []
    for r in iter_runs(p):
        if not r.text:
            continue
        size = r.font.size.pt if r.font.size else None
        runs.append(
            Run(
                text=r.text,
                bold=_inherit(r.bold, style_font.bold if style_font else None),
                italic=_inherit(r.italic, style_font.italic if style_font else None),
                size=size,
                color=_run_color(r),
                small_caps=bool(r.font.small_caps),
                underline=bool(r.font.underline),
            )
        )

    # A line whose every run is larger than the body — a name, a heading — is
    # really a bigger paragraph, so the preview can space it accordingly.
    sizes = {r.size for r in runs if r.size}
    if len(sizes) == 1:
        paragraph_size = sizes.pop()

    return runs, paragraph_size


A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"

#: Everything this service parses arrives inside a file a stranger uploaded.
#: lxml resolves entities by default, so a crafted theme part could read local
#: files through a SYSTEM entity or exhaust memory by expanding nested ones.
#: None of that is needed to read a font name.
_SAFE_XML = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    load_dtd=False,
    dtd_validation=False,
    huge_tree=False,
)


def _theme_font(doc, reference: str | None) -> str | None:
    """Resolve `minorHAnsi` / `majorHAnsi` to the family the theme names."""
    if not reference:
        return None
    slot = "majorFont" if reference.startswith("major") else "minorFont"
    try:
        theme = doc.part.package.part_related_by(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
        )
    except (KeyError, AttributeError):
        # Themes live off the main document part in some packages.
        theme = next(
            (p for p in doc.part.package.iter_parts() if p.partname.endswith("theme1.xml")),
            None,
        )
    if theme is None:
        return None
    try:
        root = etree.fromstring(theme.blob, parser=_SAFE_XML)
    except etree.XMLSyntaxError:
        return None
    latin = root.find(f".//{A_NS}fontScheme/{A_NS}{slot}/{A_NS}latin")
    return latin.get("typeface") if latin is not None else None


def _fonts(doc) -> list[str]:
    seen: list[str] = []
    try:
        base = doc.styles["Normal"].font.name
    except KeyError:
        base = None
    if not base:
        default = doc.styles.element.find(
            f"{W_NS}docDefaults/{W_NS}rPrDefault/{W_NS}rPr/{W_NS}rFonts"
        )
        if default is not None:
            # A document usually names its font indirectly, through the theme,
            # and only sometimes spells it out. Reading just `w:ascii` reports
            # no font at all for the common case.
            base = default.get(f"{W_NS}ascii") or _theme_font(
                doc, default.get(f"{W_NS}asciiTheme")
            )
    if base:
        seen.append(base)
    for p in doc.paragraphs:
        for r in iter_runs(p):
            if r.font.name and r.font.name not in seen:
                seen.append(r.font.name)
    return seen


def parse_docx(path: str) -> tuple[list[Block], list[str], list[str]]:
    """Return (blocks, fonts, warnings). Page count is added by the caller,
    which owns the renderer."""
    doc = Document(path)
    blocks: list[Block] = []
    warnings: list[str] = []
    section: str | None = None

    base = _base_size(doc)
    for i, p in enumerate(doc.paragraphs):
        text = para_text(p).strip()
        if not text:
            continue
        style = p.style.name or ""
        kind = _classify(i, text, style, p)
        if kind is BlockKind.HEADING:
            section = text
        runs, size = _runs(p, base)
        space_before = p.paragraph_format.space_before
        blocks.append(
            Block(
                id=f"b{i}",
                kind=kind,
                text=text,
                section=None if kind is BlockKind.HEADING else section,
                style=style,
                lines=estimate_lines(doc, text, p),
                has_bold=any(r.bold for r in runs),
                has_link=has_links(p),
                runs=runs,
                size=size,
                space_before=space_before.pt if space_before else 0.0,
                align=_align(p),
                rule_below=_rule_below(p),
            )
        )

    if doc.tables:
        warnings.append(
            f"{len(doc.tables)} table(s) found. Text inside tables is not edited yet, "
            "and a two-column layout built from tables will not reflow."
        )
    for p in doc.paragraphs:
        for r in iter_runs(p):
            if r.font.color and r.font.color.rgb is not None and str(r.font.color.rgb) == "FFFFFF":
                warnings.append("White text found — some resumes hide keywords this way. Left as is.")
                break
        else:
            continue
        break

    return blocks, _fonts(doc), warnings


def _paragraph_by_id(doc, block_id: str):
    """Blocks are `b<paragraph index>`; apply always starts from the pristine
    original, so the index the parse handed out still points at the same line."""
    try:
        index = int(block_id.removeprefix("b"))
    except ValueError:
        return None
    paragraphs = doc.paragraphs
    if 0 <= index < len(paragraphs):
        return paragraphs[index]
    return None


def resolve_blocks(doc, ops) -> dict[str, object]:
    """Map every op's block id to its paragraph, before anything is mutated.

    This has to happen up front. Ids are paragraph indices, and the first
    `insert_after` shifts every index after it — so looking ids up lazily would
    send the second edit to the wrong line. Paragraph objects wrap lxml
    elements, which stay valid when siblings are inserted around them.
    """
    return {op.block: _paragraph_by_id(doc, op.block) for op in ops}


def apply_op(doc, op, target) -> tuple[str, str | None]:
    """Apply one operation to an already-resolved paragraph. Returns (status, detail)."""
    if target is None:
        return "not_found", f"no block {op.block}"

    if op.op == "rephrase":
        set_text_keep_format(target, op.text or "")
        return "applied", None

    if op.op == "insert_after":
        # Cloning the neighbour is what carries the style, the bullet numbering
        # and the tab stops onto the new line.
        clone = copy.deepcopy(target._p)
        target._p.addnext(clone)
        set_text_keep_format(Paragraph(clone, target._parent), op.text or "")
        return "applied", None

    if op.op == "remove":
        target._p.getparent().remove(target._p)
        return "applied", op.reason

    return "not_found", f"unknown op {op.op}"
