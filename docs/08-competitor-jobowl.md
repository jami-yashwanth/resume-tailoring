# Competitor teardown: JobOwl

Walked 28 Sep 2026, public pages only. `jobowl.co` is the closest thing to a
direct competitor found so far: same job (tailor a resume to a job description),
already selling in India, in rupees.

Walked end to end, including the logged-in product: one real tailoring was run
against the owner's own resume and the Kosha Payments job description from
`fixtures/`, and the output PDF was downloaded and inspected.

## What it is

> "Paste in a job description and get a version of your resume tailored to what
> that role requires."

Claims **95,175 tailored resumes** and **4.9/5 from 1,102 reviews** on the
homepage. Seven languages (en, de, es, fr, ja, pl, ru). Cover letters as well as
resumes. An affiliate programme, and a career coach as a named partner.

## Price

**₹999/month**, unlimited resumes and cover letters, recurring. Free to start,
no card required. Pricing is geolocated — the market is resolved server-side
from the IP, and setting `jobowl_billing_market` by hand does not move it, so
₹999 is what an Indian visitor is shown.

For scale: that is **6.7× our ₹149 Sprint pass** every month, against our
one-time ₹399 for 90 days. We are not competing on price; we are competing on
what the price buys.

## Their flow

```
Upload resume (PDF) → Paste job description → Create account → Generate
```

The account wall sits **before any result**. You cannot see what it does to
your resume without signing up. `docs/01-product.md` went the other way — no
sign-up to try, phone OTP only at download — and that is now a concrete
difference to test rather than an assumption.

## Where they stand opposite us

This is the useful part. On nearly every axis the decision log settled, JobOwl
chose the other branch.

| | JobOwl | Rezz |
| --- | --- | --- |
| The document | Their "ATS-friendly templates" | The user's own file, design kept |
| Unbacked content | "Injects relevant keywords", added automatically | Drafted, marked, inserted only on **Add it** |
| Consent | None per change; edit afterwards if you like | One decision per unbacked line |
| Billing | ₹999/month, recurring | One-time pass, never renews |
| Promise | "More job interviews or money back" | Behaviour, never outcomes |
| Try before signup | No — account before first result | Yes |
| Languages | 7 | English only |
| Cover letters | Yes | Not in scope |

### The contradiction worth knowing about

Their FAQ says tailoring happens "**without making anything up**" and that it
"**shouldn't** invent achievements" — hedged, note the modal verb.

Their own homepage example then lists, as a feature of the output:

> "Added a clause about eagerness to learn Java and Spring Boot."

That is content about a skill the candidate does not have, written into the
resume automatically, with no decision asked. It is framed as eagerness rather
than as a claim, which is a real distinction — but the user is not asked, and
does not see it until afterwards.

This is precisely the gap "Nothing added behind your back" exists to occupy. It
is also evidence that the promise is worth making loudly, because the category
leader here is hedging on it in the FAQ while doing it on the landing page.

### The guarantee has a gate

"Interview Boost Guarantee — if you don't land more job interviews, we'll refund
your subscription." The rules page adds:

- refund capped at 2 months
- **you must have generated at least 50 resumes** to qualify
- you must write an explanation, and they may still decline

Fifty resumes at a month or two of subscription is a real barrier to claiming.
Worth reading before we ever consider a guarantee of our own; `docs/01-product.md`
already rules out outcome promises, and this is a good illustration of why they
are hard to honour cleanly.

## Their stack

| Layer | Evidence |
| --- | --- |
| **Remix / React Router v7** | `entry.client-*.js`, `manifest-*.js`, `/assets/` hashed bundles |
| **Radix Themes** | `radix-themes-*.js` |
| **Lucide icons** | `createLucideIcon-*.js` |
| **Zod** | shipped in the client bundle |
| **i18n** | `i18n-*.js`, `LanguagePicker`, `public-locale-layout` |
| **Cloudflare** | `server: cloudflare`, `cf-cache-status: HIT`, cached HTML |
| **Google Ads** | `gtag/js?id=AW-776548938` — they buy search traffic |
| **Affonso** | `affonso.io/js/pixel.min.js` — affiliate attribution |

Client-side rendered: `curl` returns a near-empty shell and the content arrives
via JS. Pricing and market selection are client bundles (`billingMarket-*.js`)
reading a server-set signal.

No API calls were observable from the public pages — the work happens behind the
login, so their tailoring endpoint is unmapped.

## What this changes for us

1. **India at ₹999/month is the price to argue against, not match.** Our whole
   pass model reads as a direct answer to it: paid once, does not renew. That
   contrast is sharper than any feature claim and should lead the pricing copy.
2. **"No sign-up to try" is a real wedge.** They gate the first result behind an
   account. Ours should be loud about not doing that.
3. **Our visual distinctiveness is weaker than assumed.** Their tailoring
   example is a resume with yellow highlight annotations and callout labels —
   close to "paper and highlighter". What is actually distinctive is that ours
   is *the user's own document*, not a generated one. The design should lean on
   that, not on the highlighter alone.
4. **They sell outcomes; we sell behaviour.** They can say "more interviews or
   money back" and we have ruled that out. That is a marketing disadvantage we
   are choosing deliberately, and the promise strip has to carry the weight
   instead. Worth testing whether it does.
5. **Cover letters are table stakes in this category.** Out of scope today;
   note it as a gap a buyer may ask about.

## To verify next

- The logged-in product: the tailoring flow, what the output actually looks
  like, whether the original design survives, and whether changes are marked.
- Whether "injects relevant keywords" means keyword stuffing in practice.
- Whether the free tier produces a full resume or a teaser.
- Their PDF handling — we found the harder problems there (subset fonts with no
  Unicode map); worth seeing whether they edit or rebuild.
- US pricing. A `$24.99` string appeared once in page source but was not
  reproducible from an Indian IP, so treat it as unconfirmed.

---

# Inside the product

Run 28 Sep 2026 on a real account, tailoring the owner's own resume against
`fixtures/kosha-payments-jd.txt`. One free credit consumed (2 → 1).

## Their architecture

| Layer | Evidence |
| --- | --- |
| **Supabase** | `/rest/v1/resume_content`, `/rest/v1/profile_photos`, `/rest/v1/user_free_credit_reviews` — PostgREST |
| **Remix server routes** wrapping it | `/api/supabase/user`, `/api/supabase/optimize-resume-from-description` |
| **Two-step generate** | `POST /validate-job-description` then `POST /optimize-resume-from-description` |
| **HTML → PDF via headless Chromium** | output PDF reports `producer: Skia/PDF m131`, `creator: Chromium` |

This independently validates the stack choice in the plan — the closest
competitor in this category runs the same Supabase-plus-Postgres shape.

**The resume is not a file to them.** It is parsed once into structured fields
(`resume_content.content` as JSON) and the dashboard is a form over those:
Personal information · Skills · Profile summary · Employment history ·
Education · Languages · Certificates. Tailoring rewrites that JSON and
re-renders it through their own template.

## What the output actually is

| | Input (the user's file) | Output |
| --- | --- | --- |
| Format | DOCX | **PDF only** — no DOCX |
| Pages | 2 | 1 |
| Fonts | Calibri, Times New Roman, Verdana | **Inter** (theirs) |
| Layout | The user's | Their template, skills re-flowed into 4 columns |

Nothing of the original design survives. That is not a bug in their
implementation — it is the design. They never claimed otherwise, and the
landing page sells "clear resume templates" as a feature.

It also means none of the hard problems in `docs/05-architecture.md` apply to
them: no in-place DOCX editing, no subset-font PDF work, no page-fit loop.
Rendering a fresh template is dramatically easier than preserving someone's
document, and that is the cost of our position.

## The honesty finding

This is the part worth acting on.

Their result screen has an **Applied changes** panel — a post-hoc explanation of
what was done, with a "Helpful? 👍👎" widget. It is not a decision point. Every
change is already in the document when you first see it. There is no per-line
consent anywhere in the flow.

Among the changes it reported making, verbatim:

> "Mentioned mentoring based on senior role and code review responsibility
> **implied by seniority**, phrased conservatively as mentoring teammates."

Checked against the source resume: **"mentor" appears 0 times. "code review" 0.
"teammate" 0. "guidance" 0.** The generated resume nonetheless states, in first
person:

> "I also **mentor junior teammates through code reviews**…"

and adds a new bullet:

> "**Provided technical guidance on backend and AI workflows to teammates**,
> contributing to higher code quality and more reliable services."

A claim inferred from a job title, written into employment history as fact,
applied without asking. Their FAQ says tailoring happens "without making
anything up" and that it "shouldn't invent achievements".

Two softer instances in the same run:

- **Java attached to three years of Python work.** Java appears exactly once in
  the source, in a skills list. The output summary reads "3 years of experience
  building microservices and REST APIs using Java, Spring Boot…", attaching it
  to project history that was Python, Node and Angular.
- **Kafka and Kubernetes appear under "Matched keywords"** having been added,
  not matched. Kubernetes enters as "eager to deepen my experience with
  Kubernetes" — the same move as the homepage example.

## What they do better than us

Worth being honest about, because it is not one-sided.

- **Application tracking is in the product already** — "Mark as applied", a job
  URL per tailoring, a documents list. Ours is still a screen on the canvas.
- **A Chrome extension shipping today**, promoted in-app as the answer to "tired
  of copy pasting?".
- **Cover letters** alongside resumes.
- **The keyword legend is good.** Colour-coded terms in the document with a
  matching sidebar list reads clearly, and is a better answer to "where did this
  land?" than a bare count.
- **Free credits with a referral loop** — "2 free resumes left · Get +30 free!"
- **Seven languages.** We chose English only; they treat multilingual as core.

## What this settles for us

1. **The wedge is real and it is narrow.** They rebuild in their template and
   infer claims from job titles. Our two hardest commitments — your own file,
   and nothing added without your OK — are exactly the two things the nearest
   competitor does not do. That is worth the engineering cost of the DOCX
   pipeline and the guardrails.
2. **Our guardrails are not theoretical.** `smuggled_skill` exists because our
   own planner tried to slip Kafka into a rewording. JobOwl shipped the same
   class of change to a paying user. The rules earn their place.
3. **"Applied changes" is not consent, and we should say why.** Their panel
   explains after the fact. Ours asks before. That difference is the product,
   and the Result screen should make it unmistakable.
4. **PDF-only output is a weakness we can name.** They hand back a PDF; the user
   can never edit it again in Word. ~~Ours returns the DOCX they uploaded.~~
   *(No longer true under the 28 Sep 2026 v1 override: v1 also hands back a
   PDF, rendered into the one default template. The difference that remains is
   consent and honesty, not format — and the weakness named here now applies
   to us too until in-place editing ships.)*
5. **Tracking, cover letters and the extension are table stakes sooner than
   planned.** All three are live in a product charging ₹999/month.
