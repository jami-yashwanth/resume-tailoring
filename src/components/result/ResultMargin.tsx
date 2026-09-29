"use client";

import { useMarginAnchors } from "@/lib/useMarginAnchors";
import type { PlannedOp } from "@/lib/tailor/types";
import { MARK_LABEL, type RenderedLine } from "@/lib/tailor/view";

/**
 * The margin — the corrected galley proof, and where this design spends its
 * boldness. Every mark is joined to the line it describes by a short rule, and
 * every mark is attributable: it says what changed and which of the user's own
 * lines it came from.
 *
 * Positions come from the lines themselves via useMarginAnchors, because fixed
 * offsets drift the moment any copy above them changes length.
 */

const TONE: Record<string, { text: string; rule: string }> = {
  reworded: { text: "text-ink", rule: "bg-line-strong" },
  reverted: { text: "text-ink-muted", rule: "bg-line-strong" },
  pending: { text: "text-gap", rule: "bg-gap" },
  added: { text: "text-verified", rule: "bg-verified" },
  removed: { text: "text-ink-muted", rule: "bg-line-strong" },
};

export function ResultMargin({
  lines,
  operations,
  activeOpId,
  onSelect,
  children,
}: {
  lines: RenderedLine[];
  operations: PlannedOp[];
  activeOpId: string | null;
  onSelect: (opId: string | null) => void;
  /** The open popover, anchored to its line. */
  children?: React.ReactNode;
}) {
  const ref = useMarginAnchors<HTMLDivElement>();
  const marked = lines.filter((line) => line.state !== "unchanged" && line.opId);

  return (
    <aside ref={ref} aria-label="What changed and why" className="relative font-mark">
      {marked.map((line) => {
        const state = line.state as keyof typeof MARK_LABEL;
        const tone = TONE[state];
        const op = operations.find((o) => o.id === line.opId);
        const note =
          state === "pending"
            ? "not in your resume"
            : state === "added"
              ? "you added this"
              : state === "removed"
                ? (op?.reason ?? "least relevant here")
                : state === "reverted"
                  ? "your own words"
                  : op?.evidence.length
                    ? `from your line${op.evidence.length > 1 ? "s" : ""}`
                    : "reworded";

        return (
          <button
            key={line.key}
            type="button"
            data-anchor={line.key}
            onClick={() => onSelect(activeOpId === line.opId ? null : line.opId!)}
            aria-pressed={activeOpId === line.opId}
            /* The connecting rule is a real element, not a ::before: its colour
               varies per mark, and Tailwind cannot see an interpolated class. */
            className={`absolute left-0 right-0 m-0 flex cursor-pointer items-start gap-2.5
                        border-0 bg-transparent p-0 text-left text-xs font-medium leading-4
                        ${tone.text}`}
          >
            <span aria-hidden className={`mt-2 h-px w-[22px] flex-none ${tone.rule}`} />
            <span>
              {MARK_LABEL[state]}
              <span className="mt-[3px] block font-normal opacity-80">{note}</span>
            </span>
          </button>
        );
      })}
      {children}
    </aside>
  );
}
