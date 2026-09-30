# Free Tier and Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the gate from the download to the tailoring button: first run per browser anonymous, second run asks for Google or a magic link, signed-in users get 10 tailorings in a rolling 7 days, and every completed tailoring is recorded in a Postgres ledger.

**Architecture:** A pure `checkTailor` decides run / sign_in / capped from an `Entitlement`; a server-side resolver builds that entitlement from the Auth.js session, a signed anonymous browser cookie and a `Ledger` (Drizzle on Neon, with an in-memory twin for tests). The tailoring stream route enforces the decision and records the row; `GET /api/me` lets the job screen show the sign-in sheet or cap card before opening the stream. Resume, JD, result and decisions stay in `sessionStorage`.

**Tech Stack:** TypeScript / Next 15 (App Router) / next-auth v5 (`next-auth@beta`) with `@auth/drizzle-adapter` / drizzle-orm + `@neondatabase/serverless` / vitest / Playwright (screenshots).

**Spec:** `docs/superpowers/specs/2026-10-01-free-tier-and-sign-in-design.md`

## Global Constraints

- A generation is a **completed** tailoring. Ledger row written only after the pipeline's `done`; failures record nothing.
- Free allowance is **10 in a rolling 7 days** (`FREE_PER_WEEK = 10`, `WINDOW_MS = 7 * 24 * 60 * 60 * 1000`). No calendar reset.
- **Recording** happens whenever `DATABASE_URL` is set. **Refusing** happens only while `REZZ_ENFORCE_GATES` is not exactly `"false"` (trimmed, case-insensitive; existing `gatesEnforced` semantics). Gate off ⇒ no ledger read. No `DATABASE_URL` ⇒ no database access at all.
- Downloads are never gated. `checkDownload` is deleted.
- Never store the resume, job description, result or decisions server-side. Ledger columns are exactly: `id, user_id, browser_id, created_at, company, role, model, cost_paise`.
- Email sign-in is a **magic link** (Auth.js Resend provider). No passwords anywhere.
- Anonymous browser cookie: name `rezz_b`, value `<id>.<hmac>`, HMAC-SHA256 with `AUTH_SECRET`, `HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`, `Secure` outside development.
- Rate limits on `POST /api/tailor/stream`: anonymous 5 per rolling hour per IP, signed-in 20. IP = first entry of `x-forwarded-for`, else `"local"`.
- A ledger failure while the gate is on refuses with HTTP 503 `{ error: "Try again in a minute." }`. It never opens the gate.
- Day copy is in `Asia/Kolkata`, format `"Thursday 8 Oct"` (weekday, day, short month, no comma, no year).
- Copy rules (CLAUDE.md): never "Never invents"; no ATS score; promise strip unchanged. UI follows the `rezz-design` skill (`.claude/skills/rezz-design/SKILL.md`); every new screen is screenshotted at 390px and desktop before it is called done.
- Model split for subagents: Tasks 1, 2, 3, 7 → Sonnet-class; Tasks 4, 5, 6 → Opus-class. The owner's session reviews each task against the spec.

## Review Focus

1. **Ledger unreachable, gate on.** A user pressing "Tailor my resume" while Neon is down must see "Try again in a minute", never a free pass. → Task 4 `refuses with 503 when the ledger throws and the gate is on`.
2. **Gate off must not read, but must still count.** `REZZ_ENFORCE_GATES=false` with a database set: zero `usage` calls, one `record` call per completed run. → Task 4 `records without reading when the gate is off`.
3. **Window boundary.** Ten rows with the oldest at exactly 7 days minus one minute ⇒ capped, `opensAt` one minute from now; oldest at 7 days plus one minute ⇒ allowed. → Task 1 `caps at ten and names when the oldest falls out`; Task 3 `usage excludes rows at or before since`.
4. **Signing in does not inherit the browser's free run.** A cookie that has already tailored, plus a fresh signed-in user ⇒ allowed, count 0. → Task 4 `a signed-in user is judged by the user ledger, not the browser cookie`.
5. **Return from OAuth with storage gone.** Landing on `/job?resume=1` with no resume in `sessionStorage` must go to `/upload` (existing guard), and with a resume but no JD must show the empty textarea with the "Paste the job again" line, never auto-start. → Task 6 `does not auto-start without a job in storage` (Playwright check in the task's verification step).

---

### Task 1: Gate decisions and day copy

**Files:**
- Modify: `src/lib/gates.ts` (rewrite)
- Modify: `src/lib/gates.test.ts` (rewrite; drop `checkDownload` tests, keep `gatesEnforced` tests and the guardrail test that uses `checkOp`)

**Interfaces:**
- Produces:
  ```ts
  export const FREE_PER_WEEK = 10;
  export const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  export type Entitlement =
    | { kind: "anonymous"; used: boolean }
    | { kind: "user"; recentCount: number; oldestRecent: Date | null };
  export type GateDecision =
    | { allowed: true; reason: "enforced_and_entitled" | "gates_disabled" }
    | { allowed: false; gate: "sign_in" }
    | { allowed: false; gate: "capped"; opensAt: Date };
  export function gatesEnforced(env?: NodeJS.ProcessEnv): boolean; // unchanged
  export function checkTailor(entitlement: Entitlement, env?: NodeJS.ProcessEnv, now?: Date): GateDecision;
  export function opensCopy(opensAt: Date): string; // "Thursday 8 Oct", Asia/Kolkata
  export function gateCopy(gate: "sign_in" | "capped", opensAt?: Date): { title: string; body: string };
  ```
- `opensAt = new Date(oldestRecent.getTime() + WINDOW_MS)`.
- `gateCopy("sign_in")` → title `Sign in to keep tailoring`, body `Your first one was free. Sign in for 10 a week — no card, no renewals.`
- `gateCopy("capped", opensAt)` → title `You've used your 10 free this week`, body `The next one opens ${opensCopy(opensAt)}. Passes are coming, and they'll never renew.`

- [ ] **Step 1: Write the failing tests** in `src/lib/gates.test.ts`

```ts
const on = {} as NodeJS.ProcessEnv;
const off = { REZZ_ENFORCE_GATES: "false" } as NodeJS.ProcessEnv;
const now = new Date("2026-10-01T06:00:00Z");

describe("checkTailor", () => {
  it("lets a fresh anonymous browser run", () =>
    expect(checkTailor({ kind: "anonymous", used: false }, on, now)).toEqual({ allowed: true, reason: "enforced_and_entitled" }));
  it("asks a used anonymous browser to sign in", () =>
    expect(checkTailor({ kind: "anonymous", used: true }, on, now)).toEqual({ allowed: false, gate: "sign_in" }));
  it("lets a user with nine recent runs go", () =>
    expect(checkTailor({ kind: "user", recentCount: 9, oldestRecent: new Date("2026-09-25T06:00:00Z") }, on, now).allowed).toBe(true));
  it("caps at ten and names when the oldest falls out", () => {
    const oldest = new Date(now.getTime() - WINDOW_MS + 60_000);
    expect(checkTailor({ kind: "user", recentCount: 10, oldestRecent: oldest }, on, now))
      .toEqual({ allowed: false, gate: "capped", opensAt: new Date(now.getTime() + 60_000) });
  });
  it("opens everything when the gate is off", () => {
    expect(checkTailor({ kind: "anonymous", used: true }, off, now)).toEqual({ allowed: true, reason: "gates_disabled" });
    expect(checkTailor({ kind: "user", recentCount: 10, oldestRecent: now }, off, now).allowed).toBe(true);
  });
});

describe("opensCopy", () => {
  it("names the day in IST", () => expect(opensCopy(new Date("2026-10-08T05:00:00Z"))).toBe("Thursday 8 Oct"));
  it("crosses the year", () => expect(opensCopy(new Date("2026-12-31T20:00:00Z"))).toBe("Friday 1 Jan"));
});

describe("gateCopy", () => {
  it("puts the day into the cap card", () =>
    expect(gateCopy("capped", new Date("2026-10-08T05:00:00Z")).body).toBe(
      "The next one opens Thursday 8 Oct. Passes are coming, and they'll never renew."));
});
```

Keep the existing `gatesEnforced` block and the guardrail test that shows `checkOp` ignores the switch. Delete the `checkDownload` block and the `ANONYMOUS` import.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/gates.test.ts`
Expected: FAIL — `checkTailor` has the wrong arity / `opensCopy` is not exported.

- [ ] **Step 3: Rewrite `src/lib/gates.ts`** with the interfaces above. Rewrite the header comment: gates decide who may *tailor*, guardrails decide what a document may contain; downloads are never gated (1 Oct 2026). `opensCopy` uses `Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).formatToParts` and joins weekday, day, month with single spaces.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/gates.test.ts && npm run typecheck`
Expected: PASS; typecheck clean (nothing else imports `checkDownload` or `ANONYMOUS` — confirm with `grep -rn "checkDownload\|ANONYMOUS" src`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gates.ts src/lib/gates.test.ts
git commit -m "feat(gates): decide tailoring access, not downloads; rolling weekly cap and day copy"
```

---

### Task 2: Signed browser id and IP rate limiter

**Files:**
- Create: `src/lib/browser-id.ts`, `src/lib/browser-id.test.ts`
- Create: `src/lib/rate-limit.ts`, `src/lib/rate-limit.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // browser-id.ts
  export const BROWSER_COOKIE = "rezz_b";
  export function readBrowserId(cookieHeader: string | null, secret: string): string | null; // null if absent or bad signature
  export function mintBrowserId(secret: string, secure: boolean): { id: string; setCookie: string };
  // rate-limit.ts
  export class RateLimiter {
    constructor(limit: number, windowMs: number);
    allow(key: string, now?: Date): boolean; // sliding window: true and records if under limit
  }
  export function clientIp(request: Request): string; // first x-forwarded-for entry, trimmed, else "local"
  ```
- `id` is 16 random bytes, base64url. Signature is HMAC-SHA256(id, secret), base64url, first 32 chars. Use `node:crypto`.

- [ ] **Step 1: Write failing tests**

```ts
// browser-id.test.ts
it("round-trips a minted id", () => {
  const { id, setCookie } = mintBrowserId("s3cret", false);
  expect(setCookie).toMatch(/^rezz_b=[^;]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=31536000$/);
  expect(readBrowserId(setCookie.split(";")[0], "s3cret")).toBe(id);
});
it("adds Secure in production", () => expect(mintBrowserId("s", true).setCookie).toContain("; Secure"));
it("rejects a tampered or foreign-key cookie", () => {
  const { setCookie } = mintBrowserId("s3cret", false);
  const cookie = setCookie.split(";")[0];
  expect(readBrowserId(cookie, "other")).toBeNull();
  expect(readBrowserId(cookie.replace(/.$/, "x"), "s3cret")).toBeNull();
  expect(readBrowserId("rezz_b=garbage", "s3cret")).toBeNull();
  expect(readBrowserId(null, "s3cret")).toBeNull();
});
it("finds the cookie among others", () => {
  const { id, setCookie } = mintBrowserId("s3cret", false);
  expect(readBrowserId(`theme=dark; ${setCookie.split(";")[0]}; x=1`, "s3cret")).toBe(id);
});

// rate-limit.test.ts
it("allows up to the limit then refuses within the window", () => {
  const rl = new RateLimiter(2, 60_000); const t = new Date(0);
  expect(rl.allow("a", t)).toBe(true); expect(rl.allow("a", t)).toBe(true); expect(rl.allow("a", t)).toBe(false);
  expect(rl.allow("b", t)).toBe(true);
});
it("forgets hits that left the window", () => {
  const rl = new RateLimiter(1, 60_000);
  expect(rl.allow("a", new Date(0))).toBe(true);
  expect(rl.allow("a", new Date(59_999))).toBe(false);
  expect(rl.allow("a", new Date(60_001))).toBe(true);
});
it("reads the first forwarded ip", () => {
  expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": " 1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
  expect(clientIp(new Request("http://x"))).toBe("local");
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/browser-id.test.ts src/lib/rate-limit.test.ts` → FAIL, modules missing.

- [ ] **Step 3: Implement both modules.** `RateLimiter` keeps `Map<string, number[]>` of hit timestamps and prunes on each call; add a file comment that this is per-instance and moves to a store when there is a second instance.

- [ ] **Step 4: Run to verify pass** — same command → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/browser-id.ts src/lib/browser-id.test.ts src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "feat: signed anonymous browser id and per-ip sliding-window rate limiter"
```

---

### Task 3: Database schema and the ledger

**Files:**
- Modify: `package.json` (deps: `drizzle-orm`, `@neondatabase/serverless`, `next-auth@beta`, `@auth/drizzle-adapter`; dev: `drizzle-kit`; scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`)
- Create: `drizzle.config.ts` (dialect `postgresql`, schema `./src/lib/db/schema.ts`, out `./drizzle`, `dbCredentials.url = process.env.DATABASE_URL`)
- Create: `src/lib/db/schema.ts`, `src/lib/db/index.ts`
- Create: `src/lib/ledger.ts`, `src/lib/ledger.test.ts`
- Modify: `.env.example` (append `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`, `AUTH_TRUST_HOST=true`, each with a one-line comment in the file's existing voice; `NEXT_PUBLIC_CONTACT_EMAIL` is added in Task 7)
- Modify: `.gitignore` (nothing — `drizzle/` migrations are committed)

**Interfaces:**
- Produces:
  ```ts
  // schema.ts — Auth.js tables copied from the @auth/drizzle-adapter Postgres reference
  export const users, accounts, sessions, verificationTokens;
  export const tailorings = pgTable("tailorings", {
    id: uuid().primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    browserId: text("browser_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    company: text().notNull(), role: text().notNull(), model: text().notNull(),
    costPaise: integer("cost_paise").notNull(),
  }); // plus indexes on (user_id, created_at) and (browser_id, created_at)
  // index.ts
  export function db(): NeonHttpDatabase | null; // null when DATABASE_URL is unset; memoised
  // ledger.ts
  export type Subject = { user: string } | { browser: string };
  export type LedgerRow = { subject: Subject; at: Date; company: string; role: string; model: string; costPaise: number };
  export interface Ledger {
    usage(subject: Subject, since: Date): Promise<{ count: number; oldest: Date | null }>; // rows with at > since
    record(row: LedgerRow): Promise<void>;
  }
  export class MemoryLedger implements Ledger { rows: LedgerRow[] }
  export class DrizzleLedger implements Ledger { constructor(db: NeonHttpDatabase) }
  export function ledger(): Ledger | null; // DrizzleLedger over db(), or null
  ```

- [ ] **Step 1: Install dependencies**

Run: `npm i drizzle-orm @neondatabase/serverless next-auth@beta @auth/drizzle-adapter && npm i -D drizzle-kit`
Expected: `package.json` lists all five; `npm run typecheck` still clean.

- [ ] **Step 2: Write the failing ledger tests** against `MemoryLedger` (the contract both implementations meet)

```ts
const at = (iso: string) => new Date(iso);
const row = (subject: Subject, iso: string): LedgerRow => ({ subject, at: at(iso), company: "Kosha", role: "Backend", model: "claude-sonnet-5", costPaise: 412 });

it("counts only the subject's rows inside the window and returns the oldest", async () => {
  const l = new MemoryLedger();
  await l.record(row({ user: "u1" }, "2026-09-20T00:00:00Z"));
  await l.record(row({ user: "u1" }, "2026-09-28T00:00:00Z"));
  await l.record(row({ user: "u1" }, "2026-09-30T00:00:00Z"));
  await l.record(row({ user: "u2" }, "2026-09-29T00:00:00Z"));
  await l.record(row({ browser: "u1" }, "2026-09-29T00:00:00Z"));
  expect(await l.usage({ user: "u1" }, at("2026-09-24T00:00:00Z"))).toEqual({ count: 2, oldest: at("2026-09-28T00:00:00Z") });
});
it("usage excludes rows at or before since", async () => {
  const l = new MemoryLedger();
  await l.record(row({ browser: "b" }, "2026-09-24T00:00:00Z"));
  expect(await l.usage({ browser: "b" }, at("2026-09-24T00:00:00Z"))).toEqual({ count: 0, oldest: null });
});
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run src/lib/ledger.test.ts` → FAIL.

- [ ] **Step 4: Write `schema.ts`, `db/index.ts`, `ledger.ts`, `drizzle.config.ts`.** `DrizzleLedger.usage` is one query: `select count(*), min(created_at) where <subject column> = ? and created_at > ?`. `DrizzleLedger.record` inserts with `userId`/`browserId` from the subject, the other null.

- [ ] **Step 5: Generate the migration** — `DATABASE_URL=postgres://x:y@localhost/z npm run db:generate` → a SQL file appears in `drizzle/`. Open it and confirm the five tables and two indexes. Commit the folder.

- [ ] **Step 6: Run to verify pass** — `npx vitest run src/lib/ledger.test.ts && npm run typecheck && npm run lint` → PASS.

- [ ] **Step 7: Append the env block to `.env.example`** (values blank, `AUTH_TRUST_HOST=true` set).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts drizzle src/lib/db src/lib/ledger.ts src/lib/ledger.test.ts .env.example
git commit -m "feat(db): drizzle schema on neon, auth tables and the tailorings ledger"
```

---

### Task 4: Entitlement resolver, `/api/me`, and enforcement in the stream route

**Files:**
- Create: `src/lib/entitlement.ts`, `src/lib/entitlement.test.ts`
- Create: `src/app/api/me/route.ts`
- Modify: `src/app/api/tailor/stream/route.ts`
- Modify: `src/lib/analytics.ts` (add events `"signin_shown" | "signin_done" | "cap_shown"` to `FunnelEvent`)

**Interfaces:**
- Consumes: Task 1 `checkTailor`, `gatesEnforced`, `WINDOW_MS`; Task 2 `readBrowserId`, `mintBrowserId`, `RateLimiter`, `clientIp`; Task 3 `Ledger`, `Subject`, `ledger()`.
- Consumes (from Task 5, stubbed here as an injected value): the current user `{ id: string; email: string | null } | null`.
- Produces:
  ```ts
  export class LedgerUnavailable extends Error {}
  export type Access = {
    decision: GateDecision;
    subject: Subject | null;      // who to record the run against; null when there is no ledger
    setCookie: string | null;     // a freshly minted browser cookie to send back, or null
    email: string | null;
  };
  export async function resolveTailorAccess(input: {
    user: { id: string; email: string | null } | null;
    cookieHeader: string | null;
    ledger: Ledger | null;
    secret: string;
    secure: boolean;
    env?: NodeJS.ProcessEnv;
    now?: Date;
  }): Promise<Access>;
  ```
- Rules inside `resolveTailorAccess`:
  - Subject: `{ user: user.id }` if signed in; else the cookie's id, minting one (and setting `setCookie`) if absent or invalid. Subject is `null` only when `ledger` is null.
  - Gate off ⇒ `decision = { allowed: true, reason: "gates_disabled" }`, **no `usage` call**.
  - Gate on and `ledger` null ⇒ throw `LedgerUnavailable` (a production without a database must not run open).
  - Gate on ⇒ `usage(subject, now - WINDOW_MS)`; anonymous ⇒ `{ kind: "anonymous", used: count > 0 }`; user ⇒ `{ kind: "user", recentCount: count, oldestRecent: oldest }`; any thrown error from `usage` is rethrown as `LedgerUnavailable`.
- `GET /api/me` → `200 { signedIn: boolean; email: string | null; decision: GateDecision }` (`opensAt` serialised as ISO string), with `Set-Cookie` when minted; `503 { error: "Try again in a minute." }` on `LedgerUnavailable`. Header `Cache-Control: no-store`.
- `POST /api/tailor/stream` order: credentials check (existing) → rate limit by `clientIp` (`anon` limiter 5/h, `user` limiter 20/h, module-level instances) → `429 { error: "Too many tailorings from this connection. Try again in an hour." }` → `resolveTailorAccess` → `401 { error, gate: "sign_in" }` / `429 { error, gate: "capped", opensAt }` (both using `gateCopy` for `error`) / `503` on `LedgerUnavailable` → body validation (existing) → stream. On `done`, `await ledger.record({ subject, at: new Date(), company: result.plan.company, role: result.plan.role, model: result.models.planner, costPaise: Math.round(cost * 100) })` inside its own try/catch that only `console.error`s — a failed write never fails the response. Add `Set-Cookie` to the stream response when `setCookie` is non-null.

- [ ] **Step 1: Write failing tests** in `src/lib/entitlement.test.ts` with a `MemoryLedger` and a spy wrapper

```ts
const secret = "s3cret"; const now = new Date("2026-10-01T06:00:00Z");
const on = {} as NodeJS.ProcessEnv; const off = { REZZ_ENFORCE_GATES: "false" } as NodeJS.ProcessEnv;
const spy = (l: Ledger) => ({ usage: vi.fn(l.usage.bind(l)), record: vi.fn(l.record.bind(l)) });

it("mints a cookie and lets a fresh browser run", async () => {
  const a = await resolveTailorAccess({ user: null, cookieHeader: null, ledger: new MemoryLedger(), secret, secure: false, env: on, now });
  expect(a.decision.allowed).toBe(true); expect(a.setCookie).toMatch(/^rezz_b=/); expect(a.subject).toHaveProperty("browser");
});
it("asks a used browser to sign in", async () => {
  const l = new MemoryLedger(); const { id, setCookie } = mintBrowserId(secret, false);
  await l.record({ subject: { browser: id }, at: now, company: "", role: "", model: "", costPaise: 0 });
  const a = await resolveTailorAccess({ user: null, cookieHeader: setCookie.split(";")[0], ledger: l, secret, secure: false, env: on, now });
  expect(a.decision).toEqual({ allowed: false, gate: "sign_in" }); expect(a.setCookie).toBeNull();
});
it("a signed-in user is judged by the user ledger, not the browser cookie", async () => {
  const l = new MemoryLedger(); const { id, setCookie } = mintBrowserId(secret, false);
  await l.record({ subject: { browser: id }, at: now, company: "", role: "", model: "", costPaise: 0 });
  const a = await resolveTailorAccess({ user: { id: "u1", email: "a@b.c" }, cookieHeader: setCookie.split(";")[0], ledger: l, secret, secure: false, env: on, now });
  expect(a.decision.allowed).toBe(true); expect(a.subject).toEqual({ user: "u1" });
});
it("caps a user at ten in the window", async () => {
  const l = new MemoryLedger();
  for (let i = 0; i < 10; i++) await l.record({ subject: { user: "u1" }, at: new Date(now.getTime() - i * 3600_000), company: "", role: "", model: "", costPaise: 0 });
  const a = await resolveTailorAccess({ user: { id: "u1", email: null }, cookieHeader: null, ledger: l, secret, secure: false, env: on, now });
  expect(a.decision).toMatchObject({ allowed: false, gate: "capped" });
});
it("records without reading when the gate is off", async () => {
  const l = spy(new MemoryLedger());
  const a = await resolveTailorAccess({ user: null, cookieHeader: null, ledger: l, secret, secure: false, env: off, now });
  expect(a.decision).toEqual({ allowed: true, reason: "gates_disabled" }); expect(l.usage).not.toHaveBeenCalled(); expect(a.subject).not.toBeNull();
});
it("has no subject and no cookie without a ledger while the gate is off", async () => {
  const a = await resolveTailorAccess({ user: null, cookieHeader: null, ledger: null, secret, secure: false, env: off, now });
  expect(a.subject).toBeNull(); expect(a.setCookie).toBeNull();
});
it("refuses with LedgerUnavailable when the ledger throws and the gate is on", async () => {
  const l: Ledger = { usage: async () => { throw new Error("ECONNREFUSED"); }, record: async () => {} };
  await expect(resolveTailorAccess({ user: null, cookieHeader: null, ledger: l, secret, secure: false, env: on, now })).rejects.toBeInstanceOf(LedgerUnavailable);
  await expect(resolveTailorAccess({ user: null, cookieHeader: null, ledger: null, secret, secure: false, env: on, now })).rejects.toBeInstanceOf(LedgerUnavailable);
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/entitlement.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/lib/entitlement.ts`.**

- [ ] **Step 4: Run to verify pass** — same command → PASS.

- [ ] **Step 5: Write `src/app/api/me/route.ts`** and **modify the stream route** per the order above. Until Task 5 lands, read the user through a tiny `src/lib/current-user.ts` exporting `currentUser(): Promise<{ id: string; email: string | null } | null>` that returns `null`; Task 5 replaces its body. `secret = process.env.AUTH_SECRET ?? "dev-only-secret"` with a `console.warn` once when the fallback is used outside `NODE_ENV=production`; in production a missing `AUTH_SECRET` throws at first use. `secure = process.env.NODE_ENV === "production"`.

- [ ] **Step 6: Route-level check by hand.** `npm run dev` with no `DATABASE_URL` and `REZZ_ENFORCE_GATES=false`:

```bash
curl -s -i localhost:3001/api/me | head -20
```
Expected: `200`, body `{"signedIn":false,"email":null,"decision":{"allowed":true,"reason":"gates_disabled"}}`, no `Set-Cookie`. Then with `REZZ_ENFORCE_GATES` unset and still no `DATABASE_URL`: `503 {"error":"Try again in a minute."}`.

- [ ] **Step 7: Verify** — `npm run test && npm run typecheck && npm run lint` → all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/entitlement.ts src/lib/entitlement.test.ts src/lib/current-user.ts src/app/api/me/route.ts src/app/api/tailor/stream/route.ts src/lib/analytics.ts
git commit -m "feat(tailor): enforce the tailoring gate on the server and record every completed run"
```

---

### Task 5: Auth.js with Google and the Resend magic link

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Modify: `src/lib/current-user.ts` (body becomes `const s = await auth(); return s?.user?.id ? { id: s.user.id, email: s.user.email ?? null } : null;`)
- Create: `src/lib/auth.test.ts` (config-shape test only; no network)

**Interfaces:**
- Consumes: Task 3 `db()`, `users`, `accounts`, `sessions`, `verificationTokens`.
- Produces: `export const { handlers, auth, signIn, signOut } = NextAuth(config)` from `src/lib/auth.ts`; `export const authConfig: NextAuthConfig` (exported separately so the test can inspect it).
- Config pinned by the spec:
  - `adapter: DrizzleAdapter(db()!, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens })`; if `db()` is null, `auth.ts` throws at import with `"Sign-in needs DATABASE_URL."` — the route file is only reached when someone opens a sign-in URL, so local dev without a database still runs the rest of the app.
  - `session: { strategy: "database" }`.
  - `providers: [Google({ allowDangerousEmailAccountLinking: true }), Resend({ from: process.env.AUTH_EMAIL_FROM, maxAge: 10 * 60 })]`. Google verifies email ownership, so linking a Google login to an existing magic-link user by email is safe and avoids the "account not linked" dead end.
  - `pages: { signIn: "/job?gate=sign_in", verifyRequest: "/job?gate=check_inbox", error: "/job?gate=auth_error" }`.
  - `callbacks.redirect`: allow only same-origin URLs; default `/job?resume=1`.
  - `trustHost: true` (read from `AUTH_TRUST_HOST` by Auth.js; set explicitly too).

- [ ] **Step 1: Write the failing config test**

```ts
import { authConfig } from "./auth";  // mock "@/lib/db" so db() returns a stub object
it("uses database sessions, two providers, and a ten-minute magic link", () => {
  expect(authConfig.session?.strategy).toBe("database");
  expect(authConfig.providers.map((p: any) => p.id ?? p.options?.id)).toEqual(["google", "resend"]);
  const resend: any = authConfig.providers[1];
  expect(resend.maxAge ?? resend.options?.maxAge).toBe(600);
  expect(authConfig.pages?.signIn).toBe("/job?gate=sign_in");
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/auth.test.ts` → FAIL.

- [ ] **Step 3: Write `src/lib/auth.ts` and the route handler** (`export const { GET, POST } = handlers;`). Update `current-user.ts`.

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/lib/auth.test.ts && npm run typecheck` → PASS.

- [ ] **Step 5: Live check against a real Neon database** (owner supplies `DATABASE_URL`, `AUTH_*` in `.env`; run `npm run db:migrate` first). `npm run dev`, open `http://localhost:3001/api/auth/signin`, sign in with Google. Then `curl -s -b "<authjs.session-token cookie>" localhost:3001/api/me` → `signedIn: true` with the email. Send a magic link to an inbox you own; the link lands on `/job?resume=1` signed in. Record both outcomes in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/lib/current-user.ts "src/app/api/auth/[...nextauth]/route.ts"
git commit -m "feat(auth): Auth.js with Google and a ten-minute Resend magic link, database sessions"
```

---

### Task 6: Sign-in sheet, cap card, and the job-screen round trip

Load `.claude/skills/rezz-design/SKILL.md` and the `frontend-design` skill before writing any markup.

**Files:**
- Create: `src/components/flow/SignInSheet.tsx`
- Create: `src/components/flow/CapCard.tsx`
- Modify: `src/app/job/page.tsx`
- Modify: `src/app/tailoring/page.tsx:170-180` (refusal handling)
- Modify: `scripts/screenshots.mjs` (seed `/job?gate=sign_in` and `/job?gate=capped&opensAt=2026-10-08T05:00:00Z` by intercepting `/api/me`)

**Interfaces:**
- Consumes: Task 1 `gateCopy`, `opensCopy`; Task 4 `GET /api/me` shape; Task 5 `signIn` from `next-auth/react`; `track` events `signin_shown`, `signin_done`, `cap_shown`.
- Produces:
  ```tsx
  export function SignInSheet(props: { state: "choose" | "check_inbox" | "auth_error"; onEmail(email: string): Promise<void>; onGoogle(): void; onClose(): void }): JSX.Element;
  export function CapCard(props: { opensAt: Date; onBack(): void }): JSX.Element;
  ```
- Job page behaviour:
  1. `submit()` becomes async: `track("jd_submitted")`, `session.setJob`, then `fetch("/api/me")`. `allowed` ⇒ `router.push("/tailoring")`. `gate === "sign_in"` ⇒ open the sheet (`track("signin_shown")`). `gate === "capped"` ⇒ show `CapCard` (`track("cap_shown")`) in place of the button row. `503` or network error ⇒ inline `role="alert"` line "Try again in a minute." under the button. The button shows "Checking…" while the request is in flight and is disabled.
  2. On mount, read `searchParams`: `gate=sign_in|check_inbox|auth_error` opens the sheet in that state; `resume=1` with a job in storage ⇒ call `submit()` automatically once (`track("signin_done")` when `/api/me` says signed in); `resume=1` without a job ⇒ no auto-start, and the helper line under the button reads "Paste the job again — your sign-in worked, but this tab lost the posting."
  3. `onGoogle` → `signIn("google", { callbackUrl: "/job?resume=1" })`. `onEmail(email)` → `signIn("resend", { email, callbackUrl: "/job?resume=1", redirect: false })` then state `check_inbox`.
- Sheet copy (exact): title and body from `gateCopy("sign_in")`; primary `Continue with Google`; divider `or`; input label (visible) `Email`; secondary `Send me a link`. `check_inbox` state: heading `Check your inbox`, body `The link works for 10 minutes. Come back to this tab.` `auth_error` state: the `choose` layout with a `role="alert"` line above the buttons: `That link didn't work — it may have expired. Try again.`
- Sheet form: a drawn sheet (`box`/`offset` from `skin.ts`) over the job screen with a dimmed paper backdrop, `role="dialog" aria-modal="true" aria-labelledby`, focus moves to the heading on open, Escape and the backdrop call `onClose`. Both actions carry equal visual weight (Button `primary` for Google, `secondary` for the link, same size) — the spec's two-equal-options rule. No spinner, no countdown, no third-party logo besides a plain "G" glyph if any.
- Cap card: title and body from `gateCopy("capped", opensAt)`; one `Button` `Back to my result` → `router.push("/result")` if `session.getResult()` else `/upload`.
- Tailoring page: when the stream `POST` returns `401`/`429`/`503` JSON with a `gate`, `router.replace(gate === "sign_in" ? "/job?gate=sign_in" : `/job?gate=capped&opensAt=${encodeURIComponent(opensAt)}`)`; `503` keeps today's inline error with the body's `error` text.

- [ ] **Step 1: Write `SignInSheet.tsx` and `CapCard.tsx`.**

- [ ] **Step 2: Wire `src/app/job/page.tsx` and `src/app/tailoring/page.tsx`** as specified.

- [ ] **Step 3: Extend `scripts/screenshots.mjs`** to photograph `job-signin`, `job-check-inbox`, `job-capped` at 390px and 1280px, light and dark, by fulfilling `/api/me` with the matching decision.

- [ ] **Step 4: Run the screenshots and look at them.**

Run: `npm run dev` (with `REZZ_ENFORCE_GATES=false`, no database) then `npm run screenshots`
Expected: six new files in `screenshots/`. Open each with the Read tool. Check: nothing clipped at 390px, no horizontal scroll, both sheet buttons the same size, the cap card's day reads "Thursday 8 Oct", dark theme has no white flashes. Fix and re-shoot until true. Paste the file names into the commit message.

- [ ] **Step 5: Playwright check for Review Focus 5** (ad hoc, in the same dev server): seed `sessionStorage` with a resume and no job, open `/job?resume=1`, assert the textarea is empty, the button is disabled, and the helper line contains "Paste the job again"; assert no request to `/api/tailor/stream` was made. Then seed a job too and assert `/api/me` is requested on load. Record both results in the commit message.

- [ ] **Step 6: Verify** — `npm run typecheck && npm run lint && npm run test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/flow/SignInSheet.tsx src/components/flow/CapCard.tsx src/app/job/page.tsx src/app/tailoring/page.tsx scripts/screenshots.mjs
git commit -m "feat(flow): sign-in sheet and weekly cap card on the job screen; auto-resume after sign-in"
```

---

### Task 7: Landing copy, account mark, privacy page

Load `.claude/skills/rezz-design/SKILL.md` first.

**Files:**
- Create: `src/components/flow/AccountMark.tsx`
- Modify: `src/components/flow/FlowHeader.tsx:41` (render `<AccountMark />` before `ThemeToggle`)
- Modify: `src/app/page.tsx` (landing header: same `<AccountMark />`; copy at ~222, ~433–437, ~501–504, ~531)
- Modify: `src/app/privacy/page.tsx:36-43`
- Modify: `docs/04-web-flow.md` screen table row 08 (file stays; note the sheet now lives in `src/components/flow/SignInSheet.tsx`)

**Interfaces:**
- Consumes: `GET /api/me` (Task 4), `signOut` from `next-auth/react` (Task 5).
- Produces: `export function AccountMark(): JSX.Element | null` — client component; fetches `/api/me` once on mount; renders nothing while loading or when anonymous; when signed in renders the email truncated to 24 characters with an ellipsis (`title` holds the full address) and a text button `Sign out` → `signOut({ callbackUrl: "/" })`. Uses `font-mark text-xs text-ink-muted` like the step label; no avatar, no menu, no border.

- [ ] **Step 1: Write `AccountMark.tsx` and place it** in both headers.

- [ ] **Step 2: Landing copy**, exact strings:
  - Badge at ~222: `1 free resume a week` → `10 free a week after you sign in`.
  - Free `PassCard` `per` at ~433: `One tailored resume a week` → `10 tailored resumes a week`. Update the code comment above `features` so it no longer claims the `per` line says "One".
  - FAQ "Do I need to sign up?" body: `Not to try. Your first tailored resume needs no account. After that you sign in with Google or an email link — no password, no phone number — and get 10 a week free.`
  - Line at ~531: `One resume a week is free, and you don't need an account to see what changes.` → `Your first resume is free with no account, and 10 a week are free once you sign in.`
  - `grep -n "phone\|OTP\|one-time code\|1 free\|One tailored resume a week\|One resume a week" src/app/page.tsx` → no matches.
- [ ] **Step 3: Privacy page.** Replace the "No account, no tracking profile" and "When this changes" paragraphs with two paragraphs, exact:
  - `<strong>Without an account.</strong> Your first tailored resume needs no sign-in. We set one cookie that tells us this browser has already had its free run, and record the date, the company and role you tailored for, and what the run cost us. Nothing from your resume or the job text is stored.`
  - `<strong>With an account.</strong> When you sign in with Google or an email link we store your email address (and, for Google, its account id), and each tailoring's date, company, role and cost against it. That is the whole record. To delete it, email the address in the footer and it is gone within a week; a self-serve button is coming.`
  - The address comes from `process.env.NEXT_PUBLIC_CONTACT_EMAIL`, rendered as a `mailto:` link. There is no contact address anywhere on the site today (checked 1 Oct 2026). When the variable is unset the sentence reads `To delete it, reply to any sign-in email from Rezz and it is gone within a week; a self-serve button is coming.` Add `NEXT_PUBLIC_CONTACT_EMAIL` to `.env.example` with a comment saying the privacy page shows it and production must set it.

- [ ] **Step 4: Screenshot** the landing hero and pricing at 390px and 1280px, and the flow header signed in (intercept `/api/me` with `signedIn: true, email: "priya.sharma@example.com"`). Look at each. The mark must not wrap the header onto a second line at 390px; if it does, hide the email below 680px and keep only `Sign out`.

- [ ] **Step 5: Verify** — `npm run typecheck && npm run lint && npm run test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/flow/AccountMark.tsx src/components/flow/FlowHeader.tsx src/app/page.tsx src/app/privacy/page.tsx docs/04-web-flow.md
git commit -m "feat(landing): 10-a-week copy, signed-in mark in both headers, privacy page states the ledger"
```

---

### Task 8: Rollout notes and the production flip

**Files:**
- Modify: `README.md` (a "Sign-in and the ledger" section: env vars, `npm run db:migrate`, the two switches and what each does, the Google consent-screen and Resend domain prerequisites)
- Modify: `docs/07-open-items.md` (tick the commercial-layer line's "ship now" half; add "self-serve account delete before passes")
- Modify: `docs/05-architecture.md:78` (`Guardrails: phone-OTP + free cap` → `Guardrails: sign-in on the second tailoring + 10/week cap + per-IP rate limit; monthly spend limit in the console`)

- [ ] **Step 1: Write the README section and the doc edits.**

- [ ] **Step 2: Full verification** — `npm run test && npm run typecheck && npm run lint && npm run build` → all PASS. `npm run start` with `.env` holding the real `DATABASE_URL` and `AUTH_*`, `REZZ_ENFORCE_GATES` unset: run one anonymous tailoring end to end (ledger row appears: `select count(*) from tailorings` = 1 with `browser_id` set), press "Tailor my resume" again → sheet; sign in with Google → tailoring starts on its own → second row has `user_id`. Record both row ids in the commit message.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/07-open-items.md docs/05-architecture.md
git commit -m "docs: sign-in and ledger rollout notes; architecture guardrails updated"
```

- [ ] **Step 4: Owner actions, not code** (list in the task report): set `REZZ_ENFORCE_GATES` unset (on) in production once `DATABASE_URL`, `AUTH_*` and `NEXT_PUBLIC_CONTACT_EMAIL` are set there; make sure `AUTH_EMAIL_FROM` accepts replies; set the monthly spend limit in the Anthropic console; confirm Google consent-screen verification is through.
