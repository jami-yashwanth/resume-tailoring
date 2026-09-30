import { createElement } from "react";
import fs from "node:fs";
import path from "node:path";
import { ResumePage } from "@/components/resume/ResumePage";
import { RESUME_CSS } from "@/components/resume/resumeCss";
import type { TemplateDocument } from "./document";

/**
 * The printable page: ResumePage plus its CSS and the template font inlined,
 * so headless Chromium needs no network and no installed fonts. Server only.
 * The font files are read once, at module load.
 */
const FONT_DIR = path.join(process.cwd(), "public", "fonts", "source-serif-4");

const fontFace = (file: string, style: "normal" | "italic") => {
  const data = fs.readFileSync(path.join(FONT_DIR, file)).toString("base64");
  return (
    `@font-face{font-family:"Source Serif 4";font-weight:200 900;font-style:${style};` +
    `src:url(data:font/woff2;base64,${data}) format("woff2")}`
  );
};

/* The print document is only the page: no browser default body margin (8px)
   may push the text in from the 40pt @page margin, or the printed wraps and
   page breaks stop matching the preview's. */
const PRINT_CSS = "html,body{margin:0;padding:0}";

const FONT_CSS =
  fontFace("SourceSerif4Variable-Roman.otf.woff2", "normal") +
  fontFace("SourceSerif4Variable-Italic.otf.woff2", "italic");

/* `react-dom/server` is imported when called, not at the top: Next refuses a
   static import of it anywhere in a route handler's graph ("You're importing a
   component that imports react-dom/server"), which took both print routes down. */
export async function renderResumeHtml(document: TemplateDocument): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(createElement(ResumePage, { document, marks: false }));
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}</style>` +
    `<style>${PRINT_CSS}</style><style>${RESUME_CSS}</style></head><body>${body}</body></html>`
  );
}
