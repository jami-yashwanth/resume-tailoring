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

  // Any IPv6 literal is refused outright: IPv4-mapped forms
  // ([::ffff:169.254.169.254], and their hex spellings) smuggle a private
  // IPv4 address past dotted-quad checks, and no job board serves from a
  // bare IPv6 literal — so there is nothing legitimate to lose.
  if (url.hostname.startsWith("[") || url.hostname.includes(":")) {
    return "That link points inside a private network, which we can't read.";
  }

  const host = url.hostname.toLowerCase();
  if (isPrivateHostname(host) || isPrivateIpv4(host)) {
    return "That link points inside a private network, which we can't read.";
  }
  return null;
}

function isPrivateHostname(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  );
}

/** True for every IPv4 address that must never be fetched: loopback, RFC1918,
 *  link-local, CGNAT, benchmarking, and the 0.0.0.0/8 "this host" block. The
 *  WHATWG URL parser has already normalised decimal/octal/hex IP spellings to
 *  dotted quads by the time this runs. */
export function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
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
