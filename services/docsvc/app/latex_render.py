"""The tailored resume compiled through the owner's ATS-safe LaTeX
reference, instead of drawn with PyMuPDF primitives.

This is /render-template's default path (owner's call, 30 Sep 2026), with
template_render as the automatic fallback on any failure — tectonic missing,
compile error, timeout — and REZZ_LATEX_TEMPLATE="false" as the off switch.
Why it exists: a template here is *data* (a .tex file stored verbatim, engine
quirks handled by `compat()` at compile time), not code written twice
(template_render.py + the CSS preview), so future user-uploaded templates are
drop-ins.

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

#: pdfTeX-only lines that abort XeTeX (Tectonic's engine). The template file
#: keeps the owner's lines verbatim — this pass comments them out on the way
#: into the compiler instead, because XeTeX emits Unicode-mapped PDFs natively
#: and the output is identical without them. Full-line anchored so a mention
#: inside a comment is never touched. User-uploaded templates (mostly written
#: against pdfTeX) go through the same pass.
_PDFTEX_ONLY = re.compile(
    r"^[ \t]*(\\input\{glyphtounicode\}|\\pdfgentounicode=1)[ \t]*$", re.MULTILINE
)


def compat(source: str) -> str:
    """The template source with pdfTeX-only lines commented out, byte-identical
    otherwise."""
    return _PDFTEX_ONLY.sub(lambda m: "% [compat: pdfTeX-only] " + m.group().strip(), source)


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

#: Roboto's tex-text mapping would set a typed -- as an en dash (and --- as an
#: em dash). The preview shows the user's literal text and nothing is rewritten
#: behind their back, so consecutive hyphens are broken apart with an empty
#: group. Lone hyphens pass through untouched.
_HYPHEN_PAIR = re.compile(r"-(?=-)")


def escape(text: str) -> str:
    return _HYPHEN_PAIR.sub("-{}", "".join(_ESCAPE.get(ch, ch) for ch in text))


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
    in_section = False    # inside a \resumeSubHeadingList
    in_items = False      # inside a nested bullet list
    in_center = False     # inside the header's {center}
    #: What the outer list's current \item is. Only a role licenses a nested
    #: bullet list under it — a sibling bullet or paragraph does not, or the
    #: second skills item would nest a level deeper than the first (measured
    #: doing exactly that before this existed).
    anchor = None

    def close_items():
        nonlocal in_items
        if in_items:
            out.append(r"\resumeSubHeadingListEnd")
            in_items = False

    def close_section():
        nonlocal in_section, anchor
        close_items()
        if in_section:
            out.append(r"\resumeSubHeadingListEnd")
            in_section = False
        anchor = None

    def close_center():
        nonlocal in_center
        if in_center:
            out.append(r"\end{center}")
            in_center = False

    i = 0
    while i < len(blocks):
        block = blocks[i]
        text = (block.get("text") or "").strip()
        kind = block.get("kind", "paragraph")
        i += 1
        if not text:
            continue

        if kind == "name":
            close_center()
            out.append(r"\begin{center}")
            out.append(rf"  \textbf{{\Huge {escape(text)}}} \\")
            in_center = True

        elif kind == "contact":
            fields = [escape(f) for f in re.split(r"\s*[·|\t]\s*", text) if f.strip()]
            if in_center:
                out.append(rf"  \small {' $|$ '.join(fields)}")
                close_center()
            else:
                out.append(rf"\begin{{center}}\small {' $|$ '.join(fields)}\end{{center}}")

        elif kind == "heading":
            close_center()
            close_section()
            # The list is NOT opened here: the reference sets its Summary as a
            # plain paragraph straight under the heading, so the list waits for
            # the first role/bullet (each opens it on demand).
            out.append(rf"\section{{{escape(text)}}}")

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
                # The owner's preamble stays verbatim and defines no compact
                # variant, so the one-line case sets the reference's own
                # tabular* pattern inline (its two-line \resumeSubheading,
                # minus the italic row and with less to pull back over).
                out.append(
                    "\\vspace{-1pt}\\item\n"
                    "  \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}\n"
                    rf"    \textbf{{{escape(left)}}} & {escape(right)} \\" + "\n"
                    "  \\end{tabular*}\\vspace{-5pt}"
                )
            anchor = "role"

        elif kind == "job_title":
            # A title with no role above it still renders, italic, in place.
            close_items()
            if not in_section:
                out.append(r"\resumeSubHeadingList")
                in_section = True
            out.append(rf"\item \textit{{{escape(text)}}}")
            anchor = "role"

        elif kind == "bullet":
            if not in_section:
                out.append(r"\resumeSubHeadingList")
                in_section = True
            # A nested list is only legal after the outer list has an \item,
            # and only a role's subheading is one bullets belong under: bullets
            # straight under a heading (or after a sibling bullet) stay in the
            # section list itself, at one level, like the reference's skills.
            if not in_items and anchor == "role":
                out.append(r"\resumeSubHeadingList")
                in_items = True
            content = _BULLET_PREFIX.sub("", text)
            out.append(rf"\resumeItem{{\textbullet\ {escape(content)}}}")
            if not in_items:
                anchor = "plain"

        else:  # paragraph
            close_items()
            if in_section:
                out.append(rf"\resumeItem{{{escape(text)}}}")
                anchor = "plain"
            else:
                out.append(escape(text))

    close_center()
    close_section()
    return "\n".join(out)


def render_latex(blocks: list[dict], timeout: float = 60.0) -> bytes:
    """The compiled PDF, or subprocess.CalledProcessError on a failed compile.

    Tectonic caches its support files under the user cache dir after the
    first (network-fetching) run; warm compiles are local-only.
    """
    source = compat(TEMPLATE.read_text()).replace("%%CONTENT%%", blocks_to_latex(blocks))
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
