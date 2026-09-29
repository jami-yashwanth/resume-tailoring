import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyTheme }} />
        {/* Reveal (components/rezz/Reveal.tsx) hides its content until an
            IntersectionObserver fires. Without JS that never happens, so this
            is the fallback that keeps the landing page's content from staying
            invisible forever. */}
        <noscript>
          <style>{".reveal{opacity:1!important;transform:none!important}"}</style>
        </noscript>
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
