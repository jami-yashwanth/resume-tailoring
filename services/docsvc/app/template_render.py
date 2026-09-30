"""The default template drawn with PyMuPDF — the never-fails fallback.

The printed resume is the web app's HTML page, printed by Chromium (`/print`,
see `printer.py`). This module is what `/print` falls back to when Chromium
cannot run: it draws the same document onto A4 in base-14 Helvetica, embedding
no fonts. Same content and order; only the face and the exact wraps differ.

The numbers below (PDF points) are the fallback's own: edit them here.
"""
import re

import pymupdf

#: Leading bullet marks a file may carry on its own text.
_BULLET_PREFIX = re.compile(r"^[•◦▪‣·\-*]+\s*")

_SPEC = {
    "page": {
        "width": 595.28,
        "height": 841.89,
        "margin": 36
    },
    "rule": {
        "width": 0.4
    },
    "color": {
        "ink": "#000000",
        "muted": "#5a6273",
        "rule": "#000000"
    },
    "type": {
        "name": {
            "size": 24.79,
            "leading": 20.23,
            "bold": True,
            "align": "center"
        },
        "contact": {
            "size": 8.97,
            "leading": 10.96,
            "align": "center"
        },
        "heading": {
            "size": 14.35,
            "leading": 20.97,
            "bold": True,
            "upper": True,
            "rule": True
        },
        "role": {
            "size": 9.96,
            "leading": 11.96,
            "bold": True,
            "indent": 10.8,
            "width": 507.58
        },
        "job_title": {
            "size": 9.96,
            "leading": 11.96,
            "italic": True,
            "indent": 10.8
        },
        "bullet": {
            "size": 8.97,
            "leading": 10.96,
            "indent": 10.8,
            "indentNested": 21.6,
            "marker": "• "
        },
        "paragraph": {
            "size": 9.96,
            "leading": 11.96
        }
    },
    "gaps": {
        "default": 8,
        "name>contact": 0.77,
        "contact>heading": 15.16,
        "heading>paragraph": 8.17,
        "heading>bullet": 8.25,
        "heading>role": 8.06,
        "heading>job_title": 8.06,
        "paragraph>heading": 15.0,
        "paragraph>paragraph": 0,
        "bullet>bullet": 7.97,
        "bullet>heading": 15.16,
        "bullet>role": 8,
        "bullet2>bullet2": 3.99,
        "bullet2>heading": 15.16,
        "bullet2>role": 11.11,
        "role>job_title": 0,
        "role>role": 1.99,
        "role>heading": 10.02,
        "job_title>bullet2": 1.27,
        "job_title>role": 4.59,
        "job_title>heading": 7.23
    }
}

TYPE: dict[str, dict] = _SPEC["type"]
GAPS: dict[str, float] = _SPEC["gaps"]

PAGE_WIDTH, PAGE_HEIGHT = _SPEC["page"]["width"], _SPEC["page"]["height"]  # A4, points
MARGIN = float(_SPEC["page"]["margin"])
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
#: What an empty page holds.
ROOM = PAGE_HEIGHT - 2 * MARGIN
RULE_WIDTH = _SPEC["rule"]["width"]

#: Roboto's hhea metrics — the box model places a line's baseline
#: f(S, L) = L/2 + S*(asc - (asc+desc)/2) below its box top (the browser's
#: line-box arithmetic). The fallback draws
#: Helvetica but keeps Roboto's baseline placement so its boxes and page
#: breaks are the compiled file's.
_ASC, _DESC = 1900 / 2048, 500 / 2048


def _baseline(size: float, leading: float) -> float:
    return leading / 2 + size * (_ASC - (_ASC + _DESC) / 2)


def gap(prev: str | None, kind: str) -> float:
    """The measured space between two adjacent blocks; nothing above the first."""
    if prev is None:
        return 0.0
    return GAPS.get(f"{prev}>{kind}", GAPS["default"])


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

#: How far a bullet's text sits past the drawn dot. The compiled file carries
#: "• " as literal small text; this is that string's width, near
#: enough, in the fallback's own face.
MARKER_WIDTH = 6.0

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

    def text(self, x: float, text: str, size: float, leading: float, fontname: str, color=INK) -> None:
        self.page.insert_text(
            (x, self.y + _baseline(size, leading)),
            _sanitize(text),
            fontsize=size,
            fontname=fontname,
            color=color,
        )

    def centered(self, text: str, size: float, leading: float, fontname: str, color=INK) -> None:
        """One line centered on the page's midline — the reference template's
        header block. Centering happens per drawn line, so a wrapped contact
        line centers each of its lines centered."""
        font = pymupdf.Font(fontname)
        x = MARGIN + max(0.0, (CONTENT_WIDTH - font.text_length(_sanitize(text), fontsize=size)) / 2)
        self.text(x, text, size, leading, fontname, color)

    def line(self, leading: float) -> None:
        self.y += leading

    def rule(self) -> None:
        self.page.draw_line(
            (MARGIN, self.y), (PAGE_WIDTH - MARGIN, self.y), color=RULE, width=RULE_WIDTH
        )

    def spread(self, x: float, width: float, left: str, right: str, size: float, leading: float, fontname: str, color=INK) -> bool:
        """One line with `left` at `x` and `right` pushed to `x + width`.

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

        The cost is up to half a space of right-edge raggedness — 0.3% of the
        measure, against a date column nobody measures with a ruler.
        """
        font = pymupdf.Font(fontname)
        space = font.text_length(" ", fontsize=size)
        gap_w = width - font.text_length(left, fontsize=size) - font.text_length(
            right, fontsize=size
        )
        if not space or gap_w < space:
            return False
        self.text(x, f"{left}{' ' * round(gap_w / space)}{right}", size, leading, fontname, color)
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
        leading: float,
        fontname: str,
        width: float,
        color,
        indent=0.0,
        bullet=False,
        center=False,
    ):
        lines = _wrap(text, size, fontname, width)
        # Ask for the whole block first, so it moves in one piece. The per-line
        # check below only ever fires for a block too tall for any page, which
        # `_ensure` deliberately leaves where it is.
        self._ensure(leading * len(lines))
        for i, wrapped_line in enumerate(lines):
            if not self._fits(leading):
                self._break()
            if bullet and i == 0:
                self.bullet_dot(MARGIN + indent, size, color)
            if center:
                self.centered(wrapped_line, size, leading, fontname, color)
            else:
                x = MARGIN + indent + (MARKER_WIDTH if bullet else 0.0)
                self.text(x, wrapped_line, size, leading, fontname, color)
            self.line(leading)

    def space(self, amount: float) -> None:
        self.y += amount


def render_template(blocks: list[dict]) -> tuple[bytes, int]:
    doc = pymupdf.open()
    w = _Writer(doc)

    #: The previous drawn block, with bullet depth resolved ("bullet2" under a
    #: role), for the gaps lookup — and whether we're under a role, the same
    #: rule the printed page applies.
    prev: str | None = None
    under_role = False

    for block in blocks:
        text = (block.get("text") or "").strip()
        if not text:
            continue
        kind = block.get("kind", "paragraph")

        spec = TYPE.get(kind, TYPE["paragraph"])
        size, leading = spec["size"], spec["leading"]

        if kind == "heading":
            under_role = False
        keyed = "bullet2" if kind == "bullet" and under_role else kind
        g = gap(prev, keyed)

        if kind == "name":
            w._ensure(g + leading)
            w.space(g)
            w.centered(text, size, leading, SANS_BOLD)
            w.line(leading)

        elif kind == "contact":
            # The reference separates contact fields with pipes; parsed
            # resumes usually arrive with middots, which base-14 fonts cannot
            # draw anyway (`_sanitize` would degrade them to hyphens).
            contact = re.sub(r"\s*[·|]\s*", " | ", text.replace("\t", " | "))
            w.space(g)
            w.wrapped(contact, size, leading, SANS, CONTENT_WIDTH, INK, center=True)

        elif kind == "heading":
            # A heading that fits with nothing under it is a stranded heading,
            # which docs/05-architecture.md forbids — so the room it asks for is
            # everything the heading itself consumes plus one line of the
            # section it heads.
            w._ensure(g + leading + gap("heading", "bullet") + TYPE["bullet"]["leading"])
            w.space(g)
            w.text(MARGIN, text.upper(), size, leading, SANS_BOLD)
            # The rule sits at the heading box's bottom edge, where the
            # reference's \titlerule lands.
            w.line(leading)
            w.rule()

        elif kind == "role":
            indent, width = spec["indent"], spec["width"]
            w._ensure(g + leading)
            w.space(g)
            left, right = text.split("\t", 1) if "\t" in text else (text, "")
            left, right = left.strip(), right.strip()
            if right and w.spread(MARGIN + indent, width, left, right, size, leading, SANS_BOLD):
                w.line(leading)
            elif right:
                # Too long to hold both ends of one line. Wrapping keeps the
                # dates on the page, which matters more than the date column
                # staying flush for this one entry.
                w.wrapped(f"{left}  {right}", size, leading, SANS_BOLD, width, INK, indent=indent)
            else:
                w.text(MARGIN + indent, left, size, leading, SANS_BOLD)
                w.line(leading)

        elif kind == "job_title":
            w._ensure(g + leading)
            w.space(g)
            w.text(MARGIN + spec["indent"], text, size, leading, SANS_ITALIC)
            w.line(leading)

        elif kind == "bullet":
            indent = spec["indentNested"] if keyed == "bullet2" else spec["indent"]
            content = text.lstrip("".join(BULLET_CHARS) + " ").strip()
            w.space(g)
            w.wrapped(
                content, size, leading, SANS,
                CONTENT_WIDTH - indent - MARKER_WIDTH, INK,
                indent=indent, bullet=True,
            )

        else:  # paragraph
            w.space(g)
            w.wrapped(text, size, leading, SANS, CONTENT_WIDTH, INK)

        prev = keyed
        if kind in ("role", "job_title"):
            under_role = True

    data = doc.tobytes()
    pages = w.pages
    doc.close()
    return data, pages


def _items(items) -> list[dict]:
    """The non-empty items, stripped, bullet marks taken off bullet text."""
    out = []
    for item in items or []:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        bullet = bool(item.get("bullet"))
        out.append({"text": _BULLET_PREFIX.sub("", text) if bullet else text, "bullet": bullet})
    return out


def document_to_blocks(doc: dict) -> list[dict]:
    """The document flattened to the (kind, text) shape the drawn fallback
    renderer and the parity tests consume."""
    blocks: list[dict] = []

    def add(kind: str, text: str):
        blocks.append({"kind": kind, "text": text})

    def add_items(items):
        for item in _items(items):
            if item["bullet"]:
                add("bullet", "• " + item["text"])
            else:
                add("paragraph", item["text"])

    if doc.get("name"):
        add("name", doc["name"])
    for c in doc.get("contact") or []:
        add("contact", c)
    for section in doc.get("sections") or []:
        if section.get("heading"):
            add("heading", section["heading"])
        add_items(section.get("lead"))
        for e in section.get("entries") or []:
            role = " · ".join(x for x in (e.get("org"), e.get("place")) if x)
            if e.get("dates"):
                role = f"{role}\t{e['dates']}" if role else e["dates"]
            if role:
                add("role", role)
            if e.get("title"):
                add("job_title", e["title"])
            add_items(e.get("items"))
        for row in section.get("skills") or []:
            add("paragraph", f"{row['label']}: {row['items']}" if row.get("label") else row["items"])
        add_items(section.get("items"))
    return blocks
