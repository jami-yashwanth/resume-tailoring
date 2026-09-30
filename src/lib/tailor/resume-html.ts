import { createElement } from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
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

const FONT_CSS =
  fontFace("SourceSerif4Variable-Roman.otf.woff2", "normal") +
  fontFace("SourceSerif4Variable-Italic.otf.woff2", "italic");

export function renderResumeHtml(document: TemplateDocument): string {
  const body = renderToStaticMarkup(createElement(ResumePage, { document, marks: false }));
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}</style>` +
    `<style>${RESUME_CSS}</style></head><body>${body}</body></html>`
  );
}
