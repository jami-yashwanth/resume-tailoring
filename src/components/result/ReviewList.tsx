"use client";

import { CircleAlert } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import type { ReviewState } from "@/lib/tailor/review";
import type { ReviewItem, ReviewList as ReviewListData } from "@/lib/tailor/review-list";
import type { Coverage } from "@/lib/tailor/types";
import { DecisionCard } from "./DecisionCard";
import { ItemRow } from "./ItemRow";
import { PageFitCard } from "./PageFitCard";

/**
 * The right column: the one place anything on this screen is decided or undone.
 *
 * It replaces the job panel's "Needs your OK" group, the margin marks, the
 * popover and the bottom bar — four places that each showed part of the same
 * question, and only one of which let you answer it.
 */
const groupHeading = "m-0 text-[13px] font-semibold leading-[18px] text-ink-muted";

export function ReviewList({
  list,
  state,
  coverage,
  notice,
  className = "",
  onDecide,
  onUndo,
  onNextWording,
  onOpen,
  onWhy,
  onChoosePageFit,
}: {
  list: ReviewListData;
  state: ReviewState;
  coverage: Coverage;
  /** Sample / missing file / download error, shown above everything else. */
  notice?: ReactNode;
  className?: string;
  onDecide: (opId: string, approved: boolean) => void;
  onUndo: (opId: string) => void;
  onNextWording: (opId: string) => void;
  onOpen: (opId: string) => void;
  onWhy: (opId: string) => void;
  onChoosePageFit: (optionId: string) => void;
}) {
  const whyFor = (opId: string) => state.whyOpen && state.currentOpId === opId;
  const pages = `${state.pages} page${state.pages === 1 ? "" : "s"}`;
  const pageFitLength = list.pageFit ? `${list.pageFit.pages}-${list.pageFit.allowed}` : null;
  const pageFitKey = list.pageFit
    ? `${pageFitLength}-${list.pageFit.options.map((o) => o.id).join(",")}`
    : null;
  const currentId = list.current?.op.id ?? null;

  const allDecidedRef = useRef<HTMLParagraphElement>(null);
  /** undefined until the first paint, so nothing is focused on arrival. */
  const previousCurrent = useRef<string | null | undefined>(undefined);
  /** The length in question when the user answered the page-fit card, until
   *  focus has moved on. */
  const answeredPageFit = useRef<string | null>(null);

  /* Where focus goes next when the thing that had it disappears. The card
     that was answered unmounts, and a focused element that unmounts drops
     focus to <body>: a keyboard user would start again from the top. */
  const focusNext = (opId: string | null) => {
    const target = opId
      ? document.getElementById(`decision-${opId}`)
      : (allDecidedRef.current ?? document.getElementById("page-fit-heading"));
    target?.focus();
  };

  useEffect(() => {
    const before = previousCurrent.current;
    previousCurrent.current = currentId;
    if (before === undefined) return;
    // The last decision made: say so where the card was.
    if (before !== null && currentId === null) focusNext(null);
    // A card came back with nothing open before it — an Undo from "All decided".
    // A card replacing a card focuses itself.
    if (before === null && currentId !== null) focusNext(currentId);
  }, [currentId]);

  useEffect(() => {
    const answered = answeredPageFit.current;
    if (answered === null) return;
    /* The options change as soon as a removal is chosen, but the length only
       once the page is measured again, so the length is what says whether the
       question went away or became a different one. */
    if (state.compare || (pageFitLength !== null && pageFitLength !== answered)) {
      // Comparing, or still too long by a different count: the new card takes focus itself.
      answeredPageFit.current = null;
    } else if (pageFitLength === null) {
      answeredPageFit.current = null;
      focusNext(currentId);
    }
  }, [pageFitLength, currentId, state.compare]);

  const choosePageFit = (optionId: string) => {
    answeredPageFit.current = pageFitLength;
    onChoosePageFit(optionId);
  };

  return (
    <section aria-label="Your review" className={`flex flex-col gap-3 p-1 font-ui ${className}`}>
      {notice}
      {state.compare && (
        <p className="m-0 rounded-lg border border-line bg-paper-raised p-3 text-[13px] leading-[19px] text-ink-muted">
          Turn off compare to make changes.
        </p>
      )}

      <fieldset
        disabled={state.compare}
        className={`m-0 flex min-w-0 flex-col gap-3 border-0 p-0 ${state.compare ? "opacity-50" : ""}`}
      >
        {list.pageFit && (
          <PageFitCard
            /* Keyed by the options too, so a removal that changes them resets
               the chosen radio to the new first option. */
            key={pageFitKey}
            pageFit={list.pageFit}
            onChoose={choosePageFit}
          />
        )}

        {list.toDecide.length > 0 ? (
          <>
            <h2 className={groupHeading}>{list.toDecide.length} left to decide</h2>
            {list.current && (
              <DecisionCard
                item={list.current}
                position={list.position}
                total={list.totalDecisions}
                whyOpen={whyFor(list.current.op.id)}
                onDecide={onDecide}
                onNextWording={onNextWording}
                onWhy={onWhy}
              />
            )}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {list.toDecide
                .filter((item) => item !== list.current)
                .map((item) => (
                  <li key={item.op.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(item.op.id)}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sheet border border-line
                                 bg-paper-raised px-3 text-left text-[13px] leading-[18px] text-ink
                                 transition-colors duration-150 hover:bg-paper-sunken"
                    >
                      <CircleAlert aria-hidden className="h-4 w-4 flex-none text-gap" strokeWidth={1.5} />
                      <span>
                        <span className="font-semibold">{item.skill ?? "A line"}</span> · needs your OK
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        ) : (
          !list.pageFit && (
            <p
              ref={allDecidedRef}
              tabIndex={-1}
              className="m-0 rounded-lg border border-line bg-paper-raised p-4 text-[15px] font-semibold leading-[22px]
                         outline-offset-4"
            >
              All decided. Covers {coverage.covered} of {coverage.total} · {pages}.
            </p>
          )
        )}

        <Group title="Decided" items={list.decided} whyFor={whyFor} onWhy={onWhy} onUndo={onUndo} />
        <Group title="Reworded for you" items={list.reworded} whyFor={whyFor} onWhy={onWhy} onUndo={onUndo} />
        <Group title="Removed to fit" items={list.removed} whyFor={whyFor} onWhy={onWhy} onUndo={onUndo} />
      </fieldset>
    </section>
  );
}

function Group({
  title,
  items,
  whyFor,
  onWhy,
  onUndo,
}: {
  title: string;
  items: ReviewItem[];
  whyFor: (opId: string) => boolean;
  onWhy: (opId: string) => void;
  onUndo: (opId: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <h2 className={groupHeading}>{title}</h2>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <ItemRow key={item.op.id} item={item} open={whyFor(item.op.id)} onWhy={onWhy} onUndo={onUndo} />
        ))}
      </ul>
    </div>
  );
}
