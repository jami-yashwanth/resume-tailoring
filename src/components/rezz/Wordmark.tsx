/**
 * The wordmark: "rezz" with a highlighter stroke behind it. A typographic
 * stand-in until a drawn mark exists.
 *
 * `isolate` is load-bearing. The stroke is a -z-index pseudo-element, so
 * without its own stacking context it paints behind the nearest opaque ancestor
 * background and vanishes — which is exactly what happened on the app header,
 * where the bar has a background and the landing header does not.
 *
 * The mark pins its own ink and its own yellow, for the same reason `.sheet`
 * does in globals.css: the stroke covers the lower two thirds of the x-height,
 * so in dark theme `text-ink` (#e8ecf2) was sitting on `highlighter` (#d6ea4f)
 * at about 1.3:1 — the word was legible in light theme and a smear in dark.
 * Pinned, the mark is the same object in both themes, which is what a mark
 * should be. Its plaque is `bg-sheet` at every call site so the pinned dark ink
 * always has white behind it; the plaque's own edge and offset keep reading
 * `--ink` from outside, so they still follow the theme.
 */
export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span
      role="img"
      aria-label="Rezz"
      style={{ fontSize: `${size}px`, ["--ink" as string]: "var(--sheet-ink)", ["--highlighter" as string]: "#e4f264" }}
      className="relative isolate inline-block font-semibold tracking-[-0.04em] text-ink
                 before:absolute before:inset-x-[-3px] before:bottom-[0.1em] before:-z-10
                 before:h-[0.34em] before:bg-highlighter before:content-['']"
    >
      rezz
    </span>
  );
}
