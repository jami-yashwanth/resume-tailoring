"""Reading a PDF into the same `Block` shape `docx_ops` produces.

Only needed because v1 renders every result into the one default Rezz
template (see CLAUDE.md's dated override) rather than editing the user's file
in place — that sidesteps the subset-font problem `docs/05-architecture.md`
describes for in-place PDF editing, since nothing here reuses the file's own
fonts. We only need the *content*, classified into the same kinds
(name/contact/heading/role/bullet/paragraph) docx parsing already uses, so
the planner and the template renderer don't need to know which format a
resume arrived in.

Heuristics mirror `_classify` in `docx_ops.py`, adapted to what a PDF gives us
instead of Word's explicit tab stops and paragraph styles: font size relative
to the document's own body size, bold/italic *majority* of a line (not "any
span" — a bullet with one bolded number, e.g. "...by 30%.", is not a heading),
and a wide gap between two words standing in for a tab (a role's title pushed
left, its dates pushed right).
"""
import re
from collections import Counter, defaultdict

import pymupdf

from .headings import carries_a_value, looks_like_caps_heading
from .models import Block, BlockKind, Run

BULLET_CHARS = "•◦▪‣·"
_DATE_RE = re.compile(r"(19|20)\d{2}|present|current", re.IGNORECASE)
_ICON_FONT_RE = re.compile(r"fontawesome|glyphicon|material.?icons?|\bicon\b", re.IGNORECASE)

_BOLD_FLAG = 2**4
_ITALIC_FLAG = 2**1


def _is_bullet(text: str) -> bool:
    stripped = text.strip()
    return len(stripped) > 1 and stripped[0] in BULLET_CHARS


def _looks_like_date(text: str) -> bool:
    return len(text) < 30 and bool(_DATE_RE.search(text))


def _icon_chars(page) -> set[str]:
    """Characters drawn in an icon webfont (FontAwesome and the like).

    These decode to *some* Unicode character — often an arbitrary one the
    icon font's own cmap happens to use — that reads as a stray glyph with no
    textual meaning ("Coders gallery | §"). Safe to drop: a resume's real
    content is never set in an icon font."""
    chars: set[str] = set()
    for raw_block in page.get_text("dict").get("blocks", []):
        if raw_block.get("type") != 0:
            continue
        for line in raw_block.get("lines", []):
            for s in line.get("spans", []):
                if _ICON_FONT_RE.search(s.get("font", "")):
                    chars.update(s.get("text", ""))
    return chars


def _line_styles(page) -> dict[tuple[int, int], dict]:
    """Style per (block_no, line_no), weighted by how much of the line it
    covers — not "does any span have this flag". A bullet that bolds one
    number for emphasis ("...by 30%.") is not a bold *line*, and treating it
    as one misclassifies the whole wrapped continuation as a new role."""
    styles: dict[tuple[int, int], dict] = {}
    for raw_block in page.get_text("dict").get("blocks", []):
        if raw_block.get("type") != 0:  # not a text block (e.g. an image)
            continue
        for line_no, line in enumerate(raw_block.get("lines", [])):
            spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
            if not spans:
                continue
            total = sum(len(s["text"]) for s in spans) or 1
            bold_chars = sum(len(s["text"]) for s in spans if s.get("flags", 0) & _BOLD_FLAG)
            italic_chars = sum(len(s["text"]) for s in spans if s.get("flags", 0) & _ITALIC_FLAG)
            styles[(raw_block["number"], line_no)] = {
                "bold": bold_chars / total > 0.5,
                "italic": italic_chars / total > 0.5,
                "size": max((s.get("size", 11.0) for s in spans), default=11.0),
                "fonts": {s["font"] for s in spans if s.get("font")},
            }
    return styles


def _read_lines(page, page_width: float, fonts: set[str]) -> list[dict]:
    """One dict per text line: text (correctly word-spaced), bold, italic, size.

    Text is rebuilt from `page.get_text("words")` — PyMuPDF's own
    word-tokenised extraction — rather than joined from dict spans: some PDF
    generators split a line into several spans without an inserted space
    between them, and joining those silently glues words together
    ("JamiYashwanth"). Style still comes from the dict spans above; only the
    text does not.
    """
    styles = _line_styles(page)
    for style in styles.values():
        fonts.update(style["fonts"])
    icon_chars = _icon_chars(page)

    by_line: dict[tuple[int, int], list] = defaultdict(list)
    for w in page.get_text("words"):  # (x0, y0, x1, y1, word, block_no, line_no, word_no)
        if icon_chars and all(ch in icon_chars for ch in w[4]):
            continue  # a decorative icon glyph, not text
        by_line[(w[5], w[6])].append(w)

    lines: list[dict] = []
    for key in sorted(by_line):
        words = sorted(by_line[key], key=lambda w: w[7])
        style = styles.get(key, {"bold": False, "italic": False, "size": 11.0})

        # A wide gap between two consecutive words is the PDF equivalent of a
        # DOCX tab stop: a title pushed left, its dates pushed right. A
        # normal inter-word space is a few points; this only fires on a gap
        # an order of magnitude bigger.
        split_at = None
        for i in range(1, len(words)):
            if words[i][0] - words[i - 1][2] > page_width * 0.12:
                split_at = i
                break

        if split_at is not None:
            left = " ".join(w[4] for w in words[:split_at])
            right = " ".join(w[4] for w in words[split_at:])
            text = f"{left}\t{right}" if left and right else " ".join(w[4] for w in words)
        else:
            text = " ".join(w[4] for w in words)

        # Dropping an icon word can leave a "|" separator dangling ("Coders
        # gallery |" with nothing after it). Never strip a leading bullet
        # character here — that's what `_is_bullet` reads to classify the
        # line, and stripping it before classification runs blinds it.
        text = re.sub(r"\|\s*$", "", text).strip()
        text = re.sub(r"\t\s*$", "", text)
        if not text:
            continue
        lines.append({"text": text, "bold": style["bold"], "italic": style["italic"], "size": style["size"]})

    return lines


def _merge_role_dates(lines: list[dict]) -> list[dict]:
    """Some PDF generators put a role's title and its date range in two
    separate text lines rather than one line with a wide gap — the tab
    detection above never sees them. A short, mostly-date line straight
    after a bold title with no tab of its own is the same shape, just split
    differently by whatever produced the PDF, so it gets rejoined here too."""
    merged: list[dict] = []
    for line in lines:
        previous = merged[-1] if merged else None
        if (
            previous
            and "\t" not in previous["text"]
            and previous["bold"]
            and len(previous["text"]) < 90
            and _looks_like_date(line["text"])
            and not _is_bullet(line["text"])
        ):
            previous["text"] = f"{previous['text']}\t{line['text']}"
            continue
        merged.append(dict(line))
    return merged


def _body_size(lines: list[dict]) -> float:
    """The document's most common line size — a resume's body text, whatever
    that happens to be set in. Headings are judged relative to this, not
    against a fixed point size, since templates vary."""
    sizes = Counter(round(line["size"] * 2) / 2 for line in lines if line["text"])
    return sizes.most_common(1)[0][0] if sizes else 11.0


def _classify(index: int, text: str, bold: bool, italic: bool, size: float, body_size: float) -> BlockKind:
    if _is_bullet(text):
        return BlockKind.BULLET
    if index == 0:
        return BlockKind.NAME
    if index == 1 and any(ch in text for ch in ("@", "·", "|")):
        return BlockKind.CONTACT
    if "\t" in text:
        return BlockKind.ROLE
    if looks_like_caps_heading(text) or (
        len(text) < 40 and bold and size >= body_size * 1.15 and not carries_a_value(text)
    ):
        return BlockKind.HEADING
    # A role's title is bold in most templates, italic in some (this file's
    # LaTeX template among them) — either is a stronger signal than "not
    # bold", which is why this comes before the plain-paragraph fallback.
    if len(text) < 90 and (bold or italic):
        return BlockKind.ROLE
    return BlockKind.PARAGRAPH


def _merge_continuations(blocks: list[dict]) -> list[dict]:
    """A bullet or paragraph that wraps onto a second PDF line produces a
    second, separate line with no bullet marker and no bold/italic of its
    own — `_classify` correctly calls that a plain paragraph, but leaving it
    as its own block splits one sentence into two, which is what actually
    read as "the template is disturbed": a bullet, then an orphaned
    half-sentence directly under it with no indent. Folding a paragraph line
    back into an immediately preceding bullet/paragraph restores the one
    sentence it always was."""
    merged: list[dict] = []
    for block in blocks:
        previous = merged[-1] if merged else None
        if block["kind"] == BlockKind.PARAGRAPH and previous and previous["kind"] in (
            BlockKind.BULLET,
            BlockKind.PARAGRAPH,
        ):
            previous["text"] = f"{previous['text']} {block['text']}"
            continue
        merged.append(dict(block))
    return merged


def parse_pdf(path: str) -> tuple[list[Block], list[str], list[str], int]:
    """Returns (blocks, fonts, warnings, pages)."""
    doc = pymupdf.open(path)
    if doc.needs_pass:
        # Without the password every page reads as empty, which would fall
        # through to the "scanned page" message — wrong advice for a fixable
        # problem. Name the real one.
        doc.close()
        raise ValueError("this PDF is password-protected")
    warnings: list[str] = []
    fonts: set[str] = set()
    blocks: list[Block] = []
    index = 0
    # Same contract as parse_docx: every non-heading block names the heading
    # it sits under, headings themselves carry none. Sections carry across
    # pages — a section that starts on page 1 still owns page 2's bullets.
    section: str | None = None

    for page in doc:
        lines = _merge_role_dates(_read_lines(page, page.rect.width, fonts))
        body_size = _body_size(lines)

        page_blocks: list[dict] = []
        for line in lines:
            kind = _classify(index, line["text"], line["bold"], line["italic"], line["size"], body_size)
            page_blocks.append({"kind": kind, "text": line["text"], "bold": line["bold"], "size": line["size"]})
            index += 1

        for block in _merge_continuations(page_blocks):
            if block["kind"] is BlockKind.HEADING:
                section = block["text"]
            blocks.append(
                Block(
                    id=str(len(blocks)),
                    kind=block["kind"],
                    text=block["text"],
                    section=None if block["kind"] is BlockKind.HEADING else section,
                    lines=1,
                    has_bold=block["bold"],
                    runs=[Run(text=block["text"], bold=block["bold"], size=block["size"])],
                    size=block["size"],
                    align="left",
                )
            )

    pages = doc.page_count
    doc.close()

    if not blocks:
        warnings.append("No selectable text found in this PDF — it may be a scanned page.")

    return blocks, sorted(fonts), warnings, pages
