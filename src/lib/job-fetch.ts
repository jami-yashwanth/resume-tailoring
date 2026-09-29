/**
 * Turning a pasted job-posting link into text the requirements extractor can
 * read. The fetch itself lives in the API route; everything decidable without
 * a network — is this a URL, is it safe to fetch, what text does the page
 * carry — lives here, where it can be tested.
 *
 * The tag-stripping is deliberately crude: `extractRequirements`' prompt
 * already ignores boilerplate, so the job here is only to keep the posting's
 * words and lose the markup. If Naukri/Indeed extraction disappoints, the
 * upgrade path is @mozilla/readability + linkedom.
 */

/** A message when the URL must not be fetched, null when it may. Blocks
 *  non-http(s) schemes and every private/loopback/link-local host so the
 *  server can't be pointed at its own network (SSRF). */
export function validateJobUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "That doesn't look like a link. Paste the job posting's full URL.";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "That link isn't a web page. Paste an http(s) job posting URL.";
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const privateHost =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/i.test(host) ||
    /^fe80:/i.test(host);
  if (privateHost) {
    return "That link points inside a private network, which we can't read.";
  }
  return null;
}

/** True when the pasted text IS a link (one URL, nothing else) rather than a
 *  job description that happens to contain one. */
export function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/i.test(trimmed);
}

const DROP_WHOLE = /<(script|style|noscript|svg|nav|header|footer|iframe|form)\b[\s\S]*?<\/\1>/gi;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** The page's readable text: chrome elements dropped whole, block tags turned
 *  into line breaks, entities decoded, whitespace collapsed. */
export function jobPageToText(html: string): string {
  const text = html
    .replace(DROP_WHOLE, " ")
    .replace(/<(p|div|li|ul|ol|h[1-6]|br|tr|section|article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
