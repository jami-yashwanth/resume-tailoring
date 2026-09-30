import type { Entry, Outline, SectionKind } from "./types";
import type { RenderedLine } from "./view";

/**
 * The resume as the template renders it: the outline's structure filled with
 * the user's decided text. Field names mirror the Pydantic models in docsvc.
 *
 * An Item keeps its bullet mark (a bullet is a fact about the file) and every
 * list of items is in document order, so a "Tech: ..." line after an entry's
 * bullets stays after them.
 */
export type Item = { text: string; bullet: boolean };
export type TemplateEntry = {
  org: string | null;
  title: string | null;
  dates: string | null;
  place: string | null;
  items: Item[];
};
export type TemplateSection = {
  heading: string | null;
  kind: SectionKind;
  /** Loose lines that come before the section's first entry or skill row. */
  lead: Item[];
  entries: TemplateEntry[];
  skills: { label: string | null; items: string }[];
  /** Loose lines after that, in order. */
  items: Item[];
};
export type TemplateDocument = {
  name: string | null;
  contact: string[];
  sections: TemplateSection[];
};

/**
 * "Languages: Python, Go" -> label + items. The label survives only while the
 * (possibly reworded) text still starts with it; otherwise the whole text is
 * items, so a rewording can never leave a stale label in front of new content.
 */
export function splitSkillRow(
  text: string,
  label: string | null,
): { label: string | null; items: string } {
  if (label && text.startsWith(label)) {
    const rest = text.slice(label.length).replace(/^ */, "");
    if (rest.startsWith(":")) return { label, items: rest.slice(1).trim() };
  }
  return { label: null, items: text };
}

/**
 * Resolve the outline against `lines` (built with `group = false`). A block's
 * text is every line carrying its id that is not removed or pending, in order,
 * so rewordings replace, approved inserts follow their anchor and removals drop.
 */
export function resolveDocument(outline: Outline, lines: RenderedLine[]): TemplateDocument {
  const byBlock = new Map<string, RenderedLine[]>();
  // Where a block first appears in `lines` (document order), whatever its state.
  const position = new Map<string, number>();
  lines.forEach((l, i) => {
    if (!position.has(l.blockId)) position.set(l.blockId, i);
    if (l.state === "removed" || l.state === "pending") return;
    const list = byBlock.get(l.blockId);
    if (list) list.push(l);
    else byBlock.set(l.blockId, [l]);
  });
  const at = (id: string) => position.get(id) ?? Infinity;
  const byPosition = (ids: string[]) => [...ids].sort((a, b) => at(a) - at(b));
  const resolved = (id: string) => byBlock.get(id) ?? [];
  const texts = (id: string) => resolved(id).map((l) => l.text);
  const items = (ids: string[]): Item[] =>
    byPosition(ids).flatMap((id) => resolved(id).map((l) => ({ text: l.text, bullet: l.kind === "bullet" })));
  // Inserted lines are the `added` ones; the rest is the block's own line.
  const own = (id: string) => resolved(id).find((l) => l.state !== "added")?.text ?? null;
  const inserted = (id: string) =>
    resolved(id).filter((l) => l.state === "added").map((l) => l.text);
  // An insert anchored to a header or heading has no slot of its own: it
  // leads what follows, as a plain line.
  const plain = (text: string): Item => ({ text, bullet: false });

  return {
    name: outline.name === null ? null : own(outline.name),
    // An insert after the name has no slot of its own, so it leads the contact.
    contact: [
      ...(outline.name === null ? [] : inserted(outline.name)),
      ...outline.contact.flatMap(texts),
    ],
    sections: outline.sections.map((s) => {
      const headerBlocks = (e: Entry) =>
        // A block split across fields (org + dates) is looked up once.
        [...new Set([e.org, e.title, e.dates, e.place].flatMap((r) => (r ? [r.block] : [])))];
      const structureStart = Math.min(
        Infinity,
        ...s.entries.flatMap((e) => [...headerBlocks(e), ...e.bullets, ...e.lines]).map(at),
        ...s.skills.map((r) => at(r.block)),
      );
      const lead = s.lines.filter((id) => at(id) < structureStart);
      const rest = s.lines.filter((id) => at(id) >= structureStart);
      return {
        heading: s.heading === null ? null : own(s.heading),
        kind: s.kind,
        lead: [...(s.heading === null ? [] : inserted(s.heading).map(plain)), ...items(lead)],
        // Header fields come from the ref, never from a reworded line: titles and
        // dates are not rewritten by rule. Empty entries are kept, not dropped.
        entries: s.entries.map((e) => ({
          org: e.org?.text ?? null,
          title: e.title?.text ?? null,
          dates: e.dates?.text ?? null,
          place: e.place?.text ?? null,
          items: [...headerBlocks(e).flatMap(inserted).map(plain), ...items([...e.bullets, ...e.lines])],
        })),
        skills: s.skills.flatMap((row) => {
          const [first, ...inserts] = texts(row.block);
          return [
            ...(first === undefined ? [] : [splitSkillRow(first, row.label)]),
            ...inserts.map((items) => ({ label: null, items })),
          ];
        }),
        items: items(rest),
      };
    }),
  };
}
