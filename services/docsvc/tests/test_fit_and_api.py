"""The page budget, and the HTTP surface around it.

These go through LibreOffice, so they are the slow ones. They are also the only
tests that check the rule the product actually promises out loud: the page count
never grows without being asked.
"""
import base64

import pytest
from docx import Document
from fastapi.testclient import TestClient

from app import render
from app.docx_ops import para_text, parse_docx
from app.fitter import fit
from app.main import app
from app.models import Op

needs_renderer = pytest.mark.skipif(
    not render.available(), reason="LibreOffice not installed"
)


def b64(path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def block_id(blocks, needle: str) -> str:
    return next(b.id for b in blocks if b.text.startswith(needle))


@needs_renderer
def test_sample_is_one_page(workfile):
    assert render.count_pages(str(workfile)) == 1


@needs_renderer
def test_rewrites_alone_hold_the_page(workfile):
    blocks, _, _ = parse_docx(str(workfile))
    ops = [
        Op(
            op="rephrase",
            block=block_id(blocks, "Worked on backend APIs"),
            text="Cut payment API p95 latency from 820 ms to 310 ms using async Spring Boot workers on AWS ECS.",
            value=9,
        ),
        Op(
            op="rephrase",
            block=block_id(blocks, "Helped refactor"),
            text="Split the refunds module into 4 microservices, each deployed on its own.",
            value=7,
        ),
    ]
    result = fit(str(workfile), ops, max_pages=None)

    assert result["pages"] <= result["pages_before"]
    assert [a.status for a in result["applied"]] == ["applied", "applied"]


@needs_renderer
def test_user_approved_line_is_never_dropped_to_fit(workfile):
    """A line the user tapped Add it on is pinned. If something has to give to
    keep the page, it is never that line."""
    blocks, _, _ = parse_docx(str(workfile))
    added = Op(
        op="insert_after",
        block=block_id(blocks, "Helped refactor"),
        text="Consumed payment events from Kafka topics to update the ledger.",
        claim="added_by_user",
        value=10,
        droppable=False,
    )
    # One deliberately enormous low-value line, so the page certainly spills and
    # dropping exactly that one brings it back. The sample is short enough that
    # a handful of ordinary bullets would still fit.
    filler = Op(
        op="insert_after",
        block=block_id(blocks, "Wrote unit tests"),
        text="Filler that exists only to overflow the page budget. " * 80,
        value=1,
    )

    result = fit(str(workfile), [added, filler], max_pages=1)

    kafka = [a for a in result["applied"] if a.text and "Kafka" in a.text]
    assert kafka and all(a.status != "dropped" for a in kafka)
    assert [a.status for a in result["applied"] if a.text and "Filler" in a.text] == ["dropped"]
    assert result["pages"] == 1, "dropping the filler should have restored the budget"


@needs_renderer
def test_apply_endpoint_returns_a_readable_docx(workfile, tmp_path):
    client = TestClient(app)
    blocks = client.post("/parse", json={"file": b64(workfile)}).json()["blocks"]
    target = next(b["id"] for b in blocks if b["text"].startswith("Worked on backend"))

    response = client.post(
        "/apply",
        json={
            "file": b64(workfile),
            "ops": [{"op": "rephrase", "block": target, "text": "Cut p95 latency to 310 ms.", "value": 9}],
            "max_pages": 1,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["pages"] == 1

    out = tmp_path / "out.docx"
    out.write_bytes(base64.b64decode(body["file"]))
    texts = [para_text(p) for p in Document(str(out)).paragraphs]
    assert "Cut p95 latency to 310 ms." in texts
    assert not any(t.startswith("Worked on backend") for t in texts)


class TestApi:
    def test_health_reports_the_renderer(self):
        body = TestClient(app).get("/health").json()
        assert body["ok"] is True
        assert body["page_counts"] in {"real", "estimated"}

    def test_parse_returns_addressable_blocks(self, workfile):
        body = TestClient(app).post("/parse", json={"file": b64(workfile)}).json()
        assert body["format"] == "docx"
        assert any(b["text"].startswith("Worked on backend") for b in body["blocks"])
        assert all(b["id"].startswith("b") for b in body["blocks"])

    def test_rejects_something_that_is_not_a_docx(self):
        response = TestClient(app).post(
            "/parse", json={"file": base64.b64encode(b"this is not a docx").decode()}
        )
        assert response.status_code == 422

    def test_rejects_bad_base64(self):
        response = TestClient(app).post("/parse", json={"file": "!!!not base64!!!"})
        assert response.status_code == 400

    def test_bearer_token_is_enforced_when_set(self, workfile, monkeypatch):
        monkeypatch.setenv("DOCSVC_TOKEN", "s3cret")
        client = TestClient(app)
        assert client.post("/parse", json={"file": b64(workfile)}).status_code == 401
        assert (
            client.post(
                "/parse",
                json={"file": b64(workfile)},
                headers={"Authorization": "Bearer s3cret"},
            ).status_code
            == 200
        )
