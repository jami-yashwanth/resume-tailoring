import { jobPageToText, validateJobUrl } from "@/lib/job-fetch";

/**
 * Fetch a job posting by its link and hand back the page's text.
 *
 * The text goes into the textarea on /job, not straight into the pipeline, so
 * the user sees and can edit exactly what will be used. Auth-walled pages
 * (LinkedIn logged-out among them) come back as a readable failure telling
 * them to paste instead — pasting always works.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 1_000_000;
const PASTE_INSTEAD = "That page wouldn't let us read it — paste the description instead.";

export async function POST(request: Request) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const refusal = validateJobUrl(url);
  if (refusal) {
    return Response.json({ error: refusal }, { status: 400 });
  }

  // Redirects are followed by hand so every hop passes the same private-host
  // check as the first URL — "follow" would happily land on 169.254.169.254
  // after one bounce off a public page.
  let response: Response | null = null;
  let target = url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (validateJobUrl(target)) {
        return Response.json({ error: PASTE_INSTEAD }, { status: 400 });
      }
      response = await fetch(target, {
        headers: {
          // A plain server UA gets bot-walled by most job boards; a browser
          // one reads the same public page a candidate's browser would.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        target = new URL(location, target).toString();
        continue;
      }
      break;
    }
  } catch {
    return Response.json({ error: PASTE_INSTEAD }, { status: 502 });
  }

  if (!response?.ok) {
    return Response.json({ error: PASTE_INSTEAD }, { status: 502 });
  }

  const raw = await response.text();
  const text = jobPageToText(raw.slice(0, MAX_BYTES)).slice(0, 20_000);

  // A page whose readable text is shorter than a job description is an auth
  // wall or a JS-only shell — either way there is nothing here to tailor to.
  if (text.length < 200) {
    return Response.json({ error: PASTE_INSTEAD }, { status: 422 });
  }

  return Response.json({ text });
}
