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
    "Upload your own Word, PDF or LaTeX resume once. Paste any job. Get that same file back, in your own design, reworded for that job, with every change marked.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
