import { describe, expect, it } from "vitest";
import { normaliseHeading } from "./headings";

describe("normaliseHeading", () => {
  it("maps a heading a parser would not recognise to the standard name", () => {
    expect(normaliseHeading("Professional Journey")).toEqual({
      from: "Professional Journey",
      to: "Experience",
    });
    expect(normaliseHeading("Academics")?.to).toBe("Education");
    expect(normaliseHeading("Tech Stack")?.to).toBe("Skills");
    expect(normaliseHeading("Career Objective")?.to).toBe("Summary");
  });

  it("ignores case, punctuation and the spelling of '&'", () => {
    expect(normaliseHeading("SKILLS & TOOLS:")?.to).toBe("Skills");
    expect(normaliseHeading("  work  experience  ")?.to).toBe("Experience");
    expect(normaliseHeading("EMPLOYMENT HISTORY")?.to).toBe("Experience");
  });

  it("leaves a heading that is already standard alone", () => {
    // Not a no-op op in the review list for the user to read and dismiss. The
    // template uppercases every heading anyway, so case alone is not a change.
    expect(normaliseHeading("Experience")).toBeNull();
    expect(normaliseHeading("EXPERIENCE")).toBeNull();
    expect(normaliseHeading("Skills")).toBeNull();
  });

  it("leaves a heading it does not recognise alone rather than guessing", () => {
    // The cost of guessing wrong is rewriting the user's resume on a hunch,
    // which is worse than the section keeping a name some parsers miss.
    expect(normaliseHeading("My Work")).toBeNull();
    expect(normaliseHeading("Extra-Curriculars")).toBeNull();
    expect(normaliseHeading("Publications")).toBeNull();
    expect(normaliseHeading("")).toBeNull();
  });
});
