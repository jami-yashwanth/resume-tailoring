import { describe, expect, it } from "vitest";
import { shorten } from "./planner";

describe("shorten", () => {
  it("keeps a note that is already one short sentence", () => {
    expect(shorten("You're in Bengaluru. We never change this.")).toBe("You're in Bengaluru.");
  });

  it("cuts the reasoning a model volunteers", () => {
    /* Real planner output. It is not wrong, it is just written about the
       candidate instead of to them, and it is four times too long for the
       two lines the left panel gives it. */
    const verbose =
      "Candidate has ~1 year of Java experience (Jul 2023 – Jul 2024 at Kitebyte), " +
      "but job requires 3+ years. This is a knockout requirement.";
    const result = shorten(verbose)!;
    expect(result.length).toBeLessThanOrEqual(91);
    expect(result).not.toContain("knockout requirement");
  });

  it("breaks on a word, not mid-word", () => {
    const result = shorten("a".repeat(30) + " " + "b".repeat(80))!;
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/b{5,}…$/);
  });

  it("passes through nothing when there is no note", () => {
    expect(shorten(undefined)).toBeUndefined();
    expect(shorten("")).toBeUndefined();
  });
});
