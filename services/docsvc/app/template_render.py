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
"""
import pymupdf

PAGE_WIDTH, PAGE_HEIGHT = 595.28, 841.89  # A4, points
MARGIN = 50.0
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
#: What an empty page holds, and how far a bullet's text sits off the margin.
#: `src/lib/tailor/template-metrics.ts` carries both for the preview.
ROOM = PAGE_HEIGHT - 2 * MARGIN
BULLET_INDENT = 14

INK = (0.09, 0.09, 0.09)
MUTED = (0.45, 0.45, 0.45)
RULE = (0.82, 0.82, 0.82)

SANS = "helv"
SANS_BOLD = "hebo"

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

    def line(self, leading: float) -> None:
        self.y += leading

    def rule(self) -> None:
        self.page.draw_line((MARGIN, self.y), (PAGE_WIDTH - MARGIN, self.y), color=RULE, width=0.75)

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

        if kind == "name":
            w._ensure(28)
            w.text(MARGIN, text, 20, SANS_BOLD)
            w.line(28)

        elif kind == "contact":
            w.wrapped(text.replace("\t", "   |   "), 10, SANS, CONTENT_WIDTH, MUTED, leading_extra=4)
            w.space(6)

        elif kind == "heading":
            w._ensure(26)
            w.space(12)
            w.text(MARGIN, text.upper(), 10.5, SANS_BOLD)
            # `text()` draws the baseline at y + size, not y — advancing by
            # less than `size` draws the rule above the baseline, through
            # the letters, instead of below them.
            w.line(10.5 + 3)
            w.rule()
            w.space(10)

        elif kind == "role":
            w._ensure(16)
            if "\t" in text:
                left, right = text.split("\t", 1)
            else:
                left, right = text, ""
            left, right = left.strip(), right.strip()
            w.text(MARGIN, left, 10.5, SANS_BOLD)
            if right:
                width = pymupdf.Font(SANS_BOLD).text_length(right, fontsize=10.5)
                w.text(PAGE_WIDTH - MARGIN - width, right, 10.5, SANS_BOLD)
            w.line(16)

        elif kind == "bullet":
            content = text.lstrip("".join(BULLET_CHARS) + " ").strip()
            w.wrapped(content, 10.5, SANS, CONTENT_WIDTH - BULLET_INDENT, INK,
                      indent=BULLET_INDENT, bullet=True)

        else:  # paragraph
            w.wrapped(text, 10.5, SANS, CONTENT_WIDTH, INK, leading_extra=4)

    data = doc.tobytes()
    pages = w.pages
    doc.close()
    return data, pages
