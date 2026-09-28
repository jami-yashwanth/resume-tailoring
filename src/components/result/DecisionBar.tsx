"use client";

import { Button } from "@/components/rezz/Button";
import type { PlannedOp } from "@/lib/tailor/types";

/**
 * One decision at a time, at the bottom of the screen.
 *
 * Skip and Add it are the same button, side by side, nothing pre-selected —
 * a product rule, so it is expressed as identical markup rather than as two
 * styles that happen to look alike today. There is no Add all: per-item
 * decisions are the point, not friction to be optimised away.
 */
export function DecisionBar({
  pending,
  index,
  total,
  onDecide,
  ready,
  coverage,
  pages,
  onDownload,
}: {
  pending: PlannedOp | null;
  index: number;
  total: number;
  onDecide: (opId: string, approved: boolean) => void;
  ready: boolean;
  coverage: { covered: number; total: number };
  pages: number;
  onDownload: () => void;
}) {
  if (ready || !pending) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 border-t border-line bg-paper-raised px-8 py-4 max-[900px]:grid-cols-1">
        <p className="m-0 text-[17px] font-semibold leading-[25px]">
          Ready. Covers {coverage.covered} of {coverage.total} requirements · {pages} page
          {pages === 1 ? "" : "s"}.
        </p>
        <Button onClick={onDownload}>Download resume</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 border-t border-line bg-paper-raised px-8 py-4 shadow-[0_-8px_24px_-12px_#15203326] max-[900px]:grid-cols-1 max-[900px]:gap-4">
      <div>
        <span className="mb-[3px] block font-mark text-[11.5px] leading-4 text-gap">
          decision {index} of {total}
        </span>
        <p className="m-0 text-[17px] font-semibold leading-[25px]">
          This line isn&rsquo;t in your resume. Add it?
        </p>
        <p className="m-0 mt-0.5 font-doc text-sm leading-[21px] text-ink-muted">
          &ldquo;{pending.text}&rdquo;
        </p>
        <p className="m-0 mt-1 text-[13px] leading-[19px] text-ink-muted">
          Recruiters may ask you about it. Nothing is added unless you choose Add it.
        </p>
      </div>
      {/* Same variant, same size, same order every time. */}
      <div className="flex gap-3 max-[900px]:w-full">
        <Button
          variant="secondary"
          className="min-h-[46px] min-w-[132px] flex-1 text-[15px]"
          onClick={() => onDecide(pending.id, false)}
        >
          Skip
        </Button>
        <Button
          variant="secondary"
          className="min-h-[46px] min-w-[132px] flex-1 text-[15px]"
          onClick={() => onDecide(pending.id, true)}
        >
          Add it
        </Button>
      </div>
    </div>
  );
}
