"use client";

import { Button, ButtonLink } from "@/components/rezz/Button";
import { box, lead, offsetPage, title } from "@/components/rezz/skin";

/**
 * When the Result screen itself cannot render.
 *
 * A stored plan of the wrong shape used to throw and leave a white page, on
 * the one screen where the user has already waited fifteen seconds and has
 * something at stake. Say what happened, and give them the one action that
 * actually recovers it: tailor again.
 */
export default function ResultError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col justify-center px-8 py-16">
      <div className={`${box} ${offsetPage} rounded-md bg-paper-raised p-8`}>
        <h1 className={title}>We couldn&rsquo;t open this tailoring.</h1>
        <p className={`mt-6 ${lead}`}>
          Your resume and the job are still here. Running it again usually fixes this, and it
          costs you nothing.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/job" variant="secondary">
            Tailor for this job again
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
