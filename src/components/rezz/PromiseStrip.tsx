/**
 * NOT CURRENTLY MOUNTED (28 Sep 2026). Kept because `REZZ_PROMISES` is the
 * canonical list of the brand-governed promise copy, and because the owner may
 * want the band back.
 *
 * It was removed from the landing page rather than restyled a third time. The
 * problem was never the treatment: every one of its four claims already appears
 * two to four times elsewhere on that page, and better — "Nothing added behind
 * your back" is a whole section's <h2> with a live demo under it, "No
 * auto-renew" is the pricing <h2> ("Paid once. Does not renew."), and the other
 * two are full FAQ answers. It also sat less than a screen below the hero,
 * where it answered objections a reader has not formed yet: "no fake ATS score"
 * means nothing before you have seen output, "no auto-renew" nothing before you
 * have seen a price. The footer carries the promise line verbatim, so the brand
 * rule in CLAUDE.md is still satisfied without it.
 *
 * If it comes back, put it directly above pricing, which is the one place those
 * reassurances answer a live question.
 *
 * The four promises, as ruled columns.
 *
 * Deliberately not dot-joined ("A · B · C · D"). Middle-dot meta strings are a
 * template tell and they flatten four distinct commitments into one mumble; a
 * rule between each gives them equal, separate weight.
 *
 * Content is a prop with the current wording as the default, because this copy
 * is governed by the brand book and has changed before — "Never invents" was
 * retired on 28 Sep 2026, and "Your own design" became "One clean template, no
 * gallery" the same day when v1 started rendering into one fixed template
 * (CLAUDE.md's dated override). Revert this one first if that override lifts.
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
    claim: "One clean template, no gallery",
    detail: "No colour picker, no 40 styles to choose from — we picked one, so you don't have to.",
  },
];

/**
 * A printed notice, not a filled block (28 Sep 2026).
 *
 * This was a solid ink slab for about a day. Two problems: a full-width dark
 * band is the single most generic gesture available on a marketing page, and
 * the ink footer already does that job four sections later — two dark
 * rectangles on one page is one too many.
 *
 * So it takes no fill at all. Weight comes from the 4px ink rules that bracket
 * it, the way a masthead or a printed guarantee is set: the product's whole
 * metaphor is paper and highlighter, and a guarantee on a document does not
 * look like a slab, it looks like ruled type. That also leaves the three
 * genuine page-scale objects (the resume sheet, the featured pass, the closing
 * band) as the only things on the page casting an 8px offset.
 *
 * Nothing here declares a colour that varies by theme beyond `ink` and
 * `ink-muted`, so it inverts correctly without any of the token-pinning the
 * filled version needed.
 */
export function PromiseStrip({ items = REZZ_PROMISES }: { items?: Promise_[] }) {
  return (
    <section
      aria-labelledby="promise-strip-heading"
      className="mt-20 border-y-4 border-ink max-[1100px]:mt-12"
    >
      {/* The block used to open straight onto four claims with nothing saying
          what they were. An eyebrow is the brand book's one sanctioned use of
          uppercase, and it is set in the evidence face because that is what
          these are — commitments you can hold us to, not a tagline. */}
      <h2
        id="promise-strip-heading"
        className="m-0 border-b-2 border-ink py-4 font-mark text-[11px] font-medium uppercase
                   leading-4 tracking-[0.08em] text-ink-muted"
      >
        What we promise
      </h2>

      {/* `grid-rows-subgrid` is doing the real work. Two of the four claims wrap
          to a second line and two do not, so with each cell laying out on its
          own every detail paragraph started at a different height and the row
          read as ragged. Sharing the parent's two rows pins all four claims to
          one band and all four details to the next, whatever the copy does —
          which matters, because this copy is brand-governed and has changed
          twice already. `1fr` on the detail row also flattens the dead space
          that used to collect under the two short cells. */}
      <ul className="m-0 grid list-none grid-cols-1 p-0 lg:grid-cols-4 lg:grid-rows-[auto_1fr]">
        {items.map((p, i) => (
          <li
            key={p.claim}
            /* Outer edges run flush to the page gutter and only the inner
               gutters are padded, so the four columns read as one ruled band
               rather than as a card that happens to have no border. */
            className={`py-7 lg:row-span-2 lg:grid lg:grid-rows-subgrid lg:px-7
                        ${i === 0 ? "lg:pl-0" : ""}
                        ${i === items.length - 1 ? "lg:pr-0" : "border-b-2 border-line lg:border-b-0 lg:border-r-2 lg:border-r-ink"}`}
          >
            <div className="text-lg font-semibold leading-[29px]">{p.claim}</div>
            <p className="m-0 mt-3 text-sm font-normal leading-[22px] text-ink-muted">{p.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
