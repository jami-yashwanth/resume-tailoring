/**
 * Template C. Every number is a variable on .rz-page and every length is in
 * pt, so the browser preview and the printed PDF lay out the same page. The
 * same string goes into <ResumePage> and into the print HTML.
 */
export const RESUME_CSS = `
@page { size: A4; margin: 40pt }
.rz-page {
  --rz-page-width: 595.28pt;
  --rz-margin: 40pt;
  --rz-body: 10pt;
  --rz-leading: 13.5pt;
  --rz-name: 20pt;
  --rz-name-tracking: 0.04em;
  --rz-contact: 8.6pt;
  --rz-heading: 10.5pt;
  --rz-heading-tracking: 0.06em;
  --rz-heading-rule: 0.6pt;
  --rz-heading-space: 9pt;
  --rz-indent: 9pt;
  --rz-ink: #111111;
  box-sizing: border-box;
  width: var(--rz-page-width);
  padding: var(--rz-margin);
  background: #fff;
  color: var(--rz-ink);
  font-family: "Source Serif 4", "Iowan Old Style", Georgia, serif;
  font-size: var(--rz-body);
  line-height: var(--rz-leading);
}
.rz-page * { box-sizing: border-box }
.rz-block { break-inside: avoid; page-break-inside: avoid }
.rz-name { font-size: var(--rz-name); font-weight: 700; text-transform: uppercase; letter-spacing: var(--rz-name-tracking); text-align: center; line-height: 1.2 }
.rz-contact { font-size: var(--rz-contact); text-align: center }
.rz-heading { margin-top: var(--rz-heading-space); font-size: var(--rz-heading); font-weight: 700; text-transform: uppercase; letter-spacing: var(--rz-heading-tracking); border-bottom: var(--rz-heading-rule) solid var(--rz-ink) }
.rz-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt }
.rz-org { font-weight: 700 }
.rz-place { font-weight: 400 }
.rz-dates { white-space: nowrap; text-align: right }
.rz-title { font-style: italic }
.rz-list { margin: 0; padding: 0; list-style: none }
.rz-item { margin: 0 }
.rz-bullet { position: relative; padding-left: var(--rz-indent) }
.rz-bullet::before { content: "\\2022"; position: absolute; left: 0 }
.rz-skill b { font-weight: 700 }
`;
