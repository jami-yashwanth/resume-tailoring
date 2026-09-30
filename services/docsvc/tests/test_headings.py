"""The all-caps heading rule both parsers share.

A short line in capitals is how most resumes set a section heading — and also
how they set a grade, an acronym list or a certification code. "CGPA: 8.38" is
all capitals as far as `str.isupper()` is concerned, and it was drawn in the
template as a section of its own. A heading names a section; it does not carry
a value.
"""
import pymupdf
import pytest

from app.headings import looks_like_caps_heading
from app.models import BlockKind
from app.pdf_ops import parse_pdf


@pytest.mark.parametrize(
    "text",
    ["EDUCATION", "WORK EXPERIENCE", "SKILLS & TOOLS", "PROJECTS:", "CERTIFICATIONS AND AWARDS"],
)
def test_section_names_in_capitals_are_headings(text):
    assert looks_like_caps_heading(text)


@pytest.mark.parametrize(
    "text",
    [
        "CGPA: 8.38",
        "GPA 3.9/4.0",
        "SGPA: 9.1",
        "AWS, GCP, SQL",
        "B.TECH",
        "AWS CERTIFIED SOLUTIONS ARCHITECT - SAA-C03",
        "PERCENTAGE: 92%",
        "Education",  # not capitals at all: left to the bold/size rule
    ],
)
def test_values_codes_and_lists_in_capitals_are_not(text):
    assert not looks_like_caps_heading(text)


def test_a_grade_line_in_capitals_stays_inside_its_section(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((72, 72), "Priya Sharma", fontsize=16, fontname="hebo")
    page.insert_text((72, 95), "priya@example.com · Bengaluru", fontsize=10)
    page.insert_text((72, 125), "EDUCATION", fontsize=11)
    # Bold, as the degree line is in the resume this was reported against.
    page.insert_text((72, 145), "BTech, Computer Science Engineering", fontsize=10, fontname="hebo")
    page.insert_text((72, 165), "CGPA: 8.38", fontsize=10)
    page.insert_text((72, 195), "PROJECTS", fontsize=11)
    path = tmp_path / "resume.pdf"
    path.write_bytes(doc.tobytes())
    doc.close()

    blocks, _, _, _ = parse_pdf(str(path))
    by_text = {b.text: b for b in blocks}

    assert by_text["CGPA: 8.38"].kind is not BlockKind.HEADING
    assert by_text["CGPA: 8.38"].section == "EDUCATION"
    assert [b.text for b in blocks if b.kind is BlockKind.HEADING] == ["EDUCATION", "PROJECTS"]


def test_a_bold_grade_set_at_heading_size_is_not_a_heading(tmp_path):
    """The second heading rule — bold and noticeably larger than the body —
    caught the same line when the resume set its grade at heading size."""
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((72, 72), "Jami Yashwanth", fontsize=20, fontname="hebo")
    page.insert_text((72, 95), "jami@example.com | Hyderabad", fontsize=10)
    page.insert_text((72, 125), "Education", fontsize=13, fontname="hebo")
    page.insert_text((72, 145), "BTech, Computer Science Engineering", fontsize=10, fontname="hebo")
    page.insert_text((72, 165), "CGPA: 8.38", fontsize=13, fontname="hebo")
    page.insert_text((72, 195), "Projects", fontsize=13, fontname="hebo")
    page.insert_text((72, 215), "Built a Discord bot for 150+ coding contests.", fontsize=10)
    page.insert_text((72, 235), "Deployed it on AWS EC2 behind NGINX.", fontsize=10)
    path = tmp_path / "resume.pdf"
    path.write_bytes(doc.tobytes())
    doc.close()

    blocks, _, _, _ = parse_pdf(str(path))
    assert [b.text for b in blocks if b.kind is BlockKind.HEADING] == ["Education", "Projects"]
    assert next(b for b in blocks if b.text == "CGPA: 8.38").section == "Education"
