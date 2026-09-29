import { Check } from "lucide-react";

import { Badge } from "./Badge";
import { ButtonLink } from "./Button";
import { box, offset, offsetAccent } from "./skin";

/**
 * A pass. This is the only place in the product where a bordered, rounded box
 * is allowed — it means "a thing you can buy". Everything else separates with a
 * rule, so that a card keeps meaning something.
 *
 * The price always carries the renewal fact beside it. Never a countdown, never
 * a pre-ticked renewal, never a struck-through "was" price.
 */
export function PassCard({
  name,
  price,
  per,
  features,
  cta,
  featured = false,
  href,
}: {
  name: string;
  price: string;
  per: string;
  features: string[];
  cta: string;
  featured?: boolean;
  href?: string;
}) {
  return (
    <div
      className={`flex h-full flex-col gap-4 rounded-md ${box} bg-paper-raised p-8
                  ${featured ? offsetAccent : offset}`}
    >
      {/* `min-h-7` is alignment, not spacing. The badge is 28px tall and the pass
          name is 20px, so on the one card that carries a badge this row grew by
          8px and pushed its price, its `per` line and its tick list down by the
          same 8 — three cards side by side with three prices on two different
          baselines. Pinning the row to the badge's height lands every price on
          one line whether or not the card is the featured one. */}
      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="text-[15px] font-semibold leading-5">{name}</div>
        {featured && <Badge tone="drawn">Most popular</Badge>}
      </div>
      {/* The price is the pricing section's display moment, so it takes the same
          weight and tracking as the h2 above it. It was set lighter (600) and
          looser (-0.035em) than that heading, which read as an oversight. */}
      <div className="text-[46px] font-bold leading-[1.06] tracking-[-0.04em] tabular-nums">
        {price}
        <small className="mt-2 block text-sm font-normal leading-[22px] tracking-normal text-ink-muted">
          {per}
        </small>
      </div>
      {/* The tick is ink, not `verified`. `verified` means "sourced and
          confirmed"; a feature list confirms nothing, so it was decoration
          wearing a semantic colour — and the only hue on the landing page
          belonging to neither the skin nor the correction marks.

          It is a drawn Lucide glyph at the brand book's 1.5px stroke, not the
          text character ✓. That character came out of Geist at whatever weight
          and optical size the fallback stack happened to have, sat a shade
          lighter than everything around it, and was the only mark in the
          product not drawn by the icon system. */}
      <ul className="m-0 flex flex-grow list-none flex-col gap-2 p-0 text-base leading-[26px] text-ink-muted">
        {features.map((f) => (
          <li key={f} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
            {/* mt centres the 18px glyph on the 26px first line of its label. */}
            <Check aria-hidden className="mt-1 h-[18px] w-[18px] text-ink" strokeWidth={1.5} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {/* No href means there is nothing to click yet. A button that goes
          nowhere is a broken promise, so the card states the fact instead. */}
      {href ? (
        <ButtonLink href={href} variant={featured ? "primary" : "secondary"}>
          {cta}
        </ButtonLink>
      ) : (
        <p className="m-0 border-t border-line pt-4 text-sm leading-[22px] text-ink-muted">{cta}</p>
      )}
    </div>
  );
}
