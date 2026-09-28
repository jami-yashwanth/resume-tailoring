import { Wordmark } from "@/components/rezz/Wordmark";
import { Button, ButtonLink } from "@/components/rezz/Button";
import {
  ResumeSheet,
  SheetRule,
  SheetHeading,
  SheetRole,
  NotYours,
} from "@/components/rezz/ResumeSheet";
import { MarginColumn, type Mark } from "@/components/rezz/MarginColumn";
import { PromiseStrip } from "@/components/rezz/PromiseStrip";
import { PassCard } from "@/components/rezz/PassCard";
import { FaqItem } from "@/components/rezz/FaqItem";

/* Written at 1440px. Below 1100 the margin column drops rather than squashing —
   a floor so nothing breaks, not a phone design. Mobile is out of scope until
   the owner says otherwise (CLAUDE.md). */
const wrap = "mx-auto max-w-[1312px] px-16 max-[1100px]:px-8 max-[680px]:px-4";

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

export default function LandingPage() {
  return (
    <>
      <header className="border-b border-line">
        <div className={`${wrap} flex h-[72px] items-center justify-between max-[680px]:h-auto max-[680px]:flex-wrap max-[680px]:gap-3 max-[680px]:py-3`}>
          <Wordmark />
          <nav aria-label="Main" className="flex flex-wrap items-center gap-8 text-[15px] font-medium max-[680px]:gap-4">
            <a href="#how" className="no-underline hover:underline hover:underline-offset-4">How it works</a>
            <a href="#pricing" className="no-underline hover:underline hover:underline-offset-4">Pricing</a>
            <a href="#faq" className="no-underline hover:underline hover:underline-offset-4">Questions</a>
            <ButtonLink href="#extension" variant="secondary">Get the Chrome extension</ButtonLink>
          </nav>
        </div>
      </header>

      <main>
        <section className={`${wrap} pt-16`}>
          {/* Headline and document side by side. 1184px of content divides as
              420 | 48 | (500 + 20 + 196). The sheet carries no card or grey well
              around it: it is the artefact, not a screenshot of one. */}
          <div className="grid grid-cols-[420px_minmax(0,1fr)] items-center gap-x-12 max-[1100px]:grid-cols-1 max-[1100px]:gap-y-12">
            <div>
              <h1 className="m-0 text-[clamp(32px,3.4vw,48px)] font-semibold leading-[1.06] tracking-[-0.03em]">
                Your resume, reworded for the job you&rsquo;re applying to.
              </h1>
              <p className="mt-5 text-[17px] leading-[27px] text-ink-muted">
                Upload your own Word, PDF or LaTeX file once. Paste any job. About fifteen seconds
                later you get that same file back &mdash; your fonts, your layout, your design
                &mdash; reworded for that job, with every change marked.
              </p>
              <div className="mt-7 flex flex-col items-start gap-4">
                <ButtonLink href="/upload" size="lg">Upload your resume</ButtonLink>
                <small className="text-sm leading-[21px] text-ink-muted">
                  No sign-up to try.
                  <br />
                  One tailored resume a week is free.
                </small>
              </div>
            </div>

            <div className="grid grid-cols-[500px_196px] items-start gap-x-5 max-[1100px]:grid-cols-1">
            <ResumeSheet
              name="Priya Sharma"
              contact="Backend Engineer · Bengaluru · Notice period 30 days · priya.sharma@example.com"
              pad="tight"
            >
              <SheetRule />
              <p id="l-sum" className="m-0">
                <mark>
                  Backend engineer with 3 years building payment and ledger services in Java and
                  Spring Boot on AWS.
                </mark>
              </p>
              <SheetRule />
              <SheetHeading>Experience</SheetHeading>
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
              <SheetHeading>Skills</SheetHeading>
              <p id="l-skills" className="m-0">
                <mark style={{ animationDelay: "450ms" }}>
                  Java, Spring Boot, AWS (ECS, SQS, RDS), microservices
                </mark>
                , PostgreSQL, Redis, Docker, Git
              </p>
            </ResumeSheet>

              <div className="max-[1100px]:hidden">
                <MarginColumn marks={MARKS} label="What changed" />
              </div>
            </div>
          </div>
        </section>

        <div className={wrap}>
          <PromiseStrip />
        </div>

        <section id="how" className={`${wrap} pt-28 max-[1100px]:pt-16`}>
          <h2 className="m-0 max-w-[20ch] text-[42px] font-semibold leading-[46px] tracking-[-0.03em]">
            Two steps the first time. One step after that.
          </h2>
          {/* Numbered because it genuinely is a sequence. The numerals are set as
              type, not dropped into chips. */}
          <ol className="mt-12 grid list-none grid-cols-3 gap-12 p-0 max-[1100px]:grid-cols-1">
            {[
              {
                n: "1",
                title: "Upload your resume",
                when: "First time only",
                body: "PDF, DOCX, LaTeX or your LinkedIn PDF. We read your facts and keep your layout exactly as it is.",
              },
              {
                n: "2",
                title: "Add the job",
                when: "For every job",
                body: "Paste the description, upload a screenshot, or click the Rezz extension on a career page.",
              },
              {
                n: "3",
                title: "Download",
                when: "About fifteen seconds later",
                body: "Your file, your design, tailored. Rewordings of your own facts are already applied. Anything else waits for your OK.",
              },
            ].map((s) => (
              <li key={s.n} className="border-t border-ink pt-4">
                <div className="text-[34px] font-semibold leading-10 tracking-[-0.03em] tabular-nums">{s.n}</div>
                <h3 className="my-2 text-xl font-semibold leading-[27px]">{s.title}</h3>
                <p className="m-0 text-sm text-ink-muted">{s.when}</p>
                <p className="m-0 mt-2 text-[15px] leading-6 text-ink-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-28 border-y border-line bg-paper-raised py-24 max-[1100px]:mt-16 max-[1100px]:py-16">
          <div className={`${wrap} grid grid-cols-[minmax(0,1fr)_560px] items-start gap-16 max-[1100px]:grid-cols-1 max-[1100px]:gap-8`}>
            <div>
              <h2 className="m-0 max-w-[18ch] text-[42px] font-semibold leading-[46px] tracking-[-0.03em]">
                Nothing added behind your back.
              </h2>
              <p className="mt-4 max-w-[58ch] text-lg leading-[29px] text-ink-muted">
                Rezz rewords what you already did so it matches how this job describes it. Every
                change shows the line you wrote, the line we propose, and which requirement it
                answers.
              </p>
              <p className="mt-4 max-w-[58ch] text-lg leading-[29px] text-ink-muted">
                When the job asks for something that isn&rsquo;t in your resume, we draft the line
                and mark it. It goes in only if you choose Add it &mdash; and we give you interview
                prep for it.
              </p>
            </div>

            <div className="flex flex-col">
              <div className="border-line py-6 pt-0">
                <div className="font-doc text-sm leading-[21px] text-ink-muted line-through">
                  Worked on backend APIs for payments.
                </div>
                <div className="mt-[5px] font-doc text-[15px] leading-[23px]">
                  <mark>
                    Cut payment API p95 latency from 820&nbsp;ms to 310&nbsp;ms using async Spring
                    Boot workers on AWS ECS.
                  </mark>
                </div>
                <div className="mt-3 flex items-center gap-2 font-mark text-[11.5px] leading-4 text-verified before:h-px before:w-[18px] before:bg-verified before:content-['']">
                  your Razorfin project, facts #2 and #4
                </div>
              </div>

              <div className="border-t border-line py-6">
                <div className="font-doc text-sm leading-[21px] text-ink-muted line-through">
                  Mentored 2 junior engineers.
                </div>
                <div className="mt-[5px] font-doc text-[15px] leading-[23px]">
                  <mark style={{ animationDelay: "200ms" }}>
                    Mentored 2 junior engineers through their first on-call rotations.
                  </mark>
                </div>
                <div className="mt-3 flex items-center gap-2 font-mark text-[11.5px] leading-4 text-verified before:h-px before:w-[18px] before:bg-verified before:content-['']">
                  your Razorfin project, fact #9
                </div>
              </div>

              <div className="border-t border-line py-6">
                <div className="text-[17px] font-semibold leading-[26px]">
                  Kafka is in the job, but not in your resume.
                </div>
                <div className="mt-[5px] font-doc text-[15px] leading-[23px] text-ink-muted">
                  &ldquo;Consumed payment events from Kafka topics to update the ledger.&rdquo;
                </div>
                <div className="mt-3 flex items-center gap-2 font-mark text-[11.5px] leading-4 text-gap before:h-px before:w-[18px] before:bg-gap before:content-['']">
                  not in your resume — recruiters may ask about it
                </div>
                {/* Exactly two options, equal weight, nothing pre-selected. */}
                <div className="mt-4 flex gap-3 max-[680px]:flex-col">
                  <Button variant="secondary" className="flex-1">Skip</Button>
                  <Button variant="secondary" className="flex-1">Add it</Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className={`${wrap} pt-28 max-[1100px]:pt-16`}>
          <h2 className="m-0 max-w-[20ch] text-[42px] font-semibold leading-[46px] tracking-[-0.03em]">
            Paid once. Does not renew.
          </h2>
          <p className="mt-4 max-w-[58ch] text-lg leading-[29px] text-ink-muted">
            Pay by UPI. No card on file, no autopay mandate. When a pass ends, it just ends.
          </p>
          <div className="mt-12 grid grid-cols-3 items-stretch gap-6 max-[1100px]:grid-cols-1">
            <PassCard
              name="Free"
              price="₹0"
              per="One tailored resume a week"
              features={["One tailored resume a week", "Honest check included", "Your own design"]}
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
            <h2 className="m-0 text-[42px] font-semibold leading-[46px] tracking-[-0.03em]">Questions</h2>
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
                No. We edit your own file and keep its fonts and layout. You download it as PDF or
                DOCX.
              </FaqItem>
              <FaqItem question="Does the pass renew?">
                No. You pay once by UPI. When the 30 or 90 days are over, it stops. There is nothing
                to cancel.
              </FaqItem>
              <FaqItem question="Do I need to sign up?">
                Not to try. You sign in with your phone number and a one-time code only when you
                download.
              </FaqItem>
              <FaqItem question="What happens to my resume data?">
                Your resume is used only to tailor your resumes. It is stored encrypted, never sold,
                and never used to train AI models. You can delete everything from Settings at any
                time. [Draft: confirm storage region and deletion time.]
              </FaqItem>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-28 border-t border-line bg-paper-raised py-12 max-[1100px]:mt-16">
        <div className={`${wrap} flex items-start justify-between gap-16 max-[680px]:flex-col max-[680px]:gap-6`}>
          <div>
            <Wordmark />
            <p className="mt-3 max-w-[46ch] text-sm leading-[22px] text-ink-muted">
              Your resume, tailored to each job. Nothing added behind your back. No fake ATS score.
              No auto-renew.
            </p>
          </div>
          <nav aria-label="Footer" className="flex gap-6 text-sm">
            <a href="#pricing">Pricing</a>
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
