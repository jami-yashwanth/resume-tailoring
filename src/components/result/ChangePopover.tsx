"use client";

import type { Layout, PlannedOp, Requirement } from "@/lib/tailor/types";

/**
 * Why a line changed.
 *
 * Level two of two — the spec allows no deeper. It shows the reason, the
 * user's own line it came from, and the job's exact words, because an
 * explanation that sits next to its sources is the difference between
 * "trust us" and "check us".
 */
export function ChangePopover({
  op,
  layout,
  requirements,
  anchorKey,
  onUndo,
  onClose,
}: {
  op: PlannedOp;
  layout: Layout;
  requirements: Requirement[];
  anchorKey: string;
  onUndo: () => void;
  onClose: () => void;
}) {
  const sources = op.evidence
    .map((id) => layout.blocks.find((b) => b.id === id)?.text)
    .filter(Boolean) as string[];
  const asked = requirements.filter((r) => op.requirements.includes(r.id));
  const added = op.claim === "added_by_user";

  return (
    <div
      data-anchor-float={anchorKey}
      role="dialog"
      aria-label="Why this line changed"
      className="absolute left-8 right-0 z-10 -mt-1.5 flex flex-col gap-3 rounded-lg border
                 border-line bg-paper-raised p-4 font-ui text-sm leading-[21px] shadow-float"
    >
      <h3 className="m-0 text-[15px] font-semibold leading-[22px]">
        {op.reason || (added ? "This line isn't in your resume yet." : "Reworded for this job.")}
      </h3>

      {sources.length > 0 && (
        <div>
          <span className="mb-[3px] block font-mark text-[11px] leading-4 text-ink-muted">
            based on your line{sources.length > 1 ? "s" : ""}
          </span>
          {sources.map((text) => (
            <q
              key={text}
              className="block rounded-md bg-paper-sunken px-3 py-2 font-doc text-[13px] leading-5 text-ink-muted [quotes:none]"
            >
              {text}
            </q>
          ))}
        </div>
      )}

      {asked.length > 0 && (
        <div>
          <span className="mb-[3px] block font-mark text-[11px] leading-4 text-ink-muted">
            the job says
          </span>
          {asked.map((r) => (
            <q
              key={r.id}
              className="block rounded-md bg-paper-sunken px-3 py-2 font-doc text-[13px] leading-5 text-ink-muted [quotes:none]"
            >
              {r.wording}
            </q>
          ))}
        </div>
      )}

      <span
        className={`font-mark text-[11px] leading-4 ${added ? "text-gap" : "text-verified"}`}
      >
        {added ? "— not in your resume" : "— your own words, reworded"}
      </span>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {!added && (
          <button
            type="button"
            onClick={onUndo}
            className="min-h-7 cursor-pointer border-0 bg-transparent p-0 font-ui text-sm
                       font-medium leading-5 text-ink underline underline-offset-[3px]"
          >
            Undo
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-7 cursor-pointer border-0 bg-transparent p-0 font-ui text-sm
                     font-medium leading-5 text-ink underline underline-offset-[3px]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
