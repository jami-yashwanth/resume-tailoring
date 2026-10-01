"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/rezz/Button";
import type { ReviewItem } from "@/lib/tailor/review-list";
import { TextAction, WhyThisLine } from "./WhyThisLine";

/**
 * The one decision in front of the user.
 *
 * Skip and Add it are identical markup, side by side, nothing pre-selected —
 * a product rule, so it is expressed as one button twice rather than two styles
 * that happen to match today. A press in the first 350ms of a new card is
 * ignored, so a double click or a held Enter cannot answer the next question
 * too; focus is moved to the new question on purpose.
 */
export function DecisionCard({
  item,
  position,
  total,
  compact = false,
  focusKey,
  focused = false,
  whyOpen,
  onDecide,
  onNextWording,
  onWhy,
}: {
  item: ReviewItem;
  position?: number;
  total?: number;
  /** Inline in a section: the line's place says where it lands, so no "N of M". */
  compact?: boolean;
  /** The line key the page uses for this draft; clicking it there focuses this card. */
  focusKey?: string;
  focused?: boolean;
  whyOpen: boolean;
  onDecide: (opId: string, approved: boolean) => void;
  onNextWording: (opId: string) => void;
  onWhy: (opId: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previous = useRef<string | null>(null);
  const shownAt = useRef(0);
  const id = item.op.id;

  useEffect(() => {
    // Only on the way from one question to the next — not on first paint.
    if (previous.current !== null && previous.current !== id) headingRef.current?.focus();
    previous.current = id;
    shownAt.current = performance.now();
  }, [id]);

  useEffect(() => {
    if (focused) headingRef.current?.focus();
  }, [focused]);

  /* A new card appears exactly where the last one was, so the second half of
     a double click (or a held Enter) lands on its buttons. Anything faster
     than a person can read the question is not an answer to it. */
  const answer = (approved: boolean) => {
    if (performance.now() - shownAt.current < 350) return;
    onDecide(id, approved);
  };

  const label = item.skill ?? "this";

  return (
    <section
      aria-labelledby={`decision-${id}`}
      data-focus-key={focusKey}
      className={`rounded-lg border bg-paper-raised p-4 ${compact ? "border-dashed border-gap" : "border-gap"}`}
    >
      <span className="block font-mark text-[11.5px] leading-4 text-gap">
        {compact || position === undefined ? "Not in your resume · Needs your OK" : `Needs your OK · ${position} of ${total}`}
      </span>
      <h3
        id={`decision-${id}`}
        ref={headingRef}
        tabIndex={-1}
        className="m-0 mt-1 text-[15px] font-semibold leading-[22px] outline-offset-4"
      >
        {item.skill ? `${item.skill} isn't in your resume.` : "This line isn't in your resume."}{" "}
        {item.where
          ? `Add this line to your ${item.where.label}${item.where.kind === "role" ? " role" : ""}?`
          : "Add it?"}
      </h3>
      <p className="m-0 mt-2 rounded-md bg-paper-sunken px-3 py-2 text-sm leading-[21px]">{item.text}</p>
      <p className="m-0 mt-2 text-[13px] leading-[19px] text-ink-muted">
        Recruiters may ask you about it. Nothing is added unless you choose Add it.
      </p>

      <div key={id} className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="secondary" aria-label={`Skip ${label} line`} onClick={() => answer(false)}>
          Skip
        </Button>
        <Button variant="secondary" aria-label={`Add ${label} line to my resume`} onClick={() => answer(true)}>
          Add it
        </Button>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4">
        {item.wordingCount > 1 && (
          <TextAction onClick={() => onNextWording(id)}>
            Try another wording ({item.wordingIndex + 1} of {item.wordingCount})
          </TextAction>
        )}
        <TextAction aria-expanded={whyOpen} onClick={() => onWhy(id)}>
          {whyOpen ? "Hide why" : "Why this line?"}
        </TextAction>
      </div>
      {whyOpen && <WhyThisLine item={item} onClose={() => onWhy(id)} />}
    </section>
  );
}
