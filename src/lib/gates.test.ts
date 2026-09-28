import { describe, expect, it } from "vitest";
import { ANONYMOUS, checkDownload, checkTailor, gatesEnforced } from "./gates";
import { checkOp } from "./tailor/rules";
import type { Layout, PlannedOp, Requirement } from "./tailor/types";

const env = (v?: string) =>
  ({ REZZ_ENFORCE_GATES: v }) as unknown as NodeJS.ProcessEnv;

describe("gatesEnforced", () => {
  it("is on when the variable is missing", () => {
    /* The default has to be the safe one: a forgotten variable in production
       must not open the paywall. */
    expect(gatesEnforced({} as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("is off only for the exact string false", () => {
    expect(gatesEnforced(env("false"))).toBe(false);
    expect(gatesEnforced(env("FALSE"))).toBe(false);
    expect(gatesEnforced(env(" false "))).toBe(false);
  });

  it("fails closed on anything else, including a typo", () => {
    for (const value of ["true", "0", "no", "flase", "off", ""]) {
      expect(gatesEnforced(env(value))).toBe(true);
    }
  });
});

describe("checkDownload", () => {
  it("lets everyone through while the gates are off", () => {
    expect(checkDownload(ANONYMOUS, env("false"))).toEqual({
      allowed: true,
      reason: "gates_disabled",
    });
  });

  it("asks an anonymous person to sign in", () => {
    expect(checkDownload(ANONYMOUS, env())).toEqual({ allowed: false, gate: "sign_in" });
  });

  it("asks for a pass once the credits are gone", () => {
    expect(checkDownload({ signedIn: true, creditsLeft: 0 }, env())).toEqual({
      allowed: false,
      gate: "pass",
    });
  });

  it("allows a signed-in person with credit", () => {
    expect(checkDownload({ signedIn: true, creditsLeft: 3 }, env()).allowed).toBe(true);
  });

  it("treats null credits as unlimited", () => {
    expect(checkDownload({ signedIn: true, creditsLeft: null }, env()).allowed).toBe(true);
  });

  it("asks for sign-in before money", () => {
    /* We cannot know what someone is entitled to until we know who they are,
       and asking for payment before a phone number is the wrong way round. */
    const broke = { signedIn: false, creditsLeft: 0 };
    expect(checkDownload(broke, env())).toEqual({ allowed: false, gate: "sign_in" });
  });
});

describe("nothing before the Result screen asks for anything", () => {
  it("never gates tailoring, even with the gates on", () => {
    /* "No sign-up to try" is the position. JobOwl requires an account before
       you see any result; this is the opposite and it is a rule, not a habit. */
    expect(checkTailor().allowed).toBe(true);
  });
});

describe("the switch removes gates, never guardrails", () => {
  const layout: Layout = {
    format: "docx",
    pages: 1,
    fonts: ["Georgia"],
    warnings: [],
    blocks: [
      { id: "b6", kind: "bullet", text: "Worked on backend APIs for payments.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
    ],
  };
  const requirements: Requirement[] = [
    { id: "r1", label: "Kafka", wording: "Apache Kafka", kind: "skill", importance: "must", knockout: false },
  ];
  const invented: PlannedOp = {
    id: "o1",
    op: "rephrase",
    block: "b6",
    text: "Cut payment latency by 63%.",
    alternatives: [],
    claim: "reworded",
    value: 8,
    requirements: [],
    evidence: ["b6"],
    needsDecision: false,
  };

  it("rejects an invented number with the gates on and with them off", () => {
    const before = process.env.REZZ_ENFORCE_GATES;
    try {
      for (const setting of ["false", "true"]) {
        process.env.REZZ_ENFORCE_GATES = setting;
        const violations = checkOp(invented, layout, requirements).map((v) => v.rule);
        expect(violations, `gates=${setting}`).toContain("invented_number");
      }
    } finally {
      if (before === undefined) delete process.env.REZZ_ENFORCE_GATES;
      else process.env.REZZ_ENFORCE_GATES = before;
    }
  });

  it("keeps the honesty rules free of the switch entirely", async () => {
    /* Cheaper and stricter than behavioural checks: the guardrails must not
       even be able to read the switch. */
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./tailor/rules.ts", import.meta.url), "utf8"),
    );
    expect(source).not.toContain("REZZ_ENFORCE_GATES");
    expect(source).not.toContain("process.env");
  });
});
