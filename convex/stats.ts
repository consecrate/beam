import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { bumpDaily } from "./model";

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const active = (d: { wordsRead: number; reviews: number; lingqsCreated: number; knownAdded: number }) =>
  d.wordsRead > 0 || d.reviews > 0 || d.lingqsCreated > 0 || d.knownAdded > 0;

/** Everything the dashboard needs, in one subscription. `today` is the learner's local date. */
export const dashboard = query({
  args: { lang: v.string(), today: v.string() },
  handler: async (ctx, { lang, today }) => {
    const counts = await ctx.db.query("counts").withIndex("by_lang", (q) => q.eq("lang", lang)).unique();
    const from = addDays(today, -370);
    const days = await ctx.db
      .query("daily")
      .withIndex("by_lang_date", (q) => q.eq("lang", lang).gte("date", from).lte("date", today))
      .collect();
    const byDate = new Map(days.map((d) => [d.date, d]));

    // Streak: consecutive active days ending today (or yesterday, if today is still empty).
    let streak = 0;
    let cursor = byDate.get(today) && active(byDate.get(today)!) ? today : addDays(today, -1);
    while (byDate.get(cursor) && active(byDate.get(cursor)!)) {
      streak++;
      cursor = addDays(cursor, -1);
    }

    const empty = { knownAdded: 0, lingqsCreated: 0, wordsRead: 0, reviews: 0, minutes: 0, lessonsCompleted: 0 };
    const t = byDate.get(today);
    const todayStats = t
      ? { knownAdded: t.knownAdded, lingqsCreated: t.lingqsCreated, wordsRead: t.wordsRead, reviews: t.reviews, minutes: t.minutes, lessonsCompleted: t.lessonsCompleted }
      : empty;

    const totals = days.reduce(
      (acc, d) => ({
        wordsRead: acc.wordsRead + d.wordsRead,
        minutes: acc.minutes + d.minutes,
        lessonsCompleted: acc.lessonsCompleted + d.lessonsCompleted,
      }),
      { wordsRead: 0, minutes: 0, lessonsCompleted: 0 },
    );

    return {
      known: counts?.known ?? 0,
      learning: counts?.learning ?? 0,
      ignored: counts?.ignored ?? 0,
      today: todayStats,
      streak,
      totals,
      history: days.map((d) => ({
        date: d.date,
        knownAdded: d.knownAdded,
        lingqsCreated: d.lingqsCreated,
        wordsRead: d.wordsRead,
        reviews: d.reviews,
        minutes: d.minutes,
      })),
    };
  },
});

/** Logs reading activity: words read on a finished page and active minutes. */
export const logActivity = mutation({
  args: { lang: v.string(), date: v.string(), wordsRead: v.optional(v.number()), minutes: v.optional(v.number()) },
  handler: async (ctx, { lang, date, wordsRead, minutes }) => {
    await bumpDaily(ctx, lang, date, {
      wordsRead: Math.max(0, Math.min(5000, wordsRead ?? 0)),
      minutes: Math.max(0, Math.min(10, minutes ?? 0)),
    });
  },
});
