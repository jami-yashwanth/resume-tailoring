import { Badge } from "./Badge";
import { ButtonLink } from "./Button";

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
  href = "#",
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
      className={`flex flex-col gap-4 rounded-md border-2 border-ink bg-paper-raised p-8
                  ${featured ? "shadow-[8px_8px_0_0_var(--highlighter)]" : "shadow-[4px_4px_0_0_var(--ink)]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[15px] font-semibold leading-5">{name}</div>
        {featured && <Badge tone="brutal">Most popular</Badge>}
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
          belonging to neither the skin nor the correction marks. */}
      <ul className="m-0 flex flex-grow list-none flex-col gap-2 p-0 text-base leading-[26px] text-ink-muted">
        {features.map((f) => (
          <li key={f} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
            <span aria-hidden="true" className="text-sm leading-[26px] text-ink">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <ButtonLink href={href} variant={featured ? "brutal" : "brutalGhost"}>
        {cta}
      </ButtonLink>
    </div>
  );
}
