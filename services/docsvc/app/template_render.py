"""The one default Rezz template — rendered from scratch, not edited in place.

v1 override (28 Sep 2026, see `CLAUDE.md`): every download goes through here
instead of `/apply` + `/export`, which edit the user's own file. Those stay in
this service for when in-place editing is revisited; this module only needs
the final (kind, text) pairs the web app has already resolved from the plan
and the user's Add it / Skip decisions — no original file, no fonts to
recover, no page-fit loop against someone else's layout.

Built with PyMuPDF's own drawing primitives (already a dependency, used
elsewhere in this service for page-count estimation) rather than adding an
HTML-to-PDF step: a resume's shapes — a name, a couple of section rules, a
role line with dates pushed right, bulleted lines — are simple enough to lay
out by hand, and it keeps this service's only external dependency the same
one it already has.

Every number below comes from `shared/template.json`, which the web app's
`src/lib/tailor/template-metrics.ts` reads too. Change the template there, not
here: the preview and the file are one spec, and they used to drift because
each kept its own copy.
"""
import json
import re
from pathlib import Path

import pymupdf

#: Four levels up from `services/docsvc/app/template_render.py` is the repo root.
_SPEC = json.loads((Path(__file__).resolve().parents[3] / "shared" / "template.json").read_text())

TYPE: dict[str, dict] = _SPEC["type"]

PAGE_WIDTH, PAGE_HEIGHT = _SPEC["page"]["width"], _SPEC["page"]["height"]  # A4, points
MARGIN = float(_SPEC["page"]["margin"])
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
#: What an empty page holds, and how far a bullet's text sits off the margin.
ROOM = PAGE_HEIGHT - 2 * MARGIN
BULLET_INDENT = TYPE["bullet"]["indent"]
RULE_WIDTH = _SPEC["rule"]["width"]


def _rgb(value: str) -> tuple[float, float, float]:
    """`#rrggbb` as the 0-1 triple PyMuPDF wants."""
    h = value.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


INK = _rgb(_SPEC["color"]["ink"])
MUTED = _rgb(_SPEC["color"]["muted"])
RULE = _rgb(_SPEC["color"]["rule"])

SANS = "helv"
SANS_BOLD = "hebo"
SANS_ITALIC = "heit"

BULLET_CHARS = "•◦▪‣·-*"

# PyMuPDF's base-14 fonts (no embedded font file) only cover a narrow glyph
# set — a "smart" quote, an en/em dash, an ellipsis or a bullet character
# outside that set doesn't error, it silently draws as "·" instead. That
# read as data loss ("product's" -> "product·s") when it was really a font
# limitation, so every character drawn goes through this first.
_SANITIZE = {
    "‘": "'", "’": "'", "‚": "'", "′": "'",
    "“": '"', "”": '"', "„": '"', "″": '"',
    "–": "-", "—": "-", "−": "-",
    "…": "...",
    "•": "-", "●": "-", "▪": "-", "‣": "-", "·": "-",
}


def _sanitize(text: str) -> str:
    return "".join(_SANITIZE.get(ch, ch) for ch in text)


def _wrap(text: str, size: float, fontname: str, width: float) -> list[str]:
    """Greedy word wrap using the font's own metrics, the same approach
    `docx_ops.estimate_lines` uses to size a rewritten line before it is
    drawn — here it decides where the line actually breaks."""
    font = pymupdf.Font(fontname)
    words = _sanitize(text).split()
    if not words:
        return [""]
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or font.text_length(candidate, fontsize=size) <= width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


class _Writer:
    """Owns the running y-cursor and starts a new page when a line won't fit."""

    def __init__(self, doc: "pymupdf.Document"):
        self.doc = doc
        self.pages = 1
        self.page = doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        self.y = MARGIN

    def _fits(self, needed: float) -> bool:
        return self.y + needed <= PAGE_HEIGHT - MARGIN

    def _break(self) -> None:
        self.page = self.doc.new_page(width=PAGE_WIDTH, height=PAGE_HEIGHT)
        self.y = MARGIN
        self.pages += 1

    def _ensure(self, needed: float) -> None:
        """Move to a new page if `needed` does not fit in what is left.

        `needed` is a whole block, not a line: a bullet broken across the fold
        reads as a typesetting failure on a document whose pitch is that its
        layout survived, and the Result screen's preview paginates against
        this same rule so the two agree on where the file breaks.

        A block taller than an empty page is the exception — no page would
        hold it, so paging cannot keep it whole, and it stays where it is and
        flows. Refusing to draw it would lose the user's text, and paging for
        it would only buy a blank page first.
        """
        if not self._fits(needed) and needed <= ROOM:
            self._break()

    def text(self, x: float, text: str, size: float, fontname: str, color=INK) -> None:
        self.page.insert_text(
            (x, self.y + size), _sanitize(text), fontsize=size, fontname=fontname, color=color
        )

    def centered(self, text: str, size: float, fontname: str, color=INK) -> None:
        """One line centered on the page's midline — the reference template's
        header block. Centering happens per drawn line, so a wrapped contact
        line centers each of its lines like LaTeX's {center} does."""
        font = pymupdf.Font(fontname)
        x = MARGIN + max(0.0, (CONTENT_WIDTH - font.text_length(_sanitize(text), fontsize=size)) / 2)
        self.text(x, text, size, fontname, color)

    def line(self, leading: float) -> None:
        self.y += leading

    def rule(self) -> None:
        self.page.draw_line(
            (MARGIN, self.y), (PAGE_WIDTH - MARGIN, self.y), color=RULE, width=RULE_WIDTH
        )

    def spread(self, left: str, right: str, size: float, fontname: str, color=INK) -> bool:
        """One line with `left` at the margin and `right` pushed to the right one.

        Returns False without drawing when the two do not fit on one line —
        `insert_text` does not wrap, it draws off the edge of the page, and a
        role line long enough to do that lost its dates completely. The caller
        wraps instead.

        Drawn as a SINGLE text run padded with spaces, not as two runs at two x
        positions. Two runs is the obvious way and it is the one thing every
        resume-parsing guide warns about: a PDF's content stream carries no
        whitespace between separately-positioned runs, so an extractor has to
        infer the gap. Some insert a space, some glue the two together
        ("InncirclesJun 2023"), and some drop the detached run entirely — which
        loses the dates the parser needs to work out how long the job lasted.
        Padding with real spaces puts the separator in the stream, where every
        extractor can see it.

        The cost is up to half a space of right-edge raggedness — 1.46pt at
        10.5pt Helvetica, 0.3% of the measure, against a date column nobody
        measures with a ruler.
        """
        font = pymupdf.Font(fontname)
        space = font.text_length(" ", fontsize=size)
        gap = CONTENT_WIDTH - font.text_length(left, fontsize=size) - font.text_length(
            right, fontsize=size
        )
        if not space or gap < space:
            return False
        self.text(MARGIN, f"{left}{' ' * round(gap / space)}{right}", size, fontname, color)
        return True

    def bullet_dot(self, x: float, size: float, color=INK) -> None:
        """A drawn dot, not a bullet glyph — base-14 fonts render "•" as a
        substitute character too, same problem `_sanitize` solves for text."""
        radius = size * 0.09
        center = (x + radius, self.y + size * 0.62)
        self.page.draw_circle(center, radius, color=color, fill=color)

    def wrapped(
        self,
        text: str,
        size: float,
        fontname: str,
        width: float,
        color,
        leading_extra=0.0,
        indent=0.0,
        bullet=False,
        center=False,
    ):
        leading = size * 1.4 + leading_extra
        lines = _wrap(text, size, fontname, width)
        # Ask for the whole block first, so it moves in one piece. The per-line
        # check below only ever fires for a block too tall for any page, which
        # `_ensure` deliberately leaves where it is.
        self._ensure(leading * len(lines))
        for i, wrapped_line in enumerate(lines):
            if not self._fits(leading):
                self._break()
            if bullet and i == 0:
                self.bullet_dot(MARGIN, size, color)
            if center:
                self.centered(wrapped_line, size, fontname, color)
            else:
                self.text(MARGIN + indent, wrapped_line, size, fontname, color)
            self.line(leading)

    def space(self, amount: float) -> None:
        self.y += amount


def render_template(blocks: list[dict]) -> tuple[bytes, int]:
    doc = pymupdf.open()
    w = _Writer(doc)

    for block in blocks:
        text = (block.get("text") or "").strip()
        if not text:
            continue
        kind = block.get("kind", "paragraph")

        spec = TYPE.get(kind, TYPE["paragraph"])
        size, leading = spec["size"], spec["leading"]

        if kind == "name":
            w._ensure(leading)
            w.centered(text, size, SANS_BOLD)
            w.line(leading)

        elif kind == "contact":
            # The reference separates contact fields with pipes; parsed
            # resumes usually arrive with middots, which base-14 fonts cannot
            # draw anyway (`_sanitize` would degrade them to hyphens).
            contact = re.sub(r"\s*[·|]\s*", "  |  ", text.replace("\t", "  |  "))
            w.wrapped(
                contact, size, SANS, CONTENT_WIDTH, INK,
                leading_extra=leading - size * 1.4, center=True,
            )
            w.space(spec["after"])

        elif kind == "heading":
            # A heading that fits with nothing under it is a stranded heading,
            # which docs/05-architecture.md forbids — so the room it asks for is
            # everything the heading itself consumes plus one line of the
            # section it heads. `_ensure` runs before the `space()` below, so
            # that leading space has to be counted here too.
            w._ensure(
                spec["before"] + leading + spec["after"] + TYPE["bullet"]["leading"]
            )
            w.space(spec["before"])
            w.text(MARGIN, text.upper(), size, SANS_BOLD)
            # `text()` draws the baseline at y + size, not y — advancing by
            # less than `size` draws the rule above the baseline, through
            # the letters, instead of below them.
            w.line(leading)
            w.rule()
            w.space(spec["after"])

        elif kind == "role":
            # A breath between entries — the reference's inter-subheading
            # vspace. Counted in _ensure so the gap can't strand a role at a
            # page's foot, and matched by the preview's margin-top.
            w._ensure(spec.get("before", 0) + leading)
            w.space(spec.get("before", 0))
            left, right = text.split("\t", 1) if "\t" in text else (text, "")
            left, right = left.strip(), right.strip()
            if right and w.spread(left, right, size, SANS_BOLD):
                w.line(leading)
            elif right:
                # Too long to hold both ends of one line. Wrapping keeps the
                # dates on the page, which matters more than the date column
                # staying flush for this one entry.
                w.wrapped(f"{left}  {right}", size, SANS_BOLD, CONTENT_WIDTH, INK,
                          leading_extra=leading - size * 1.4)
            else:
                w.text(MARGIN, left, size, SANS_BOLD)
                w.line(leading)

        elif kind == "job_title":
            w._ensure(leading)
            w.text(MARGIN, text, size, SANS_ITALIC)
            w.line(leading)
            w.space(spec["after"])

        elif kind == "bullet":
            content = text.lstrip("".join(BULLET_CHARS) + " ").strip()
            w.wrapped(content, size, SANS, CONTENT_WIDTH - BULLET_INDENT, INK,
                      leading_extra=leading - size * 1.4,
                      indent=BULLET_INDENT, bullet=True)

        else:  # paragraph
            w.wrapped(text, size, SANS, CONTENT_WIDTH, INK,
                      leading_extra=leading - size * 1.4)

    data = doc.tobytes()
    pages = w.pages
    doc.close()
    return data, pages
