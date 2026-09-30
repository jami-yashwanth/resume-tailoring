import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderResumeHtml } from "@/lib/tailor/resume-html";
import type { TemplateDocument } from "@/lib/tailor/document";
import { RESUME_CSS } from "./resumeCss";
import { ResumePage } from "./ResumePage";

const doc: TemplateDocument = {
  name: "Priya Sharma",
  contact: ["priya@example.com", "Hyderabad"],
  sections: [
    {
      heading: "Summary", kind: "summary",
      lead: [{ text: "Backend engineer.", bullet: false }],
      entries: [], skills: [], items: [],
    },
    {
      heading: "Experience", kind: "experience", lead: [],
      entries: [{
        org: "Inncircles", place: "Hyderabad", dates: "2023 - 2026", title: "Engineer",
        items: [
          { text: "Built the billing service", bullet: true },
          { text: "Shipped search", bullet: true },
          { text: "Tech: Go, Postgres", bullet: false },
        ],
      }],
      skills: [], items: [],
    },
    {
      heading: "Skills", kind: "skills", lead: [], entries: [],
      skills: [{ label: "Languages", items: "Python, Go" }], items: [],
    },
  ],
};

const html = (d = doc, marks?: boolean) => renderToStaticMarkup(<ResumePage document={d} marks={marks} />);

describe("ResumePage", () => {
  it("renders sections, entries and items in document order", () => {
    const out = html();
    const at = ["Summary", "Inncircles", "Built the billing", "Tech: Go", "Languages"].map((s) => out.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("sets the entry header as org, place, dates and italic title", () => {
    const out = html();
    const i = [out.indexOf('class="rz-org"'), out.indexOf('class="rz-dates"'), out.indexOf('class="rz-title"')];
    expect(i.every((x) => x >= 0)).toBe(true);
    expect([...i].sort((a, b) => a - b)).toEqual(i);
    expect(out).toContain('<span class="rz-place">, Hyderabad</span>');
  });

  it("renders user text literally", () => {
    const d = structuredClone(doc);
    d.sections[0].lead = [{ text: "<script>alert(1)</script> & 100% \\LaTeX", bullet: true }];
    const out = html(d);
    expect(out).toContain("&lt;script&gt;");
    expect(out).not.toContain("<script>");
    expect(out).toContain("100% \\LaTeX");
  });

  it("marks every block with its key, block, op and state", () => {
    const d = structuredClone(doc);
    d.sections[1].entries[0].items[0] = {
      text: "Built the billing service", bullet: true,
      key: "line-op1", state: "reworded", opId: "op1", blockId: "7",
    };
    const out = html(d);
    expect(out).toContain('data-key="line-op1" data-block="7" data-op="op1" data-state="reworded"');
    expect(html(d, false)).not.toMatch(/data-(key|block|op|state)=/);
  });

  it("breaks pages only between blocks", () => {
    const out = html();
    const tags = out.match(/<(?:div|li)[^>]*class="[^"]*\brz-block\b/g) ?? [];
    expect(tags.length).toBeGreaterThan(8);
    expect(RESUME_CSS.replace(/\s+/g, "")).toContain(".rz-block{break-inside:avoid");
  });

  it("omits empty sections and entries", () => {
    const d: TemplateDocument = {
      name: null, contact: [],
      sections: [{ heading: "Projects", kind: "projects", lead: [], skills: [], items: [],
        entries: [{ org: null, title: null, dates: null, place: null, items: [] }] }],
    };
    expect(html(d)).not.toContain("Projects");
  });
});

describe("renderResumeHtml", () => {
  it("embeds fonts and css", () => {
    const out = renderResumeHtml(doc);
    expect(out.startsWith("<!doctype html>")).toBe(true);
    expect(out.split("data:font/woff2;base64,").length - 1).toBe(2);
    expect(out).toContain(RESUME_CSS);
    expect(out).toContain("Priya Sharma");
  });
});
