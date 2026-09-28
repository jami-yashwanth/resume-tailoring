"use client";

import { useEffect, useState } from "react";
import { session } from "@/lib/session";
import type { Layout, TailorPlan } from "@/lib/tailor/types";
import { ResultScreen } from "./ResultScreen";

/**
 * Prefers a real tailoring from this session; falls back to the saved sample.
 *
 * The fallback is what makes the screen reviewable without running the whole
 * flow, and it is genuine planner output rather than hand-written data, so
 * reviewing it means reviewing the real thing.
 */
export function ResultLoader({
  fallback,
}: {
  fallback: { layout: Layout; plan: TailorPlan } | null;
}) {
  const [state, setState] = useState<{
    layout: Layout;
    plan: TailorPlan;
    resume: string | null;
    filename: string | null;
    sample: boolean;
  } | null>(null);

  useEffect(() => {
    const stored = session.getResult();
    if (stored) {
      setState({
        ...stored,
        resume: session.getResume(),
        filename: session.getFilename(),
        sample: false,
      });
    } else if (fallback) {
      setState({ ...fallback, resume: null, filename: null, sample: true });
    }
  }, [fallback]);

  if (!state) return null;

  return (
    <ResultScreen
      layout={state.layout}
      plan={state.plan}
      resume={state.resume}
      filename={state.filename}
      sample={state.sample}
      role={state.plan.role || "the role"}
      company={state.plan.company || "this job"}
    />
  );
}
