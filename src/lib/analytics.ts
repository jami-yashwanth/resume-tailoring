/**
 * Funnel measurement, or nothing.
 *
 * "Get more users" can't be steered without knowing where people drop, so
 * each step of the flow reports one named event. Cookieless and content-free
 * by construction: the event union below is the complete vocabulary, props
 * are flat scalars, and resume or job text has no way in.
 *
 * Off unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set — the wire format is
 * Plausible's public event API, which self-hosted Plausible speaks too, so
 * enabling analytics is one env var and no code.
 */

export type FunnelEvent =
  | "upload_started"
  | "parse_ok"
  | "parse_failed"
  | "jd_link_fetched"
  | "jd_submitted"
  | "tailor_done"
  | "tailor_failed"
  | "decision_made"
  | "all_decided"
  | "download_clicked"
  | "download_done"
  | "exact_preview_opened";

const ENDPOINT = process.env.NEXT_PUBLIC_PLAUSIBLE_ENDPOINT ?? "https://plausible.io/api/event";

export function track(event: FunnelEvent, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return;
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        name: event,
        url: window.location.href,
        domain,
        ...(props ? { props } : {}),
      }),
    });
  } catch {
    // Analytics must never break the flow it measures.
  }
}
