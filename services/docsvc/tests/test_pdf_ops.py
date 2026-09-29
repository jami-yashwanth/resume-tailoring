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
