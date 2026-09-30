/**
 * Writes services/docsvc/tests/fixtures/resume-print.html: the real print
 * HTML (`renderResumeHtml`, fonts inlined) for a small fixture resume, so
 * docsvc's geometry test prints exactly what `/api/download` sends.
 *
 * Regenerate whenever RESUME_CSS (src/components/resume/resumeCss.ts),
 * ResumePage or resume-html.ts changes, and commit the result:
 *
 *   npm run fixture:print
 */
import fs from "node:fs";
import path from "node:path";
import type { TemplateDocument } from "@/lib/tailor/document";
import { renderResumeHtml } from "@/lib/tailor/resume-html";

const document: TemplateDocument = {
  name: "Priya Sharma",
  contact: ["priya@example.com", "+91 98765 43210", "Hyderabad"],
  sections: [
    {
      heading: "Summary", kind: "summary",
      lead: [{ text: "Backend engineer with four years on payments and search.", bullet: false }],
      entries: [], skills: [], items: [],
    },
    {
      heading: "Experience", kind: "experience", lead: [],
      entries: [
        {
          org: "Inncircles", place: "Hyderabad", dates: "Jun 2023 – Present", title: "Software Engineer",
          items: [
            { text: "Built the billing service that invoices every customer each month.", bullet: true },
            { text: "Shipped search across projects, documents and people.", bullet: true },
          ],
        },
        {
          org: "Razorfin", place: "Bengaluru", dates: "Aug 2021 – May 2023", title: "Backend Engineer",
          items: [{ text: "Wrote the refunds module and its nightly reconciliation job.", bullet: true }],
        },
      ],
      skills: [], items: [],
    },
    {
      heading: "Skills", kind: "skills", lead: [], entries: [],
      skills: [{ label: "Languages", items: "Python, Go, TypeScript" }], items: [],
    },
  ],
};

const out = path.join(process.cwd(), "services", "docsvc", "tests", "fixtures", "resume-print.html");
renderResumeHtml(document).then((html) => {
  fs.writeFileSync(out, html);
  console.log(`wrote ${path.relative(process.cwd(), out)} (${html.length} bytes)`);
});
