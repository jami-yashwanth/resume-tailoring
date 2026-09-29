/**
 * Section headings, in the words a resume parser knows.
 *
 * Every ATS worth naming — Workday, iCIMS, Greenhouse, Taleo, Sovren, Daxtra —
 * reads a resume in two steps: *segment* the text into blocks by matching each
 * heading against a list of known section names, then pull fields out of each
 * block. The second step never runs on a block the first step didn't find. So
 * a resume that calls its work history "Professional Journey" doesn't score
 * badly for it; it comes back with no jobs at all, and the recruiter searching
 * by skill never sees the candidate.
 *
 * That makes this the highest-leverage change Rezz can make to a document, and
 * it is nothing like a keyword score — it is the difference between a section
 * being read and not being read. (`docs/02-research.md` reached the same place
 * from the other direction: no auto-reject on keyword score, but recruiters
 * search literally, and a section that parsed to nothing is not searchable.)
 *
 * Two rules keep this honest:
 *
 * 1. **Exact matches only.** A confident synonym or nothing — no fuzzy
 *    matching, no stemming, no "close enough". Renaming a heading Rezz
 *    misread is rewriting the user's resume on a guess, and the cost of
 *    guessing wrong is worse than the cost of leaving a heading alone.
 * 2. **Every swap is visible and undoable.** A rename becomes an ordinary
 *    `rephrase` op, so it shows in the review list with Undo like any other
 *    rewording of the user's own words. Nothing goes in behind their back.
 */

/** Standard name → the headings that mean it. Lowercase, no punctuation. */
const SYNONYMS: Record<string, string[]> = {
  Experience: [
    "work experience",
    "professional experience",
    "employment",
    "employment history",
    "work history",
    "professional journey",
    "career history",
    "relevant experience",
    "industry experience",
  ],
  Education: [
    "academics",
    "academic background",
    "academic qualifications",
    "educational qualifications",
    "education qualification",
    "qualifications",
    "academic details",
  ],
  Skills: [
    "technical skills",
    "tech stack",
    "technologies",
    "core competencies",
    "skills and tools",
    "technical expertise",
    "expertise",
    "areas of expertise",
    "key skills",
  ],
  Projects: [
    "personal projects",
    "key projects",
    "academic projects",
    "side projects",
    "selected projects",
    "project work",
  ],
  Summary: [
    "professional summary",
    "career summary",
    "profile",
    "about",
    "about me",
    "objective",
    "career objective",
    "professional profile",
  ],
  Certifications: [
    "certificates",
    "licenses and certifications",
    "certifications and licenses",
    "courses",
    "courses and certifications",
  ],
  Achievements: ["awards", "honors", "honours", "accomplishments", "awards and honors"],
};

/**
 * A heading reduced to the form the table is keyed on: lowercase, no leading
 * or trailing punctuation, "&" spelled out, runs of space collapsed. This is
 * what makes "SKILLS & TOOLS:" and "Skills and Tools" the same key without any
 * fuzzy matching — they normalise to one string, or they don't match at all.
 */
function key(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOOKUP = new Map<string, string>();
for (const [standard, synonyms] of Object.entries(SYNONYMS)) {
  // A heading that is already standard maps to itself, so it is recognised as
  // needing no change rather than falling through as unknown.
  LOOKUP.set(key(standard), standard);
  for (const synonym of synonyms) LOOKUP.set(key(synonym), standard);
}

/**
 * The standard name for a heading, or `null` to leave it exactly as written.
 *
 * `null` covers both halves of "leave it alone": a heading Rezz doesn't
 * recognise, and one that is already standard. Neither needs an op, and a
 * caller that treated "already standard" as a change would put a no-op
 * rewording in the review list for the user to read and dismiss.
 */
/** The standard name a heading maps to — including one already standard —
 *  or `null` for a heading Rezz doesn't recognise. `normaliseHeading` below
 *  answers "does this need a rename op?"; this answers "which section is
 *  this?", which is what anchor-placement needs. */
export function standardHeading(text: string): string | null {
  return LOOKUP.get(key(text)) ?? null;
}

export function normaliseHeading(text: string): { from: string; to: string } | null {
  const standard = LOOKUP.get(key(text));
  if (!standard) return null;
  // Already right, in whatever case the user typed it. Case alone is not worth
  // a decision: the template draws every heading uppercase anyway.
  if (key(text) === key(standard)) return null;
  return { from: text, to: standard };
}
