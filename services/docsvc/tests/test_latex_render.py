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


def _b(text):
    return {"text": text, "bullet": True}


def _p(text):
    return {"text": text, "bullet": False}


def _section(heading, kind, **over):
    return {"heading": heading, "kind": kind, "lead": [], "entries": [], "skills": [], "items": [], **over}


def _entry(**over):
    return {"org": None, "title": None, "dates": None, "place": None, "items": [], **over}


DOC = {
    "name": "Priya Sharma",
    "contact": ["priya@example.com · Bengaluru", "+91 98765 43210"],
    "sections": [
        _section("Summary", "summary", lead=[_p("Backend engineer.")]),
        _section(
            "Experience",
            "experience",
            entries=[
                _entry(
                    org="Google",
                    title="Software Engineer",
                    dates="Jun 2022 – Present",
                    place="Bengaluru",
                    items=[_p("Payments team."), _b("• Shipped X."), _b("Cut latency 20%.")],
                )
            ],
        ),
        _section(
            "Education",
            "education",
            entries=[_entry(org="IIT Madras", title="B.Tech", dates="2018 – 2022", items=[_p("CGPA: 8.38")])],
        ),
        _section("Projects", "projects", entries=[_entry(org="Rezz", dates="2026")]),
        _section(
            "Skills",
            "skills",
            skills=[
                {"label": "Languages", "items": "Python, Go"},
                {"label": None, "items": "Kubernetes"},
            ],
        ),
        _section(None, "other", items=[_p("Open to work.")]),
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

    doc = {"name": None, "contact": [], "sections": [_section("X", "other", entries=[_entry()])]}
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
    assert blocks[i + 4] == {"kind": "bullet", "text": "• Cut latency 20%."}
    assert by_kind[by_kind.index(("heading", "Summary")) + 1] == ("paragraph", "Backend engineer.")
    assert by_kind[-1] == ("paragraph", "Open to work.")
    assert ("paragraph", "Languages: Python, Go") in by_kind
    assert ("paragraph", "Kubernetes") in by_kind
    assert ("role", "Rezz\t2026") in by_kind


def test_document_to_blocks_keeps_section_bullets_and_order():
    from app.latex_render import document_to_blocks

    doc = {"name": None, "contact": [], "sections": [
        _section("Experience", "experience", lead=[_p("Intro.")],
                 entries=[_entry(org="Acme", items=[_b("Did."), _p("Tech: Go")])],
                 items=[_b("• Loose.")]),
    ]}
    assert [(b["kind"], b["text"]) for b in document_to_blocks(doc)] == [
        ("heading", "Experience"),
        ("paragraph", "Intro."),
        ("role", "Acme"),
        ("bullet", "• Did."),
        ("paragraph", "Tech: Go"),
        ("bullet", "• Loose."),
    ]


def test_entry_items_keep_file_order_and_bullet_marks():
    """A "Tech: ..." line after an entry's bullets stays after them, and only
    the bullets carry the bullet mark."""
    from app.latex_render import document_to_latex

    doc = {"name": None, "contact": [], "sections": [_section("Experience", "experience", entries=[
        _entry(org="Acme", dates="2024", items=[_b("• Built A."), _b("Built B."), _p("Tech: Go, Postgres")]),
    ])]}
    tex = document_to_latex(doc)
    a = tex.index(r"\resumeItem{\textbullet\ Built A.}")
    b = tex.index(r"\resumeItem{\textbullet\ Built B.}")
    t = tex.index(r"\resumeItem{Tech: Go, Postgres}")
    assert a < b < t


def test_bulleted_section_without_entries_renders_one_list():
    from app.latex_render import document_to_latex

    doc = {"name": None, "contact": [], "sections": [
        _section("Achievements", "achievements", lead=[_b("• Won X."), _b("Won Y.")]),
    ]}
    tex = document_to_latex(doc)
    assert tex == "\n".join([
        r"\section{Achievements}",
        r"\resumeSubHeadingList",
        r"\resumeItem{\textbullet\ Won X.}",
        r"\resumeItem{\textbullet\ Won Y.}",
        r"\resumeSubHeadingListEnd",
    ])


def test_plain_item_closes_an_open_bullet_list():
    from app.latex_render import document_to_latex

    doc = {"name": None, "contact": [], "sections": [
        _section("Other", "other", items=[_b("One."), _p("Plain."), _b("Two.")]),
    ]}
    tex = document_to_latex(doc)
    assert len(re.findall(r"\\resumeSubHeadingList\b(?!End)", tex)) == 2
    assert tex.count(r"\resumeSubHeadingListEnd") == 2
    end = tex.index(r"\resumeSubHeadingListEnd")
    assert end < tex.index("Plain.") < tex.index(r"\textbullet\ Two.")
    assert r"\resumeItem{Plain.}" not in tex


def test_heading_insert_in_lead_renders_before_the_first_entry():
    from app.latex_render import document_to_latex

    doc = {"name": None, "contact": [], "sections": [
        _section("Experience", "experience", lead=[_p("Open to relocation.")],
                 entries=[_entry(org="Acme", dates="2024", items=[_b("Did.")])],
                 items=[_b("Loose after.")]),
    ]}
    tex = document_to_latex(doc)
    assert tex.index(r"\section{Experience}") < tex.index("Open to relocation.") < tex.index(r"\textbf{Acme}")
    assert tex.index(r"\textbf{Acme}") < tex.index(r"\textbullet\ Loose after.")


def test_summary_paragraph_is_plain_and_first():
    from app.latex_render import document_to_latex

    tex = document_to_latex(DOC)
    body = tex.split(r"\section{Summary}", 1)[1]
    assert body.lstrip("\n").startswith("Backend engineer.")
    assert r"\resumeItem{Backend engineer.}" not in tex


def test_contact_strings_join_into_one_line():
    from app.latex_render import document_to_latex

    tex = document_to_latex(DOC)
    lines = tex.splitlines()
    assert r"  \small priya@example.com $|$ Bengaluru $|$ +91 98765 43210" in lines
    assert not any(ln.strip().endswith("+91 98765 43210") and "Bengaluru" not in ln for ln in lines)
    assert sum(1 for ln in lines if r"\small" in ln and "$|$" in ln) == 1


def test_every_special_character_escapes_on_the_document_path():
    """Resume text is attacker-supplied: every field the document path writes
    goes through escape()."""
    from app.latex_render import document_to_latex

    hostile = "%&_#${}\\"

    def doc(extra):
        return {
            "name": "N" + extra,
            "contact": ["c" + extra],
            "sections": [
                _section("H" + extra, "experience",
                         lead=[_p("lead" + extra)],
                         entries=[_entry(org="o" + extra, title="t" + extra, dates="d" + extra,
                                         place="p" + extra,
                                         items=[_b("b" + extra), _p("l" + extra)])],
                         skills=[{"label": "k" + extra, "items": "i" + extra}],
                         items=[_b("x" + extra), _p("y" + extra)]),
            ],
        }

    tex = document_to_latex(doc(hostile))
    escaped = r"\%\&\_\#\$\{\}\textbackslash{}"
    for tag in ("N", "c", "H", "lead", "o", "t", "d", "p", "b", "l", "k", "i", "x", "y"):
        assert tag + escaped in tex, tag
    # Every hostile string came out as exactly its escaped form and nothing
    # else: take the escapes away and what is left is the benign render, so no
    # raw special character reached the output outside the template's macros.
    assert tex.replace(escaped, "") == document_to_latex(doc(""))
    assert tex.count(escaped) == 14


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


@needs_tectonic
def test_section_bullets_and_plain_lines_compile():
    import pymupdf

    from app.latex_render import render_latex_document

    doc = {"name": "Priya", "contact": ["a@b.c", "+91 1"], "sections": [
        _section("Achievements", "achievements", lead=[_p("Highlights."), _b("• Won X."), _b("Won Y.")],
                 items=[_p("And more."), _b("Won Z.")]),
    ]}
    pdf = render_latex_document(doc, timeout=180.0)
    with pymupdf.open(stream=pdf, filetype="pdf") as d:
        text = d[0].get_text()
    for s in ("Highlights.", "Won X.", "Won Y.", "And more.", "Won Z.", "a@b.c | +91 1"):
        assert s in text, s
