"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/rezz/Button";

/**
 * "Swap first, grow last" — but ask.
 *
 * A line the user added has pushed the document onto another page. The old
 * behaviour was for the planner to quietly drop one of their own lines to make
 * room, which is the same trick as adding something behind their back, run in
 * reverse. So the choice is theirs: drop a line we can name, shorten what they
 * just added, or keep everything and take the extra page.
 *
 * A default is right here and wrong two metres below in the decision bar. This
 * is a layout trade-off with a sensible answer; Add it / Skip is a question
 * about honesty, and pre-selecting an answer to that one would be choosing for
 * them. Do not copy this pattern down there.
 */

export type PageFitOption = {
  id: string;
  /** What choosing this does, e.g. "Remove one line". */
  label: string;
  /** The line itself, in the user's own words. */
  quote?: string;
  /** The button's verb once this option is chosen. */
  verb: string;
};

export function PageFitPrompt({
  anchorKey,
  pages,
  allowed,
  options,
  onChoose,
}: {
  anchorKey: string;
  pages: number;
  allowed: number;
  options: PageFitOption[];
  onChoose: (optionId: string) => void;
}) {
  const [chosen, setChosen] = useState(options[0]?.id ?? "");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The document moved under the reader, so say so where they are looking.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const current = options.find((o) => o.id === chosen) ?? options[0];
  if (!current) return null;

  return (
    <div
      data-anchor-float={anchorKey}
      role="dialog"
      aria-label="This no longer fits"
      className="absolute left-8 right-0 z-10 -mt-1.5 flex flex-col gap-3 rounded-lg border
                 border-gap bg-paper-raised p-4 font-ui text-sm leading-[21px] shadow-float"
    >
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="m-0 text-[15px] font-semibold leading-[22px] outline-offset-4"
      >
        That line makes it {pages} pages.
      </h3>
      <p className="m-0 text-[13px] leading-[19px] text-ink-muted">
        Your resume was {allowed} page{allowed === 1 ? "" : "s"}. Nothing is dropped unless you
        choose it.
      </p>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">How to make it fit</legend>
        {options.map((option) => (
          <label
            key={option.id}
            className={`grid min-h-11 cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5
                        rounded-md px-2 py-2 transition-colors duration-150
                        ${chosen === option.id ? "bg-paper-sunken" : "hover:bg-paper-sunken"}`}
          >
            <input
              type="radio"
              name={`page-fit-${anchorKey}`}
              value={option.id}
              checked={chosen === option.id}
              onChange={() => setChosen(option.id)}
              className="mt-1 h-4 w-4 accent-[var(--ink)]"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.quote ? (
                <q className="mt-0.5 block font-doc text-[13px] leading-5 text-ink-muted [quotes:none]">
                  {option.quote}
                </q>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <Button variant="secondary" onClick={() => onChoose(current.id)}>
          {current.verb}
        </Button>
      </div>
    </div>
  );
}
