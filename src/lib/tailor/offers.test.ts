import { describe, expect, it } from "vitest";
import type { Layout, Match, PlannedOp, Requirement } from "./types";
import { fallbackOffers } from "./offers";

/**
 * Every missing, non-knockout requirement should reach the user as a decision,
 * not as "no line to offer": a drafted line costs nothing until Add it, and
 * offering nothing decides for them.
 */

const layout = {
  format: "docx",
  pages: 1,
  fonts: [],
  warnings: [],
  blocks: [
    { id: "0", kind: "name", text: "Priya Sharma", lines: 1, has_bold: true, runs: [], size: 16, align: "left" },
    { id: "1", kind: "heading", text: "Experience", lines: 1, has_bold: false, runs: [], size: 12, align: "left" },
    { id: "2", kind: "bullet", text: "Built APIs", lines: 1, has_bold: false, runs: [], size: 11, align: "left" },
    { id: "3", kind: "bullet", text: "Fixed bugs", lines: 1, has_bold: false, runs: [], size: 11, align: "left" },
  ],
} as unknown as Layout;

function requirement(over: Partial<Requirement> = {}): Requirement {
  return {
    id: "r1",
    label: "Kafka",
    wording: "Experience with Kafka",
    kind: "skill",
    importance: "must",
    knockout: false,
    ...over,
  };
}

const needsOk: Match = { requirementId: "r1", status: "needs_ok", evidence: [] };

describe("fallbackOffers", () => {
  it("drafts a decision line for a missing requirement the planner offered nothing for", () => {
    const offers = fallbackOffers(layout, [requirement()], [needsOk], []);
    expect(offers).toHaveLength(1);
    const offer = offers[0];
    expect(offer.op).toBe("insert_after");
    expect(offer.claim).toBe("added_by_user");
    expect(offer.needsDecision).toBe(true);
    expect(offer.requirements).toEqual(["r1"]);
    expect(offer.text).toContain("Kafka");
    expect(offer.evidence).toEqual([]);
    // Anchored after the last bullet, never a frozen block.
    expect(offer.block).toBe("3");
  });

  it("offers nothing when the planner already drafted a line for it", () => {
    const drafted: PlannedOp = {
      id: "o1",
      op: "insert_after",
      block: "3",
      text: "Consumed Kafka events.",
      alternatives: [],
      claim: "added_by_user",
      value: 5,
      requirements: ["r1"],
      evidence: [],
      needsDecision: true,
    };
    expect(fallbackOffers(layout, [requirement()], [needsOk], [drafted])).toEqual([]);
  });

  it("never drafts for a knockout, a matched requirement, or a location/degree", () => {
    const reqs = [
      requirement({ id: "r1", knockout: true }),
      requirement({ id: "r2", label: "Java" }),
      requirement({ id: "r3", label: "Pune on-site", kind: "location" }),
      requirement({ id: "r4", label: "B.Tech", kind: "degree" }),
    ];
    const matches: Match[] = [
      { requirementId: "r1", status: "cannot_change", evidence: [] },
      { requirementId: "r2", status: "matched", evidence: ["2"] },
      { requirementId: "r3", status: "needs_ok", evidence: [] },
      { requirementId: "r4", status: "needs_ok", evidence: [] },
    ];
    expect(fallbackOffers(layout, reqs, matches, [])).toEqual([]);
  });

  it("never drafts a line containing a digit", () => {
    const reqs = [requirement({ label: "5+ years of Java", kind: "experience" })];
    expect(fallbackOffers(layout, reqs, [needsOk], [])).toEqual([]);
  });

  it("anchors a skill in the Skills section, not under a job", () => {
    // Placement changes the claim: "Familiar with X." under a role implies X
    // was used there — more than the user approved. Skills is the honest home.
    const sectioned = {
      ...layout,
      blocks: [
        { id: "0", kind: "name", text: "Priya Sharma", lines: 1, has_bold: true, runs: [], size: 16, align: "left" },
        { id: "1", kind: "heading", text: "Experience", lines: 1, has_bold: false, runs: [], size: 12, align: "left" },
        { id: "2", kind: "role", text: "01 Bot — Engineer\t2024", lines: 1, has_bold: true, runs: [], size: 11, align: "left", section: "Experience" },
        { id: "3", kind: "bullet", text: "Built bots", lines: 1, has_bold: false, runs: [], size: 11, align: "left", section: "Experience" },
        { id: "4", kind: "heading", text: "Technical Skills", lines: 1, has_bold: false, runs: [], size: 12, align: "left" },
        { id: "5", kind: "paragraph", text: "Python, SQL", lines: 1, has_bold: false, runs: [], size: 11, align: "left", section: "Technical Skills" },
        { id: "6", kind: "heading", text: "Achievements", lines: 1, has_bold: false, runs: [], size: 12, align: "left" },
        { id: "7", kind: "bullet", text: "Won a hackathon", lines: 1, has_bold: false, runs: [], size: 11, align: "left", section: "Achievements" },
      ],
    } as unknown as Layout;
    const offers = fallbackOffers(sectioned, [requirement({ kind: "skill" })], [needsOk], []);
    expect(offers[0].block).toBe("5");
  });

  it("anchors an experience requirement under the most recent role, not the document's tail", () => {
    const sectioned = {
      ...layout,
      blocks: [
        { id: "0", kind: "name", text: "Priya Sharma", lines: 1, has_bold: true, runs: [], size: 16, align: "left" },
        { id: "1", kind: "heading", text: "Experience", lines: 1, has_bold: false, runs: [], size: 12, align: "left" },
        { id: "2", kind: "role", text: "Razorfin — Engineer\t2024", lines: 1, has_bold: true, runs: [], size: 11, align: "left", section: "Experience" },
        { id: "3", kind: "bullet", text: "Built APIs", lines: 1, has_bold: false, runs: [], size: 11, align: "left", section: "Experience" },
        { id: "4", kind: "bullet", text: "Fixed bugs", lines: 1, has_bold: false, runs: [], size: 11, align: "left", section: "Experience" },
        { id: "5", kind: "role", text: "OldCo — Intern\t2022", lines: 1, has_bold: true, runs: [], size: 11, align: "left", section: "Experience" },
        { id: "6", kind: "bullet", text: "Interned", lines: 1, has_bold: false, runs: [], size: 11, align: "left", section: "Experience" },
        { id: "7", kind: "heading", text: "Achievements", lines: 1, has_bold: false, runs: [], size: 12, align: "left" },
        { id: "8", kind: "bullet", text: "Won a hackathon", lines: 1, has_bold: false, runs: [], size: 11, align: "left", section: "Achievements" },
      ],
    } as unknown as Layout;
    const reqs = [requirement({ label: "mentoring juniors", kind: "experience" })];
    const offers = fallbackOffers(sectioned, reqs, [needsOk], []);
    expect(offers[0].block).toBe("4");
  });

  it("lowercases a sentence-case label mid-sentence but never an acronym or name", () => {
    const reqs = [
      requirement({ id: "r1", label: "Professional software engineering best practices" }),
      requirement({ id: "r2", label: "Kafka" }),
      requirement({ id: "r3", label: "REST APIs" }),
    ];
    const matches: Match[] = reqs.map((r) => ({ requirementId: r.id, status: "needs_ok", evidence: [] }));
    const offers = fallbackOffers(layout, reqs, matches, []);
    expect(offers.map((o) => o.text)).toEqual([
      "Familiar with professional software engineering best practices.",
      "Familiar with Kafka.",
      "Familiar with REST APIs.",
    ]);
  });

  it("uses distinct ids that cannot collide with planner or heading ops", () => {
    const reqs = [requirement({ id: "r1" }), requirement({ id: "r2", label: "Docker" })];
    const matches: Match[] = [
      { requirementId: "r1", status: "needs_ok", evidence: [] },
      { requirementId: "r2", status: "needs_ok", evidence: [] },
    ];
    const offers = fallbackOffers(layout, reqs, matches, []);
    const ids = offers.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^offer-/);
  });
});
