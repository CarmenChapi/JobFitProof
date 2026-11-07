import type { SourceQuote } from "./analysis.schema.js";

export const maxQuoteLength = 320;

/** Locate a quote in the submitted text and return the original UTF-16 span. */
export function locateQuote(text: string, proposed: string | undefined): SourceQuote | null {
  const quote = proposed?.trim();
  if (!quote || quote.length > maxQuoteLength) return null;

  // Only whitespace may differ. Never accept a paraphrase, translated quote,
  // changed number, different capitalisation or a model-generated ellipsis.
  const pattern = quote.split(/\s+/).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const match = new RegExp(pattern, "u").exec(text);
  if (!match || match[0].length > maxQuoteLength) return null;
  return { text: match[0], start: match.index, end: match.index + match[0].length };
}

/** Select actual text for the limited keyword fallback, keeping nearby context. */
export function findKeywordQuote(text: string, matches: (fragment: string) => boolean): string | undefined {
  for (const clause of text.split(/[\n;]/)) {
    const trimmed = clause.trim();
    if (trimmed.length <= maxQuoteLength) {
      if (matches(trimmed)) return trimmed;
      continue;
    }
    // Overlapping windows retain matches near a window boundary without
    // returning an entire long paragraph or modifying the source text.
    for (let start = 0; start < trimmed.length; start += maxQuoteLength / 2) {
      const fragment = trimmed.slice(start, start + maxQuoteLength).trim();
      if (matches(fragment)) return fragment;
    }
  }
  return undefined;
}
