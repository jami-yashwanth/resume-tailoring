/**
 * Drive the Result screen through a whole review at four window widths and
 * fail if any control is missing. Run the app first (`npm run dev`), then
 * `npm run check:result`. Screenshots land in screenshots/ (gitignored).
 *
 * Exists because the old margin — and with it Undo and the page-fit question —
 * silently disappeared below 1240px, and no test could see it.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { frontendPort, repoRoot } from "./ports.mjs";

const BASE = process.env.BASE ?? `http://localhost:${frontendPort}`;
const OUT = path.join(repoRoot, "screenshots");
fs.mkdirSync(OUT, { recursive: true });
const fixture = JSON.parse(fs.readFileSync(path.join(repoRoot, "fixtures/sample-plan.json"), "utf8"));
const WIDTHS = [1440, 1240, 1100, 880];
const failures = [];

function check(ok, what) {
  if (!ok) failures.push(what);
  console.log(`  ${ok ? "✓" : "✗"} ${what}`);
}

/** The sample, padded with `count` repeated bullets (40 runs well past one page). */
function longLayout(layout, count = 40) {
  const bullets = layout.blocks.filter((b) => b.kind === "bullet");
  const extra = Array.from({ length: count }, (_, i) => ({ ...bullets[i % bullets.length], id: `pad${i}` }));
  return { ...layout, blocks: [...layout.blocks, ...extra] };
}

/* The first pad count whose file runs to two pages, as the printer counts it
   (measured 1 Oct 2026 against the Chromium print of ResumePage: 34 pads is
   one page, 35 is two). One number for every width: the count is the printed
   file's, and the file does not depend on the window. */
const PAGE_BOUNDARY = 35;

/** The sample plan plus a removal the page-fit card can offer: the last pad line. */
const planWithRemoval = (padCount) => ({
  ...fixture.plan,
  operations: [
    ...fixture.plan.operations,
    {
      id: "rm-pad", op: "remove", block: `pad${padCount - 1}`, alternatives: [], claim: "reworded",
      value: 1, requirements: [], evidence: [], needsDecision: false,
    },
  ],
});

async function openResult(
  browser,
  width,
  { layout = fixture.layout, plan = fixture.plan, decisions = null, theme = "light" } = {},
) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
  await context.addInitScript(
    ([result, stored, mode]) => {
      sessionStorage.setItem("rezz.result", result);
      sessionStorage.setItem("rezz.resume", "UEsDBBQAAAAI");
      sessionStorage.setItem("rezz.filename", "priya_resume.docx");
      if (stored && !sessionStorage.getItem("rezz.decisions")) sessionStorage.setItem("rezz.decisions", stored);
      const apply = () => document.documentElement?.setAttribute("data-theme", mode);
      apply();
      document.addEventListener("readystatechange", apply);
    },
    [JSON.stringify({ layout, plan }), decisions ? JSON.stringify(decisions) : null, theme],
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`page error at ${width}px: ${e.message}`));
  // The page count is the printer's, asked after a debounce: wait for its first answer.
  const counted = page.waitForResponse((r) => r.url().includes("/api/pages"), { timeout: 15000 }).catch(() => {});
  await page.goto(`${BASE}/result`);
  await counted;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
  return { context, page };
}

async function visible(locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
}

/** What has keyboard focus: its id and the start of its text. */
async function focused(page) {
  return page.evaluate(() => ({
    id: document.activeElement?.id ?? "",
    text: (document.activeElement?.textContent ?? "").trim().slice(0, 40),
    tag: document.activeElement?.tagName ?? "",
  }));
}

const browser = await chromium.launch();

for (const width of WIDTHS) {
  console.log(`\n${width}px`);
  const JUST_OVER_ONE_PAGE = PAGE_BOUNDARY;
  const JUST_UNDER_ONE_PAGE = JUST_OVER_ONE_PAGE - 1;

  for (const theme of ["light", "dark"]) {
    const shot = await openResult(browser, width, { theme });
    await shot.page.screenshot({ path: path.join(OUT, `result-${width}-${theme}.png`) });
    await shot.context.close();
  }

  // ── A whole review ───────────────────────────────────────────────────────
  {
    const { context, page } = await openResult(browser, width);
    const add = page.getByRole("button", { name: /^Add .+ line to my resume$/ });
    const skip = page.getByRole("button", { name: /^Skip .+ line$/ });
    check((await visible(add)) && (await visible(skip)), "Skip and Add it are on screen");

    const before = await page.getByRole("button", { name: /^Undo (adding|skipping) .+ line$/ }).count();
    await add.first().dblclick();
    await page.waitForTimeout(450);
    const after = await page.getByRole("button", { name: /^Undo (adding|skipping) .+ line$/ }).count();
    check(after - before === 1, "a double click answers one question, not two");

    const undoAdd = page.getByRole("button", { name: /^Undo adding .+ line$/ });
    check(await visible(undoAdd), "an added line has Undo");
    await undoAdd.first().click();
    await page.waitForTimeout(450); // the undone line reopens as a new card
    check((await undoAdd.count()) === 0 && (await visible(add)), "Undo puts the line back to decide");

    await skip.first().click();
    await page.waitForTimeout(450);
    const undoSkip = page.getByRole("button", { name: /^Undo skipping .+ line$/ });
    check(await visible(undoSkip), "a skipped line has Undo");

    for (let i = 0; i < 10 && (await add.count()); i++) {
      await add.first().click();
      await page.waitForTimeout(450); // longer than the card's 350ms guard
    }
    const download = page.getByRole("button", { name: "Download resume" });
    check((await download.count()) === 1, "exactly one Download button");
    check(await visible(page.getByText(/^All decided\./)), "the list says all decided");
    check((await focused(page)).text.startsWith("All decided."), "focus moves to \"All decided\" after the last decision");

    await page.getByRole("button", { name: /^Undo adding .+ line$/ }).last().click();
    await page.waitForTimeout(450);
    check((await focused(page)).id.startsWith("decision-"), "Undo from \"All decided\" focuses the reopened card");
    await add.first().click();
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, `result-${width}-ready.png`) });

    await page.route("**/api/download", (route) =>
      route.fulfill({ json: { file: Buffer.from("%PDF-1.4").toString("base64"), pages: 1 } }),
    );
    await download.click();
    const reached = await page.waitForURL("**/done", { timeout: 5000 }).then(() => true, () => false);
    check(reached, "Download goes to the finish screen");
    await context.close();
  }

  // ── The live region speaks a repeated message again ──────────────────────
  {
    // Far over one page with two lines on offer, so removing one still does not
    // fit and the second removal says exactly what the first did.
    const removal = (id, block) => ({
      id, op: "remove", block, alternatives: [], claim: "reworded", value: 1, requirements: [], evidence: [],
      needsDecision: false,
    });
    const { context, page } = await openResult(browser, width, {
      layout: longLayout(fixture.layout),
      plan: { ...fixture.plan, operations: [...fixture.plan.operations, removal("rm-a", "pad38"), removal("rm-b", "pad39")] },
      decisions: { decisions: {}, wordings: {}, pagesAllowed: 1, growthAllowed: false, removedFor: {} },
    });
    await page.evaluate(() => {
      const region = document.querySelector('[aria-live="polite"]');
      window.__spoken = [];
      new MutationObserver(() => window.__spoken.push(region.textContent)).observe(region, {
        childList: true, subtree: true, characterData: true,
      });
    });
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Remove that line" }).click();
      await page.waitForTimeout(300);
    }
    const spoken = (await page.evaluate(() => window.__spoken)).filter(Boolean);
    check(
      spoken.length === 2 && spoken.every((text) => text === "Line removed to fit."),
      "the same announcement twice is spoken twice",
    );
    await context.close();
  }

  // ── Page fit: the resume outgrew what the user agreed to ─────────────────
  {
    const { context, page } = await openResult(browser, width, {
      layout: longLayout(fixture.layout),
      decisions: { decisions: {}, wordings: {}, pagesAllowed: 1, growthAllowed: false },
    });
    const heading = page.getByRole("heading", { name: /(makes it|runs to) \d+ pages\./ });
    check(await visible(heading), "the page-fit card is on screen");
    await page.screenshot({ path: path.join(OUT, `result-${width}-page-fit.png`) });
    await page.getByRole("button", { name: /^Allow \d+ pages$/ }).click();
    await page.waitForTimeout(200);
    check(!(await visible(heading)), "allowing the pages closes the card");
    await context.close();
  }

  // ── Adding drafts to a full page asks: the agreed length is the file's ───
  {
    const { context, page } = await openResult(browser, width, {
      layout: longLayout(fixture.layout, JUST_UNDER_ONE_PAGE),
    });
    const heading = page.getByRole("heading", { name: /(makes it|runs to) \d+ pages\./ });
    check(!(await visible(heading)), "undecided drafts do not count towards the agreed length");
    const add = page.getByRole("button", { name: /^Add .+ line to my resume$/ });
    for (let i = 0; i < 10 && (await add.count()); i++) {
      await add.first().click();
      await page.waitForTimeout(450);
    }
    // The card waits for the printer's recount of the file.
    await heading.waitFor({ timeout: 8000 }).catch(() => {});
    check(await visible(heading), "adding every draft to a full page shows the page-fit card");
    check(
      await page.getByRole("button", { name: "Download resume" }).isDisabled(),
      "Download waits for the page-fit answer",
    );
    check(await visible(page.getByText(/^Choose how it fits · 2 pages$/)), "the status says why");
    await context.close();
  }

  // ── Removing a line frees its space ──────────────────────────────────────
  {
    const { context, page } = await openResult(browser, width, {
      layout: longLayout(fixture.layout, JUST_OVER_ONE_PAGE),
      plan: planWithRemoval(JUST_OVER_ONE_PAGE),
      decisions: { decisions: {}, wordings: {}, pagesAllowed: 1, growthAllowed: false, removedFor: {} },
    });
    const heading = page.getByRole("heading", { name: /(makes it|runs to) \d+ pages\./ });
    check(await visible(heading), "a resume just over its agreed page asks about length");
    await page.getByRole("button", { name: "Remove that line" }).click();
    await heading.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
    check(!(await visible(heading)), "removing a line closes the page-fit card");
    check((await focused(page)).id.startsWith("decision-"), "after a page-fit choice, focus moves to the open card");
    await context.close();
  }

  // ── Download waits for the printer's count ───────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript((result) => {
      sessionStorage.setItem("rezz.result", result);
      sessionStorage.setItem("rezz.resume", "UEsDBBQAAAAI");
    }, JSON.stringify({ layout: fixture.layout, plan: fixture.plan }));
    const page = await context.newPage();
    // Hold the count back, so the screen sits in its "checking" state.
    await page.route("**/api/pages", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.continue().catch(() => {});
    });
    await page.goto(`${BASE}/result`);
    await page.getByText(/checking pages…$/).first().waitFor({ timeout: 5000 }).catch(() => {});
    check(await visible(page.getByText(/checking pages…$/)), "the status says the pages are being checked");
    check(
      await page.getByRole("button", { name: "Download resume" }).isDisabled(),
      "Download waits while the pages are being checked",
    );
    await context.close();
  }

  // ── No false alarm: a long resume nobody has touched asks nothing ────────
  {
    const { context, page } = await openResult(browser, width, { layout: longLayout(fixture.layout) });
    const heading = page.getByRole("heading", { name: /(makes it|runs to) \d+ pages\./ });
    check(!(await visible(heading)), "a long resume with no decisions asks nothing about length");
    await context.close();
  }
}

await browser.close();

if (failures.length) {
  console.log(`\n${failures.length} failed:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nAll checks passed.");
