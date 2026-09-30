# Free tier and sign-in: the gate moves to the tailoring button

**Decided 1 Oct 2026 (owner).** Rezz launches free. The only gate is sign-in, and
it sits on the second tailoring, never on the download. Passes and payment stay
out of the flow until the ledger says what to charge.

## Why

The documented flow gated the download behind phone OTP and a pass picker
(`docs/04-web-flow.md`, screens 08 and 08b). That is the worst spot: the user has
uploaded, pasted a job, waited fifteen seconds and reviewed every line, and only
then hits a wall. It also means everything before it is anonymous, so a free cap
cannot be enforced and API spend (₹3–6 a run) is unbounded.

The owner's actual need right now is to know how many people use Rezz and to keep
the launch free for a while. Phone OTP is the wrong tool for that: SMS DLT
approval is a multi-week long pole, each code costs money, and a phone prompt
loses visitors. Google and a magic link give identity in a day.

`src/lib/gates.ts` already describes gates, but nothing calls it. This spec
replaces a design, not working code.

## The flow

Landing → Upload → Add a job → **(Sign in, on the second run only)** → Tailoring
→ Review → Download → Finish → Add another job.

Once a tailoring has run, its download is always free. Reviewing, undoing and
re-downloading the same result never count.

### What counts

A **generation is a completed tailoring**, recorded as one row in the ledger when
the pipeline finishes. Failed runs are not counted against anyone.

### The three states when "Tailor my resume" is pressed

| Who | Server decision |
| --- | --- |
| Anonymous, this browser has no ledger row | Run. Set the browser cookie; write a ledger row against it. |
| Anonymous, this browser has a ledger row | Refuse with `sign_in`. The client shows the sign-in sheet over the job screen. |
| Signed in, fewer than 10 rows in the last 7 days | Run. Write a row against the user. |
| Signed in, 10 rows in the last 7 days | Refuse with `capped`, carrying the timestamp when the oldest of the ten falls out of the window. |

"A week" is a **rolling 7 days**, counted from now. No cron, no reset job. The
copy names the day the next one opens ("opens Thursday 8 Oct").

### Where enforcement lives

On the server, in the tailoring stream route. The client asks `GET /api/me` for
its state so it can show the right sheet *before* opening the stream, but the
route re-checks and answers a refusal as a typed JSON error, not a stream. A
client that skips the check gets the same answer.

`gates.ts` is rewritten: `checkTailor(entitlement, env)` returns
`run | sign_in | capped`. `checkDownload` and the comment saying tailoring is
always anonymous are removed. The `REZZ_ENFORCE_GATES` switch stays with the same
semantics: only the exact string "false" opens the gate, and with it off nothing
in the request path touches the database.

## Identity

**Auth.js (next-auth v5)** with two providers:

- **Google** OAuth.
- **Email magic link**, sent through Resend. One email, one link, valid 10
  minutes. No passwords anywhere: no hash store, no reset flow, no breach
  surface. (Owner confirmed magic link over password, 1 Oct 2026.)

Session is the Auth.js database session (cookie → sessions table), so signing
out or deleting a user takes effect immediately.

### The anonymous browser cookie

A random id, signed with the Auth.js secret, `httpOnly`, `SameSite=Lax`, one
year. It carries no "used" flag; the ledger does. "Has this browser tailored" is
the same query shape as the signed-in count, against the cookie id instead of the
user id. When an anonymous browser later signs in, its row stays anonymous; the
free run is not transferred to or charged against the account.

## Storage

**Postgres on Neon, Drizzle as the query layer.** Postgres was already the plan
(`docs/05-architecture.md`); Neon is a connection string with a free tier;
Drizzle has an Auth.js adapter and a TypeScript schema.

Tables, and only these:

- The four Auth.js tables: `users`, `accounts`, `sessions`, `verification_tokens`.
- `tailorings`: `id`, `user_id` (nullable), `browser_id` (nullable), `created_at`,
  `company`, `role`, `model`, `cost_paise`. Exactly one of `user_id` /
  `browser_id` is set. This is the allowance ledger and the analytics ledger.

**Deliberately not stored:** the resume, the job description, the result, the
user's decisions. They stay in `sessionStorage` exactly as today
(`src/lib/session.ts`). The privacy page's "your file never sits on a server it
doesn't need to" stays true. Saving results server-side is the tracker's job,
later, and is out of scope here.

### What the ledger answers

Distinct users, runs per day, runs per user, cost per run, anonymous vs signed
in, and the ₹149 pack-size question (`docs/07-open-items.md`). One query each.
Plausible stays on for screen-to-screen funnel counts.

## Screens and copy

### Sign-in sheet

Over the job screen, shown only on the second anonymous press. Reuses the
WebSignIn design (`design/screens/WebSignIn.dc.html`) with the copy changed; the
`rezz-design` skill governs the styling.

> **Sign in to keep tailoring**
> Your first one was free. Sign in for 10 a week — no card, no renewals.
> [ Continue with Google ]
> or
> [ email ] [ Send me a link ]

After sending: "Check your inbox. The link works for 10 minutes. Come back to
this tab." No spinner, no countdown. An expired or wrong link lands on the job
screen with a one-line notice and the sheet open again.

The pasted job and uploaded file live in `sessionStorage`, which survives the
OAuth redirect within the same tab. On return the client re-asks `/api/me` and
starts the tailoring without another press.

### Weekly cap card

Replaces the tailoring start when the count is 10.

> **You've used your 10 free this week**
> The next one opens Thursday 8 Oct. Passes are coming, and they'll never renew.
> [ Back to my result ]

One button. No pass picker, no waitlist. The landing's pass cards already count
intent clicks.

### Landing and header

- Pricing table, Free row: "10 tailored resumes a week, honest check, one clean
  template." Paid rows keep "Passes open soon".
- Badges and FAQ that say "1 free resume a week" or "phone number and a one-time
  code" change to match (`src/app/page.tsx` lines ~222, 433, 502, 531).
- Hero keeps "No sign-up to try": now literally true for the first run.
- Header gains a quiet signed-in mark: truncated email and "Sign out". Nothing
  for anonymous visitors. No avatar, no menu.
- Privacy page (`src/app/privacy/page.tsx`) states what is stored: an email
  address (and Google account id if used), the date, company and role of each
  tailoring, and its cost. Never the resume or the job text. Deleting an account
  is a request to the owner for now; the page says so.

### States designed for

- OAuth popup blocked → full-page redirect.
- Return from Google with the tab's storage gone → job screen, empty, "Paste the
  job again", not an error.
- Magic link opened in a different browser → signed in there, same empty-job
  landing.
- `REZZ_ENFORCE_GATES=false` → no sheet, no cap, no database call.
- Database unreachable with gates on → the tailoring route refuses with a plain
  "Try again in a minute"; it never opens the gate on error.

## Abuse backstops

- IP rate limit on the tailoring route: 5 an hour anonymous, 20 an hour signed
  in. In-memory on one instance, noted in code as the thing to move to a store
  when there are two.
- Monthly spend limit in the Anthropic console (owner action, not code).
- Accepted: clearing cookies buys one more anonymous run; disposable Gmail makes
  10 a week a soft cap. Fine for a launch window behind the spend limit.

## Testing

- Gate decisions as a pure-function table: every row of the states table,
  enforce on and off.
- Ledger count at the rolling-window boundary, and the "opens Thursday 8 Oct"
  copy across month and year ends.
- Route level: anonymous second call without a session returns the `sign_in`
  error, not a stream; enforce off never touches the database (mocked adapter
  asserts zero calls).
- Sign-in sheet and cap card screenshotted at 390 and desktop widths, per the
  UI bar, before being called done.

## Rollout order

1. **Today, owner:** create the Google OAuth client (consent-screen verification
   can take days) and the Resend domain.
2. Neon database, Drizzle schema, ledger writes on every completed tailoring
   (anonymous rows under the browser cookie). Ship before any gate exists: this
   alone answers "how many are using it".
3. Auth.js, `/api/me`, sign-in sheet, cap card, route enforcement.
4. Landing copy, header mark, privacy page.
5. `REZZ_ENFORCE_GATES` on in production.

## Environment

Added: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`. Unchanged: `REZZ_ENFORCE_GATES`.

## Out of scope

Passes, UPI, phone OTP (returns when payment needs exact identity); the tracker
and any server-side saving of results; account page and self-serve delete;
transferring an anonymous run to a new account; multi-instance rate limiting.

## Model choice for the work

Spec and plan written in the owner's session (full context of the decisions).
Implementation by subagents: Sonnet-class for the crisply specified pieces
(schema, ledger, gate table, rate limiter, `/api/me`, day copy); Opus-class for
the Auth.js wiring with the redirect round trip and for the sheet and cap card;
the owner's session reviews each diff against this spec.
