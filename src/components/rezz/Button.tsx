import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "brutal" | "brutalGhost";
type Size = "md" | "lg";

/* No border here on purpose — neither width nor colour. Two utilities of the
   same kind in one class string are resolved by Tailwind's generated source
   order, not by the order they appear here: a `border-transparent` in the base
   silently beat the variant's `border-line-strong` and flattened every
   secondary button, and a base `border` (1px) would beat the brutal variants'
   `border-2` the same way. Each variant owns its whole border outright. */
const base =
  "inline-flex items-center justify-center rounded-md " +
  "font-semibold no-underline cursor-pointer " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150";

/* 44px is the minimum tap target the brand book requires. */
const sizes: Record<Size, string> = {
  md: "min-h-11 px-6 text-[15px] leading-5",
  lg: "min-h-[52px] px-8 text-[17px] leading-6",
};

/* `brutal` and `brutalGhost` are the landing page's voice and are not used in
   the app. The hard offset shadow is a drawn outline, not depth — which is why
   it may sit on a button at all when the brand book reserves real shadows for
   the resume and floating layers. It presses into its own shadow on hover, so
   the offset is doing something rather than decorating.

   The offset is 4px because the landing page runs exactly two offset steps:
   4px for anything you act on, 8px for the three page-scale objects (the
   resume sheet, the promise block, the featured pass). An audit found four
   steps in use — 3/4/5/8 — which is not a hierarchy, because nobody can tell
   4px from 5px at a glance. Two steps, or it means nothing. */
const variants: Record<Variant, string> = {
  primary: "border border-action bg-action text-on-action hover:opacity-90",
  secondary: "border border-line-strong bg-transparent text-ink hover:border-ink",
  brutal:
    "border-2 border-ink bg-action text-on-action shadow-[4px_4px_0_0_var(--highlighter)] " +
    "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_var(--highlighter)]",
  brutalGhost:
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
