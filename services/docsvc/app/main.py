"""docsvc — the only service that touches the user's file.

Stateless by design: every request carries its document, nothing is persisted,
and the only secret it holds is its own bearer token. It never reaches the
database and never sees the Claude API key.
"""
import base64
import binascii
import os
import shutil
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from . import render
from .docx_ops import parse_docx
from .fitter import fit
from .models import ApplyRequest, ApplyResponse, Layout

app = FastAPI(title="docsvc", version="0.1.0")


def require_token(authorization: str | None = Header(default=None)) -> None:
    """Locked by a shared bearer token. Unset means local development — the
    service must never be deployed without DOCSVC_TOKEN set."""
    expected = os.environ.get("DOCSVC_TOKEN")
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="bad or missing bearer token")


def _decode(data: str, suffix: str) -> str:
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"file is not valid base64: {exc}") from exc
    if not raw:
        raise HTTPException(status_code=400, detail="file is empty")
    handle = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    handle.write(raw)
    handle.close()
    return handle.name


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "renderer": render.soffice_bin(),
        "page_counts": "real" if render.available() else "estimated",
    }


class ParseRequest(BaseModel):
    file: str  # base64 docx


@app.post("/parse", response_model=Layout, dependencies=[Depends(require_token)])
def parse(request: ParseRequest) -> Layout:
    """Read the user's file into blocks the planner can address by id."""
    path = _decode(request.file, ".docx")
    try:
        blocks, fonts, warnings = parse_docx(path)
    except Exception as exc:  # python-docx raises a grab-bag on malformed files
        raise HTTPException(status_code=422, detail=f"could not read this DOCX: {exc}") from exc

    if render.available():
        pages = render.count_pages(path)
    else:
        pages = 1
        warnings.append("LibreOffice not available; page count is a guess.")

    Path(path).unlink(missing_ok=True)
    return Layout(format="docx", pages=pages, fonts=fonts, blocks=blocks, warnings=warnings)


@app.post("/apply", response_model=ApplyResponse, dependencies=[Depends(require_token)])
def apply(request: ApplyRequest) -> ApplyResponse:
    """Apply the plan and keep it inside the page budget.

    The whole render -> measure -> pay-for-space -> re-render loop runs here
    rather than in the web app, because this is the side that owns the renderer.
    """
    source = _decode(request.file, ".docx")
    try:
        result = fit(source, request.ops, request.max_pages)
        data = Path(result["path"]).read_bytes()
    finally:
        Path(source).unlink(missing_ok=True)

    shutil.rmtree(Path(result["path"]).parent, ignore_errors=True)
    return ApplyResponse(
        file=base64.b64encode(data).decode(),
        pages=result["pages"],
        pages_before=result["pages_before"],
        applied=result["applied"],
        rounds=result["rounds"],
        warnings=result["warnings"],
    )


class ExportRequest(BaseModel):
    file: str  # base64 docx
    format: str = "docx"


@app.post("/export", dependencies=[Depends(require_token)])
def export(request: ExportRequest) -> dict:
    """Hand back the finished file. DOCX is returned as-is — it is already the
    user's own document — and PDF goes through the same renderer."""
    if request.format not in {"docx", "pdf"}:
        raise HTTPException(status_code=400, detail="format must be docx or pdf")
    if request.format == "docx":
        return {"file": request.file, "format": "docx"}

    path = _decode(request.file, ".docx")
    try:
        data = render.to_pdf(path)
    except render.RenderUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    finally:
        Path(path).unlink(missing_ok=True)
    return {"file": base64.b64encode(data).decode(), "format": "pdf"}
