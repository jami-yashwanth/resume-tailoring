import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";
type Size = "sm" | "md" | "lg";

/* No border here on purpose — neither width nor colour. Two utilities of the
   same kind in one class string are resolved by Tailwind's generated source
   order, not by the order they appear here: a `border-transparent` in the base
   silently beat the variant's `border-line-strong` and flattened every
   secondary button, and a base `border` (1px) would beat the variants'
   `border-2` the same way. Each variant owns its whole border outright.

   `disabled:pointer-events-none` is how the press is suppressed on a disabled
   button. Overriding the hover transform with a `disabled:` utility would put
   two rules for the same property in one class string and hand the outcome to
   Tailwind's generated order again; removing the hover entirely cannot be
   beaten by ordering.

   The `before:` box is an invisible hit-area guard for the press-in. Hover moves
   the button 2px down and right, which uncovers a 2px strip along its top and
   left edges; a pointer resting in that strip then un-hovers, the button springs
   back, it re-hovers, and the button shivers forever (and Playwright never sees
   it as stable). A new decision card lands its buttons under a pointer that
   just clicked, so this is reachable. The guard is a child of the button, so it
   moves with it and keeps covering the strip: 4px past the padding edge is 2px
   past the 2px border. */
const base =
  "relative inline-flex items-center justify-center rounded-md " +
  "before:absolute before:-left-1 before:-top-1 before:bottom-0 before:right-0 before:content-[''] " +
  "font-semibold no-underline cursor-pointer " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150";

/* 44px is the minimum tap target the brand book requires. */
const sizes: Record<Size, string> = {
  /* Row-level actions (Undo, Keep it) in a 300px column. Still 44px tall. */
  sm: "min-h-11 px-3 text-[13px] leading-[18px]",
  md: "min-h-11 px-6 text-[15px] leading-5",
  lg: "min-h-[52px] px-8 text-[17px] leading-6",
};

/* Two variants, not four. Until 29 Sep 2026 there were a flat `primary`/
   `secondary` pair for the app and a drawn `brutal`/`brutalGhost` pair for the
   landing page. The owner asked for one voice across every screen, so the flat
   pair is gone and the drawn pair took its names. A fifth variant is not the
   answer to a button that looks wrong somewhere — one primary per view is.

   The hard offset shadow is a drawn outline, not depth, which is why it may sit
   on a button at all when the brand book reserves real shadows for the resume
   and floating layers. It presses into its own offset on hover, so the offset is
   doing something rather than decorating. 4px because the skin runs exactly two
   offset steps: 4px for anything you act on, 8px for page-scale objects.

   `primary` carries the highlighter offset and `secondary` an ink one, so the
   two are told apart by more than fill — which matters on the decision bar,
   where Skip and Add it are both `secondary` precisely so that neither is
   pre-selected. */
const variants: Record<Variant, string> = {
  primary:
    "border-2 border-ink bg-action text-on-action shadow-[4px_4px_0_0_var(--highlighter)] " +
    "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--highlighter)]",
  secondary:
    "border-2 border-ink bg-paper-raised text-ink shadow-[4px_4px_0_0_var(--ink)] " +
    "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--ink)]",
};

type Common = { variant?: Variant; size?: Size; className?: string; children: ReactNode };

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
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
    <a className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </a>
  );
}
