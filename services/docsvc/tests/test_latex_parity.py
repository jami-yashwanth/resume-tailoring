"""The compiled LaTeX template and shared/template.json agree, measured.

shared/template.json is what the web preview (and the drawn fallback) render
from; the compiled PDF is the artifact the user downloads. This suite compiles
a resume through the real path, measures the PDF with PyMuPDF, and replays the
json's box model over the same blocks — so the numbers can never silently
drift apart again (they were hand-kept twice before and did).

The box model, shared with `template-metrics.ts`: each block is a box of
height lines x leading; adjacent boxes are separated by gaps["prev>next"]
(a bullet nested under a role is "bullet2"); a line's baseline sits
f(S, L) = L/2 + S * (asc - (asc + desc) / 2) below its box top, with Roboto's
hhea metrics asc = 1900/2048, desc = 500/2048 — the same arithmetic a browser
does to place text in a line box, which is why the preview can trust it.
"""
import json
import shutil
from pathlib import Path

import pytest

pymupdf = pytest.importorskip("pymupdf")

from app.latex_render import render_latex

needs_tectonic = pytest.mark.skipif(
    shutil.which("tectonic") is None, reason="tectonic not installed"
)

SPEC = json.loads(
    (Path(__file__).resolve().parents[3] / "shared" / "template.json").read_text()
)

ASC, DESC = 1900 / 2048, 500 / 2048


def baseline_in_box(size: float, leading: float) -> float:
    return leading / 2 + size * (ASC - (ASC + DESC) / 2)


BLOCKS = [
    {"kind": "name", "text": "Alex Webb"},
    {"kind": "contact", "text": "555-123-4567 · alex@email.com · linkedin.com/in/alexwebbx"},
    {"kind": "heading", "text": "Summary"},
    {"kind": "paragraph", "text": "Passionate AI/ML engineer with a strong background in deep learning, computer vision, and natural language processing. Skilled in Python and TensorFlow. Excellent problem-solving and research abilities, seeking a challenging role."},
    {"kind": "heading", "text": "Technical Skills"},
    {"kind": "bullet", "text": "Programming Languages: Python, C++, SQL, MATLAB"},
    {"kind": "bullet", "text": "Deep Learning Frameworks: TensorFlow, PyTorch, Keras"},
    {"kind": "heading", "text": "Experience"},
    {"kind": "role", "text": "AI Research Intern\tJune 2022 - Aug 2022"},
    {"kind": "job_title", "text": "DeepMind"},
    {"kind": "bullet", "text": "Conducted research on reinforcement learning algorithms for robotics"},
    {"kind": "bullet", "text": "Implemented and evaluated deep RL models using PyTorch and RLlib that ran long enough to wrap onto a second line of the compiled document for leading measurement"},
    {"kind": "role", "text": "Machine Learning Engineer\tJan 2021 - May 2022"},
    {"kind": "job_title", "text": "Acme AI Solutions"},
    {"kind": "bullet", "text": "Developed and deployed machine learning models for various industries"},
    {"kind": "heading", "text": "Education"},
    {"kind": "role", "text": "Stanford University\tStanford, CA"},
    {"kind": "job_title", "text": "M.S. in Computer Science, Artificial Intelligence"},
    {"kind": "role", "text": "UC Berkeley\tBerkeley, CA"},
    {"kind": "job_title", "text": "B.S. in Electrical Engineering and Computer Science"},
    {"kind": "heading", "text": "Certifications"},
    {"kind": "role", "text": "AWS Certified Machine Learning - Specialty\t2024"},
    {"kind": "role", "text": "TensorFlow Developer Certificate\t2023"},
    {"kind": "heading", "text": "Languages"},
    {"kind": "paragraph", "text": "English, Hindi, Telugu."},
]


def leveled(blocks: list[dict]) -> list[str]:
    """Kinds with bullet depth resolved: a bullet under a role/job_title is
    "bullet2" until the next heading — the same rule the preview applies."""
    out, under_role = [], False
    for block in blocks:
        kind = block["kind"]
        if kind == "heading":
            under_role = False
        elif kind in ("role", "job_title"):
            under_role = True
        out.append("bullet2" if kind == "bullet" and under_role else kind)
    return out


def spec_for(kind: str) -> dict:
    return SPEC["type"]["bullet" if kind == "bullet2" else kind]


def gap(prev: str, kind: str) -> float:
    gaps = SPEC["gaps"]
    return gaps.get(f"{prev}>{kind}", gaps["default"])


def first_line_prefix(block: dict) -> str:
    """What the block's first compiled line starts with, for matching."""
    text = block["text"].split("\t")[0]
    if block["kind"] == "contact":
        # separators are rewritten to pipes on the way in; the first field is
        # the stable part
        text = text.split("·")[0].strip()
    if block["kind"] == "heading":
        text = text.upper()
    if block["kind"] == "bullet":
        text = "• " + text
    return text[:18]


@pytest.fixture(scope="module")
def measured():
    """One compile for the whole module. Returns (page, lines, starts) where
    lines is [(baseline y, x, size, text)] per rendered line and starts[i] is
    the index into lines of BLOCKS[i]'s first line, found by its text."""
    pdf = render_latex(BLOCKS, timeout=300.0)
    doc = pymupdf.open(stream=pdf, filetype="pdf")
    page = doc[0]
    raw = []
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            span = line["spans"][0]
            raw.append(
                (
                    round(span["origin"][1], 2),
                    round(span["origin"][0], 2),
                    round(span["size"], 2),
                    "".join(s["text"] for s in line["spans"]).strip(),
                )
            )
    raw.sort(key=lambda r: (r[0], r[1]))
    lines = []
    for r in raw:
        if lines and abs(lines[-1][0] - r[0]) < 0.5:
            continue
        lines.append(r)

    starts, cursor = [], 0
    for block in BLOCKS:
        prefix = first_line_prefix(block)
        index = next(
            i for i in range(cursor, len(lines)) if lines[i][3].startswith(prefix)
        )
        starts.append(index)
        cursor = index + 1
    return page, lines, starts


def simulate(lines, starts) -> list[float]:
    """Every block's first baseline, in page points, replayed from the spec.
    A block's box grows by one leading per line the PDF actually gave it."""
    kinds = leveled(BLOCKS)
    line_counts = [
        (starts[i + 1] if i + 1 < len(starts) else len(lines)) - starts[i]
        for i in range(len(starts))
    ]
    y = float(SPEC["page"]["margin"])
    prev = None
    baselines = []
    for kind, count in zip(kinds, line_counts):
        spec = spec_for(kind)
        if prev is not None:
            y += gap(prev, kind)
        baselines.append(y + baseline_in_box(spec["size"], spec["leading"]))
        y += spec["leading"] * count
        prev = kind
    return baselines


@needs_tectonic
class TestParity:
    def test_page_box_and_margin(self, measured):
        page, lines, _ = measured
        assert (round(page.rect.width, 2), round(page.rect.height, 2)) == (
            SPEC["page"]["width"],
            SPEC["page"]["height"],
        )
        margin = SPEC["page"]["margin"]
        heading_xs = {
            x for _, x, size, _ in lines if abs(size - SPEC["type"]["heading"]["size"]) < 0.1
        }
        assert heading_xs == {margin}

    def test_font_sizes_match_the_spec(self, measured):
        _, lines, starts = measured
        kinds = leveled(BLOCKS)
        for kind, start in zip(kinds, starts):
            expected = spec_for(kind)["size"]
            actual = lines[start][2]
            assert abs(actual - expected) < 0.05, f"{kind}: {actual} vs spec {expected}"

    def test_indents_match_the_spec(self, measured):
        _, lines, starts = measured
        margin = SPEC["page"]["margin"]
        bullet = SPEC["type"]["bullet"]
        kinds = leveled(BLOCKS)
        expected_x = {
            "bullet": margin + bullet["indent"],
            "bullet2": margin + bullet["indentNested"],
            "role": margin + SPEC["type"]["role"]["indent"],
            "job_title": margin + SPEC["type"]["job_title"]["indent"],
            "heading": margin,
            "paragraph": margin,
        }
        for kind, start in zip(kinds, starts):
            if kind not in expected_x:
                continue
            assert abs(lines[start][1] - expected_x[kind]) < 0.1, (
                f"{kind} starts at x={lines[start][1]}, spec says {expected_x[kind]}"
            )

    def test_dates_sit_flush_with_the_tabular_right_edge(self, measured):
        page, _, _ = measured
        role = SPEC["type"]["role"]
        right = SPEC["page"]["margin"] + role["indent"] + role["width"]
        spans = [
            s
            for b in page.get_text("dict")["blocks"]
            if b["type"] == 0
            for l in b["lines"]
            for s in l["spans"]
        ]
        dates = [s for s in spans if s["text"].strip() in ("2024", "2023", "Stanford, CA")]
        assert dates
        for span in dates:
            assert abs(span["bbox"][2] - right) < 0.5

    def test_within_block_lines_advance_by_the_leading(self, measured):
        _, lines, starts = measured
        kinds = leveled(BLOCKS)
        checked = 0
        for i, (kind, start) in enumerate(zip(kinds, starts)):
            end = starts[i + 1] if i + 1 < len(starts) else len(lines)
            leading = spec_for(kind)["leading"]
            for a, b in zip(range(start, end - 1), range(start + 1, end)):
                delta = lines[b][0] - lines[a][0]
                assert abs(delta - leading) < 0.1, f"{kind} advanced {delta} vs {leading}"
                checked += 1
        assert checked >= 2, "the sample must contain wrapped lines"

    def test_every_block_baseline_matches_the_simulated_box_model(self, measured):
        """The core contract: replaying template.json's leadings and gaps over
        the blocks lands every first baseline where the compiled PDF put it."""
        _, lines, starts = measured
        kinds = leveled(BLOCKS)
        predicted = simulate(lines, starts)
        errors = [
            (kind, round(lines[start][0] - pred, 2))
            for kind, start, pred in zip(kinds, starts, predicted)
        ]
        worst = max(abs(e) for _, e in errors)
        assert worst < 0.5, f"baseline drift up to {worst}pt: {errors}"

    def test_heading_rules_sit_at_the_box_bottom(self, measured):
        page, lines, starts = measured
        rules = sorted(
            item[1].y
            for path in page.get_drawings()
            for item in path["items"]
            if item[0] == "l"
        )
        kinds = leveled(BLOCKS)
        heading = SPEC["type"]["heading"]
        predicted = simulate(lines, starts)
        bottoms = [
            pred - baseline_in_box(heading["size"], heading["leading"]) + heading["leading"]
            for kind, pred in zip(kinds, predicted)
            if kind == "heading"
        ]
        assert len(rules) == len(bottoms)
        for rule_y, bottom in zip(rules, bottoms):
            assert abs(rule_y - bottom) < 0.5

    def test_rule_stroke_matches_the_spec(self, measured):
        page, _, _ = measured
        path = next(p for p in page.get_drawings() if p["items"] and p["items"][0][0] == "l")
        assert abs(path["width"] - SPEC["rule"]["width"]) < 0.05
        assert path["color"] == (0.0, 0.0, 0.0)

    def test_the_compiled_fonts_are_roboto(self, measured):
        page, _, _ = measured
        families = " ".join(f[3] for f in page.get_fonts())
        for face in ("Roboto-Regular", "Roboto-Bold", "Roboto-Italic"):
            assert face in families
