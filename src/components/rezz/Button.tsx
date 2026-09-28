import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";
type Size = "md" | "lg";

/* No border-colour here on purpose. Two utilities of the same kind in one class
   string are resolved by Tailwind's generated source order, not by the order
   they appear here — a `border-transparent` in the base silently beat the
   variant's `border-line-strong` and flattened every secondary button. Each
   variant owns its border colour outright. */
const base =
  "inline-flex items-center justify-center rounded-md border " +
  "font-semibold no-underline cursor-pointer " +
  "transition-[background-color,border-color,color] duration-150";

/* 44px is the minimum tap target the brand book requires. */
const sizes: Record<Size, string> = {
  md: "min-h-11 px-6 text-[15px] leading-5",
  lg: "min-h-[52px] px-8 text-[17px] leading-6",
};

const variants: Record<Variant, string> = {
  primary: "bg-action text-on-action border-action hover:opacity-90",
  secondary: "bg-transparent text-ink border-line-strong hover:border-ink",
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
