import type { Outline, SectionKind } from "./types";
import type { RenderedLine } from "./view";

/**
 * The resume as the template renders it: the outline's structure filled with
 * the user's decided text. Field names mirror the Pydantic models in docsvc.
 */
export type TemplateEntry = {
  org: string | null;
  title: string | null;
  dates: string | null;
  place: string | null;
  bullets: string[];
  lines: string[];
};
export type TemplateSection = {
  heading: string | null;
  kind: SectionKind;
  entries: TemplateEntry[];
  skills: { label: string | null; items: string }[];
  lines: string[];
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
  const byBlock = new Map<string, string[]>();
  for (const l of lines) {
    if (l.state === "removed" || l.state === "pending") continue;
    const list = byBlock.get(l.blockId);
    if (list) list.push(l.text);
    else byBlock.set(l.blockId, [l.text]);
  }
  const texts = (id: string) => byBlock.get(id) ?? [];
  const many = (ids: string[]) => ids.flatMap(texts);

  return {
    name: outline.name === null ? null : (texts(outline.name)[0] ?? null),
    contact: many(outline.contact),
    sections: outline.sections.map((s) => ({
      heading: s.heading === null ? null : (texts(s.heading)[0] ?? null),
      kind: s.kind,
      // Header fields come from the ref, never from a reworded line: titles and
      // dates are not rewritten by rule. Empty entries are kept, not dropped.
      entries: s.entries.map((e) => ({
        org: e.org?.text ?? null,
        title: e.title?.text ?? null,
        dates: e.dates?.text ?? null,
        place: e.place?.text ?? null,
        bullets: many(e.bullets),
        lines: many(e.lines),
      })),
      skills: s.skills.flatMap((row) => {
        const [first, ...inserts] = texts(row.block);
        return [
          ...(first === undefined ? [] : [splitSkillRow(first, row.label)]),
          ...inserts.map((items) => ({ label: null, items })),
        ];
      }),
      lines: many(s.lines),
    })),
  };
}
