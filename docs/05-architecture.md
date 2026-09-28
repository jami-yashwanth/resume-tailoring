# Architecture

## Pipeline

```
Upload ─► Parse (DOCX / PDF / LaTeX)
          ├─► Layout model (sections, blocks, lines, measurements)
          └─► Facts (role, project, achievement, skill + claim level + evidence)

Job description ─► Requirements (skill, years, degree, location; must / nice; exact wording)

Skill graph (aliases, parent/child, "similar to")
          ▼
Matcher ─► each requirement: exact · synonym · similar · missing · knockout
          ▼
Planner (LLM) ─► edit operations: rephrase · reorder · swap · add · remove · rename term
          │         each with a claim level and an estimated line cost
          ▼
Verifier (cheaper LLM + hard rules) ─► every claim backed, or flagged "Not in your resume"
          ▼
Fitter ─► choose changes within the page budget ─► render ─► measure ─► repeat ≤ 3
          ▼
Result (~15 s) ─► user decisions (Add it / Skip) ─► re-plan only what changed (~3 s)
          ▼
Export (clean file, same design) + claim log + interview prep
```

## Claim levels

| Level | Source | Allowed wording |
| --- | --- | --- |
| Verified | Already in the resume | Anything accurate |
| Reworded | True reframing of existing content | Same facts, the job's vocabulary |
| Added by you | Not in the resume; user tapped Add it | Modest verbs, no invented numbers, nothing above seniority |

Hard rules in code: numbers must match a fact exactly; job titles and dates are never rewritten; knockouts are never faked; never introduce formatting (e.g. bold) that the user's line didn't have.

## Keyword matching (four groups)

1. Have it, different wording ("Spring" → "Spring Boot", "AWS" → "Amazon Web Services"): fixed automatically. Parent/child terms are not automatic.
2. Transferable (Node.js backend vs a Spring Boot job): reword to hit the shared keywords (REST, microservices, PostgreSQL).
3. Not in the resume (Kafka): draft a line, flag it, Add it / Skip.
4. Knockout (location, years, degree): show, never change.

## Page fitting: "swap first, grow last"

- Page budget = current lines + empty space on the last page. Page count never grows unless the user allows it.
- Each change has a value (match weight × claim strength) and a cost (lines). Pick the best set within budget (greedy works).
- Ways to pay for space, least to most visible: fit into existing skills line → tighten a long bullet → replace the least relevant bullet in the same role → remove a low-relevance bullet → shorten the summary → ask ("allow 2 pages?").
- Never shrink font size; paragraph spacing may flex ±1pt in DOCX/LaTeX only; no stranded headings; avoid 1–2-word last lines.
- Loop: plan → render → measure → apply next saving → re-render, max 3 rounds, then ask.

## Editing the user's own file

| Format | Strategy | Status |
| --- | --- | --- |
| DOCX (incl. Google Docs export) | Edit text runs in place; clone a neighbouring paragraph to add a bullet; delete to remove | Proven in the prototype |
| LaTeX | Edit source, recompile (Tectonic), check pages | Not prototyped |
| Text PDF from Word/Docs/LaTeX | Swap a line in the same box; adding/removing needs reflow → look-alike rebuild | Swap proven in the prototype |
| Canva / scanned PDF | Look-alike rebuild only, with a clear warning | Not prototyped |

Prototype findings (`prototypes/in-place-editing/`):
- DOCX: styles, bullet numbering, tab stops and original bold spans survive; added bullets match their neighbours.
- PDF: real exported PDFs embed **subset fonts without a Unicode map**, so the file's own font can't be reused for new text. Production needs a **server font library** (same family, e.g. Georgia; plus Google Fonts and metric-compatible stand-ins like Carlito for Calibri), then a metric-similar fallback.
- DOCX page fit is only estimated without a renderer. Production needs **LibreOffice headless** (plus metric-compatible fonts) to count pages; note LibreOffice and Word lay out slightly differently, so keep a safety margin.

Other problems to handle: mixed formatting inside a line, two-column layouts (fit each column), headers/footers with contact info, hidden white text (warn), ATS-hostile templates (offer an ATS-safe second download).

## AI model and cost

- Use the Claude API (the Claude Max subscription is for personal use and can't serve other users).
- Rough cost per tailored resume (estimate, measure on real resumes): planner on Claude Sonnet 5 ($2 / $10 per MTok) + checks on Claude Haiku 4.5 ($1 / $5) ≈ $0.07 (≈ ₹6); Haiku only ≈ $0.04 (≈ ₹3.5). Cache the fixed system prompt (cache reads ~10% of input price).
- $100/month of API usage ≈ 1,400–2,500 tailored resumes.
- Guardrails: phone-OTP + free cap to stop bots; a monthly spend limit in the Anthropic Console.
- Compare models on ~50 real resumes before choosing; judge cost per completed resume, not per request.

## Storage and privacy

- Postgres for facts, claim levels, evidence, claim log.
- Never train on user resumes; one-tap "delete everything"; consent per India's DPDP Act.
- Chrome extension collects only the page the user clicked on (Chrome Web Store 2026 policy, enforced from 1 Aug 2026).
