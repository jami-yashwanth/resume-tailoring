import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/rezz/ThemeToggle";
import { Wordmark } from "@/components/rezz/Wordmark";
import { box, offset } from "@/components/rezz/skin";

/**
 * The chrome for the two steps before the Result screen.
 *
 * The step count is stated in words rather than drawn as a progress bar with
 * dots: there are two steps the first time and one after that, and a three-
 * segment stepper would overstate the ceremony of pasting a job description.
 *
 * Drawn in 2px ink to match the landing header (29 Sep 2026). `min-h`, not a
 * fixed height: the landing bar learned this the hard way — with `h-[72px]` a
 * bar that has to grow instead spills its contents out of its own border.
 *
 * `step` is a ReactNode rather than a string so the finish screen, which ends
 * the flow rather than counting through it, can hang its one link here instead
 * of duplicating this bar.
 */
export function FlowHeader({ step }: { step: ReactNode }) {
  return (
    <header className="border-b-2 border-ink bg-paper-raised">
      <div className="mx-auto flex min-h-[72px] max-w-[1312px] flex-wrap items-center justify-between gap-3 px-16 py-3 max-[1100px]:px-8 max-[680px]:px-4">
        {/* Boxed, the way the landing header boxes it: on a screen drawn
            entirely in 2px ink, an unboxed wordmark reads as unfinished. */}
        <span className={`inline-flex items-center ${box} rounded-md bg-paper-raised px-3 py-1.5 ${offset}`}>
          <Wordmark />
        </span>
        <div className="flex items-center gap-5">
          <p className="m-0 font-mark text-xs font-medium leading-4 text-ink-muted">{step}</p>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
