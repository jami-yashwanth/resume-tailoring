"""What the default template guarantees.

Two contracts, both wider than this module:

Where it breaks its pages. `render_template` is the only thing that decides
where a download breaks, and the Result screen's preview paginates against the
same rule so that what the user reads on screen is what lands in the file.

What an ATS can read back out of it. A resume is written to be parsed, and the
parse happens on extracted text, not on the picture — so the things that matter
are whether the fields survive extraction with their separators intact and
whether a section heading arrives with something under it.

The sizes come from `template_render.TYPE` rather than being restated here.
"""
import re

import pymupdf

from app.template_render import (
    CONTENT_WIDTH,
    MARGIN,
    PAGE_HEIGHT,
    SANS,
    TYPE,
    _wrap,
    render_template,
)

BULLET_SIZE = TYPE["bullet"]["size"]
BULLET_LEADING = TYPE["bullet"]["leading"]
BULLET_INDENT = TYPE["bullet"]["indent"]


def page_texts(data: bytes) -> list[str]:
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        return [page.get_text() for page in doc]


def wrapped_lines(text: str) -> list[str]:
    return _wrap(text, BULLET_SIZE, SANS, CONTENT_WIDTH - BULLET_INDENT)


def page_holding(pages: list[str], needle: str) -> int:
    return next(i for i, text in enumerate(pages) if needle in text)


def test_a_bullet_too_tall_for_the_rest_of_the_page_moves_whole():
    """A bullet split across the fold reads as a typesetting failure on a
    document whose whole pitch is that its layout survived."""
    long_bullet = " ".join(f"word{i}" for i in range(40))
    lines = wrapped_lines(long_bullet)
    assert len(lines) > 1, "fixture must wrap, or it cannot straddle anything"

    # Fill the page so that the long bullet is one line too tall for the space
    # that is left, which is exactly the case that used to split it.
    room = PAGE_HEIGHT - 2 * MARGIN
    fillers = int(room / BULLET_LEADING) - (len(lines) - 1)
    blocks = [{"kind": "bullet", "text": "Filler line."} for _ in range(fillers)]
    blocks.append({"kind": "bullet", "text": long_bullet})

    data, pages = render_template(blocks)
    assert pages == 2

    texts = page_texts(data)
    assert page_holding(texts, "word0") == page_holding(texts, "word39"), (
        "the bullet was split across the page break"
    )


def test_a_paragraph_too_tall_for_the_rest_of_the_page_moves_whole():
    long_paragraph = " ".join(f"token{i}" for i in range(60))
    lines = _wrap(long_paragraph, BULLET_SIZE, SANS, CONTENT_WIDTH)
    assert len(lines) > 1

    room = PAGE_HEIGHT - 2 * MARGIN
    fillers = int(room / BULLET_LEADING) - (len(lines) - 1)
    blocks = [{"kind": "bullet", "text": "Filler line."} for _ in range(fillers)]
    blocks.append({"kind": "paragraph", "text": long_paragraph})

    texts = page_texts(render_template(blocks)[0])
    assert page_holding(texts, "token0") == page_holding(texts, "token59")


def test_a_block_taller_than_an_empty_page_still_renders():
    """Keeping a block whole cannot mean refusing to draw one that no page
    could hold — it would page forever, or silently drop the user's text."""
    room = PAGE_HEIGHT - 2 * MARGIN
    # Overshoot by a wide margin so the fixture stays taller than a page under
    # any plausible re-cut of the template's leading or measure — it sat just
    # past one page once and a tighter leading quietly pulled it back under.
    words_per_page = int(room / BULLET_LEADING) * 8
    giant = " ".join(f"w{i}" for i in range(words_per_page * 6))

    data, pages = render_template([{"kind": "paragraph", "text": giant}])

    assert pages >= 2
    assert "w0" in page_texts(data)[0]


def test_a_role_keeps_whitespace_between_the_employer_and_its_dates():
    """The one thing a resume parser needs off this line is the date range, and
    it only gets it if the two fields arrive separated.

    A PDF's content stream carries no whitespace between separately-positioned
    runs, so drawing the dates right-aligned as their own run leaves every
    extractor to infer the gap: some insert a space, some glue the fields into
    "InncirclesJun 2023", some drop the detached run. `_Writer.spread` pads with
    real spaces instead, which is what this pins — deliberately on extracted
    text rather than on the drawing call, because the extraction is the part
    that has to hold.
    """
    data, _ = render_template(
        [{"kind": "role", "text": "Inncircles — Hyderabad, Telangana\tJun 2023 - Jun 2026"}]
    )
    text = page_texts(data)[0]

    assert re.search(r"Telangana\s+Jun 2023", text), (
        f"employer and dates ran together on extraction: {text!r}"
    )


def test_a_role_whose_text_fills_the_line_still_separates_its_dates():
    """No room for padding is not a reason to emit one run-on word."""
    data, _ = render_template(
        [{"kind": "role", "text": f"{'Averylongemployername ' * 6}\tJun 2023 - Jun 2026"}]
    )
    assert re.search(r"Averylongemployername\s+Jun 2023", page_texts(data)[0])


def test_a_heading_is_never_the_last_thing_on_a_page():
    """A heading stranded at the fold tells the reader a section is coming and
    then ends the page — and tells a parser a section exists with nothing in it.
    docs/05-architecture.md has forbidden it since before it was implemented.
    """
    room = PAGE_HEIGHT - 2 * MARGIN
    heading = TYPE["heading"]
    # Fill the page down to just enough room for the heading and its own
    # spacing, and not enough for a line of what it heads.
    from app.template_render import GAPS

    needed = GAPS["bullet>heading"] + heading["leading"] + GAPS["heading>bullet"]
    fillers = int((room - needed - BULLET_LEADING / 2) / BULLET_LEADING)

    blocks = [{"kind": "bullet", "text": "Filler line."} for _ in range(fillers)]
    blocks += [{"kind": "heading", "text": "Education"}, {"kind": "bullet", "text": "Degree."}]

    texts = page_texts(render_template(blocks)[0])
    assert page_holding(texts, "EDUCATION") == page_holding(texts, "Degree."), (
        "the heading was stranded at the foot of a page"
    )


def test_name_and_contact_are_centered():
    """The header is the reference template's centered block: a \\Huge name
    over a centered contact line. Centered means the text starts well off the
    left margin and its midpoint sits at the page's midline."""
    data, _ = render_template(
        [
            {"kind": "name", "text": "Priya Sharma"},
            {"kind": "contact", "text": "priya@example.com | Bengaluru"},
            {"kind": "heading", "text": "Experience"},
            {"kind": "bullet", "text": "Built APIs."},
        ]
    )
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        words = doc[0].get_text("words")
        name_words = [w for w in words if w[4] in ("Priya", "Sharma")]
        x0 = min(w[0] for w in name_words)
        x1 = max(w[2] for w in name_words)
        mid = (x0 + x1) / 2
        page_mid = doc[0].rect.width / 2
        assert abs(mid - page_mid) < 2, f"name midline {mid} vs page {page_mid}"
        assert x0 > MARGIN + 20, "a centered name cannot start at the margin"

        contact = [w for w in words if "priya@example.com" in w[4]]
        assert contact and contact[0][0] > MARGIN + 20


def test_job_title_is_italic():
    data, _ = render_template(
        [
            {"kind": "role", "text": "Razorfin - Engineer\tAug 2024 - present"},
            {"kind": "job_title", "text": "Backend Engineer"},
        ]
    )
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        spans = [
            s
            for b in doc[0].get_text("dict")["blocks"]
            for l in b.get("lines", [])
            for s in l.get("spans", [])
        ]
        title = next(s for s in spans if "Backend Engineer" in s["text"])
        assert "Oblique" in title["font"] or "Italic" in title["font"]


def test_heading_rule_is_drawn_in_ink_not_a_faint_gray():
    """The reference's \\titlerule is a solid dark line under the heading —
    the faint gray hairline was one of the generated-template tells."""
    data, _ = render_template(
        [{"kind": "heading", "text": "Experience"}, {"kind": "bullet", "text": "x"}]
    )
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        lines = [d for d in doc[0].get_drawings() if d["items"] and d["items"][0][0] == "l"]
        assert lines, "heading must draw its rule"
        color = lines[0]["color"]
        assert sum(color) / 3 < 0.4, f"rule {color} reads as a faint gray"
