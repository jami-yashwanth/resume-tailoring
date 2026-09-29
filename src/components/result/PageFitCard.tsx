"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/rezz/Button";
import type { PageFit } from "@/lib/tailor/review-list";

/**
 * "Swap first, grow last" — but ask.
 *
 * A default is right here and wrong in the decision card: this is a layout
 * trade-off with a sensible answer, while Add it / Skip is a question about
 * honesty. Do not copy the pre-selected radio into the card.
 */
export function PageFitCard({ pageFit, onChoose }: { pageFit: PageFit; onChoose: (optionId: string) => void }) {
  const [chosen, setChosen] = useState(pageFit.options[0]?.id ?? "");
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The document moved under the reader, so say so where they are looking.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const current = pageFit.options.find((o) => o.id === chosen) ?? pageFit.options[0];
  if (!current) return null;
  const { pages, allowed } = pageFit;

  return (
    <section aria-labelledby="page-fit-heading" className="rounded-lg border border-gap bg-paper-raised p-4 text-sm leading-[21px]">
      <h3
        id="page-fit-heading"
        ref={headingRef}
        tabIndex={-1}
        className="m-0 text-[15px] font-semibold leading-[22px] outline-offset-4"
      >
        {pageFit.causedBy ? `That line makes it ${pages} pages.` : `Your resume now runs to ${pages} pages.`}
      </h3>
      <p className="m-0 mt-1 text-[13px] leading-[19px] text-ink-muted">
        Your resume was {allowed} page{allowed === 1 ? "" : "s"}. Nothing is dropped unless you choose it.
      </p>

      <fieldset className="m-0 mt-3 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">How to make it fit</legend>
        {pageFit.options.map((option) => (
          <label
            key={option.id}
            className={`grid min-h-11 cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5 rounded-md
                        px-2 py-2 transition-colors duration-150
                        ${chosen === option.id ? "bg-paper-sunken" : "hover:bg-paper-sunken"}`}
          >
            <input
              type="radio"
              name="page-fit"
              value={option.id}
              checked={chosen === option.id}
              onChange={() => setChosen(option.id)}
              className="mt-1 h-4 w-4 accent-[var(--ink)]"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.quote ? (
                <q className="mt-0.5 block text-[13px] leading-5 text-ink-muted [quotes:none]">{option.quote}</q>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-3">
        <Button variant="secondary" onClick={() => onChoose(current.id)}>
          {current.verb}
        </Button>
      </div>
    </section>
  );
}
