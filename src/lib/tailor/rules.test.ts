/**
 * These are the promises the landing page makes out loud, so they get the
 * most tests in the codebase. Every case below is a thing the product says it
 * will never do.
 */
import { describe, expect, it } from "vitest";
import { allowedNumbers, checkOp, enforce, numbersIn, verifyMatches } from "./rules";
import type { Layout, Match, PlannedOp, Requirement } from "./types";

const layout: Layout = {
  format: "docx",
  pages: 1,
  fonts: ["Georgia"],
  warnings: [],
  blocks: [
    { id: "b0", kind: "name", text: "Priya Sharma", section: null, style: null, lines: 1, has_bold: true, runs: [], size: 10.5, space_before: 0 },
    { id: "b5", kind: "role", text: "Razorfin · Software Engineer, Backend\tAug 2024 – present", section: "EXPERIENCE", style: null, lines: 1, has_bold: true, runs: [], size: 10.5, space_before: 0 },
    { id: "b6", kind: "bullet", text: "Worked on backend APIs for payments.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
    { id: "b7", kind: "bullet", text: "Built a nightly job matching 2,10,000 transactions against bank files.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
    { id: "b8", kind: "bullet", text: "Wrote REST APIs in Java for 40 merchant partners.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: true, runs: [], size: 10.5, space_before: 0 },
  ],
};

const requirements: Requirement[] = [
  { id: "r1", label: "Kafka", wording: "Kafka", kind: "skill", importance: "must", knockout: false },
  { id: "r9", label: "Based in Pune, on-site", wording: "Pune, on-site", kind: "location", importance: "must", knockout: true },
];

const op = (over: Partial<PlannedOp> = {}): PlannedOp => ({
  id: "o1",
  op: "rephrase",
  block: "b6",
  text: "Cut payment API latency using async Spring Boot workers.",
  alternatives: [],
  claim: "reworded",
  value: 8,
  requirements: ["r1"],
  evidence: ["b6"],
  needsDecision: false,
  ...over,
});

const rules = (o: PlannedOp) => checkOp(o, layout, requirements).map((v) => v.rule);

describe("numbersIn", () => {
  it("reads Indian digit grouping as one number", () => {
    expect(numbersIn("matched 2,10,000 transactions")).toEqual(["210000"]);
  });

  it("keeps decimals whole", () => {
    expect(numbersIn("CGPA 8.4")).toEqual(["8.4"]);
  });

  it("finds numbers embedded in a token", () => {
    expect(numbersIn("cut p95 latency to 310ms")).toEqual(["95", "310"]);
  });
});

describe("never invent a number", () => {
  it("allows a number carried over from the line being rewritten", () => {
    const rewrite = op({ block: "b7", evidence: ["b7"], text: "Reconciled 210000 transactions nightly." });
    expect(rules(rewrite)).toEqual([]);
  });

  it("allows a number from another line the change is based on", () => {
    const rewrite = op({ block: "b6", evidence: ["b6", "b8"], text: "Served 40 merchant partners on REST APIs." });
    expect(rules(rewrite)).toEqual([]);
  });

  it("rejects a figure that appears nowhere at all", () => {
    expect(rules(op({ text: "Cut latency by 63% and saved 12 hours a week." }))).toContain(
      "invented_number",
    );
  });

  it("rejects a figure lifted from an unrelated line it does not cite", () => {
    /* 40 exists in the resume — as "40 merchant partners", nothing to do with
       latency. A whole-document check would have waved this through. */
    expect(rules(op({ block: "b6", evidence: ["b6"], text: "Cut latency by 40%." }))).toContain(
      "invented_number",
    );
  });

  it("rejects the exact invention the guardrails name", () => {
    /* docs/01-product.md: "Cut latency by 40% using Kafka" is never drafted for
       an unbacked skill. An added line cites no evidence, so it may carry no
       figures whatsoever. */
    const violations = checkOp(
      op({
        op: "insert_after",
        claim: "added_by_user",
        needsDecision: true,
        evidence: [],
        text: "Cut latency by 40% using Kafka.",
      }),
      layout,
      requirements,
    );
    expect(violations.map((v) => v.rule)).toContain("invented_number");
  });
});

describe("never rewrite a title or a date", () => {
  it("rejects rephrasing a role line", () => {
    expect(rules(op({ block: "b5", text: "Razorfin · Senior Engineer\tAug 2023 – present" }))).toContain(
      "rewrote_title_or_date",
    );
  });

  it("rejects removing a role line", () => {
    expect(rules(op({ op: "remove", block: "b5", text: undefined }))).toContain(
      "rewrote_title_or_date",
    );
  });

  it("rejects rewriting the name", () => {
    expect(rules(op({ block: "b0", text: "Priya S." }))).toContain("rewrote_title_or_date");
  });

  it("still allows inserting a bullet under a role", () => {
    const violations = rules(
      op({ op: "insert_after", block: "b5", text: "Consumed payment events from Kafka topics." }),
    );
    expect(violations).toEqual([]);
  });
});

describe("never fake a knockout", () => {
  it("rejects an edit that claims to answer the location requirement", () => {
    expect(rules(op({ requirements: ["r9"], text: "Based in Pune and open to on-site work." }))).toContain(
      "faked_knockout",
    );
  });
});

describe("never introduce formatting the line did not have", () => {
  it("rejects bold on a line with none of its own", () => {
    expect(rules(op({ block: "b6", text: "Built **Spring Boot** services." }))).toContain(
      "introduced_bold",
    );
  });

  it("allows bold on a line that already had some", () => {
    expect(rules(op({ block: "b8", text: "Wrote REST APIs in **Java** for 40 partners." }))).toEqual([]);
  });
});

describe("a drafted line is modest, and always a decision", () => {
  const added = (text: string, over: Partial<PlannedOp> = {}) =>
    op({
      claim: "added_by_user",
      needsDecision: true,
      op: "insert_after",
      evidence: [],
      text,
      ...over,
    });

  it("accepts the modest wording the spec uses", () => {
    expect(rules(added("Consumed payment events from Kafka topics to update the ledger."))).toEqual(
      [],
    );
  });

  it.each(["Led the Kafka migration.", "Architected the event pipeline.", "Owned the ledger service."])(
    "rejects %s as above the user's seniority",
    (text) => {
      expect(rules(added(text))).toContain("overstated_verb");
    },
  );

  it("rejects an added line that is not offered as a decision", () => {
    /* The promise is "nothing added behind your back", so this is structural. */
    expect(rules(added("Consumed payment events from Kafka.", { needsDecision: false }))).toContain(
      "unapproved_addition",
    );
  });

  it("does not police verbs on the user's own reworded facts", () => {
    /* "Led" is fine if the user already said they led it. */
    expect(rules(op({ claim: "reworded", text: "Led code reviews for the payments team." }))).toEqual(
      [],
    );
  });
});

describe("enforce", () => {
  it("drops only the offending operation and keeps the rest", () => {
    const good = op({ id: "good", evidence: ["b6", "b8"], text: "Served 40 merchant partners." });
    const bad = op({ id: "bad", text: "Cut costs by 63%." });

    const result = enforce([good, bad], layout, requirements);

    expect(result.operations.map((o) => o.id)).toEqual(["good"]);
    expect(result.violations).toEqual([
      { opId: "bad", rule: "invented_number", message: expect.stringContaining("63") },
    ]);
  });

  it("rejects an operation aimed at a block that does not exist", () => {
    const result = enforce([op({ id: "ghost", block: "b999" })], layout, requirements);
    expect(result.operations).toEqual([]);
    expect(result.violations[0].rule).toBe("unknown_block");
  });
});

describe("a rewording never acquires a skill the resume lacks", () => {
  /* Reproduces a real planner output. "Helped refactor the refunds module."
     came back as a `reworded` op reading "...to support event-driven streaming
     with Kafka" — Kafka appears nowhere in Priya's resume, and `reworded`
     applies with no decision. Every other rule waved it through. */
  const kafkaRequirements: Requirement[] = [
    { id: "r1", label: "Apache Kafka in production", wording: "Apache Kafka in production", kind: "skill", importance: "must", knockout: false },
    { id: "r2", label: "REST APIs", wording: "consuming REST APIs", kind: "skill", importance: "must", knockout: false },
  ];
  const kafkaMatches: Match[] = [
    { requirementId: "r1", status: "needs_ok", evidence: [] },
    { requirementId: "r2", status: "matched", evidence: ["b8"] },
  ];
  const check = (o: PlannedOp) => checkOp(o, layout, kafkaRequirements, kafkaMatches).map((v) => v.rule);

  it("rejects the smuggled Kafka rewording", () => {
    const smuggled = op({
      block: "b6",
      evidence: ["b6"],
      claim: "reworded",
      text: "Refactored the refunds module to support event-driven streaming with Kafka.",
    });
    expect(check(smuggled)).toContain("smuggled_skill");
  });

  it("still allows the same line to be offered as a decision", () => {
    /* The skill isn't banned — it just has to be asked about. */
    const offered = op({
      op: "insert_after",
      block: "b6",
      evidence: [],
      claim: "added_by_user",
      needsDecision: true,
      text: "Consumed payment events from Kafka topics to update the ledger.",
    });
    expect(check(offered)).toEqual([]);
  });

  it("allows a rewording to use a skill the resume genuinely has", () => {
    const honest = op({
      block: "b6",
      evidence: ["b6", "b8"],
      claim: "reworded",
      text: "Built REST APIs in Java for payments.",
    });
    expect(check(honest)).toEqual([]);
  });

  it("does not trip on ordinary words that happen to sit in a label", () => {
    /* "production" and "in" are in the label too; only the proper nouns count,
       or every sentence would be a violation. */
    const ordinary = op({
      block: "b6",
      evidence: ["b6"],
      claim: "reworded",
      text: "Moved the payments work into production for merchant partners.",
    });
    expect(ordinary && check(ordinary)).toEqual([]);
  });
});

describe("allowedNumbers", () => {
  it("scopes to the target line plus its cited evidence", () => {
    expect(allowedNumbers(op({ block: "b7", evidence: ["b8"] }), layout)).toEqual(
      new Set(["210000", "40"]),
    );
  });

  it("is empty for an added line, which cites nothing", () => {
    expect(allowedNumbers(op({ block: "b6", evidence: [] }), layout)).toEqual(new Set());
  });
});

describe("verifyMatches", () => {
  const reqs: Requirement[] = [
    { id: "r1", label: "Kubernetes", wording: "Kubernetes is a nice to have", kind: "skill", importance: "nice", knockout: false },
    { id: "r2", label: "Java", wording: "3+ years building backend services in Java", kind: "skill", importance: "must", knockout: false },
    { id: "r3", label: "Mentoring junior engineers", wording: "Mentor junior engineers", kind: "skill", importance: "must", knockout: false },
  ];
  const resume: Layout = {
    ...layout,
    blocks: [
      { id: "b9", kind: "bullet", text: "Mentored 2 junior engineers through their first on-call rotations.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
      { id: "b15", kind: "paragraph", text: "Python, Git, Docker, Java, Spring Boot, AWS, PostgreSQL, Redis", section: "SKILLS", style: null, lines: 1, has_bold: false, runs: [], size: 10.5, space_before: 0 },
    ],
  };

  it("downgrades a match the resume does not back", () => {
    /* The live failure: Kubernetes marked matched against a skills line that
       does not contain it. */
    const claimed: Match[] = [{ requirementId: "r1", status: "matched", evidence: ["b15"] }];
    const { matches, downgraded } = verifyMatches(claimed, reqs, resume);
    expect(matches[0].status).toBe("needs_ok");
    expect(matches[0].evidence).toEqual([]);
    expect(downgraded).toEqual(["Kubernetes"]);
  });

  it("keeps a match the resume really does back", () => {
    const claimed: Match[] = [{ requirementId: "r2", status: "matched", evidence: ["b15"] }];
    expect(verifyMatches(claimed, reqs, resume).downgraded).toEqual([]);
  });

  it("keeps a match across a change of word ending", () => {
    /* The job says "Mentoring", the resume says "Mentored". Same fact. */
    const claimed: Match[] = [{ requirementId: "r3", status: "matched", evidence: ["b9"] }];
    expect(verifyMatches(claimed, reqs, resume).downgraded).toEqual([]);
  });

  it("leaves statuses other than matched alone", () => {
    const claimed: Match[] = [{ requirementId: "r1", status: "needs_ok", evidence: [] }];
    expect(verifyMatches(claimed, reqs, resume).matches[0].status).toBe("needs_ok");
  });
});

describe("never destroy a hyperlink", () => {
  /* The editor rewrites a paragraph run by run, and a hyperlink's text is not
     one of those runs. Rephrasing a contact line would drop the email and the
     profile URL and leave "+91 90000 00000 |  | " behind. */
  const linked: Layout = {
    ...layout,
    blocks: [
      { id: "b1", kind: "contact", text: "+91 90000 00000 | asha@example.com", section: null, style: null, lines: 1, has_bold: false, has_link: true, runs: [], size: 10, space_before: 0 },
      { id: "b6", kind: "bullet", text: "Shipped the payments API.", section: "EXPERIENCE", style: "List Bullet", lines: 1, has_bold: false, has_link: true, runs: [], size: 10, space_before: 0 },
    ],
  };

  it("rejects rewriting a bullet that carries a link", () => {
    const violations = checkOp(op({ block: "b6", evidence: ["b6"], text: "Shipped the payments API for merchants." }), linked, requirements);
    expect(violations.map((v) => v.rule)).toContain("would_drop_a_link");
  });

  it("still allows inserting a new line after one", () => {
    const violations = checkOp(
      op({ op: "insert_after", block: "b6", evidence: [], claim: "added_by_user", needsDecision: true, text: "Worked with Kafka topics." }),
      linked,
      requirements,
    );
    expect(violations).toEqual([]);
  });
});
