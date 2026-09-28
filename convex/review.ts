import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { applyStatus, bumpDaily, isLearning, STATUS } from "./model";
import { newCard, schedule, type Rating } from "../lib/fsrs";

/** Learning words whose review is due, soonest first. */
export const due = query({
  args: { lang: v.string(), now: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { lang, now, limit }) => {
    return ctx.db
      .query("words")
      .withIndex("by_due", (q) => q.eq("lang", lang).gte("srsDue", 0).lte("srsDue", now))
      .take(limit ?? 100);
  },
});

/** Number of cards due now and within the next day. */
export const counts = query({
  args: { lang: v.string(), now: v.number() },
  handler: async (ctx, { lang, now }) => {
    const soon = await ctx.db
      .query("words")
      .withIndex("by_due", (q) => q.eq("lang", lang).gte("srsDue", 0).lte("srsDue", now + 86_400_000))
      .take(1000);
    return { dueNow: soon.filter((w) => (w.srsDue ?? 0) <= now).length, dueToday: soon.length };
  },
});

/**
 * Records a review. Successful recalls raise the LingQ status by one (up to 4);
 * a lapse drops it back to 1. `markKnown` graduates the word out of reviews.
 */
export const rate = mutation({
  args: {
    id: v.id("words"),
    rating: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
    date: v.string(),
    markKnown: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, rating, date, markKnown }) => {
    const w = await ctx.db.get(id);
    if (!w) throw new Error("Word not found");
    await bumpDaily(ctx, w.lang, date, { reviews: 1 });
    if (markKnown) {
      await applyStatus(ctx, { lang: w.lang, term: w.term, status: STATUS.KNOWN, date }, w);
      return { due: null };
    }
    if (!isLearning(w.status)) return { due: null };
    const now = Date.now();
    const result = schedule(w.srs ?? newCard(), rating as Rating, now);
    const status = rating === 1 ? 1 : rating === 2 ? w.status : Math.min(4, w.status + 1);
    await ctx.db.patch(id, { srs: result.card, srsDue: result.due, status, updatedAt: now });
    return { due: result.due };
  },
});
