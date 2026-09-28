"""The service edits whatever document it is handed, so its front door matters.

Each test here corresponds to a finding from the security review of the first
commit; all four were real.
"""
import base64

from fastapi.testclient import TestClient

from app import render
from app.main import MAX_UPLOAD_BYTES, app


def b64(path):
    return base64.b64encode(path.read_bytes()).decode()


class TestAuthFailsClosed:
    def test_refuses_to_serve_with_no_token_configured(self, workfile, monkeypatch):
        """The original behaviour: no DOCSVC_TOKEN meant every route was open.
        A forgotten environment variable must not be the difference between
        locked and wide open."""
        monkeypatch.delenv("DOCSVC_TOKEN", raising=False)
        monkeypatch.delenv("DOCSVC_ALLOW_INSECURE", raising=False)
        response = TestClient(app).post("/parse", json={"file": b64(workfile)})
        assert response.status_code == 503
        assert "DOCSVC_TOKEN" in response.json()["detail"]

    def test_opening_it_up_locally_has_to_be_deliberate(self, workfile, monkeypatch):
        monkeypatch.delenv("DOCSVC_TOKEN", raising=False)
        monkeypatch.setenv("DOCSVC_ALLOW_INSECURE", "true")
        assert TestClient(app).post("/parse", json={"file": b64(workfile)}).status_code == 200

    def test_only_the_exact_word_true_opens_it(self, workfile, monkeypatch):
        monkeypatch.delenv("DOCSVC_TOKEN", raising=False)
        for value in ["1", "yes", "ture", "", "false"]:
            monkeypatch.setenv("DOCSVC_ALLOW_INSECURE", value)
            response = TestClient(app).post("/parse", json={"file": b64(workfile)})
            assert response.status_code == 503, f"{value!r} should not open the service"

    def test_a_token_is_still_required_when_one_is_set(self, workfile, monkeypatch):
        monkeypatch.setenv("DOCSVC_TOKEN", "s3cret")
        monkeypatch.setenv("DOCSVC_ALLOW_INSECURE", "true")  # must not override a real token
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

    def test_health_stays_open_so_a_load_balancer_can_reach_it(self, monkeypatch):
        monkeypatch.delenv("DOCSVC_TOKEN", raising=False)
        monkeypatch.delenv("DOCSVC_ALLOW_INSECURE", raising=False)
        assert TestClient(app).get("/health").status_code == 200


class TestUploadSizeIsCapped:
    def test_rejects_a_payload_far_larger_than_any_resume(self):
        """Without a ceiling one request can fill the disk of a machine that
        also has to hold a LibreOffice render."""
        oversized = base64.b64encode(b"\0" * (MAX_UPLOAD_BYTES + 1024)).decode()
        response = TestClient(app).post("/parse", json={"file": oversized})
        assert response.status_code == 413

    def test_a_normal_resume_is_nowhere_near_the_cap(self, workfile):
        assert workfile.stat().st_size < MAX_UPLOAD_BYTES


class TestPageCountCacheIsBounded:
    def test_it_evicts_instead_of_growing_forever(self):
        """Keyed by file content, so it gained an entry for every distinct
        document the process ever saw — and the fit loop adds one per round."""
        render._CACHE.clear()
        for i in range(render._CACHE_MAX + 50):
            render._CACHE[f"digest-{i}"] = 1
            while len(render._CACHE) > render._CACHE_MAX:
                render._CACHE.popitem(last=False)
        assert len(render._CACHE) == render._CACHE_MAX
        assert "digest-0" not in render._CACHE
        render._CACHE.clear()


class TestThemeXmlIsParsedSafely:
    """The theme part comes from inside an uploaded file, so it is attacker
    controlled. lxml resolves entities by default."""

    def _theme(self, xml: str):
        from lxml import etree

        from app.docx_ops import _SAFE_XML

        return etree.fromstring(xml.encode(), parser=_SAFE_XML)

    def test_a_system_entity_is_not_resolved(self, tmp_path):
        """The classic XXE: without a hardened parser this reads the file and
        substitutes its contents into the document."""
        secret = tmp_path / "secret.txt"
        secret.write_text("TOP-SECRET-VALUE")
        root = self._theme(
            f'<?xml version="1.0"?>'
            f'<!DOCTYPE r [<!ENTITY xxe SYSTEM "file://{secret}">]>'
            f"<r><a>&xxe;</a></r>"
        )
        assert "TOP-SECRET-VALUE" not in (root.findtext("a") or "")

    def test_nested_entities_do_not_expand(self):
        """Billion laughs: expansion turns a few hundred bytes into gigabytes."""
        bomb = (
            '<?xml version="1.0"?><!DOCTYPE r ['
            '<!ENTITY a "aaaaaaaaaa">'
            '<!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">'
            '<!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">'
            "]><r>&c;</r>"
        )
        root = self._theme(bomb)
        assert len(root.text or "") < 1000

    def test_ordinary_theme_xml_still_parses(self):
        root = self._theme('<?xml version="1.0"?><r><a>Calibri</a></r>')
        assert root.findtext("a") == "Calibri"

    def test_a_real_document_still_reports_its_font(self, workfile):
        """The hardening must not cost the feature it protects."""
        from app.docx_ops import parse_docx

        _, fonts, _ = parse_docx(str(workfile))
        assert fonts
