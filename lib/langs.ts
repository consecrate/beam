export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  /** BCP-47 tag for speech synthesis. */
  speech: string;
  /** Whether nouns carry grammatical gender worth color-coding. */
  hasGender: boolean;
  flag: string;
}

export const LANGUAGES: Record<string, LanguageInfo> = {
  de: { code: "de", name: "German", nativeName: "Deutsch", speech: "de-DE", hasGender: true, flag: "🇩🇪" },
  es: { code: "es", name: "Spanish", nativeName: "Español", speech: "es-ES", hasGender: true, flag: "🇪🇸" },
  fr: { code: "fr", name: "French", nativeName: "Français", speech: "fr-FR", hasGender: true, flag: "🇫🇷" },
  it: { code: "it", name: "Italian", nativeName: "Italiano", speech: "it-IT", hasGender: true, flag: "🇮🇹" },
  pt: { code: "pt", name: "Portuguese", nativeName: "Português", speech: "pt-BR", hasGender: true, flag: "🇧🇷" },
  nl: { code: "nl", name: "Dutch", nativeName: "Nederlands", speech: "nl-NL", hasGender: true, flag: "🇳🇱" },
};

export const NATIVE_LANGUAGES: Record<string, string> = { en: "English" };

export function languageName(code: string): string {
  return LANGUAGES[code]?.name ?? NATIVE_LANGUAGES[code] ?? code;
}

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  A1: "absolute beginner: very short, simple present-tense sentences, the most common 500 words",
  A2: "elementary: short sentences, everyday topics, present and perfect tense, common 1500 words",
  B1: "intermediate: connected text, subordinate clauses, past tenses, everyday and some abstract topics",
  B2: "upper intermediate: natural native-like prose, varied grammar and vocabulary, idioms in moderation",
  C1: "advanced: rich, nuanced, idiomatic language as in quality journalism or literature",
  C2: "mastery: unrestricted native-level language",
};

// Rough mapping from known word forms to CEFR, following LingQ's German scale.
// Inflected forms count separately, so the thresholds are higher than
// lemma-based vocabulary sizes.
const LEVEL_THRESHOLDS: [Level | "Pre-A1", number][] = [
  ["Pre-A1", 0],
  ["A1", 500],
  ["A2", 2000],
  ["B1", 5000],
  ["B2", 10000],
  ["C1", 18000],
  ["C2", 30000],
];

export function estimateLevel(knownWords: number): { level: string; next?: string; progress: number; nextAt?: number } {
  let i = 0;
  while (i + 1 < LEVEL_THRESHOLDS.length && knownWords >= LEVEL_THRESHOLDS[i + 1][1]) i++;
  const [level, from] = LEVEL_THRESHOLDS[i];
  const next = LEVEL_THRESHOLDS[i + 1];
  if (!next) return { level, progress: 1 };
  return { level, next: next[0], nextAt: next[1], progress: (knownWords - from) / (next[1] - from) };
}
