"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Fades a block in, once, as it crosses into the viewport — the landing
 * page's scroll-length version of the highlighter sweep's "once, on the way
 * in" rule. A `mark` inside carrying the `mark-onview` class reads the same
 * `in-view` state (see globals.css) so a highlight below the fold sweeps when
 * it's actually seen rather than finishing off-screen before anyone scrolled
 * to it.
 *
 * Disconnects after the first trigger — this plays once, never again on
 * scroll-back. `prefers-reduced-motion` is handled entirely in CSS (the
 * `.reveal` block there shows the finished state immediately), so this
 * component doesn't need to know about it.
 */
export function Reveal({
  as = "div",
  delayMs = 0,
  className = "",
  children,
}: {
  as?: "div" | "li";
  delayMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    /* Tells the boot script in layout.tsx that React is live, which is what
       keeps the `data-reveal` flag — and therefore the hiding rules — in
       place. If this never runs (a chunk that 404s, a hydration error), the
       flag is withdrawn at 2s and every Reveal on the page shows its content
       rather than staying blank. Setting it from every instance is harmless
       and means no single "first" Reveal has to own the signal. */
    document.documentElement.dataset.revealReady = "1";

    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag
      ref={ref}
      className={`reveal ${inView ? "in-view" : ""} ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
