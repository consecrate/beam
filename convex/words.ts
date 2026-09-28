import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { adjustCounts, applyStatus, bumpDaily, getWord, searchTextFor, STATUS } from "./model";
import { normalizePhrase, normalizeTerm } from "../lib/text";

export interface WordInfo {
  term: string;
  status: number;
  translation?: string;
  gender?: string;
  lemma?: string;
}

const MAX_LOOKUPS = 3000;

/**
 * Status and saved meaning for every term in a lesson, plus the learner's saved
 * phrases (so the reader can highlight multi-word LingQs).
 */
export const forLesson = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, { lessonId }) => {
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return null;
    const body = await ctx.db
      .query("lessonBodies")
      .withIndex("by_lesson", (q) => q.eq("lessonId", lessonId))
      .unique();
    // An array, not an object: Convex field names must be ASCII and terms aren't.
    const words: WordInfo[] = [];
    for (const term of (body?.terms ?? []).slice(0, MAX_LOOKUPS)) {
      const w = await getWord(ctx, lesson.lang, term);
      if (w) words.push({ term, status: w.status, translation: w.translation, gender: w.gender, lemma: w.lemma });
    }
    const phraseDocs = await ctx.db
      .query("words")
      .withIndex("by_phrase", (q) => q.eq("lang", lesson.lang).eq("isPhrase", true))
      .take(1000);
    const phrases = phraseDocs
      .filter((p) => p.status !== STATUS.IGNORED)
      .map((p) => ({ term: p.term, status: p.status, translation: p.translation }));
    return { words, phrases };
  },
});

export const get = query({
  args: { lang: v.string(), term: v.string() },
  handler: async (ctx, { lang, term }) => getWord(ctx, lang, term),
});

/** Sets the status of a word or phrase, creating the LingQ if needed. */
export const setStatus = mutation({
  args: {
    lang: v.string(),
    term: v.string(),
    status: v.number(),
    date: v.string(),
    translation: v.optional(v.string()),
    context: v.optional(v.string()),
    lessonId: v.optional(v.id("lessons")),
    lemma: v.optional(v.string()),
    pos: v.optional(v.string()),
    gender: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.status < 0 || args.status > 5) throw new Error("Invalid status");
    const term = args.term.includes(" ") ? normalizePhrase(args.term, args.lang) : normalizeTerm(args.term, args.lang);
    if (!term) throw new Error("Empty term");
    return applyStatus(ctx, { ...args, term });
  },
});

/** Edits the learner's own meaning / notes for a word. */
export const updateMeaning = mutation({
  args: {
    id: v.id("words"),
    translation: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, translation, notes }) => {
    const w = await ctx.db.get(id);
    if (!w) throw new Error("Word not found");
    const t = translation ?? w.translation;
    await ctx.db.patch(id, {
      translation: t,
      notes: notes ?? w.notes,
      searchText: searchTextFor(w.term, t, w.lemma),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Marks every given term that is still new as known (LingQ's "page turn"
 * behavior). Returns the terms that changed so the client can offer undo.
 */
export const markNewAsKnown = mutation({
  args: { lang: v.string(), terms: v.array(v.string()), date: v.string(), lessonId: v.optional(v.id("lessons")) },
  handler: async (ctx, { lang, terms, date, lessonId }) => {
    const changed: string[] = [];
    for (const raw of new Set(terms)) {
      const term = normalizeTerm(raw, lang);
      if (!term) continue;
      const existing = await getWord(ctx, lang, term);
      if (existing) continue;
      await applyStatus(ctx, { lang, term, status: STATUS.KNOWN, date, lessonId }, null);
      changed.push(term);
    }
    return changed;
  },
});

/** Reverts a page-turn: deletes the known entries that were just created. */
export const undoMarkKnown = mutation({
  args: { lang: v.string(), terms: v.array(v.string()), date: v.string() },
  handler: async (ctx, { lang, terms, date }) => {
    let removed = 0;
    for (const term of terms) {
      const w = await getWord(ctx, lang, term);
      if (!w || w.status !== STATUS.KNOWN) continue;
      await ctx.db.delete(w._id);
      await adjustCounts(ctx, lang, STATUS.KNOWN, undefined);
      removed++;
    }
    if (removed) await bumpDaily(ctx, lang, date, { knownAdded: -removed });
    return removed;
  },
});

/** Removes a word entirely, making it "new" again. */
export const remove = mutation({
  args: { id: v.id("words") },
  handler: async (ctx, { id }) => {
    const w = await ctx.db.get(id);
    if (!w) return;
    await ctx.db.delete(id);
    await adjustCounts(ctx, w.lang, w.status, undefined);
  },
});

const FILTERS = ["all", "learning", "known", "ignored", "1", "2", "3", "4"] as const;

/** Vocabulary list with search and status filter, newest first. */
export const list = query({
  args: {
    lang: v.string(),
    filter: v.string(),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { lang, filter, search, limit }) => {
    const n = Math.min(limit ?? 200, 1000);
    if (!(FILTERS as readonly string[]).includes(filter)) throw new Error("Unknown filter");
    const statusFilter = (s: number) =>
      filter === "all" ||
      (filter === "learning" && s >= 1 && s <= 4) ||
      (filter === "known" && s === STATUS.KNOWN) ||
      (filter === "ignored" && s === STATUS.IGNORED) ||
      String(s) === filter;

    if (search && search.trim()) {
      const hits = await ctx.db
        .query("words")
        .withSearchIndex("search", (q) => q.search("searchText", search.trim()).eq("lang", lang))
        .take(200);
      return hits.filter((w) => statusFilter(w.status)).slice(0, n);
    }
    if (filter === "all") {
      return ctx.db.query("words").withIndex("by_updated", (q) => q.eq("lang", lang)).order("desc").take(n);
    }
    if (filter === "learning") {
      return ctx.db
        .query("words")
        .withIndex("by_status", (q) => q.eq("lang", lang).gte("status", 1).lte("status", 4))
        .order("desc")
        .take(n);
    }
    const status = filter === "known" ? STATUS.KNOWN : filter === "ignored" ? STATUS.IGNORED : Number(filter);
    return ctx.db
      .query("words")
      .withIndex("by_status", (q) => q.eq("lang", lang).eq("status", status))
      .order("desc")
      .take(n);
  },
});

/** Learning words (LingQs) to weave into AI-generated stories, weakest first. */
export const forStory = query({
  args: { lang: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { lang, limit }) => {
    const rows = await ctx.db
      .query("words")
      .withIndex("by_status", (q) => q.eq("lang", lang).gte("status", 1).lte("status", 3))
      .order("desc")
      .take(200);
    rows.sort((a, b) => a.status - b.status || (a.srsDue ?? 0) - (b.srsDue ?? 0));
    return rows.slice(0, limit ?? 25).map((w) => ({ term: w.term, translation: w.translation }));
  },
});

/** All learning words for export (CSV / Anki). */
export const exportLearning = query({
  args: { lang: v.string(), includeKnown: v.boolean() },
  handler: async (ctx, { lang, includeKnown }) => {
    const learning = await ctx.db
      .query("words")
      .withIndex("by_status", (q) => q.eq("lang", lang).gte("status", 1).lte("status", 4))
      .take(8000);
    const known = includeKnown
      ? await ctx.db.query("words").withIndex("by_status", (q) => q.eq("lang", lang).eq("status", STATUS.KNOWN)).take(8000)
      : [];
    return [...learning, ...known].map((w) => ({
      term: w.term,
      status: w.status,
      translation: w.translation ?? "",
      lemma: w.lemma ?? "",
      gender: w.gender ?? "",
      context: w.context ?? "",
      notes: w.notes ?? "",
    }));
  },
});
