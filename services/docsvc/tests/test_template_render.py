"""Where the default template breaks its pages.

`render_template` is the only thing that decides where a download breaks, and
the Result screen's preview paginates against the same rule so that what the
user reads on screen is what lands in the file. That makes the rule a contract
between two codebases rather than an implementation detail of this one, which
is why it is pinned here.
"""
import pymupdf

from app.template_render import (
    CONTENT_WIDTH,
    MARGIN,
    PAGE_HEIGHT,
    SANS,
    _wrap,
    render_template,
)

BULLET_SIZE = 10.5
BULLET_LEADING = BULLET_SIZE * 1.4
BULLET_INDENT = 14


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
    words_per_page = int(room / BULLET_LEADING) * 8
    giant = " ".join(f"w{i}" for i in range(words_per_page * 2))

    data, pages = render_template([{"kind": "paragraph", "text": giant}])

    assert pages >= 2
    assert "w0" in page_texts(data)[0]
