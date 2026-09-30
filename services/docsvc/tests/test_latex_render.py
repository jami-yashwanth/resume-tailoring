"""The LaTeX template path: template injection, escaping, compilation.

Compile tests skip on machines without tectonic — the escaping and injection
logic tests run everywhere.
"""
import re
import shutil
from pathlib import Path

import pytest

from app.latex_render import TEMPLATE, blocks_to_latex, escape

needs_tectonic = pytest.mark.skipif(
    shutil.which("tectonic") is None, reason="tectonic not installed"
)

OWNER_REFERENCE = Path(__file__).parent / "fixtures" / "owner_reference.tex"


def _preamble(source: str) -> str:
    return source.split(r"\begin{document}")[0]


def test_preamble_is_the_owners_reference_verbatim():
    """The stored template is the owner's paste, not our adaptation of it.

    Exactly one difference is licensed: letterpaper -> a4paper (owner's call,
    30 Sep 2026, India-first). A leading %-comment header on the stored file
    is allowed; from \\documentclass on, every byte must match. Engine quirks
    are never edited into this file — latex_render neutralizes pdfTeX-only
    lines at compile time instead.
    """
    reference = _preamble(OWNER_REFERENCE.read_text())
    stored_lines = _preamble(TEMPLATE.read_text()).splitlines(keepends=True)
    start = next(
        i for i, line in enumerate(stored_lines) if line.startswith(r"\documentclass")
    )
    stored = "".join(stored_lines[start:])
    assert stored == reference.replace("letterpaper", "a4paper", 1)


def test_compat_neutralizes_pdftex_only_lines_and_nothing_else():
    """The stored file keeps the owner's pdfTeX lines; the compile must not.

    XeTeX (Tectonic) has no \\pdfgentounicode and glyphtounicode.tex is all
    pdfTeX primitives — either aborts the compile. XeTeX emits Unicode-mapped
    PDFs natively, so commenting the two out changes nothing in the output.
    Every other line must pass through byte-identical: this same pass will run
    over user-uploaded templates.
    """
    from app.latex_render import compat

    source = TEMPLATE.read_text()
    out = compat(source)

    before, after = source.splitlines(), out.splitlines()
    assert len(before) == len(after), "compat may comment lines, never add or drop them"
    changed = [(a, b) for a, b in zip(before, after) if a != b]
    assert sorted(a.strip() for a, _ in changed) == [
        r"\input{glyphtounicode}",
        r"\pdfgentounicode=1",
    ]
    for original, neutralized in changed:
        assert neutralized.lstrip().startswith("%")
        assert original.strip() in neutralized


def test_every_special_character_escapes_to_literal_text():
    hostile = r"100% uptime & $0 cost #tag _under {brace} ~tilde ^caret \input{/etc/passwd}"
    escaped = escape(hostile)
    for ch in "&%$#_{}":
        assert f"\\{ch}" in escaped
    assert r"\textasciitilde{}" in escaped
    assert r"\textasciicircum{}" in escaped
    assert r"\textbackslash{}input" in escaped, "a raw backslash must never survive"
    # Nothing actionable remains: no unescaped specials outside the escapes'
    # own syntax.
    stripped = escaped
    for seq in (r"\textbackslash{}", r"\textasciitilde{}", r"\textasciicircum{}",
                r"\&", r"\%", r"\$", r"\#", r"\_", r"\{", r"\}"):
        stripped = stripped.replace(seq, "")
    assert not any(ch in stripped for ch in "\\&%$#_{}~^")


def test_blocks_become_the_template_macros():
    tex = blocks_to_latex(
        [
            {"kind": "name", "text": "Priya Sharma"},
            {"kind": "contact", "text": "a@b.c · Bengaluru"},
            {"kind": "heading", "text": "Experience"},
            {"kind": "role", "text": "Razorfin\tAug 2024 - present"},
            {"kind": "job_title", "text": "Engineer"},
            {"kind": "bullet", "text": "• Did a thing."},
        ]
    )
    assert r"\textbf{\Huge Priya Sharma}" in tex
    assert "a@b.c $|$ Bengaluru" in tex
    assert r"\section{Experience}" in tex
    assert r"\resumeSubheading{Razorfin}{Aug 2024 - present}{Engineer}{}" in tex
    assert r"\resumeItem{\textbullet\ Did a thing.}" in tex
    # Every opened list is closed.
    assert tex.count(r"\resumeSubHeadingList" + "\n") + tex.count(
        r"\resumeSubHeadingList"
    ) >= tex.count(r"\resumeSubHeadingListEnd")


def test_bullets_under_a_heading_stay_on_one_level():
    """Sibling items sit at the same indent, like the reference's Technical
    Skills list. Measured before the fix: the first item sat at level one and
    every later sibling nested a level deeper, because any item in the outer
    list — including a bullet — licensed nesting. Only a role does."""
    import re as _re

    tex = blocks_to_latex(
        [
            {"kind": "heading", "text": "Technical Skills"},
            {"kind": "bullet", "text": "Python"},
            {"kind": "bullet", "text": "SQL"},
        ]
    )
    opens = len(_re.findall(r"\\resumeSubHeadingList(?!End)", tex))
    closes = tex.count(r"\resumeSubHeadingListEnd")
    assert (opens, closes) == (1, 1), "one flat list, no nesting"


def test_bullets_under_a_role_nest_one_level_deeper():
    """The reference's experience bullets sit in a nested list under the
    role's subheading — one level deeper than the skills list."""
    import re as _re

    tex = blocks_to_latex(
        [
            {"kind": "heading", "text": "Experience"},
            {"kind": "role", "text": "DeepMind\t2022"},
            {"kind": "job_title", "text": "Intern"},
            {"kind": "bullet", "text": "Did research."},
        ]
    )
    opens = len(_re.findall(r"\\resumeSubHeadingList(?!End)", tex))
    assert opens == 2, "the section list plus the nested bullet list"


def test_user_hyphen_pairs_survive_tex_ligatures():
    """Roboto's tex-text mapping turns -- into an en dash. The preview shows
    the user's literal text, and nothing is rewritten behind their back, so a
    typed -- must print as --: the escaper breaks the pair with an empty
    group."""
    assert "-{}-" in escape("2019--2023")
    # A lone hyphen stays a hyphen, untouched.
    assert escape("full-time") == "full-time"


def test_role_without_title_inlines_the_references_tabular():
    """The owner's preamble defines no compact-subheading macro and stays
    verbatim, so a role with no job title under it sets the reference's own
    tabular* pattern inline — one bold row — rather than calling a macro the
    template does not have."""
    tex = blocks_to_latex(
        [
            {"kind": "heading", "text": "Certifications"},
            {"kind": "role", "text": "AWS Certified ML - Specialty\t2024"},
        ]
    )
    assert "resumeSubheadingCompact" not in tex
    assert r"\begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}" in tex
    assert r"\textbf{AWS Certified ML - Specialty} & 2024 \\" in tex


def test_paragraph_after_heading_is_plain_body_text():
    """The reference's Summary is a paragraph straight after its section
    heading — full-width normal-size text, not a \\small \\resumeItem indented
    inside a list. The list opens only when a role or bullet arrives."""
    tex = blocks_to_latex(
        [
            {"kind": "heading", "text": "Summary"},
            {"kind": "paragraph", "text": "Engineer of things."},
        ]
    )
    assert r"\section{Summary}" in tex
    assert "Engineer of things." in tex
    assert r"\resumeItem" not in tex
    assert r"\resumeSubHeadingList" not in tex


@needs_tectonic
def test_compiles_to_a_readable_pdf():
    import pymupdf

    from app.latex_render import render_latex

    pdf = render_latex(
        [
            {"kind": "name", "text": "Priya Sharma"},
            {"kind": "contact", "text": "a@b.c · Bengaluru"},
            {"kind": "heading", "text": "Experience"},
            {"kind": "role", "text": "Razorfin\tAug 2024 - present"},
            {"kind": "job_title", "text": "Engineer"},
            {"kind": "bullet", "text": "Shipped 100% of the $ & # things."},
        ],
        timeout=180.0,
    )
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:
        text = doc[0].get_text()
    assert "Priya Sharma" in text
    assert "Shipped 100% of the $ & # things." in text


@needs_tectonic
def test_render_template_endpoint_compiles_latex_by_default(monkeypatch):
    """The LaTeX template IS the product's template (owner's call, 30 Sep
    2026): compiled by default (Roboto in the fonts), with REZZ_LATEX_TEMPLATE
    kept only as an off switch — the exact string "false" falls back to the
    drawn template (base-14 Helvetica). Failure-fallback safety is unchanged."""
    import pymupdf
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    body = {
        "blocks": [
            {"kind": "name", "text": "Priya Sharma"},
            {"kind": "heading", "text": "Experience"},
            {"kind": "bullet", "text": "Did a thing."},
        ]
    }

    def fonts_of(response) -> str:
        import base64 as b64

        data = b64.b64decode(response.json()["file"])
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            return " ".join(f[3] for f in doc[0].get_fonts())

    monkeypatch.delenv("REZZ_LATEX_TEMPLATE", raising=False)
    assert "Roboto" in fonts_of(client.post("/render-template", json=body))

    # The Result screen's exact preview: images=true adds one PNG per page,
    # rendered from the same bytes the download gets.
    import base64 as b64

    payload = client.post("/render-template", json={**body, "images": True}).json()
    assert payload["pages"] == len(payload["images"]) == 1
    assert b64.b64decode(payload["images"][0])[:8] == b"\x89PNG\r\n\x1a\n"

    # And absent unless asked for — a download has no use for page pictures.
    assert "images" not in client.post("/render-template", json=body).json()

    monkeypatch.setenv("REZZ_LATEX_TEMPLATE", "true")
    assert "Roboto" in fonts_of(client.post("/render-template", json=body))

    monkeypatch.setenv("REZZ_LATEX_TEMPLATE", "false")
    assert "Helvetica" in fonts_of(client.post("/render-template", json=body))

    monkeypatch.setenv("REZZ_LATEX_TEMPLATE", " FALSE ")
    assert "Helvetica" in fonts_of(client.post("/render-template", json=body))


DOC = {
    "name": "Priya Sharma",
    "contact": ["priya@example.com · Bengaluru", "+91 98765 43210"],
    "sections": [
        {
            "heading": "Summary",
            "kind": "summary",
            "entries": [],
            "skills": [],
            "lines": ["Backend engineer."],
        },
        {
            "heading": "Experience",
            "kind": "experience",
            "entries": [
                {
                    "org": "Google",
                    "title": "Software Engineer",
                    "dates": "Jun 2022 – Present",
                    "place": "Bengaluru",
                    "bullets": ["• Shipped X.", "Cut latency 20%."],
                    "lines": ["Payments team."],
                }
            ],
            "skills": [],
            "lines": [],
        },
        {
            "heading": "Education",
            "kind": "education",
            "entries": [
                {
                    "org": "IIT Madras",
                    "title": "B.Tech",
                    "dates": "2018 – 2022",
                    "place": None,
                    "bullets": [],
                    "lines": ["CGPA: 8.38"],
                }
            ],
            "skills": [],
            "lines": [],
        },
        {
            "heading": "Projects",
            "kind": "projects",
            "entries": [
                {"org": "Rezz", "title": None, "dates": "2026", "place": None, "bullets": [], "lines": []}
            ],
            "skills": [],
            "lines": [],
        },
        {
            "heading": "Skills",
            "kind": "skills",
            "entries": [],
            "skills": [
                {"label": "Languages", "items": "Python, Go"},
                {"label": None, "items": "Kubernetes"},
            ],
            "lines": [],
        },
        {"heading": None, "kind": "other", "entries": [], "skills": [], "lines": ["Open to work."]},
    ],
}


def test_document_becomes_the_template_macros():
    from app.latex_render import document_to_latex

    tex = document_to_latex(DOC)
    assert r"\resumeSubheading{Google}{Jun 2022 – Present}{Software Engineer}{Bengaluru}" in tex
    assert r"\resumeItem{\textbullet\ Shipped X.}" in tex
    assert r"\resumeItem{CGPA: 8.38}" in tex
    assert r"\item \small{\textbf{Languages}{: Python, Go}}" in tex
    assert r"\item \small{Kubernetes}" in tex
    assert len(re.findall(r"\\resumeSubHeadingList\b(?!End)", tex)) == tex.count(r"\resumeSubHeadingListEnd")
    assert tex.index(r"\resumeItem{Payments team.}") < tex.index(r"\textbullet\ Shipped X.")


def test_entry_with_only_org_and_dates_inlines_the_references_tabular():
    from app.latex_render import document_to_latex

    tex = document_to_latex(DOC)
    assert r"\textbf{Rezz} & 2026 \\" in tex
    assert r"\resumeSubheading{Rezz}" not in tex


def test_section_without_heading_sets_no_section_title():
    from app.latex_render import document_to_latex

    tex = document_to_latex(DOC)
    assert tex.count(r"\section{") == sum(1 for s in DOC["sections"] if s["heading"])
    assert "Open to work." in tex


def test_empty_entry_renders_nothing():
    from app.latex_render import document_to_latex

    empty = {"org": None, "title": None, "dates": None, "place": None, "bullets": [], "lines": []}
    doc = {
        "name": None,
        "contact": [],
        "sections": [
            {"heading": "X", "kind": "other", "entries": [empty], "skills": [], "lines": []}
        ],
    }
    assert document_to_latex(doc) == r"\section{X}"


def test_document_to_blocks_matches_the_flat_shape():
    from app.latex_render import document_to_blocks

    blocks = document_to_blocks(DOC)
    assert [b["kind"] for b in blocks[:4]] == ["name", "contact", "contact", "heading"]
    by_kind = [(b["kind"], b["text"]) for b in blocks]
    assert ("heading", "Experience") in by_kind
    i = by_kind.index(("role", "Google · Bengaluru\tJun 2022 – Present"))
    assert blocks[i + 1] == {"kind": "job_title", "text": "Software Engineer"}
    assert blocks[i + 2] == {"kind": "paragraph", "text": "Payments team."}
    assert blocks[i + 3] == {"kind": "bullet", "text": "• Shipped X."}
    assert ("paragraph", "Languages: Python, Go") in by_kind
    assert ("paragraph", "Kubernetes") in by_kind
    assert ("role", "Rezz\t2026") in by_kind


def test_render_template_endpoint_accepts_a_document():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    response = client.post("/render-template", json={"document": DOC, "images": True})
    assert response.status_code == 200
    payload = response.json()
    assert payload["pages"] >= 1
    assert len(payload["images"]) == payload["pages"]
    assert client.post("/render-template", json={}).status_code == 422


@needs_tectonic
def test_document_compiles_to_a_readable_pdf():
    import pymupdf

    from app.latex_render import render_latex_document

    pdf = render_latex_document(DOC, timeout=180.0)
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:
        text = doc[0].get_text()
    assert "Software Engineer" in text
    assert "Python, Go" in text
