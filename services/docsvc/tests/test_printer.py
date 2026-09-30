"""POST /print: Chromium prints the web app's HTML, the drawn template is the
never-blank fallback. Chromium tests skip only where Chromium cannot launch."""
import base64
import re

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app import main, printer


@pytest.fixture(scope="session")
def chromium():
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            p.chromium.launch().close()
    except Exception as exc:  # missing package, missing browser, no sandbox
        pytest.skip(f"chromium unavailable: {exc}")


@pytest.fixture
def client(chromium):
    with TestClient(main.app) as c:
        yield c


def _page(blocks: str) -> str:
    return (
        "<!doctype html><html><head><meta charset='utf-8'><style>"
        "@page{size:A4;margin:40pt} body{font:12pt sans-serif;margin:0}"
        ".rz-block{break-inside:avoid;margin:0 0 10pt}"
        f"</style></head><body>{blocks}</body></html>"
    )


HTML = _page(
    "<p class='rz-block'>Priya Sharma</p>"
    "<p class='rz-block'>&lt;script&gt;alert(1)&lt;/script&gt;</p>"
    "<p class='rz-block'>100% &amp; \\TeX</p>"
)

DOC = {
    "name": "Priya Sharma",
    "contact": ["priya@example.com"],
    "sections": [{"heading": "Summary", "kind": "summary", "lead": [{"text": "Backend engineer."}]}],
}


def _post(client, **extra):
    return client.post("/print", json={"html": HTML, "document": DOC, **extra})


def _pdf(body) -> pymupdf.Document:
    return pymupdf.open(stream=base64.b64decode(body["file"]), filetype="pdf")


def test_print_returns_an_a4_pdf(client):
    response = _post(client)
    assert response.status_code == 200
    body = response.json()
    assert body["renderer"] == "chromium"
    assert body["pages"] == 1
    with _pdf(body) as pdf:
        assert abs(pdf[0].rect.width - 595.28) < 1


def test_count_only_returns_pages_without_a_file(client):
    body = _post(client, count_only=True).json()
    assert body["file"] is None
    assert body["pages"] == 1


def test_print_keeps_special_characters_as_text(client):
    with _pdf(_post(client).json()) as pdf:
        text = pdf[0].get_text()
    assert "<script>alert(1)</script>" in text
    assert "100% & \\TeX" in text


def test_blocks_never_split_across_pages(client):
    blocks = "".join(
        "<div class='rz-block'>" + "".join(f"<div>B{n}:{k}</div>" for k in range(5)) + "</div>"
        for n in range(80)
    )
    body = client.post("/print", json={"html": _page(blocks), "document": DOC}).json()
    with _pdf(body) as pdf:
        assert pdf.page_count > 1
        for page in pdf:
            first = page.get_text().strip().splitlines()[0]
            assert re.fullmatch(r"B\d+:0", first), first


def test_rejects_html_over_4mb(client):
    response = client.post("/print", json={"html": "x" * 4_000_001, "document": DOC})
    assert response.status_code == 413
    assert response.json()["detail"] == "html over 4 MB"


def test_print_timeout_raises_and_drops_the_browser(monkeypatch):
    import asyncio

    async def hang(html):
        await asyncio.sleep(5)

    monkeypatch.setattr(printer, "_print", hang)
    with pytest.raises(printer.PrintError):
        asyncio.run(printer.print_html("<p>x</p>", timeout=0.1))
    assert printer._browser is None


def test_print_falls_back_to_drawn_renderer(monkeypatch):
    async def boom(html, timeout=15.0):
        raise printer.PrintError("no chromium")

    monkeypatch.setattr(printer, "print_html", boom)
    with TestClient(main.app) as client:
        body = _post(client).json()
    assert body["renderer"] == "fallback"
    assert body["pages"] >= 1
    with _pdf(body) as pdf:
        assert "Priya Sharma" in pdf[0].get_text()
