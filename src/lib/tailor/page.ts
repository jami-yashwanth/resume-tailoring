/**
 * The one place the page's numbers live. A4 in points (the unit the template
 * CSS uses, so print and screen agree); the editor measures in px.
 */
export const A4 = { width: 595.28, height: 841.89, margin: 40 } as const;

export const CONTENT_HEIGHT_PT = A4.height - 2 * A4.margin;

/** Content height in px when the content box is `contentWidthPx` wide (same aspect as the page). */
export const contentHeightFor = (contentWidthPx: number): number =>
  (contentWidthPx * CONTENT_HEIGHT_PT) / (A4.width - 2 * A4.margin);
