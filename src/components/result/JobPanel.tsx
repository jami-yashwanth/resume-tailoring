"use client";

import { displayStatus } from "@/lib/tailor/coverage";
import type { Coverage, Match, PlannedOp, Requirement } from "@/lib/tailor/types";

/**
 * "What this job asks for."
 *
 * A big honest number and a list, separated by hairlines — no card, no score.
 * Status is an icon plus a word plus a colour, never colour alone. A knockout
 * is not a button, because there is nothing to act on.
 */

const STATUS = {
  matched: { mark: "✓", label: "In your resume", className: "text-verified" },
  added: { mark: "✓", label: "Added by you", className: "text-verified" },
  needs_ok: { mark: "!", label: "Needs your OK", className: "text-gap" },
  cannot_change: { mark: "–", label: "Can't change", className: "text-ink-muted" },
} as const;

export function JobPanel({
  requirements,
  matches,
  operations,
  coverage,
  selected,
  onSelect,
}: {
  requirements: Requirement[];
  matches: Match[];
  /** Carries the user's decisions, so the list and the count agree. */
  operations: PlannedOp[];
  coverage: Coverage;
  selected: string | null;
  onSelect: (requirementId: string | null) => void;
}) {
  return (
    <aside aria-label="What this job asks for" className="font-ui">
      <h2 className="m-0 text-[13px] font-semibold leading-[18px] text-ink-muted">
        This job asks for {requirements.length} things
      </h2>
      <p className="mb-1 mt-2 text-[34px] font-semibold leading-[38px] tracking-[-0.03em] tabular-nums">
        Covers {coverage.covered} of {coverage.total}
      </p>
      <p className="m-0 text-sm leading-[21px] text-ink-muted">
        Your original covered {coverage.originalCovered}.
      </p>

      <ul className="mt-6 list-none border-t border-line p-0">
        {requirements.map((requirement) => {
          const match = matches.find((m) => m.requirementId === requirement.id);
          const kind = match ? displayStatus(match, operations) : "needs_ok";
          const status = STATUS[kind];
          const isSelected = selected === requirement.id;
          const fixed = requirement.knockout;
          // Once a line is added, the note that asked for it has done its job.
          const note = kind === "added" ? undefined : match?.note;

          const body = (
            <>
              <span className={`font-mark text-[13px] font-medium leading-[21px] ${status.className}`}>
                {status.mark}
              </span>
              <span>
                {requirement.label}
                <span className="sr-only"> — {status.label}</span>
                {note ? (
                  <small className="mt-0.5 block text-[12.5px] leading-[17px] text-ink-muted">
                    {note}
                  </small>
                ) : null}
              </span>
            </>
          );

          return (
            <li key={requirement.id} className="border-b border-line">
              {fixed ? (
                <div className="grid w-full grid-cols-[18px_minmax(0,1fr)] gap-3 px-2 py-2.5 text-[15px] leading-[21px] text-ink-muted">
                  {body}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(isSelected ? null : requirement.id)}
                  aria-pressed={isSelected}
                  className={`grid w-full min-h-11 grid-cols-[18px_minmax(0,1fr)] gap-3 border-0 px-2 py-2.5
                              text-left text-[15px] leading-[21px] text-ink transition-colors duration-150
                              hover:bg-paper-raised ${isSelected ? "bg-paper-raised" : "bg-transparent"}`}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[12.5px] leading-[18px] text-ink-muted">
        Choose a requirement to find its line in your resume.
      </p>
    </aside>
  );
}
