import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Tailoring",
  description:
    "Tailor a resume to a job description without inventing experience.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
