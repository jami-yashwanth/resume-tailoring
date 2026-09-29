import { describe, expect, it } from "vitest";
import { GAPS, gapBetween, resolveBulletLevels } from "./template-metrics";
import type { BlockKind } from "./types";

describe("resolveBulletLevels", () => {
  it("keeps bullets straight under a heading at level one", () => {
    const kinds: BlockKind[] = ["heading", "bullet", "bullet"];
    expect(resolveBulletLevels(kinds)).toEqual(["heading", "bullet", "bullet"]);
  });

  it("nests bullets under a role until the next heading", () => {
    const kinds: BlockKind[] = [
      "heading",
      "role",
      "job_title",
      "bullet",
      "bullet",
      "heading",
      "bullet",
    ];
    expect(resolveBulletLevels(kinds)).toEqual([
      "heading",
      "role",
      "job_title",
      "bullet2",
      "bullet2",
      "heading",
      "bullet",
    ]);
  });
});

describe("gapBetween", () => {
  it("is zero above the first block", () => {
    expect(gapBetween(null, "name")).toBe(0);
  });

  it("returns the measured value for a known pair", () => {
    expect(gapBetween("job_title", "bullet2")).toBe(GAPS["job_title>bullet2"]);
    expect(gapBetween("bullet2", "bullet2")).toBe(GAPS["bullet2>bullet2"]);
    expect(gapBetween("heading", "role")).toBe(GAPS["heading>role"]);
  });

  it("falls back to the default for an unmeasured pair", () => {
    expect(gapBetween("paragraph", "bullet")).toBe(GAPS.default);
  });
});
