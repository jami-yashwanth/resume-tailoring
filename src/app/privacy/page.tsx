import Link from "next/link";
import { Wordmark } from "@/components/rezz/Wordmark";

export const metadata = {
  title: "Privacy — Rezz",
};

/* Short and true beats long and boilerplate. Every sentence here states what
   the running product actually does; when the product changes (accounts,
   passes), this page changes in the same commit. Storage region and deletion
   window stay unstated until the owner confirms them (docs/07-open-items.md). */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper-raised dark:bg-paper">
      <header className="border-b-2 border-edge">
        <div className="mx-auto flex min-h-20 max-w-[720px] items-center px-8">
          <Link href="/" className="no-underline">
            <Wordmark />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-8 py-[clamp(24px,6dvh,64px)]">
        <h1 className="m-0 text-[34px] font-bold leading-[1.15] tracking-[-0.02em]">Privacy</h1>
        <div className="mt-8 flex flex-col gap-5 text-base leading-[26px] text-ink">
          <p className="m-0">
            <strong>Your resume file stays in your browser.</strong> When you upload it, we read its
            text to tailor it and hand the result straight back. We do not keep a copy of your file
            on our servers, and closing the tab clears it from your browser session.
          </p>
          <p className="m-0">
            <strong>What leaves your browser.</strong> To tailor your resume, its text and the job
            description you paste are sent to our server and processed with Anthropic&rsquo;s Claude
            API. They are used only to produce your result and are not used to train AI models.
          </p>
          <p className="m-0">
            <strong>No account, no tracking profile.</strong> You can use Rezz today without signing
            up, and we do not sell or share your information with anyone.
          </p>
          <p className="m-0">
            <strong>When this changes.</strong> Sign-in and paid passes are planned. When they ship,
            this page will say exactly what is stored (a phone number and a download count) before
            any of it is collected.
          </p>
        </div>
        <p className="mt-10 text-sm leading-[22px] text-ink-muted">
          <Link href="/">Back to Rezz</Link>
        </p>
      </main>
    </div>
  );
}
