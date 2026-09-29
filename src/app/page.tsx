import { Wordmark } from "@/components/rezz/Wordmark";
import { Badge } from "@/components/rezz/Badge";
import { Button, ButtonLink } from "@/components/rezz/Button";
import {
  ResumeSheet,
  SheetRule,
  SheetHeading,
  SheetRole,
  NotYours,
} from "@/components/rezz/ResumeSheet";
import { MarginColumn, type Mark } from "@/components/rezz/MarginColumn";
/* PromiseStrip is deliberately not imported — see its file header. The four
   promises are still made on this page, each where its objection actually
   arises, and the footer still carries the line verbatim. */
import { PassCard } from "@/components/rezz/PassCard";
import { ThemeToggle } from "@/components/rezz/ThemeToggle";
import { FaqItem } from "@/components/rezz/FaqItem";
import {
  box,
  display,
  h2,
  h3,
  lead,
  offset,
  offsetAccent,
  offsetGap,
  offsetPageOverride,
} from "@/components/rezz/skin";

/* Written at 1440px. Two floors, not one: the margin column drops at 1215 and
   the hero stacks at 1100. Mobile is out of scope until the owner says
   otherwise (CLAUDE.md) — these keep the desktop page from breaking, they are
   not a phone design. */
const wrap = "mx-auto max-w-[1312px] px-16 max-[1100px]:px-8 max-[680px]:px-4";

/* The skin — 2px ink outlines, hard offset shadows, the type scale — now lives
   in `@/components/rezz/skin`, where its rules are written down. It was local
   to this file until 29 Sep 2026, when the owner asked for one voice across
   every screen and the app screens took it too. Nothing about the discipline
   changed: two offset steps, and `highlighter` still means only "this changed". */

/* The example is fixed across every screen: Priya Sharma applying to Kosha
   Payments. Same person, same nine requirements, everywhere. */
/* Notes are kept to ~22 characters: the hero's margin column is 196px, of which
   the connector rule and its gap take 32. Longer notes wrap and stack the marks
   further apart than the lines they point at. */
const MARKS: Mark[] = [
  { anchor: "l-sum", label: "Reworded", note: "from your summary" },
  { anchor: "l-p95", label: "Reworded", note: "your facts #2 and #4" },
  { anchor: "l-split", label: "Reworded", note: "your fact #6" },
  { anchor: "l-kafka", label: "Needs your OK", note: "not in your resume", ask: true },
  { anchor: "l-skills", label: "Reworded", note: "reordered for this job" },
];

/* The heading promises "two steps the first time, one step after that" and this
   used to render three numbered cards — so a reader counted three, read two, and
   stalled. Downloading is not a step you perform to get the result, it IS the
   result, so it loses the numeral and takes an arrow instead. Two numbered
   things you do, one outcome: the count now matches the sentence above it. */
const STEPS = [
  {
    n: "1",
    title: "Upload your resume",
    when: "First time only",
    body: "PDF, DOCX, LaTeX or your LinkedIn PDF. We read your facts and never invent ones you didn't give us.",
  },
  {
    n: "2",
    title: "Add the job",
    when: "Every job after that",
    body: "Paste the description, upload a screenshot, or click the Rezz extension on a career page.",
  },
  {
    n: "→",
    outcome: true,
    title: "Download",
    when: "About fifteen seconds later",
    body: "Your facts, tailored, in one clean template. Rewordings are already applied. Anything else waits for your OK.",
  },
];

export default function LandingPage() {
  return (
    /* The marketing ground is flat white, not `paper`. The grey ground exists to
       sink the resume canvas in the app; here the separation is carried by ink
       rules, and a grey behind a white sheet edged in 2px ink just muddies it. */
    <div className="bg-paper-raised">
      <header className="border-b-2 border-ink bg-paper-raised">
        {/* `min-h-20`, not `h-20`. With a fixed height the bar could not grow
            when the nav wrapped, so between ~681 and ~719px the nav became
            three rows (120px) inside an 80px bar and — being `items-center` —
            spilled 20px out of both the top and the bottom border. A minimum
            holds the 80px bar at full width and lets it grow when it must. */}
        <div className={`${wrap} flex min-h-20 flex-wrap items-center justify-between gap-3 py-3`}>
          {/* Boxed, the way the reference boxes its mark: on a page drawn
              entirely in 2px ink, an unboxed wordmark reads as unfinished. */}
          <span className={`inline-flex items-center ${box} rounded-md bg-paper-raised px-3 py-1.5 ${offset}`}>
            <Wordmark />
          </span>
          {/* py-3 on the links is a tap target, not spacing: at their natural
              26px they were well under the 44px the brand book requires. */}
          <nav aria-label="Main" className="flex flex-wrap items-center gap-8 text-[15px] font-semibold leading-5 max-[680px]:gap-4">
            <a href="#how" className="py-3 no-underline hover:underline hover:underline-offset-4">How it works</a>
            <a href="#pricing" className="py-3 no-underline hover:underline hover:underline-offset-4">Pricing</a>
            <a href="#faq" className="py-3 no-underline hover:underline hover:underline-offset-4">Questions</a>
            <ButtonLink href="#extension" variant="secondary">Get the Chrome extension</ButtonLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main>
        <section className={`${wrap} pt-20 max-[1100px]:pt-12`}>
          {/* Headline and document side by side.

              Both columns flex, and the margin column drops at 1215px rather
              than 1100. The old geometry was all fixed px and needed 1302px of
              viewport, but only fell back at 1100 — so between those two widths
              the marks ran off the right edge, sliced mid-word. That band
              contains 1280px, which is a 13" MacBook. Letting the headline
              column shrink to 340 buys the side-by-side hero down to ~1212. */}
          <div className="grid grid-cols-[minmax(340px,430px)_minmax(0,1fr)] items-center gap-x-12 max-[1100px]:grid-cols-1 max-[1100px]:gap-y-12">
            <div>
              {/* Set heavier and tighter than the app's headings, with the chip
                  rotated off the baseline — the one place on the page where
                  something is deliberately out of square, because it is the one
                  word the whole product is about. */}
              <h1 className={display}>
                Your resume,{" "}
                <span
                  className={`mx-[-2px] inline-block -rotate-[2.5deg] rounded-md ${box} bg-highlighter px-3 py-0.5
                              text-on-highlighter ${offset}`}
                >
                  reworded
                </span>{" "}
                for the job you&rsquo;re applying to.
              </h1>
              <p className={`mt-6 ${lead}`}>
                Upload your own file once. Paste any job. About fifteen seconds later you get your
                own facts back, reworded for that job, with every change marked.
              </p>
              <div className="mt-8 flex flex-col items-start gap-5">
                <ButtonLink href="/upload" size="lg">
                  Upload your resume
                </ButtonLink>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="drawn">No sign-up to try</Badge>
                  <Badge tone="drawn">1 free resume a week</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,480px)_196px] items-start gap-x-5 max-[1215px]:grid-cols-1 max-[1100px]:justify-items-start">
              {/* The sheet trades its soft lift for a drawn edge so it belongs to
                  this page. `!` is load-bearing: ResumeSheet sets `shadow-sheet`
                  in its own class string and two shadow utilities are resolved
                  by Tailwind's generated order, not by ours. The Result screen's
                  sheet is untouched — it keeps the real lift off the grey well. */}
              <ResumeSheet
                name="Priya Sharma"
                contact="Backend Engineer · Bengaluru · Notice period 30 days · priya.sharma@example.com"
                pad="tight"
                className={`${box} ${offsetPageOverride}`}
              >
                <SheetRule />
                <p id="l-sum" className="m-0">
                  <mark>
                    Backend engineer with 3 years building payment and ledger services in Java and
                    Spring Boot on AWS.
                  </mark>
                </p>
                <SheetRule />
                {/* `as="div"`: here the sheet is an illustration, so its headings
                    must stay out of the page outline. See SheetHeading. */}
                <SheetHeading as="div">Experience</SheetHeading>
                <SheetRole role="Razorfin — Software Engineer, Backend" dates="Aug 2024 – present" />
                <ul className="mt-1.5 list-disc pl-4">
                  <li id="l-p95" className="my-[5px]">
                    <mark style={{ animationDelay: "150ms" }}>
                      Cut payment API p95 latency from 820&nbsp;ms to 310&nbsp;ms using async Spring
                      Boot workers on AWS ECS.
                    </mark>
                  </li>
                  <li className="my-[5px]">
                    Built a nightly reconciliation job that matches 2.1 lakh transactions against bank
                    files.
                  </li>
                  <li id="l-split" className="my-[5px]">
                    <mark style={{ animationDelay: "300ms" }}>
                      Split the refunds module into 4 microservices, each deployed on its own.
                    </mark>
                  </li>
                  <li id="l-kafka" className="my-[5px]">
                    <NotYours>Consumed payment events from Kafka topics to update the ledger.</NotYours>
                  </li>
                </ul>
                <SheetRule />
                <SheetHeading as="div">Skills</SheetHeading>
                <p id="l-skills" className="m-0">
                  <mark style={{ animationDelay: "450ms" }}>
                    Java, Spring Boot, AWS (ECS, SQS, RDS), microservices
                  </mark>
                  , PostgreSQL, Redis, Docker, Git
                </p>
              </ResumeSheet>

              <div className="max-[1215px]:hidden">
                <MarginColumn marks={MARKS} label="What changed" />
              </div>
            </div>
          </div>
        </section>

        {/* Moved directly under the hero (28 Sep 2026). This is the only thing
            on the page no competitor has — the real before/after, the source
            tags, and the decision the user actually makes — and it was sitting
            two screens down behind a promise strip that asserted the same thing
            in four words. Show the mechanism first; the promises it implies stop
            needing to be claimed.

            Separated by the 2px rule alone. It used to also carry a `paper`
            fill, but #f7f8fa against #ffffff is a 3% difference — on a page
            built from hard contrast that reads as a rendering accident rather
            than a decision, and the rule already does the job. */}
        <section className="mt-24 border-y-2 border-ink py-24 max-[1100px]:mt-16 max-[1100px]:py-16">
          <div className={`${wrap} grid grid-cols-[minmax(0,1fr)_560px] items-start gap-16 max-[1100px]:grid-cols-1 max-[1100px]:gap-8`}>
            <div>
              <h2 className={`${h2} max-w-[18ch]`}>Nothing added behind your back.</h2>
              <p className={`mt-6 max-w-[58ch] ${lead}`}>
                Rezz rewords what you already did so it matches how this job describes it. Every
                change shows the line you wrote, the line we propose, and which requirement it
                answers.
              </p>
              <p className={`mt-4 max-w-[58ch] ${lead}`}>
                When the job asks for something that isn&rsquo;t in your resume, we draft the line
                and mark it. It goes in only if you choose Add it &mdash; and we give you interview
                prep for it.
              </p>
              <p className={`mt-4 max-w-[58ch] ${lead}`}>
                Your result comes back in one clean template &mdash; no gallery, no colour picker.
                We picked one, so you don&rsquo;t have to.
              </p>
            </div>

            {/* Each change is its own drawn object rather than a ruled row, so
                the third one — the one that asks — is visibly a thing you act
                on, not a paragraph you scroll past. */}
            <div className="flex flex-col gap-5">
              <div className={`${box} ${offset} rounded-md bg-paper-raised p-6`}>
                <div className="font-doc text-sm leading-[22px] text-ink-muted line-through">
                  Worked on backend APIs for payments.
                </div>
                <div className="mt-[5px] font-doc text-[15px] leading-[23px]">
                  <mark>
                    Cut payment API p95 latency from 820&nbsp;ms to 310&nbsp;ms using async Spring
                    Boot workers on AWS ECS.
                  </mark>
                </div>
                <div className="mt-3 flex items-center gap-2 font-mark text-xs leading-4 text-verified before:h-[2px] before:w-[18px] before:bg-verified before:content-['']">
                  your Razorfin project, facts #2 and #4
                </div>
              </div>

              <div className={`${box} ${offset} rounded-md bg-paper-raised p-6`}>
                <div className="font-doc text-sm leading-[22px] text-ink-muted line-through">
                  Mentored 2 junior engineers.
                </div>
                <div className="mt-[5px] font-doc text-[15px] leading-[23px]">
                  <mark style={{ animationDelay: "200ms" }}>
                    Mentored 2 junior engineers through their first on-call rotations.
                  </mark>
                </div>
                <div className="mt-3 flex items-center gap-2 font-mark text-xs leading-4 text-verified before:h-[2px] before:w-[18px] before:bg-verified before:content-['']">
                  your Razorfin project, fact #9
                </div>
              </div>

              {/* The one that needs the user is drawn in the corrector's red, not
                  in ink, and is the only box on the page that carries a colour
                  other than the highlighter. */}
              <div className={`rounded-md border-2 border-gap bg-paper-raised p-6 ${offsetGap}`}>
                <div className="text-lg font-bold leading-[29px]">
                  Kafka is in the job, but not in your resume.
                </div>
                <div className="mt-[5px] font-doc text-[15px] leading-[23px] text-ink-muted">
                  &ldquo;Consumed payment events from Kafka topics to update the ledger.&rdquo;
                </div>
                <div className="mt-3 flex items-center gap-2 font-mark text-xs leading-4 text-gap before:h-[2px] before:w-[18px] before:bg-gap before:content-['']">
                  not in your resume — recruiters may ask about it
                </div>
                {/* Exactly two options, equal weight, nothing pre-selected. Both
                    are `secondary` for that reason: the moment one of them takes
                    the primary fill, the page has picked for the user. */}
                <div className="mt-5 flex gap-4 max-[680px]:flex-col">
                  <Button variant="secondary" className="flex-1">Skip</Button>
                  <Button variant="secondary" className="flex-1">Add it</Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className={`${wrap} pt-28 max-[1100px]:pt-16`}>
          <h2 className={`${h2} max-w-[20ch]`}>Two steps the first time. One step after that.</h2>
          {/* Numbered because it genuinely is a sequence. The numerals are set as
              type in a drawn square — not a pastel icon circle, which is the
              tell this page is trying hardest to avoid. The outcome card takes
              the same square unfilled, so "things you do" and "what you get"
              are told apart before either is read. */}
          <ol className="mt-12 grid list-none grid-cols-3 gap-6 p-0 max-[1100px]:grid-cols-1">
            {STEPS.map((s) => (
              <li key={s.n} className={`${box} ${offset} rounded-md bg-paper-raised p-7`}>
                <div
                  aria-hidden
                  className={`flex h-12 w-12 items-center justify-center rounded-md ${box}
                              text-xl font-bold leading-none tabular-nums
                              ${s.outcome ? "bg-paper-raised text-ink" : "bg-ink text-paper"}`}
                >
                  {s.n}
                </div>
                <h3 className={`mt-5 mb-2 ${h3}`}>{s.title}</h3>
                <p className="m-0 font-mark text-xs font-medium leading-4 text-ink-muted">{s.when}</p>
                <p className="m-0 mt-3 text-base leading-[26px] text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          {/* Sits here rather than up in the changes section: this is the point
              where a reader has understood the product and has furthest to
              scroll before the next chance to act. */}
          <ButtonLink href="/upload" size="lg" className="mt-12">
            Upload your resume
          </ButtonLink>
        </section>

        <section id="pricing" className={`${wrap} pt-28 max-[1100px]:pt-16`}>
          <h2 className={`${h2} max-w-[20ch]`}>Paid once. Does not renew.</h2>
          <p className={`mt-6 max-w-[58ch] ${lead}`}>
            Pay by UPI. No card on file, no autopay mandate. When a pass ends, it just ends.
          </p>
          <div className="mt-12 grid grid-cols-3 items-stretch gap-8 max-[1100px]:grid-cols-1">
            <PassCard
              name="Free"
              price="₹0"
              per="One tailored resume a week"
              features={["One tailored resume a week", "Honest check included", "One clean template"]}
              cta="Start free"
            />
            <PassCard
              name="Sprint"
              price="₹149"
              per="15 resumes, 30 days"
              features={["15 tailored resumes", "Honest check on each one", "Interview prep and tracker"]}
              cta="Buy Sprint with UPI"
              featured
            />
            <PassCard
              name="Job-hunt"
              price="₹399"
              per="Unlimited, 90 days"
              features={[
                "Unlimited tailored resumes (fair use)",
                "Honest check on each one",
                "Interview prep and tracker",
              ]}
              cta="Buy Job-hunt with UPI"
            />
          </div>
        </section>

        <section id="faq" className={`${wrap} pt-28 max-[1100px]:pt-16`}>
          <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-16 max-[1100px]:grid-cols-1 max-[1100px]:gap-8">
            <h2 className={h2}>Questions</h2>
            <div>
              <FaqItem question="Will it add skills I don't have?" defaultOpen>
                Only if you say so. When a job asks for a skill that isn&rsquo;t in your resume, we
                draft the line, mark it &ldquo;Not in your resume&rdquo; and ask. It goes in only if
                you choose Add it, and we give you interview prep for it afterwards.
              </FaqItem>
              <FaqItem question="Do you give an ATS score?">
                No. Applicant tracking systems don&rsquo;t publish a score, so any number would be
                invented. We show whether your file parses cleanly and which of the job&rsquo;s
                requirements it covers.
              </FaqItem>
              <FaqItem question="Will my resume look different?">
                Yes, for now. Your result comes back in one clean Rezz template &mdash; no gallery,
                no colour picker, just one layout we picked so nothing breaks. Keeping your own
                file&rsquo;s design in place is what we&rsquo;re building toward next.
              </FaqItem>
              <FaqItem question="Does the pass renew?">
                No. You pay once by UPI. When the 30 or 90 days are over, it stops. There is nothing
                to cancel.
              </FaqItem>
              <FaqItem question="Do I need to sign up?">
                Not to try. You sign in with your phone number and a one-time code only when you
                download.
              </FaqItem>
              {/* TODO(owner): storage region and deletion time are still unconfirmed, so this
                  answer deliberately does not state them. Add them here once they are settled —
                  do not put the reminder back in the copy: it shipped as a visible
                  "[Draft: …]" note inside the one answer about handling people's personal data. */}
              <FaqItem question="What happens to my resume data?">
                Your resume is used only to tailor your resumes. It is stored encrypted, never sold,
                and never used to train AI models. You can delete everything from Settings at any
                time.
              </FaqItem>
            </div>
          </div>
        </section>

        {/* The page used to end on the FAQ, so a reader who scrolled the whole
            thing arrived at the footer with nothing to do. */}
        <section className={`${wrap} pt-28 max-[1100px]:pt-16`}>
          <div className={`${box} rounded-md bg-paper-raised px-12 py-14 ${offsetAccent} max-[680px]:px-6`}>
            <h2 className={`${h2} max-w-[18ch]`}>Try it on the job you&rsquo;re looking at now.</h2>
            <p className={`mt-5 max-w-[52ch] ${lead}`}>
              One resume a week is free, and you don&rsquo;t need an account to see what changes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <ButtonLink href="/upload" size="lg">
                Upload your resume
              </ButtonLink>
              <Badge tone="drawn">No sign-up to try</Badge>
            </div>
          </div>
        </section>
      </main>

      {/* Closes on the same inversion the promise strip opens with, so the page
          is bracketed by the two places Rezz speaks in its own voice.
          --focus is ink, which would draw an invisible ring on an ink ground.
          Flip it for this block the same way .sheet flips its tokens. */}
      <footer className="mt-28 border-t-2 border-ink bg-ink py-14 text-paper [--focus:var(--paper)] max-[1100px]:mt-16">
        <div className={`${wrap} flex items-start justify-between gap-16 max-[680px]:flex-col max-[680px]:gap-6`}>
          <div>
            <span className="inline-flex items-center rounded-md border-2 border-paper bg-paper px-3 py-1.5">
              <Wordmark />
            </span>
            <p className="mt-4 max-w-[46ch] text-sm leading-[22px] text-paper/70">
              Your resume, tailored to each job. Nothing added behind your back. No fake ATS score.
              No auto-renew.
            </p>
          </div>
          <nav aria-label="Footer" className="flex gap-6 text-sm font-medium leading-[22px]">
            <a href="#pricing" className="py-3 text-paper">Pricing</a>
            <a href="#privacy" className="py-3 text-paper">Privacy</a>
            <a href="#terms" className="py-3 text-paper">Terms</a>
            <a href="#contact" className="py-3 text-paper">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
