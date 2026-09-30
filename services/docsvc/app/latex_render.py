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

# `document_to_blocks` moved to template_render (the fallback is its only
# consumer now); re-exported until Task 5 deletes this module.
from .template_render import _BULLET_PREFIX, _items, document_to_blocks  # noqa: F401

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


def _contact_fields(text: str) -> list[str]:
    return [escape(f) for f in re.split(r"\s*[·|\t]\s*", text) if f.strip()]


def _section_items(items) -> list[str]:
    """Loose section lines in order: consecutive bullets share one list (as
    the flat path's bullets under a heading do), a plain line is a paragraph
    of body text, blank-line separated, with any open list closed first."""
    out: list[str] = []
    in_list = False
    for item in _items(items):
        if item["bullet"]:
            if not in_list:
                out.append(r"\resumeSubHeadingList")
                in_list = True
            out.append(rf"\resumeItem{{\textbullet\ {escape(item['text'])}}}")
        else:
            if in_list:
                out.append(r"\resumeSubHeadingListEnd")
                in_list = False
            out.append(escape(item["text"]) + "\n")
    if in_list:
        out.append(r"\resumeSubHeadingListEnd")
    return out


def _entry_to_latex(entry: dict) -> list[str]:
    """One entry as macro calls, or nothing when it has no content at all."""
    org, title = entry.get("org"), entry.get("title")
    dates, place = entry.get("dates"), entry.get("place")
    items = _items(entry.get("items"))
    out: list[str] = []

    if title or place:
        out.append(
            rf"\resumeSubheading{{{escape(org or '')}}}{{{escape(dates or '')}}}"
            rf"{{{escape(title or '')}}}{{{escape(place or '')}}}"
        )
    elif org or dates:
        # Same inline tabular as blocks_to_latex's one-line role.
        out.append(
            "\\vspace{-1pt}\\item\n"
            "  \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}\n"
            rf"    \textbf{{{escape(org or '')}}} & {escape(dates or '')} \\" + "\n"
            "  \\end{tabular*}\\vspace{-5pt}"
        )
    elif items:
        out.append(r"\item")  # content with no header still needs its own item

    if items:
        # In the file's order: a "Tech: ..." line after the bullets stays there.
        out.append(r"\resumeSubHeadingList")
        for item in items:
            text = escape(item["text"])
            out.append(rf"\resumeItem{{\textbullet\ {text}}}" if item["bullet"] else rf"\resumeItem{{{text}}}")
        out.append(r"\resumeSubHeadingListEnd")
    return out


def document_to_latex(doc: dict) -> str:
    """The structured document as the template's macro calls.

    No state machine: the structure is already known, so each section emits
    its heading, the lines before its first entry, its entries, skill rows,
    and the loose lines after, in turn.
    """
    out: list[str] = []
    name = (doc.get("name") or "").strip()
    # Every contact string's fields on one line, as the reference sets it.
    contact = [f for c in doc.get("contact") or [] for f in _contact_fields(c)]
    if name or contact:
        out.append(r"\begin{center}")
        if name:
            out.append(rf"  \textbf{{\Huge {escape(name)}}} \\")
        if contact:
            out.append(rf"  \small {' $|$ '.join(contact)}")
        out.append(r"\end{center}")

    for section in doc.get("sections") or []:
        if section.get("heading"):
            out.append(rf"\section{{{escape(section['heading'])}}}")

        out.extend(_section_items(section.get("lead")))

        entries = [e for e in (_entry_to_latex(e) for e in section.get("entries") or []) if e]
        if entries:
            out.append(r"\resumeSubHeadingList")
            for e in entries:
                out.extend(e)
            out.append(r"\resumeSubHeadingListEnd")

        rows = [r for r in section.get("skills") or [] if (r.get("items") or "").strip()]
        if rows:
            out.append(r"\resumeSubHeadingList")
            for row in rows:
                items = escape(row["items"].strip())
                if row.get("label"):
                    out.append(rf"\item \small{{\textbf{{{escape(row['label'])}}}{{: {items}}}}}")
                else:
                    out.append(rf"\item \small{{{items}}}")
            out.append(r"\resumeSubHeadingListEnd")

        out.extend(_section_items(section.get("items")))
    return "\n".join(out).rstrip("\n")


def render_latex_source(body: str, timeout: float = 60.0) -> bytes:
    """The compiled PDF for a LaTeX body set into the template, or
    subprocess.CalledProcessError on a failed compile.

    Tectonic caches its support files under the user cache dir after the
    first (network-fetching) run; warm compiles are local-only.
    """
    source = compat(TEMPLATE.read_text()).replace("%%CONTENT%%", body)
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


def render_latex(blocks: list[dict], timeout: float = 60.0) -> bytes:
    return render_latex_source(blocks_to_latex(blocks), timeout)


def render_latex_document(doc: dict, timeout: float = 60.0) -> bytes:
    return render_latex_source(document_to_latex(doc), timeout)
