import type { ReactNode } from "react";

/**
 * The user's document.
 *
 * The `sheet` class is not decoration — globals.css hangs the theme-proof token
 * overrides off it, so the document stays paper-white with light marks in both
 * themes. Keep the class even if the styling here changes.
 *
 * The type is `font-doc` (Georgia) rather than the product's sans, because
 * every word inside this element is the user's, not ours. In the real product
 * this face comes from their parsed file; Georgia is the sample's.
 */
/* Page margins, as a variant rather than a free-form className: two padding
   utilities in one class string are resolved by Tailwind's generated order, not
   by ours, so an override passed in would win only by luck.
   `tight` exists for the hero, where the sheet is 500px wide — a real page's
   ~1in margin costs too much of the measure there and wraps the role/date row. */
const pads = {
  page: "px-[clamp(20px,5vw,56px)] pt-[clamp(24px,5vw,52px)] pb-[clamp(32px,6vw,64px)]",
  tight: "px-10 pt-9 pb-11",
} as const;

/**
 * `name` and `contact` are the shorthand the landing page uses, where the
 * document is an illustration. The Result screen passes neither: it renders
 * every line, including those two, from the runs parsed out of the real file,
 * because there the sheet has to *be* the document rather than look like one.
 */
export function ResumeSheet({
  name,
  contact,
  label,
  children,
  pad = "page",
  className = "",
}: {
  name?: string;
  contact?: string;
  label?: string;
  children: ReactNode;
  pad?: keyof typeof pads;
  className?: string;
}) {
  return (
    <article
      aria-label={label ?? (name ? `${name}'s resume, tailored` : "Your resume, tailored")}
      className={`sheet rounded-sheet bg-sheet text-sheet-ink shadow-sheet
                  font-doc text-[13.5px] leading-[21px] ${pads[pad]} ${className}`}
    >
      {name ? (
        <div className="text-[21px] font-bold leading-[26px] tracking-[-0.01em]">{name}</div>
      ) : null}
      {contact ? <div className="text-[12.5px] text-ink-muted">{contact}</div> : null}
      {children}
    </article>
  );
}

export function SheetRule() {
  return <hr className="my-3 mt-4 border-0 border-t border-sheet-line" />;
}

export function SheetHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-1.5 mt-0 text-[11px] font-bold uppercase leading-[14px] tracking-[0.1em] text-ink-muted">
      {children}
    </h4>
  );
}

export function SheetRole({ role, dates }: { role: string; dates: string }) {
  return (
    <div className="flex justify-between gap-3 font-bold">
      <span>{role}</span>
      {/* A date range never breaks across lines — "Aug 2024 –" / "present" reads
          as a typesetting failure on a document whose whole pitch is that its
          layout survived. The role title wraps instead, which is normal. */}
      <span className="shrink-0 whitespace-nowrap">{dates}</span>
    </div>
  );
}

/** A line the user has not written — dashed in the corrector's red, never colour alone. */
export function NotYours({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[2px] bg-gap-soft outline outline-[1.5px] outline-offset-[3px] outline-dashed outline-gap">
      {children}
    </span>
  );
}
