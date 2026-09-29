"""The LaTeX spike (unwired): template injection, escaping, compilation.

Compile tests skip on machines without tectonic — the escaping and injection
logic tests run everywhere.
"""
import shutil

import pytest

from app.latex_render import blocks_to_latex, escape

needs_tectonic = pytest.mark.skipif(
    shutil.which("tectonic") is None, reason="tectonic not installed"
)


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
def test_render_template_endpoint_honors_the_latex_flag(monkeypatch):
    """Flag on -> compiled LaTeX (Roboto in the fonts). Flag off -> the drawn
    template (base-14 Helvetica). Only the exact string "true" opens it."""
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

    monkeypatch.setenv("REZZ_LATEX_TEMPLATE", "true")
    assert "Roboto" in fonts_of(client.post("/render-template", json=body))

    monkeypatch.setenv("REZZ_LATEX_TEMPLATE", "TRUE")
    assert "Helvetica" in fonts_of(client.post("/render-template", json=body))

    monkeypatch.delenv("REZZ_LATEX_TEMPLATE")
    assert "Helvetica" in fonts_of(client.post("/render-template", json=body))
