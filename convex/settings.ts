import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { DEFAULT_SETTINGS, getSettingsDoc } from "./model";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const doc = await getSettingsDoc(ctx);
    if (!doc) return { ...DEFAULT_SETTINGS };
    const { _id, _creationTime, ...rest } = doc;
    return { ...DEFAULT_SETTINGS, ...rest };
  },
});

export const update = mutation({
  args: {
    targetLang: v.optional(v.string()),
    nativeLang: v.optional(v.string()),
    dailyGoal: v.optional(v.number()),
    autoKnownOnPageTurn: v.optional(v.boolean()),
    hoverTranslations: v.optional(v.boolean()),
    showGenderColors: v.optional(v.boolean()),
    ttsRate: v.optional(v.number()),
    ttsVoice: v.optional(v.string()),
    fontSize: v.optional(v.number()),
    theme: v.optional(v.union(v.literal("system"), v.literal("light"), v.literal("dark"))),
  },
  handler: async (ctx, patch) => {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    const doc = await getSettingsDoc(ctx);
    if (doc) await ctx.db.patch(doc._id, clean);
    else await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, ...clean });
  },
});
