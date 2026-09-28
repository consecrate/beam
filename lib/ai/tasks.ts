import "server-only";
import { generateJson } from "./provider";
import { languageName, LEVEL_DESCRIPTIONS, type Level } from "../langs";

import type { Gloss, GeneratedLesson, SentenceExplanation, SentenceTranslation, WordLookup } from "./types";

const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

function tutor(lang: string, native: string) {
  return `You are an expert ${languageName(lang)} teacher helping a ${languageName(native)}-speaking learner read authentic ${languageName(lang)} text. Be accurate and concise. Always write explanations and translations in ${languageName(native)}. Respond only with JSON matching the schema.`;
}

// ---------- word in context ----------

const WORD_SCHEMA = obj({
  translation: str,
  alternatives: { type: "array", items: str },
  lemma: str,
  pos: {
    type: "string",
    enum: ["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "article", "determiner", "particle", "numeral", "interjection", "proper noun", "phrase", "other"],
  },
  gender: { type: "string", enum: ["m", "f", "n", "pl", ""] },
  article: str,
  plural: str,
  form: str,
  note: str,
  expression: str,
  expressionTranslation: str,
});

export function lookupWord(p: { lang: string; native: string; term: string; sentence: string }) {
  const isPhrase = p.term.trim().includes(" ");
  return generateJson<WordLookup>({
    system: tutor(p.lang, p.native),
    maxTokens: 600,
    schema: WORD_SCHEMA,
    prompt: `Sentence: «${p.sentence}»
${isPhrase ? "Phrase" : "Word"} to explain: «${p.term}»

Fill the fields:
- translation: the best ${languageName(p.native)} translation of «${p.term}» exactly as used in THIS sentence (1–5 words; for a phrase, translate the whole phrase idiomatically).
- alternatives: up to 3 other common meanings of the word in general (can be empty).
- lemma: the dictionary form. For verbs use the infinitive including any separable prefix found elsewhere in the sentence (e.g. «fängt … an» → «anfangen»). For nouns: nominative singular without article. For a phrase: its canonical form.
- pos: part of speech.
- gender: for nouns m/f/n (pl if plural-only), otherwise "".
- article: der/die/das for nouns (or the ${languageName(p.lang)} equivalent), otherwise "".
- plural: nominative plural for nouns, otherwise "".
- form: brief grammatical description of this exact form in this sentence (e.g. "3rd person singular present", "dative plural", "past participle"). "" if it is the base form.
- note: one short, genuinely useful learner tip about this word here (separable verb, case it takes, false friend, idiom, register). "" if nothing notable.
- expression: if the word belongs to a multi-word expression or separable verb in this sentence, the full expression as it appears (e.g. «fängt … an»), else "".
- expressionTranslation: translation of that expression, else "".`,
  });
}

// ---------- batch glosses for a page (prefetch) ----------

const GLOSS_SCHEMA = obj({
  items: {
    type: "array",
    items: obj({ term: str, translation: str, lemma: str, gender: { type: "string", enum: ["m", "f", "n", "pl", ""] } }),
  },
});

export async function glossBatch(p: { lang: string; native: string; items: { term: string; sentence: string }[] }) {
  const list = p.items.map((it, i) => `${i + 1}. «${it.term}» — in: «${it.sentence}»`).join("\n");
  const res = await generateJson<{ items: Gloss[] }>({
    system: tutor(p.lang, p.native),
    maxTokens: 120 + p.items.length * 60,
    schema: GLOSS_SCHEMA,
    prompt: `Give a short in-context ${languageName(p.native)} gloss for each ${languageName(p.lang)} word below, as used in its sentence. Keep "term" exactly as given. translation: 1–4 words. lemma: dictionary form (infinitive with separable prefix for verbs, nominative singular for nouns). gender: m/f/n/pl for nouns, else "".

${list}`,
  }, "background");
  return res.items;
}

// ---------- sentences ----------

export function translateSentence(p: { lang: string; native: string; sentence: string; context?: string }) {
  return generateJson<SentenceTranslation>({
    system: tutor(p.lang, p.native),
    maxTokens: 500,
    schema: obj({ translation: str }),
    prompt: `${p.context ? `Surrounding text (for context only): «${p.context}»\n\n` : ""}Translate this sentence naturally and faithfully into ${languageName(p.native)}:\n«${p.sentence}»`,
  });
}

export function explainSentence(p: { lang: string; native: string; sentence: string }) {
  return generateJson<SentenceExplanation>({
    system: tutor(p.lang, p.native),
    maxTokens: 1500,
    schema: obj({
      translation: str,
      literal: str,
      chunks: { type: "array", items: obj({ text: str, meaning: str, note: str }) },
      grammar: { type: "array", items: str },
    }),
    prompt: `Break down this ${languageName(p.lang)} sentence for a learner:
«${p.sentence}»

- translation: natural ${languageName(p.native)} translation.
- literal: word-for-word literal translation that shows the ${languageName(p.lang)} word order.
- chunks: the sentence split into meaningful chunks in order (phrases, not single letters), each with its meaning and a short note on grammar (case, tense, word order, separable verbs) or "".
- grammar: 2–4 short bullet points on the most useful grammar in this sentence (e.g. verb-final in subordinate clauses, dative after «mit», adjective endings). Plain text, no markdown.`,
  });
}

// ---------- lesson generation ----------

export function generateLesson(p: {
  lang: string;
  native: string;
  level: Level;
  topic: string;
  style: string;
  words: number;
  targetWords: string[];
}) {
  const vocab = p.targetWords.length
    ? `\nNaturally use as many of these words the learner is currently studying as fit (inflect them as needed): ${p.targetWords.join(", ")}.`
    : "";
  return generateJson<GeneratedLesson>({
    system: `You are a gifted ${languageName(p.lang)} author writing graded readers for language learners. You write engaging, natural, idiomatic ${languageName(p.lang)} (never translated-sounding), with a clear narrative or structure, concrete details and some humor where it fits. Respond only with JSON matching the schema.`,
    maxTokens: Math.min(8000, 400 + p.words * 3),
    schema: obj({ title: str, text: str }),
    prompt: `Write a ${p.style} in ${languageName(p.lang)} about: ${p.topic || "a surprising everyday situation"}.
Level: CEFR ${p.level} — ${LEVEL_DESCRIPTIONS[p.level]}.
Length: about ${p.words} words.${vocab}
Use short paragraphs separated by a blank line. For dialogue, start each speaker's line with their name and a colon on its own paragraph.
The text must be entirely in ${languageName(p.lang)} (no translations or glossary). Give it a short ${languageName(p.lang)} title.`,
  });
}

export function simplifyText(p: { lang: string; native: string; level: Level; title: string; text: string }) {
  return generateJson<GeneratedLesson>({
    system: `You are an expert ${languageName(p.lang)} teacher who adapts authentic texts into graded readers. Respond only with JSON matching the schema.`,
    maxTokens: 8000,
    schema: obj({ title: str, text: str }),
    prompt: `Rewrite the following ${languageName(p.lang)} text for a CEFR ${p.level} learner (${LEVEL_DESCRIPTIONS[p.level]}).
Keep the content, facts and order, and keep it in ${languageName(p.lang)}; simplify vocabulary and grammar, split long sentences, and keep paragraphs separated by blank lines. Title: the original title adapted to the level.

Title: ${p.title}

${p.text}`,
  });
}
