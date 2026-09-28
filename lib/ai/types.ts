// Shapes of the AI responses, shared by the API routes and the client.

export interface WordLookup {
  translation: string;
  alternatives: string[];
  lemma: string;
  pos: string;
  gender: "m" | "f" | "n" | "pl" | "";
  article: string;
  plural: string;
  form: string;
  note: string;
  expression: string;
  expressionTranslation: string;
}

export interface Gloss {
  term: string;
  translation: string;
  lemma: string;
  gender: "m" | "f" | "n" | "pl" | "";
}

export interface SentenceTranslation {
  translation: string;
}

export interface SentenceExplanation {
  translation: string;
  literal: string;
  chunks: { text: string; meaning: string; note: string }[];
  grammar: string[];
}

export interface GeneratedLesson {
  title: string;
  text: string;
}
