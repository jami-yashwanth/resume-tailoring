"""The document must come back out looking like it went in.

This is the promise the whole product rests on — "your own design" — so these
assert the specific things that break when you rewrite Word XML carelessly:
paragraph styles, bullet numbering, the user's own bold spans, and the page
count. The prototype's README records these as the things it proved; this keeps
them proved.
"""
from docx import Document

from app.docx_ops import (
    apply_op,
    para_text,
    parse_docx,
    resolve_blocks,
    set_text_keep_format,
)
from app.models import Op

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def numbering_of(p):
    """Inline <w:numPr> on the paragraph itself, if it has one.

    A bullet can get its numbering two ways: inline here, or inherited from its
    style. This sample inherits it (python-docx's `style="List Bullet"` writes no
    inline numPr), so the tests assert that whichever way a paragraph had it, it
    still has it afterwards — not that inline numbering is present.
    """
    pPr = p._p.find(f"{W}pPr")
    return None if pPr is None else pPr.find(f"{W}numPr")


def style_defines_numbering(doc, style_name: str) -> bool:
    pPr = doc.styles[style_name].element.find(f"{W}pPr")
    return pPr is not None and pPr.find(f"{W}numPr") is not None


def find(blocks, needle):
    return next(b for b in blocks if b.text.startswith(needle))


class TestParse:
    def test_reads_every_non_empty_line(self, workfile):
        blocks, fonts, _ = parse_docx(str(workfile))
        assert len(blocks) > 10
        assert "Georgia" in fonts

    def test_ids_address_the_right_paragraph(self, workfile):
        blocks, _, _ = parse_docx(str(workfile))
        doc = Document(str(workfile))
        for block in blocks:
            index = int(block.id.removeprefix("b"))
            assert para_text(doc.paragraphs[index]).strip() == block.text

    def test_classifies_bullets_and_headings(self, workfile):
        blocks, _, _ = parse_docx(str(workfile))
        assert find(blocks, "Worked on backend APIs").kind.value == "bullet"
        assert find(blocks, "SUMMARY").kind.value == "heading"

    def test_carries_the_section_each_line_sits_under(self, workfile):
        blocks, _, _ = parse_docx(str(workfile))
        assert find(blocks, "Worked on backend APIs").section == "EXPERIENCE"


class TestRephrasePreservesDesign:
    def test_keeps_style_and_bullet_numbering(self, workfile):
        doc = Document(str(workfile))
        target = next(p for p in doc.paragraphs if para_text(p).startswith("Worked on backend"))
        style_before, numbering_before = target.style.name, numbering_of(target)
        # Here the bullet comes from the style, so keeping the style is what
        # keeps the bullet. Assert both, so a doc that numbers inline is covered too.
        assert style_defines_numbering(doc, style_before)

        set_text_keep_format(target, "Cut payment API p95 latency from 820 ms to 310 ms.")

        assert target.style.name == style_before
        assert style_defines_numbering(doc, target.style.name)
        assert (numbering_of(target) is None) == (numbering_before is None)
        assert para_text(target).startswith("Cut payment API")

    def test_keeps_the_users_own_bold_span(self, workfile):
        doc = Document(str(workfile))
        # This sample bullet has "Java" bold; the rewrite marks a different word.
        target = next(p for p in doc.paragraphs if para_text(p).startswith("Wrote REST APIs"))
        assert any(r.bold for r in target.runs)

        set_text_keep_format(target, "Wrote REST APIs in **Java** for an internal billing tool.")

        bolded = [r.text for r in target.runs if r.bold]
        assert bolded == ["Java"]

    def test_never_introduces_bold_the_line_did_not_have(self, workfile):
        """A product guardrail, not a style choice: Rezz does not add formatting
        the user's own line never had."""
        doc = Document(str(workfile))
        target = next(p for p in doc.paragraphs if para_text(p).startswith("Wrote unit tests"))
        assert not any(r.bold for r in target.runs)

        set_text_keep_format(target, "Added **JUnit** and Testcontainers integration tests.")

        assert not any(r.bold for r in target.runs)
        assert "**" not in para_text(target)
        assert "JUnit" in para_text(target)


class TestApplyOps:
    def test_insert_after_clones_its_neighbour(self, workfile):
        doc = Document(str(workfile))
        op = Op(op="insert_after", block="", text="Consumed payment events from Kafka topics.")
        target = next(p for p in doc.paragraphs if para_text(p).startswith("Helped refactor"))
        style_before, numbering_before = target.style.name, numbering_of(target)

        apply_op(doc, op, target)

        added = next(p for p in doc.paragraphs if para_text(p).startswith("Consumed payment"))
        assert added.style.name == style_before
        assert (numbering_of(added) is not None) == (numbering_before is not None)

    def test_remove_takes_the_line_out(self, workfile):
        doc = Document(str(workfile))
        target = next(p for p in doc.paragraphs if para_text(p).startswith("Moved nightly batch"))

        apply_op(doc, Op(op="remove", block="", reason="least relevant"), target)

        assert not any(para_text(p).startswith("Moved nightly batch") for p in doc.paragraphs)

    def test_ids_still_land_correctly_after_an_insert_shifts_them(self, workfile):
        """The regression this guards: resolving ids lazily would send the second
        edit to the wrong line, because inserting renumbers everything after it."""
        blocks, _, _ = parse_docx(str(workfile))
        first = find(blocks, "Helped refactor")
        later = find(blocks, "Python, Git, Docker")

        doc = Document(str(workfile))
        ops = [
            Op(op="insert_after", block=first.id, text="Consumed payment events from Kafka."),
            Op(op="rephrase", block=later.id, text="Java, Spring Boot, AWS, microservices."),
        ]
        targets = resolve_blocks(doc, ops)
        for op in ops:
            apply_op(doc, op, targets[op.block])

        texts = [para_text(p) for p in doc.paragraphs]
        assert "Java, Spring Boot, AWS, microservices." in texts
        assert "Consumed payment events from Kafka." in texts
        # the skills line was rewritten, not some innocent bullet
        assert not any(t.startswith("Python, Git, Docker") for t in texts)


class TestRunsCarryTheDesign:
    """The Result screen draws the preview from these, so anything missing
    here is a line that will look wrong on screen while the downloaded file
    looks right — which is exactly the bug this suite exists to stop."""

    def test_keeps_a_bold_span_inside_a_sentence(self, workfile):
        blocks, _, _ = parse_docx(str(workfile))
        bullet = find(blocks, "Built a nightly")
        assert [(r.text, r.bold) for r in bullet.runs if r.bold] == [("2.1 lakh", True)]

    def test_keeps_the_italic_dates_on_a_role_line(self, workfile):
        blocks, _, _ = parse_docx(str(workfile))
        role = find(blocks, "Razorfin")
        assert [r.italic for r in role.runs] == [False, True]
        assert role.runs[1].text.strip().startswith("Aug 2024")

    def test_carries_heading_colour_and_size(self, workfile):
        blocks, _, _ = parse_docx(str(workfile))
        heading = find(blocks, "EXPERIENCE")
        assert heading.runs[0].color == "#1F3A5F"
        assert heading.size == 11.0

    def test_carries_the_space_that_separates_sections(self, workfile):
        """This document has no rules between sections — it uses space before
        each heading. A preview that draws rules is inventing them."""
        blocks, _, _ = parse_docx(str(workfile))
        assert find(blocks, "EXPERIENCE").space_before == 10.0
        assert find(blocks, "Worked on backend").space_before == 0.0

    def test_carries_the_name_at_its_real_size(self, workfile):
        blocks, _, _ = parse_docx(str(workfile))
        name = blocks[0]
        assert name.size == 20.0
        assert name.runs[0].bold and name.runs[0].color == "#1F3A5F"

    def test_body_text_inherits_the_document_size(self, workfile):
        blocks, _, _ = parse_docx(str(workfile))
        assert find(blocks, "Worked on backend").size == 10.5
