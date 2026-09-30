/**
 * Manual eval harness for outline extraction. Never writes anything.
 *
 *   npm run check:extract <resume.pdf|docx>
 *
 * Needs docsvc running (`npm run docsvc`) and Claude credentials in `.env`.
 * Exits 1 when extraction fell back to the parser, so a corpus run can be
 * scripted.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient, MISSING_CREDENTIALS, resolveCredentials } from "../src/lib/anthropic";
import { parseResume } from "../src/lib/tailor/docsvc";
import { extractOutline } from "../src/lib/tailor/extract";
import type { Entry, Ref, Section } from "../src/lib/tailor/types";

try {
  process.loadEnvFile();
} catch {
  // No .env: fall through to whatever the shell provides.
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("usage: npm run check:extract <resume.pdf|docx>");
    return 2;
  }
  const credentials = resolveCredentials();
  if (!credentials) {
    console.error(MISSING_CREDENTIALS);
    return 2;
  }

  const file = readFileSync(path).toString("base64");
  const layout = await parseResume(file, basename(path));
  const result = await extractOutline(createClient(credentials), layout);

  console.log(`source:   ${result.source}`);
  console.log(`attempts: ${result.attempts}`);
  console.log(
    `usage:    input ${result.usage.input}, output ${result.usage.output}, cache read ${result.usage.cacheRead}`,
  );
  console.log(`blocks:   ${result.layout.blocks.length}`);
  console.log("");

  if (result.source === "parser") {
    console.log("Fell back to the parser (the last rejection reason was logged above as a warning).");
  }
  if (!result.outline) {
    console.log("(no outline)");
    return 1;
  }

  const text = new Map(result.layout.blocks.map((b) => [b.id, b.text]));
  const t = (id: string) => text.get(id) ?? `<missing block ${id}>`;
  const ref = (r: Ref | null) => (r ? r.text : null);
  const { outline } = result;

  console.log(`NAME: ${outline.name ? t(outline.name) : "(none)"}`);
  for (const c of outline.contact) console.log(`  ${t(c)}`);

  const entryLine = (e: Entry) =>
    [e.org, e.title, e.dates, e.place].map(ref).filter(Boolean).join(" — ") || "(empty entry)";

  for (const s of outline.sections as Section[]) {
    console.log(`§ ${s.heading ? t(s.heading) : "(no heading)"} (${s.kind})`);
    for (const l of s.lines) console.log(`  ${t(l)}`);
    for (const e of s.entries) {
      console.log(`  ${entryLine(e)}`);
      for (const l of e.lines) console.log(`    ${t(l)}`);
      for (const b of e.bullets) console.log(`    • ${t(b)}`);
    }
    for (const r of s.skills) console.log(`  ${r.label ? `${r.label}: ` : ""}${r.items}`);
  }
  return result.source === "parser" ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  },
);
