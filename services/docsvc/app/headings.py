"""The all-caps heading rule, shared by the PDF and DOCX parsers.

Capitals alone were the rule until 30 Sep 2026, and `str.isupper()` is true for
any string whose letters are all capitals — so "CGPA: 8.38" came back as a
section heading and the template drew it as one, with its own rule under it.

A section heading names a section. It carries no value, so a line with a digit,
a colon with something after it, a comma-separated list or an abbreviation's
interior full stop is content set in capitals, not a heading. This is still a
guess from text alone; the web app's structure pass (`src/lib/tailor/structure.ts`)
reads the whole document with Claude and has the final word.
"""
import re

_MAX_LENGTH = 40


def carries_a_value(text: str) -> bool:
    """True for a line that states something rather than naming a section: a
    digit, a colon with something after it, a comma-separated list, or an
    abbreviation's interior full stop. Both heading rules check this, because a
    grade set bold at heading size is still a grade."""
    text = text.strip()
    if re.search(r"\d", text):
        return True
    # "SKILLS:" is a heading with a trailing colon; "CGPA: 8.38" is a label
    # and its value.
    if ":" in text.rstrip(":"):
        return True
    if "," in text:
        return True
    # "B.TECH", "U.S.A." — an abbreviation, not a section name.
    return bool(re.search(r"\.\S", text))


def looks_like_caps_heading(text: str) -> bool:
    text = text.strip()
    if not text or len(text) >= _MAX_LENGTH or not text.isupper():
        return False
    return not carries_a_value(text)
