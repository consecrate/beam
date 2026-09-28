// Text engine shared by the Convex backend and the browser: tokenizing,
// sentence splitting and pagination. Pure functions, no DOM or Node APIs.

export type TokenKind = "word" | "other";

export interface Token {
  kind: TokenKind;
  text: string;
  /** Normalized vocabulary key (only for words). */
  term?: string;
}

export interface Sentence {
  id: number;
  paragraph: number;
  text: string;
  tokens: Token[];
}

export interface Page {
  /** Consecutive sentence ids grouped into blocks; each block renders as a paragraph. */
  blocks: number[][];
  wordCount: number;
}

export interface ParsedText {
  sentences: Sentence[];
  pages: Page[];
  wordCount: number;
}

// Letters (incl. umlauts/ß/accents) optionally joined by apostrophes or hyphens:
// "geht's", "E-Mail", "Nord-Ostsee-Kanal".
const WORD_RE = /[\p{L}\p{M}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

export function normalizeTerm(raw: string, lang = "de"): string {
  return raw
    .replace(/’/g, "'")
    .replace(/^['\-]+|['\-]+$/g, "")
    .toLocaleLowerCase(lang)
    .trim();
}

/** Normalizes a phrase (multiple words) into a single space-joined key. */
export function normalizePhrase(raw: string, lang = "de"): string {
  return extractTerms(raw, lang).join(" ");
}

export function tokenize(text: string, lang = "de"): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index ?? 0;
    if (start > last) tokens.push({ kind: "other", text: text.slice(last, start) });
    tokens.push({ kind: "word", text: m[0], term: normalizeTerm(m[0], lang) });
    last = start + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: "other", text: text.slice(last) });
  return tokens;
}

export function extractTerms(text: string, lang = "de"): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(WORD_RE)) out.push(normalizeTerm(m[0], lang));
  return out;
}

export function countWords(text: string): number {
  let n = 0;
  for (const _ of text.matchAll(WORD_RE)) n++;
  return n;
}

/** Unique vocabulary keys in order of first appearance. */
export function uniqueTerms(text: string, lang = "de"): string[] {
  return [...new Set(extractTerms(text, lang))];
}

// Abbreviations after which a period does not end a sentence.
const ABBREVIATIONS = new Set([
  "z.b", "zb", "usw", "bzw", "ca", "dr", "prof", "nr", "str", "d.h", "u.a", "u.ä", "vgl",
  "evtl", "ggf", "inkl", "etc", "hr", "fr", "mr", "mrs", "ms", "st", "bspw", "sog", "jh",
  "mio", "mrd", "tel", "e.g", "i.e", "vs",
]);

/** Splits one paragraph into sentences with a rule-based splitter tuned for German. */
export function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  const re = /[.!?…]+["'”“»«)\]]*\s+/g;
  let start = 0;
  for (const m of paragraph.matchAll(re)) {
    const end = (m.index ?? 0) + m[0].length;
    const before = paragraph.slice(start, m.index ?? 0);
    const next = paragraph.slice(end, end + 1);
    const lastWord = (before.match(/(\S+)$/)?.[1] ?? "").toLowerCase().replace(/^[("„“»«]+/, "");
    const punct = m[0].trim();
    if (punct.startsWith(".")) {
      if (ABBREVIATIONS.has(lastWord.replace(/\.$/, ""))) continue;
      // Ordinals ("am 3. Mai") and single initials ("J. S. Bach").
      if (/^\d+$/.test(lastWord) || /^\p{Lu}$/u.test(lastWord)) continue;
    }
    // Only break when the next sentence plausibly starts here.
    if (next && !/[\p{Lu}\p{N}"'„“»«(\[–—-]/u.test(next)) continue;
    out.push(paragraph.slice(start, end).trim());
    start = end;
  }
  const rest = paragraph.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Parses a lesson into sentences and pages. Pages hold roughly `pageWords`
 * words and break on paragraph boundaries where possible; very long
 * paragraphs are split between sentences.
 */
export function parseText(text: string, lang = "de", pageWords = 170): ParsedText {
  const sentences: Sentence[] = [];
  splitParagraphs(text).forEach((para, p) => {
    for (const s of splitSentences(para)) {
      sentences.push({ id: sentences.length, paragraph: p, text: s, tokens: tokenize(s, lang) });
    }
  });

  const pages: Page[] = [];
  let blocks: number[][] = [];
  let block: number[] = [];
  let words = 0;
  let prevParagraph = -1;

  const flushBlock = () => {
    if (block.length) blocks.push(block);
    block = [];
  };
  const flushPage = () => {
    flushBlock();
    if (blocks.length) pages.push({ blocks, wordCount: words });
    blocks = [];
    words = 0;
  };

  for (const s of sentences) {
    const w = s.tokens.filter((t) => t.kind === "word").length;
    const newParagraph = s.paragraph !== prevParagraph;
    if (words > 0 && words + w > pageWords * 1.25 && (newParagraph || words >= pageWords)) {
      flushPage();
    } else if (newParagraph) {
      flushBlock();
    }
    block.push(s.id);
    words += w;
    prevParagraph = s.paragraph;
  }
  flushPage();

  return { sentences, pages, wordCount: sentences.reduce((n, s) => n + s.tokens.filter((t) => t.kind === "word").length, 0) };
}

/**
 * Splits long imported text into lesson-sized parts (by paragraph), so each
 * lesson stays small enough to look up its vocabulary in one query.
 */
export function splitIntoParts(text: string, maxWords = 1800): string[] {
  const parts: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const para of splitParagraphs(text)) {
    const w = countWords(para);
    if (words > 0 && words + w > maxWords) {
      parts.push(current.join("\n\n"));
      current = [];
      words = 0;
    }
    current.push(para);
    words += w;
  }
  if (current.length) parts.push(current.join("\n\n"));
  return parts;
}

/** Strips SRT/VTT cue numbers and timestamps, keeping subtitle text. */
export function subtitlesToText(raw: string): string {
  const kept = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "WEBVTT" && !/^\d+$/.test(l) && !/-->/.test(l) && !/^(NOTE|STYLE|REGION)\b/.test(l))
    .map((l) => l.replace(/<[^>]+>/g, "").replace(/^-\s*/, ""));
  // Cues split sentences arbitrarily; rejoin, then regroup into short paragraphs.
  const sentences = splitSentences(kept.join(" ").replace(/\s{2,}/g, " "));
  const paras: string[] = [];
  for (let i = 0; i < sentences.length; i += 4) paras.push(sentences.slice(i, i + 4).join(" "));
  return paras.join("\n\n");
}
