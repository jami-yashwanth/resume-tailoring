import { Wordmark } from "@/components/rezz/Wordmark";

/**
 * The chrome for the two steps before the Result screen.
 *
 * The step count is stated in words rather than drawn as a progress bar with
 * dots: there are two steps the first time and one after that, and a three-
 * segment stepper would overstate the ceremony of pasting a job description.
 */
export function FlowHeader({ step }: { step: string }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-[72px] max-w-[1312px] items-center justify-between px-16 max-[1100px]:px-8 max-[680px]:px-4">
        <Wordmark />
        <p className="m-0 text-sm leading-[21px] text-ink-muted">{step}</p>
      </div>
    </header>
  );
}
