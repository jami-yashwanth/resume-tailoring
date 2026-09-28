import shutil
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
SAMPLE = REPO / "prototypes" / "in-place-editing" / "samples" / "priya_resume.docx"


@pytest.fixture(scope="session")
def sample_path() -> Path:
    if not SAMPLE.exists():
        pytest.skip(
            f"{SAMPLE} missing — run "
            "prototypes/in-place-editing/.venv/bin/python make_samples.py"
        )
    return SAMPLE


@pytest.fixture
def workfile(sample_path, tmp_path) -> Path:
    """A throwaway copy, so a test can never damage the sample."""
    dest = tmp_path / "resume.docx"
    shutil.copyfile(sample_path, dest)
    return dest
