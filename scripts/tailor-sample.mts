/**
 * Run the whole pipeline on the sample resume, from the command line.
 *
 * The one thing that proves the product works before any screen exists: a real
 * DOCX in, a real tailored DOCX out, with every guardrail applied.
 *
 *   cd services/docsvc && .venv/bin/uvicorn app.main:app --port 8000 &
 *   npx tsx scripts/tailor-sample.mts
 */
import fs from "node:fs";
import path from "node:path";

for (const file of [".env", ".env.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const { tailor, applyPlan, estimateCost } = await import("../src/lib/tailor/pipeline.ts");
const docsvc = await import("../src/lib/tailor/docsvc.ts");

const RESUME = "prototypes/in-place-editing/samples/priya_resume.docx";
const JD = "fixtures/kosha-payments-jd.txt";
const OUT = "out/priya_tailored.docx";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

const health = await docsvc.health();
console.log(dim(`docsvc: ${health.renderer ?? "no renderer"} · page counts ${health.page_counts}`));

const resume = fs.readFileSync(RESUME).toString("base64");
const jobDescription = fs.readFileSync(JD, "utf8");

const started = Date.now();
const result = await tailor(resume, jobDescription, (stage, detail) =>
  console.log(dim(`  ${stage}${detail ? ` — ${detail}` : ""}`)),
);
const planSeconds = ((Date.now() - started) / 1000).toFixed(1);

const { plan, layout, violations, usage } = result;

console.log(`\n${bold("What the job asks for")}`);
for (const r of plan.requirements) {
  const match = plan.matches.find((m) => m.requirementId === r.id);
  const mark = { matched: "✓", needs_ok: "!", cannot_change: "–" }[match?.status ?? "needs_ok"];
  const ev = match?.evidence?.length ? dim(`  ← ${match.evidence.join(", ")}`) : "";
  console.log(`  ${mark} ${r.label}${r.knockout ? dim(" (knockout)") : ""}${ev}`);
}
console.log(
  `  ${bold(`Covers ${plan.coverage.covered} of ${plan.coverage.total}`)} · original covered ${plan.coverage.originalCovered}`,
);

console.log(`\n${bold("Planned changes")}`);
for (const op of plan.operations) {
  const tag = op.needsDecision ? "NEEDS YOUR OK" : op.claim;
  console.log(`  [${tag}] ${op.op} ${op.block}  ${dim(`value ${op.value}`)}`);
  if (op.text) console.log(`      ${op.text}`);
  if (op.evidence.length) console.log(dim(`      based on ${op.evidence.join(", ")}`));
}

if (violations.length) {
  console.log(`\n${bold("Rejected by the guardrails")}`);
  for (const v of violations) console.log(`  ✗ ${v.opId}  ${v.rule}: ${v.message}`);
} else {
  console.log(`\n${dim("Guardrails: nothing rejected.")}`);
}

// Stand in for the user tapping Add it on every drafted line.
const decided = {
  ...plan,
  operations: plan.operations.map((op) => (op.needsDecision ? { ...op, approved: true } : op)),
};

console.log(`\n${bold("Applying to the document")}`);
const applied = await applyPlan(resume, decided, layout.pages);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.from(applied.file, "base64"));

for (const a of applied.applied) {
  console.log(`  ${a.status.padEnd(9)} ${a.op} ${a.block}${a.detail ? dim(` — ${a.detail}`) : ""}`);
}
for (const w of applied.warnings) console.log(`  ! ${w}`);

// Saved so the Result screen can be built and reviewed against real planner
// output rather than hand-written sample data.
const FIXTURE = "fixtures/sample-plan.json";
fs.writeFileSync(
  FIXTURE,
  `${JSON.stringify({ layout, plan, violations, generated: new Date().toISOString().slice(0, 10) }, null, 2)}\n`,
);
console.log(dim(`wrote ${FIXTURE}`));

const cost = estimateCost(usage, result.models.planner);
console.log(
  `\n${bold("Result")}  pages ${applied.pages_before} → ${applied.pages} · fit rounds ${applied.rounds}`,
);
console.log(
  dim(
    `planner ${result.models.planner} · ${planSeconds}s · ` +
      `in ${usage.input} out ${usage.output} cached ${usage.cacheRead} · ~₹${cost.toFixed(2)}`,
  ),
);
console.log(`wrote ${OUT}`);
