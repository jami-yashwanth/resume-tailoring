"""Page fitting: "swap first, grow last".

The rule from docs/05-architecture.md is that the page count never grows unless
the user allowed it. So the loop is: apply everything, measure, and if it spilled,
pay for the space in the least visible way available — shorten a rewrite before
dropping it, drop the least valuable change before touching anything else — then
measure again. Three rounds, then stop and say so rather than keep cutting.

Fonts are never shrunk. Nothing here touches size.
"""
import shutil
import tempfile
from pathlib import Path

from docx import Document

from . import render
from .docx_ops import apply_op, resolve_blocks
from .models import AppliedOp, Op

MAX_ROUNDS = 3


def _order(ops: list[Op]) -> list[Op]:
    """User-approved work is never sacrificed to fit; after that, most valuable
    first so the tail is what gets dropped."""
    return sorted(ops, key=lambda o: (o.droppable, -o.value))


def _write_once(
    source: str,
    ops: list[Op],
    shortened: dict[int, str],
    dropped: set[int],
    dest: str,
) -> list[AppliedOp]:
    """Build one candidate document from the pristine original."""
    shutil.copyfile(source, dest)
    doc = Document(dest)
    live = [(i, op) for i, op in enumerate(ops) if i not in dropped]
    targets = resolve_blocks(doc, [op for _, op in live])

    applied: list[AppliedOp] = []
    for i, op in live:
        text = shortened.get(i, op.text)
        status, detail = apply_op(
            doc, op.model_copy(update={"text": text}), targets.get(op.block)
        )
        applied.append(
            AppliedOp(
                block=op.block,
                op=op.op,
                status="shortened" if (i in shortened and status == "applied") else status,
                text=text,
                detail=detail,
            )
        )
    doc.save(dest)
    return applied


def fit(source: str, ops: list[Op], max_pages: int | None) -> dict:
    """Apply `ops` to `source`, keeping the result within the page budget."""
    ops = _order(ops)
    warnings: list[str] = []

    if render.available():
        pages_before = render.count_pages(source)
    else:
        pages_before = 1
        warnings.append(
            "LibreOffice not available, so page count is unverified. "
            "Install it or set SOFFICE_BIN before trusting the fit."
        )

    budget = max_pages or pages_before
    shortened: dict[int, str] = {}
    dropped: set[int] = set()

    workdir = tempfile.mkdtemp(prefix="docsvc-fit-")
    dest = str(Path(workdir) / "candidate.docx")

    rounds = 0
    applied = _write_once(source, ops, shortened, dropped, dest)
    pages = render.count_pages(dest) if render.available() else pages_before

    while render.available() and pages > budget and rounds < MAX_ROUNDS:
        rounds += 1

        # Cheapest currency first: a shorter wording of a change we are keeping.
        candidate = next(
            (
                i
                for i, op in enumerate(ops)
                if i not in dropped and i not in shortened and op.alternatives
            ),
            None,
        )
        if candidate is not None:
            shortened[candidate] = ops[candidate].alternatives[0]
        else:
            # Then the least valuable droppable change. Never a pinned one.
            candidate = next(
                (
                    i
                    for i in reversed(range(len(ops)))
                    if i not in dropped and ops[i].droppable
                ),
                None,
            )
            if candidate is None:
                warnings.append(
                    "Everything left is pinned, so the page grew. Ask the user "
                    "whether to allow another page."
                )
                break
            dropped.add(candidate)

        applied = _write_once(source, ops, shortened, dropped, dest)
        pages = render.count_pages(dest)

    for i in dropped:
        applied.append(
            AppliedOp(
                block=ops[i].block,
                op=ops[i].op,
                status="dropped",
                text=ops[i].text,
                detail="removed to keep the page count",
            )
        )

    if pages > budget:
        warnings.append(
            f"Still {pages} pages against a budget of {budget} after {rounds} rounds. "
            "Ask the user before growing the document."
        )

    return {
        "path": dest,
        "pages": pages,
        "pages_before": pages_before,
        "applied": applied,
        "rounds": rounds,
        "warnings": warnings,
    }
