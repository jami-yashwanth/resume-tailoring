# Product

## What Rezz is

An India-first AI resume tailor. The user uploads their **own** resume once (Word, PDF, LaTeX or LinkedIn PDF). For every job they add, Rezz gives back **their own file, in their own design**, reworded for that job.

"Rezz" is the product name. "Sach" was an earlier working name and is no longer used. The product is **English only**.

## The promise

**Nothing added behind your back · No fake ATS score · No auto-renew · Your own design**

- Rewordings of the user's own facts are applied automatically and can be undone.
- A line with a skill that isn't in the user's resume (e.g. Kafka) is drafted and shown as **"Not in your resume"**. It goes in only if the user taps **Add it**. Exactly two options: **Add it / Skip**, equal visual weight, nothing pre-selected.
- No 0–100 "ATS score". Show checkable facts instead: "Covers 7 of 9 job requirements (your original covered 3)", parse check, keywords found.
- Passes are paid once by UPI and never renew.
- The user's design is kept. Rezz never moves their resume into its own template without asking.

Earlier wording was "Never invents". It changed on 28 Sep 2026 when the Add it flow was decided; don't use "Never invents" or "We added nothing you didn't do" anywhere.

## Why this can win

- ~13 of 15 mainstream tools (Teal, Rezi, Kickresume, Enhancv, Huntr, Careerflow, Jobright, Simplify, Indeed, Naukri, Zety, Resume.io…) re-import the resume into their own templates. Only Jobscan claims to keep layout (untested). **Tailoring the user's own file in place is an open gap.**
- No tool asks before inserting a skill the user lacks. Scoring-first tools insert keywords in one click; honesty advice sits in blogs.
- Users distrust the category: invented skills, fake ATS scores, generic AI voice, billing traps. Rezz answers each one directly.

## Who it's for (in order)

1. Working professionals with 1–6 years' experience switching jobs (IT, analytics, product, ops). Loudest pain, some already pay Naukri, apply on laptops.
2. Final-year students and freshers (about 1.1 crore graduates a year).
3. Later: government/PSU biodata formats, colleges and staffing firms (B2B).

## Workflow goal: as little human effort as possible

- First time: upload the resume. That's it.
- Every job: add the job (paste, link, screenshot, or the Chrome extension) → about 15 seconds → review (optional) → download.
- With no flagged lines, it's **1 tap** to download. With N flagged lines, **1 + N taps**.

## Pricing (to test)

| Pass | Price | What you get |
| --- | --- | --- |
| Free | ₹0 | 1 tailored resume a week, honest check, your own design |
| Sprint | ₹149 | 15 tailored resumes, 30 days |
| Job-hunt | ₹399 | Unlimited tailored resumes (fair use), 90 days |

- Paid once by UPI on the web (avoids app-store markup; LinkedIn charges ~82% more in its Android app than on web).
- Nothing auto-renews. The receipt says "does not renew".
- Launch free with caps; phone-OTP sign-in at download stops abuse.
- Cost per tailored resume on the Claude API is roughly ₹3–6 (see 05-architecture.md). At ₹6, the ₹149 / 15 pack is thin after 18% GST: either measure and bring cost down with a cheaper model where quality holds, or reduce the pack.

## Decision log

| Date | Decision |
| --- | --- |
| 25 Sep 2026 | Build a narrow, India-first resume tailor, not a generic PDF suite. |
| 25 Sep 2026 | Consumer first; recruiter/staffing B2B later. Research showed basic CV formatting for agencies is crowded (15+ tools, ~$0.40–1 per CV). |
| 25 Sep 2026 | Edit the user's own file in place (their design kept). |
| 25 Sep 2026 | Low-effort workflow: changes applied automatically, review optional. |
| 25 Sep 2026 | The $100 Claude Max plan can't power the product; use the Claude API. |
| 25 Sep 2026 | Name: Rezz. English only. |
| 25 Sep 2026 | Visual direction "paper and highlighter"; design system built. |
| 28 Sep 2026 | Rezz may draft lines with skills the user lacks, shown as "Not in your resume", inserted only on **Add it**. Two options only: Add it / Skip. |
| 28 Sep 2026 | Promise wording: "Nothing added behind your back". |
| 28 Sep 2026 | Result screen = resume in the centre with change marks, job checklist on the left, one-at-a-time decision bar at the bottom. "Compare with original" toggle approved. |
| 28 Sep 2026 | Web first; no mobile work until decided. |
| 28 Sep 2026 | ₹399 pass = unlimited (fair use) for 90 days. |
| 28 Sep 2026 | Web type pairing chosen on the canvas: Bricolage Grotesque (headlines) + Geist (UI) + Geist Mono. The design-system tokens still list Literata / Hind / IBM Plex Mono and need updating to match. |

## Guardrails that stay regardless

- Never invent numbers or outcomes ("Cut latency by 40% using Kafka" is never drafted for an unbacked skill).
- Modest verbs for unbacked lines ("worked with", "consumed"), nothing above the user's seniority.
- Never fake knockouts: years of experience, degree, location, work authorisation.
- Every line added via Add it gets interview prep after download, and keeps its "Not in your resume" tag if suggested again for another job.
- Keep a claim log: what was added, when, and that the user accepted it. Terms of service say the user is responsible for what they accept.
- Never auto-apply to jobs; never automate LinkedIn, Naukri or Indeed pages.
