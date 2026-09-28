import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { insertLesson } from "./lessons";
import { STARTER_LESSONS } from "../lib/starterLessons";

/** Adds the starter lessons for a language the first time its library is opened. */
export const ensureStarterLessons = mutation({
  args: { lang: v.string() },
  handler: async (ctx, { lang }) => {
    const existing = await ctx.db
      .query("lessons")
      .withIndex("by_lang_created", (q) => q.eq("lang", lang))
      .first();
    if (existing) return 0;
    const lessons = STARTER_LESSONS[lang] ?? [];
    const now = Date.now();
    // Descending timestamps keep the easiest lesson first in the newest-first library.
    for (let i = 0; i < lessons.length; i++) {
      await insertLesson(ctx, { lang, ...lessons[i], source: "starter", collection: "Starter", createdAt: now - i });
    }
    return lessons.length;
  },
});
