# Research summary (25–28 Sep 2026)

Condensed from several web research passes. Items marked (unverified) came from third-party sites or memory and should be checked before quoting publicly. Reddit was blocked for most passes; Reddit quotes came via an archive API.

## Consumer AI resume tools

- At least 10 established players charge $24–50/month for near-identical features (tailoring, ATS score, cover letters, extension). Teal: 2M+ members, $19M raised. Rezi: says 4.5M users. Jobright: says 2M users, $7.7M raised.
- Platforms are bundling it in: Indeed Career Scout (free), LinkedIn Premium resume tailoring and Apply Assistant (rolling out since Jun 2026). OpenAI announced a jobs platform for mid-2026 (launch not confirmed).
- Signs of strain: Jobright raised prices; Simplify made payments non-refundable; Sonara shut down and was bought by BOLD.
- Hiring side: Greenhouse's CEO describes an "AI doom loop" (Fortune, 27 Jul 2026). Robert Half (Mar 2026): 67% of hiring managers say AI-generated applications slowed hiring.

## What users complain about

- **Invented skills** (the most emotional complaint): "it just starts making stuff up… suddenly I'm an 'advanced user of Tableau'" (r/jobsearchhacks). People write prompts like "DO NOT INVENT EXPERIENCE."
- **Fake ATS scores:** r/developersIndia is full of "ATS score 80+, 500–600 applications, not a single call." The "75% of resumes auto-rejected by ATS" statistic traces back to an unsourced 2012 sales pitch.
- **Generic AI voice:** "they all sound exactly the same" (hiring manager, r/recruitinghell, 721 upvotes).
- **Billing traps:** 1-star reviews of Jobscan, Teal, Rezi about charges after cancelling.
- **Losing their design / rework:** "no way to download the Word file, I couldn't fix them" (Teal); "I use Claude or ChatGPT to build a resume and then put it in Kickresume's layout."
- Most people just use ChatGPT/Claude for free; paid tools get called "just ChatGPT with a name."

## What current tools do with an uploaded resume

| Behaviour | Tools |
| --- | --- |
| Re-import into their own template (design lost) | Teal, Rezi, Kickresume, Enhancv, Huntr, Careerflow, Jobright, Simplify, Indeed Career Scout, Naukri AI Resume Maker, ResumeGyani, Zety, Resume.io |
| Suggestions to copy-paste | Resume Worded, LinkedIn (partly) |
| Claims to keep layout | Jobscan only (edits in a plain-text view; untested) |
| Edit the file directly but don't tailor to a job | Copilot in Word, Gemini in Docs, Overleaf AI |

No product was found that edits a user's own PDF in place with tailoring.

## How tools handle missing skills

- One-click insert: Jobscan, Teal, Resume Worded.
- Suggest with a warning: Rezi ("add or skip" per keyword), Enhancv, Huntr.
- Reword only, "no fake skills" as a feature: Kickresume, Careerflow.
- No tool asks at insertion time whether the user actually has the skill.

## Do keywords get interviews?

- Most ATS don't auto-reject on keyword score (small recruiter survey: 92% said no auto-reject; directional). Knockout questions (location, work authorisation, years) are the real automatic filters.
- Recruiters **search** by skills (~76% search/rank by JD skills). Exact wording matters because searches are literal ("Spring" vs "Spring Boot", "AWS" vs "Amazon Web Services").
- No independent study links match score to callbacks.
- Naukri recruiters also filter by notice period, CTC, location and recency (unverified; Naukri docs blocked).

## India market

- Naukri launched an AI Resume Maker in Nov 2025 (3 free tries; Pro ~₹700–890/month, unverified). FastForward/visibility plans ₹600–1,900; human resume writing ₹1,150–4,200.
- A crowded ₹49–299 long tail (ResumeGyani, CV Prime, ResAI…) almost all sell ATS scores. Zety/Resume.io use auto-renewing trials.
- 86% of UPI merchant payments are under ₹500. LinkedIn Premium ~₹1,016/month on web vs ~₹1,850 via Google Play.
- Indian resume conventions: notice period, current/expected CTC, a biodata block for government/PSU roles, marks tables for freshers, college-mandated templates, Jake's Resume-style templates among techies.
- Device split: ~64% of Indian web traffic is mobile (StatCounter, Aug 2026); no figure for job applications specifically.

## Recruiter/staffing market (for later)

- Basic branded CV formatting is crowded (Allsorter, HireAra — bought by Access Group, Candidately, CVFormatter, FormaCV…) and built into Bullhorn, Recruit CRM, Zoho Recruit. Prices ~$0.40–1 per CV.
- Possible gap: tailoring to the client JD, and Indian IT-staffing firms submitting to US/EU clients (client formats, masking). Demand unverified.

## Key sources

- Fortune, Greenhouse "AI doom loop": https://fortune.com/2026/07/27/greenhouse-ceo-daniel-chait-ai-doom-loop-job-seekers-spam-interview-applications-unemployment/
- Robert Half survey: https://press.roberthalf.com/2026-03-10-Robert-Half-survey-67-of-HR-leaders-report-AI-generated-applications-are-slowing-hiring
- Naukri AI Resume Maker: https://www.tribuneindia.com/news/business/naukri-launches-ai-powered-resume-maker-to-help-job-seekers-build-professional-recruiter-ready-cvs-effortlessly/
- Jobscan One-Click Optimize: https://www.jobscan.co/one-click-optimize
- Rezi keyword targeting: https://www.rezi.ai/rezi-docs/ai-keyword-targeting-explained
- Kickresume tailoring: https://www.kickresume.com/en/resume-tailoring/
- ATS auto-reject myth: https://itbrief.co.uk/story/study-reveals-ats-rarely-auto-rejects-cvs-debunks-75-myth
- LinkedIn User Agreement 8.2: https://www.linkedin.com/legal/user-agreement
- StatCounter India: https://gs.statcounter.com/platform-market-share/desktop-mobile-tablet/india
- SBI UPI research: https://sbi.bank.in/documents/13958/14472/New+Insights+from+UPI+Data_SBI+Research.pdf
