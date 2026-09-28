export type WordStatus = "new" | 0 | 1 | 2 | 3 | 4 | 5;

export interface WordEntry {
  status: number;
  translation?: string;
  gender?: string;
  lemma?: string;
}

export interface PhraseEntry {
  term: string;
  status: number;
  translation?: string;
}

/** A selection of one or more consecutive tokens within a sentence. */
export interface Selection {
  sentence: number;
  /** Token indices (inclusive), a <= b after normalization. */
  a: number;
  b: number;
}

export function statusClass(status: number | undefined): string {
  if (status === undefined) return "s-new";
  if (status === 5) return "s-known";
  if (status === 0) return "s-ignored";
  return `s-${status}`;
}

export function statusLabel(status: number | undefined): string {
  if (status === undefined) return "New";
  if (status === 5) return "Known";
  if (status === 0) return "Ignored";
  return `LingQ ${status}`;
}
