import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { box, offset, offsetAction, press, pressAction } from "./skin";

type Variant = "primary" | "secondary";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center rounded-md " +
  "font-semibold no-underline cursor-pointer " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none";

/* 44px is the minimum tap target the brand book requires. */
const sizes: Record<Size, string> = {
  /* Row-level actions (Undo, Keep it) in a 300px column. Still 44px tall. */
  sm: "min-h-11 px-3 text-[13px] leading-[18px]",
  md: "min-h-11 px-6 text-[15px] leading-5",
  lg: "min-h-[52px] px-8 text-[17px] leading-6",
};

/**
 * Two variants, not four. One primary per view — a fifth variant is not the
 * answer to a button that looks wrong somewhere.
 *
 * Buttons are DRAWN: a 2px ink edge and a 4px offset they press into, the same
 * as every other object on a page built in this skin. They shipped flat — a
 * 1px hairline, `hover:opacity-90` — until 29 Sep 2026, which left the one
 * thing you are meant to click as the quietest object on the screen while the
 * theme toggle beside it had a drawn edge and a press. `skin.ts` had described
 * this treatment, yellow offset and all, since the skin moved out of the
 * landing page; only the component never caught up.
 *
 * Yellow is on `primary` alone. It is not decoration there: `highlighter` marks
 * the thing this page is actually about, and on a view with one primary action
 * that is the action. `secondary` takes ink, like every other drawn object, so
 * two secondaries side by side stay equal — which is what the Result screen's
 * Skip / Add it pair depends on, where a pre-selected option would be a product
 * bug, not a visual one.
 */
const drawn: Record<Variant, string> = {
  primary: `${box} bg-action text-on-action ${offsetAction} ${pressAction}`,
  secondary: `${box} bg-paper-raised text-ink hover:bg-paper-sunken ${offset} ${press}`,
};

/**
 * `sm` keeps the hairline. Per `skin.ts`, the drawn treatment is for chrome,
 * page-scale objects and the things you act on — not for dense repeating rows
 * you read. `sm` exists only inside those rows (Undo, Keep it, one per change
 * on the Result screen), and forty 2px boxes each casting a 4px offset is
 * noise, not consistency.
 */
const flat: Record<Variant, string> = {
  primary: "border border-action bg-action text-on-action hover:opacity-90 transition-colors duration-150",
  secondary:
    "border border-line-strong bg-paper-raised text-ink hover:bg-paper-sunken transition-colors duration-150",
};

const skin = (variant: Variant, size: Size) => (size === "sm" ? flat[variant] : drawn[variant]);

type Common = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`${base} ${sizes[size]} ${skin(variant, size)} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${base} ${sizes[size]} ${skin(variant, size)} ${className}`} {...rest}>
      {children}
    </a>
  );
}
