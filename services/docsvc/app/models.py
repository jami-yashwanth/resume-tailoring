"""Wire types for docsvc.

The service is stateless: every request carries the file it operates on. It holds
no credentials but its own bearer token and never talks to the database, so the
only contract that matters is this one.
"""
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Claim(str, Enum):
    """From docs/05-architecture.md. The level decides what wording is allowed,
    and it travels with the operation so the claim log can be written from it."""

    VERIFIED = "verified"          # already in the resume
    REWORDED = "reworded"          # true reframing of existing content
    ADDED_BY_USER = "added_by_user"  # not in the resume; the user tapped Add it


class BlockKind(str, Enum):
    NAME = "name"
    CONTACT = "contact"
    HEADING = "heading"
    ROLE = "role"
    #: The job title under a role. Never parsed out of a file — the web app's
    #: `view.ts` splits a run of role lines into the employer line and this one,
    #: so the two carry different weight. See `shared/template.json`.
    JOB_TITLE = "job_title"
    BULLET = "bullet"
    PARAGRAPH = "paragraph"


class Run(BaseModel):
    """A span of text with one set of formatting.

    Word stores a paragraph as runs, and the formatting that matters lives on
    them, not on the paragraph: the bold "2.1 lakh" inside a sentence, the
    italic dates after a tab. A preview that only carries paragraph text
    silently drops all of it and stops looking like the user's document.
    """

    text: str
    bold: bool = False
    italic: bool = False
    size: float | None = None   # points, when it differs from the paragraph
    color: str | None = None    # "#RRGGBB"
    small_caps: bool = False
    underline: bool = False


class Block(BaseModel):
    """One addressable line of the user's document.

    `id` is positional within a single parse, and apply re-opens the pristine
    original before touching anything, so ids stay valid for the whole
    parse -> plan -> apply cycle. Addressing by id rather than by matching text
    is what stops an edit landing on the wrong line when two bullets start alike.
    """

    id: str
    kind: BlockKind
    text: str
    section: str | None = None
    style: str | None = None
    lines: int = 1
    has_bold: bool = False
    #: Contains a hyperlink. Rewriting such a line run-by-run would drop the
    #: link, so these are left alone until the editor can carry one through.
    has_link: bool = False
    #: Everything the preview needs to look like the file it came from.
    runs: list[Run] = []
    size: float = 11.0          # the paragraph's effective point size
    space_before: float = 0.0   # points of air above
    align: str = "left"         # left | center | right | justify
    #: A rule drawn under the paragraph. Real resumes underline their section
    #: headings this way; it is a paragraph border, not a separate element.
    rule_below: bool = False


class Layout(BaseModel):
    format: Literal["docx", "pdf"]
    pages: int
    fonts: list[str] = []
    blocks: list[Block] = []
    warnings: list[str] = []


class Op(BaseModel):
    """One edit. `value` is match weight x claim strength, assigned by the web
    app's matcher; docsvc only uses it to decide what to drop when the page is
    full. `droppable=False` pins an operation the user explicitly approved."""

    op: Literal["rephrase", "insert_after", "remove"]
    block: str
    text: str | None = None
    alternatives: list[str] = Field(default_factory=list)
    claim: Claim = Claim.REWORDED
    value: float = 1.0
    droppable: bool = True
    reason: str | None = None


class ApplyRequest(BaseModel):
    file: str  # base64 docx
    ops: list[Op]
    max_pages: int | None = None  # None = hold whatever the original had


class AppliedOp(BaseModel):
    block: str
    op: str
    status: Literal["applied", "shortened", "dropped", "not_found", "held"]
    text: str | None = None
    detail: str | None = None


class ApplyResponse(BaseModel):
    file: str  # base64 docx
    pages: int
    pages_before: int
    applied: list[AppliedOp]
    rounds: int
    warnings: list[str] = []


class SkillRowModel(BaseModel):
    label: str | None = None
    items: str


class EntryModel(BaseModel):
    org: str | None = None
    title: str | None = None
    dates: str | None = None
    place: str | None = None
    bullets: list[str] = Field(default_factory=list)
    lines: list[str] = Field(default_factory=list)


class SectionModel(BaseModel):
    heading: str | None = None
    kind: Literal[
        "summary", "experience", "education", "projects",
        "skills", "certifications", "achievements", "other",
    ]
    entries: list[EntryModel] = Field(default_factory=list)
    skills: list[SkillRowModel] = Field(default_factory=list)
    lines: list[str] = Field(default_factory=list)


class Document(BaseModel):
    """The tailored resume as structure, not a flat block list. Mirrors the web
    app's `TemplateDocument` — same field names, nothing renamed."""

    name: str | None = None
    contact: list[str] = Field(default_factory=list)
    sections: list[SectionModel] = Field(default_factory=list)
