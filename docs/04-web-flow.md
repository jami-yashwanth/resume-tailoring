# Web flow

All screens live on the Claude Design canvas (see 06-links.md); local copies are in `design/screens/`. Example data throughout is fictional: Priya Sharma, Backend Engineer (3 yrs, Bengaluru, notice 30 days) applying to Backend Engineer at Kosha Payments, Pune (on-site).

The 9 job requirements used consistently on every screen: Java, Spring Boot, AWS, Microservices, REST APIs, Mentoring (matched) · Kafka (must have), Kubernetes (nice to have) (need your OK) · Based in Pune, on-site (can't change).

| # | Screen | File | What it does |
| --- | --- | --- | --- |
| 02 | Landing | `LandingDesktop.dc.html` | Hero with a tailored-resume example, promise strip, how it works (3 steps), "Nothing added behind your back" section, pricing (₹0 / ₹149 / ₹399), FAQ, footer |
| 03 | Upload | `WebUpload.dc.html` | One drop zone (PDF, DOCX, .tex, LinkedIn PDF), "Start from scratch (fresher)", no sign-up to try |
| 04 | Add a job | `WebAddJob.dc.html` | Paste the JD, or screenshot / link / Chrome extension; requirement chips once read; "Tailor my resume" |
| 04b | Tailoring | `WebGenerating.dc.html` | Staged progress, ~15 s |
| 01 | Result · review | `Desktop.dc.html` | The core screen (see 03-ux-result-screen.md). Interactive |
| 05 | Result · ready | `WebChanges.dc.html` | Same screen after decisions (Kafka added, Kubernetes skipped) |
| 06 | Finish | `WebGaps.dc.html` | Resume ready, checkable facts, interview prep for added lines, next job |
| 07 | Honest check | `WebHonestCheck.dc.html` | File parse check, recruiter keywords (8 of 9 in this version), tips, "What the ATS sees" plain text |
| 08 | Sign in | `WebSignIn.dc.html` | Google or email magic link, over the Add-a-job screen, on the second tailoring only (1 Oct 2026; the canvas still shows the older phone-OTP-at-download version) |
| 08b | Choose a pass | `WebPass.dc.html` | Shelved 1 Oct 2026 until the ledger settles pricing. Pass options + UPI (ID or QR), "Paid once. Does not renew." |
| 08c | Weekly cap | — | "You've used your 10 free this week · next one opens Thursday 8 Oct", one button back to the result |
| 09 | Tracker | `WebTracker.dc.html` | All tailored resumes by company/role/date, changes, applied status, pass balance |
| 11 | Chrome extension | `Extension.dc.html` | Side panel opened by clicking the extension icon on a company career page; reads the JD, shows requirements, "Tailor resume for this job", "Save to tracker"; adds nothing to the page |

Flow: Landing → Upload → Add a job → (Sign in, second run only) → Tailoring → Review → Download → Finish → Add another job / Tracker. Downloads are never gated (1 Oct 2026).

Chrome extension scope: v1 read-only (activeTab + scripting + sidePanel + contextMenus, no host permissions). v1.5 optional autofill on employer ATS portals only (Greenhouse, Lever, then Workday, Darwinbox, Keka), always fill-then-user-submits. Never on LinkedIn, Naukri, Indeed, foundit, Instahyre.
