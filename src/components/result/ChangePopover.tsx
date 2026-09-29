"use client";

import { useEffect, useRef } from "react";
import type { Layout, PlannedOp, Requirement } from "@/lib/tailor/types";
import type { LineState } from "@/lib/tailor/view";

/**
 * Why a line changed, and how to change your mind.
 *
 * Level two of two — the spec allows no deeper. It shows the reason, the
 * user's own line it came from, and the job's exact words, because an
 * explanation that sits next to its sources is the difference between
 * "trust us" and "check us". Then it gives back control over the line: undo a
 * rewording, take it again, try another wording, keep a line we offered to
 * drop. Every one of those used to be either missing or a button that closed
 * the popover and did nothing.
 */
export function ChangePopover({
  op,
  state,
  layout,
  requirements,
  anchorKey,
  wordingIndex,
  wordingCount,
  onUndo,
  onRedo,
  onTryAnotherWording,
  onKeepLine,
  onClose,
}: {
  op: PlannedOp;
  state: LineState;
  layout: Layout;
  requirements: Requirement[];
  anchorKey: string;
  wordingIndex: number;
  wordingCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onTryAnotherWording: () => void;
  onKeepLine: () => void;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A dialog you cannot leave by keyboard is not a dialog. Focus lands on the
  // heading so a screen reader reads the explanation from the top; Escape
  // closes, and the caller puts focus back on the line.
  useEffect(() => {
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sources = op.evidence
    .map((id) => layout.blocks.find((b) => b.id === id)?.text)
    .filter(Boolean) as string[];
  const asked = requirements.filter((r) => op.requirements.includes(r.id));
  const added = op.claim === "added_by_user";

  const heading =
    state === "reverted"
      ? "Back to your original."
      : state === "removed"
        ? "Removed to make room."
        : op.reason || (added ? "This line isn't in your resume yet." : "Reworded for this job.");

  const canTryAnother = wordingCount > 1 && state !== "reverted" && state !== "removed";

  return (
    <div
      data-anchor-float={anchorKey}
      role="dialog"
      aria-label="Why this line changed"
      className="absolute left-8 right-0 z-10 -mt-1.5 flex flex-col gap-3 rounded-lg border
                 border-line bg-paper-raised p-4 font-ui text-sm leading-[21px] shadow-float"
    >
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="m-0 text-[15px] font-semibold leading-[22px] outline-offset-4"
      >
        {heading}
      </h3>

      {state === "reverted" && (
        <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
          This line is exactly as you wrote it.
        </p>
      )}

      {sources.length > 0 && (
        <div>
          <span className="mb-[3px] block font-mark text-[11px] leading-4 text-ink-muted">
            based on your line{sources.length > 1 ? "s" : ""}
          </span>
          {sources.map((text, index) => (
            <q
              key={`${index}-${text.slice(0, 24)}`}
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
        {state === "reworded" && (
          <Action onClick={onUndo}>Undo</Action>
        )}
        {state === "reverted" && (
          <Action onClick={onRedo}>Use the reworded line again</Action>
        )}
        {state === "removed" && (
          <Action onClick={onKeepLine}>Keep it, allow another page</Action>
        )}
        {canTryAnother && (
          <Action onClick={onTryAnotherWording}>
            Try another wording ({wordingIndex + 1} of {wordingCount})
          </Action>
        )}
        <Action onClick={onClose}>Close</Action>
      </div>
    </div>
  );
}

function Action({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-7 cursor-pointer border-0 bg-transparent p-0 font-ui text-sm
                 font-medium leading-5 text-ink underline underline-offset-[3px]"
    >
      {children}
    </button>
  );
}
