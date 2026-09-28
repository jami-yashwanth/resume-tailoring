/**
 * The wordmark: "rezz" with a highlighter stroke behind it. A typographic
 * stand-in until a drawn mark exists.
 *
 * `isolate` is load-bearing. The stroke is a -z-index pseudo-element, so
 * without its own stacking context it paints behind the nearest opaque ancestor
 * background and vanishes — which is exactly what happened on the app header,
 * where the bar has a background and the landing header does not.
 */
export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span
      role="img"
      aria-label="Rezz"
      className="relative isolate inline-block font-semibold tracking-[-0.04em] text-ink
                 before:absolute before:inset-x-[-3px] before:bottom-[0.1em] before:-z-10
                 before:h-[0.34em] before:bg-highlighter before:content-['']"
      style={{ fontSize: `${size}px` }}
    >
      rezz
    </span>
  );
}
