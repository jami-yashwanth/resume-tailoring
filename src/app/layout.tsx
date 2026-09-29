import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";

/* Sans is Rezz talking. The document's own serif is not loaded here on purpose:
   it represents the user's file, so it comes from their resume, not from us. */
/* No `weight` on purpose: both faces are variable (wght 100–900), so omitting it
   ships one variable file per family instead of a static cut per weight. */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

/* The default template's own face. The template is the owner's LaTeX
   reference, which sets Roboto (`[sfdefault]{roboto}`), so the Result screen
   previews in the same face the compiled download embeds — same metrics, same
   wraps. Only the cuts the compiled file uses: regular, italic, bold. */
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rezz — your resume, reworded for the job",
  description:
    "Upload your Word or PDF resume once. Paste any job. Get your own facts back, reworded for that job in one clean template, with every change marked — nothing added behind your back.",
};

/* Applied before the first paint, which is the only reason it is an inline
   script rather than an effect: read the theme in React and someone who chose
   dark gets a white flash on every navigation while the bundle loads.

   It always writes the attribute, even for light, so ThemeToggle can read the
   current theme off the element rather than keeping a second copy of the truth.
   `suppressHydrationWarning` is required because this mutates <html> before
   React hydrates it — without it React reports the attribute it did not render. */
const applyTheme = `try{document.documentElement.dataset.theme=localStorage.getItem("rezz.theme")==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

/* Arms the scroll-reveal, and disarms it if the page never comes alive.
   Reveal (components/rezz/Reveal.tsx) hides its content until an
   IntersectionObserver fires, so the hiding rules in globals.css are gated on
   the `data-reveal` flag this sets. Two things then have to be true for a
   visitor to see a blank section, instead of one:

   1. Script has to run at all. With JS off this never executes, the flag is
      never set, and the page renders fully visible with no animation. That is
      what the old <noscript> style did, and this replaces it.
   2. The bundle has to actually hydrate. The old fallback missed this case
      entirely — a landing-page chunk that 404s leaves JS enabled and working,
      the flag set, the observer never running, and the whole page invisible.
      Caught exactly that way. So the flag is withdrawn unless a Reveal mounts
      and reports in within 2s, which only happens once React is live.

   2s is generous on purpose: it is far past hydration on any real connection,
   and a late reveal is a worse failure than a missing animation. */
const armReveal = `document.documentElement.dataset.reveal="on";setTimeout(function(){if(document.documentElement.dataset.revealReady!=="1"){delete document.documentElement.dataset.reveal}},2000)`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${roboto.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyTheme }} />
        <script dangerouslySetInnerHTML={{ __html: armReveal }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
