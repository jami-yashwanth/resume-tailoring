/**
 * The four promises, as ruled columns.
 *
 * Deliberately not dot-joined ("A · B · C · D"). Middle-dot meta strings are a
 * template tell and they flatten four distinct commitments into one mumble; a
 * rule between each gives them equal, separate weight.
 *
 * Content is a prop with the current wording as the default, because this copy
 * is governed by the brand book and has changed before — "Never invents" was
 * retired on 28 Sep 2026.
 */
export type Promise_ = { claim: string; detail: string };

export const REZZ_PROMISES: Promise_[] = [
  {
    claim: "Nothing added behind your back",
    detail: "Anything not already in your resume waits for you to choose Add it.",
  },
  {
    claim: "No fake ATS score",
    detail: "Counts you can check, not a number we invented.",
  },
  {
    claim: "No auto-renew",
    detail: "Passes are paid once by UPI. There is nothing to cancel.",
  },
  {
    claim: "Your own design",
    detail: "We edit your file. We never move you into our template.",
  },
];

export function PromiseStrip({ items = REZZ_PROMISES }: { items?: Promise_[] }) {
  return (
    <section aria-label="What Rezz promises" className="mt-[120px] border-t border-ink">
      <ul className="m-0 grid list-none grid-cols-1 p-0 lg:grid-cols-4">
        {items.map((p, i) => (
          <li
            key={p.claim}
            className={`pb-8 pr-0 pt-6 text-[17px] font-medium leading-[25px]
                        ${i < items.length - 1 ? "border-b border-line lg:border-b-0 lg:border-r lg:pr-6" : ""}`}
          >
            {p.claim}
            <span className="mt-2 block text-sm font-normal leading-[21px] text-ink-muted">{p.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
