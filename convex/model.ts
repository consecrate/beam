// Shared helpers for Convex functions (no functions are exported from here).
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { newCard } from "../lib/fsrs";
export { DEFAULT_SETTINGS } from "../lib/settings";

export const STATUS = { IGNORED: 0, KNOWN: 5 } as const;
export const isLearning = (s: number | undefined) => s !== undefined && s >= 1 && s <= 4;

type DailyField = "knownAdded" | "lingqsCreated" | "wordsRead" | "reviews" | "minutes" | "lessonsCompleted";

export async function bumpDaily(ctx: MutationCtx, lang: string, date: string, deltas: Partial<Record<DailyField, number>>) {
  const row = await ctx.db
    .query("daily")
    .withIndex("by_lang_date", (q) => q.eq("lang", lang).eq("date", date))
    .unique();
  if (row) {
    const patch: Partial<Record<DailyField, number>> = {};
    for (const [k, d] of Object.entries(deltas) as [DailyField, number][]) patch[k] = Math.max(0, row[k] + d);
    await ctx.db.patch(row._id, patch);
  } else {
    await ctx.db.insert("daily", {
      lang,
      date,
      knownAdded: Math.max(0, deltas.knownAdded ?? 0),
      lingqsCreated: Math.max(0, deltas.lingqsCreated ?? 0),
      wordsRead: Math.max(0, deltas.wordsRead ?? 0),
      reviews: Math.max(0, deltas.reviews ?? 0),
      minutes: Math.max(0, deltas.minutes ?? 0),
      lessonsCompleted: Math.max(0, deltas.lessonsCompleted ?? 0),
    });
  }
}

function bucket(status: number | undefined): "known" | "learning" | "ignored" | null {
  if (status === undefined) return null;
  if (status === STATUS.KNOWN) return "known";
  if (status === STATUS.IGNORED) return "ignored";
  return "learning";
}

/** Keeps the per-language totals in sync when a word moves between statuses. */
export async function adjustCounts(ctx: MutationCtx, lang: string, from: number | undefined, to: number | undefined) {
  const a = bucket(from);
  const b = bucket(to);
  if (a === b) return;
  const row = await ctx.db.query("counts").withIndex("by_lang", (q) => q.eq("lang", lang)).unique();
  const next = { known: row?.known ?? 0, learning: row?.learning ?? 0, ignored: row?.ignored ?? 0 };
  if (a) next[a] = Math.max(0, next[a] - 1);
  if (b) next[b] += 1;
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("counts", { lang, ...next });
}

export async function getWord(ctx: QueryCtx, lang: string, term: string) {
  return ctx.db
    .query("words")
    .withIndex("by_term", (q) => q.eq("lang", lang).eq("term", term))
    .unique();
}

export function searchTextFor(term: string, translation?: string, lemma?: string) {
  return [term, lemma, translation].filter(Boolean).join(" ");
}

export interface StatusChange {
  lang: string;
  term: string;
  status: number;
  date: string;
  translation?: string;
  context?: string;
  lessonId?: Id<"lessons">;
  lemma?: string;
  pos?: string;
  gender?: string;
}

/**
 * Creates or updates a word with a new status, keeping SRS scheduling, totals
 * and the daily log consistent. Returns the word id.
 */
export async function applyStatus(ctx: MutationCtx, change: StatusChange, existing?: Doc<"words"> | null) {
  const now = Date.now();
  const word = existing === undefined ? await getWord(ctx, change.lang, change.term) : existing;
  const prev = word?.status;
  const status = change.status;

  // SRS: learning words are scheduled; known and ignored words leave the queue.
  let srs = word?.srs;
  let srsDue = word?.srsDue;
  if (isLearning(status)) {
    if (!srs || !isLearning(prev)) {
      srs = newCard();
      srsDue = now;
    }
  } else {
    srs = undefined;
    srsDue = undefined;
  }

  const translation = change.translation ?? word?.translation;
  const lemma = change.lemma ?? word?.lemma;
  let id: Id<"words">;
  if (word) {
    await ctx.db.patch(word._id, {
      status,
      srs,
      srsDue,
      translation,
      lemma,
      pos: change.pos ?? word.pos,
      gender: change.gender ?? word.gender,
      context: word.context ?? change.context,
      lessonId: word.lessonId ?? change.lessonId,
      searchText: searchTextFor(word.term, translation, lemma),
      updatedAt: now,
      knownAt: status === STATUS.KNOWN ? (prev === STATUS.KNOWN ? word.knownAt : now) : undefined,
    });
    id = word._id;
  } else {
    id = await ctx.db.insert("words", {
      lang: change.lang,
      term: change.term,
      isPhrase: change.term.includes(" "),
      status,
      translation,
      lemma,
      pos: change.pos,
      gender: change.gender,
      context: change.context,
      lessonId: change.lessonId,
      srs,
      srsDue,
      searchText: searchTextFor(change.term, translation, lemma),
      createdAt: now,
      updatedAt: now,
      knownAt: status === STATUS.KNOWN ? now : undefined,
    });
  }

  await adjustCounts(ctx, change.lang, prev, status);
  const deltas: Partial<Record<DailyField, number>> = {};
  if (status === STATUS.KNOWN && prev !== STATUS.KNOWN) deltas.knownAdded = 1;
  if (prev === STATUS.KNOWN && status !== STATUS.KNOWN) deltas.knownAdded = -1;
  if (isLearning(status) && prev === undefined) deltas.lingqsCreated = 1;
  if (Object.keys(deltas).length) await bumpDaily(ctx, change.lang, change.date, deltas);
  return id;
}

export async function getSettingsDoc(ctx: QueryCtx) {
  return ctx.db.query("settings").first();
}
