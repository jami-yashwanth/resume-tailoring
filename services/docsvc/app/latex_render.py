"""SPIKE (29 Sep 2026): the tailored resume compiled through the owner's
ATS-safe LaTeX reference, instead of drawn with PyMuPDF primitives.

Not wired to any endpoint. The open question this answers: can a template be
*data* (a .tex file) rather than code written twice (template_render.py + the
CSS preview), so that future templates are drop-ins? See the decision log
before promoting this: the preview/pagination story is the unpaid cost.

Every user string goes through `escape()` — resume text is attacker-supplied
input to the TeX engine. Tectonic runs with shell-escape off by default, so a
resume containing \\input{/etc/passwd} renders as literal text, not a file
read; escaping is still mandatory for correctness (& % $ # _ { } ~ ^ \\).
"""
import re
import subprocess
import tempfile
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parents[1] / "templates" / "rezz.tex"

_ESCAPE = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

_BULLET_PREFIX = re.compile(r"^[•◦▪‣·\-*]+\s*")


def escape(text: str) -> str:
    return "".join(_ESCAPE.get(ch, ch) for ch in text)


def _split_role(text: str) -> tuple[str, str]:
    left, _, right = text.partition("\t")
    return left.strip(), right.strip()


def blocks_to_latex(blocks: list[dict]) -> str:
    """The (kind, text) pairs as the template's macro calls.

    State machine over the same kinds `render_template` consumes: a heading
    opens a \\resumeSubHeadingList, a role becomes a \\resumeSubheading whose
    second line is the following job_title, bullets nest one level deeper.
    """
    out: list[str] = []
    in_section = False   # inside a \resumeSubHeadingList
    in_items = False     # inside a nested bullet list

    def close_items():
        nonlocal in_items
        if in_items:
            out.append(r"\resumeSubHeadingListEnd")
            in_items = False

    def close_section():
        nonlocal in_section
        close_items()
        if in_section:
            out.append(r"\resumeSubHeadingListEnd")
            in_section = False

    i = 0
    while i < len(blocks):
        block = blocks[i]
        text = (block.get("text") or "").strip()
        kind = block.get("kind", "paragraph")
        i += 1
        if not text:
            continue

        if kind == "name":
            out.append(r"\begin{center}")
            out.append(rf"  \textbf{{\Huge {escape(text)}}} \\")

        elif kind == "contact":
            fields = [escape(f) for f in re.split(r"\s*[·|\t]\s*", text) if f.strip()]
            out.append(rf"  \small {' $|$ '.join(fields)}")
            out.append(r"\end{center}")

        elif kind == "heading":
            close_section()
            out.append(rf"\section{{{escape(text)}}}")
            out.append(r"\resumeSubHeadingList")
            in_section = True

        elif kind == "role":
            close_items()
            if not in_section:
                out.append(r"\resumeSubHeadingList")
                in_section = True
            left, right = _split_role(text)
            # The reference's second line is the italic job title; take the
            # next block when that is what it is.
            title = ""
            if i < len(blocks) and blocks[i].get("kind") == "job_title":
                title = (blocks[i].get("text") or "").strip()
                i += 1
            if title:
                out.append(
                    rf"\resumeSubheading{{{escape(left)}}}{{{escape(right)}}}{{{escape(title)}}}{{}}"
                )
            else:
                out.append(rf"\resumeSubheadingCompact{{{escape(left)}}}{{{escape(right)}}}")

        elif kind == "job_title":
            # A title with no role above it still renders, italic, in place.
            close_items()
            if not in_section:
                out.append(r"\resumeSubHeadingList")
                in_section = True
            out.append(rf"\item \textit{{{escape(text)}}}")

        elif kind == "bullet":
            if not in_section:
                out.append(r"\resumeSubHeadingList")
                in_section = True
            if not in_items:
                out.append(r"\resumeSubHeadingList")
                in_items = True
            content = _BULLET_PREFIX.sub("", text)
            out.append(rf"\resumeItem{{\textbullet\ {escape(content)}}}")

        else:  # paragraph
            close_items()
            if in_section:
                out.append(rf"\resumeItem{{{escape(text)}}}")
            else:
                out.append(escape(text))

    close_section()
    return "\n".join(out)


def render_latex(blocks: list[dict], timeout: float = 60.0) -> bytes:
    """The compiled PDF, or subprocess.CalledProcessError on a failed compile.

    Tectonic caches its support files under the user cache dir after the
    first (network-fetching) run; warm compiles are local-only.
    """
    source = TEMPLATE.read_text().replace("%%CONTENT%%", blocks_to_latex(blocks))
    with tempfile.TemporaryDirectory() as tmp:
        tex = Path(tmp) / "resume.tex"
        tex.write_text(source)
        subprocess.run(
            ["tectonic", "--outdir", tmp, str(tex)],
            check=True,
            capture_output=True,
            timeout=timeout,
        )
        return (Path(tmp) / "resume.pdf").read_bytes()
