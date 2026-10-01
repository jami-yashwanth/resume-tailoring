import fs from "node:fs";
import path from "node:path";
import { ResultLoader } from "@/components/result/ResultLoader";
import type { Layout, Outline, TailorPlan } from "@/lib/tailor/types";

/**
 * The Result screen.
 *
 * Reads a plan produced by a real pipeline run (`npx tsx
 * scripts/tailor-sample.mts`) rather than hand-written sample data, so what
 * the screen shows is what the planner and the guardrails actually emit.
 * Replaced by the live job record once upload and Add-a-job exist.
 */
export const dynamic = "force-dynamic";

/* The job is read from the browser's session, which this server component
   cannot see, so the tab cannot name it. It used to name one particular job at
   one particular company to every visitor. */
export const metadata = {
  title: "Your tailored resume — Rezz",
};

type Fixture = { layout: Layout; plan: TailorPlan; outline?: Outline | null };

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  /* The sample is a demo you ask for (the landing page links here as
     /result?demo), never a stranger's resume shown to whoever types /result.
     Without it, ResultLoader sends a visitor with no session back to the
     start of the flow. */
  const { demo } = await searchParams;
  let fallback: Fixture | null = null;
  if (demo !== undefined) {
    const file = path.join(process.cwd(), "fixtures", "sample-plan.json");
    fallback = fs.existsSync(file)
      ? (({ layout, plan, outline = null }: Fixture) => ({ layout, plan, outline }))(JSON.parse(fs.readFileSync(file, "utf8")) as Fixture)
      : null;
  }

  return <ResultLoader fallback={fallback} />;
}
