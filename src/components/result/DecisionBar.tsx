"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/rezz/Button";
import type { PlannedOp } from "@/lib/tailor/types";

/**
 * One decision at a time, at the bottom of the screen.
 *
 * Skip and Add it are the same button, side by side, nothing pre-selected —
 * a product rule, so it is expressed as identical markup rather than as two
 * styles that happen to look alike today. There is no Add all: per-item
 * decisions are the point, not friction to be optimised away.
 *
 * The buttons are keyed on the decision they answer, so React replaces them
 * between questions. That is not cosmetic: while they persisted, a double
 * click or a held Enter answered the next question too, which is exactly the
 * rubber-stamping the spec's metrics table warns about. Replacing them drops
 * focus, so focus is moved deliberately to the new question instead.
 *
 * The bar is drawn in 2px like the rest of the chrome, and while a decision is
 * waiting the rule turns the corrector's red — the same signal the landing page
 * uses for the one thing that needs the user. When nothing is pending it goes
 * back to ink, because then there is nothing to answer.
 */
export function DecisionBar({
  pending,
  text,
  skill,
  where,
  index,
  total,
  onDecide,
  ready,
  coverage,
  pages,
  onDownload,
  canDownload,
  downloading,
}: {
  pending: PlannedOp | null;
  /** The wording currently on the page, which may not be the planner's first. */
  text: string;
  /** What the line is about, for a button that means something out of context. */
  skill: string | null;
  /** The role the line would join, e.g. "Razorfin". */
  where: string | null;
  index: number;
  total: number;
  onDecide: (opId: string, approved: boolean) => void;
  ready: boolean;
  coverage: { covered: number; total: number };
  pages: number;
  onDownload: () => void;
  canDownload: boolean;
  downloading: boolean;
}) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const id = pending?.id ?? null;
    // Only on the way from one question to the next — not on first paint,
    // where stealing focus to the bottom of the screen would be rude.
    if (previous.current !== null && previous.current !== id) headingRef.current?.focus();
    previous.current = id;
  }, [pending?.id]);

  if (ready || !pending) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 border-t-2 border-ink bg-paper-raised px-8 py-4 max-[900px]:grid-cols-1">
        <p
          ref={headingRef}
          tabIndex={-1}
          className="m-0 text-[17px] font-semibold leading-[25px] outline-offset-4"
        >
          Ready. Covers {coverage.covered} of {coverage.total} requirements · {pages} page
          {pages === 1 ? "" : "s"}.
        </p>
        <Button onClick={onDownload} disabled={!canDownload || downloading}>
          {downloading ? "Writing your file…" : "Download resume"}
        </Button>
      </div>
    );
  }

  const label = skill ?? "this";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 border-t-2 border-gap bg-paper-raised px-8 py-4 max-[900px]:grid-cols-1 max-[900px]:gap-4">
      <div>
        <span className="mb-[3px] flex items-center gap-2 font-mark text-[11.5px] leading-4 text-gap before:h-[2px] before:w-[18px] before:bg-gap before:content-['']">
          decision {index} of {total}
        </span>
        <p
          ref={headingRef}
          tabIndex={-1}
          className="m-0 text-[17px] font-semibold leading-[25px] outline-offset-4"
        >
          {skill ? `${skill} isn't in your resume.` : "This line isn't in your resume."}{" "}
          {where ? `Add this line to your ${where} role?` : "Add it?"}
        </p>
        <p className="m-0 mt-0.5 font-doc text-sm leading-[21px] text-ink-muted">
          &ldquo;{text}&rdquo;
        </p>
        <p className="m-0 mt-1 text-[13px] leading-[19px] text-ink-muted">
          Recruiters may ask you about it. Nothing is added unless you choose Add it.
        </p>
      </div>
      {/* Same variant, same size, same order every time. `secondary` for both:
          the moment one of them takes the primary fill and its highlighter
          offset, the screen has picked for the user. */}
      <div key={pending.id} className="flex gap-4 max-[900px]:w-full">
        <Button
          variant="secondary"
          className="min-h-[46px] min-w-[132px] flex-1 text-[15px]"
          aria-label={`Skip ${label} line`}
          onClick={() => onDecide(pending.id, false)}
        >
          Skip
        </Button>
        <Button
          variant="secondary"
          className="min-h-[46px] min-w-[132px] flex-1 text-[15px]"
          aria-label={`Add ${label} line to my resume`}
          onClick={() => onDecide(pending.id, true)}
        >
          Add it
        </Button>
      </div>
    </div>
  );
}
