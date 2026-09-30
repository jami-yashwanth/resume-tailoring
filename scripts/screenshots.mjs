/**
 * Walk every Rezz screen and photograph it, light and dark.
 *
 * Run the app first (`npm run dev`, or `npm run build && npm run start` for
 * shots without the Next dev overlay), then `npm run screenshots`. Output lands
 * in `screenshots/`, which is gitignored.
 *
 * Screens that gate on sessionStorage are seeded before load; the two that
 * gate on the network (/upload's honest check, /tailoring's stream) are fed by
 * intercepting the route, so what is photographed is the real component under
 * real data rather than a mock of it.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { frontendPort, repoRoot } from "./ports.mjs";

const ROOT = repoRoot;
const BASE = process.env.BASE ?? `http://localhost:${frontendPort}`;
const OUT = process.env.OUT ?? path.join(ROOT, "screenshots");

fs.mkdirSync(OUT, { recursive: true });

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/sample-plan.json"), "utf8"));
const { layout, plan } = fixture;

const FINISH = {
  filename: "priya_resume — Kosha Payments.pdf",
  company: plan.company || "Kosha Payments",
  role: plan.role || "Backend Engineer",
  pages: 1,
  pagesBefore: layout.pages,
  covered: 7,
  total: 9,
  originalCovered: 3,
  reworded: plan.operations.filter((o) => o.claim === "reworded").length,
  added: ["Consumed payment events from Kafka topics to update the ledger."],
  operations: plan.operations,
};

const SESSION = {
  "rezz.resume": "UEsDBBQAAAAI", // a stand-in; no screen decodes it
  "rezz.filename": "priya_resume.docx",
  "rezz.job": "Backend Engineer at Kosha Payments, Pune. We are looking for 3+ years of Java and Spring Boot, AWS, microservices, REST APIs, Kafka and Kubernetes. You will mentor junior engineers. On-site in Pune.",
  "rezz.result": JSON.stringify({ layout, plan }),
  "rezz.finish": JSON.stringify(FINISH),
};

const shots = [];

async function shoot(page, name, { full = false } = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  shots.push(name);
  console.log(`  ✓ ${name}`);
}

/** Seed session + theme before any page script runs. */
async function open(browser, { theme = "light", seed = [], route } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  const page = await context.newPage();

  const picked = Object.fromEntries(seed.map((k) => [k, SESSION[k]]));
  await page.addInitScript(
    ([store, mode]) => {
      for (const [k, v] of Object.entries(store)) {
        try {
          sessionStorage.setItem(k, v);
        } catch {}
      }
      // documentElement does not exist yet when an init script runs, so set the
      // theme as soon as <html> is parsed and again on every readyState change.
      const apply = () => document.documentElement?.setAttribute("data-theme", mode);
      apply();
      document.addEventListener("readystatechange", apply);
      document.addEventListener("DOMContentLoaded", apply);
    },
    [picked, theme],
  );

  if (route) await route(page);
  page.on("pageerror", (e) => console.log(`    ! page error: ${e.message}`));
  return { context, page };
}

async function settle(page, theme) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // Prove the theme actually took, rather than trusting the init script.
  if (theme) {
    const seen = await page.evaluate(() => ({
      attr: document.documentElement.getAttribute("data-theme"),
      bg: getComputedStyle(document.body).backgroundColor,
    }));
    const want = theme === "dark" ? "rgb(0, 0, 0)" : "rgb(247, 248, 250)";
    if (seen.attr !== theme || seen.bg !== want) {
      throw new Error(
        `theme not applied on ${page.url()}: wanted ${theme} / ${want}, ` +
          `got ${seen.attr} / ${seen.bg}`,
      );
    }
  }
  // The highlighter sweep is 450ms and runs once; let it finish so the marks
  // are photographed drawn rather than mid-stroke.
  await page.waitForTimeout(700);
}

const browser = await chromium.launch();

for (const theme of ["light", "dark"]) {
  const suffix = theme === "dark" ? "-dark" : "";
  console.log(`\n${theme.toUpperCase()}`);

  // ── Landing ───────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(browser, { theme });
    await page.goto(`${BASE}/`);
    await settle(page, theme);
    await shoot(page, `01-landing-hero${suffix}`);
    await shoot(page, `02-landing-full${suffix}`, { full: true });
    await context.close();
  }

  // ── Upload, empty ─────────────────────────────────────────────────────────
  {
    const { context, page } = await open(browser, { theme });
    await page.goto(`${BASE}/upload`);
    await settle(page, theme);
    await shoot(page, `03-upload${suffix}`);

    // Wrong file type is rejected in the browser, so this needs no network.
    const bad = path.join(OUT, "notes.txt");
    fs.writeFileSync(bad, "not a resume");
    await page.locator('input[type="file"]').setInputFiles(bad);
    await page.waitForTimeout(300);
    await shoot(page, `04-upload-error${suffix}`);
    await context.close();
  }

  // ── Upload, honest check (server says the file has warnings) ──────────────
  {
    const { context, page } = await open(browser, {
      theme,
      route: async (p) =>
        p.route("**/api/parse", (r) =>
          r.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              pages: 2,
              fonts: ["Georgia", "Arial"],
              blocks: 18,
              name: "Priya Sharma",
              warnings: [
                "Two columns. Some tracking systems read these out of order.",
                "Your dates sit in a table. We kept them exactly as they are.",
              ],
            }),
          }),
        ),
    });
    await page.goto(`${BASE}/upload`);
    await settle(page, theme);
    const docx = path.join(OUT, "priya_resume.docx");
    fs.writeFileSync(docx, "PK\u0003\u0004 stand-in");
    await page.locator('input[type="file"]').setInputFiles(docx);
    await page.waitForTimeout(600);
    await shoot(page, `05-upload-check${suffix}`);
    await context.close();
  }

  // ── Add the job ───────────────────────────────────────────────────────────
  {
    const { context, page } = await open(browser, {
      theme,
      seed: ["rezz.resume", "rezz.filename"],
    });
    await page.goto(`${BASE}/job`);
    await settle(page, theme);
    await shoot(page, `06-job-empty${suffix}`);

    await page.locator("#jd").fill(SESSION["rezz.job"]);
    await page.waitForTimeout(200);
    await shoot(page, `07-job-filled${suffix}`);
    await context.close();
  }

  // ── Tailoring, mid-run ────────────────────────────────────────────────────
  {
    const sse =
      `event: progress\ndata: {"stage":"reading_resume"}\n\n` +
      `event: progress\ndata: {"stage":"reading_job","detail":"Backend Engineer, Kosha Payments"}\n\n` +
      `event: progress\ndata: {"stage":"planning","detail":"9 requirements"}\n\n`;
    const { context, page } = await open(browser, {
      theme,
      seed: ["rezz.resume", "rezz.filename", "rezz.job"],
      route: async (p) =>
        p.route("**/api/tailor/stream", (r) =>
          r.fulfill({ status: 200, contentType: "text/event-stream", body: sse }),
        ),
    });
    await page.goto(`${BASE}/tailoring`);
    await settle(page, theme);
    await shoot(page, `08-tailoring${suffix}`);
    await context.close();
  }

  // ── Tailoring, failed ─────────────────────────────────────────────────────
  {
    const { context, page } = await open(browser, {
      theme,
      seed: ["rezz.resume", "rezz.filename", "rezz.job"],
      route: async (p) =>
        p.route("**/api/tailor/stream", (r) =>
          r.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Could not reach the file service. It may be starting up." }),
          }),
        ),
    });
    await page.goto(`${BASE}/tailoring`);
    await settle(page, theme);
    await shoot(page, `09-tailoring-error${suffix}`);
    await context.close();
  }

  // ── Result ────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(browser, { theme, seed: ["rezz.result"] });
    await page.goto(`${BASE}/result`);
    await settle(page, theme);
    await shoot(page, `10-result${suffix}`);

    // Answer every pending decision, to reach the "Ready." bar.
    for (let i = 0; i < 6; i++) {
      // The buttons name the skill for screen readers ("Add Kafka line to my
      // resume"), so the accessible name is not the visible word.
      const add = page.getByRole("button", { name: /^Add .+ line to my resume$/ });
      if (!(await add.count())) break;
      await add.first().click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(500);
    await shoot(page, `11-result-ready${suffix}`);

    const compare = page.getByRole("button", { name: /Compare with original/ });
    if (await compare.count()) {
      await compare.first().click();
      await page.waitForTimeout(400);
      await shoot(page, `12-result-compare${suffix}`);
    }
    await context.close();
  }

  // ── Finish ────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(browser, {
      theme,
      seed: ["rezz.resume", "rezz.filename", "rezz.finish"],
      route: async (p) =>
        p.route("**/api/prep", (r) =>
          r.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              items: [
                {
                  line: "Consumed payment events from Kafka topics to update the ledger.",
                  questions: [
                    "Which Kafka topics did you consume, and what was on them?",
                    "How did you handle a message that failed to process?",
                  ],
                  honest:
                    "Say you worked alongside the Kafka consumers rather than owning them, and that you understand the ledger updates they drove. Naming the boundary of what you did is stronger than implying more.",
                },
              ],
            }),
          }),
        ),
    });
    await page.goto(`${BASE}/done`);
    await settle(page, theme);
    await shoot(page, `13-done${suffix}`, { full: true });
    await context.close();
  }
}

await browser.close();
console.log(`\n${shots.length} screenshots in ${OUT}`);
