"""PDF parsing tests.

Fixtures are generated with pymupdf inside each test — no binary files in
git, and each test states exactly the geometry it depends on.
"""
import base64

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pdf_ops import parse_pdf


def _pdf_bytes(write) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4 at 72dpi
    write(page)
    data = doc.tobytes()
    doc.close()
    return data


def _save(tmp_path, data: bytes) -> str:
    path = tmp_path / "resume.pdf"
    path.write_bytes(data)
    return str(path)


def _resume_pdf() -> bytes:
    """A synthetic resume exercising each classification rule: name, contact,
    an upper-case heading, a role whose dates sit across a wide gap, a bullet,
    and a wrapped continuation line."""

    def write(page):
        page.insert_text((72, 72), "Priya Sharma", fontsize=16, fontname="hebo")
        page.insert_text((72, 95), "priya.sharma@example.com · Bengaluru", fontsize=10)
        page.insert_text((72, 125), "EXPERIENCE", fontsize=11)
        # One text line whose run of spaces opens a gap far wider than 12% of
        # the page — the PDF shape of a tab stop between title and dates.
        page.insert_text(
            (72, 148),
            "Razorfin - Backend Engineer" + " " * 60 + "Aug 2024 - present",
            fontsize=11,
            fontname="hebo",
        )
        page.insert_text((72, 170), "• Cut payment API latency by 60% across the", fontsize=11)
        page.insert_text((72, 185), "checkout and refunds services.", fontsize=11)

    return _pdf_bytes(write)


def test_classifies_name_contact_heading_role_and_bullet(tmp_path):
    blocks, fonts, warnings, pages = parse_pdf(_save(tmp_path, _resume_pdf()))

    kinds = [b.kind.value for b in blocks]
    assert kinds == ["name", "contact", "heading", "role", "bullet"]
    assert blocks[0].text == "Priya Sharma"
    assert pages == 1
    assert warnings == []
    assert any("Helvetica" in f for f in fonts)


def test_blocks_carry_the_heading_they_sit_under(tmp_path):
    """Same contract as docx parsing: every non-heading block names its
    section, headings themselves carry none. Placement logic (which section
    does a drafted line join?) is blind without it."""
    blocks, *_ = parse_pdf(_save(tmp_path, _resume_pdf()))
    by_kind = {b.kind.value: b for b in blocks}
    assert by_kind["heading"].section is None
    assert by_kind["role"].section == "EXPERIENCE"
    assert by_kind["bullet"].section == "EXPERIENCE"
    # Blocks before any heading (name, contact) belong to no section.
    assert by_kind["name"].section is None
    assert by_kind["contact"].section is None


def test_wide_gap_between_title_and_dates_reads_as_a_tab(tmp_path):
    blocks, *_ = parse_pdf(_save(tmp_path, _resume_pdf()))
    role = next(b for b in blocks if b.kind.value == "role")
    assert "\t" in role.text
    left, right = role.text.split("\t")
    assert left == "Razorfin - Backend Engineer"
    assert right == "Aug 2024 - present"


def test_wrapped_bullet_line_folds_back_into_its_bullet(tmp_path):
    blocks, *_ = parse_pdf(_save(tmp_path, _resume_pdf()))
    bullet = next(b for b in blocks if b.kind.value == "bullet")
    assert bullet.text.endswith("across the checkout and refunds services.")


def test_role_dates_on_their_own_line_are_rejoined(tmp_path):
    def write(page):
        page.insert_text((72, 72), "Priya Sharma", fontsize=16, fontname="hebo")
        page.insert_text((72, 95), "priya@example.com · Bengaluru", fontsize=10)
        page.insert_text((72, 125), "Razorfin - Backend Engineer", fontsize=11, fontname="hebo")
        page.insert_text((72, 140), "Aug 2024 - present", fontsize=11)

    blocks, *_ = parse_pdf(_save(tmp_path, _pdf_bytes(write)))
    role = next(b for b in blocks if b.kind.value == "role")
    assert role.text == "Razorfin - Backend Engineer\tAug 2024 - present"


def test_pdf_without_text_warns_it_may_be_scanned(tmp_path):
    blocks, _, warnings, pages = parse_pdf(_save(tmp_path, _pdf_bytes(lambda page: None)))
    assert blocks == []
    assert pages == 1
    assert any("scanned" in w.lower() for w in warnings)


def test_parse_api_reads_a_pdf_end_to_end(tmp_path):
    client = TestClient(app)
    response = client.post(
        "/parse",
        json={"file": base64.b64encode(_resume_pdf()).decode(), "filename": "resume.pdf"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "pdf"
    assert body["pages"] == 1
    assert [b["kind"] for b in body["blocks"]][:2] == ["name", "contact"]


def test_encrypted_pdf_is_named_as_password_protected(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Priya Sharma")
    data = doc.tobytes(
        encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="secret"
    )
    doc.close()

    with pytest.raises(ValueError, match="password"):
        parse_pdf(_save(tmp_path, data))


def test_parse_api_reports_password_protection_not_scanned(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Priya Sharma")
    data = doc.tobytes(
        encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="secret"
    )
    doc.close()

    client = TestClient(app)
    response = client.post(
        "/parse",
        json={"file": base64.b64encode(data).decode(), "filename": "resume.pdf"},
    )
    assert response.status_code == 422
    assert "password" in response.json()["detail"].lower()
