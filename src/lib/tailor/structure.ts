import { HEADING_MAX } from "./outline";
import type { Block, BlockKind, Layout } from "./types";

/**
 * Reading the resume's structure with Claude, after the parser has read its text.
 *
 * docsvc labels each line from styling alone: capitals, bold, size, a tab. That
 * is a guess, and it guessed "CGPA: 8.38" was a section heading (every letter
 * is a capital), so the template drew a grade as a section of its own. Claude
 * reads the document the way a person does and relabels each line.
 *
 * It may only relabel. The text of every line is the user's own and comes
 * through untouched; the model is shown ids and returns ids with a kind, and
 * nothing it writes is ever placed in the document. An answer that does not
 * cover every line exactly once, or that makes a sentence into a heading, is
 * thrown away whole and the parser's labels stand, because a half-applied
 * relabelling is worse than a consistent guess.
 */

export type Label = { id: string; kind: BlockKind };

/**
 * Put checked labels onto a layout, or `null` if the labels don't check out.
 *
 * Sections are recomputed from the corrected headings, because every
 * non-heading block names the heading it sits under and the planner, the
 * anchor captions and the template all read that field.
 */
export function applyStructure(layout: Layout, labels: Label[]): { layout: Layout; changed: number } | null {
  const ids = new Set(layout.blocks.map((b) => b.id));
  const byId = new Map<string, BlockKind>();
  for (const label of labels) {
    if (!ids.has(label.id) || byId.has(label.id)) return null;
    byId.set(label.id, label.kind);
  }
  if (byId.size !== ids.size) return null;

  let changed = 0;
  let section: string | null = null;
  const blocks: Block[] = layout.blocks.map((block) => {
    // A bullet marker or list numbering is a fact about the file, not a guess.
    const kind = block.kind === "bullet" ? "bullet" : byId.get(block.id)!;
    if (kind !== block.kind) changed += 1;
    if (kind === "heading") {
      section = block.text;
      return { ...block, kind, section: null };
    }
    return { ...block, kind, section };
  });

  if (blocks.some((b) => b.kind === "heading" && b.text.trim().length > HEADING_MAX)) return null;

  return { layout: { ...layout, blocks }, changed };
}
