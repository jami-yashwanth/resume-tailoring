import { lookup } from "node:dns/promises";
import { isPrivateIpv4, jobPageToText, validateJobUrl } from "@/lib/job-fetch";

/**
 * Fetch a job posting by its link and hand back the page's text.
 *
 * The text goes into the textarea on /job, not straight into the pipeline, so
 * the user sees and can edit exactly what will be used. Auth-walled pages
 * (LinkedIn logged-out among them) come back as a readable failure telling
 * them to paste instead — pasting always works.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 1_000_000;
const MAX_HOPS = 3;
const PASTE_INSTEAD = "That page wouldn't let us read it — paste the description instead.";

/** A hostname's resolved addresses must all be public. String checks on the
 *  URL can't see what DNS answers — evil.example with an A record of
 *  169.254.169.254 passes every literal check — so each hop resolves first
 *  and refuses if any answer is private. (The connection then re-resolves:
 *  a tiny TOCTOU window we accept for v1 over pinning sockets by IP.) */
async function resolvesPrivately(hostname: string): Promise<boolean> {
  try {
    const answers = await lookup(hostname, { all: true, verbatim: true });
    return answers.some(({ address, family }) => {
      if (family === 4) return isPrivateIpv4(address);
      const v6 = address.toLowerCase();
      const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(v6);
      if (mapped) return isPrivateIpv4(mapped[1]);
      return (
        v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80")
      );
    });
  } catch {
    return true; // unresolvable is unfetchable
  }
}

/** Read at most MAX_BYTES of the body, whatever the server claims. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  void reader.cancel().catch(() => {});
  return text;
}

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

  // Redirects are followed by hand so every hop passes the same checks as
  // the first URL — "follow" would happily land on 169.254.169.254 after one
  // bounce off a public page.
  let response: Response | null = null;
  let target = url;
  try {
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      if (validateJobUrl(target) || (await resolvesPrivately(new URL(target).hostname))) {
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

  // Only pages. A link to a 500 MB binary should cost nothing: wrong type is
  // refused before the body is touched, and the read itself stops at the cap.
  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
    void response.body?.cancel().catch(() => {});
    return Response.json({ error: PASTE_INSTEAD }, { status: 422 });
  }

  const raw = await readCapped(response);
  const text = jobPageToText(raw).slice(0, 20_000);

  // A page whose readable text is shorter than a job description is an auth
  // wall or a JS-only shell — either way there is nothing here to tailor to.
  if (text.length < 200) {
    return Response.json({ error: PASTE_INSTEAD }, { status: 422 });
  }

  return Response.json({ text });
}
