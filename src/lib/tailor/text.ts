/**
 * Keep a note to one sentence.
 *
 * The left panel gives each requirement two lines. A model that writes four
 * sentences of reasoning is not wrong, just in the wrong place, so the caption
 * is cut rather than the plan rejected.
 */
export function shorten(note: string | undefined, limit = 90): string | undefined {
  if (!note) return undefined;
  const first = note.trim().split(/(?<=[.!?])\s+/)[0] ?? note.trim();
  if (first.length <= limit) return first;
  const cut = first.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  // Always break on a word. A mid-word cut reads as a rendering bug, which is
  // the last impression this product can afford to give.
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
