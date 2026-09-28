# Claude Design prompt (updated for the current decisions)

Design the web UI for "Rezz", an India-first AI resume tailoring product. English only. Web app first; no mobile screens for now.

## Design system (use this, don't invent a new style)
Use my Rezz design system: https://claude.ai/artifact/UkzvkLtWcFWGrd8eczPW4q
Follow its tokens, components and README rules exactly. Most important:
- Look: "paper and highlighter". Calm, document-like, trustworthy. Not a flashy AI startup.
- The highlighter colour (#e4f264) means only "this text changed". Never decoration.
- Teal ("verified") marks sourced lines. Coral ("gap") marks lines not in the user's resume, always with a word.
- The resume preview is always paper-white, in light and dark themes.
- Headlines Bricolage Grotesque, UI Geist, evidence/source tags Geist Mono.
- No purple gradients, no sparkle or magic-wand icons, no emoji, no fake scores or countdowns.

## What the product does
Rezz takes a person's OWN resume (Word, PDF or LaTeX) and tailors it to each job description, keeping their original design. Rewordings of their own facts are applied automatically. If the job asks for a skill that isn't in their resume, Rezz drafts the line, marks it "Not in your resume", and adds it only if the user taps Add it (the only other option is Skip, equal weight).

## Promise
Nothing added behind your back · No fake ATS score · No auto-renew · Your own design

## Workflow
Upload once → add a job (paste, link, screenshot or Chrome extension) → ~15 s → review (optional) → download. 1 tap to download with nothing flagged; 1 + N taps with N flagged lines. Phone OTP only at download. One-time UPI passes: Free ₹0 (1/week), Sprint ₹149 (15 resumes, 30 days), Job-hunt ₹399 (unlimited, fair use, 90 days).

## Example content (fictional)
Priya Sharma, Backend Engineer, 3 years, Bengaluru, notice 30 days. Job: Backend Engineer at Kosha Payments, Pune (on-site), 3–5 years: Java, Spring Boot, AWS, microservices, REST APIs, mentoring, Kafka (must have), Kubernetes (nice to have).
Changed line: "Worked on backend APIs for payments." → "Cut payment API p95 latency from 820 ms to 310 ms using async Spring Boot workers on AWS ECS." (from: Razorfin › facts #2, #4)
Line not in resume: "Consumed payment events from Kafka topics to update the ledger."

## Tone
Plain, specific English. Say what happened, with numbers. Verb-first buttons. No hype. Prices in ₹ with Indian grouping.
