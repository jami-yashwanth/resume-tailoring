/**
 * The gates: sign-in, the free cap, and passes.
 *
 * Every one of them is here, behind one switch, so that "turn the gates off
 * for testing" is a single decision rather than a condition scattered through
 * screens. A stray `if (dev)` in a component is how a product ends up shipping
 * with its paywall open.
 *
 * The switch removes **gates**, never **guardrails**. Nothing in
 * `src/lib/tailor/rules.ts` reads it: the honesty checks run identically in
 * every environment, and there is no mode in which a line reaches a document
 * without the user being asked. Gates decide who may download; guardrails
 * decide what a download may contain, and only the first is negotiable.
 */

/** What the flow is allowed to do next. */
export type GateDecision =
  | { allowed: true; reason: "enforced_and_entitled" | "gates_disabled" }
  | { allowed: false; gate: "sign_in" | "pass" };

/** What we know about the person asking. */
export type Entitlement = {
  signedIn: boolean;
  /** Downloads left on the free cap or the current pass. `null` = unlimited. */
  creditsLeft: number | null;
};

export const ANONYMOUS: Entitlement = { signedIn: false, creditsLeft: 0 };

/**
 * Enforced unless explicitly switched off.
 *
 * The default is the safe one on purpose: a missing variable in production
 * must not open the gates. Only the exact string "false" disables them, so a
 * typo fails closed.
 */
export function gatesEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REZZ_ENFORCE_GATES?.trim().toLowerCase() !== "false";
}

/**
 * May this person download their tailored resume?
 *
 * Order matters. Sign-in is asked for before a pass, because we cannot know
 * what someone is entitled to until we know who they are — and asking for
 * money before asking for a phone number is the wrong way round.
 */
export function checkDownload(
  entitlement: Entitlement,
  env: NodeJS.ProcessEnv = process.env,
): GateDecision {
  if (!gatesEnforced(env)) return { allowed: true, reason: "gates_disabled" };
  if (!entitlement.signedIn) return { allowed: false, gate: "sign_in" };
  if (entitlement.creditsLeft !== null && entitlement.creditsLeft <= 0) {
    return { allowed: false, gate: "pass" };
  }
  return { allowed: true, reason: "enforced_and_entitled" };
}

/**
 * Nothing before the Result screen ever asks for anything.
 *
 * Uploading, adding a job and tailoring are all free and anonymous, always —
 * that is the whole "no sign-up to try" position, and the nearest competitor
 * does the opposite (`docs/08-competitor-jobowl.md`). Stated as a function so
 * it is a rule with a test, not a convention someone can quietly break.
 */
export function checkTailor(): GateDecision {
  return { allowed: true, reason: "gates_disabled" };
}

/** One line for the UI, so the copy for each gate lives in one place. */
export function gateCopy(gate: "sign_in" | "pass"): { title: string; body: string } {
  return gate === "sign_in"
    ? {
        title: "Sign in to download",
        body: "Your number, then a six-digit code. Your resume stays exactly as it is.",
      }
    : {
        title: "You've used your free tailoring this week",
        body: "Choose a pass to keep going. Paid once by UPI — it does not renew.",
      };
}
