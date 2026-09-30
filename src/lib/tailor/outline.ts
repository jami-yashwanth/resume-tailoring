import type { Label } from "./structure";
import type { Entry, Layout, Outline, Ref, Section, SkillRow } from "./types";

/**
 * Checking an outline against the layout it claims to describe.
 *
 * The model proposes where each line belongs and which words of a merged line
 * (an employer and its dates share one tabbed line) are which field. Nothing it
 * returns is trusted: every value must be a verbatim piece of its block, the
 * pieces of one block must account for all of it, and every block must be
 * placed exactly once. Anything else is rejected whole, so what reaches the
 * template is only ever the user's own words.
 */

/** Longest line that can still be a section heading. The parser's own cap is
 *  40; a little headroom for "Certifications and Professional Development". */
export const HEADING_MAX = 60;

/** Tabs, newlines and runs of spaces become one space. */
export function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const strip = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * True when `parts` together are the whole of `blockText`, ignoring case and
 * anything that is not a letter or digit. This lets a line be split at a tab or
 * a comma, but not lose or gain a word.
 */
export function coversExactly(blockText: string, parts: string[]): boolean {
  const whole = strip(blockText);
  const used = new Array<boolean>(whole.length).fill(false);
  for (const part of parts) {
    const piece = strip(part);
    if (!piece) return false;
    let at = whole.indexOf(piece);
    while (at !== -1 && used.slice(at, at + piece.length).some(Boolean)) at = whole.indexOf(piece, at + 1);
    if (at === -1) return false;
    used.fill(true, at, at + piece.length);
  }
  return used.every(Boolean);
}

export type OutlineCheck = { ok: true; outline: Outline } | { ok: false; reason: string; missing: string[] };

const fail = (reason: string, missing: string[] = []): OutlineCheck => ({ ok: false, reason, missing });

const FIELDS = ["org", "title", "dates", "place"] as const;

/** Verify an outline against the layout, and return it sorted into document order. */
export function checkOutline(layout: Layout, outline: Outline): OutlineCheck {
  const index = new Map(layout.blocks.map((b, i) => [b.id, i]));
  const blockOf = new Map(layout.blocks.map((b) => [b.id, b]));

  // Whole-block placements (name, contact, heading, bullets, lines), skill rows
  // and field pieces are tracked apart: several fields may share one block, but
  // nothing else may share with anything.
  const whole = new Set<string>();
  const pieces = new Map<string, string[]>();
  const pieceBlocks = new Set<string>();
  let problem: OutlineCheck | null = null;
  const reject = (result: OutlineCheck) => {
    problem ??= result;
  };

  const known = (id: string) => {
    if (blockOf.has(id)) return true;
    reject(fail(`unknown block ${id}`));
    return false;
  };
  const placeWhole = (id: string, allowBullet: boolean) => {
    if (!known(id)) return;
    if (whole.has(id) || pieceBlocks.has(id)) return reject(fail(`block ${id} used twice`));
    if (!allowBullet && blockOf.get(id)!.kind === "bullet") return reject(fail(`bullet ${id} used as a field`));
    whole.add(id);
  };
  const placePiece = (id: string, texts: string[]) => {
    if (!known(id)) return;
    const b = blockOf.get(id)!;
    if (whole.has(id)) return reject(fail(`block ${id} used twice`));
    if (b.kind === "bullet") return reject(fail(`bullet ${id} used as a field`));
    const flat = collapse(b.text);
    for (const text of texts) {
      if (!text || !flat.includes(text)) return reject(fail(`text not in block ${id}: ${text}`));
    }
    pieceBlocks.add(id);
    pieces.set(id, [...(pieces.get(id) ?? []), ...texts]);
  };
  const placeSkill = (row: SkillRow) => {
    if (!known(row.block)) return;
    if (pieceBlocks.has(row.block) || whole.has(row.block)) return reject(fail(`block ${row.block} used twice`));
    placePiece(row.block, row.label === null ? [row.items] : [row.label, row.items]);
  };

  if (outline.name !== null) placeWhole(outline.name, false);
  for (const id of outline.contact) placeWhole(id, false);
  for (const s of outline.sections) {
    if (s.heading !== null) {
      placeWhole(s.heading, false);
      const h = blockOf.get(s.heading);
      if (h && h.text.trim().length > HEADING_MAX) reject(fail(`heading ${s.heading} too long`));
    }
    for (const id of s.lines) placeWhole(id, true);
    for (const row of s.skills) placeSkill(row);
    for (const e of s.entries) {
      for (const field of FIELDS) {
        const ref = e[field];
        if (ref) placePiece(ref.block, [ref.text]);
      }
      for (const id of e.bullets) placeWhole(id, true);
      for (const id of e.lines) placeWhole(id, true);
    }
  }
  if (problem) return problem;

  for (const [id, parts] of pieces) {
    if (!coversExactly(blockOf.get(id)!.text, parts)) return fail(`block ${id} not fully covered`);
  }

  const missing = layout.blocks.map((b) => b.id).filter((id) => !whole.has(id) && !pieceBlocks.has(id));
  if (missing.length) return fail("missing blocks", missing);

  // Order is the file's, not the model's.
  const at = (id: string) => index.get(id)!;
  const byPosition = (ids: string[]) => [...ids].sort((a, b) => at(a) - at(b));
  const first = (ids: (string | null | undefined)[]) =>
    Math.min(Infinity, ...ids.filter((id): id is string => !!id).map(at));
  const refIds = (e: Entry) => FIELDS.map((f) => e[f]?.block);
  const entryStart = (e: Entry) => first([...refIds(e), ...e.bullets, ...e.lines]);

  const sections: Section[] = outline.sections.map((s) => ({
    ...s,
    lines: byPosition(s.lines),
    skills: [...s.skills].sort((a, b) => at(a.block) - at(b.block)),
    entries: s.entries
      .map((e) => ({ ...e, bullets: byPosition(e.bullets), lines: byPosition(e.lines) }))
      .sort((a, b) => entryStart(a) - entryStart(b)),
  }));
  const sectionStart = (s: Section) =>
    Math.min(first([s.heading, ...s.lines, ...s.skills.map((r) => r.block)]), ...s.entries.map(entryStart));
  sections.sort((a, b) => sectionStart(a) - sectionStart(b));

  return { ok: true, outline: { name: outline.name, contact: byPosition(outline.contact), sections } };
}

/** The labels an outline implies, in the shape `applyStructure` takes. */
export function outlineLabels(outline: Outline): Label[] {
  const labels = new Map<string, Label["kind"]>();
  const set = (id: string | null | undefined, kind: Label["kind"]) => {
    if (id) labels.set(id, kind);
  };
  set(outline.name, "name");
  for (const id of outline.contact) set(id, "contact");
  for (const s of outline.sections) {
    set(s.heading, "heading");
    for (const id of s.lines) set(id, "paragraph");
    for (const row of s.skills) set(row.block, "paragraph");
    for (const e of s.entries) {
      for (const field of FIELDS) set((e[field] as Ref | null)?.block, "role");
      for (const id of e.bullets) set(id, "bullet");
      for (const id of e.lines) set(id, "paragraph");
    }
  }
  return [...labels].map(([id, kind]) => ({ id, kind }));
}
