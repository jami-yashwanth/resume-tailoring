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
      className={`flex flex-col gap-4 rounded-lg border bg-paper-raised p-8
                  ${featured ? "border-ink" : "border-line"}`}
    >
      <div className="text-[15px] font-semibold">{name}</div>
      <div className="text-[46px] font-semibold leading-[50px] tracking-[-0.035em] tabular-nums">
        {price}
        <small className="mt-1 block text-sm font-normal leading-[21px] tracking-normal text-ink-muted">
          {per}
        </small>
      </div>
      <ul className="m-0 flex flex-grow list-none flex-col gap-2 p-0 text-[15px] leading-[23px] text-ink-muted">
        {features.map((f) => (
          <li key={f} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
            <span aria-hidden="true" className="text-[13px] leading-[23px] text-verified">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <ButtonLink href={href} variant={featured ? "primary" : "secondary"}>
        {cta}
      </ButtonLink>
    </div>
  );
}
