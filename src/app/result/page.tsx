import fs from "node:fs";
import path from "node:path";
import { ResultLoader } from "@/components/result/ResultLoader";
import type { Layout, TailorPlan } from "@/lib/tailor/types";

/**
 * The Result screen.
 *
 * Reads a plan produced by a real pipeline run (`npx tsx
 * scripts/tailor-sample.mts`) rather than hand-written sample data, so what
 * the screen shows is what the planner and the guardrails actually emit.
 * Replaced by the live job record once upload and Add-a-job exist.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backend Engineer, Kosha Payments — Rezz",
};

type Fixture = { layout: Layout; plan: TailorPlan };

export default function ResultPage() {
  const file = path.join(process.cwd(), "fixtures", "sample-plan.json");
  const fallback = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf8")) as Fixture)
    : null;

  return <ResultLoader fallback={fallback} />;
}
