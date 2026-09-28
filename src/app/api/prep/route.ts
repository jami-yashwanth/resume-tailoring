import { MISSING_CREDENTIALS, createClient, resolveCredentials } from "@/lib/anthropic";
import { interviewPrep } from "@/lib/tailor/prep";
import type { PlannedOp } from "@/lib/tailor/types";

/**
 * Interview prep for the lines the user accepted.
 *
 * Only accepted lines are sent to the model, and the filter happens here
 * rather than being trusted from the client: prep for a line someone skipped
 * would be a small betrayal of the Skip.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const credentials = resolveCredentials();
  if (!credentials) return Response.json({ error: MISSING_CREDENTIALS }, { status: 500 });

  let body: { operations?: PlannedOp[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const added = (body.operations ?? []).filter(
    (op) => op.claim === "added_by_user" && op.approved === true && op.text,
  );
  if (!added.length) return Response.json({ items: [] });

  try {
    const { items } = await interviewPrep(createClient(credentials), added);
    return Response.json({ items });
  } catch (error) {
    // Prep is a bonus on the finish screen, never the point of it. A failure
    // here must not take the screen down with it.
    return Response.json(
      { items: [], error: error instanceof Error ? error.message : "Prep unavailable." },
      { status: 200 },
    );
  }
}
