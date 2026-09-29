import Link from "next/link";
import { Wordmark } from "@/components/rezz/Wordmark";

export const metadata = {
  title: "Terms — Rezz",
};

/* Same rule as the privacy page: state what the product does, in plain
   English, and keep it current with the code. */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper-raised">
      <header className="border-b-2 border-ink">
        <div className="mx-auto flex min-h-20 max-w-[720px] items-center px-8">
          <Link href="/" className="no-underline">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-8 py-16">
        <h1 className="m-0 text-[34px] font-bold leading-[1.15] tracking-[-0.02em]">Terms</h1>
        <div className="mt-8 flex flex-col gap-5 text-base leading-[26px] text-ink">
          <p className="m-0">
            <strong>What Rezz does.</strong> Rezz rewords the facts already in your resume so they
            match the job you paste. It does not make up numbers or outcomes, does not change your
            job titles or dates, and adds a line only when you choose Add it.
          </p>
          <p className="m-0">
            <strong>Your responsibility.</strong> The resume you download is yours. Review it before
            you send it: you decide every flagged line, and you are the one asserting what it says.
          </p>
          <p className="m-0">
            <strong>Payment.</strong> Passes, when they open, are one-time UPI payments. Nothing
            renews and there is no mandate to cancel.
          </p>
          <p className="m-0">
            <strong>No guarantees of outcomes.</strong> We promise behaviour &mdash; marked changes,
            nothing added behind your back &mdash; not interviews or offers.
          </p>
        </div>
        <p className="mt-10 text-sm leading-[22px] text-ink-muted">
          <Link href="/">Back to Rezz</Link>
        </p>
      </main>
    </div>
  );
}
