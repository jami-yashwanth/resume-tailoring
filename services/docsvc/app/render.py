"""Real page counts, via LibreOffice headless.

docs/05-architecture.md calls this out specifically: without a renderer, DOCX
page fit is only an estimate, and "swap first, grow last" needs a number it can
trust. LibreOffice and Word lay out slightly differently, so treat the count as
accurate to within a safety margin rather than as gospel.
"""
import hashlib
import os
import shutil
import subprocess
import tempfile
from collections import OrderedDict
from pathlib import Path

import pymupdf

#: Bounded on purpose. Keyed by file content, this grows by one entry per
#: distinct document the service ever sees — unbounded in a long-running
#: process, and the fit loop adds an entry per round.
_CACHE_MAX = 256
_CACHE: "OrderedDict[str, int]" = OrderedDict()


class RenderUnavailable(RuntimeError):
    """LibreOffice isn't installed. Callers fall back to line estimates."""


def soffice_bin() -> str | None:
    explicit = os.environ.get("SOFFICE_BIN")
    if explicit and Path(explicit).exists():
        return explicit
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    for guess in (
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        str(Path.home() / "Applications/LibreOffice.app/Contents/MacOS/soffice"),
        "/usr/bin/soffice",
        "/usr/lib/libreoffice/program/soffice",
    ):
        if Path(guess).exists():
            return guess
    return None


def available() -> bool:
    return soffice_bin() is not None


def to_pdf(docx_path: str, timeout: int = 120) -> bytes:
    """Convert a DOCX to PDF and return the bytes."""
    binary = soffice_bin()
    if binary is None:
        raise RenderUnavailable("LibreOffice not found; set SOFFICE_BIN")

    with tempfile.TemporaryDirectory() as workdir:
        # Each call gets its own user profile. Without this, two conversions at
        # once silently collide on the shared default profile and one returns
        # nothing.
        profile = Path(workdir) / "profile"
        result = subprocess.run(
            [
                binary,
                f"-env:UserInstallation=file://{profile}",
                "--headless",
                "--norestore",
                "--convert-to",
                "pdf",
                "--outdir",
                workdir,
                docx_path,
            ],
            capture_output=True,
            timeout=timeout,
        )
        produced = Path(workdir) / (Path(docx_path).stem + ".pdf")
        if not produced.exists():
            raise RenderUnavailable(
                f"conversion produced nothing (exit {result.returncode}): "
                f"{result.stderr.decode(errors='replace')[:300]}"
            )
        return produced.read_bytes()


def count_pages(docx_path: str) -> int:
    """Page count as LibreOffice lays the file out. Cached on file content, so
    the fit loop pays once per distinct document state."""
    digest = hashlib.sha256(Path(docx_path).read_bytes()).hexdigest()
    if digest in _CACHE:
        _CACHE.move_to_end(digest)
        return _CACHE[digest]
    with pymupdf.open(stream=to_pdf(docx_path), filetype="pdf") as doc:
        pages = doc.page_count
    _CACHE[digest] = pages
    while len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)
    return pages


def count_pages_pdf(data: bytes) -> int:
    with pymupdf.open(stream=data, filetype="pdf") as doc:
        return doc.page_count
