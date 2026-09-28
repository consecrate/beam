import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { lessonSource } from "./schema";
import { bumpDaily, getWord, STATUS } from "./model";
import { countWords, splitIntoParts, uniqueTerms } from "../lib/text";

const MAX_TEXT = 400_000;

export async function insertLesson(
  ctx: MutationCtx,
  args: {
    lang: string;
    title: string;
    text: string;
    source: "starter" | "paste" | "file" | "url" | "ai" | "simplified";
    level?: string;
    description?: string;
    sourceUrl?: string;
    collection?: string;
    createdAt?: number;
  },
): Promise<Id<"lessons">> {
  const terms = uniqueTerms(args.text, args.lang);
  const lessonId = await ctx.db.insert("lessons", {
    lang: args.lang,
    title: args.title.trim() || "Untitled",
    description: args.description,
    level: args.level,
    source: args.source,
    sourceUrl: args.sourceUrl,
    collection: args.collection,
    wordCount: countWords(args.text),
    uniqueCount: terms.length,
    progressPage: 0,
    createdAt: args.createdAt ?? Date.now(),
  });
  await ctx.db.insert("lessonBodies", { lessonId, text: args.text, terms });
  return lessonId;
}

/**
 * Creates one lesson, or several numbered parts when the text is long, so each
 * lesson stays a comfortable reading session. Returns the first lesson id.
 */
export const create = mutation({
  args: {
    lang: v.string(),
    title: v.string(),
    text: v.string(),
    source: lessonSource,
    level: v.optional(v.string()),
    description: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (!text) throw new Error("The lesson text is empty.");
    if (text.length > MAX_TEXT) throw new Error("That text is too long (max ~60,000 words). Split it into smaller pieces.");
    const parts = splitIntoParts(text);
    const now = Date.now();
    let first: Id<"lessons"> | null = null;
    for (let i = 0; i < parts.length; i++) {
      const id = await insertLesson(ctx, {
        ...args,
        text: parts[i],
        title: parts.length > 1 ? `${args.title} (${i + 1}/${parts.length})` : args.title,
        collection: parts.length > 1 ? args.title : undefined,
        // Keep parts in reading order in the newest-first library.
        createdAt: now - i,
      });
      first ??= id;
    }
    return first!;
  },
});

export const list = query({
  args: { lang: v.string() },
  handler: async (ctx, { lang }) => {
    return ctx.db
      .query("lessons")
      .withIndex("by_lang_created", (q) => q.eq("lang", lang))
      .order("desc")
      .take(500);
  },
});

export const recent = query({
  args: { lang: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { lang, limit }) => {
    return ctx.db
      .query("lessons")
      .withIndex("by_lang_opened", (q) => q.eq("lang", lang).gt("lastOpenedAt", 0))
      .order("desc")
      .take(limit ?? 4);
  },
});

export const get = query({
  args: { id: v.id("lessons") },
  handler: async (ctx, { id }) => {
    const lesson = await ctx.db.get(id);
    if (!lesson) return null;
    const body = await ctx.db
      .query("lessonBodies")
      .withIndex("by_lesson", (q) => q.eq("lessonId", id))
      .unique();
    return { ...lesson, text: body?.text ?? "" };
  },
});

/** How much of a lesson's vocabulary is new / learning / known (for picking comprehensible input). */
export const coverage = query({
  args: { id: v.id("lessons") },
  handler: async (ctx, { id }) => {
    const lesson = await ctx.db.get(id);
    if (!lesson) return null;
    const body = await ctx.db
      .query("lessonBodies")
      .withIndex("by_lesson", (q) => q.eq("lessonId", id))
      .unique();
    const terms = (body?.terms ?? []).slice(0, 3000);
    let known = 0;
    let learning = 0;
    for (const t of terms) {
      const w = await getWord(ctx, lesson.lang, t);
      if (!w) continue;
      if (w.status === STATUS.KNOWN || w.status === STATUS.IGNORED) known++;
      else learning++;
    }
    const total = terms.length || 1;
    return {
      unique: terms.length,
      newCount: terms.length - known - learning,
      learning,
      known,
      newPct: Math.round(((terms.length - known - learning) / total) * 100),
    };
  },
});

export const open = mutation({
  args: { id: v.id("lessons"), pageCount: v.number() },
  handler: async (ctx, { id, pageCount }) => {
    await ctx.db.patch(id, { lastOpenedAt: Date.now(), pageCount });
  },
});

export const setProgress = mutation({
  args: { id: v.id("lessons"), page: v.number() },
  handler: async (ctx, { id, page }) => {
    await ctx.db.patch(id, { progressPage: Math.max(0, Math.floor(page)), lastOpenedAt: Date.now() });
  },
});

export const complete = mutation({
  args: { id: v.id("lessons"), date: v.string() },
  handler: async (ctx, { id, date }) => {
    const lesson = await ctx.db.get(id);
    if (!lesson) return;
    const first = !lesson.completedAt;
    await ctx.db.patch(id, { completedAt: Date.now(), lastOpenedAt: Date.now() });
    if (first) await bumpDaily(ctx, lesson.lang, date, { lessonsCompleted: 1 });
  },
});

export const rename = mutation({
  args: { id: v.id("lessons"), title: v.string(), level: v.optional(v.string()) },
  handler: async (ctx, { id, title, level }) => {
    await ctx.db.patch(id, { title: title.trim() || "Untitled", level });
  },
});

export const remove = mutation({
  args: { id: v.id("lessons") },
  handler: async (ctx, { id }) => {
    const body = await ctx.db
      .query("lessonBodies")
      .withIndex("by_lesson", (q) => q.eq("lessonId", id))
      .unique();
    if (body) await ctx.db.delete(body._id);
    await ctx.db.delete(id);
  },
});
