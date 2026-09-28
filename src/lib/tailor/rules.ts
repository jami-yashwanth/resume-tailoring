/**
 * The hard rules. Code, not prompting.
 *
 * `docs/01-product.md` lists these under "Guardrails that stay regardless" and
 * `docs/05-architecture.md` repeats them as "hard rules in code". A model told
 * not to invent a number is usually right; a function that refuses to pass one
 * through is always right, and the product's whole pitch is to an audience that
 * has been lied to by this category before.
 *
 * Every check is pure and needs no API call, which is why this is the piece
 * with the most tests.
 */
import type { Block, Layout, Match, PlannedOp, Requirement } from "./types";

export type Rule =
  | "invented_number"
  | "rewrote_title_or_date"
  | "faked_knockout"
  | "introduced_bold"
  | "overstated_verb"
  | "unapproved_addition"
  | "smuggled_skill"
  | "would_drop_a_link"
  | "unknown_block";

export type Violation = {
  opId: string;
  rule: Rule;
  message: string;
};

/** Verbs that claim ownership or seniority. Banned on a line describing work
 *  the user never told us they did. */
const OVERSTATED = [
  "architected",
  "spearheaded",
  "pioneered",
  "founded",
  "led",
  "owned",
  "directed",
  "headed",
  "oversaw",
  "managed",
  "drove",
  "established",
];

/** Blocks whose text is never rewritten: the user's name, their contact line,
 *  and any role line, because that is where job titles and dates live. */
const FROZEN_KINDS = new Set<Block["kind"]>(["name", "contact", "role"]);

export function numbersIn(text: string): string[] {
  // Indian digit grouping is common in these resumes ("2,10,000"), so commas
  // come out before the match rather than splitting one number into three.
  return [...text.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
}

/**
 * The numbers a given change is allowed to use: those in the line it rewrites,
 * plus those in the lines it cites as its basis.
 *
 * Deliberately *not* every number in the resume. "Cut latency by 40%" would
 * pass that looser test on a resume that happens to mention 40 merchant
 * partners elsewhere — the digit exists, the fact does not. Scoping to the
 * cited evidence is what makes "numbers must match a fact exactly" mean
 * something, and it falls out correctly for an added line, which cites nothing
 * and may therefore carry no figures at all.
 */
export function allowedNumbers(op: PlannedOp, layout: Layout): Set<string> {
  const sources = [op.block, ...op.evidence];
  return new Set(
    layout.blocks.filter((b) => sources.includes(b.id)).flatMap((b) => numbersIn(b.text)),
  );
}

/**
 * The distinctive names inside a requirement label — "Apache Kafka in
 * production" gives Apache and Kafka, "Kubernetes" gives Kubernetes.
 *
 * Capitalisation is the signal. A technology is a proper noun in a job
 * description, and matching on those rather than on every word is what keeps
 * "backend" or "services" from tripping the check on ordinary prose.
 */
function distinctiveTerms(label: string): string[] {
  return (label.match(/\b[A-Z][A-Za-z0-9+#.]{2,}\b/g) ?? []).filter(
    (t) => !["The", "And", "For", "With", "Experience", "Strong", "Solid"].includes(t),
  );
}

/**
 * Does `text` mention `term`, allowing for inflection?
 *
 * Matched on a prefix rather than the whole word, because the resume says
 * "Mentored 2 junior engineers" where the job says "Mentoring" — an exact
 * match would miss it, and on the smuggling check a miss is the dangerous
 * direction. Short terms are matched whole so "AWS" cannot match "awshole"
 * cases of over-eager truncation.
 */
export function termAppears(text: string, term: string): boolean {
  const length = Math.min(term.length, Math.max(4, Math.ceil(term.length * 0.6)));
  const prefix = term.slice(0, length).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${prefix}`, "i").test(text);
}

export function checkOp(
  op: PlannedOp,
  layout: Layout,
  requirements: Requirement[],
  matches: Match[] = [],
): Violation[] {
  const violations: Violation[] = [];
  const target = layout.blocks.find((b) => b.id === op.block);
  const fail = (rule: Rule, message: string) => violations.push({ opId: op.id, rule, message });

  if (!target) {
    fail("unknown_block", `${op.block} is not a block in this resume`);
    return violations;
  }

  // 1. Never invent a number. A figure may only come from a line this change
  //    is actually based on.
  const allowed = allowedNumbers(op, layout);
  for (const n of numbersIn(op.text ?? "")) {
    if (!allowed.has(n)) {
      fail("invented_number", `"${n}" is not in any line this change is based on`);
    }
  }

  // 2. Job titles and dates are never rewritten.
  if (op.op !== "insert_after" && FROZEN_KINDS.has(target.kind)) {
    fail("rewrote_title_or_date", `${target.kind} lines are never rewritten (${op.block})`);
  }

  // 2b. A line carrying a hyperlink is left alone. The editor rewrites a
  //     paragraph run by run and a link is not one of those runs, so a
  //     rephrase would silently delete the user's email or profile URL.
  if (op.op === "rephrase" && target.has_link) {
    fail("would_drop_a_link", `${op.block} contains a link, which a rewrite would remove`);
  }

  // 3. Knockouts are shown, never faked.
  for (const id of op.requirements) {
    if (requirements.find((r) => r.id === id)?.knockout) {
      fail("faked_knockout", `${id} is a knockout; it is shown, never answered by an edit`);
    }
  }

  // 4. Never introduce formatting the user's own line did not have.
  if ((op.text ?? "").includes("**") && !target.has_bold) {
    fail("introduced_bold", `${op.block} has no bold of its own`);
  }

  // 6. A rewording may not quietly acquire a skill the resume does not have.
  //
  //    This is the one that matters most, and the one a model gets wrong while
  //    looking entirely reasonable: a live run turned "Helped refactor the
  //    refunds module" into "...to support event-driven streaming with Kafka"
  //    and labelled it `reworded`, so it would have been applied with no
  //    decision at all. Nothing above catches it — there is no invented number,
  //    no frozen block, no knockout, no new bold. "Nothing added behind your
  //    back" is enforced here or nowhere.
  if (op.claim !== "added_by_user" && op.text) {
    const backing = [op.block, ...op.evidence]
      .map((id) => layout.blocks.find((b) => b.id === id)?.text ?? "")
      .join(" ");

    for (const match of matches) {
      if (match.status === "matched") continue; // the resume really has it
      const requirement = requirements.find((r) => r.id === match.requirementId);
      if (!requirement) continue;

      for (const term of distinctiveTerms(requirement.label)) {
        if (termAppears(op.text, term) && !termAppears(backing, term)) {
          fail(
            "smuggled_skill",
            `"${term}" is not in the lines this is based on — an unbacked skill ` +
              "must be offered as Add it, never applied as a rewording",
          );
        }
      }
    }
  }

  if (op.claim === "added_by_user") {
    // 5. Modest verbs only, nothing above the user's seniority.
    const words: string[] = (op.text ?? "").toLowerCase().match(/[a-z]+/g) ?? [];
    for (const verb of OVERSTATED) {
      if (words.includes(verb)) {
        fail("overstated_verb", `"${verb}" overstates a line that is not the user's own`);
      }
    }
    // A drafted line must be offered as a decision, never slipped in.
    if (!op.needsDecision) {
      fail("unapproved_addition", "an added line must be offered as a decision");
    }
  }

  return violations;
}

/**
 * Downgrade any "matched" the resume does not actually back.
 *
 * The left panel is a claim about the user's own document — "✓ Kubernetes"
 * means *you already have this*. A live run marked Kubernetes matched against
 * a skills line reading "Python, Git, Docker, Java, Spring Boot, AWS,
 * PostgreSQL, Redis". No edit was wrong; the screen would simply have lied.
 *
 * Checked against the whole resume, not just the cited blocks, so a genuine
 * skill mentioned somewhere unexpected is not demoted on a technicality.
 */
export function verifyMatches(
  matches: Match[],
  requirements: Requirement[],
  layout: Layout,
): { matches: Match[]; downgraded: string[] } {
  const resume = layout.blocks.map((b) => b.text).join(" ");
  const downgraded: string[] = [];

  const checked = matches.map((match) => {
    if (match.status !== "matched") return match;
    const requirement = requirements.find((r) => r.id === match.requirementId);
    if (!requirement) return match;

    const terms = distinctiveTerms(requirement.label);
    if (!terms.length) return match; // nothing checkable; leave the model's call
    if (terms.some((t) => termAppears(resume, t))) return match;

    downgraded.push(requirement.label);
    return {
      ...match,
      status: "needs_ok" as const,
      evidence: [],
      note: `Not found in your resume.`,
    };
  });

  return { matches: checked, downgraded };
}

export type Enforced = {
  /** Operations that passed. Nothing else reaches the document. */
  operations: PlannedOp[];
  violations: Violation[];
};

/**
 * Drop every operation that breaks a rule, and say why.
 *
 * Dropping rather than throwing is deliberate: one bad line out of nine should
 * cost the user that line, not the whole tailoring. The violations are kept so
 * they can be logged and fed back to the planner.
 */
export function enforce(
  operations: PlannedOp[],
  layout: Layout,
  requirements: Requirement[],
  matches: Match[] = [],
): Enforced {
  const violations: Violation[] = [];
  const kept: PlannedOp[] = [];

  for (const op of operations) {
    const found = checkOp(op, layout, requirements, matches);
    if (found.length) {
      violations.push(...found);
    } else {
      kept.push(op);
    }
  }

  return { operations: kept, violations };
}
