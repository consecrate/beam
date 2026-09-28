import type { Gloss, SentenceExplanation, SentenceTranslation, WordLookup } from "../ai/types";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const ai = {
  word: (lang: string, native: string, term: string, sentence: string) =>
    post<WordLookup & { cached: boolean }>("/api/ai/word", { lang, native, term, sentence }),
  gloss: (lang: string, native: string, items: { term: string; sentence: string }[]) =>
    post<Record<string, Gloss>>("/api/ai/gloss", { lang, native, items }),
  sentence: (lang: string, native: string, sentence: string) =>
    post<SentenceTranslation>("/api/ai/sentence", { lang, native, sentence }),
  explain: (lang: string, native: string, sentence: string) =>
    post<SentenceExplanation>("/api/ai/explain", { lang, native, sentence }),
  generate: (body: { lang: string; native: string; level: string; topic: string; style: string; words: number; targetWords: string[] }) =>
    post<{ id: string }>("/api/ai/generate", body),
  simplify: (lessonId: string, native: string, level: string) =>
    post<{ id: string }>("/api/ai/simplify", { lessonId, native, level }),
  importUrl: (url: string) => post<{ title: string; text: string; siteName?: string }>("/api/import-url", { url }),
};
